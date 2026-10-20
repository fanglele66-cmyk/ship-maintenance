import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {observationData, observationOption} from '../src/components/observationTrend.js'

test('all real case curves keep original timestamps and readings without dense permanent labels', () => {
  const cases = JSON.parse(readFileSync(new URL('../src/mock/realCases.json', import.meta.url), 'utf8')).cases
  for (const item of cases) for (const series of item.series) {
    const input = {name: series.label, unit: series.unit, labels: series.points.map(point => point.time), values: series.points.map(point => point.value)}
    const option = observationOption(input)
    assert.equal(option.xAxis.type, 'time')
    assert.deepEqual(option.series[0].data.map(point => point.value), series.points.map(point => [Date.parse(point.time.replace(' ', 'T')), point.value]))
    assert.equal(option.series[0].label.show, false)
    assert.equal(option.series[0].showSymbol, false)
    assert.equal(option.series[0].smooth, false)
  }
})

test('irregular intervals, zeros, reverse rotation and missing readings are preserved', () => {
  const input = {labels: ['2026-08-16 00:50:00', '2026-08-16 00:50:10', '2026-08-16 00:51:00', '2026-08-16 00:51:30'], values: [0, -75.8, null, -20.9], unit: 'RPM'}
  const {points, count} = observationData(input)
  assert.equal(count, 3)
  assert.equal(points[2].time - points[1].time, 50000)
  assert.deepEqual(points.map(point => point.value), [0, -75.8, null, -20.9])
  const option = observationOption(input)
  assert.equal(option.series[0].connectNulls, false)
  assert.match(option.tooltip.formatter([{data: option.series[0].data[1]}]), /2026-08-16 00:50:10\n-75.8 RPM/)
})

test('named observation stages remain categories, and invalid values never become false zero readings', () => {
  const input = {labels: ['初次观察', '本轮核实', '后续记录', '未取得'], values: [5, 6, '', undefined]}
  const option = observationOption(input, 360)
  assert.equal(option.xAxis.type, 'category')
  assert.deepEqual(option.xAxis.data, input.labels)
  assert.deepEqual(option.series[0].data.map(point => point.value), [5, 6, null, null])
  assert.equal(observationData({values: []}).count, 0)
})
