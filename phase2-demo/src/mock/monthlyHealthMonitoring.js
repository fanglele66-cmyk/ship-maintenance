import {mockSensors} from './sensors.js'
import {buildSimulationSensors, simulationDefaults, simulationValue} from './sensorSimulation.js'

// Prototype monthly histories are a separate, reproducible series. They are
// not actual ship data, alarm assessments, or evidence of historical repairs.
// Fixed registry baselines intentionally ignore the live store's 30s samples,
// scene changes and submitted case feedback. The same sampler supplies both
// live readings and these explicitly generated hourly monthly histories.
const baselineRegistry = new Map(buildSimulationSensors(mockSensors).map(sensor => [sensor.id, Object.freeze({...sensor})]))
const statisticsCache = new Map()
const hourMs = 3600000
const shanghaiOffsetMs = 8 * hourMs
const hash = text => [...String(text)].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 17)

export function monitoringMonthBounds(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const [year, number] = month.split('-').map(Number)
  if (year < 1000) return null
  return {
    start: Date.UTC(year, number - 1, 1) - shanghaiOffsetMs,
    end: Date.UTC(year, number, 1) - shanghaiOffsetMs,
  }
}

export function buildMonitoringMonths(referenceTime = Date.now(), count = 6) {
  const date = new Date(Number(referenceTime) + shanghaiOffsetMs)
  if (!Number.isFinite(date.getTime())) return []
  const current = date.getUTCFullYear() * 12 + date.getUTCMonth()
  return Array.from({length: count}, (_, index) => {
    const serial = current - count + index
    const year = Math.floor(serial / 12), month = serial % 12 + 1
    return {value: `${year}-${String(month).padStart(2, '0')}`, label: `${year}年${month}月`}
  })
}

// Only completed months, in chronological order. In October the defaults are
// September versus August; no partial October sample is labelled a full month.
export const monitoringMonths = buildMonitoringMonths()
export const defaultMonitoringMonth = monitoringMonths.at(-1)?.value
export const defaultComparisonMonth = monitoringMonths.at(-2)?.value

function resolveSensor(sensorOrId) {
  const id = typeof sensorOrId === 'string' ? sensorOrId : sensorOrId?.id
  return baselineRegistry.get(id) || null
}

function isCompletedMonth(month) {
  const bounds = monitoringMonthBounds(month)
  const nextMonth = buildMonitoringMonths(Date.now(), 1)[0]?.value
  const lastCompleteBounds = monitoringMonthBounds(nextMonth)
  return Boolean(bounds && lastCompleteBounds && bounds.end <= lastCompleteBounds.end)
}

function monthlyBaseline(sensor, month) {
  const [year, number] = month.split('-').map(Number), serial = year * 12 + number - 1
  const seed = hash(sensor.id)
  const raw = sensor.value
  const value = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')
    ? Number(raw) : null
  // Modest, deterministic differences represent changing operating conditions.
  // These are not degradation, fault, recovery or useful-life estimates.
  const shift = 0.006 * Math.sin(serial * 0.75 + seed % 17)
    + ((hash(sensor.id + month) % 1001) / 1000 - 0.5) * 0.004
  return {
    ...sensor,
    value: value !== null && Number.isFinite(value) ? value * (1 + shift) : null,
    dataOrigin: 'prototype-monthly',
  }
}

export function generateMonthlySensorSamples(sensorOrId, month) {
  const sensor = resolveSensor(sensorOrId), bounds = monitoringMonthBounds(month)
  if (!sensor || !bounds || !isCompletedMonth(month)) return null
  const baseline = monthlyBaseline(sensor, month), samples = []
  for (let timestamp = bounds.start; timestamp < bounds.end; timestamp += hourMs) {
    samples.push({
      timestamp,
      value: simulationValue(baseline, timestamp, {...simulationDefaults, enabled: true}),
    })
  }
  return samples
}

export function aggregateMonitoringSamples(samples = []) {
  const values = samples.map(sample => sample?.value)
    .filter(value => typeof value === 'number' && Number.isFinite(value))
  if (!values.length) return {available: false, mean: null, min: null, max: null, p95: null, std: null, sampleCount: 0}
  // Center the sum so a quantized constant-pressure month stays exactly
  // constant instead of accumulating floating-point drift beyond its min/max.
  const anchor = values[0]
  const mean = anchor + values.reduce((sum, value) => sum + (value - anchor), 0) / values.length
  const sorted = [...values].sort((a, b) => a - b)
  return {
    available: true, mean, min: sorted[0], max: sorted.at(-1),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    std: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length),
    sampleCount: values.length,
  }
}

function monthStatistics(sensor, month) {
  if (!isCompletedMonth(month)) return null
  const key = `${sensor.id}:${month}`
  if (!statisticsCache.has(key)) {
    const samples = generateMonthlySensorSamples(sensor, month)
    statisticsCache.set(key, Object.freeze({
      ...aggregateMonitoringSamples(samples || []),
      month, ...monitoringMonthBounds(month),
      origin: 'prototype-monthly', sampleIntervalHours: 1,
    }))
  }
  return statisticsCache.get(key)
}

export function getMonthlySensorStats(sensorOrId, viewMonth = defaultMonitoringMonth, compareMonth = defaultComparisonMonth) {
  const sensor = resolveSensor(sensorOrId)
  if (!sensor || !monitoringMonthBounds(viewMonth) || !monitoringMonthBounds(compareMonth)) return null
  const current = monthStatistics(sensor, viewMonth), previous = monthStatistics(sensor, compareMonth)
  if (!current || !previous) return null
  return {
    ...current,
    sensorId: sensor.id, unit: sensor.unit, precision: sensor.precision ?? (sensor.unit === 'MPa' ? 3 : 1),
    compareMonth, compareMean: previous.mean, compareSampleCount: previous.sampleCount,
    delta: current.available && previous.available ? current.mean - previous.mean : null,
    series: monitoringMonths.map(option => {
      const statistics = monthStatistics(sensor, option.value)
      return {month: option.value, mean: statistics?.mean ?? null, sampleCount: statistics?.sampleCount ?? 0}
    }),
    measurementNote: sensor.measurementNote || '',
  }
}
