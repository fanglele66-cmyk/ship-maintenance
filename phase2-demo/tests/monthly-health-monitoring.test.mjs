import test from 'node:test'
import assert from 'node:assert/strict'
import {
  monitoringMonths, buildMonitoringMonths, monitoringMonthBounds,
  defaultMonitoringMonth, defaultComparisonMonth,
  generateMonthlySensorSamples, aggregateMonitoringSamples, getMonthlySensorStats,
} from '../src/mock/monthlyHealthMonitoring.js'
import {buildSimulationSensors} from '../src/mock/sensorSimulation.js'
import {mockSensors} from '../src/mock/sensors.js'
import {buildCylinderMatrix, sharedSystems, sharedSystemDetail} from '../src/mock/deviceComparisonTopology.js'

test('month choices contain six completed Shanghai calendar months with distinct defaults', () => {
  assert.deepEqual(buildMonitoringMonths(Date.UTC(2026, 9, 20)).map(month => month.value),
    ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  assert.deepEqual(buildMonitoringMonths(Date.UTC(2026, 0, 1)).map(month => month.value),
    ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'])
  assert.equal(defaultMonitoringMonth, monitoringMonths.at(-1).value)
  assert.equal(defaultComparisonMonth, monitoringMonths.at(-2).value)
  assert.notEqual(defaultMonitoringMonth, defaultComparisonMonth)
  assert.equal(monitoringMonthBounds('2026-09').start, Date.UTC(2026, 7, 31, 16))
  assert.equal(monitoringMonthBounds('2026-09').end, Date.UTC(2026, 8, 30, 16))
  assert.equal(monitoringMonthBounds('2024-02').end - monitoringMonthBounds('2024-02').start, 29 * 24 * 3600000)
})

test('monthly values are actual aggregates of generated hourly samples, not the last reading', () => {
  const samples = generateMonthlySensorSamples('main-cyl-1-exhaust', defaultMonitoringMonth)
  const stats = getMonthlySensorStats('main-cyl-1-exhaust')
  const bounds = monitoringMonthBounds(defaultMonitoringMonth)
  assert.equal(samples.length, (bounds.end - bounds.start) / 3600000)
  assert.equal(samples[0].timestamp, bounds.start)
  assert.equal(samples.at(-1).timestamp, bounds.end - 3600000)
  assert.ok(samples.every((sample, index) => index === 0 || sample.timestamp - samples[index - 1].timestamp === 3600000))
  const expected = aggregateMonitoringSamples(samples)
  for (const key of ['mean', 'min', 'max', 'p95', 'std', 'sampleCount']) assert.equal(stats[key], expected[key])
  assert.notEqual(stats.mean, samples.at(-1).value)
  assert.equal(stats.origin, 'prototype-monthly')
  assert.equal(stats.sampleIntervalHours, 1)
  assert.equal(Object.hasOwn(stats, 'coveragePercent'), false)
  assert.ok(Math.abs(aggregateMonitoringSamples([{value: 1}, {value: 4}, {value: 9}]).mean - 14 / 3) < 1e-12)
  const constant = aggregateMonitoringSamples(Array.from({length: 744}, () => ({value: 6.37})))
  assert.equal(constant.mean, 6.37)
  assert.equal(constant.std, 0)
})

test('monthly baselines ignore live-store values and scene changes for the same sensor id', () => {
  const expected = getMonthlySensorStats('s-046')
  for (const value of [null, 0, 250, 999999]) {
    assert.deepEqual(getMonthlySensorStats({id: 's-046', value, threshold: 1, status: 'over'}), expected)
  }
  const before = generateMonthlySensorSamples('s-005', defaultMonitoringMonth)
  assert.deepEqual(generateMonthlySensorSamples({id: 's-005', value: 0}, defaultMonitoringMonth), before)
  assert.deepEqual(getMonthlySensorStats('s-046'), expected)
  assert.ok(expected.series.some((sample, index) => index > 0 && sample.mean !== expected.series[index - 1].mean))
})

test('comparison delta is the difference of monthly means and same-month comparisons remain valid', () => {
  const current = getMonthlySensorStats('main-servo-rail-pressure')
  const previous = getMonthlySensorStats('main-servo-rail-pressure', defaultComparisonMonth, defaultMonitoringMonth)
  assert.equal(current.delta, current.mean - previous.mean)
  assert.equal(current.compareMean, previous.mean)
  assert.equal(previous.delta, -current.delta)
  assert.equal(getMonthlySensorStats('main-servo-rail-pressure', defaultMonitoringMonth, defaultMonitoringMonth).delta, 0)
  assert.deepEqual(current.series.map(point => point.month), monitoringMonths.map(month => month.value))
})

test('all six-cylinder topics and common systems share the monthly registry and explicit units', () => {
  const readings = buildSimulationSensors(mockSensors)
  const cells = buildCylinderMatrix(readings).flatMap(row => row.cells)
  const sharedReadings = sharedSystems.flatMap(system => sharedSystemDetail(system.id, readings).readings)
  for (const sensor of [...cells.map(cell => cell.sensor), ...sharedReadings]) {
    const stats = getMonthlySensorStats(sensor)
    assert.equal(stats.available, true, sensor.id)
    assert.ok(Number.isFinite(stats.mean), sensor.id)
    assert.equal(stats.unit, sensor.unit)
    assert.ok(stats.min <= stats.mean && stats.mean <= stats.max)
    assert.ok(stats.min <= stats.p95 && stats.p95 <= stats.max)
    assert.ok(stats.std >= 0)
    assert.ok(stats.sampleCount >= 28 * 24)
    assert.equal(stats.fault, undefined)
    assert.equal(stats.normal, undefined)
  }
  assert.equal(getMonthlySensorStats('main-cyl-1-icu').unit, 'mm')
  assert.equal(getMonthlySensorStats('main-cyl-1-vcu').unit, 'mm')
  assert.match(getMonthlySensorStats('main-cyl-1-vcu').measurementNote, /不是瞬时阀位/)
})

test('missing samples, unknown sensors and invalid or unfinished months cannot turn into zero history', () => {
  const missing = aggregateMonitoringSamples([{value: null}, {value: undefined}, {value: ''}, {value: false}, {value: NaN}])
  assert.equal(missing.available, false)
  assert.equal(missing.mean, null)
  assert.equal(missing.min, null)
  assert.equal(missing.max, null)
  assert.equal(missing.sampleCount, 0)
  assert.equal(aggregateMonitoringSamples([{value: null}, {value: 0}, {value: 4}]).mean, 2)
  assert.equal(getMonthlySensorStats('not-a-sensor'), null)
  for (const month of ['2026-00', '2026-13', '2026-9', '', null, 'invalid']) {
    assert.equal(getMonthlySensorStats('s-005', month, defaultComparisonMonth), null)
    assert.equal(generateMonthlySensorSamples('s-005', month), null)
  }
  const currentMonth = new Date(monitoringMonthBounds(defaultMonitoringMonth).end + 8 * 3600000).toISOString().slice(0, 7)
  assert.equal(getMonthlySensorStats('s-005', currentMonth, defaultComparisonMonth), null)
})
