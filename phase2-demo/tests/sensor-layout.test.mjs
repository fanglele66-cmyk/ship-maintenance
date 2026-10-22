import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSensors } from '../src/mock/sensors.js'
import { buildSimulationSensors } from '../src/mock/sensorSimulation.js'
import { buildSensorLayout, filterSensorReadings, formatSensorValue, overviewSensorReadings } from '../src/mock/sensorLayout.js'

const readings = buildSimulationSensors(mockSensors)
const groupSensors = groups => groups.flatMap(group => group.sections.flatMap(section => section.sensors))
const layoutSensors = layout => [
  ...(layout.main ? [
    ...groupSensors(layout.main.columns.flat()),
    ...layout.main.matrix.flatMap(row => row.cells.flatMap(cell => cell.sensor ? [cell.sensor] : [])),
    ...groupSensors(layout.main.operatingGroups),
    ...groupSensors(layout.main.additionalGroups),
  ] : []),
  ...layout.devices.flatMap(device => groupSensors(device.groups)),
]

test('all catalogue readings remain reachable exactly once and retain their original identity', () => {
  const shown = layoutSensors(buildSensorLayout(readings))
  assert.deepEqual(shown.map(sensor => sensor.id).sort(), readings.map(sensor => sensor.id).sort())
  assert.equal(new Set(shown.map(sensor => sensor.id)).size, readings.length)
  for (const sensor of shown) assert.equal(sensor, readings.find(item => item.id === sensor.id))
})

test('six-cylinder matrix uses explicit 36 bindings and keeps generic readings outside cylinders', () => {
  const layout = buildSensorLayout(readings)
  assert.equal(layout.main.matrix.length, 6)
  assert.equal(layout.main.matrix.flatMap(row => row.cells).length, 36)
  assert.ok(layout.main.matrix.every(row => row.cells.every(cell => cell.sensor)))
  assert.ok(layout.main.matrix.every(row => row.cells.map(cell => cell.number).join(',') === '1,2,3,4,5,6'))
  const matrixIds = layout.main.matrix.flatMap(row => row.cells.map(cell => cell.sensor.id))
  assert.ok(!matrixIds.includes('s-004'))
  assert.ok(!matrixIds.includes('s-007'))
  assert.equal(layout.main.matrix[0].cells[1].sensor.id, 's-046')
  assert.equal(layout.main.matrix[0].cells[2].sensor.id, 's-005')
})

test('fresh water and sea water retain separate cooling sections; servo oil stays out of fuel', () => {
  const groups = buildSensorLayout(readings).main.columns.flat()
  const cooling = groups.find(group => group.id === 'cooling')
  assert.deepEqual(cooling.sections.map(section => section.title), ['缸套淡水', '海水换热侧'])
  assert.deepEqual(cooling.sections[1].sensors.map(sensor => sensor.id), ['s-015', 's-016'])
  assert.ok(!groupSensors([groups.find(group => group.id === 'fuel')]).some(sensor => sensor.id === 'main-servo-rail-pressure'))
  assert.equal(groupSensors([groups.find(group => group.id === 'servo')])[0].id, 'main-servo-rail-pressure')
})

test('subsystem filters keep matching cells and do not reintroduce excluded readings', () => {
  for (const subsystem of new Set(readings.map(sensor => sensor.subsystem))) {
    const selected = readings.filter(sensor => sensor.subsystem === subsystem)
    assert.deepEqual(layoutSensors(buildSensorLayout(selected)).map(sensor => sensor.id).sort(), selected.map(sensor => sensor.id).sort())
  }
  const selected = readings.filter(sensor => sensor.id === 's-046')
  const matrix = buildSensorLayout(selected).main.matrix
  assert.equal(matrix.length, 1)
  assert.deepEqual(matrix[0].cells.map(cell => cell.sensor?.id || null), [null, 's-046', null, null, null, null])
})

test('search is trimmed, bilingual and case-insensitive and its results remain exhaustive', () => {
  for (const query of ['  oil  ', '冷却', 'Cyl.3', '不存在的测点']) {
    const selected = filterSensorReadings(readings, query)
    assert.deepEqual(layoutSensors(buildSensorLayout(selected)).map(sensor => sensor.id).sort(), selected.map(sensor => sensor.id).sort())
  }
  assert.equal(filterSensorReadings([{ nameCn: '冷却', nameEn: null }], '冷却').length, 1)
  assert.equal(filterSensorReadings(readings, '不存在的测点').length, 0)
})

test('unknown devices and newly added main-engine points use the fallback instead of disappearing', () => {
  const extra = [
    { id: 'new-main', deviceId: 'main-engine-1', subsystem: '新子系统', value: 7 },
    { id: 'new-other', deviceId: 'new-device', device: '新设备', value: 8 },
  ]
  const layout = buildSensorLayout(extra)
  assert.equal(layout.main.additionalGroups[0].title, '新子系统')
  assert.equal(layout.devices[0].groups[0].title, '其他测点')
  assert.deepEqual(layoutSensors(layout), extra)
})

test('all three auxiliary engines are distinct and retain zero as a valid reading', () => {
  const auxiliary = readings.filter(sensor => sensor.deviceId.startsWith('aux-engine-'))
  const layout = buildSensorLayout(auxiliary)
  assert.equal(layout.main, null)
  assert.equal(layout.devices.length, 3)
  assert.ok(layout.devices.every(device => device.count === 6))
  assert.equal(formatSensorValue(auxiliary.find(sensor => sensor.id === 'aux-3-rpm')), '0.0')
})

test('missing, blank and non-finite numbers display a dash, while precision and zero remain intact', () => {
  for (const value of [null, undefined, NaN, Infinity, '', ' ', false, {}, 'abc']) assert.equal(formatSensorValue({ value }), '—')
  assert.equal(formatSensorValue({ value: 0 }), '0')
  assert.equal(formatSensorValue({ value: 0, precision: 2 }), '0.00')
  assert.equal(formatSensorValue({ value: 0.4, precision: 2 }), '0.40')
})

test('overview selects 38 main-engine readings without losing any cylinder or hiding detailed points from the full board', () => {
  const main = readings.filter(sensor => sensor.deviceId === 'main-engine-1')
  const preview = overviewSensorReadings(main)
  assert.equal(main.length, 59)
  assert.equal(preview.length, 38)
  assert.ok(preview.every(sensor => main.includes(sensor)))
  const layout = buildSensorLayout(preview)
  assert.deepEqual(layout.main.matrix.map(row => row.id), ['exhaust', 'scavenge', 'coolant', 'piston'])
  assert.ok(layout.main.matrix.every(row => row.cells.every(cell => cell.sensor)))
  assert.equal(groupSensors(layout.main.columns.flat()).length, 12)
  assert.deepEqual(groupSensors(layout.main.operatingGroups).map(sensor => sensor.id), ['s-012', 'main-load'])
  assert.ok(preview.some(sensor => sensor.id === 'main-control-air-pressure'))
  assert.equal(layoutSensors(buildSensorLayout(main)).length, 59)
})

test('other equipment keeps every available point in the overview', () => {
  const other = readings.filter(sensor => sensor.deviceId !== 'main-engine-1')
  assert.deepEqual(overviewSensorReadings(other), other)
})
