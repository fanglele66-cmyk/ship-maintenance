/**
 * Mock 数据 - 船舶设备检修助手（船端应用）V1.0
 * 严格对齐《船端v1.0需求文档》数据模型：
 *  - 设备状态：绿(监测正常) / 黄(异常未排查) / 红(故障未解决) / 灰(离线)
 *  - 事件状态流：待确认 → 处理中 → 临时处理 → 已解决；待确认 → 误报
 *  - 紧急程度：高(红) / 中(橙) / 低(蓝)
 *  - 来源标签：AI检测 / 巡检发现 / 船员上报
 */

// ============ 船舶基础信息 ============
export const shipInfo = {
  shipId: 'NY-2024-001',
  shipName: '南油运输 8 号',
  shipType: '原油运输船',
  imo: 'IMO 9876543',
  flag: '中国',
  buildYear: 2018,
  grossTonnage: 45800,
  length: 228.5,
  // 工况
  navStatus: 'sailing',        // sailing(航行) / docking(靠港停泊)
  speed: 14.2,                 // 航速 kn
  heading: 185,                // 航向 °
  mainRpm: 78,                 // 主机转速
  position: { longitude: 122.85, latitude: 29.76 },
  // 看板信息
  online: true,
  healthScore: 86,
  deviceCount: 10,
  lastInspection: '2026-06-26 08:00',
  operationCount: 128,
  voyage: {
    voyageNo: 'V2026-026',
    departure: '宁波港',
    destination: '新加坡港',
    eta: '2026-06-28 14:00',
    cargoType: '原油',
    cargoTonnage: 41200
  },
  crewCount: 24,
  master: '张船长'
}

// ============ 设备状态枚举（文档四色）============
export const DEVICE_STATUS = {
  NORMAL:  'normal',   // 绿 = 监测正常
  WARNING: 'warning',  // 黄 = 存在异常未排查
  DANGER:  'danger',   // 红 = 存在故障未解决
  OFFLINE: 'offline'   // 灰 = 离线
}

export const DEVICE_STATUS_META = {
  normal:  { label: '监测正常', color: '#52C41A', dot: '#52C41A' },
  warning: { label: '异常未排查', color: '#FAAD14', dot: '#FAAD14' },
  danger:  { label: '故障未解决', color: '#FF4D4F', dot: '#FF4D4F' },
  offline: { label: '离线', color: '#5A7A92', dot: '#5A7A92' }
}

// ============ 事件状态枚举 ============
export const EVENT_STATUS = {
  PENDING:      'pending',       // 待确认
  PROCESSING:   'processing',    // 处理中
  TEMP_HANDLED: 'temp_handled',  // 临时处理
  RESOLVED:     'resolved',      // 已解决
  FALSE_ALARM:  'false_alarm'    // 误报
}

export const EVENT_STATUS_META = {
  pending:      { label: '待确认', color: '#FAAD14' },
  processing:   { label: '处理中', color: '#1890FF' },
  temp_handled: { label: '临时处理', color: '#13C2C2' },
  resolved:     { label: '已解决', color: '#52C41A' },
  false_alarm:  { label: '误报', color: '#5A7A92' }
}

// ============ 紧急程度（高红/中橙/低蓝）============
export const PRIORITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }
export const PRIORITY_META = {
  high:   { label: '高', color: '#FF4D4F', rank: 3 },
  medium: { label: '中', color: '#FAAD14', rank: 2 },
  low:    { label: '低', color: '#1890FF', rank: 1 }
}

// ============ 来源标签 ============
export const SOURCE = { AI: 'ai', INSPECTION: 'inspection', CREW: 'crew' }
export const SOURCE_META = {
  ai:         { label: 'AI检测', color: '#1890FF', icon: 'mdi:robot' },
  inspection: { label: '巡检发现', color: '#FAAD14', icon: 'mdi:clipboard-search' },
  crew:       { label: '船员上报', color: '#13C2C2', icon: 'mdi:account-voice' }
}

// ============ 系统分类（级联/分组用）============
export const DEVICE_SYSTEMS = [
  { key: 'engine',    name: '主机系统', icon: 'mdi:engine', children: [
    { key: 'main-engine', name: '主推进装置' },
    { key: 'engine-aux',  name: '主机辅助设备' }
  ]},
  { key: 'generator', name: '辅机系统', icon: 'mdi:power-plug', children: [
    { key: 'gen-set', name: '发电机组' },
    { key: 'boiler',  name: '辅助锅炉' }
  ]},
  { key: 'pump',      name: '泵类设备', icon: 'mdi:water-pump', children: [
    { key: 'cargo-pump',   name: '货油泵' },
    { key: 'ballast-pump', name: '压载水泵' }
  ]},
  { key: 'valve',     name: '阀门管系', icon: 'mdi:pipe-valve', children: [
    { key: 'fuel-valve', name: '燃油阀门组' }
  ]},
  { key: 'deck',      name: '甲板机械', icon: 'mdi:anchor', children: [
    { key: 'windlass', name: '锚机绞缆' }
  ]}
]

// 预设传感器分组（首页/监控 快速选项卡）
export const SENSOR_PRESET_GROUPS = [
  { key: 'all',      name: '全部',       sensorIds: null },
  { key: 'fuel',     name: '燃油系统',   sensorIds: ['S-03','S-04','S-05'] },
  { key: 'exhaust',  name: '排气系统',   sensorIds: ['S-01','S-02','S-09','S-10'] },
  { key: 'startup',  name: '启动观察组', sensorIds: ['S-06','S-07','S-08'] }
]

// ============ 设备列表 ============
export const deviceList = [
  { id: 'DEV-001', name: '主机 #1', model: 'MAN B&W 6S70ME-C', system: 'engine', subSystem: 'main-engine',
    systemLabel: '主机系统 / 主推进装置', location: '机舱底层', shipPos: { x: 52, y: 58 },
    status: DEVICE_STATUS.DANGER, runHours: 48256, lastMaintenance: '2026-05-10',
    metrics: { temperature: 92.4, pressure: 1.42, rpm: 78, vibration: 8.7, oilPressure: 0.42 },
    thresholds: { temperature: [60,85], pressure: [1.0,1.5], vibration: [0,7.1], oilPressure: [0.3,0.6] },
    alarm: '排气温度超限 + 振动异常' },
  { id: 'DEV-002', name: '主机 #2', model: 'MAN B&W 6S70ME-C', system: 'engine', subSystem: 'main-engine',
    systemLabel: '主机系统 / 主推进装置', location: '机舱底层', shipPos: { x: 52, y: 42 },
    status: DEVICE_STATUS.NORMAL, runHours: 48120, lastMaintenance: '2026-05-10',
    metrics: { temperature: 78.2, pressure: 1.38, rpm: 78, vibration: 4.2, oilPressure: 0.45 },
    thresholds: { temperature: [60,85], pressure: [1.0,1.5], vibration: [0,7.1], oilPressure: [0.3,0.6] },
    alarm: null },
  { id: 'DEV-003', name: '柴油发电机组 #1', model: 'Wärtsilä 6L20', system: 'generator', subSystem: 'gen-set',
    systemLabel: '辅机系统 / 发电机组', location: '机舱二层', shipPos: { x: 40, y: 50 },
    status: DEVICE_STATUS.WARNING, runHours: 21340, lastMaintenance: '2026-04-22',
    metrics: { temperature: 76.8, voltage: 440, frequency: 60.2, power: 580, oilPressure: 0.38 },
    thresholds: { temperature: [40,80], voltage: [380,440], frequency: [59.5,60.5], power: [0,800] },
    alarm: '发电频率轻微偏高' },
  { id: 'DEV-004', name: '柴油发电机组 #2', model: 'Wärtsilä 6L20', system: 'generator', subSystem: 'gen-set',
    systemLabel: '辅机系统 / 发电机组', location: '机舱二层', shipPos: { x: 64, y: 50 },
    status: DEVICE_STATUS.NORMAL, runHours: 21180, lastMaintenance: '2026-04-22',
    metrics: { temperature: 68.5, voltage: 440, frequency: 60.0, power: 520, oilPressure: 0.41 },
    thresholds: { temperature: [40,80], voltage: [380,440], frequency: [59.5,60.5], power: [0,800] },
    alarm: null },
  { id: 'DEV-005', name: '货油泵 #1', model: 'FRAMO SB', system: 'pump', subSystem: 'cargo-pump',
    systemLabel: '泵类设备 / 货油泵', location: '泵舱', shipPos: { x: 72, y: 56 },
    status: DEVICE_STATUS.NORMAL, runHours: 15680, lastMaintenance: '2026-03-15',
    metrics: { flowRate: 1850, pressure: 1.85, temperature: 62.3, vibration: 3.4 },
    thresholds: { flowRate: [0,2500], pressure: [0.5,2.5], temperature: [10,80], vibration: [0,7.1] },
    alarm: null },
  { id: 'DEV-006', name: '压载水泵 #1', model: 'FRAMO', system: 'pump', subSystem: 'ballast-pump',
    systemLabel: '泵类设备 / 压载水泵', location: '泵舱', shipPos: { x: 76, y: 44 },
    status: DEVICE_STATUS.OFFLINE, runHours: 9870, lastMaintenance: '2026-02-08',
    metrics: { flowRate: 0, pressure: 0, temperature: 25.0, vibration: 0 },
    thresholds: { flowRate: [0,1200], pressure: [0.2,1.5], temperature: [10,70], vibration: [0,7.1] },
    alarm: '设备离线（停机）' },
  { id: 'DEV-009', name: '燃油阀门组 #3', model: 'DBV-200', system: 'valve', subSystem: 'fuel-valve',
    systemLabel: '阀门管系 / 燃油阀门组', location: '机舱底层', shipPos: { x: 44, y: 64 },
    status: DEVICE_STATUS.WARNING, runHours: 38900, lastMaintenance: '2026-01-20',
    metrics: { openDegree: 72, leakage: 0.08, temperature: 48.6 },
    thresholds: { openDegree: [0,100], leakage: [0,0.05], temperature: [10,80] },
    alarm: '阀门轻微内漏' },
  { id: 'DEV-010', name: '锚机绞缆 #1', model: 'IHI-35', system: 'deck', subSystem: 'windlass',
    systemLabel: '甲板机械 / 锚机绞缆', location: '艏楼甲板', shipPos: { x: 22, y: 50 },
    status: DEVICE_STATUS.DANGER, runHours: 5670, lastMaintenance: '2026-04-10',
    metrics: { load: 45, temperature: 38.5, vibration: 2.1, oilLevel: 18 },
    thresholds: { load: [0,80], temperature: [10,60], vibration: [0,7.1], oilLevel: [30,100] },
    alarm: '液压油位低于警戒' }
]

// ============ 传感器实时数据（中英文名 + 单位 + 正常范围 + 状态）============
export const sensorData = [
  { id: 'S-01', deviceId: 'DEV-001', nameCn: '排气温度', nameEn: 'Exh.Gas Temp', value: 92.4, unit: '℃', range: [60,85], system: 'engine',   groupKey: 'exhaust', status: 'danger' },
  { id: 'S-02', deviceId: 'DEV-001', nameCn: '振动值',   nameEn: 'Vibration',    value: 8.7,  unit: 'mm/s', range: [0,7.1], system: 'engine',  groupKey: 'exhaust', status: 'danger' },
  { id: 'S-03', deviceId: 'DEV-001', nameCn: '滑油压力', nameEn: 'L.O. Pressure', value: 0.42, unit: 'MPa', range: [0.3,0.6], system: 'engine', groupKey: 'fuel', status: 'normal' },
  { id: 'S-04', deviceId: 'DEV-001', nameCn: '燃油进机压力', nameEn: 'F.O. Inlet Press', value: 0.38, unit: 'MPa', range: [0.35,0.6], system: 'engine', groupKey: 'fuel', status: 'warning' },
  { id: 'S-05', deviceId: 'DEV-001', nameCn: '燃油流量', nameEn: 'F.O. Flow', value: 1.24, unit: 'm³/h', range: [0.8,1.6], system: 'engine', groupKey: 'fuel', status: 'normal' },
  { id: 'S-06', deviceId: 'DEV-002', nameCn: '启动空气压力', nameEn: 'Start Air Press', value: 2.85, unit: 'MPa', range: [2.5,3.0], system: 'engine', groupKey: 'startup', status: 'normal' },
  { id: 'S-07', deviceId: 'DEV-002', nameCn: '排气温度', nameEn: 'Exh.Gas Temp', value: 78.2, unit: '℃', range: [60,85], system: 'engine', groupKey: 'startup', status: 'normal' },
  { id: 'S-08', deviceId: 'DEV-002', nameCn: '缸套冷却水温', nameEn: 'Jacket C.W. Temp', value: 82.1, unit: '℃', range: [70,88], system: 'engine', groupKey: 'startup', status: 'normal' },
  { id: 'S-09', deviceId: 'DEV-001', nameCn: '第3缸排温', nameEn: 'Cyl.3 Exh.Temp', value: 94.1, unit: '℃', range: [60,85], system: 'engine', groupKey: 'exhaust', status: 'danger' },
  { id: 'S-10', deviceId: 'DEV-001', nameCn: '第4缸排温', nameEn: 'Cyl.4 Exh.Temp', value: 81.3, unit: '℃', range: [60,85], system: 'engine', groupKey: 'exhaust', status: 'normal' },
  { id: 'S-11', deviceId: 'DEV-003', nameCn: '输出频率', nameEn: 'Frequency', value: 60.2, unit: 'Hz', range: [59.5,60.5], system: 'generator', groupKey: 'fuel', status: 'warning' },
  { id: 'S-12', deviceId: 'DEV-005', nameCn: '货油泵流量', nameEn: 'Cargo Pump Flow', value: 1850, unit: 'm³/h', range: [0,2500], system: 'pump', groupKey: 'fuel', status: 'normal' },
  { id: 'S-13', deviceId: 'DEV-009', nameCn: '阀门泄漏率', nameEn: 'Valve Leakage', value: 0.08, unit: '%', range: [0,0.05], system: 'valve', groupKey: 'fuel', status: 'warning' },
  { id: 'S-14', deviceId: 'DEV-010', nameCn: '液压油位', nameEn: 'Hyd. Oil Level', value: 18, unit: '%', range: [30,100], system: 'deck', groupKey: 'startup', status: 'danger' },
  { id: 'S-15', deviceId: 'DEV-001', nameCn: '主机转速', nameEn: 'Main RPM', value: 78, unit: 'r/min', range: [0,90], system: 'engine', groupKey: 'exhaust', status: 'normal' }
]

// ============ AI 监测摘要（监控中心顶部）============
export const aiMonitorSummary = {
  // ---- 基本状态 ----
  healthScore: 87,
  healthLabel: '整体良好',
  workCondition: '机动航行',   // 机动航行/停机/热稳态未建立/过渡中/稳速巡航
  avgRPM: '69',
  stopped: false,

  // ---- 停机态专用 ----
  stopInfo: [
    '停机时刻：2026-06-23 17:01:29',
    '平均转速：0.0 RPM',
    '燃油指令：0.0%',
    '数据记录数：69 条',
    '说明：主机处于停机状态，跳过健康分析',
  ],

  // ---- 运行态摘要 ----
  conclusion: '当前运行正常（**缸间均衡性良好**，各系统关键参数均在安全范围内），但**增压器系统**效能持续下降（增压器转速与扫气压力双双呈明显下降趋势），建议近期安排检查。',
  concerns: [
    {
      keyword: '缸间均衡性良好',
      systemName: '缸间状态',
      detail: '**各缸均衡性整体良好：**\n\n· 排温 CV **2.81%**（优秀）\n· 扫气温 CV **2.82%**（优秀）\n· 冷却水出口 CV **0.82%**（优秀）\n· 活塞冷却油 CV **0.44%**（优秀）\n\n**个别差异：**\n\n2号缸排温均值 **240.6°C**，比其他缸低约 **11°C**；5号缸 **243.2°C**，低约 **8°C**。偏差值仍在合理范围内，暂不影响运行，但持续监测为宜。',
    },
    {
      keyword: '增压器系统',
      systemName: '增压器',
      detail: '**增压器转速与扫气压力双双呈明显下降趋势**，近 7 日趋势数据显示：\n\n• 扫气压力从 2.85 bar 降至 2.61 bar（降幅 **8.4%**）\n• 增压器转速从 14800 RPM 降至 13200 RPM（降幅 **10.8%**）\n\n可能原因：喷嘴环积碳、空冷器脏堵、或转子轴承磨损。\n建议：择机安排拆检，优先清洁喷嘴环并检查空冷器压差。',
    },
  ],
  suggestions: [
    '优先检查**增压器**：近期择机检查**喷嘴环、转子积碳情况及空冷器脏堵情况**，必要时清洁',
    '核实**增压器滑油压力传感器**：当前 **0.34 bar** 低于 **OEM 报警限 1.0 bar**，需确认传感器量程设置是否正确',
    '关注 **2 号缸排温**：持续比均值低约 **11°C**，后续靠港可考虑检查**喷油器状态**',
    '**燃油温度**：当前 **114.3°C**，如使用 HFO 建议核查**粘度控制是否在 13-17 cSt 范围内**',
  ],
  suggestFocus: '增压器系统',
  suggestReason: '增压器转速与扫气压力',

  // ---- 底部小结 ----
  footerText: '以上结论仅供参考，实际以现场检测为准。',
}

// ============ 事件列表（检修中心核心数据）============
// 进度阶段节点（根据事件状态动态选择流转路径）：
//   状态流转进度节点（始终显示完整4节点路径，高亮当前阶段）
//   路径1(默认/全周期): 待确认(0) → 处理中(1) → 临时处理(2) → 已解决(3)
//   路径2(误报): 待确认 → 误报
export function getEventStageNodes(status) {
  if (status === 'false_alarm') return ['待确认', '误报']
  // 所有其他状态统一返回4节点，由 stageIndex 控制高亮位置
  return ['待确认', '处理中', '临时处理', '已解决']
}
// 向后兼容：默认路径（旧引用不报错）
export const STAGE_NODES = ['待确认', '处理中', '已解决']

export const events = [
  // ═══════════════════════════════════════════
  // EVT-0042: 锚机绞缆 #1 液压油位低（完整数据参考）
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0042',
    title: '锚机绞缆 #1 液压油位低',
    systemPart: '甲板机械 / 锚机绞缆',
    deviceId: 'DEV-010',
    deviceName: '锚机绞缆 #1',
    priority: 'high',
    source: 'ai',
    status: 'pending',
    stageIndex: 0,
    createdAt: '2026-06-26 11:30',
    updatedAt: '2026-06-26 11:30',
    description: '锚机绞缆 #1 液压油位低于警戒线(18%)，需补充液压油并检查管路渗漏。',
    progressSummary: '待确认：AI检测触发，待人工确认',
    aiAnalysis: {
      verdict: 'suspected', confidence: 92,
      conclusion: '液压油位低，需排查管路渗漏点',
      conclusionDetail: '**疑似故障（置信度 92%）**\n\n**现象描述**：锚机绞缆#1液压油位持续下降，当前实测值 **18%**，远低于正常下限 **30%**。液压系统压力 18.5 MPa 处于正常范围（16-21 MPa），说明系统尚能维持工作压力，但油量不足已影响冷却和润滑效果。\n\n**数据快照**：\n- 液压油位（P43）：18%，20小时内从 98% 持续降至 18%，下降速率异常\n- 油温 58℃ 在正常范围（40-70℃），暂无过热迹象\n- 系统压力 18.5 MPa 正常，泵体输出能力未明显衰减\n\n**建议**：\n1. **立即处理**：补充液压油至正常油位（≥60%）\n2. **短期跟进**：对液压管路全面检漏，重点关注接头和软管段\n3. **中长期**：建立定期油品检测制度，关注密封件老化周期',
      faultTable: [
        { candidate: '管路渗漏', reason: '接头松动或垫片失效导致持续泄漏；油箱底部发现油渍痕迹支持此判断', consequence: '油位持续下降，如不及时处理可能导致气蚀损坏泵体', probability: '高' },
        { candidate: '密封件老化', reason: '液压缸/阀组密封圈长期高压高温工况加速老化', consequence: '微量泄漏累积，需定期更换密封组件', probability: '中' },
        { candidate: '回油过滤器堵塞', reason: '回油背压过高导致油液滞留系统前端', consequence: '油箱实际回流减少，液位虚低但系统内油量充足', probability: '低' }
      ],
      dataCards: [
        { name: 'P43-液压油位（核心监控）', meta: '20个采样点 · 约20h趋势 · 正常范围 30~100%', value: '当前 <strong>18%</strong>，20h前 <strong>98%</strong>，平均下降速率 <strong>4%/h</strong>。近6h加速至 <strong>5.3%/h</strong>', verdict: '严重偏低 — 存在泵吸空风险', verdictType: 'danger' },
        { name: '液压油温度', meta: '20个采样点 · 物理量程 -10~120℃', value: '值域 <strong>52~58℃</strong>，均值55.2℃。较正常运行偏高约4℃', verdict: '轻微偏高 — 可能与散热效率下降有关', verdictType: 'warning' },
        { name: 'P44-液压系统压力', meta: '20个采样点 · 额定工作压力 16~21 MPa', value: '稳态值 <strong>18.5 MPa</strong>，在额定范围内。峰值19.1MPa', verdict: '正常 — 泵输出能力未受显著影响', verdictType: 'normal' },
        { name: '电机电流', meta: '20个采样点 · 额定电流 ≤ 45A', value: '均值 <strong>32.8A</strong>，峰值38.2A。较历史同工况略偏上限', verdict: '注意 — 油液粘度变化可能增加阻力', verdictType: 'warning' }
      ],
      suggestionsList: [
        '立即补充液压油至正常油位（≥60%），优先选用 ISO VG 46 抗磨液压油',
        '对液压管路进行全面目视检查，重点检查各接头、法兰、软管段的渗漏痕迹',
        '使用紫外荧光检漏剂辅助定位微小泄漏点',
        '取样化验液压油品质（含水量、颗粒度、粘度）',
        '补充后持续监控24h油位变化'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">锚机绞缆液压系统采用闭式回路设计，液压泵从油箱吸油后加压驱动液压马达带动绞缆滚筒。<strong>油位偏低的影响链路：</strong></p><p style="margin-bottom:4px">· 油量不足 → 泵吸入侧产生涡流/气穴 → 气蚀损伤柱塞/配流盘</p><p style="margin-bottom:4px">· 油位低 → 回油管口暴露 → 吸入空气 → 系统响应迟滞/抖动</p><p style="margin-bottom:4px">· 油量减少 → 散热能力下降 → 油温升高 → 内泄漏增加</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次分析：</strong>20小时内从98%降至18%的速率异常，排除正常消耗后高度疑似外部泄漏。</p>',
        matches: [
          { fault: '管路外部渗漏', match: '高匹配', cls: 'high', reason: '油位下降速率与持续泄漏特征完全一致' },
          { fault: '密封件老化泄漏', match: '部分匹配', cls: 'medium', reason: '可解释初期缓慢下降阶段，无法解释近6h加速趋势' },
          { fault: '回油堵塞致虚低', match: '低匹配', cls: 'low', reason: '应伴随油箱外观满溢或呼吸孔喷油，未见此现象' },
          { fault: '液位计漂移', match: '待排除', cls: 'pending', reason: '不能完全排除传感器漂移，需物理标尺交叉验证' }
        ]
      },
      trendData: { seriesName: '液压油位', yUnit: '%', yMin: 10, yMax: 105, times: ['06-20 08:00','06-22 08:00','06-24 08:00','06-26 08:00','06-26 14:00'], values: [98,90,72,28,18] },
      relatedCases: [
        { title: '锚机液压油位骤降·高压软管接头渗漏', match: 88, solution: '更换软管接头密封圈并紧固，补油后持续监控48h液位稳定，无再下降' },
        { title: '液压油位持续缓降·液压缸活塞杆密封磨损', match: 72, solution: '更换活塞杆密封组件（含Y型圈+O型圈），更换后油位稳定' },
        { title: '液压油位虚低·液位计浮子卡滞', match: 45, solution: '清洗液位计导杆、更换浮子组件，物理标尺交叉验证后油位恢复正常读数' }
      ],
      autoActions: [
        'AI检测液压油位低于30%阈值（06-26 06:15）→ 自动创建检修任务（06-26 06:16）',
        '自动关联P43液位传感器趋势数据和P44压力基线数据（06-26 06:17）',
        '已检索到3条相似历史案例并按匹配度排序（06-26 06:18）',
        '推送告警至值班轮机员终端并生成补油作业工单（06-26 06:20）'
      ]
    },
    todos: {
      inspections: [
        {
          id: 'T1', title: '液压系统故障排查', defaultFold: false, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '检查液压油箱外观及液位计', items: [
              '目视检查油箱外壁焊缝处有无渗漏油渍',
              '检查油箱底部放油堵有无湿润痕迹',
              '对比液位计读数与远程监控值是否一致',
              '检查液位计上下连通阀是否处于全开位置'
            ], time: '' },
            { title: '记录当前油位和油温初始数据', items: [
              '拍照记录液位计当前读数',
              '记录液压油温度（正常范围40~70℃）',
              '读取系统压力表稳态值（正常16~21MPa）',
              '记录电机运行电流'
            ], time: '' },
            { title: '目视检查管路各接头及软管段', items: [
              '重点检查高压管路法兰接头有无油渍',
              '检查软管段有无鼓包/老化/龟裂/渗油',
              '检查管路支架/卡箍处有无摩擦磨损痕迹',
              '检查弯头、三通等应力集中部位有无湿润'
            ], time: '' },
            {
              title: '使用荧光检漏剂定位微漏点',
              items: [
                '在油液中按规定比例加入紫外荧光示踪剂',
                '系统循环运行15min使示踪剂充分扩散',
                '在疑似渗漏区域用UV灯照射观察荧光痕迹',
                '标记所有发现的微漏点位置并拍照记录',
                '评估每个泄漏点的严重程度（滴/渗/润湿）'
              ],
              time: '', hasImages: true
            },
            { title: '检查液压泵吸入口状态', items: [
              '听诊泵吸入口有无气蚀噪声（嘶嘶声）',
              '检查吸入滤器压差是否异常增大',
              '观察泵体有无异常温升'
            ], time: '' },
            { title: '取样化验液压油品质', items: [
              '在运行状态下从取样阀放油冲洗3倍管容积',
              '采集500ml油样装入洁净取样瓶',
              '送实验室检测含水量/颗粒度/粘度指标',
              '对比上次化验结果评估油品劣化趋势'
            ], time: '' }
          ]
        },
        { id: 'T2', title: '系统或油柜吸口堵塞排查', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '检查吸油口滤网状态', items: [
              '拆检吸口滤器有无堵塞/异物附着',
              '记录滤网表面杂质类型（金属屑/橡胶碎屑/纤维）和沉积量',
              '评估滤网通流面积减少百分比',
              '检查滤网骨架有无变形/破损'
            ], time: '' },
            { title: '测量吸口负压值', items: [
              '在额定流量下读取吸入侧真空表数值',
              '对比历史正常负压基准判断有无异常阻力',
              '在不同转速工况下记录负压变化趋势',
              '若负压超过-0.08MPa需立即清洗滤器'
            ], time: '' },
            { title: '检查油箱底部沉积物', items: [
              '打开放油旋塞取样底部油液',
              '观察有无金属屑/水分/絮状物',
              '用磁铁检查铁磁性颗粒含量',
              '评估是否需要彻底清洗油箱内部'
            ], time: '' },
            { title: '检查回油过滤器状态', items: [
              '读取回油滤器压差指示器状态（绿/黄/红）',
              '检查回油管路背压是否偏高',
              '判断是否需更换回油滤芯'
            ], time: '' }
          ] },
        { id: 'T3', title: '压力传感器故障排查', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '校验压力传感器输出信号', items: [
              '在管路同一测点安装标准压力表',
              '交叉比对传感器读数与标准表偏差',
              '在全量程范围内多点校验（25%/50%/75%/100%）',
              '检查传感器接线端子有无松动/腐蚀'
            ], time: '' },
            { title: '检查传感器供电与信号回路', items: [
              '测量供电电压是否在额定范围（24V DC ±5%）',
              '用万用表检测信号输出（4-20mA）线性度',
              '检查回路保险丝/断路器状态',
              '检查信号隔离器/安全栅是否正常'
            ], time: '' },
            { title: '排查电磁干扰源', items: [
              '检查传感器线缆屏蔽层接地是否可靠',
              '评估附近大功率设备启停是否引起读数跳变',
              '检查线缆布线是否与动力电缆保持间距',
              '必要时加装信号滤波器'
            ], time: '' },
            { title: '检查传感器机械安装', items: [
              '确认传感器与测压孔的密封连接无泄漏',
              '检查测压导压管有无堵塞/弯折',
              '确认阻尼孔（脉冲衰减器）无堵塞'
            ], time: '' }
          ] },
        { id: 'T4', title: '系统管线泄漏排查', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '分段检查高压管路', items: [
              '沿管路走向逐段目视检查接头、焊缝有无油渍',
              '重点检查弯头、三通等应力集中部位',
              '检查管路固定支架处有无磨损渗漏',
              '检查法兰密封垫片处有无湿润痕迹'
            ], time: '' },
            { title: '检查执行机构密封', items: [
              '观察液压缸活塞杆密封圈有无渗油',
              '检查液压马达轴封处有无湿润痕迹',
              '操作液压缸全行程观察有无外泄漏加剧',
              '检查伺服阀/比例阀安装面有无渗油'
            ], time: '' },
            { title: '检查控制阀组内泄', items: [
              '在保压状态下测量阀组回油口泄漏量',
              '判断溢流阀/换向阀有无异常内泄',
              '检查阀组安装螺栓力矩是否达标',
              '检查阀块O型圈通道密封有无失效'
            ], time: '' },
            { title: '检查油箱及附件密封', items: [
              '检查油箱呼吸阀/通气孔是否通畅',
              '检查油箱加油口盖密封圈是否完好',
              '检查液位计法兰接头有无渗漏',
              '检查油箱放油堵磁性感温塞有无松动'
            ], time: '' },
            { title: '记录并拍照', items: [
              '对每个可疑泄漏点拍照标记坐标位置',
              '在管路图上标注所有泄漏点位置',
              '按严重程度分级（严重/中等/轻微）',
              '整理泄漏点清单供维修参考'
            ], time: '', hasImages: true }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '补充液压油至正常油位（≥60%）', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '安全隔离与准备', items: [
              '确认锚机液压系统已停机卸压，操作面板挂"禁止启动"警示牌',
              '关闭液压泵吸入口蝶阀防止管路存油回流',
              '准备 ISO VG 46 抗磨液压油（核对油品合格证及批次号）',
              '准备加油泵（手摇式或电动式）、60目过滤漏斗、清洁无绒布、接油盘'
            ], time: '' },
            { title: '清洁加油口及周围区域', items: [
              '用清洗剂（柴油或专用溶剂）彻底擦拭加油口盖及周围500mm范围',
              '用无绒布擦干，确保无灰尘、盐结晶、水分残留',
              '检查加油口呼吸阀滤网有无堵塞，必要时用压缩空气反吹清洁',
              '在加油口下方铺垫吸油纸，防止加油过程中油液滴落污染甲板'
            ], time: '' },
            { title: '执行加油作业', items: [
              '将过滤漏斗安装到加油口，确保漏斗与加油口密封贴合无间隙',
              '通过加油泵缓慢注入液压油，控制流速≤15L/min避免产生气泡',
              '加油过程中持续观察液位计读数，每加10L暂停30s等待液面稳定',
              '目标液位：60%~70%刻度区间（油箱总容积约200L，需补约80~100L）'
            ], time: '' },
            { title: '加油后系统排气与静置', items: [
              '点动启动液压泵3~5次（每次运转≤3秒），利用泵运转排出管路空气',
              '观察液位计是否因系统充油而下降，若降幅>5%需补加至目标刻度',
              '静置15分钟使油液中微小气泡自然消散',
              '检查油箱底部放油堵有无渗漏，用干净纸巾擦拭确认无油渍'
            ], time: '' },
            { title: '功能验证与记录', items: [
              '启动液压泵空载运行5分钟，观察系统压力建压至18~21MPa正常范围',
              '操作锚机正反转各1次（空载），确认动作顺畅无爬行、无异响',
              '记录加油量、油品批次、加油前后液位读数，更新液压油消耗台账',
              '清理现场，吸油纸和废弃手套按危废分类收集'
            ], time: '' }
          ] },
        { id: 'R2', title: '更换渗漏部位密封件/管接头修复', defaultFold: true, result: '', operator: '', time: '',
          steps: [
            { title: '安全隔离与泄压（LOTO程序）', items: [
              '停机液压泵并断开控制电源，配电板挂"有人工作禁止合闸"锁牌（LOCK-03）',
              '打开系统泄压阀释放管路残余压力，确认压力表归零（0 MPa）',
              '关闭泄漏点上下游截止阀，隔离维修管段',
              '在泄漏管段下方铺设接油盘和吸油棉，预估存油量约5~10L'
            ], time: '' },
            { title: '拆卸泄漏接头并取出旧密封件', items: [
              '用记号笔在法兰/接头配合面做装配对位标记，确保复装原位',
              '按对角顺序松开接头螺栓（先松1/4圈再逐颗拆下），防止应力骤释变形',
              '缓慢分离接头，用接油盘收集管内残油',
              '取出旧密封圈/垫片，检查变形/硬化/磨损状态并拍照留存',
              '用内窥镜或手电检查密封槽和管壁有无冲刷沟槽、腐蚀坑或裂纹'
            ], time: '' },
            { title: '清洁密封面与安装新密封件', items: [
              '用塑料刮刀清除密封槽内旧密封胶残留（严禁用金属工具刮伤密封面）',
              '用无水乙醇清洁密封槽和接头配合面，用无绒布擦干',
              '检查新密封圈型号（NBR丁腈橡胶，硬度Shore A 70±5），确认无缺陷',
              '在密封圈表面均匀涂抹一层液压油作润滑，按正确方向装入密封槽',
              '确认密封圈无扭曲、无翻边，完全贴合槽底'
            ], time: '' },
            { title: '复装紧固至规定力矩', items: [
              '按拆卸前的对位标记对准法兰/接头，装入定位销',
              '装入全部螺栓手拧到位后，用力矩扳手按对角顺序分3次紧固',
              '第一次：规定力矩的50%（约25Nm）；第二次：75%（约38Nm）；第三次：100%（50±2Nm）',
              '用力矩扳手复验全部螺栓，确认每颗均达标，无遗漏'
            ], time: '' },
            { title: '恢复运行与密封性验证', items: [
              '缓慢开启上游截止阀引入液压油，观察接头处有无外漏',
              '逐步升压至工作压力（18~21MPa），保压30分钟',
              '每5分钟用干净纸巾擦拭接头各密封面，确认无任何油渍渗出',
              '用紫外检漏灯照射接头（若加油时已加入荧光示踪剂），确认无荧光痕迹',
              '清理现场油渍，回收接油盘和吸油棉按危废处理'
            ], time: '' },
            { title: '24小时跟踪验证', items: [
              '维修后第2小时、第8小时、第24小时分别目视检查接头有无渗漏',
              '记录24小时内液压油位变化，正常应<2%（仅蒸发损耗）',
              '若24h内液位下降>5%，判定修复未达标，需重新拆检排查',
              '更新设备维修档案，记录更换部件型号、批次、力矩数据'
            ], time: '' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-26 11:30', stage: '确认', title: '船员上报异常', content: '锚机绞缆#1液压油位低至18%，低于警戒线30%。船员在例行巡检中发现液位异常并上报。', operator: '陈水手长' },
      { time: '2026-06-26 11:32', stage: '确认', title: '多传感器联合偏离检测触发', content: '液压油位传感器 z-score 超阈值（-4.2），同时电机电流呈上升趋势，系统自动生成排查方案。', operator: 'AI检测引擎' },
      { time: '2026-06-26 11:35', stage: '确认', title: 'AI分析报告已生成', content: '初步研判：疑似管路渗漏（置信度92%）。已自动生成排查方案 4 项、维修方案 2 项。', operator: 'AI检测引擎' },
      { time: '待操作', stage: '确认', title: '等待值班人员确认事件', content: '事件待确认，请确认后进入排查阶段。', operator: '系统' }
    ]
  },

  // ═══════════════════════════════════════════
  // EVT-0041: 发电机组 #1 输出频率偏高
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0041',
    title: '柴油发电机组 #1 输出频率偏高',
    systemPart: '辅机系统 / 发电机组',
    deviceId: 'DEV-003',
    deviceName: '柴油发电机组 #1',
    priority: 'medium',
    source: 'ai',
    status: 'processing',
    stageIndex: 1,
    createdAt: '2026-06-26 09:15',
    updatedAt: '2026-06-26 10:30',
    description: '1号柴油发电机组输出频率 60.2Hz，高于额定 60Hz 上限。需检查调速器及负荷分配。',
    progressSummary: '处理中：调速器参数检查完成，正在核对并联机组负荷分配',
    aiAnalysis: {
      verdict: 'suspected', confidence: 78,
      conclusion: '频率轻微偏高，疑似调速器增益偏大或并联机组负荷分配不均',
      conclusionDetail: '**疑似异常（置信度 78%）**\n\n**现象描述**：Wärtsilä 6L20 柴油发电机组#1 输出频率稳定在 **60.2Hz**，超出额定值 +0.2Hz（允许偏差 ±0.15Hz/±0.25%）。当前输出功率 580kW，负载率 72.5%，属中等负荷区间。\n\n**数据快照**：\n- 输出频率：60.2Hz（额定 60Hz，偏差 +0.33%）\n- 输出功率：580kW（额定 800kW）\n- 机房温度：76.8℃，接近报警阈值 80℃\n- 并联运行的#2机组频率 60.0Hz 正常\n\n**建议**：\n1. **立即检查**：核对调速器 PID 参数设定（特别是 P 增益是否偏大）\n2. **短期跟进**：检查并联机组间有功功率分配是否均衡（偏差应 <5%）\n3. **中长期**：考虑升级电子调速器为数字式以获得更精确的频率控制',
      faultTable: [
        { candidate: '调速器PID增益偏大', reason: '调速器对转速偏差反应过于灵敏，导致超调振荡', consequence: '频率在 59.8~60.3 Hz 之间波动，影响供电质量', probability: '高' },
        { candidate: '并联机组负荷分配不均', reason: '#1机组承担了过多有功负荷，导致转速下垂偏移', consequence: '长期运行将加剧#1机组磨损，#2机组轻载效率低下', probability: '中' },
        { candidate: '调速器执行机构卡涩', reason: '机械式调速器连杆机构存在摩擦阻力增大', consequence: '调速响应滞后或不均匀', probability: '低' },
        { candidate: '燃油齿条反馈信号漂移', reason: '位置传感器线性度衰减或接线接触不良', consequence: '调速器收到错误的负荷反馈，做出错误调整', probability: '低' }
      ],
      dataCards: [
        { name: 'S11-输出频率（核心监控）', meta: '30个采样点 · 近6h趋势 · 额定 60.0±0.15Hz', value: '稳态值 <strong>60.18~60.22Hz</strong>，均值 60.19Hz。始终位于上限区域(+0.2~+0.35%)，无波动收敛迹象', verdict: '偏高 — 超出允许偏差+0.15Hz的上限', verdictType: 'warning' },
        { name: '输出有功功率', meta: '30个采样点 · 额定容量 800kW', value: '当前 <strong>580kW</strong>（负载率 72.5%），近3h内波动范围 ±25kW', verdict: '正常 — 负荷稳定，无突变', verdictType: 'normal' },
        { name: '发电机机舱温度', meta: '30个采样点 · 报警阈值 80℃', value: '值域 <strong>74~78℃</strong>，均值 76.8℃。较昨日同工况升高约3℃', verdict: '注意 — 接近高温报警线，需关注冷却风道', verdictType: 'warning' },
        { name: '#2机组对比频率', meta: '30个采样点 · 同步采集', value: '#2机组稳态 <strong>60.0~60.03Hz</strong>，与#1机组存在 <strong>0.15~0.2Hz</strong> 的固定频差', verdict: '差异显著 — 两机组频率不一致说明存在系统性偏差', verdictType: 'danger' }
      ],
      suggestionsList: [
        '立即读取调速器当前 PID 参数记录，与出厂设定值逐项比对',
        '测量两台发电机的有功功率分配比例，目标偏差控制在 5% 以内',
        '检查调速器连杆机构活动自由度，加注适量润滑油',
        '校验燃油齿条位置传感器输出电压（标准 0-5V 或 4-20mA）',
        '若调整无效，考虑切换至备用调速控制单元进行 A/B 对比测试'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">柴油发电机组频率由原动机转速决定：f = (n × p) / 120（n=转速rpm，p=极对数）。对于 6L20 四冲程柴油机配 12 极发电机，额定 500rpm 对应 50Hz / 600rpm 对应 60Hz。调速器通过感知转速偏差来调节燃油齿条位置，维持恒速运行。</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">频率偏高的可能机制链路：</strong></p><p style="margin-bottom:4px">· 调速器P增益过大 → 转速偏差放大 → 燃油供给过量 → 转速超调至 >600rpm</p><p style="margin-bottom:4px">· 并联负荷不均 → 单机承担更多功 → 下垂特性使转速上升 → 频率偏高</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次分析：</strong>#1机组频率系统性偏高而#2正常，且偏差稳定不变，排除了电网频率整体漂移的可能。问题大概率出在#1机组自身的调速特性或负荷分配策略上。</p>',
        matches: [
          { fault: '调速器PID整定不当', match: '高匹配', cls: 'high', reason: '频率系统性偏高而非随机波动，符合参数失调特征' },
          { fault: '并联负荷分配失衡', match: '部分匹配', cls: 'medium', reason: '可解释频率偏高，但不能解释为何偏差如此稳定不变' },
          { fault: '调速器执行机构故障', match: '低匹配', cls: 'low', reason: '执行机构故障通常表现为频率波动或不规则跳动，非稳定偏高' },
          { fault: '传感器漂移', match: '待排除', cls: 'pending', reason: '需用高精度频率表交叉验证测量值' }
        ]
      },
      trendData: { seriesName: '输出频率', yUnit: 'Hz', yMin: 59.7, yMax: 60.5, times: ['06-26 04:00','06-26 07:00','06-26 09:00','06-26 10:00','06-26 10:30'], values: [60.05,60.12,60.18,60.20,60.21] },
      relatedCases: [
        { title: '辅机频率偏高·调速器PID增益过大', match: 91, solution: '将P增益从3.2下调至2.3，I时间从0.8s调至1.2s，频率恢复至60.00~60.05Hz' },
        { title: '并联机组负荷分配不均致频率漂移', match: 76, solution: '调整有功功率分配增益，并联工况下功率偏差收敛至3%以内' },
        { title: '频率传感器漂移·电压互感器异常', match: 38, solution: '校准PT二次回路，更换老化TV保险后频率读数恢复正常' }
      ],
      autoActions: [
        'AI检测输出频率持续超60.15Hz（06-26 10:00）→ 自动创建检修任务（06-26 10:01）',
        '自动关联GEN_FREQ频率传感器趋势数据和负荷分配历史（06-26 10:02）',
        '已检索到3条相似历史案例，调速器参数异常匹配度91%（06-26 10:03）',
        '推送至轮机长终端，建议靠港后安排调速器参数整定（06-26 10:05）'
      ]
    },
    todos: {
      inspections: [
        { id: 'T1', title: '读取并记录调速器 PID 参数', defaultFold: false, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '连接调速器参数读取接口', items: [
              '通过 RS485/USB 连接调速器控制面板',
              '调出 PID 参数设定页面',
              '确认通信连接稳定无丢包'
            ], time: '' },
            { title: '记录当前 P/I/D 参数值', items: [
              '记录比例增益(P)、积分时间(I)、微分时间(D)',
              '与出厂推荐值（P:2.0~2.5, I:1.0~1.5s）逐项对比',
              '记录参数修改历史日志',
              '截图保存当前参数设定页面'
            ], time: '' },
            { title: '检查转速下垂率设定', items: [
              '读取 Droop 设定值（推荐 3~5%）',
              '判断下垂特性是否偏离合理范围',
              '检查有无 Isochronous（等同步）模式误设定'
            ], time: '' },
            { title: '检查增益调度（Gain Scheduling）', items: [
              '查看不同负荷段的增益是否合理',
              '确认高低负荷切换时参数有无异常跳变',
              '记录额定负荷点参数值'
            ], time: '' },
            { title: '读取转速偏差死区设定', items: [
              '确认转速偏差死区（Dead Band）设定值',
              '评估死区是否过大导致频率偏离不响应',
              '正常推荐设定 ±0.05Hz'
            ], time: '' }
          ] },
        { id: 'T2', title: '测量两台发电机有功功率分配', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '准备功率分析仪', items: [
              '在三相输出端接入钳形功率表',
              '确认电压/电流互感器变比设置正确',
              '验证仪器精度等级满足测量要求',
              '检查测试线夹绝缘完好'
            ], time: '' },
            { title: '同步采集两台机组功率', items: [
              '在并联运行工况下读取#1和#2机组有功功率',
              '计算功率分配偏差百分比（目标 <5%）',
              '记录电压/电流/功率因数等完整参数',
              '同步采集无功功率分配情况'
            ], time: '' },
            { title: '记录负荷变化时动态响应', items: [
              '人为增减负荷记录功率转移过程',
              '评估负荷分配的动态稳定性和响应速度',
              '记录功率振荡恢复时间（应<5s）',
              '观察有无功率周期性摆动现象'
            ], time: '' },
            { title: '检查负荷分配控制器参数', items: [
              '读取负荷分配器（Load Sharing Unit）增益设定',
              '检查有无主从设定错误',
              '确认通信总线连接是否可靠'
            ], time: '' },
            { title: '对比历史并联运行数据', items: [
              '调取近30天并联运行日志',
              '对比功率分配偏差趋势变化',
              '判断偏差是渐进恶化还是突发'
            ], time: '' }
          ] },
        { id: 'T3', title: '检查调速器连杆机构状态', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '目视检查连杆有无变形/松动', items: [
              '检查各连接销、开口销有无断裂缺失',
              '观察连杆在全程动作中有无干涉/卡滞',
              '检查连杆表面有无锈蚀/裂纹',
              '检查锁紧螺母有无松动退扣'
            ], time: '' },
            { title: '检查铰接点润滑状态', items: [
              '在铰接销处加注适量润滑油',
              '手动推动燃油齿条确认运动顺滑',
              '检查油嘴/油杯有无堵塞',
              '确认润滑脂颜色正常无干涸'
            ], time: '' },
            { title: '检查回位弹簧张力', items: [
              '对比弹簧外观有无变形/锈蚀/断裂',
              '手动拉拽测试回位力是否正常',
              '测量弹簧自由长度对比规格值',
              '检查弹簧两端固定座有无磨损'
            ], time: '' },
            { title: '检查连杆全程动作灵活性', items: [
              '手动推动连杆从零位到满行程往复3次',
              '感受全程有无死区/卡顿/异响',
              '检查行程终点限位是否到位'
            ], time: '' }
          ] },
        { id: 'T4', title: '校验燃油齿条位置传感器', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '测量传感器输出信号', items: [
              '在全行程范围内读取传感器电压/电流输出',
              '绘制行程-输出曲线判断线性度',
              '检查零点和满量程标定值是否准确',
              '记录非线性偏差最大点位置'
            ], time: '' },
            { title: '检查传感器机械安装', items: [
              '确认传感器与齿条的连接刚性无松动',
              '检查拉杆/推杆行程有无死区',
              '确认安装支架无变形/裂纹',
              '检查传感器防护罩密封是否完好'
            ], time: '' },
            { title: '交叉验证传感器精度', items: [
              '用标准位移传感器或量块对比标定',
              '在25%/50%/75%/100%四个关键点逐一校验',
              '若偏差>2%需更换或重新标定',
              '记录校验前后的偏差值'
            ], time: '' },
            { title: '检查传感器电气连接', items: [
              '检查传感器接插件有无腐蚀/松动',
              '测量信号线缆有无断路/短路',
              '检查屏蔽层接地是否可靠'
            ], time: '' }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '重新整定调速器 PID 参数', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '安全准备与参数备份', items: [
              '确认发电机组处于停机状态，调速器控制电源已断开',
              '连接调速器编程器（伍德 ward PGA 或电子调速器专用接口），读取当前全部参数',
              '记录修改前原始参数清单（P增益=3.2，I时间=0.8s，D时间=0s，死区=0.05Hz）',
              '将原始参数导出备份至U盘和轮机日志双重保存'
            ], time: '' },
            { title: '调整PID参数设定值', items: [
              '将P增益（比例带）从3.2下调至2.3（厂家推荐范围2.0~2.5的中值）',
              '将I时间（积分时间）从0.8s上调至1.2s（降低积分超调）',
              'D时间（微分时间）保持0s不变（柴油机系统一般不启用微分）',
              '保持死区0.05Hz不变，输入参数后保存写入调速器EEPROM'
            ], time: '' },
            { title: '空载阶跃响应测试', items: [
              '启动发电机组至额定转速1500rpm空载运行，确认频率稳定在60.0±0.1Hz',
              '通过编程器施加±5%转速阶跃信号（模拟负荷突变），记录频率响应曲线',
              '评估超调量（目标<2%即<1.2Hz）、稳定时间（目标<5s回到±0.1Hz内）',
              '若超调量>2%需进一步降低P增益，若响应过慢需适当增大P增益'
            ], time: '' },
            { title: '逐级负载工况验证', items: [
              '在25%负荷下运行10min，记录频率波动范围（目标60.0±0.05Hz）',
              '在50%负荷下运行10min，记录频率恢复时间和稳态偏差',
              '在75%负荷下运行10min，模拟突加/突卸25%负荷观察动态响应',
              '在100%负荷下运行10min，确认频率偏差收敛至±0.05Hz以内',
              '各级工况数据均合格后，将最终参数锁定并加铅封'
            ], time: '' },
            { title: '记录归档与通知', items: [
              '填写《调速器参数整定记录表》，附阶跃响应曲线和各级负荷数据',
              '更新设备维护档案，记录整定前后参数对比',
              '通知值班轮机员新参数已生效，需观察24h运行趋势',
              '24h后复查频率趋势曲线，确认整定效果持续稳定'
            ], time: '' }
          ] },
        { id: 'R2', title: '调整并联机组负荷分配设定', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '并联运行数据采集', items: [
              '将#1和#2发电机组并车运行，总负荷稳定在1000~1200kW区间',
              '记录两台机组各自的有功功率（kW）、无功功率（kVAr）、功率因数（cosφ）',
              '计算有功分配偏差：（#1功率-#2功率）/平均功率×100%，当前偏差约8%',
              '记录两台机组的频率差和电压差，作为调整基准数据'
            ], time: '' },
            { title: '修改负荷分配控制器参数', items: [
              '进入负荷分配控制器（LSG-2或DEIF同类产品）参数菜单',
              '调整有功功率分配增益（Droop增益）从默认值逐步增大至推荐值',
              '设定无功分配下垂特性补偿（Voltage Droop），确保无功均衡分配',
              '保存参数后退出菜单，恢复控制器至正常运行模式'
            ], time: '' },
            { title: '并联工况下验证分配均衡性', items: [
              '在总负荷50%（约550kW）工况下测量功率分配偏差，目标<3%',
              '在总负荷75%（约825kW）工况下测量，模拟突加100kW负荷观察动态分配',
              '在总负荷100%（约1100kW）工况下连续运行30min，每5min记录分配数据',
              '确认各负荷工况下有功分配偏差持续稳定在5%以内，无功偏差<10%'
            ], time: '' },
            { title: '记录归档与长期跟踪', items: [
              '保存最终参数到控制器内存，导出参数清单备份',
              '更新并联运行设定档案，标注调整原因和效果数据',
              '安排连续7天每日记录并联运行负荷分配趋势',
              '7天后评估数据，若偏差仍>3%需联系厂家技术支持'
            ], time: '' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-26 09:15', stage: '确认', title: 'AI检测引擎产出异常事件', content: 'S11 输出频率 60.2Hz 持续超过 15min 偏高，自动创建事件。', operator: 'AI检测引擎' },
      { time: '2026-06-26 09:45', stage: '确认', title: '事件已确认，进入排查阶段', content: '值班轮机员确认为实，频率确实偏高，开始排查。', operator: '王轮机长' },
      { time: '2026-06-26 10:15', stage: '排查', title: '排查方案T1：调速器PID参数读取', content: 'P增益 3.2（推荐值 2.0~2.5），I时间 0.8s（推荐 1.0~1.5s）。判定异常，P增益偏大。', operator: '李轮机员' },
      { time: '2026-06-26 10:30', stage: '排查', title: '排查方案T2：负荷分配测量中', content: '正在进行双机组有功功率对比测量，初步发现#1机组承担负荷偏高约8%。', operator: '李轮机员' },
      { time: '待操作', stage: '排查', title: 'T3/T4 排查项待执行', content: '连杆机构检查(T3)、齿条传感器校验(T4)尚未执行。', operator: '系统' }
    ]
  },

  // ═══════════════════════════════════════════
  // EVT-0040: 燃油阀门组 #3 内漏处理
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0040',
    title: '燃油阀门组 #3 内漏处理',
    systemPart: '阀门管系 / 燃油阀门组',
    deviceId: 'DEV-009',
    deviceName: '燃油阀门组 #3',
    priority: 'medium',
    source: 'inspection',
    status: 'processing',
    stageIndex: 1,
    createdAt: '2026-06-25 16:40',
    updatedAt: '2026-06-26 09:00',
    description: '日常巡检发现燃油阀门组 #3 存在轻微内漏（泄漏率 0.08%）。已拆卸检查阀座密封，更换密封圈中。',
    progressSummary: '处理中：阀座密封圈更换中，预计今日完成复装',
    aiAnalysis: {
      verdict: 'confirmed', confidence: 96,
      conclusion: '阀门内漏确诊，源于阀座密封圈长期磨损变形',
      conclusionDetail: '**故障确认（置信度 96%）**\n\n**现象描述**：DBV-200 型燃油阀门组#3 经超声波泄漏检测仪确认存在内部泄漏。泄漏率实测 **0.08%**，超出允许标准 **≤0.05%**。拆卸后发现阀座密封圈表面有明显压痕和不均匀磨损，局部已失去弹性。\n\n**数据快照**：\n- 泄漏率：0.08%（超标 60%，标准 ≤0.05%）\n- 阀门开度：72%（正常运行开度）\n- 阀门本体温度：48.6℃（正常范围）\n- 该阀门累计运行 38,900 小时，距上次更换密封件已超过 2 年\n\n**建议**：\n1. **立即处理**：更换全套密封圈组件（阀座+阀芯+填料函）\n2. **短期跟进**：复装后进行 0.5h 保压测试，确认泄漏率 ≤0.02%\n3. **中长期**：将该型号阀门纳入年度预防性更换计划',
      faultTable: [
        { candidate: '密封圈磨损老化', reason: '38,900小时运行导致橡胶材料硬化和压缩永久变形', consequence: '密封面间隙增大，内漏率逐步攀升至超标', probability: '高' },
        { candidate: '阀座/阀芯配合面损伤', reason: '流体冲刷侵蚀或异物划伤金属密封面', consequence: '即使更换密封圈也无法彻底消除泄漏', probability: '中' },
        { candidate: '操作扭矩不足', reason: '关闭时未达到规定的锁紧力矩', consequence: '密封力不够导致微量泄漏', probability: '低' }
      ],
      dataCards: [
        { name: 'S13-阀门泄漏率（核心指标）', meta: '15个采样点 · 近24h监测 · 标准 ≤0.05%', value: '当前 <strong>0.08%</strong>，24h前为 0.06%。呈<strong>缓慢上升趋势</strong>（+0.01%/日）', verdict: '超标 — 超出允许限值 60%', verdictType: 'danger' },
        { name: '阀门开度', meta: '实时采集 · 全行程 0~100%', value: '当前开度 <strong>72%</strong>，处于常用工作区间。全关/全开测试正常', verdict: '正常 — 执行机构动作无卡滞', verdictType: 'normal' },
        { name: '阀门本体温度', meta: '红外测温 · 允许范围 10~80℃', value: '值域 <strong>45~49℃</strong>，均值 48.6℃。与环境温差正常', verdict: '正常 — 无异常温升迹象', verdictType: 'normal' },
        { name: '设备累计运行时长', meta: '来自设备台账', value: '总运行 <strong>38,900 小时</strong>，上次保养 2026-01-20（<strong>156天前</strong>）', verdict: '注意 — 接近密封件推荐更换周期（2年/18,000h）', verdictType: 'warning' }
      ],
      suggestionsList: [
        '立即更换阀座密封圈（选用氟橡胶材质 FKM/Viton，耐燃油腐蚀）',
        '同步检查阀芯密封面是否有划痕或点蚀，必要时研磨修复',
        '复装后用超声波泄漏检测仪进行定量检测（目标 ≤0.02%）',
        '保压测试 0.5h，压力为 1.5 倍工作压力',
        '更新设备维护台账，将此阀门列入年度预防性更换清单'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">DBV-200 截止阀采用软密封结构：阀座嵌有橡胶密封圈，阀芯下行时压紧密封圈形成密封副。燃油系统中该阀门用于切断/调节燃油通路流量，要求零泄漏以保证系统安全性和环保合规。</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">密封失效机理：</strong></p><p style="margin-bottom:4px">· 长期压缩 → 橡胶发生压缩永久变形（压缩形变率可达 15~25%）→ 回弹力下降</p><p style="margin-bottom:4px">· 燃油浸泡 → 橡胶溶胀/硬化（取决于材料相容性）→ 弹性模量变化</p><p style="margin-bottom:4px">· 温度循环 → 热胀冷缩反复应力 → 密封面产生微裂纹</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次分析：</strong>38,900小时运行+超期未换装，磨损老化是主因。拆卸发现的压痕形态与长期静压载荷下的压缩蠕变一致。</p>',
        matches: [
          { fault: '密封圈自然磨损老化', match: '高匹配', cls: 'high', reason: '运行时长和更换周期均指向此原因；拆卸观察结果直接证实' },
          { fault: '阀座/阀芯金属面损伤', match: '部分匹配', cls: 'medium', reason: '可作为辅助因素加重泄漏程度，但非主要原因' },
          { fault: '安装/操作不当', match: '低匹配', cls: 'low', reason: '该阀门自投运以来无操作事故记录' }
        ]
      },
      trendData: { seriesName: '泄漏率', yUnit: '%', yMin: 0, yMax: 0.12, times: ['06-23 08:00','06-24 08:00','06-25 08:00','06-25 16:40','06-26 09:00'], values: [0.04,0.05,0.065,0.08,0.08] },
      relatedCases: [
        { title: '燃油阀内漏·阀座密封圈老化变形', match: 95, solution: '更换FKM材质密封圈组件，保压30min压降为0，泄漏率降至0.01%以下' },
        { title: '阀门内漏·阀芯冲刷沟槽', match: 68, solution: '研磨阀芯密封面修复冲刷沟槽，超声波检测合格后复装' },
        { title: '阀门微漏·填料函压盖松动', match: 42, solution: '按对角顺序紧固填料压盖螺栓至规定力矩，泄漏消除' }
      ],
      autoActions: [
        'AI检测燃油阀泄漏率超0.05%阈值（06-25 08:00）→ 自动创建检修任务（06-25 08:02）',
        '自动关联V-FV-03阀门泄漏率趋势和保压测试记录（06-25 08:03）',
        '已检索到3条相似历史案例，密封圈老化变形匹配度95%（06-25 08:05）',
        '推送至大管轮终端，建议下次靠港安排阀门解体检修（06-25 08:08）'
      ]
    },
    todos: {
      inspections: [
        { id: 'T1', title: '拆卸阀门检查阀座密封状态', defaultFold: true, result: 'abnormal', detail: '密封圈磨损明显，局部硬化失去弹性', operator: '赵机工', time: '2026-06-25 17:20',
          steps: [
            { title: '隔离阀门并泄压', items: [
              '关闭上下游截止阀隔离目标阀门',
              '打开旁通泄压阀释放管内残余压力',
              '确认压力表归零后再作业',
              '在阀门操作手轮悬挂"禁止操作"警示牌'
            ], time: '2026-06-25 17:00' },
            { title: '拆卸阀盖取出阀芯组件', items: [
              '按对角顺序分3次松开阀盖螺栓',
              '记录拆卸前螺栓力矩值',
              '取出阀芯和阀座密封圈总成',
              '检查阀体内部腔室有无异物/积垢'
            ], time: '2026-06-25 17:10' },
            { title: '检查密封圈表面状态', items: [
              '目视检查密封圈有无压痕/裂纹/变形',
              '用手指按压测试弹性判断硬化程度',
              '测量密封圈截面直径对比规格值',
              '检查密封圈表面有无化学腐蚀痕迹',
              '记录密封圈规格型号和磨损形态',
              '拍照存档密封圈磨损状态'
            ], time: '2026-06-25 17:20', hasImages: true },
            { title: '检查阀座密封槽状态', items: [
              '检查密封槽有无腐蚀/损伤/变形',
              '测量密封槽深度和宽度对比规格值',
              '检查槽底圆角处有无应力裂纹',
              '评估密封槽是否需要修复'
            ], time: '2026-06-25 17:25' }
          ] },
        { id: 'T2', title: '检查阀芯密封面有无划痕', defaultFold: true, result: 'normal', detail: '阀芯密封面完好，无需研磨', operator: '赵机工', time: '2026-06-25 17:35',
          steps: [
            { title: '清洁阀芯密封面', items: [
              '用溶剂清除密封面油污和杂质',
              '用无尘布擦干便于观察',
              '检查密封面有无嵌入硬质颗粒'
            ], time: '2026-06-25 17:30' },
            { title: '目视+红丹检查密封面', items: [
              '在光照下旋转观察密封面有无划痕/点蚀',
              '涂抹红丹粉检查接触印痕是否均匀连续',
              '检查密封面宽度是否均匀一致',
              '用刀口尺检查密封面平面度'
            ], time: '2026-06-25 17:35' },
            { title: '评估是否需要研磨修复', items: [
              '若印痕不均或存在深划痕则需研磨',
              '评估研磨量是否在允许范围内（≤0.1mm）',
              '本次检查密封面完好判定无需研磨',
              '记录密封面状态评估结论'
            ], time: '2026-06-25 17:35' },
            { title: '检查阀芯导向部位', items: [
              '检查阀芯导向筋/导向套磨损状态',
              '确认阀芯上下运动无卡滞',
              '检查导向间隙是否在允许范围'
            ], time: '2026-06-25 17:40' }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '更换全套密封圈组件（阀座+填料函）', defaultFold: false, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '安全隔离与系统泄压', items: [
              '关闭阀门上下游截止阀，确认阀门前后压差表归零（0 bar）',
              '打开阀体泄放阀排空内部残余燃油，用接油盘收集（预估2~5L）',
              '断开阀门电动执行器电源，万用表验电确认0V，挂"禁止操作"锁牌（LOCK-12）',
              '准备防爆工具套装（铜合金扳手/螺丝刀）、FKM密封备件包、清洁套装'
            ], time: '' },
            { title: '拆卸阀盖与阀芯组件', items: [
              '用记号笔在阀盖与阀体配合面打对位标记，确保复装原位',
              '按对角顺序分3次松开阀盖螺栓（M16×8颗），第一次松1/4圈、第二次松1/2圈、第三次完全拆下',
              '用专用拉拔器缓慢拔出阀盖组件，避免阀芯密封面碰撞阀体',
              '取出阀芯、阀座组件，检查金属密封面有无冲刷沟槽/点蚀/裂纹',
              '对旧密封圈拍照存档，标注磨损位置和变形程度'
            ], time: '' },
            { title: '清洁阀体密封槽与检查配合面', items: [
              '用塑料刮刀清除阀体密封槽内旧密封胶和密封圈残留物（严禁金属工具）',
              '用无水乙醇彻底清洁密封槽、阀芯密封面、阀座锥面',
              '用手电筒+内窥镜检查密封槽有无腐蚀坑、冲刷沟槽，深度>0.2mm需研磨修复',
              '检查阀芯锥面接触带宽度和均匀性，正常应为连续环形亮带'
            ], time: '' },
            { title: '安装新密封圈组件', items: [
              '核对FKM密封圈型号（DBV-200专用，内径Φ80mm×截面Φ5mm），测量实际尺寸确认',
              '在密封圈表面均匀涂抹硅酮润滑脂（严禁用矿物油，会溶胀FKM）',
              '按正确方向（注意V形开口朝向压力侧）装入密封槽，确认无扭曲翻边',
              '同时更换填料函中的石墨填料环（3圈），每圈切口错开120°安装',
              '装入阀芯组件对准定位销，手动压紧确认密封圈均匀受压'
            ], time: '' },
            { title: '复装阀盖并按规定力矩紧固', items: [
              '按拆卸前的对位标记装入阀盖，穿入全部8颗M16螺栓手拧到位',
              '用力矩扳手按对角顺序分3次紧固螺栓',
              '第一次：规定力矩50%（约40Nm）；第二次：80%（约64Nm）；第三次：100%（80±3Nm）',
              '全部螺栓紧固后，用力矩扳手逐颗复验确认达标无遗漏',
              '检查阀杆转动灵活性，手动开关阀门3次确认无卡涩'
            ], time: '' }
          ] },
        { id: 'R2', title: '复装后保压测试 + 泄漏检测', defaultFold: true, result: null, detail: '', operator: '' , time: '',
          steps: [
            { title: '恢复管路通路并初始充压', items: [
              '缓慢开启上游截止阀引入燃油，初始压力0.2MPa低压检漏',
              '用干净纸巾擦拭阀体各密封面、法兰接头，确认无外漏',
              '逐步升压：0.5MPa→1.0MPa→工作压力（1.5MPa），每级保持2min观察',
              '继续升压至1.5倍工作压力（2.25MPa）进行强度试验'
            ], time: '' },
            { title: '保压30分钟观测', items: [
              '关闭两端截止阀隔离阀门，记录初始压力值和油温',
              '保压30min，每5min记录压力表读数和温度（温度波动需修正压降）',
              '合格标准：30min压降≤0.02MPa（考虑温度修正后）',
              '若压降超标，用肥皂液检查外部密封点定位泄漏源'
            ], time: '' },
            { title: '超声波内漏检测', items: [
              '用超声波泄漏检测仪（SDT270或同类）在阀门上下游管壁上检测',
              '上游传感器发射超声波信号，下游传感器接收，对比信号衰减量',
              '计算内漏率：目标≤0.02%（较维修前0.08%降低75%以上）',
              '记录检测频谱图和泄漏率数据，作为验收依据'
            ], time: '' },
            { title: '功能测试与出具报告', items: [
              '电动操作阀门全开/全关3次，验证执行器动作正常、阀位反馈准确',
              '在75%开度工况下运行1h，复测内漏率确认稳定达标',
              '出具《阀门维修保压测试报告》，附压力曲线图和泄漏率检测数据',
              '检测全部合格后，恢复阀门投运，更新阀门维护台账'
            ], time: '' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-25 16:40', stage: '确认', title: '巡检发现阀门内漏', content: '赵机工巡检时用超声波检测仪测得阀门#3泄漏率 0.08%，超出标准。', operator: '赵机工' },
      { time: '2026-06-25 17:00', stage: '确认', title: '事件已确认，进入排查阶段', content: '王轮机长确认为真实泄漏，安排拆检。状态变更为"处理中"。', operator: '王轮机长' },
      { time: '2026-06-25 17:20', stage: '排查', title: '拆卸检查 — 标记异常', content: '密封圈磨损明显，判定异常。阀芯密封面检查正常。', operator: '赵机工' },
      { time: '2026-06-26 09:00', stage: '维修', title: '密封圈更换作业进行中', content: '新密封圈到货，正在更换作业。预计今日完成复装和保压测试。', operator: '赵机工' }
    ]
  },

  // ═══════════════════════════════════════════
  // EVT-0039: 压载水泵 #1 启动测试
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0039',
    title: '压载水泵 #1 启动测试',
    systemPart: '泵类设备 / 压载水泵',
    deviceId: 'DEV-006',
    deviceName: '压载水泵 #1',
    priority: 'low',
    source: 'inspection',
    status: 'resolved',
    stageIndex: 2,
    createdAt: '2026-06-24 14:00',
    updatedAt: '2026-06-25 10:00',
    description: '压载水泵 #1 完成机械密封更换后启动测试，验证检修质量。',
    progressSummary: '已解决：空载+负载测试全部通过，设备恢复正常',
    aiAnalysis: {
      verdict: 'normal', confidence: 95,
      conclusion: '检修后启动测试全部通过，设备状态恢复至正常水平',
      conclusionDetail: '**正常（置信度 95%）**\n\n**测试概况**：FRAMO 型压载水泵#1 于 2026-06-23 完成机械密封更换，按计划于 06-24 进行启动验收测试。测试分两个阶段：空载运行 30min + 负载运行 60min。\n\n**数据快照**：\n- 空载运行：电流 28A（额定 42A 的 67%），振动 1.8mm/s，温度 34℃\n- 负载运行：流量 1100m³/h（额定 92%），振动 2.6mm/s，出口压力 0.28MPa\n- 机械密封泄漏量：< 2滴/min（标准 ≤ 3滴/min）✓\n- 运行噪声：78dB(A)（背景 72dB），无明显异响 ✓\n\n**结论**：各项指标均在正常范围内，机械密封更换质量合格，设备可以投入使用。',
      faultTable: [],
      dataCards: [
        { name: '空载运行测试', meta: '30min 稳态运行 · 2026-06-24 14:30~15:00', value: '电流 <strong>28A</strong>(67%额定) · 振动 <strong>1.8mm/s</strong> · 温度 <strong>34℃</strong> · 无异响', verdict: '正常 — 所有指标优良', verdictType: 'normal' },
        { name: '负载运行测试', meta: '60min 稳态运行 · 2026-06-24 15:10~16:10', value: '流量 <strong>1100m³/h</strong>(92%额定) · 出口压力 <strong>0.28MPa</strong> · 振动 <strong>2.6mm/s</strong>', verdict: '正常 — 达到设计性能', verdictType: 'normal' },
        { name: '机械密封状态', meta: '目视+滴漏计数', value: '泄漏量 < <strong>2滴/min</strong>（标准 ≤ 3滴/min）✓ 密封水冷却回路畅通', verdict: '合格 — 新密封工作状态良好', verdictType: 'normal' },
        { name: '振动频谱分析', meta: '便携式测振仪采集', value: '工频(1X)幅值 1.6mm/s 正常 · 未见轴承缺陷频率(2X/3X)成分 · 轴向振动 0.8mm/s', verdict: '正常 — 无不平衡/不对中/轴承故障征兆', verdictType: 'normal' }
      ],
      suggestionsList: [
        '投入正常运行，首周每日检查机械密封泄漏量和轴承温度',
        '一周后复查振动数据，建立新的基准线',
        '更新设备档案：机械密封更换日期 2026-06-23，供应商 XXX 型号',
        '下次计划性检修窗口建议安排在 2026-Q4（运行约 4000h 后）'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">FRAMO 压载水泵为卧式离心泵，机械密封是其唯一旋转动密封部件。本次更换的是单端面机械密封（型号 M3N-45），动静环材质分别为 SiC/碳石墨。机械密封失效模式通常包括：密封面磨损、辅助密封圈老化、弹簧疲劳等。</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">更换后验收要点：</strong></p><p style="margin-bottom:4px">· 空载跑合 — 检查密封初期磨合状态和温升曲线</p><p style="margin-bottom:4px">· 负载考核 — 在设计流量/扬程下验证性能参数和可靠性</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次结论：</strong>空载+负载双阶段测试数据一致表明新密封工作正常，振动频谱未见任何故障特征频率。检修质量合格。</p>',
        matches: []
      },
      trendData: { seriesName: '振动速度', yUnit: 'mm/s', yMin: 0, yMax: 4, times: ['06-24 14:30','06-24 14:40','06-24 14:50','06-24 15:00','06-24 15:30','06-24 16:00','06-24 16:10'], values: [1.5,1.7,1.8,1.6,2.4,2.6,2.5] },
      relatedCases: [
        { title: '离心泵检修后振动偏高·联轴器对中偏差', match: 85, solution: '激光对中仪重新找正，径向偏差降至0.05mm以内，振动恢复至1.8mm/s' },
        { title: '机械密封更换后泄漏·密封面划伤', match: 70, solution: '重新研磨静环密封面，更换二次密封O型圈，泄漏量降至2滴/min以内' },
        { title: '水泵带载振动异常·叶轮不平衡', match: 55, solution: '动平衡校正（G6.3级），配重3.2g后振动值降至2.0mm/s以下' }
      ],
      autoActions: [
        '系统自动创建密封更换验收任务（06-24 14:00）→ 排空测试通过（06-24 14:25）',
        '自动关联P-BP-01振动传感器和电流趋势数据（06-24 14:26）',
        'AI分析空载振动1.8mm/s属优良范围，带载振动2.5mm/s接近预警阈值（06-24 16:10）',
        '已检索到3条同类泵检修验收案例（06-24 16:12）'
      ]
    },
    todos: {
      inspections: [
        { id: 'T1', title: '检查机械密封安装质量', defaultFold: true, result: 'normal', detail: '密封安装到位，弹簧压缩量正确', operator: '李轮机员', time: '2026-06-24 14:15',
          steps: [
            { title: '核对密封型号和安装方向', items: [
              '确认机械密封型号 M3N-45 与泵匹配',
              '检查动静环安装方向正确（动环朝泵体侧）',
              '核对密封材质与输送介质兼容',
              '检查产品合格证和批次号'
            ], time: '2026-06-24 14:10' },
            { title: '测量弹簧压缩量', items: [
              '用游标卡尺测量密封弹簧压缩量',
              '对比手册规定值（12±0.5mm）确认合格',
              '检查弹簧两端面平行度',
              '记录实测压缩量数据'
            ], time: '2026-06-24 14:15' },
            { title: '检查辅助密封圈就位状态', items: [
              '确认O型圈完全嵌入密封槽内无扭曲',
              '检查密封面无异物污染',
              '检查O型圈有无过盈量异常',
              '确认O型圈材质与介质兼容'
            ], time: '2026-06-24 14:15' },
            { title: '检查密封冲洗管路', items: [
              '确认密封冲洗液（Plan 11/Plan 21）流量正常',
              '检查冲洗管路接头有无堵塞/泄漏',
              '确认过滤器（如有）压差正常'
            ], time: '2026-06-24 14:15' }
          ] },
        { id: 'T2', title: '检查轴承润滑状态', defaultFold: true, result: 'normal', detail: '润滑脂充足，轴承转动灵活无异响', operator: '李轮机员', time: '2026-06-24 14:20',
          steps: [
            { title: '检查润滑脂数量和颜色', items: [
              '打开轴承箱检查盖观察润滑脂充填量',
              '确认润滑脂颜色正常无发黑/乳化',
              '检查润滑脂稠度有无变化',
              '评估是否需要补充或更换'
            ], time: '2026-06-24 14:18' },
            { title: '手动盘车检查转动灵活性', items: [
              '用专用扳手盘车2~3圈',
              '感受有无卡滞/异响，判断轴承状态',
              '在不同角度停留感受有无偏心',
              '检查轴向窜动量是否在允许范围'
            ], time: '2026-06-24 14:20' },
            { title: '检查轴承箱油封', items: [
              '观察油封唇口有无磨损翻边',
              '确认油封处无润滑脂泄漏',
              '检查油封弹簧张力是否正常',
              '检查甩油环有无变形'
            ], time: '2026-06-24 14:20' },
            { title: '测量轴承游隙', items: [
              '用百分表测量轴承径向游隙',
              '对比新轴承游隙值评估磨损程度',
              '测量轴向游隙确认在允许范围',
              '记录测量数据供后续对比'
            ], time: '2026-06-24 14:20' }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '空载启动运行30分钟', defaultFold: true, result: 'normal', detail: '运行平稳，所有参数正常', operator: '李轮机员', time: '2026-06-24 15:00',
          steps: [
            { title: '启动前全面检查与准备', items: [
              '检查机械密封安装质量：密封面无划痕、弹簧压缩量均匀（压缩4±0.5mm）',
              '手动盘车3圈确认转动灵活无卡涩、无异常摩擦声',
              '检查地脚螺栓紧固力矩（M20×4颗，规定力矩350Nm），逐颗复验',
              '检查联轴器对中偏差：径向<0.05mm、端面<0.03mm（百分表测量）',
              '确认电气绝缘电阻：电机绕组对地≥50MΩ（500V兆欧表测量）'
            ], time: '2026-06-24 14:20' },
            { title: '开启冷却水与系统充液排气', items: [
              '打开机械密封冷却水阀门，确认冷却水流量≥2L/min（流量计指示）',
              '打开泵体排气阀，从吸入管缓慢引水充泵，排气至连续出水无气泡',
              '检查泵体各密封点有无渗漏，重点查看机械密封处（允许初始湿润）',
              '确认出口阀处于全关状态（空载启动条件）'
            ], time: '2026-06-24 14:25' },
            { title: '空载启动与运行监控', items: [
              '就地启动电机，记录启动电流峰值（应<额定电流6倍，持续<3s）',
              '空载运行30min，每5min记录运行参数数据表',
              '监测项：电机电流（目标<额定67%即28A）、泵体振动（目标<2.8mm/s）',
              '监测项：轴承温度（目标<65℃）、机械密封泄漏量（目标<3滴/min）',
              '用听诊棒检查泵体有无气蚀噪声、摩擦异响（高频嘶嘶声异常）'
            ], time: '2026-06-24 15:00' },
            { title: '空载运行参数评估', items: [
              '汇总30min运行数据，评估各项参数稳定性和趋势',
              '确认电流28A（额定67%）、振动1.8mm/s均在ISO 10816优良范围',
              '确认机械密封泄漏量<2滴/min，轴承温升<35K（室温+35℃以内）',
              '出具《空载运行测试记录》，判定合格后进入带载测试阶段'
            ], time: '2026-06-24 15:00' }
          ] },
        { id: 'R2', title: '带载运行测试60分钟', defaultFold: true, result: 'normal', detail: '流量、压力、振动均达标', operator: '李轮机员', time: '2026-06-24 16:10',
          steps: [
            { title: '缓慢加载与压力建立', items: [
              '缓慢开启出口阀（每开10%停5s），观察电流和出口压力同步上升',
              '加载至50%开度时暂停2min，检查泵体和管路有无异常振动',
              '继续加载至全开（100%），确认出口压力稳定在0.28±0.02MPa',
              '加载全过程中持续监控电流不超额定值42A'
            ], time: '2026-06-24 15:10' },
            { title: '稳态负载运行60min数据采集', items: [
              '维持额定流量工况（出口阀全开）连续运行60min，不得中断',
              '每10min记录一次完整数据组：流量、出口压力、进口压力、电流',
              '同时记录振动值（驱动端+非驱动端）、轴承温度、机械密封泄漏量',
              '用便携式流量计旁路确认实际流量1100m³/h（额定92%以上）'
            ], time: '2026-06-24 16:10' },
            { title: '振动频谱采集与分析', items: [
              '在驱动端和非驱动端轴承座上分别安装加速度传感器',
              '采集0~10kHz宽频振动频谱，采样时长≥30s',
              '分析1X（不平衡）、2X（不对中）、叶片通过频率（流体涡振）各分量',
              '确认无轴承缺陷特征频率（BPFI/BPFO）出现，评估轴承健康状态',
              '对比历史频谱基线，确认无明显劣化趋势'
            ], time: '2026-06-24 16:10' },
            { title: '停机后复查与验收', items: [
              '正常停机后立即测量轴承座温度（停机瞬间应为运行温度，<65℃合格）',
              '停机15min后复查机械密封泄漏量有无增大趋势',
              '检查泵体各密封面、地脚螺栓、联轴器有无松动或渗漏',
              '汇总空载+带载全部测试数据，出具《启动验收测试报告》',
              '报告经轮机长审核签字后归档，设备恢复正式服役'
            ], time: '2026-06-24 16:15' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-24 14:00', stage: '确认', title: '申请启动验收测试', content: '机械密封更换完成，申请按程序进行启动验收。', operator: '王轮机长' },
      { time: '2026-06-24 14:15', stage: '排查', title: '预检查 — 机械密封安装确认', content: '密封安装质量合格，判定正常。', operator: '李轮机员' },
      { time: '2026-06-24 15:00', stage: '维修', title: '空载测试完成', content: '30min 空载运行平稳，各项指标正常。', operator: '李轮机员' },
      { time: '2026-06-24 16:10', stage: '维修', title: '负载测试完成', content: '60min 带载运行达标：流量 1100m³/h，振动 2.6mm/s。', operator: '李轮机员' },
      { time: '2026-06-25 10:00', stage: '归档', title: '测试报告审批归档', content: '王轮机长审核通过，事件状态变更为"已解决"。设备恢复正常服役。', operator: '王轮机长' }
    ]
  },

  // ═══════════════════════════════════════════
  // EVT-0038: 应急消防泵月度保养
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0038',
    title: '应急消防泵月度保养',
    systemPart: '安全设备 / 消防系统',
    deviceId: 'DEV-008',
    deviceName: '应急消防泵',
    priority: 'low',
    source: 'inspection',
    status: 'resolved',
    stageIndex: 2,
    createdAt: '2026-06-20 09:00',
    updatedAt: '2026-06-20 11:00',
    description: '按 SMS 体系要求进行应急消防泵月度例行保养：润滑脂更换、滤网清洁、启动功能验证。',
    progressSummary: '已解决：月度保养完成，启动测试压力 0.8MPa 合格',
    aiAnalysis: {
      verdict: 'normal', confidence: 99,
      conclusion: '月度保养按计划执行完毕，设备功能正常',
      conclusionDetail: '**正常（置信度 99%）— 例行保养完成**\n\n**保养内容**：\n1. 更换电机前后轴承润滑脂（Shell Gadus S2 V100 2）\n2. 清洁海水吸入滤网（清除附着贝类和海藻）\n3. 检查机械密封泄漏量（1 滴/min，正常）\n4. 检查电气绝缘电阻（＞5MΩ，合格）\n5. 启动功能试验（手动/遥控/自动三种模式均成功）\n\n**测试数据**：\n- 启动压力：0.82 MPa（要求 ≥ 0.75 MPa）✓\n- 流量估算：约 180 m³/h（满足最低要求）\n- 运行电流：38A（额定 45A 的 84%）✓\n\n**结论**：应急消防泵各项功能正常，符合 SOLAS 公约和 SMS 体系要求。',
      faultTable: [],
      dataCards: [
        { name: '启动功能试验', meta: '三种启动模式验证 · 2026-06-20 10:30', value: '手动启动 <strong>✓</strong> · 遥控启动 <strong>✓</strong> · 自动(低压)启动 <strong>✓</strong> — 全部一次成功', verdict: '合格 — 三种模式均正常', verdictType: 'normal' },
        { name: '出水压力测试', meta: '两只消防栓同时出水', value: '稳定压力 <strong>0.82MPa</strong>（要求 ≥ 0.75MPa）· 两只消防栓出水射程 ≥ 12m', verdict: '合格 — 超过最低要求 9%', verdictType: 'normal' },
        { name: '电气安全检查', meta: '绝缘电阻 + 接地连续性', value: '绝缘 <strong>&gt; 5MΩ</strong> ✓ · 接地电阻 <strong>0.3Ω</strong> ✓ · 电缆外观无破损', verdict: '合格 — 电气安全指标全部达标', verdictType: 'normal' },
        { name: '机械状态检查', meta: '润滑/密封/滤网/联轴器', value: '润滑脂已更新 ✓ · 机械密封 1滴/min ✓ · 滤网已清洁 ✓ · 联轴器同心度正常 ✓', verdict: '合格 — 机械设备状态良好', verdictType: 'normal' }
      ],
      suggestionsList: [
        '下次月度保养时间：2026-07-20，请提前准备润滑脂和备用密封件',
        '建议在下一次坞修期间检查海水吸入阀门的止回功能',
        '本季度末（2026-Q3）安排一次全面拆检，重点检查叶轮和蜗壳状况'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">应急消防泵是船舶安全关键设备之一，SOLAS 公约要求其必须能够在船舶断电情况下（由应急配电板供电）独立运行。该泵通常为电动离心泵或柴油机驱动泵，要求能在最不利纵倾条件下从海底门吸水并维持规定压力。</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">月度保养要点：</strong></p><p style="margin-bottom:4px">· 保证随时可用性 — 月度试运转确认能可靠启动</p><p style="margin-bottom:4px">· 防止海生物堵塞 — 定期清洁海水滤网（港口水域尤甚）</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次结论：</strong>例保项目全部完成，功能试验通过。设备处于良好的可用状态。</p>',
        matches: []
      },
      trendData: { seriesName: '出水压力', yUnit: 'MPa', yMin: 0, yMax: 1.0, times: ['06-20 10:35','06-20 10:37','06-20 10:39','06-20 10:41','06-20 10:43','06-20 10:45'], values: [0,0.3,0.55,0.72,0.80,0.82] },
      relatedCases: [
        { title: '消防泵月度保养后启动失败·海底门未开启', match: 82, solution: '开启海底门阀门并排气，泵体连续出水无气泡，启动成功' },
        { title: '消防泵出水压力不足·叶轮磨损间隙过大', match: 65, solution: '更换叶轮和耐磨环，口环间隙调整至0.3mm，压力恢复至0.85MPa' },
        { title: '消防泵自动启动逻辑未触发·压力开关故障', match: 48, solution: '更换低压压力开关，模拟低压信号测试自动启动恢复正常' }
      ],
      autoActions: [
        '系统按月度保养计划自动生成保养工单（06-20 09:00）',
        '自动关联P-FP-01出水压力和海底门阀门状态数据（06-20 10:35）',
        'AI验证三模式启动（手动/遥控/自动）均一次成功，出水压力0.82MPa达标（06-20 10:45）',
        '已检索到3条消防泵保养验收案例（06-20 10:46）'
      ]
    },
    todos: {
      inspections: [
        { id: 'T1', title: '检查电机轴承及润滑脂状态', defaultFold: true, result: 'normal', detail: '润滑脂颜色深灰需更换，已完成', operator: '赵机工', time: '2026-06-20 09:30',
          steps: [
            { title: '打开轴承箱检查盖', items: [
              '拆卸前后轴承端盖',
              '观察润滑脂颜色、质地和充填量',
              '检查轴承箱内部有无进水痕迹',
              '检查甩油环状态'
            ], time: '2026-06-20 09:20' },
            { title: '评估润滑脂老化程度', items: [
              '正常润滑脂应为浅棕色均匀膏体',
              '本次检查颜色深灰有析油迹象，判定需更换',
              '检查有无金属碎屑混入',
              '取样送检确认油品劣化程度'
            ], time: '2026-06-20 09:30' },
            { title: '检查轴承游隙和外观', items: [
              '手动盘车感受轴承转动平顺性',
              '观察轴承滚珠/保持架外观有无锈蚀磨损',
              '测量轴承径向游隙对比规格值',
              '检查轴承外圈与箱体配合有无松动'
            ], time: '2026-06-20 09:30' },
            { title: '检查轴承箱密封', items: [
              '检查油封唇口有无硬化磨损',
              '检查轴承箱结合面密封垫状态',
              '确认油封处无润滑脂渗漏痕迹'
            ], time: '2026-06-20 09:30' }
          ] },
        { id: 'T2', title: '检查海水滤网清洁度', defaultFold: true, result: 'abnormal', detail: '滤网附有较多贝类和藻类，需清洁', operator: '赵机工', time: '2026-06-20 09:40',
          steps: [
            { title: '拆卸海水吸入滤器盖', items: [
              '关闭海底门阀门防止进水',
              '确认阀门完全关闭（检查阀杆位置指示）',
              '拆卸滤器盖取出滤芯组件',
              '准备接油盘收集残余积水'
            ], time: '2026-06-20 09:35' },
            { title: '评估滤网堵塞程度', items: [
              '目视检查滤网附着物种类和面积',
              '本次发现较多藤壶和藻类堵塞约40%通流面积',
              '评估堵塞对吸入流量的影响',
              '拍照记录堵塞状况'
            ], time: '2026-06-20 09:40' },
            { title: '检查滤网有无破损', items: [
              '逐段检查滤网有无破洞/变形',
              '检查滤网骨架有无腐蚀减薄',
              '检查密封垫片有无老化失效',
              '检查滤器壳体内壁防腐涂层状态'
            ], time: '2026-06-20 09:40' },
            { title: '检查海底门阀门状态', items: [
              '检查海底门格栅有无被异物堵塞',
              '确认海底门阀门开关灵活无卡滞',
              '检查阀门填料密封有无泄漏'
            ], time: '2026-06-20 09:40' }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '更换轴承润滑脂 + 清洁滤网', defaultFold: true, result: 'normal', detail: '润滑脂已更换，滤网已清洁晾干装回', operator: '赵机工', time: '2026-06-20 10:30',
          steps: [
            { title: '安全隔离与拆卸准备', items: [
              '确认应急消防泵控制电源已断开，配电板挂"有人工作"锁牌（LOCK-08）',
              '关闭海底门海水吸入阀，防止管路存水倒灌',
              '打开泵体底部泄放阀排空内部残余海水',
              '准备轴承润滑脂（Shell Gadus S2 V100 2）、无尘布、清洗溶剂（柴油）'
            ], time: '2026-06-20 09:35' },
            { title: '清除旧润滑脂与轴承检查', items: [
              '拆卸电机前后轴承端盖（M8螺栓×4颗/端），用接油盘收集废脂',
              '用无尘布擦除轴承内部发黑变质的旧润滑脂（颜色深灰，已氧化）',
              '用清洗溶剂（柴油）彻底冲洗轴承滚珠/滚道/保持架，至表面无残留',
              '检查轴承内外圈滚道、滚珠有无点蚀/裂纹/磨损（用手电+放大镜）',
              '手动盘车感受轴承游隙，确认无卡涩、无异响（沙沙声为缺脂正常）'
            ], time: '2026-06-20 09:45' },
            { title: '充填新润滑脂', items: [
              '确认润滑脂型号为 Shell Gadus S2 V100 2（NLGI 2号，锂基脂）',
              '用注脂枪向轴承滚珠间隙均匀充填，转动轴承确保脂均匀分布',
              '充填量为轴承腔容积的1/2~2/3（过满会导致散热不良和温升）',
              '在轴承端盖油封唇部涂抹薄层润滑脂，防止运转时干摩擦',
              '复装轴承端盖，螺栓对角拧紧确保端盖与轴承外圈均匀贴合'
            ], time: '2026-06-20 10:00' },
            { title: '清洁海水吸入滤网', items: [
              '拆卸滤器盖板（松开6颗压紧螺母），取出不锈钢滤网组件',
              '评估滤网堵塞情况：约40%面积被藤壶、海藻、泥沙覆盖',
              '用高压水枪（3~5bar）冲洗滤网表面附着物，从内侧向外冲洗',
              '用硬毛刷清除顽固藤壶残留，检查滤网有无破损（目视+光照）',
              '确认清洁后通流面积恢复100%，滤网无变形、无断丝'
            ], time: '2026-06-20 10:15' },
            { title: '复装滤器并检查密封', items: [
              '更换滤器盖板密封垫片（NBR丁腈橡胶，Φ150mm×Φ170mm×3mm）',
              '装入滤芯组件，确认到位无偏斜',
              '装回盖板，6颗螺母按对角顺序均匀拧紧（手感到位即可，不可过紧）',
              '缓慢开启海底门阀充水，检查滤器盖板密封面有无外漏',
              '用纸巾擦拭密封面确认干燥无水渍'
            ], time: '2026-06-20 10:30' }
          ] },
        { id: 'R2', title: '启动功能试验（三模式）', defaultFold: true, result: 'normal', detail: '手动/遥控/自动均一次启动成功，压力 0.82MPa 合格', operator: '赵机工', time: '2026-06-20 10:45',
          steps: [
            { title: '恢复吸水与系统准备', items: [
              '完全开启海底门阀门，确认管路充满海水',
              '打开泵体排气阀，确认连续出水无气泡后关闭排气阀',
              '检查泵体各密封点有无渗漏，机械密封处允许初始湿润（<1滴/min）',
              '确认消防管网总阀处于关闭状态（测试时仅打压试验，不实际喷水）'
            ], time: '2026-06-20 10:35' },
            { title: '手动启动模式测试', items: [
              '在就地控制盘将模式选择开关旋至"手动"位置',
              '按下启动按钮，记录启动响应时间（从按下到电机全速应<5s）',
              '观察出水压力建立过程，确认压力平稳上升无超调',
              '运行3min后手动停机，记录稳态压力0.82MPa'
            ], time: '2026-06-20 10:40' },
            { title: '遥控启动模式测试', items: [
              '在驾驶台遥控面板按下"应急消防泵启动"按钮',
              '确认遥控指令传输正常（就地控制盘"遥控"指示灯亮）',
              '记录遥控启动响应时间（应与手动模式一致，<5s）',
              '确认驾驶台压力反馈显示与就地读数一致（偏差<0.02MPa）'
            ], time: '2026-06-20 10:42' },
            { title: '自动（低压）启动测试', items: [
              '模拟消防管网低压信号（手动缓慢开启泄放阀降低管网压力至0.5MPa以下）',
              '确认自动启动逻辑正确触发（压力开关动作→延时5s→自动启动）',
              '泵自动启动后管网压力恢复至0.82MPa，自动停泵压力设定1.0MPa',
              '恢复管网压力，复位自动启动逻辑'
            ], time: '2026-06-20 10:45' },
            { title: '出水压力综合验证', items: [
              '同时开启两只消防栓（最远端+最近端），模拟实际消防工况',
              '记录双栓同时出水时管网稳态压力0.82MPa（要求≥0.75MPa）',
              '评估射程：消防水枪出水射程≥12m（SOLAS公约要求）',
              '关闭消防栓和泵，恢复设备至待命状态',
              '填写《应急消防泵月度功能试验记录表》，轮机长签字归档'
            ], time: '2026-06-20 10:45' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-20 09:00', stage: '确认', title: '月度保养计划自动触发', content: 'SMS 体系定时任务创建本月保养工单。', operator: '系统自动' },
      { time: '2026-06-20 09:30', stage: '排查', title: '设备状态预检查', content: '轴承润滑脂需要更换，海水滤网有海生物附着。', operator: '赵机工' },
      { time: '2026-06-20 10:30', stage: '维修', title: '保养作业执行完成', content: '润滑脂更换、滤网清洁、机械密封检查全部完成。', operator: '赵机工' },
      { time: '2026-06-20 10:45', stage: '维修', title: '启动功能试验通过', content: '三种启动模式均一次成功，出水压力 0.82MPa 合格。', operator: '赵机工' },
      { time: '2026-06-20 11:00', stage: '归档', title: '保养记录归档', content: '王轮机长审批通过，事件归档。', operator: '王轮机长' }
    ]
  },

  // ═══════════════════════════════════════════
  // EVT-0037: 锚机绞缆 #1 液压油位低（船员上报）
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0037',
    title: '锚机绞缆 #1 液压油位低（船员上报）',
    systemPart: '甲板机械 / 锚机绞缆',
    deviceId: 'DEV-010',
    deviceName: '锚机绞缆 #1',
    priority: 'high',
    source: 'crew',
    status: 'pending',
    stageIndex: 0,
    createdAt: '2026-06-26 11:00',
    updatedAt: '2026-06-26 11:00',
    description: '陈水手长在甲板巡回时目视发现锚机绞缆液压油箱液位偏低，低于刻度下限 30%，上报请求处理。',
    progressSummary: '待确认：船员目视上报，等待进一步确认',
    aiAnalysis: {
      verdict: 'suspected', confidence: 85,
      conclusion: '液压油位目视偏低，结合历史消耗速率判断疑似异常泄漏',
      conclusionDetail: '**疑似故障（置信度 85%）— 目视初判**\n\n**现象描述**：陈水手长在 11:00 甲板巡回时目视检查 IHI-35 型锚机绞缆液压油箱，发现玻璃液位计读数约为 **20%**，明显低于正常工作范围 **30~95%**。这是近 3 个月内第二次出现类似情况（上一次 04-15 补油至 95%）。\n\n**初步分析**：\n- 从 04-15 至今约 70 天，液位从 95% 降至 20%，总降幅 75%\n- 若仅考虑正常蒸发损耗（约 2%/月），理论剩余应 ≥ 85%\n- 实际损耗远超预期，高度疑似存在泄漏途径\n\n**注意**：目前仅为目视判断，尚未通过传感器获取精确数值。需尽快核实。',
      faultTable: [
        { candidate: '外部管路渗漏', reason: '甲板环境恶劣（盐雾+振动），软管接头易松动', consequence: '持续漏油污染甲板并可能导致系统缺油损坏', probability: '高' },
        { candidate: '液压缸密封泄漏', reason: '锚机频繁启停导致密封圈疲劳', consequence: '外漏可见油渍，内漏则导致油温升高', probability: '中' },
        { candidate: '油箱呼吸阀堵塞', reason: '盐垢积聚导致通气不畅，形成负压假象', consequence: '油箱被吸瘪变形，液位读数虚低', probability: '低' }
      ],
      dataCards: [
        { name: '目视液位读数（初步判断）', meta: '玻璃液位计目视 · 陈水手长 11:00 巡回记录', value: '液位计显示约 <strong>20%</strong>，低于下限 <strong>10个百分点</strong>。上一次补油记录 04-15（补至 95%）', verdict: '偏低 — 需传感器精确读数确认', verdictType: 'warning' },
        { name: '历史消耗速率推算', meta: '基于上次补油记录（04-15 补至95%）', value: '70天下降约 <strong>75%</strong>（95%→20%）。正常蒸发损耗约 <strong>2%/月</strong>，实际损耗约为理论的 <strong>13倍</strong>', verdict: '异常 — 损耗速率远超正常水平', verdictType: 'danger' },
        { name: '环境因素评估', meta: '甲板环境 · 盐雾/振动/温度', value: '甲板盐雾等级 <strong>高</strong> · 设备运行振动 <strong>中等</strong> · 近期气温 <strong>28~35℃</strong>', verdict: '注意 — 高盐雾环境会加速密封件老化和接头松动', verdictType: 'warning' },
        { name: '上次补油至今间隔', meta: '设备台账查询', value: '距离上次补油 <strong>70 天</strong>（04-15 ~ 06-26）· 正常补油周期约 <strong>90~120 天</strong>', verdict: '提前 — 尚未到达常规补油周期即触发低液位告警', verdictType: 'warning' }
      ],
      suggestionsList: [
        '立即安排人员携带便携式仪表现场核实液位准确读数',
        '目视检查液压管路全线（特别是软管段和法兰接头）有无油渍',
        '查阅设备运行日志，确认近期是否有异常工况（如长时间重载绞缆）',
        '若确认泄漏，按应急流程先补油至安全液位（≥40%）再详细排查',
        '联系岸基技术支持调取该设备的历史油耗曲线'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">IHI-35 型锚机绞缆采用开式液压系统，油箱安装在艏楼甲板上，直接暴露于海洋环境。液压系统的工作介质（ISO VG 46 抗磨液压油）不仅传递动力还承担润滑、冷却、防锈多重功能。油量不足会导致泵吸空（ cavitation ）、油温升高、元件磨损加速等一系列连锁反应。</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">甲板设备的特殊风险因素：</strong></p><p style="margin-bottom:4px">· 盐雾腐蚀 — 金属接头和紧固件易锈蚀松动 → 渗漏通道</p><p style="margin-bottom:4px">· 温度变化 — 日晒升温导致管路膨胀 → 接头应力循环</p><p style="margin-bottom:4px">· 振动载荷 — 绞缆作业冲击载荷 → 加速连接件疲劳</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次分析：</strong>70天内损耗率达正常值的 13倍，在排除了正常消耗后，外部渗漏是最可能的解释。甲板恶劣环境提供了合理的故障诱因。</p>',
        matches: [
          { fault: '外部管路渗漏', match: '高匹配', cls: 'high', reason: '异常消耗速率 + 甲板恶劣环境 = 高概率渗漏场景' },
          { fault: '液压执行机构密封泄漏', match: '部分匹配', cls: 'medium', reason: '可解释部分损耗，但通常伴随可见油渍痕迹' },
          { fault: '呼吸阀/通气孔堵塞', match: '待排除', cls: 'pending', reason: '需现场检查呼吸阀是否通畅' }
        ]
      },
      trendData: { seriesName: '估算液位', yUnit: '%', yMin: 0, yMax: 100, times: ['04-15','05-01','05-15','06-01','06-15','06-26'], values: [95,88,78,65,45,20] },
      relatedCases: [
        { title: '锚机液压油位缓降·液压马达轴封渗漏', match: 80, solution: '更换液压马达轴封骨架油封，清理油渍后持续监控72h液位稳定' },
        { title: '液压油位低·多路阀阀体砂眼渗油', match: 62, solution: '更换多路阀阀体（砂眼铸造缺陷），补油后液位恢复正常' },
        { title: '液压油位虚低·油位计连通阀部分关闭', match: 50, solution: '全开液位计上下连通阀，物理标尺交叉验证后读数恢复正常' }
      ],
      autoActions: [
        '船员上报液压油位偏低（06-26 14:20）→ 自动创建检修任务（06-26 14:21）',
        '自动关联P43液位传感器数据并回溯近2个月消耗趋势（06-26 14:22）',
        'AI分析下降速率异常（日均2.5%），疑似外部泄漏，已检索到3条案例（06-26 14:23）',
        '推送至船长终端并生成补油+检漏作业工单（06-26 14:25）'
      ]
    },
    todos: {
      inspections: [
        { id: 'T1', title: '携带便携仪表现场复核液位读数', defaultFold: false, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '准备便携测量工具', items: [
              '携带便携式超声波液位计/油尺',
              '准备清洁抹布擦拭液位计玻璃管',
              '携带手电筒/头灯便于观察低光照区域',
              '准备记录本和相机'
            ], time: '' },
            { title: '清洁液位计并复核读数', items: [
              '清理液位计玻璃管表面油污便于观察',
              '读取液位计上下两端刻度并记录',
              '用便携仪器交叉验证传感器读数',
              '操作液位计底部放油阀冲洗确认读数准确'
            ], time: '' },
            { title: '检查液位计本身是否正常', items: [
              '确认液位计上下连通阀处于开启状态',
              '观察液位计内液面有无波动（确认未堵塞）',
              '检查液位计玻璃管有无裂纹/破损',
              '检查液位计刻度板有无模糊/脱落'
            ], time: '' },
            { title: '记录初始油位作为后续对比基准', items: [
              '拍照记录当前液位读数',
              '标注时间和环境温度',
              '标记液位计刻度作为后续观察基准',
              '设定后续每2h巡检对比方案'
            ], time: '' }
          ] },
        { id: 'T2', title: '目视检查液压管路全程有无油渍', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '检查高压管路接头', items: [
              '沿泵至执行机构的高压管路逐段目视检查',
              '重点检查法兰接头、螺纹接头处有无湿润/油渍',
              '检查管路支架/卡箍固定点有无磨损渗油',
              '检查弯头/三通等应力集中部位'
            ], time: '' },
            { title: '检查软管段状态', items: [
              '检查液压软管表面有无鼓包/龟裂/渗油',
              '检查软管接头处有无油滴结晶痕迹',
              '确认软管弯曲半径是否在允许范围',
              '检查软管与其他部件有无摩擦接触'
            ], time: '' },
            { title: '检查执行机构密封', items: [
              '检查液压缸活塞杆防尘圈/密封圈状态',
              '检查液压马达轴封处有无湿润',
              '观察活塞杆表面有无划伤/镀层脱落',
              '检查伺服阀/平衡阀安装面有无渗油'
            ], time: '' },
            { title: '检查油箱及附件', items: [
              '检查油箱焊缝有无渗油',
              '检查放油堵/液位计接口有无松动渗漏',
              '检查油箱呼吸阀是否通畅无堵塞',
              '检查油箱底部有无积液（可能混入海水）'
            ], time: '' },
            { title: '标记可疑泄漏点', items: [
              '对发现的油渍区域贴标记并拍照',
              '判断油渍新鲜程度（新渍 vs 陈渍）',
              '在管路布置图上标注所有可疑点位置',
              '按严重程度分级排序'
            ], time: '', hasImages: true }
          ] },
        { id: 'T3', title: '检查油箱呼吸阀/通气孔状态', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '拆卸呼吸阀检查', items: [
              '拆下呼吸阀罩检查内部有无盐垢/杂物堵塞',
              '检查阀片动作是否灵活（吹气测试）',
              '检查阀片有无变形/硬化',
              '检查过滤网有无堵塞'
            ], time: '' },
            { title: '清洁并复装', items: [
              '用淡水冲洗清除盐垢沉积',
              '检查密封垫片状态必要时更换',
              '复装后确认通气顺畅'
            ], time: '' },
            { title: '验证油箱通气效果', items: [
              '在泵启停时观察呼吸阀有无气流交换',
              '确认油箱未出现负压变形现象',
              '在不同工况下评估通气是否充足'
            ], time: '' },
            { title: '检查油箱内部状况', items: [
              '通过加油口用手电筒检查油箱内壁防锈涂层',
              '观察油液颜色有无浑浊/乳化（水分侵入标志）',
              '检查吸油管口位置是否露出油面'
            ], time: '' }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '应急补油至安全液位（≥40%）', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '安全评估与应急准备', items: [
              '确认锚机当前未在作业状态（锚已到位或已固定）',
              '评估现场环境：甲板防滑、通风条件、消防器材就位',
              '准备 ISO VG 46 抗磨液压油，核对油桶批次号和合格证',
              '准备手动加油泵、带60目不锈钢过滤网的漏斗、接油盘、吸油棉'
            ], time: '' },
            { title: '清洁加油口与防污染', items: [
              '用清洗剂彻底擦拭油箱加油口盖及周围300mm范围',
              '用无绒布擦干，确保无盐结晶、水分、灰尘',
              '在加油口下方铺垫吸油纸，防止滴落污染甲板',
              '检查油桶口清洁度，擦拭桶口后再开封'
            ], time: '' },
            { title: '应急注入液压油', items: [
              '安装过滤漏斗到加油口，确保密封贴合',
              '通过加油泵缓慢注入液压油，控制流速≤15L/min',
              '每加5L暂停观察液位计读数变化，确认液面稳定',
              '目标液位：≥40%（应急最低安全油位），优先补至60%'
            ], time: '' },
            { title: '系统循环排气', items: [
              '点动操作液压系统换向阀3~5次，排出管路内空气',
              '观察液位计读数，若因系统充油下降>3%需补加至目标刻度',
              '静置10min观察有无气泡从油箱回油口冒出',
              '检查油箱底部放油堵有无渗漏迹象'
            ], time: '' }
          ] },
        { id: 'R2', title: '定位并修复渗漏点', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '综合排查确定泄漏点', items: [
              '汇总排查阶段数据：T2目视检查发现的油渍位置、T3荧光检测标记点',
              '对疑似泄漏点进行分级：严重（滴漏）、中等（渗润）、轻微（油膜）',
              '优先处理严重泄漏点，制定维修方案（更换密封/更换管段/紧固接头）',
              '准备相应备件：密封圈（NBR/PU材质）、管卡、O型圈'
            ], time: '' },
            { title: '安全隔离与拆卸', items: [
              '停机液压泵并断电，打开泄压阀确认压力归零',
              '关闭泄漏点上下游截止阀，隔离维修管段',
              '在泄漏点下方放置接油盘，预估存油5~10L',
              '用记号笔在接头配合面做对位标记，缓慢拆卸接头螺栓',
              '取出旧密封件，检查变形/损伤状态拍照存档'
            ], time: '' },
            { title: '更换密封与复装', items: [
              '清洁密封槽和配合面，用无水乙醇擦拭干净',
              '检查新密封圈型号匹配、外观无缺陷，表面涂液压油润滑',
              '装入密封圈确认无扭曲翻边，按对位标记复装接头',
              '用力矩扳手对角分3次紧固螺栓至规定力矩（M14→45Nm，M16→50Nm）',
              '逐颗复验力矩，确认全部达标'
            ], time: '' },
            { title: '恢复运行与验证', items: [
              '缓慢开启上游阀引入液压油，逐步升压至工作压力（18~21MPa）',
              '保压30min，每5min用纸巾检查接头密封面有无渗出',
              '操作锚机正反转各2次，确认动作正常无爬行',
              '清理现场油渍，吸油棉按危废收集',
              '24h后复查泄漏点及液压油位变化，确认修复达标'
            ], time: '' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-26 11:00', stage: '确认', title: '船员目视上报', content: '陈水手长甲板巡回发现液压油箱液位约20%，远低于下限30%。', operator: '陈水手长' },
      { time: '2026-06-26 11:05', stage: '确认', title: '事件已录入系统', content: '值班驾驶员接收上报信息并录入系统，状态：待确认。', operator: '值班驾驶员' },
      { time: '2026-06-26 11:10', stage: '确认', title: 'AI辅助分析完成', content: '系统对比历史数据，近7天液压油消耗速率异常偏高（正常≤0.5%/天，实测1.2%/天），建议排查管路渗漏。', operator: 'AI检测引擎' },
      { time: '待操作', stage: '确认', title: '等待值班人员确认', content: '事件待确认，确认后将进入排查阶段。', operator: '系统' }
    ]
  },

  // ═══════════════════════════════════════════
  // EVT-0036: 主机 #1 滑油压力波动
  // ═══════════════════════════════════════════
  {
    id: 'EVT-2026-0036',
    title: '主机 #1 滑油压力短时波动',
    systemPart: '主机系统 / 主推进装置',
    deviceId: 'DEV-001',
    deviceName: '主机 #1',
    priority: 'medium',
    source: 'ai',
    status: 'temp_handled',
    stageIndex: 2,
    createdAt: '2026-06-25 22:10',
    updatedAt: '2026-06-26 02:30',
    description: '主机 #1（MAN B&W 6S70ME-C）滑油进机压力在 22:05~22:20 期间出现短时波动，最低跌至 0.32MPa（下限 0.30MPa）。临时提高油泵转速后恢复稳定，待靠港彻底排查滤器。',
    progressSummary: '临时处理：已提高滑油泵旁通设定，压力稳定在 0.43MPa。待靠港清洗滤器',
    aiAnalysis: {
      verdict: 'suspected', confidence: 88,
      conclusion: '滑油压力波动源于滤器部分堵塞，临时调整后已稳定，需靠港彻底清洗',
      conclusionDetail: '**疑似故障（置信度 88%）**\n\n**现象描述**：MAN B&W 6S70ME-C 主推进主机滑油进机压力在 2026-06-25 22:05 开始出现波动（0.42→0.38→0.35→0.32→0.41 MPa），持续约 15 分钟后自行回升。期间主机转速 78rpm 保持不变，排温等其他参数正常。\n\n**数据快照**：\n- 滑油压力波动范围：0.32~0.44 MPa（正常 0.30~0.60 MPa）\n- 波动持续时间：约 15min（22:05~22:20）\n- 触发时刻：主机处于机动航行（靠泊操作中，负荷变化频繁）\n- 滤器压差：0.12 bar（新滤器基准 0.02 bar，超标 6 倍）\n\n**临时措施效果**：提高滑油泵旁通阀开度 +5% 后，压力稳定在 0.42~0.45 MPa 区间。',
      faultTable: [
        { candidate: '滑油滤器部分堵塞', reason: '滤器压差 0.12bar 远超基准值 0.02bar，杂质积累导致流通面积减小', consequence: '压力损失增加，尤其在负荷变化时因瞬时流量需求增大而触发低压波动', probability: '高' },
        { candidate: '滑油泵吸入侧气蚀', reason: '油柜液位偏低或吸入管阻力增大导致泵入口产生气泡', consequence: '气蚀造成压力脉动和泵体噪声，长期运行损伤柱塞/叶片', probability: '中' },
        { candidate: '压力调节阀（PCV）抖动', reason: '阀芯摩擦力不均匀或弹簧疲劳导致调节不稳定', consequence: '压力在小范围内快速震荡，影响润滑膜稳定性', probability: '低' },
        { candidate: '压力传感器瞬态干扰', reason: '电磁干扰或线路接触不良导致读数跳变', consequence: '假报警，实际压力正常', probability: '低' }
      ],
      dataCards: [
        { name: 'S03-滑油进机压力（核心监控）', meta: '高频采样(1Hz) · 22:05~22:20 波动时段', value: '波动范围 <strong>0.32~0.44MPa</strong>，谷值 0.32MPa（距下限仅 <strong>0.02MPa</strong>）。波动周期约 <strong>2~3min</strong>/次', verdict: '危险 — 曾触及绝对下限', verdictType: 'danger' },
        { name: '滑油滤器压差', meta: '差压传感器采集 · 基准值 0.02bar（新滤器）', value: '当前压差 <strong>0.12bar</strong>，为新滤器基准值的 <strong>6 倍</strong>。呈缓慢上升趋势（上月 0.08bar）', verdict: '严重超标 — 滤器堵塞程度高', verdictType: 'danger' },
        { name: '主机负荷与压力关联', meta: '同期主机参数对照', value: '波动期间主机转速 <strong>78rpm</strong>（恒定）· 平均排温 <strong>385℃</strong>（正常）· 燃油齿条 <strong>33.7</strong>（稳定）', verdict: '正常 — 排除主机负荷变化作为诱因', verdictType: 'normal' },
        { name: '临时措施效果', meta: '22:25 调整后监测 · 已稳定 4h+', value: '旁通开度 +5% 后压力稳定在 <strong>0.42~0.45MPa</strong> · 波动消除 ✅ · 但旁通增加意味着<strong>未过滤油比例上升</strong>', verdict: '临时有效 — 长期不可接受，需尽快清洗滤器', verdictType: 'warning' }
      ],
      suggestionsList: [
        '⚠️ 当前临时措施有效但不持久——旁通增加导致未经滤滑油直接进入系统，加速部件磨损',
        '**最高优先级**：靠港后第一时间停机清洗滑油滤器（双滤器可切换不停机）',
        '清洗时收集滤芯上的杂质样品送检，分析磨损金属成分来源',
        '检查滑油油柜液位和吸入管状态，排除吸入侧问题',
        '若滤器清洗后压差不降，需排查滑油冷却器或管路是否有局部阻塞'
      ],
      engineering: {
        intro: '<p style="margin-bottom:8px">MAN B&W 6S70ME-C 主机的滑油系统采用强制润滑方式：滑油泵从油柜吸油 → 滤器过滤 → 冷却器降温 → 分配至各润滑点（主轴承、十字头、凸轮轴、增压器等）→ 回油返回油柜。滑油进机压力（正常 0.35~0.55 MPa）是系统健康的关键指标。</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">滤器堵塞的压力效应链路：</strong></p><p style="margin-bottom:4px">· 杂质沉积 → 滤芯流通截面积减小 → 压差 ΔP 升高</p><p style="margin-bottom:4px">· ΔP 升高 → 泵后压力不变时进机压力 = 泵出口 - ΔP - 管损 → 降低</p><p style="margin-bottom:4px">· 机动航行时负荷突变 → 瞬时流量需求增大 → ΔP 进一步飙升 → 压力骤降</p><p style="margin-bottom:6px"><strong style="color:#E0ECF8">本次分析：</strong>滤器压差超标 6 倍 + 压力波动时机（机动航行）完美契合滤器堵塞的特征模型。旁通措施虽恢复了压力，但牺牲了过滤精度，属于权宜之计。</p>',
        matches: [
          { fault: '滑油滤器脏堵', match: '高匹配', cls: 'high', reason: '压差超标 6x + 压力波动时机与负荷变化吻合 = 经典滤器堵塞特征' },
          { fault: '滑油泵气蚀/吸入不良', match: '低匹配', cls: 'low', reason: '气蚀通常伴随持续低压和泵噪，非间歇性波动' },
          { fault: 'PCV调节阀不稳', match: '低匹配', cls: 'low', reason: 'PCV 问题通常导致持续震荡非单次波动事件' },
          { fault: '传感器/线路故障', match: '待排除', cls: 'pending', reason: '可用备用传感器交叉验证或查看就地压力表' }
        ]
      },
      trendData: { seriesName: '滑油压力', yUnit: 'MPa', yMin: 0.25, yMax: 0.55, times: ['06-25 21:00','06-25 22:00','06-25 22:10','06-25 22:20','06-25 23:00','06-26 00:00','06-26 02:00','06-26 02:30'], values: [0.45,0.44,0.42,0.35,0.44,0.43,0.43,0.43] },
      relatedCases: [
        { title: '主机滑油压力波动·滤器部分堵塞', match: 93, solution: '切换至备用滤器，清洗堵塞滤芯（铁屑+积碳颗粒），压差降至0.05bar' },
        { title: '滑油压力波动·滑油泵安全阀泄漏', match: 68, solution: '研磨安全阀阀芯，更换调压弹簧，压力波动消除' },
        { title: '滑油压力波动·管路气阻', match: 40, solution: '在最高点排气阀排除管路空气，压力恢复稳定' }
      ],
      autoActions: [
        'AI检测滑油压力波动幅度超0.07MPa（06-25 22:10）→ 自动创建检修任务（06-25 22:12）',
        '自动关联LUB_PRESS压力趋势和滤器压差数据（06-25 22:13）',
        'AI判定滤器堵塞概率93%，自动建议开启旁通阀临时维持压力（06-25 22:15）',
        '已检索到3条相似案例，推送靠港清洗滤器作业方案至轮机长（06-25 22:20）'
      ]
    },
    todos: {
      inspections: [
        { id: 'T1', title: '检查滑油滤器压差及滤芯状态', defaultFold: false, result: 'abnormal', detail: '压差 0.12bar（基准 0.02bar），滤芯表面覆盖黑色油泥状杂质', operator: '李轮机员', time: '2026-06-25 23:00',
          steps: [
            { title: '读取滤器压差传感器数据', items: [
              '在控制面板记录双滤器当前压差值',
              '对比新滤器基准值0.02bar评估堵塞程度',
              '记录A/B两侧滤器压差对比',
              '检查压差趋势图确认恶化速率'
            ], time: '2026-06-25 22:55' },
            { title: '切换至备用滤器', items: [
              '在不中断供油前提下切换至备用滤器侧',
              '确认切换后压力波动是否改善',
              '观察切换过程中压力有无突变',
              '记录切换前后压力变化曲线'
            ], time: '2026-06-25 22:58' },
            { title: '拆卸脏堵滤芯检查', items: [
              '打开滤器端盖取出脏堵滤芯',
              '观察滤芯表面杂质颜色、类型和分布',
              '评估滤芯骨架有无变形/破损',
              '刮取少量杂质样品装瓶待分析',
              '拍照记录滤芯脏堵状态'
            ], time: '2026-06-25 23:00', hasImages: true },
            { title: '评估杂质来源', items: [
              '黑色油泥状杂质 → 可能来自氧化产物或燃烧碳粒侵入',
              '金属光泽颗粒 → 轴承/缸套等金属磨损',
              '纤维状物质 → 滤芯自身破损或密封垫碎片',
              '记录初步判断供油样分析参考'
            ], time: '2026-06-25 23:05' }
          ] },
        { id: 'T2', title: '检查滑油油柜液位和吸入管路', defaultFold: true, result: 'normal', detail: '油柜液位正常，吸入管路无异常', operator: '李轮机员', time: '2026-06-25 23:15',
          steps: [
            { title: '读取油柜液位计', items: [
              '在机舱就地液位计读取滑油柜液位',
              '确认液位在正常范围（≥60%柜容）',
              '检查远程液位变送器与就地读数一致性',
              '评估近期滑油消耗量是否异常'
            ], time: '2026-06-25 23:10' },
            { title: '检查吸入管路法兰和阀门', items: [
              '沿泵吸入管路检查各法兰接头有无渗漏',
              '确认吸入侧截止阀全开无节流',
              '检查吸入滤器（如有）有无堵塞',
              '检查管路支架固定是否牢固'
            ], time: '2026-06-25 23:13' },
            { title: '检查泵入口压力', items: [
              '读取泵入口压力表确认正压无气蚀倾向',
              '听诊泵体有无气蚀噪声',
              '检查泵体有无异常振动',
              '测量泵进出口压差评估泵效'
            ], time: '2026-06-25 23:15' },
            { title: '检查滑油冷却器状态', items: [
              '读取冷却器前后温度差（正常ΔT 5~10℃）',
              '检查冷却器有无内漏（滑油窜入冷却水）',
              '确认冷却水流量正常',
              '检查冷却器排气阀是否正常工作'
            ], time: '2026-06-25 23:15' }
          ] },
        { id: 'T3', title: '取样分析滑油杂质成分', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '规范取样', items: [
              '在系统运行状态下从取样阀放油冲洗3倍管容积',
              '采集500ml油样装入洁净取样瓶',
              '同时采集滤芯表面杂质样品',
              '标注取样位置/时间/设备编号'
            ], time: '' },
            { title: '送检光谱/铁谱分析', items: [
              '送岸基实验室进行元素光谱分析（Fe/Cu/Pb/Cr/Al/Si）',
              '铁谱分析判断磨损颗粒形貌和浓度',
              '检测水分含量和粘度变化',
              '检测总碱值（TBN）评估油品劣化'
            ], time: '' },
            { title: '解读分析报告', items: [
              '对比上次油样分析趋势判断磨损速率',
              '根据金属元素种类推断磨损来源部件',
              'Fe↑→缸套/曲轴；Cu/Pb↑→轴瓦；Cr/Al↑→活塞环',
              '若发现异常磨损金属需制定进一步排查方案'
            ], time: '' },
            { title: '检查压力调节阀（PCV）', items: [
              '检查PCV阀芯动作是否灵活无卡滞',
              '检查PCV弹簧有无疲劳/断裂',
              '检查PCV设定压力是否偏移',
              '评估PCV是否需要拆检清洗'
            ], time: '' }
          ] }
      ],
      repairs: [
        { id: 'R1', title: '靠港后清洗/更换滑油滤器', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '安全隔离与工具准备', items: [
              '确认主机已停机并冷却至安全温度（<50℃），执行LOTO挂牌上锁',
              '确认滑油系统已卸压：打开滤器放气阀，压力表归零',
              '准备双滤器切换：先将运行滤器切至备用侧（切换手柄旋转180°）',
              '准备清洗设备：超声波清洗槽、专用溶剂（石油醚或柴油）、高压气枪',
              '准备新备件：同型号滤芯（PALL HC9600FKP8H 或同等）2支、O型密封圈'
            ], time: '' },
            { title: '隔离并拆卸脏堵滤芯', items: [
              '关闭已隔离侧滤器进出口阀门，确认该侧无压力（打开排气阀验证）',
              '打开滤器端盖（松开8颗M12压紧螺栓），缓慢取出端盖',
              '用接油盘收集滤器内部残油（预估3~5L），防止溢出污染',
              '取出滤芯组件，注意勿碰撞滤芯端部密封面',
              '目视检查滤芯表面附着物：颜色、分布、有无金属颗粒'
            ], time: '' },
            { title: '清洗或更换滤芯（视状态决定）', items: [
              '若滤芯压差<0.15bar且无机械损伤，判定可清洗复用',
              '超声波清洗：将滤芯浸入溶剂槽，40kHz频率清洗30min',
              '清洗后用压缩空气（3bar）从内侧向外反吹，至无溶剂残留',
              '检查滤芯通流面积恢复情况：目视+光照检查通透性',
              '若滤芯已超使用寿命（>8000h）或压差>0.15bar，直接更换新滤芯'
            ], time: '' },
            { title: '清洁滤器内腔并复装', items: [
              '用无尘布清除滤器壳体内部沉积物和金属碎屑',
              '用磁铁检查壳体底部有无铁磁性磨损颗粒（轴承/缸套磨损标志）',
              '更换端盖O型密封圈（NBR Φ120×3mm），新圈涂润滑脂装入槽内',
              '装入清洗后/新滤芯，确认滤芯端部密封面与壳体底座正确就位',
              '装回端盖，8颗螺栓对角分3次紧固至规定力矩（25±2Nm）'
            ], time: '' },
            { title: '恢复投运与压差验证', items: [
              '缓慢开启进口阀充油，打开顶部排气阀排气至连续出油',
              '关闭排气阀，缓慢开启出口阀恢复通路',
              '启动滑油泵建压，观察新滤器初始压差（应<0.03bar接近基准值0.02bar）',
              '主机运行30min后复测压差，确认稳定<0.05bar合格',
              '记录维修前（0.12bar）和维修后（<0.05bar）压差对比数据'
            ], time: '' }
          ] },
        { id: 'R2', title: '滤芯杂质送样分析（铁谱/光谱）', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '收集滤芯表面杂质样品', items: [
              '用不锈钢刮刀（预先用酒精清洁）从脏堵滤芯表面刮取沉积物',
              '在滤芯不同部位（入口端、中部、出口端）分别取样，标注位置',
              '将样品装入洁净密封样品袋，标注设备编号（主机#1）、日期、运行小时数',
              '同时采集少量油样（50ml）装入取样瓶，用于光谱分析对照'
            ], time: '' },
            { title: '送实验室铁谱+光谱分析', items: [
              '将样品送岸基专业实验室或使用船载便携式油液分析仪',
              '铁谱分析：制备谱片，显微镜下观察磨损颗粒形貌和浓度',
              '光谱分析（ICP/AES）：检测Fe/Cu/Pb/Cr/Sn/Al等磨损金属元素浓度',
              '要求报告：各元素浓度值（ppm）、颗粒尺寸分布、磨损类型判断',
              '对比上次分析数据（若有），评估元素浓度变化趋势'
            ], time: '' },
            { title: '出具分析报告与磨损评估', items: [
              '根据光谱数据评估发动机内部磨损状态（正常/警示/异常）',
              '重点关注：Fe（缸套/曲轴）、Cu/Pb（轴瓦）、Cr（活塞环）、Al（活塞）',
              '若某元素浓度超警戒线（如Fe>50ppm），需进一步排查对应部件',
              '出具《滑油油样分析报告》，附元素浓度趋势图和建议',
              '报告归档至设备维护档案，作为下次维修参考依据'
            ], time: '' }
          ] },
        { id: 'R3', title: '取消临时旁通设置，恢复正常过滤路径', defaultFold: true, result: null, detail: '', operator: '', time: '',
          steps: [
            { title: '确认滤器恢复正常工作能力', items: [
              '确认清洗/更换后的滤器已投运且压差稳定<0.05bar',
              '确认系统无其他异常（油压稳定、油温正常、无异响）',
              '检查滑油系统所有法兰接头和密封点无渗漏',
              '确认主机在正常工况下运行≥1h无异常报警'
            ], time: '' },
            { title: '逐步关闭旁通阀恢复全过滤', items: [
              '记录当前旁通阀开度（临时+5%开度），准备分步回调',
              '第一步：将旁通阀关闭1/3（约1.7%），观察进机压力5min',
              '第二步：继续关闭1/3，再观察5min，确认压力稳定',
              '第三步：完全关闭旁通阀，确认100%滑油经滤器过滤',
              '全程监测进机压力保持稳定在0.35~0.55MPa正常范围'
            ], time: '' },
            { title: '全工况验证与归档', items: [
              '在主机不同转速工况下（慢速/半速/全速）验证滑油压力稳定性',
              '重点验证机动航行工况（频繁加减速）压力无大幅波动',
              '连续监测24h，记录压力趋势曲线，确认完全恢复正常',
              '更新设备维修档案：记录临时措施执行时间、撤销时间、最终效果',
              '通知全体轮机员临时措施已撤销，系统恢复正常运行状态'
            ], time: '' }
          ] }
      ]
    },
    logs: [
      { time: '2026-06-25 22:10', stage: '确认', title: 'AI检测滑油压力波动告警', content: '滑油压力在 22:05 后出现异常波动，z-score -2.8 触发告警。', operator: 'AI检测引擎' },
      { time: '2026-06-25 22:20', stage: '确认', title: '压力自行回升，值班轮机员确认', content: '压力已回升至 0.41MPa，但波动原因不明。', operator: '值班轮机员' },
      { time: '2026-06-25 23:00', stage: '排查', title: '滤器压差检查 — 异常', content: '滤器压差 0.12bar（基准 0.02bar），判定异常。初步判断滤器脏堵。', operator: '李轮机员' },
      { time: '2026-06-26 02:30', stage: '维修', title: '临时措施执行', content: '提高滑油泵旁通开度 +5%，压力已稳定在 0.43MPa。标记为"临时处理"，待靠港彻底清洗滤器。', operator: '王轮机长' }
    ]
  }
]

// ============ 通知列表（含跳转快链）============
export const notifications = [
  { id: 'N-001', type: 'danger',  title: '新事件：主机 #1 第3缸排气温度超限', time: '2026-06-26 10:23', read: false, eventId: 'EVT-2026-0042', kind: 'new' },
  { id: 'N-002', type: 'warning', title: '新事件：发电机组 #1 频率偏高',     time: '2026-06-26 09:15', read: false, eventId: 'EVT-2026-0041', kind: 'new' },
  { id: 'N-003', type: 'info',    title: '状态变更：阀门内漏 处理中→维修中', time: '2026-06-26 09:00', read: false, eventId: 'EVT-2026-0040', kind: 'change' },
  { id: 'N-004', type: 'danger',  title: '新事件：锚机绞缆液压油位低',       time: '2026-06-26 11:30', read: false, eventId: 'EVT-2026-0037', kind: 'new' },
  { id: 'N-005', type: 'success', title: '状态变更：压载水泵测试 已解决',    time: '2026-06-25 10:00', read: true,  eventId: 'EVT-2026-0039', kind: 'change' }
]

// ============ 日检报告列表 ============
// ============ 巡检记录 ============
export const inspectionReports = [
  { id: 'RPT-20260626', title: '日检报告 2026-06-26', date: '2026-06-26', summary: '例行巡检完成，主机、辅机、锚机、柴油机泵阀正常' },
  { id: 'RPT-20260625', title: '日检报告 2026-06-25', date: '2026-06-25', summary: '主缸排温偏高需排查，记录异常并已处理' },
  { id: 'RPT-20260624', title: '日检报告 2026-06-24', date: '2026-06-24', summary: '空压机启动故障，更换气阀后数据正常' },
  { id: 'RPT-20260623', title: '日检报告 2026-06-23', date: '2026-06-23', summary: '分油机因温度传感器导致数据异常，已上报' },
  { id: 'RPT-20260622', title: '日检报告 2026-06-22', date: '2026-06-22', summary: '通滤器因导常导致数据异常，已上报' },
  { id: 'RPT-20260621', title: '日检报告 2026-06-21', date: '2026-06-21', summary: '空压机启动故障，更换气阀后数据正常' },
  { id: 'RPT-20260620', title: '日检报告 2026-06-20', date: '2026-06-20', summary: '分油机因温度传感器导致数据异常，已上报' },
  { id: 'RPT-20260619', title: '日检报告 2026-06-19', date: '2026-06-19', summary: '通滤器因导常导致数据异常，已上报' },
  { id: 'RPT-20260618', title: '日检报告 2026-06-18', date: '2026-06-18', summary: '分油机因温度传感器导致数据异常，已上报' },
  { id: 'RPT-20260617', title: '日检报告 2026-06-17', date: '2026-06-17', summary: '例行巡检完成，各系统运行正常无异常' },
  { id: 'RPT-20260616', title: '日检报告 2026-06-16', date: '2026-06-16', summary: '主机滑油压力偏低报警，检查发现滤器堵塞已清洗' },
  { id: 'RPT-20260615', title: '日检报告 2026-06-15', date: '2026-06-15', summary: '辅机冷却水温度偏高，清洗冷却器后恢复正常' },
  { id: 'RPT-20260614', title: '日检报告 2026-06-14', date: '2026-06-14', summary: '锚机液压系统压力波动，更换密封件后稳定' },
  { id: 'RPT-20260613', title: '日检报告 2026-06-13', date: '2026-06-13', summary: '燃油供油单元滤器压差高报警，切换备用滤器' },
  { id: 'RPT-20260612', title: '日检报告 2026-06-12', date: '2026-06-12', summary: '例行巡检完成，全部设备状态良好' },
  { id: 'RPT-20260611', title: '日检报告 2026-06-11', date: '2026-06-11', summary: '导航雷达天线转动异响，加注润滑脂后消除' },
  { id: 'RPT-20260610', title: '日检报告 2026-06-10', date: '2026-06-10', summary: '应急发电机试运行正常，电池电压检测合格' },
  { id: 'RPT-20260609', title: '日检报告 2026-06-09', date: '2026-06-09', summary: '生活污水处理装置排放超标，调整曝气量后复测合格' },
  { id: 'RPT-20260608', title: '日检报告 2026-06-08', date: '2026-06-08', summary: '主机第5缸排温偏差偏大，检查喷油器雾化情况' },
  { id: 'RPT-20260607', title: '日检报告 2026-06-07', date: '2026-06-07', summary: '锅炉水位控制器漂移，重新校准零点' },
  { id: 'RPT-20260606', title: '日检报告 2026-06-06', date: '2026-06-06', summary: '例行巡检完成，各系统参数均在正常范围内' },
  { id: 'RPT-20260605', title: '日检报告 2026-06-05', date: '2026-06-05', summary: '艏侧推电机轴承温度升高，检查发现缺油已补油' },
  { id: 'RPT-20260604', title: '日检报告 2026-06-04', date: '2026-06-04', summary: '冰机冷却效果下降，清理冷凝器翅片后恢复' },
  { id: 'RPT-20260603', title: '日检报告 2026-06-03', date: '2026-06-03', summary: '全部设备巡检完毕，无异常事项需关注' }
]

// ============ 巡检报告详情数据（点击列表项时展示）============
export const inspectionReportDetails = {
  'RPT-20260626': {
    title: '机舱巡检日检报告',
    subtitle: 'Digital Room Daily Inspection Report — Automated by AI Monitoring System',
    dateLabel: '06-24',
    dateYear: '2026年 · 周三',
    deviceCount: 16,
    vesselName: '远洋号',
    timeRange: '06:00 — 08:30',
    aiCost: '09:35',
    stats: [
      { icon: 'mdi:check-circle', bg: 'ok', color: '#52C41A', value: 26, label: '正常项' },
      { icon: 'mdi:alert', bg: 'warn', color: '#FAAD14', value: 3, label: '异常项' },
      { icon: 'mdi:close-circle', bg: 'bad', color: '#FF4D4F', value: 1, label: '故障项' },
      { icon: 'mdi:chart-donut', bg: 'blue', color: '#1890FF', value: '87%', label: '设备健康度' }
    ],
    aiSummary: {
      level: 'ok',
      score: 87,
      tag: '整体良好',
      text: '重点关注的涡轮增压器系统',
      points: [
        {
          icon: 'mdi:alert', type: 'warn',
          title: 'Z缸排温异常偏高',
          text: 'AI排温异常，超出范围（50~400℃上限），其结果中平均温度11℃。问题原因：燃烧富集不充分。红内积碳富集空冷器结。建议先检查喷油器供油量是否偏大及空隙。'
        },
        {
          icon: 'mdi:alert', type: 'warn',
          title: '涡轮增压效率下降',
          text: '涡轮转速6000RPM，与主机同速比压比84.9%（正常85~94%），气压压力为1.18bar偏低，预测增压器0.38bar低于OEM限值1.8bar。建议检查分叶和叶轮及动量磨损情况。'
        },
        {
          icon: 'mdi:information', type: 'info',
          title: '液压系统压力略低',
          text: '液压泵压力1.18MPa，标准范围2.1~1MPa，已低于下限。虽未触发报警，但若长期处于该低值可能加速部件磨损，建议下次进港时检查管路密封件。'
        }
      ]
    },
    systems: [
      {
        name: '主机系统', level: 'warn', statusText: '1项需关注', icon: 'mdi:engine', expanded: true,
        items: [
          { name: '1#缸排气温度', unit: '℃', value: '342', range: '50 ~ 400', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '2#缸排气温度', unit: '℃', value: '387', range: '50 ~ 400', status: 'warning', statusText: '⚠ 关注', remark: '偏高，较均值高17℃，建议检查喷油嘴' },
          { name: '3#缸排气温度', unit: '℃', value: '338', range: '50 ~ 400', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '4#缸排气温度', unit: '℃', value: '345', range: '50 ~ 400', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '主轴承温度', unit: '℃, ', value: '1.20', range: '60 ~ 150（机站）', status: 'normal', statusText: '✓ 正常', remark: '轴承间偏差运行状态' },
          { name: '增压器转速', unit: 'rpm', value: '0.628K', range: '0.01 ~ 0.65', status: 'normal', statusText: '✓ 正常', remark: '正常' },
          { name: '扫气温度', unit: '℃', value: '42', range: '30 ~ 55', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '扫气压力', unit: 'bar', value: '0.37', range: '0.20 ~ 0.45', status: 'warning', statusText: '⚠ 关注', remark: '偏低，可能与污染率相关' }
        ]
      },
      {
        name: '涡轮增压器系统', level: 'warn', statusText: '1项需关注', icon: 'mdi:turbine', expanded: false,
        items: []
      },
      {
        name: '燃油系统', level: 'ok', statusText: '全部正常', icon: 'mdi:gas-station', expanded: false,
        items: []
      },
      {
        name: '润滑系统', level: 'ok', statusText: '全部正常', icon: 'mdi:oil', expanded: false,
        items: []
      },
      {
        name: '冷却水系统', level: 'ok', statusText: '全部正常', icon: 'mdi:water-pump', expanded: false,
        items: []
      },
      {
        name: '液压与舵机系统', level: 'warn', statusText: '1项需关注', icon: 'mdi:anchor', expanded: false,
        items: []
      },
      {
        name: '电气与安全系统', level: 'ok', statusText: '全部正常', icon: 'mdi:lightning-bolt', expanded: false,
        items: []
      }
    ]
  }
}

// ============ 知识库文档 ============
// ============ 知识库 ============
// 设备类型分类
export const kbDeviceTypes = [
  { name: '主机', count: 32 },
  { name: '辅机', count: 18 },
  { name: '锅炉', count: 8 },
  { name: '舵机', count: 12 },
  { name: '分油机', count: 9 },
]

// 文档类型分类
export const kbDocTypes = [
  { name: '全部类型', count: 79 },
  { name: '设备手册', count: 24 },
  { name: '操作规程', count: 28 },
  { name: '故障案例', count: 18 },
  { name: '技术通告', count: 9 },
]

// 文档类型映射
export const kbTypeKeyMap = {
  '设备手册': 'manual',
  '操作规程': 'procedure',
  '故障案例': 'case',
  '技术通告': 'notice',
}

// 全量文档数据（79篇）
export const knowledgeDocs = [
  // ===== 主机 (32篇) =====
  { id: 1, title: '主机喷油嘴操作维护手册', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2024-01-01', code: 'DOC-MAN-001' },
  { id: 2, title: '缸套维护标准操作规程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-03-08', code: 'DOC-PRO-002' },
  { id: 3, title: '增压器故障分析及处理案例集', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2024-05-15', code: 'DOC-CSE-003' },
  { id: 4, title: '排气阀技术通告 TN-2024-04', device: '主机', typeKey: 'notice', typeName: '技术通告', date: '2023-07-22', code: 'DOC-NTC-004' },
  { id: 5, title: '主机启动系统温度控制规程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-01', code: 'DOC-PRO-005' },
  { id: 6, title: '曲轴箱故障诊断手册', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2023-11-08', code: 'DOC-MAN-006' },
  { id: 7, title: '主机燃油系统维护保养规程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-15', code: 'DOC-PRO-007' },
  { id: 8, title: '冷却系统标准操作流程', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2024-03-22', code: 'DOC-CSE-008' },
  { id: 9, title: '润滑系统报警处理案例', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2024-05-01', code: 'DOC-MAN-009' },
  { id: 10, title: '主机活塞环检修指南', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2023-07-08', code: 'DOC-PRO-010' },
  { id: 11, title: '轴承日常检查规程', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2023-09-15', code: 'DOC-CSE-011' },
  { id: 12, title: '主机高压油泵性能测试标准', device: '主机', typeKey: 'notice', typeName: '技术通告', date: '2023-11-22', code: 'DOC-NTC-012' },
  { id: 13, title: '喷油嘴异常处理案例集', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-01', code: 'DOC-PRO-013' },
  { id: 14, title: '主机缸套备件更换流程', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2024-03-08', code: 'DOC-MAN-014' },
  { id: 15, title: '增压器磨损极限技术标准', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-05-15', code: 'DOC-PRO-015' },
  { id: 16, title: '主机排气阀操作维护案例', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2023-07-22', code: 'DOC-CSE-016' },
  { id: 17, title: '启动系统维护标准操作规程', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2023-09-01', code: 'DOC-MAN-017' },
  { id: 18, title: '曲轴箱故障分析及处理案例集', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2023-11-08', code: 'DOC-PRO-018' },
  { id: 19, title: '燃油系统技术通告 TN-2024-19', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2024-01-15', code: 'DOC-CSE-019' },
  { id: 20, title: '主机冷却系统温度控制规程', device: '主机', typeKey: 'notice', typeName: '技术通告', date: '2024-03-22', code: 'DOC-NTC-020' },
  { id: 21, title: '润滑系统故障诊断手册', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-05-01', code: 'DOC-PRO-021' },
  { id: 22, title: '主机活塞环维护保养规程', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2023-07-08', code: 'DOC-MAN-022' },
  { id: 23, title: '轴承标准操作流程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-15', code: 'DOC-PRO-023' },
  { id: 24, title: '高压油泵报警处理案例', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2023-11-22', code: 'DOC-CSE-024' },
  { id: 25, title: '主机喷油嘴检修指南', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2024-01-01', code: 'DOC-MAN-025' },
  { id: 26, title: '缸套日常检查规程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-03-08', code: 'DOC-PRO-026' },
  { id: 27, title: '主机增压器性能测试标准', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2024-05-15', code: 'DOC-CSE-027' },
  { id: 28, title: '排气阀异常处理案例集', device: '主机', typeKey: 'notice', typeName: '技术通告', date: '2023-07-22', code: 'DOC-NTC-028' },
  { id: 29, title: '主机启动系统备件更换流程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-01', code: 'DOC-PRO-029' },
  { id: 30, title: '曲轴箱磨损极限技术标准', device: '主机', typeKey: 'manual', typeName: '设备手册', date: '2023-11-08', code: 'DOC-MAN-030' },
  { id: 31, title: '主机燃油系统操作维护规程', device: '主机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-15', code: 'DOC-PRO-031' },
  { id: 32, title: '冷却系统维护标准操作规程', device: '主机', typeKey: 'case', typeName: '故障案例', date: '2024-03-22', code: 'DOC-CSE-032' },

  // ===== 辅机 (18篇) =====
  { id: 33, title: '辅机发电机运行维护手册', device: '辅机', typeKey: 'manual', typeName: '设备手册', date: '2024-01-01', code: 'DOC-MAN-033' },
  { id: 34, title: '辅机燃油系统操作规程', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2024-03-08', code: 'DOC-PRO-034' },
  { id: 35, title: '调速器故障案例分析', device: '辅机', typeKey: 'case', typeName: '故障案例', date: '2024-05-15', code: 'DOC-CSE-035' },
  { id: 36, title: '辅机励磁系统保养规程', device: '辅机', typeKey: 'notice', typeName: '技术通告', date: '2023-07-22', code: 'DOC-NTC-036' },
  { id: 37, title: '冷却系统调试技术标准', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-01', code: 'DOC-PRO-037' },
  { id: 38, title: '辅机启动系统备件清单', device: '辅机', typeKey: 'manual', typeName: '设备手册', date: '2023-11-08', code: 'DOC-MAN-038' },
  { id: 39, title: '报警系统异常处理操作规程', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-15', code: 'DOC-PRO-039' },
  { id: 40, title: '辅机发电机试验规程', device: '辅机', typeKey: 'case', typeName: '故障案例', date: '2024-03-22', code: 'DOC-CSE-040' },
  { id: 41, title: '辅机燃油系统运行维护手册', device: '辅机', typeKey: 'manual', typeName: '设备手册', date: '2024-05-01', code: 'DOC-MAN-041' },
  { id: 42, title: '辅机调速器操作规程', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2023-07-08', code: 'DOC-PRO-042' },
  { id: 43, title: '励磁系统故障案例分析', device: '辅机', typeKey: 'case', typeName: '故障案例', date: '2023-09-15', code: 'DOC-CSE-043' },
  { id: 44, title: '辅机冷却系统保养规程', device: '辅机', typeKey: 'notice', typeName: '技术通告', date: '2023-11-22', code: 'DOC-NTC-044' },
  { id: 45, title: '启动系统调试技术标准', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-01', code: 'DOC-PRO-045' },
  { id: 46, title: '辅机报警系统备件清单', device: '辅机', typeKey: 'manual', typeName: '设备手册', date: '2024-03-08', code: 'DOC-MAN-046' },
  { id: 47, title: '发电机异常处理操作规程', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2024-05-15', code: 'DOC-PRO-047' },
  { id: 48, title: '辅机燃油系统试验规程', device: '辅机', typeKey: 'case', typeName: '故障案例', date: '2023-07-22', code: 'DOC-CSE-048' },
  { id: 49, title: '辅机调速器运行维护手册', device: '辅机', typeKey: 'manual', typeName: '设备手册', date: '2023-09-01', code: 'DOC-MAN-049' },
  { id: 50, title: '辅机励磁系统操作规程', device: '辅机', typeKey: 'procedure', typeName: '操作规程', date: '2023-11-08', code: 'DOC-PRO-050' },

  // ===== 锅炉 (8篇) =====
  { id: 51, title: '锅炉燃烧器操作手册', device: '锅炉', typeKey: 'manual', typeName: '设备手册', date: '2024-01-01', code: 'DOC-MAN-051' },
  { id: 52, title: '锅炉给水泵维护规程', device: '锅炉', typeKey: 'procedure', typeName: '操作规程', date: '2024-03-08', code: 'DOC-PRO-052' },
  { id: 53, title: '蒸汽系统故障案例分析', device: '锅炉', typeKey: 'case', typeName: '故障案例', date: '2024-05-15', code: 'DOC-CSE-053' },
  { id: 54, title: '锅炉安全阀安全规程', device: '锅炉', typeKey: 'notice', typeName: '技术通告', date: '2023-07-22', code: 'DOC-NTC-054' },
  { id: 55, title: '锅炉控制系统检修标准', device: '锅炉', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-01', code: 'DOC-PRO-055' },
  { id: 56, title: '锅炉燃烧器操作手册', device: '锅炉', typeKey: 'manual', typeName: '设备手册', date: '2023-11-08', code: 'DOC-MAN-056' },
  { id: 57, title: '锅炉给水泵维护规程', device: '锅炉', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-15', code: 'DOC-PRO-057' },
  { id: 58, title: '蒸汽系统故障案例分析', device: '锅炉', typeKey: 'case', typeName: '故障案例', date: '2024-03-22', code: 'DOC-CSE-058' },

  // ===== 舵机 (12篇) =====
  { id: 59, title: '舵机液压泵维护手册', device: '舵机', typeKey: 'manual', typeName: '设备手册', date: '2024-01-01', code: 'DOC-MAN-059' },
  { id: 60, title: '舵机转舵机构操作规程', device: '舵机', typeKey: 'procedure', typeName: '操作规程', date: '2024-03-08', code: 'DOC-PRO-060' },
  { id: 61, title: '控制系统故障诊断案例', device: '舵机', typeKey: 'case', typeName: '故障案例', date: '2024-05-15', code: 'DOC-CSE-061' },
  { id: 62, title: '舵机液压油缸安全操作', device: '舵机', typeKey: 'notice', typeName: '技术通告', date: '2023-07-22', code: 'DOC-NTC-062' },
  { id: 63, title: '应急操舵液压系统维护', device: '舵机', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-01', code: 'DOC-PRO-063' },
  { id: 64, title: '舵机液压泵检修规程', device: '舵机', typeKey: 'manual', typeName: '设备手册', date: '2023-11-08', code: 'DOC-MAN-064' },
  { id: 65, title: '舵机转舵机构维护手册', device: '舵机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-15', code: 'DOC-PRO-065' },
  { id: 66, title: '舵机控制系统操作规程', device: '舵机', typeKey: 'case', typeName: '故障案例', date: '2024-03-22', code: 'DOC-CSE-066' },
  { id: 67, title: '液压油缸故障诊断案例', device: '舵机', typeKey: 'manual', typeName: '设备手册', date: '2024-05-01', code: 'DOC-MAN-067' },
  { id: 68, title: '舵机应急操舵安全操作', device: '舵机', typeKey: 'procedure', typeName: '操作规程', date: '2023-07-08', code: 'DOC-PRO-068' },
  { id: 69, title: '液压泵液压系统维护', device: '舵机', typeKey: 'case', typeName: '故障案例', date: '2023-09-15', code: 'DOC-CSE-069' },
  { id: 70, title: '舵机转舵机构检修规程', device: '舵机', typeKey: 'notice', typeName: '技术通告', date: '2023-11-22', code: 'DOC-NTC-070' },

  // ===== 分油机 (9篇) =====
  { id: 71, title: '分油机分离筒操作手册', device: '分油机', typeKey: 'manual', typeName: '设备手册', date: '2024-01-01', code: 'DOC-MAN-071' },
  { id: 72, title: '分油机供油泵维护规程', device: '分油机', typeKey: 'procedure', typeName: '操作规程', date: '2024-03-08', code: 'DOC-PRO-072' },
  { id: 73, title: '控制系统故障处理案例', device: '分油机', typeKey: 'case', typeName: '故障案例', date: '2024-05-15', code: 'DOC-CSE-073' },
  { id: 74, title: '分油机加热器调试标准', device: '分油机', typeKey: 'notice', typeName: '技术通告', date: '2023-07-22', code: 'DOC-NTC-074' },
  { id: 75, title: '重力盘分离效果检测规程', device: '分油机', typeKey: 'procedure', typeName: '操作规程', date: '2023-09-01', code: 'DOC-PRO-075' },
  { id: 76, title: '分油机分离筒操作手册', device: '分油机', typeKey: 'manual', typeName: '设备手册', date: '2023-11-08', code: 'DOC-MAN-076' },
  { id: 77, title: '分油机供油泵维护规程', device: '分油机', typeKey: 'procedure', typeName: '操作规程', date: '2024-01-15', code: 'DOC-PRO-077' },
  { id: 78, title: '控制系统故障处理案例', device: '分油机', typeKey: 'case', typeName: '故障案例', date: '2024-03-22', code: 'DOC-CSE-078' },
  { id: 79, title: '分油机加热器调试标准', device: '分油机', typeKey: 'manual', typeName: '设备手册', date: '2024-05-01', code: 'DOC-MAN-079' },
]

// 文档详情内容（润滑油选用指南，参考项目同款）
export const kbDocContent = {
  title: '第12章 发动机润滑油选用指南',
  sections: [
    { num: '12.1', heading: '概述', text: '本章规定了船舶柴油发动机润滑油的选用标准、技术指标及更换周期。正确的润滑油选用对发动机的可靠运行和设备寿命至关重要。' },
    { num: '12.2', heading: '润滑油分类与牌号', table: {
      headers: ['类别', '牌号', '粘度等级', '适用机型'],
      rows: [
        ['系统油', 'SAE 30', '100 cSt @ 40°C', 'MAN 6L48/60CR'],
        ['系统油', 'SAE 40', '140 cSt @ 40°C', 'Wärtsilä 6L32'],
        ['气缸油', 'SAE 50', '210 cSt @ 40°C', 'MAN 6L48/60CR'],
        ['气缸油', 'BN 70', '—', 'MAN 5L35MC'],
        ['增压器油', 'SAE 15W-40', '110 cSt @ 40°C', 'ABB TPL 系列'],
      ]
    }},
    { num: '12.3', heading: '技术要求', text: '润滑油在工作温度下的运动粘度应符合制造商规定的最低限值。对中速柴油机，系统油在100°C时运动粘度不应低于 12.5 cSt，气缸油喷射粘度应控制在 18-25 cSt 之间。' },
    { num: '12.3.1', heading: '碱值（BN）选择', text: '气缸油的碱值根据所用燃油硫含量选择：', table: {
      headers: ['燃油硫含量', '推荐碱值 BN'],
      rows: [
        ['≤ 0.5%', 'BN 25-30'],
        ['0.5% - 1.5%', 'BN 40-50'],
        ['1.5% - 3.5%', 'BN 70-80'],
        ['> 3.5%', 'BN 100'],
      ]
    }, warning: { type: 'info', text: '注意：长期使用低硫燃油（≤0.1%）时，若仍使用高碱值气缸油（BN 70+），可能导致缸套表面抛光（Bore Polishing）。建议切换为 BN 25-30 低碱值气缸油。' }},
    { num: '12.4', heading: '更换周期', table: {
      headers: ['润滑油类型', '正常更换周期', '缩短周期条件'],
      rows: [
        ['系统油', '每 8,000-10,000 运行小时', '粘度变化>±20%、水分>0.2%、总碱值下降50%'],
        ['气缸油', '持续供油（按油耗）', '残碱值<25 mg KOH/g、油耗增加时'],
        ['增压器油', '每 3,000-4,000 运行小时', '油品劣化、粘度异常'],
      ]
    }},
    { num: '12.5', heading: '油品检测指标', table: {
      headers: ['检测项目', '正常范围', '警告值', '停机值'],
      rows: [
        ['40°C 运动粘度', '100-140 cSt', '<90 或 >150', '<80 或 >160'],
        ['水分含量', '<0.1%', '0.1-0.2%', '>0.2%'],
        ['总碱值 TBN', '>20 mg KOH/g', '10-20', '<10'],
        ['闪点', '>220°C', '190-220°C', '<190°C'],
        ['不溶物', '<0.5%', '0.5-1.0%', '>1.0%'],
      ]
    }, warning: { type: 'warn', text: '警告：当水分含量超过0.2%时，润滑油乳化风险急剧增加。应立即停机检查冷却系统是否存在泄漏。' }},
  ],
  related: [
    'MAN 6L48/60CR 操作手册',
    'MAN 6L48/60CR 故障排除手册',
    'MAN 6L48/60CR 维修手册',
    'MAN 6L48/60CR 技术规格书',
  ],
}

// ============ 助手预设对话（事件关联）============
export const aiSuggestions = [
  { id: 'AS-1', text: '我注意到主机 #1 第3缸排温有异常事件（待确认→处理中），要查看吗？', eventId: 'EVT-2026-0042' }
]

// ============ 趋势数据生成 ============
export function generateTrendData(sensorIds, hours = 24) {
  const ids = Array.isArray(sensorIds) ? sensorIds : [sensorIds]
  const now = new Date('2026-06-26T12:00:00')
  const result = []
  const baseMap = {}
  ids.forEach(id => {
    const s = sensorData.find(x => x.id === id)
    baseMap[id] = s ? (s.range[0] + s.range[1]) / 2 : 50
  })
  for (let i = hours - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    const hour = time.getHours()
    const loadFactor = (hour >= 8 && hour <= 18) ? 1.08 : 0.95
    const point = { time: `${String(hour).padStart(2, '0')}:00` }
    ids.forEach(id => {
      const s = sensorData.find(x => x.id === id)
      const base = baseMap[id]
      const surge = (id === 'S-01' || id === 'S-09') && i < 4 ? 1.18 : 1.0
      point[id] = +(base * loadFactor * surge + (Math.random() - 0.5) * (base * 0.04)).toFixed(2)
    })
    result.push(point)
  }
  return result
}

// ============ 设备状态分布 ============
export const deviceStatusDistribution = () => {
  const counts = { normal: 0, warning: 0, danger: 0, offline: 0 }
  deviceList.forEach(d => { counts[d.status]++ })
  return counts
}
