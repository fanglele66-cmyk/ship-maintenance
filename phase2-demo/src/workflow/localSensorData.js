import catalog from '../../data/sensor-point-mapping.json' with { type: 'json' }
import templateData from '../../docs/device-type-template.json' with { type: 'json' }

const aliases = {
  1: 's-012',
  9: 's-046',
  10: 's-005',
  28: 's-009',
  29: 's-010',
  41: 's-002',
  42: 's-001',
  45: 's-008',
  59: 's-011',
  6: 'main-control-air-pressure',
  54: 'main-servo-rail-pressure',
  56: 'main-fuel-rail-pressure'
}
for (const [first, topic] of [
  [8, 'exhaust'],
  [22, 'scavenge'],
  [31, 'piston'],
  [46, 'coolant']
]) {
  for (let n = 1; n <= 6; n++) aliases[first + n - 1] ||= `main-cyl-${n}-${topic}`
}

export const localPointIds = Object.fromEntries(
  catalog.pointList.map((p) => [p.pointCode, aliases[Number(p.pointCode.slice(2))] || `local-${p.pointCode}`])
)

const idToLocalCode = Object.fromEntries(Object.entries(localPointIds).map(([code, id]) => [id, code]))

// Local historical SQLite stores these 9 pressure channels in MPa, while the T1 device template standardizes pressure in bar (1 MPa = 10 bar).
export const MPA_SOURCE_CODES = new Set([
  'DC0005',
  'DC0006',
  'DC0007',
  'DC0028',
  'DC0037',
  'DC0039',
  'DC0040',
  'DC0041',
  'DC0044'
])

export function toTemplateUnitValue(pointCode, rawValue) {
  if (!Number.isFinite(rawValue)) return null
  if (MPA_SOURCE_CODES.has(pointCode)) return Number((rawValue * 10).toFixed(4))
  return rawValue
}

export function sensorIdForConfiguredPoint(deviceId, pointCode) {
  if (deviceId === 'main-engine-1') return localPointIds[pointCode] || `local-${pointCode}`
  return `${deviceId}::${pointCode}`
}

export function parsePointCodeFromSensorId(sensorId) {
  if (!sensorId) return null
  if (idToLocalCode[sensorId]) return idToLocalCode[sensorId]
  const sepIndex = String(sensorId).indexOf('::')
  if (sepIndex > 0) {
    const code = String(sensorId).slice(sepIndex + 2)
    if (localPointIds[code]) return code
  }
  return null
}

function defaultSubsystem(code) {
  const n = Number(code.slice(2))
  if (n <= 2) return '转速监测'
  if (n === 3 || n === 4) return '轴承温度'
  if (n === 5) return '起动空气系统'
  if (n === 6 || n === 7) return '控制空气系统'
  if (n >= 8 && n <= 21) return '排温系统'
  if ((n >= 22 && n <= 27) || n === 59) return '扫气系统'
  if (n >= 28 && n <= 40) return '滑油系统'
  if (n >= 44 && n <= 53) return '冷却系统'
  if ((n >= 41 && n <= 43) || (n >= 54 && n <= 58)) return '燃油系统'
  return '其他测点'
}

export function formatNormalRangeText(normalMin, normalMax, unit, pointKind) {
  if (pointKind === 'alarm') return '0=正常 / 1=报警'
  const hasMin = normalMin !== null && normalMin !== undefined && Number.isFinite(Number(normalMin))
  const hasMax = normalMax !== null && normalMax !== undefined && Number.isFinite(Number(normalMax))
  if (!hasMin && !hasMax) return '未配置限值'
  const suffix = unit ? ` ${unit}` : ''
  if (hasMin && hasMax) return `${normalMin} ~ ${normalMax}${suffix}`
  if (hasMin) return `≥ ${normalMin}${suffix}`
  return `≤ ${normalMax}${suffix}`
}

export function evaluatePointStatus(value, normalMin, normalMax, pointKind, tpl = null) {
  if (!Number.isFinite(value)) return 'unknown'
  if (pointKind === 'alarm') return value >= 1 ? 'over' : 'normal'
  const limits = tpl?.oemProtectionLimits
  if (limits) {
    if (limits.alarmLow?.value != null && value < Number(limits.alarmLow.value)) return 'over'
    if (limits.alarmHigh?.value != null && value > Number(limits.alarmHigh.value)) return 'over'
    if (limits.alarmDeviation?.plusMinus != null && Math.abs(value) > Number(limits.alarmDeviation.plusMinus)) return 'over'
  }
  const tplMin = tpl?.normalRange?.min ?? null
  const tplMax = tpl?.normalRange?.max ?? null
  const hasMin = normalMin !== null && normalMin !== undefined && Number.isFinite(Number(normalMin))
  const hasMax = normalMax !== null && normalMax !== undefined && Number.isFinite(Number(normalMax))
  const customRangeEdited = tpl ? normalMin !== tplMin || normalMax !== tplMax : true
  if (customRangeEdited && ((hasMin && value < Number(normalMin)) || (hasMax && value > Number(normalMax)))) {
    return 'over'
  }
  return 'normal'
}

export function buildConfiguredDeviceSensors(configuredDevices = [], rawPoints = catalog.pointList, template = templateData) {
  const rawValueByCode = new Map(
    (rawPoints || []).map((p) => [p.pointCode, Number.isFinite(p.value) ? p.value : null])
  )
  const typeById = new Map((template?.deviceTypes || []).map((t) => [t.deviceTypeId, t]))
  const result = []

  for (const device of configuredDevices) {
    if (!device || device.enabled === false) continue
    const deviceType = typeById.get(device.deviceTypeId) || template?.deviceTypes?.[0]
    if (!deviceType) continue
    const tplByCode = new Map(deviceType.points.map((p) => [p.pointCode, p]))

    for (const inst of device.points || []) {
      if (inst.enabled === false) continue
      const tpl = tplByCode.get(inst.pointCode)
      if (!tpl) continue
      const rawVal = rawValueByCode.has(inst.pointCode) ? rawValueByCode.get(inst.pointCode) : null
      const convertedVal = toTemplateUnitValue(inst.pointCode, rawVal)
      const precision = Number.isInteger(tpl.precision) ? tpl.precision : 2
      result.push({
        id: sensorIdForConfiguredPoint(device.id, inst.pointCode),
        pointCode: inst.pointCode,
        internalKey: tpl.internalKey,
        nameCn: inst.instanceName || tpl.defaultName,
        nameEn: tpl.defaultNameEn || '',
        device: device.name,
        deviceId: device.id,
        deviceTypeId: device.deviceTypeId,
        system: tpl.systemName || defaultSubsystem(inst.pointCode),
        subsystem: tpl.systemName || defaultSubsystem(inst.pointCode),
        pointKind: tpl.pointKind || 'numeric',
        value: convertedVal,
        unit: tpl.unit ?? '',
        precision,
        normalMin: inst.normalMin ?? null,
        normalMax: inst.normalMax ?? null,
        status: evaluatePointStatus(convertedVal, inst.normalMin, inst.normalMax, tpl.pointKind, tpl),
        sourceKind: 'historical-copy-replay',
        range: formatNormalRangeText(inst.normalMin, inst.normalMax, tpl.unit, tpl.pointKind)
      })
    }
  }
  return result
}

export function localSensors(points = catalog.pointList) {
  const rtFlex = templateData.deviceTypes[0]
  const tplByCode = new Map((rtFlex?.points || []).map((p) => [p.pointCode, p]))
  return points.map((p) => {
    const tpl = tplByCode.get(p.pointCode)
    const val = toTemplateUnitValue(p.pointCode, Number.isFinite(p.value) ? p.value : null)
    const unit = tpl ? tpl.unit : p.unit
    const normalMin = tpl?.normalRange?.min ?? null
    const normalMax = tpl?.normalRange?.max ?? null
    const pointKind = tpl?.pointKind || 'numeric'
    return {
      id: localPointIds[p.pointCode],
      pointCode: p.pointCode,
      nameCn: p.pointName,
      nameEn: p.pointNameEn || '',
      device: '主机',
      deviceId: 'main-engine-1',
      deviceTypeId: rtFlex?.deviceTypeId || 'rt-flex50-main-engine',
      system: tpl?.systemName || defaultSubsystem(p.pointCode),
      subsystem: tpl?.systemName || defaultSubsystem(p.pointCode),
      pointKind,
      value: val,
      unit,
      precision: Number.isInteger(tpl?.precision) ? tpl.precision : 2,
      normalMin,
      normalMax,
      status: evaluatePointStatus(val, normalMin, normalMax, pointKind, tpl),
      sourceKind: 'historical-copy-replay',
      range: formatNormalRangeText(normalMin, normalMax, unit, pointKind)
    }
  })
}

export const isLocalSensor = (s) =>
  Boolean(s?.sourceKind === 'historical-copy-replay') ||
  s?.deviceId === 'main-engine-1' ||
  s?.deviceId === 'aux-system' ||
  s?.id === 'ship-speed'
