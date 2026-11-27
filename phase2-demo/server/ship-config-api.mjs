import { readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {createDefaultShipConfig} from '../src/workflow/defaultShipConfig.js'
export {createDefaultShipConfig} from '../src/workflow/defaultShipConfig.js'
import { trustedAppRequest } from './request-origin.mjs'

const send = (res, status, value) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  res.end(JSON.stringify(value))
}

async function readJsonBody(req, limit = 512 * 1024) {
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (text.length > limit) throw Object.assign(new Error('请求体过大。'), { status: 413 })
  }
  try {
    return JSON.parse(text || '{}')
  } catch {
    throw Object.assign(new Error('配置数据 JSON 格式错误。'), { status: 400 })
  }
}

export function loadDeviceTypeTemplate(root) {
  const filePath = join(root, 'data', 'device-type-template.json')
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) throw Object.assign(new Error('正常上下限必须为有效数字。'), { status: 400 })
  return num
}

export function sanitizeShipConfig(input, template, operatorName = 'admin', nowIso = new Date().toISOString()) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.devices)) {
    throw Object.assign(new Error('缺少有效的 devices 设备列表。'), { status: 400 })
  }
  const typeMap = new Map(template.deviceTypes.map((item) => [item.deviceTypeId, item]))
  const seenIds = new Set()
  const seenNames = new Set()
  const devices = []

  for (const raw of input.devices) {
    if (!raw || typeof raw !== 'object') {
      throw Object.assign(new Error('设备条目格式无效。'), { status: 400 })
    }
    const id = String(raw.id || '').trim()
    if (!id || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
      throw Object.assign(new Error(`设备 ID 格式无效：${id}`), { status: 400 })
    }
    if (seenIds.has(id)) {
      throw Object.assign(new Error(`存在重复的设备 ID：${id}`), { status: 400 })
    }
    seenIds.add(id)

    const name = String(raw.name || '').trim().slice(0, 48)
    if (!name) {
      throw Object.assign(new Error('设备名称不能为空。'), { status: 400 })
    }
    if (seenNames.has(name)) {
      throw Object.assign(new Error(`设备名称不能重复：${name}`), { status: 400 })
    }
    seenNames.add(name)

    const deviceTypeId = String(raw.deviceTypeId || '').trim()
    const deviceType = typeMap.get(deviceTypeId)
    if (!deviceType) {
      throw Object.assign(new Error(`设备类型不在模板库中：${deviceTypeId}`), { status: 400 })
    }

    const code = String(raw.code || '').trim().slice(0, 32) || id.toUpperCase()
    const rawPointsMap = new Map(
      (Array.isArray(raw.points) ? raw.points : [])
        .filter((p) => p && typeof p.pointCode === 'string')
        .map((p) => [p.pointCode.trim(), p])
    )

    // Always project points strictly from the device type template so immutable fields never drift.
    const points = deviceType.points.map((tpl) => {
      const override = rawPointsMap.get(tpl.pointCode)
      const isAlarm = tpl.pointKind === 'alarm'
      const instanceName = String(override?.instanceName || '').trim().slice(0, 64) || tpl.defaultName
      const normalMin = isAlarm ? null : finiteOrNull(override ? override.normalMin : tpl.normalRange?.min ?? null)
      const normalMax = isAlarm ? null : finiteOrNull(override ? override.normalMax : tpl.normalRange?.max ?? null)
      if (normalMin !== null && normalMax !== null && normalMin > normalMax) {
        throw Object.assign(
          new Error(`设备「${name}」点位 ${tpl.pointCode}（${instanceName}）的正常下限不能大于正常上限。`),
          { status: 400 }
        )
      }
      return {
        pointCode: tpl.pointCode,
        enabled: override ? Boolean(override.enabled) : true,
        instanceName,
        normalMin,
        normalMax,
        note: String(override?.note || '').trim().slice(0, 160)
      }
    })

    const rawAlarms = raw.alarms && typeof raw.alarms === 'object' ? raw.alarms : {}
    const normalizeAlarm = (current, defaults) => ({
      ...defaults,
      enabled: current?.enabled !== undefined ? Boolean(current.enabled) : defaults.enabled,
      updatedAt: String(current?.updatedAt || nowIso),
      updatedBy: String(current?.updatedBy || operatorName),
      note: String(current?.note ?? defaults.note).trim().slice(0, 160)
    })

    const aiInterval = Number(rawAlarms.aiPeriodic?.intervalMinutes)
    const trackingMonths = Number(rawAlarms.anomalyTracking?.windowMonths)
    const trackingGranularity = rawAlarms.anomalyTracking?.granularity === 'monthly' ? 'monthly' : 'weekly'

    devices.push({
      id,
      name,
      code,
      deviceTypeId,
      enabled: raw.enabled !== false,
      isBuiltin: Boolean(raw.isBuiltin),
      alarms: {
        oem: normalizeAlarm(rawAlarms.oem, {
          enabled: false,
          note: 'OEM 硬件报警触发后进入大模型分析研判'
        }),
        aiPeriodic: {
          ...normalizeAlarm(rawAlarms.aiPeriodic, {
            enabled: true,
            note: '定时 AI 周期异常检测并产生预警事件'
          }),
          intervalMinutes: [15, 30, 60, 120].includes(aiInterval) ? aiInterval : 60
        },
        anomalyTracking: {
          ...normalizeAlarm(rawAlarms.anomalyTracking, {
            enabled: false,
            note: '多月运行数据长期趋势偏移跟踪与异动跟踪报警'
          }),
          windowMonths: [1, 3, 6, 12].includes(trackingMonths) ? trackingMonths : 3,
          granularity: trackingGranularity
        }
      },
      points
    })
  }

  return {
    schemaVersion: '1.0.0',
    shipName: String(input.shipName || '长航碧玉').trim().slice(0, 64) || '长航碧玉',
    updatedAt: nowIso,
    updatedBy: operatorName,
    devices
  }
}

export async function readShipConfig(directory, template) {
  try {
    const saved = JSON.parse(await readFile(join(directory, 'ship-device-config.json'), 'utf8'))
    return sanitizeShipConfig(saved, template, saved.updatedBy, saved.updatedAt)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return createDefaultShipConfig(template)
  }
}

export async function createShipConfigService(
  root,
  { directory = process.env.SHIP_DATA_DIR || join(root, '.local-data'), clock = () => new Date().toISOString() } = {}
) {
  await mkdir(directory, { recursive: true })
  const configPath = join(directory, 'ship-device-config.json')
  const template = loadDeviceTypeTemplate(root)

  async function readConfig() {
    try {
      const raw = JSON.parse(await readFile(configPath, 'utf8'))
      return sanitizeShipConfig(raw, template, raw.updatedBy || 'system', raw.updatedAt || clock())
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('[ship-config-api] Resetting invalid ship-device-config.json:', error.message)
      }
      const initial = createDefaultShipConfig(template, clock())
      await persistConfig(initial)
      return initial
    }
  }

  async function persistConfig(config) {
    const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
    await rename(tempPath, configPath)
  }

  let cache = await readConfig()

  async function handler(req, res, next) {
    const pathname = (req.url || '').split('?')[0]
    if (!pathname.startsWith('/api/config/ship')) return next()
    if (!trustedAppRequest(req)) return send(res, 403, { error: '请求来源不在允许范围内。' })
    if (!req.user) return send(res, 401, { error: '请先登录。' })

    if (pathname === '/api/config/ship' && req.method === 'GET') {
      return send(res, 200, { template, config: cache })
    }

    if (pathname === '/api/config/ship' && (req.method === 'PUT' || req.method === 'POST')) {
      if (req.user.role !== 'admin') {
        return send(res, 403, { error: '只有超级管理员可以修改船端设备与报警配置。' })
      }
      try {
        const input = await readJsonBody(req)
        const payload = input.config && typeof input.config === 'object' ? input.config : input
        const nextConfig = sanitizeShipConfig(payload, template, req.user.name || req.user.username, clock())
        await persistConfig(nextConfig)
        cache = nextConfig
        return send(res, 200, { template, config: cache })
      } catch (error) {
        return send(res, error.status || 400, { error: error.message || '保存配置失败。' })
      }
    }

    if (pathname === '/api/config/ship/reset' && req.method === 'POST') {
      if (req.user.role !== 'admin') {
        return send(res, 403, { error: '只有超级管理员可以重置配置。' })
      }
      const fresh = createDefaultShipConfig(template, clock())
      fresh.updatedBy = req.user.name || req.user.username
      await persistConfig(fresh)
      cache = fresh
      return send(res, 200, { template, config: cache })
    }

    return send(res, 405, { error: '不支持的请求方法。' })
  }

  return {
    handler,
    getConfig: () => cache,
    close: async () => {}
  }
}

export function localShipConfigPlugin() {
  return {
    name: 'engine-room-ship-config',
    apply: 'serve',
    async configureServer(server) {
      if (server.config.server.middlewareMode) return
      const service = await createShipConfigService(server.config.root)
      server.middlewares.use((req, res, next) => {
        service.handler(req, res, next).catch(() => send(res, 500, { error: '配置服务暂时不可用。' }))
      })
      server.httpServer?.once('close', () => void service.close())
    }
  }
}
