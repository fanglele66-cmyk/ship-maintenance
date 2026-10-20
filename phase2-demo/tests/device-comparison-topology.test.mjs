import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cylinderNumbers,
  cylinderTopics,
  cylinderSensorBindings,
  sharedSystems,
  topologyNumber,
  buildCylinderMatrix,
  cylinderDetail,
  sharedSystemDetail,
} from '../src/mock/deviceComparisonTopology.js'
import {mockSensors} from '../src/mock/sensors.js'
import {buildSimulationSensors} from '../src/mock/sensorSimulation.js'

const mainPoint = (id, value, extra = {}) => ({
  id,
  value,
  deviceId: 'main-engine-1',
  unit: '°C',
  ...extra,
})

test('all six cylinders retain their physical topics and detail paths without telemetry', () => {
  assert.deepEqual(cylinderNumbers, [1, 2, 3, 4, 5, 6])
  const matrix = buildCylinderMatrix()
  assert.equal(matrix.length, 6)
  assert.deepEqual(matrix.map(row => row.id), ['exhaust', 'scavenge', 'coolant', 'piston', 'icu', 'vcu'])
  const cells = matrix.flatMap(row => row.cells)
  assert.equal(cells.length, 36)
  assert.equal(new Set(cells.map(cell => cell.id)).size, 36)
  for (const row of matrix) {
    assert.deepEqual(row.cells.map(cell => cell.number), [1, 2, 3, 4, 5, 6])
    for (const cell of row.cells) {
      assert.equal(cell.available, false)
      assert.equal(cell.value, null)
      const detail = cylinderDetail(cell.number, row.id)
      assert.ok(detail, 'an unmeasured physical component must remain inspectable')
      assert.ok(detail.component)
      assert.ok(detail.question)
      assert.ok(detail.path.includes(`第 ${cell.number} 缸`))
      assert.doesNotMatch(detail.path, /\{n\}/)
      assert.ok(detail.supplies.length > 0)
    }
  }
})

test('cylinder addresses follow the local six-cylinder point catalogue rather than fabricated measurements', () => {
  const expectedAddresses = {
    exhaust: [8, 9, 10, 11, 12, 13],
    scavenge: [22, 23, 24, 25, 26, 27],
    coolant: [46, 47, 48, 49, 50, 51],
    piston: [31, 32, 33, 34, 35, 36],
  }
  for (const row of buildCylinderMatrix()) {
    assert.deepEqual(row.cells.map(cell => cell.address), expectedAddresses[row.id] || Array(6).fill(null))
    assert.ok(row.cells.every(cell => cell.value === null))
  }
  assert.equal(cylinderDetail(0, 'exhaust'), null)
  assert.equal(cylinderDetail(7, 'exhaust'), null)
  assert.equal(cylinderDetail(2, 'unknown-topic'), null)
  assert.equal(sharedSystemDetail('unknown-system'), null)
})

test('shared oil, water and air connections preserve distinct physical circuits', () => {
  assert.equal(sharedSystems.length, 7)
  assert.equal(new Set(sharedSystems.map(system => system.id)).size, 7)
  for (const topic of cylinderTopics) {
    assert.ok(topic.shared.every(id => sharedSystemDetail(id)),
      `all ${topic.name} shared relationships must resolve to a real system`)
  }
  const supplies = topic => cylinderDetail(6, topic).supplies.map(system => system.id).sort()
  assert.deepEqual(supplies('icu'), ['fuel', 'servo'])
  assert.deepEqual(supplies('vcu'), ['control-air', 'servo'])
  assert.deepEqual(supplies('piston'), ['lubrication'])
  assert.deepEqual(supplies('coolant'), ['cooling'])
  assert.deepEqual(supplies('scavenge'), ['scavenge'])
  assert.deepEqual(supplies('exhaust'), ['exhaust'])
  assert.match(cylinderDetail(6, 'vcu').path, /液压开启.*空气弹簧.*关闭/)
  assert.match(cylinderDetail(6, 'coolant').path, /气缸套.*气缸盖.*排气阀壳/)
  assert.match(cylinderDetail(6, 'piston').path, /轴承油.*伸缩管.*活塞冷却/)
  assert.doesNotMatch(cylinderDetail(6, 'piston').path, /冷却水|淡水/)
  assert.match(sharedSystemDetail('scavenge').path, /增压器.*空冷器.*水分离器.*扫气接收器.*扫气口/)
  assert.match(sharedSystemDetail('exhaust').path, /排气出口.*排气汇流.*增压器/)
})

test('only explicitly identified main-engine cylinder readings populate the matrix', () => {
  const before = JSON.stringify(mockSensors)
  const matrix = buildCylinderMatrix(mockSensors)
  const available = matrix.flatMap(row => row.cells).filter(cell => cell.available)
  assert.deepEqual(available.map(cell => [cell.number, cell.topicId, cell.sensor.id]), [
    [2, 'exhaust', 's-046'],
    [3, 'exhaust', 's-005'],
  ])
  for (const cell of available) {
    assert.equal(cell.value, mockSensors.find(sensor => sensor.id === cell.sensor.id).value)
    assert.equal(cell.coverage, '查看统计')
  }
  assert.equal(JSON.stringify(mockSensors), before, 'the topology projection must not relabel or mutate source readings')
  const wrongDevice = [mainPoint('s-046', 400, {deviceId: 'aux-engine-2'})]
  assert.equal(cylinderDetail(2, 'exhaust', wrongDevice).available, false)
  const sameIdDifferentDevices = [
    ...wrongDevice,
    mainPoint('s-046', 421.4),
  ]
  assert.equal(cylinderDetail(2, 'exhaust', sameIdDifferentDevices).value, 421.4)
})

test('generic exhaust and cooling values stay shared and cannot fill missing cylinder cells', () => {
  const bindings = Object.values(cylinderSensorBindings).flatMap(value => Object.values(value))
  assert.equal(bindings.includes('s-004'), false)
  assert.equal(bindings.includes('s-007'), false)
  const generic = [
    mainPoint('s-004', 410, {nameCn: '排气温度'}),
    mainPoint('s-007', 81, {nameCn: '缸套水出口温度'}),
    mainPoint('looks-like-c1', 420, {nameCn: '1缸排气温度'}),
    mainPoint('s-004', 999, {deviceId: 'aux-engine-1'}),
  ]
  assert.ok(buildCylinderMatrix(generic).flatMap(row => row.cells).every(cell => !cell.available))
  assert.deepEqual(sharedSystemDetail('exhaust', generic).readings.map(point => point.value), [410])
  assert.deepEqual(sharedSystemDetail('cooling', generic).readings.map(point => point.value), [81])
  assert.equal(sharedSystemDetail('servo', generic).readings.length, 0)
  assert.equal(sharedSystemDetail('control-air', generic).readings.length, 0)
})

test('missing or nonnumeric values never become measured zeros, normal verdicts or new fault associations', () => {
  const missingValues = [undefined, null, '', '   ', 'NaN', 'unknown', Number.NaN, Infinity, -Infinity, true, false, {}, []]
  const baselineIssues = cylinderDetail(2, 'exhaust').issueIds
  for (const value of missingValues) {
    assert.equal(topologyNumber(value), null)
    const detail = cylinderDetail(2, 'exhaust', [mainPoint('s-046', value, {status: 'over'})])
    assert.equal(detail.available, false)
    assert.equal(detail.value, null)
    assert.equal(detail.coverage, '暂无数据')
    assert.deepEqual(detail.issueIds, baselineIssues, 'a missing value must not create or remove a historical matter')
    assert.equal(Object.hasOwn(detail, 'fault'), false)
    assert.equal(Object.hasOwn(detail, 'healthy'), false)
  }
  for (const [value, expected] of [[0, 0], ['0', 0], ['421.5', 421.5], [-1, -1]]) {
    const detail = cylinderDetail(3, 'exhaust', [mainPoint('s-005', value, {status: 'over'})])
    assert.equal(detail.value, expected)
    assert.equal(detail.available, true)
    assert.deepEqual(detail.issueIds, [], 'even an over-reference current value does not invent a historical cylinder case')
  }
})

test('the unified sensor registry supplies all 36 cylinder cells without rebinding generic signals', () => {
  const readings = buildSimulationSensors(mockSensors)
  const cells = buildCylinderMatrix(readings).flatMap(row => row.cells)
  assert.equal(cells.length, 36)
  assert.ok(cells.every(cell => cell.available && Number.isFinite(cell.value)))
  assert.equal(new Set(cells.map(cell => cell.sensor.id)).size, 36)
  for (const cell of cells) {
    assert.ok(readings.includes(cell.sensor))
    assert.equal(cell.sensor.deviceId, 'main-engine-1')
    if (!['s-046', 's-005'].includes(cell.sensor.id)) {
      assert.equal(cell.sensor.dataOrigin, 'prototype')
      assert.equal(cell.sensor.threshold, undefined)
      assert.equal(cell.sensor.range, undefined)
      assert.equal(cell.sensor.status, 'unassessed')
    }
    if (['icu', 'vcu'].includes(cell.topicId)) assert.equal(cell.unit, 'mm')
  }
  for (const system of sharedSystems) {
    assert.ok(sharedSystemDetail(system.id, readings).readings.length > 0)
  }
  assert.equal(cylinderDetail(2, 'exhaust', readings).sensor.id, 's-046')
  assert.equal(cylinderDetail(3, 'exhaust', readings).sensor.id, 's-005')
  assert.equal(sharedSystemDetail('fuel', readings).readings.find(sensor => sensor.id === 'main-fuel-rail-pressure').unit, 'bar')
  assert.equal(sharedSystemDetail('servo', readings).readings[0].unit, 'bar')
})

test('0430 is linked to cylinder 2 evidence while 0523 remains a shared control-air matter', () => {
  const cylinderAssociations = buildCylinderMatrix(mockSensors)
    .flatMap(row => row.cells)
    .filter(cell => cell.issueIds.length)
  assert.deepEqual(cylinderAssociations.map(cell => [cell.number, cell.topicId]), [[2, 'exhaust'], [2, 'icu']])
  assert.ok(cylinderAssociations.every(cell => cell.issueIds.length === 1 && cell.issueIds[0] === 'real-alarm-0430'))
  const allCylinderIds = buildCylinderMatrix().flatMap(row => row.cells.flatMap(cell => cell.issueIds))
  assert.equal(allCylinderIds.includes('real-warning-0523'), false)
  assert.equal(allCylinderIds.includes('real-maintenance-0523'), false)
  const controlAir = sharedSystemDetail('control-air')
  assert.deepEqual(controlAir.issueIds, ['real-warning-0523', 'real-maintenance-0523'])
  assert.deepEqual(controlAir.readings, [], 'historical low-pressure evidence must not become fabricated current telemetry')
  assert.ok(sharedSystems.filter(system => system.id !== 'control-air')
    .every(system => !system.issueIds.some(id => id === 'real-warning-0523' || id === 'real-maintenance-0523')))
  assert.match(cylinderDetail(2, 'icu').question, /不能直接等同于.*机械卡阻/)
})
