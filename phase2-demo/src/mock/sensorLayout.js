import { mainCylinderSensorBindings } from './sensors.js'

export const sensorCylinderNumbers = [1, 2, 3, 4, 5, 6]
export const sensorCylinderRows = [
  { id: 'exhaust', name: '排气温度', unit: '°C', icon: 'exhaust' },
  { id: 'scavenge', name: '扫气温度', unit: '°C', icon: 'scavenge' },
  { id: 'coolant', name: '冷却淡水出口', unit: '°C', icon: 'cooling' },
  { id: 'piston', name: '活塞冷却油出口', unit: '°C', icon: 'lubrication' },
  { id: 'icu', name: 'ICU 燃油量活塞行程', unit: 'mm', icon: 'icu', note: '最近工作循环' },
  { id: 'vcu', name: 'VCU 排气阀开启行程', unit: 'mm', icon: 'vcu', note: '最近工作循环' },
]

// IDs express the installed measurement scope. Generic temperature points do not
// become cylinder points, and seawater is kept separate from jacket fresh water.
const mainColumns = [
  [
    { id: 'fuel', title: '燃油供给', code: 'FUEL OIL', icon: 'fuel', sections: [
      { ids: ['main-fuel-rail-pressure', 's-001', 's-002', 's-003'] },
    ] },
    { id: 'lubrication', title: '润滑与活塞冷却供油', code: 'LUBE OIL', icon: 'lubrication', sections: [
      { ids: ['s-009', 's-010'] },
    ] },
  ],
  [
    { id: 'air', title: '扫气与控制空气', code: 'AIR', icon: 'scavenge', sections: [
      { title: '扫气供给', ids: ['s-011'] },
      { title: '控制空气 / 空气弹簧', ids: ['main-control-air-pressure', 'main-air-spring-pressure'] },
    ] },
    { id: 'servo', title: '伺服油供给', code: 'SERVO OIL', icon: 'servo', sections: [
      { ids: ['main-servo-rail-pressure'] },
    ] },
  ],
  [
    { id: 'exhaust', title: '排气与增压关联', code: 'EXHAUST / TURBO', icon: 'exhaust', sections: [
      { ids: ['s-004', 's-006'] },
    ] },
    { id: 'cooling', title: '冷却水', code: 'COOLING', icon: 'cooling', sections: [
      { title: '缸套淡水', ids: ['s-007', 's-008', 's-017'] },
      { title: '海水换热侧', ids: ['s-015', 's-016'] },
    ] },
  ],
]
const mainOperatingGroups = [
  { id: 'running', title: '运行参数', code: 'ENGINE', icon: 'cylinder', sections: [
    { ids: ['s-012', 'main-load'] },
  ] },
  { id: 'mechanical', title: '振动与轴承', code: 'MECHANICAL', icon: 'cylinder', sections: [
    { ids: ['s-013', 's-014', 's-018', 's-019'] },
  ] },
]

function iconForSubsystem(subsystem) {
  if (/燃油|燃烧/.test(subsystem)) return 'fuel'
  if (/滑油|润滑/.test(subsystem)) return 'lubrication'
  if (/冷却|水位|给水/.test(subsystem)) return 'cooling'
  if (/空气|蒸汽|扫气/.test(subsystem)) return 'scavenge'
  if (/排温|排气/.test(subsystem)) return 'exhaust'
  if (/液压/.test(subsystem)) return 'servo'
  return 'cylinder'
}

function groupBySubsystem(readings) {
  const groups = new Map()
  for (const sensor of readings) {
    const title = sensor.subsystem || '其他测点'
    if (!groups.has(title)) groups.set(title, {
      id: title,
      title,
      icon: iconForSubsystem(title),
      sections: [{ sensors: [] }],
    })
    groups.get(title).sections[0].sensors.push(sensor)
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

export function buildSensorLayout(readings = []) {
  const mainReadings = readings.filter(sensor => sensor.deviceId === 'main-engine-1')
  const mainById = new Map(mainReadings.map(sensor => [sensor.id, sensor]))
  const assigned = new Set()
  const populate = definition => {
    const sections = definition.sections.map(section => ({
      title: section.title || '',
      sensors: section.ids.flatMap(id => {
        const sensor = mainById.get(id)
        if (!sensor || assigned.has(id)) return []
        assigned.add(id)
        return [sensor]
      }),
    })).filter(section => section.sensors.length)
    return sections.length ? { ...definition, sections } : null
  }
  const columns = mainColumns.map(column => column.map(populate).filter(Boolean)).filter(column => column.length)
  const matrix = sensorCylinderRows.map(row => ({
    ...row,
    cells: sensorCylinderNumbers.map(number => {
      const sensor = mainById.get(mainCylinderSensorBindings[number]?.[row.id]) || null
      if (sensor) assigned.add(sensor.id)
      return { number, sensor }
    }),
  })).filter(row => row.cells.some(cell => cell.sensor))
  const operatingGroups = mainOperatingGroups.map(populate).filter(Boolean)
  const additionalGroups = groupBySubsystem(mainReadings.filter(sensor => !assigned.has(sensor.id)))
  const devices = new Map()
  for (const sensor of readings.filter(item => item.deviceId !== 'main-engine-1')) {
    const key = sensor.deviceId || sensor.device || 'other'
    if (!devices.has(key)) devices.set(key, { id: key, name: sensor.device || '其他设备', readings: [] })
    devices.get(key).readings.push(sensor)
  }
  return {
    main: mainReadings.length ? { columns, matrix, operatingGroups, additionalGroups, count: mainReadings.length } : null,
    devices: [...devices.values()].map(device => ({
      id: device.id,
      name: device.name,
      count: device.readings.length,
      groups: groupBySubsystem(device.readings),
    })).sort((a, b) => a.id.localeCompare(b.id, 'zh-CN', { numeric: true })),
  }
}

export function formatSensorValue(sensor) {
  const value = sensor?.value
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return Number.isInteger(sensor.precision) && sensor.precision >= 0 && sensor.precision <= 10
    ? number.toFixed(sensor.precision)
    : String(value)
}

export function filterSensorReadings(readings, query = '') {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return readings
  return readings.filter(sensor => [sensor.nameCn, sensor.nameEn]
    .some(name => String(name || '').toLocaleLowerCase().includes(normalized)))
}

// The overview keeps operating context and the four comparable cylinder
// temperatures. Detailed actuator feedback and secondary points stay in data.
export function overviewSensorReadings(readings = []) {
  const mainIds = new Set([
    'main-fuel-rail-pressure', 's-002', 's-009', 's-010', 's-011',
    'main-control-air-pressure', 'main-air-spring-pressure', 'main-servo-rail-pressure',
    's-006', 's-007', 's-008', 's-017', 's-012', 'main-load',
    ...sensorCylinderNumbers.flatMap(number => ['exhaust', 'scavenge', 'coolant', 'piston']
      .map(topic => mainCylinderSensorBindings[number][topic])),
  ])
  return readings.filter(sensor => sensor.deviceId !== 'main-engine-1' || mainIds.has(sensor.id))
}
