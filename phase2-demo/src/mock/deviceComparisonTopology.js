// RT-flex50 six-cylinder installation, based on the local engine knowledge base.
// Structure and measurement coverage are separate: missing telemetry never removes a component.
import {mainCylinderSensorBindings} from './sensors.js'
export const rtFlex50Sources = [
  { title: 'RT-flex50 传感器测点清单', path: 'D:/zstech/ship_sop/wiki_rt-flex50/concepts/传感器测点清单.md', scope: '1–6 缸排温、扫气温度、活塞冷却油出口及冷却淡水出口的测点元数据' },
  { title: '第2章 · 系统描述', path: 'D:/zstech/ship_sop/wiki_rt-flex50/chapters/第2章-系统描述.md', scope: '燃油、伺服油、排气驱动、冷却水、润滑油、扫气及控制空气的连接关系' },
  { title: '喷射控制单元 ICU', path: 'D:/zstech/ship_sop/wiki_rt-flex50/concepts/喷射控制单元ICU.md', scope: '每缸喷射执行机构与共用燃油轨、伺服油轨的关系' },
  { title: '气门控制单元 VCU', path: 'D:/zstech/ship_sop/wiki_rt-flex50/concepts/气门控制单元VCU.md', scope: '每缸排气驱动与共用伺服油、空气弹簧的关系' },
  { title: 'WECS-9520 控制系统', path: 'D:/zstech/ship_sop/wiki_rt-flex50/concepts/WECS-9520控制系统.md', scope: '每缸 FCM-20、燃油量活塞反馈及排气阀行程反馈' },
]

export const cylinderNumbers = [1, 2, 3, 4, 5, 6]
export const cylinderTopics = [
  { id: 'exhaust', name: '排气温度', unit: '°C', addressStart: 8, measurement: '排气温度', component: '排气阀及该缸排气出口', shared: ['exhaust'],
    path: '第 {n} 缸燃烧室 → 排气阀 → 排气汇流 → 增压器',
    question: '对照其他缸排温、转速与负荷，再结合喷射及排气阀反馈核实变化范围。' },
  { id: 'scavenge', name: '扫气温度', unit: '°C', addressStart: 22, measurement: '扫气温度', component: '该缸扫气空间与扫气口', shared: ['scavenge'],
    path: '增压器 → 空冷器与水分离器 → 共用扫气接收器 → 第 {n} 缸扫气口',
    question: '先分清单缸扫气空间变化和共用进气条件变化；共用压力不能替代该缸温度。' },
  { id: 'coolant', name: '冷却淡水出口', unit: '°C', addressStart: 46, measurement: '冷却淡水出口温度', component: '气缸套、气缸盖与排气阀壳冷却支路', shared: ['cooling'],
    path: '共用冷却水分配管 → 第 {n} 缸气缸套 → 气缸盖 → 排气阀壳 → 出口回流',
    question: '结合该缸出口与共用进口条件理解温差；未取得缸级出口读数时不能判断局部冷却是否正常。' },
  { id: 'piston', name: '活塞冷却油出口', unit: '°C', addressStart: 31, measurement: '活塞冷却油出口温度', component: '活塞冷却油通道与伸缩管', shared: ['lubrication'],
    path: '共用轴承油供给 → 伸缩管 → 第 {n} 缸活塞冷却通道 → 冷却油出口',
    question: '核对该缸冷却油出口、供油条件及实际检查；通用滑油温度不代替活塞出口温度。' },
  { id: 'icu', name: '喷射控制 ICU', unit: 'mm', measurement: 'ICU 燃油量活塞行程', component: '该缸 ICU、喷油器及 FCM-20 控制', shared: ['fuel', 'servo'],
    path: '共用燃油轨 → 第 {n} 缸 ICU → 喷油器；伺服油轨提供执行动力，FCM-20 提供控制',
    question: '将喷射指令、燃油量活塞反馈及排温按同刻核对，报警不能直接等同于 ICU 机械卡阻。' },
  { id: 'vcu', name: '排气驱动 VCU', unit: 'mm', measurement: 'VCU 排气阀开启行程', component: '该缸 VCU、排气阀驱动与空气弹簧', shared: ['servo', 'control-air'],
    path: '共用伺服油轨 → 第 {n} 缸 VCU → 排气阀液压开启；控制空气供给空气弹簧完成关闭',
    question: '结合排气阀指令、行程反馈及伺服油 / 空气弹簧条件核实动作，不能只凭排温确定 VCU 故障。' },
]

// Only explicit cylinder identities in the current mock sensor catalogue are bound.
// s-004 (generic exhaust temperature) and s-007 (generic cooling outlet) remain unbound.
export const cylinderSensorBindings = mainCylinderSensorBindings

export const sharedSystems = [
  { id: 'fuel', name: '燃油供给与燃油轨', shortName: '燃油轨', sensorIds: ['main-fuel-rail-pressure', 's-001', 's-002', 's-003'], issueIds: [],
    relationship: '燃油泵向共用燃油轨供油，再经每缸 ICU 分配至喷油器。',
    path: '燃油进口 → 燃油泵 → 燃油轨 → 1–6 缸 ICU 与喷油器',
    coverage: '燃油轨压力与进机侧温度、压力分别统计；进机侧压力不能代替共轨压力。' },
  { id: 'servo', name: '伺服油共轨', shortName: '伺服油轨', sensorIds: ['main-servo-rail-pressure'], issueIds: ['real-alarm-0430'],
    relationship: '伺服油轨为各缸 ICU 与 VCU 的执行提供液压动力。',
    path: '轴承油 → 自动过滤器 → 伺服油泵 → 伺服油轨 → 1–6 缸 ICU / VCU',
    coverage: '查看伺服油轨压力的周期变化，并结合各缸 ICU / VCU 反馈；通用滑油压力不作为伺服油轨压力。' },
  { id: 'scavenge', name: '增压与扫气接收器', shortName: '扫气接收器', sensorIds: ['s-011'], issueIds: [],
    relationship: '增压器、空冷器和扫气接收器为各缸供气；各缸扫气温度分别观察。',
    path: '增压器 → 空冷器 → 水分离器 → 扫气接收器 → 1–6 缸扫气口',
    coverage: '共用扫气压力与各缸扫气温度分别统计；温度差异需结合负荷及进气条件理解。' },
  { id: 'cooling', name: '冷却水供给与回流', shortName: '冷却水回路', sensorIds: ['s-007', 's-008', 's-017'], issueIds: [],
    relationship: '共用分配管向各缸冷却支路供水，经过缸套、缸盖和排气阀壳后回流。',
    path: '冷却水供给 → 分配管 → 各缸冷却支路 → 出水管 → 温度调节与冷却器',
    coverage: '缸套冷却淡水的共用供回水与各缸出口分别统计；通用出口水温不擅自绑定到某一气缸。' },
  { id: 'lubrication', name: '轴承油与活塞冷却供油', shortName: '轴承油供给', sensorIds: ['s-009', 's-010'], issueIds: [],
    relationship: '共用轴承油系统还向活塞冷却及其他润滑部位分配供油。',
    path: '轴承油供给 → 各缸伸缩管与活塞冷却通道 → 回油',
    coverage: '共用滑油压力、温度与各缸活塞冷却油出口分别统计；油侧冷却与缸套淡水冷却分开理解。' },
  { id: 'control-air', name: '控制空气与空气弹簧', shortName: '控制空气', sensorIds: ['main-control-air-pressure', 'main-air-spring-pressure'], issueIds: ['real-warning-0523'],
    relationship: '控制空气经供给及过滤向气动控制和各缸排气阀空气弹簧分配。',
    path: '控制空气供给 → 减压与过滤 → 气动控制 / 各缸排气阀空气弹簧',
    coverage: '控制空气进口与空气弹簧供气分别统计；0523 低压核实与后续检查资料按原事项查看。' },
  { id: 'exhaust', name: '排气汇流与增压器', shortName: '排气汇流', sensorIds: ['s-004', 's-006'], issueIds: [],
    relationship: '各缸排气经排气阀后汇入共用排气侧，排气能量驱动增压器。',
    path: '1–6 缸排气出口 → 排气汇流 → 增压器',
    coverage: '通用排温测点暂保留原名称，不代替任一缸排温；增压器前后排温尚未接入本页。' },
]

export function topologyNumber(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function buildCylinderMatrix(readings = []) {
  return cylinderTopics.map(topic => ({
    ...topic,
    cells: cylinderNumbers.map(number => {
      const binding = cylinderSensorBindings[number]?.[topic.id]
      const sensor = binding ? readings.find(item => item.id === binding && item.deviceId === 'main-engine-1') : null
      const value = topologyNumber(sensor?.value)
      return {
        id: `${topic.id}-${number}`, number, topicId: topic.id, measurement: `${number} 缸${topic.measurement}`,
        address: topic.addressStart ? topic.addressStart + number - 1 : null,
        sensor: sensor || null, value, unit: sensor?.unit || topic.unit,
        available: value !== null, coverage: value === null ? '暂无数据' : '查看统计',
        issueIds: number === 2 && ['exhaust', 'icu'].includes(topic.id) ? ['real-alarm-0430'] : topic.id === 'exhaust' && number === 1 ? ['real-tracking-exhaust-baseline'] : topic.id === 'exhaust' && number === 4 ? ['real-health-c4-baseline'] : [],
      }
    }),
  }))
}

export function cylinderDetail(number, topicId, readings = []) {
  const topic = buildCylinderMatrix(readings).find(row => row.id === topicId)
  const cell = topic?.cells.find(item => item.number === number)
  if (!topic || !cell) return null
  return { ...topic, ...cell, path: topic.path.replaceAll('{n}', String(number)), supplies: sharedSystems.filter(system => topic.shared.includes(system.id)) }
}

export function sharedSystemDetail(id, readings = []) {
  const system = sharedSystems.find(item => item.id === id)
  if (!system) return null
  return { ...system, readings: readings.filter(sensor => sensor.deviceId === 'main-engine-1' && system.sensorIds.includes(sensor.id)) }
}
