import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthService } from '../server/auth-api.mjs'
import { createShipConfigService, createDefaultShipConfig, loadDeviceTypeTemplate } from '../server/ship-config-api.mjs'
import {
  buildConfiguredDeviceSensors,
  parsePointCodeFromSensorId,
  toTemplateUnitValue
} from '../src/workflow/localSensorData.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

test('localSensorData converts MPa channels to bar and reflects configured names, enabled points and normal limits', () => {
  const template = loadDeviceTypeTemplate(ROOT)
  const config = createDefaultShipConfig(template)
  // Customize main engine DC0005 (MPa->bar), DC0008 (rename), DC0014 (disabled), DC0028 (custom normal range)
  const main = config.devices[0]
  main.points.find((p) => p.pointCode === 'DC0008').instanceName = '1#主机1缸排温'
  main.points.find((p) => p.pointCode === 'DC0014').enabled = false
  main.points.find((p) => p.pointCode === 'DC0028').normalMin = 3.5
  main.points.find((p) => p.pointCode === 'DC0028').normalMax = 4.9

  const rawPoints = [
    { pointCode: 'DC0001', value: 104.2 },
    { pointCode: 'DC0005', value: 2.15 }, // MPa -> 21.5 bar
    { pointCode: 'DC0008', value: 392.4 },
    { pointCode: 'DC0014', value: 2.0 },
    { pointCode: 'DC0028', value: 0.52 }, // MPa -> 5.2 bar (> 4.9 -> over)
    { pointCode: 'DC0043', value: 0 },
    { pointCode: 'DC0054', value: 128.0 } // already bar -> 128.0 bar
  ]

  assert.equal(toTemplateUnitValue('DC0005', 2.15), 21.5)
  assert.equal(toTemplateUnitValue('DC0054', 128.0), 128.0)

  const sensors = buildConfiguredDeviceSensors(config.devices, rawPoints, template)
  // main has 58 enabled points (DC0014 disabled), aux has 59 enabled points => 117 total
  assert.equal(sensors.length, 117)

  const mainStartAir = sensors.find((s) => s.deviceId === 'main-engine-1' && s.pointCode === 'DC0005')
  assert.equal(mainStartAir.unit, 'bar')
  assert.equal(mainStartAir.value, 21.5)
  assert.equal(mainStartAir.status, 'normal')

  const mainExh1 = sensors.find((s) => s.deviceId === 'main-engine-1' && s.pointCode === 'DC0008')
  assert.equal(mainExh1.nameCn, '1#主机1缸排温')
  assert.equal(mainExh1.id, 'main-cyl-1-exhaust')
  assert.equal(parsePointCodeFromSensorId(mainExh1.id), 'DC0008')

  assert.equal(sensors.find((s) => s.deviceId === 'main-engine-1' && s.pointCode === 'DC0014'), undefined)

  const mainLo = sensors.find((s) => s.deviceId === 'main-engine-1' && s.pointCode === 'DC0028')
  assert.equal(mainLo.value, 5.2)
  assert.equal(mainLo.status, 'over')
  assert.equal(mainLo.range, '3.5 ~ 4.9 bar')

  const auxStartAir = sensors.find((s) => s.deviceId === 'aux-system' && s.pointCode === 'DC0005')
  assert.equal(auxStartAir.system, '启动系统')
  assert.equal(auxStartAir.id, 'aux-system::DC0005')
  assert.equal(auxStartAir.value, 21.5)
  assert.equal(auxStartAir.unit, 'bar')
  assert.equal(parsePointCodeFromSensorId(auxStartAir.id), 'DC0005')
})

test('ship config API seeds main + aux RT-flex50 devices, enforces admin writes, template-only types and persistence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ship-cfg-test-'))
  const passwords = { chief: 'chief-pass', admin: 'admin-pass' }
  const auth = await createAuthService(ROOT, { directory: dir, passwords })
  let shipConfig = await createShipConfigService(ROOT, { directory: dir })
  const server = createServer((req, res) =>
    auth.handler(req, res, () => shipConfig.handler(req, res, () => { res.writeHead(404); res.end('{}') }))
  )
  await new Promise((r) => server.listen(0, '127.0.0.1', r))

  const call = async (method, path, body, token) => {
    const headers = { 'x-engine-room-client': 'local-ui', 'x-ship-session': token || 'none' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    })
    return { status: res.status, data: await res.json() }
  }

  try {
    // Unauthenticated blocked
    assert.equal((await call('GET', 'config/ship')).status, 401)

    const chiefLogin = await call('POST', 'auth/login', { username: 'chief', password: passwords.chief })
    const adminLogin = await call('POST', 'auth/login', { username: 'admin', password: passwords.admin })
    const chiefToken = chiefLogin.data.sessionToken
    const adminToken = adminLogin.data.sessionToken

    // Non-admin can read default seeded config (main + aux both RT-flex50, 59 points, bar units)
    const initial = await call('GET', 'config/ship', undefined, chiefToken)
    assert.equal(initial.status, 200)
    assert.equal(initial.data.template.deviceTypes.length, 1)
    assert.equal(initial.data.template.deviceTypes[0].points.length, 59)
    assert.equal(initial.data.config.devices.length, 2)
    assert.ok(initial.data.config.devices.every((device) => !('system' in device)))
    assert.deepEqual(
      initial.data.config.devices.map((d) => [d.id, d.name, d.deviceTypeId, d.points.length]),
      [
        ['main-engine-1', '主机', 'rt-flex50-main-engine', 59],
        ['aux-system', '辅机', 'rt-flex50-main-engine', 59]
      ]
    )

    // Non-admin cannot modify config
    const denied = await call('PUT', 'config/ship', { config: initial.data.config }, chiefToken)
    assert.equal(denied.status, 403)

    // Unknown device type rejected
    const badType = structuredClone(initial.data.config)
    badType.devices.push({
      id: 'fake-1',
      name: '非法设备',
      code: 'X-1',
      deviceTypeId: 'unknown-type',
      system: '辅机系统',
      enabled: true,
      points: []
    })
    assert.equal((await call('PUT', 'config/ship', { config: badType }, adminToken)).status, 400)

    // Invalid normalMin > normalMax rejected
    const badRange = structuredClone(initial.data.config)
    badRange.devices[0].points[0].normalMin = 120
    badRange.devices[0].points[0].normalMax = 90
    assert.equal((await call('PUT', 'config/ship', { config: badRange }, adminToken)).status, 400)

    // Admin adds a 3rd device from template, renames DC0008, updates normal limits, disables DC0014, toggles alarms
    const updated = structuredClone(initial.data.config)
    updated.devices[1].system = '辅机系统' // Legacy instance category is ignored, preserving its name and template.
    updated.devices[0].points.find((p) => p.pointCode === 'DC0008').instanceName = '1#主机1缸排温'
    updated.devices[0].points.find((p) => p.pointCode === 'DC0028').normalMin = 3.5
    updated.devices[0].points.find((p) => p.pointCode === 'DC0028').normalMax = 4.9
    updated.devices[0].points.find((p) => p.pointCode === 'DC0014').enabled = false
    updated.devices[1].alarms.anomalyTracking.enabled = true
    updated.devices[1].alarms.aiPeriodic.enabled = false
    updated.devices.push({
      id: 'me-2',
      name: '2号主机',
      code: 'ME-02',
      deviceTypeId: 'rt-flex50-main-engine',
      system: '主机系统',
      enabled: true,
      alarms: {
        oem: { enabled: true },
        aiPeriodic: { enabled: false, intervalMinutes: 30 },
        anomalyTracking: { enabled: true, windowMonths: 6, granularity: 'monthly' }
      },
      points: updated.devices[0].points.map((p) => ({
        ...p,
        enabled: p.pointCode === 'DC0008' || p.pointCode === 'DC0058'
      }))
    })

    const saveRes = await call('PUT', 'config/ship', { config: updated }, adminToken)
    assert.equal(saveRes.status, 200)
    assert.equal(saveRes.data.config.devices.length, 3)

    // Reload service from disk and verify persistence for chief account
    await shipConfig.close()
    shipConfig = await createShipConfigService(ROOT, { directory: dir })
    const reloaded = await call('GET', 'config/ship', undefined, chiefToken)
    assert.equal(reloaded.status, 200)
    assert.equal(reloaded.data.config.devices.length, 3)
    const main = reloaded.data.config.devices[0]
    assert.equal(main.points.find((p) => p.pointCode === 'DC0008').instanceName, '1#主机1缸排温')
    assert.equal(main.points.find((p) => p.pointCode === 'DC0028').normalMin, 3.5)
    assert.equal(main.points.find((p) => p.pointCode === 'DC0028').normalMax, 4.9)
    assert.equal(main.points.find((p) => p.pointCode === 'DC0014').enabled, false)
    // DC0043 alarm point always keeps normalMin/normalMax null
    assert.equal(main.points.find((p) => p.pointCode === 'DC0043').normalMin, null)
    assert.equal(reloaded.data.config.devices[1].alarms.anomalyTracking.enabled, true)
    assert.equal(reloaded.data.config.devices[1].alarms.aiPeriodic.enabled, false)
    assert.equal(reloaded.data.config.devices[1].deviceTypeId, 'rt-flex50-main-engine')
    assert.equal(reloaded.data.config.devices[1].name, '辅机')
    assert.ok(!('system' in reloaded.data.config.devices[1]))
    assert.equal(reloaded.data.config.devices[2].name, '2号主机')
    assert.deepEqual(reloaded.data.config.devices[2].points.filter((p) => p.enabled).map((p) => p.pointCode), ['DC0008', 'DC0058'])
  } finally {
    await new Promise((r) => server.close(r))
    await shipConfig.close()
    auth.close()
    await rm(dir, { recursive: true, force: true })
  }
})
