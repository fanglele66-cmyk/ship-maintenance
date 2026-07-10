/**
 * 日志 Mock 数据 — 从 V1.0 迁移
 * 含 24 份每日定时报告 + 每份完整详情数据
 */

/* ==================== 报告列表 ==================== */
export const inspectionReports = [
  { id: 'RPT-20260626', title: '每日定时报告 2026-06-26', date: '2026-06-26', summary: '例行巡检完成，主机、辅机、锚机、柴油机泵阀正常' },
  { id: 'RPT-20260625', title: '每日定时报告 2026-06-25', date: '2026-06-25', summary: '主缸排温偏高需排查，记录异常并已处理' },
  { id: 'RPT-20260624', title: '每日定时报告 2026-06-24', date: '2026-06-24', summary: '空压机启动故障，更换气阀后数据正常' },
  { id: 'RPT-20260623', title: '每日定时报告 2026-06-23', date: '2026-06-23', summary: '分油机因温度传感器导致数据异常，已上报' },
  { id: 'RPT-20260622', title: '每日定时报告 2026-06-22', date: '2026-06-22', summary: '通滤器因导常导致数据异常，已上报' },
  { id: 'RPT-20260621', title: '每日定时报告 2026-06-21', date: '2026-06-21', summary: '空压机启动故障，更换气阀后数据正常' },
  { id: 'RPT-20260620', title: '每日定时报告 2026-06-20', date: '2026-06-20', summary: '分油机因温度传感器导致数据异常，已上报' },
  { id: 'RPT-20260619', title: '每日定时报告 2026-06-19', date: '2026-06-19', summary: '通滤器因导常导致数据异常，已上报' },
  { id: 'RPT-20260618', title: '每日定时报告 2026-06-18', date: '2026-06-18', summary: '分油机因温度传感器导致数据异常，已上报' },
  { id: 'RPT-20260617', title: '每日定时报告 2026-06-17', date: '2026-06-17', summary: '例行巡检完成，各系统运行正常无异常' },
  { id: 'RPT-20260616', title: '每日定时报告 2026-06-16', date: '2026-06-16', summary: '主机滑油压力偏低报警，检查发现滤器堵塞已清洗' },
  { id: 'RPT-20260615', title: '每日定时报告 2026-06-15', date: '2026-06-15', summary: '辅机冷却水温度偏高，清洗冷却器后恢复正常' },
  { id: 'RPT-20260614', title: '每日定时报告 2026-06-14', date: '2026-06-14', summary: '锚机液压系统压力波动，更换密封件后稳定' },
  { id: 'RPT-20260613', title: '每日定时报告 2026-06-13', date: '2026-06-13', summary: '燃油供油单元滤器压差高报警，切换备用滤器' },
  { id: 'RPT-20260612', title: '每日定时报告 2026-06-12', date: '2026-06-12', summary: '例行巡检完成，全部设备状态良好' },
  { id: 'RPT-20260611', title: '每日定时报告 2026-06-11', date: '2026-06-11', summary: '导航雷达天线转动异响，加注润滑脂后消除' },
  { id: 'RPT-20260610', title: '每日定时报告 2026-06-10', date: '2026-06-10', summary: '应急发电机试运行正常，电池电压检测合格' },
  { id: 'RPT-20260609', title: '每日定时报告 2026-06-09', date: '2026-06-09', summary: '生活污水处理装置排放超标，调整曝气量后复测合格' },
  { id: 'RPT-20260608', title: '每日定时报告 2026-06-08', date: '2026-06-08', summary: '主机第5缸排温偏差偏大，检查喷油器雾化情况' },
  { id: 'RPT-20260607', title: '每日定时报告 2026-06-07', date: '2026-06-07', summary: '锅炉水位控制器漂移，重新校准零点' },
  { id: 'RPT-20260606', title: '每日定时报告 2026-06-06', date: '2026-06-06', summary: '例行巡检完成，各系统参数均在正常范围内' },
  { id: 'RPT-20260605', title: '每日定时报告 2026-06-05', date: '2026-06-05', summary: '艏侧推电机轴承温度升高，检查发现缺油已补油' },
  { id: 'RPT-20260604', title: '每日定时报告 2026-06-04', date: '2026-06-04', summary: '冰机冷却效果下降，清理冷凝器翅片后恢复' },
  { id: 'RPT-20260603', title: '每日定时报告 2026-06-03', date: '2026-06-03', summary: '全部设备巡检完毕，无异常事项需关注' }
]

/* ==================== 详情数据生成器 ==================== */

const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六']

function getWeekday(dateStr) {
  return WEEKDAYS[new Date(dateStr).getDay()]
}

function dateLabel(dateStr) {
  return dateStr.slice(5).replace('-', '-')
}

/** 生成一份完整详情 */
function genDetail(rpt, overrides = {}) {
  const d = rpt.date
  const wd = getWeekday(d)
  const normal = overrides.normal ?? 26
  const warn = overrides.warn ?? 0
  const bad = overrides.bad ?? 0
  const health = overrides.health ?? Math.round(100 - warn * 3 - bad * 5)

  return {
    title: '机舱每日定时报告',
    subtitle: 'Engine Room Daily Scheduled Report — Automated by AI Monitoring System',
    dateLabel: dateLabel(d),
    dateYear: `${d.slice(0,4)}年 · ${wd}`,
    deviceCount: 16,
    vesselName: '远洋号',
    timeRange: '06:00 — 08:30',
    aiCost: '09:35',
    stats: [
      { icon: 'mdi:check-circle', bg: 'ok',   color: '#52C41A', value: normal,       label: '正常项' },
      { icon: 'mdi:alert',       bg: 'warn',  color: '#FAAD14', value: warn,          label: '异常项' },
      { icon: 'mdi:close-circle',bg: 'bad',   color: '#FF4D4F', value: bad,           label: '故障项' },
      { icon: 'mdi:chart-donut', bg: 'blue',  color: '#1890FF', value: health + '%',  label: '设备健康度' }
    ],
    aiSummary: overrides.aiSummary || {
      level: bad > 0 ? 'bad' : warn > 0 ? 'warn' : 'ok',
      score: health,
      tag: health >= 90 ? '优秀' : health >= 80 ? '整体良好' : '需关注',
      text: overrides.aiText || '今日06:00主机所机状态下各项运行指标、缸间偏差及关键参数处于安全范围内。',
      points: overrides.aiPoints || []
    },
    systems: overrides.systems || defaultSystems(overrides.systemFlags || {})
  }
}

/** 默认7大系统（全部正常基准） */
function defaultSystems(flags = {}) {
  const hostItems = [
    { name: '1#缸排气温度', unit: '℃',  value: '342',  range: '50 ~ 400',     status: 'normal',  statusText: '✓ 正常', remark: '' },
    { name: '2#缸排气温度', unit: '℃',  value: flags.cyl2 || '345', range: '50 ~ 400', status: flags.cyl2 ? 'warning' : 'normal', statusText: flags.cyl2 ? '⚠ 关注' : '✓ 正常', remark: flags.cyl2Remark || '' },
    { name: '3#缸排气温度', unit: '℃',  value: '338',  range: '50 ~ 400',     status: 'normal',  statusText: '✓ 正常', remark: '' },
    { name: '4#缸排气温度', unit: '℃',  value: '345',  range: '50 ~ 400',     status: 'normal',  statusText: '✓ 正常', remark: '' },
    { name: '5#缸排气温度', unit: '℃',  value: flags.cyl5 || '340', range: '50 ~ 400', status: flags.cyl5 ? 'warning' : 'normal', statusText: flags.cyl5 ? '⚠ 关注' : '✓ 正常', remark: flags.cyl5Remark || '' },
    { name: '主轴承温度',   unit: '℃',  value: flags.bearing || '1.20', range: '60 ~ 150（机站）', status: 'normal', statusText: '✓ 正常', remark: '轴承间偏差运行状态' },
    { name: '增压器转速',   unit: 'rpm', value: flags.turbo || '0.628K', range: '0.01 ~ 0.65', status: flags.turbo ? 'warning' : 'normal', statusText: flags.turbo ? ' 关注' : '✓ 正常', remark: flags.turboRemark || '正常' },
    { name: '扫气温度',     unit: '℃',  value: '42',   range: '30 ~ 55',     status: 'normal',  statusText: '✓ 正常', remark: '' },
    { name: '扫气压力',     unit: 'bar',value: flags.scav || '0.37', range: '0.20 ~ 0.45', status: flags.scav ? 'warning' : 'normal', statusText: flags.scav ? ' 关注' : '✓ 正常', remark: flags.scavRemark || '' }
  ]

  const auxItems = [
    { name: '1号辅机冷却水温', unit: '℃',   value: flags.auxCool || '78',  range: '70 ~ 85',  status: flags.auxCool ? 'warning' : 'normal', statusText: flags.auxCool ? '⚠ 关注' : '✓ 正常', remark: flags.auxCoolRemark || '' },
    { name: '1号辅机滑油压力', unit: 'MPa', value: '0.38', range: '0.30 ~ 0.45', status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '2号辅机冷却水温', unit: '℃',   value: '80',   range: '70 ~ 85',  status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '2号辅机滑油压力', unit: 'MPa', value: '0.36', range: '0.30 ~ 0.45', status: 'normal', statusText: '✓ 正常', remark: '' }
  ]

  const pumpItems = [
    { name: '1号冷却水泵流量', unit: 'm³/h', value: '12.5', range: '8 ~ 15',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '2号冷却水泵流量', unit: 'm³/h', value: '11.8', range: '8 ~ 15',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '3号冷却水泵流量', unit: 'm³/h', value: '10.2', range: '8 ~ 15',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '分油机分离温度',  unit: '℃',   value: flags.sepTemp || '96', range: '95 ~ 98', status: flags.sepTemp ? 'warning' : 'normal', statusText: flags.sepTemp ? '⚠ 关注' : '✓ 正常', remark: flags.sepTempRemark || '' }
  ]

  const deckItems = [
    { name: '舵机油温',       unit: '℃',   value: '48',    range: '40 ~ 65',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '舵机系统压力',   unit: 'MPa', value: flags.hydPress || '14.2', range: '12 ~ 16', status: flags.hydPress ? 'warning' : 'normal', statusText: flags.hydPress ? '⚠ 关注' : '✓ 正常', remark: flags.hydPressRemark || '' },
    { name: '锚机油位',       unit: '%',   value: '72',    range: '50 ~ 90',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '艏侧推轴承温度', unit: '℃',   value: flags.thruster || '52', range: '40 ~ 70', status: flags.thruster ? 'warning' : 'normal', statusText: flags.thruster ? '⚠ 关注' : '✓ 正常', remark: flags.thrusterRemark || '' }
  ]

  const fuelItems = [
    { name: '燃油供油压力',   unit: 'MPa', value: '0.85',  range: '0.7 ~ 1.0', status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '燃油滤器压差',   unit: 'bar', value: flags.fuelFilter || '0.02', range: '0 ~ 0.05',  status: flags.fuelFilter ? 'warning' : 'normal', statusText: flags.fuelFilter ? '⚠ 关注' : '✓ 正常', remark: flags.fuelFilterRemark || '' },
    { name: '重油加热温度',   unit: '℃',   value: '125',   range: '120 ~ 140', status: 'normal', statusText: '✓ 正常', remark: '' }
  ]

  const lubeItems = [
    { name: '主机滑油压力',   unit: 'MPa', value: flags.lubePress || '0.38', range: '0.30 ~ 0.50', status: flags.lubePress ? 'warning' : 'normal', statusText: flags.lubePress ? '⚠ 关注' : '✓ 正常', remark: flags.lubePressRemark || '' },
    { name: '主机滑油温度',   unit: '℃',   value: '52',   range: '45 ~ 60',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '滑油滤器压差',   unit: 'bar', value: flags.lubeFilter || '0.01', range: '0 ~ 0.03', status: flags.lubeFilter ? 'warning' : 'normal', statusText: flags.lubeFilter ? '⚠ 关注' : '✓ 正常', remark: flags.lubeFilterRemark || '' }
  ]

  const elecItems = [
    { name: '主配电板电压',   unit: 'V',   value: '442',  range: '430 ~ 450', status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '主配电板频率',   unit: 'Hz',  value: '60.0', range: '59.5 ~ 60.5', status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '雷达天线转速',   unit: 'rpm', value: '24',   range: '20 ~ 30',   status: 'normal', statusText: '✓ 正常', remark: '' },
    { name: '应急电池电压',   unit: 'V',   value: '26.4', range: '24 ~ 28',   status: 'normal', statusText: '✓ 正常', remark: '' }
  ]

  return [
    { name: '主机系统',       level: flags.hostLevel || 'ok', statusText: flags.hostStatus || '全部正常', icon: 'mdi:engine',  expanded: true,  items: hostItems },
    { name: '辅机系统',       level: flags.auxLevel || 'ok',  statusText: flags.auxStatus || '全部正常', icon: 'mdi:power-plug', expanded: false, items: auxItems },
    { name: '泵系统',         level: flags.pumpLevel || 'ok', statusText: flags.pumpStatus || '全部正常', icon: 'mdi:water-pump', expanded: false, items: pumpItems },
    { name: '甲板机械',       level: flags.deckLevel || 'ok', statusText: flags.deckStatus || '全部正常', icon: 'mdi:anchor',  expanded: false, items: deckItems },
    { name: '燃油系统',       level: flags.fuelLevel || 'ok', statusText: flags.fuelStatus || '全部正常', icon: 'mdi:gas-station', expanded: false, items: fuelItems },
    { name: '润滑系统',       level: flags.lubeLevel || 'ok', statusText: flags.lubeStatus || '全部正常', icon: 'mdi:oil',    expanded: false, items: lubeItems },
    { name: '电气与安全系统', level: flags.elecLevel || 'ok', statusText: flags.elecStatus || '全部正常', icon: 'mdi:lightning-bolt', expanded: false, items: elecItems }
  ]
}

/* ==================== 24 份报告详情 ==================== */

export const inspectionReportDetails = {
  'RPT-20260626': genDetail(inspectionReports[0], {
    normal: 26, warn: 0, bad: 0, health: 95,
    aiSummary: { level: 'ok', score: 95, tag: '优秀', text: '今日06:00主机所机状态下各项运行指标、缸间偏差及关键参数处于安全范围内，各系统运行正常无异常。', points: [
      { icon: 'mdi:information', type: 'info', title: '全系统运行正常', text: '主机、辅机、泵系统、甲板机械、燃油、润滑、电气各系统参数均在正常范围内，无需特别关注事项。' }
    ]}
  }),

  'RPT-20260625': genDetail(inspectionReports[1], {
    normal: 24, warn: 2, bad: 0, health: 88,
    aiText: '今日主机2#缸排气温度偏高，较均值高17℃，可能为喷油嘴雾化不良导致燃烧不充分，建议检查喷油嘴。',
    aiSummary: { level: 'warn', score: 88, tag: '需关注', text: '今日主机2#缸排温偏高，较均值高17℃，已记录异常并安排排查。其余系统运行正常。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '2#缸排气温度偏高', text: '实测387℃，接近上限400℃，较其他缸均值高17℃。可能原因：喷油嘴雾化不良或供油量偏大。建议检查喷油嘴雾化情况并调整供油量。' },
      { icon: 'mdi:alert', type: 'warn', title: '扫气压力偏低', text: '实测0.37bar，处于正常范围下限。可能与空冷器脏堵或增压器效率下降相关，建议检查空冷器压差。' }
    ]},
    systemFlags: { cyl2: '387', cyl2Remark: '偏高，较均值高17℃，建议检查喷油嘴', scav: '0.37', scavRemark: '偏低，可能与空冷器脏堵相关', hostLevel: 'warn', hostStatus: '2项需关注' }
  }),

  'RPT-20260624': genDetail(inspectionReports[2], {
    normal: 22, warn: 2, bad: 1, health: 82,
    aiText: '空压机启动故障，经检查为气阀卡滞，更换气阀后重新启动正常。',
    aiSummary: { level: 'bad', score: 82, tag: '需关注', text: '今日空压机启动故障，已更换气阀后恢复正常。建议持续观察空压机运行参数。', points: [
      { icon: 'mdi:close-circle', type: 'bad', title: '空压机启动故障', text: '空压机无法正常启动，经检查发现进气阀卡滞导致无法建立启动压力。已更换气阀，重新启动后运行正常。' },
      { icon: 'mdi:alert', type: 'warn', title: '空压机排气压力波动', text: '故障期间排气压力在0.65-0.82MPa之间波动，更换气阀后稳定在0.78MPa。建议持续观察24小时。' }
    ]},
    systemFlags: { auxCool: '82', auxCoolRemark: '偏高，空压机故障导致冷却负荷增大', hostLevel: 'warn', hostStatus: '1项故障1项关注', auxLevel: 'warn', auxStatus: '1项需关注' }
  }),

  'RPT-20260623': genDetail(inspectionReports[3], {
    normal: 23, warn: 2, bad: 0, health: 86,
    aiText: '分油机分离温度传感器读数异常，显示102℃超出正常范围，已上报待检修。',
    aiSummary: { level: 'warn', score: 86, tag: '需关注', text: '分油机温度传感器读数异常，已上报。其余系统正常。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '分油机温度传感器异常', text: '分油机分离温度显示102℃，超出正常范围95-98℃。经现场核实实际温度正常，判断为传感器故障，已上报安排更换。' }
    ]},
    systemFlags: { sepTemp: '102', sepTempRemark: '传感器读数异常，实际温度正常，已上报更换', pumpLevel: 'warn', pumpStatus: '1项需关注' }
  }),

  'RPT-20260622': genDetail(inspectionReports[4], {
    normal: 23, warn: 2, bad: 0, health: 86,
    aiText: '燃油滤器压差异常升高，切换备用滤器后恢复正常。',
    aiSummary: { level: 'warn', score: 86, tag: '需关注', text: '燃油滤器压差异常，已切换备用滤器。建议清洗原滤器滤芯。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '燃油滤器压差高报警', text: '燃油滤器压差0.08bar，超过报警值0.05bar。已切换至备用滤器，压差恢复正常。建议清洗原滤器滤芯并检查燃油品质。' }
    ]},
    systemFlags: { fuelFilter: '0.08', fuelFilterRemark: '压差高，已切换备用滤器', fuelLevel: 'warn', fuelStatus: '1项需关注' }
  }),

  'RPT-20260621': genDetail(inspectionReports[5], {
    normal: 22, warn: 2, bad: 1, health: 82,
    aiText: '空压机启动故障，经检查为气阀卡滞，更换气阀后重新启动正常。',
    aiSummary: { level: 'bad', score: 82, tag: '需关注', text: '空压机启动故障，已更换气阀后恢复正常。', points: [
      { icon: 'mdi:close-circle', type: 'bad', title: '空压机启动故障', text: '空压机无法正常启动，进气阀卡滞。已更换气阀，重新启动后运行正常。' },
      { icon: 'mdi:alert', type: 'warn', title: '空压机排气压力波动', text: '故障期间排气压力波动，更换后稳定。建议持续观察。' }
    ]},
    systemFlags: { auxCool: '82', auxCoolRemark: '偏高', hostLevel: 'warn', hostStatus: '1项故障1项关注', auxLevel: 'warn', auxStatus: '1项需关注' }
  }),

  'RPT-20260620': genDetail(inspectionReports[6], {
    normal: 23, warn: 2, bad: 0, health: 86,
    aiText: '分油机温度传感器读数异常，已上报待检修。',
    aiSummary: { level: 'warn', score: 86, tag: '需关注', text: '分油机温度传感器读数异常，已上报。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '分油机温度传感器异常', text: '分油机分离温度显示103℃，传感器故障，已上报更换。' }
    ]},
    systemFlags: { sepTemp: '103', sepTempRemark: '传感器故障，已上报', pumpLevel: 'warn', pumpStatus: '1项需关注' }
  }),

  'RPT-20260619': genDetail(inspectionReports[7], {
    normal: 23, warn: 2, bad: 0, health: 86,
    aiText: '燃油滤器压差异常，已切换备用滤器。',
    aiSummary: { level: 'warn', score: 86, tag: '需关注', text: '燃油滤器压差异常，已切换备用滤器。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '燃油滤器压差高报警', text: '压差0.07bar，已切换备用滤器。建议清洗滤芯。' }
    ]},
    systemFlags: { fuelFilter: '0.07', fuelFilterRemark: '压差高，已切换', fuelLevel: 'warn', fuelStatus: '1项需关注' }
  }),

  'RPT-20260618': genDetail(inspectionReports[8], {
    normal: 23, warn: 2, bad: 0, health: 86,
    aiText: '分油机温度传感器读数异常，已上报。',
    aiSummary: { level: 'warn', score: 86, tag: '需关注', text: '分油机温度传感器异常，已上报。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '分油机温度传感器异常', text: '分离温度显示101℃，传感器故障，已上报更换。' }
    ]},
    systemFlags: { sepTemp: '101', sepTempRemark: '传感器故障', pumpLevel: 'warn', pumpStatus: '1项需关注' }
  }),

  'RPT-20260617': genDetail(inspectionReports[9], {
    normal: 26, warn: 0, bad: 0, health: 95,
    aiSummary: { level: 'ok', score: 95, tag: '优秀', text: '各系统运行正常无异常，所有参数在安全范围内。', points: [
      { icon: 'mdi:information', type: 'info', title: '全系统正常', text: '主机、辅机、泵系统、甲板机械各系统参数均正常。' }
    ]}
  }),

  'RPT-20260616': genDetail(inspectionReports[10], {
    normal: 24, warn: 1, bad: 1, health: 84,
    aiText: '主机滑油压力偏低报警，检查发现滑油滤器堵塞，清洗后压力恢复正常。',
    aiSummary: { level: 'bad', score: 84, tag: '需关注', text: '主机滑油压力偏低，滤器堵塞已清洗，压力已恢复。', points: [
      { icon: 'mdi:close-circle', type: 'bad', title: '主机滑油压力偏低', text: '滑油压力降至0.22MPa，低于报警值0.25MPa。检查发现滑油滤器严重堵塞，清洗滤器后压力恢复至0.38MPa。' },
      { icon: 'mdi:alert', type: 'warn', title: '滑油滤器压差高', text: '滤器压差0.06bar，超过报警值。已清洗滤器，压差恢复至0.01bar。' }
    ]},
    systemFlags: { lubePress: '0.22', lubePressRemark: '偏低，滤器堵塞已清洗', lubeFilter: '0.06', lubeFilterRemark: '压差高，已清洗', lubeLevel: 'bad', lubeStatus: '1项故障1项关注' }
  }),

  'RPT-20260615': genDetail(inspectionReports[11], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '辅机冷却水温度偏高，清洗冷却器后恢复正常。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '辅机冷却水温偏高，清洗冷却器后已恢复。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '1号辅机冷却水温偏高', text: '冷却水温88℃，超过上限85℃。检查发现冷却器海水管侧脏堵，清洗后水温降至78℃。' },
      { icon: 'mdi:alert', type: 'warn', title: '辅机冷却器压差增大', text: '冷却器海水管侧压差增大，已清洗。建议缩短冷却器清洗周期。' }
    ]},
    systemFlags: { auxCool: '88', auxCoolRemark: '偏高，冷却器脏堵已清洗', auxLevel: 'warn', auxStatus: '1项需关注' }
  }),

  'RPT-20260614': genDetail(inspectionReports[12], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '锚机液压系统压力波动，更换密封件后稳定。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '锚机液压系统压力波动，更换密封件后已稳定。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '舵机系统压力波动', text: '液压系统压力在10.5-14.2MPa之间波动，检查发现密封件磨损导致内泄。更换密封件后压力稳定在14.2MPa。' },
      { icon: 'mdi:alert', type: 'warn', title: '液压油箱液位下降', text: '因密封件磨损导致液压油泄漏，油箱液位降至55%。已补充液压油至75%。' }
    ]},
    systemFlags: { hydPress: '12.8', hydPressRemark: '波动，密封件磨损已更换', deckLevel: 'warn', deckStatus: '1项需关注' }
  }),

  'RPT-20260613': genDetail(inspectionReports[13], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '燃油供油单元滤器压差高报警，切换备用滤器后正常。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '燃油滤器压差高，已切换备用滤器。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '燃油滤器压差高报警', text: '燃油供油单元滤器压差0.09bar，超过报警值0.05bar。已切换至备用滤器，压差恢复正常。' },
      { icon: 'mdi:alert', type: 'warn', title: '燃油品质需关注', text: '滤器堵塞较快，建议取样化验燃油品质，检查水分和杂质含量。' }
    ]},
    systemFlags: { fuelFilter: '0.09', fuelFilterRemark: '压差高，已切换备用滤器', fuelLevel: 'warn', fuelStatus: '1项需关注' }
  }),

  'RPT-20260612': genDetail(inspectionReports[14], {
    normal: 26, warn: 0, bad: 0, health: 95,
    aiSummary: { level: 'ok', score: 95, tag: '优秀', text: '全部设备状态良好，各系统参数在正常范围内。', points: [
      { icon: 'mdi:information', type: 'info', title: '全系统正常', text: '例行巡检完成，全部设备状态良好。' }
    ]}
  }),

  'RPT-20260611': genDetail(inspectionReports[15], {
    normal: 25, warn: 1, bad: 0, health: 91,
    aiText: '导航雷达天线转动异响，加注润滑脂后消除。',
    aiSummary: { level: 'warn', score: 91, tag: '整体良好', text: '雷达天线转动异响，已加注润滑脂消除。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '雷达天线转动异响', text: '雷达天线转动时发出异常噪音，检查发现轴承缺油。加注润滑脂后异响消除，转速恢复正常。' }
    ]},
    systemFlags: { hostLevel: 'warn', hostStatus: '1项需关注' }
  }),

  'RPT-20260610': genDetail(inspectionReports[16], {
    normal: 26, warn: 0, bad: 0, health: 93,
    aiSummary: { level: 'ok', score: 93, tag: '优秀', text: '应急发电机试运行正常，电池电压检测合格。', points: [
      { icon: 'mdi:information', type: 'info', title: '应急发电机试运正常', text: '应急发电机空载试运行30分钟，电压频率稳定，电池电压26.4V合格。' }
    ]}
  }),

  'RPT-20260609': genDetail(inspectionReports[17], {
    normal: 24, warn: 1, bad: 1, health: 83,
    aiText: '生活污水处理装置排放超标，调整曝气量后复测合格。',
    aiSummary: { level: 'bad', score: 83, tag: '需关注', text: '生活污水处理装置排放超标，已调整曝气量后复测合格。', points: [
      { icon: 'mdi:close-circle', type: 'bad', title: '生活污水排放超标', text: '生活污水处理装置排放水COD超标（实测180mg/L，限值150mg/L）。调整曝气量并增加消毒剂投加量后，复测COD降至120mg/L合格。' },
      { icon: 'mdi:alert', type: 'warn', title: '曝气量不足', text: '曝气风机运行时间不足，导致处理效果下降。已调整自动运行程序，增加曝气时间。' }
    ]},
    systemFlags: { hostLevel: 'bad', hostStatus: '1项故障1项关注' }
  }),

  'RPT-20260608': genDetail(inspectionReports[18], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '主机第5缸排温偏差偏大，检查喷油器雾化情况。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '主机5#缸排温偏高，偏差较大，建议检查喷油器。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '5#缸排气温度偏高', text: '5#缸排温392℃，较其他缸均值高22℃。可能原因：喷油器雾化不良或供油量偏大。建议拆检喷油器检查雾化情况。' },
      { icon: 'mdi:alert', type: 'warn', title: '缸间排温偏差增大', text: '缸间排温最大偏差22℃，超过允许值15℃。建议检查各缸喷油器供油量一致性。' }
    ]},
    systemFlags: { cyl5: '392', cyl5Remark: '偏高，较均值高22℃，建议检查喷油器', hostLevel: 'warn', hostStatus: '2项需关注' }
  }),

  'RPT-20260607': genDetail(inspectionReports[19], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '锅炉水位控制器漂移，重新校准零点后正常。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '锅炉水位控制器漂移，已重新校准。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '锅炉水位控制器漂移', text: '锅炉水位控制器显示值与实际水位偏差5%，重新校准零点后偏差消除。建议每季度校准一次水位控制器。' },
      { icon: 'mdi:alert', type: 'warn', title: '锅炉水位波动', text: '因控制器漂移导致给水泵频繁启停，已调整控制参数减少波动。' }
    ]},
    systemFlags: { hostLevel: 'warn', hostStatus: '1项需关注' }
  }),

  'RPT-20260606': genDetail(inspectionReports[20], {
    normal: 26, warn: 0, bad: 0, health: 95,
    aiSummary: { level: 'ok', score: 95, tag: '优秀', text: '各系统参数均在正常范围内，无异常事项。', points: [
      { icon: 'mdi:information', type: 'info', title: '全系统正常', text: '例行巡检完成，各系统参数均在正常范围内。' }
    ]}
  }),

  'RPT-20260605': genDetail(inspectionReports[21], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '艏侧推电机轴承温度升高，检查发现缺油已补油。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '艏侧推电机轴承温度升高，已补油后温度恢复正常。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '艏侧推电机轴承温度升高', text: '艏侧推电机轴承温度68℃，超过正常上限65℃。检查发现轴承缺油，补充润滑脂后温度降至52℃。' },
      { icon: 'mdi:alert', type: 'warn', title: '轴承润滑周期需缩短', text: '侧推电机轴承润滑周期建议由3个月缩短至2个月。' }
    ]},
    systemFlags: { thruster: '68', thrusterRemark: '偏高，缺油已补油', deckLevel: 'warn', deckStatus: '1项需关注' }
  }),

  'RPT-20260604': genDetail(inspectionReports[22], {
    normal: 24, warn: 2, bad: 0, health: 87,
    aiText: '冰机冷却效果下降，清理冷凝器翅片后恢复。',
    aiSummary: { level: 'warn', score: 87, tag: '需关注', text: '冰机冷却效果下降，清理冷凝器翅片后已恢复。', points: [
      { icon: 'mdi:alert', type: 'warn', title: '冰机冷却效果下降', text: '冰机冷凝温度偏高，冷却效果下降。检查发现冷凝器翅片脏堵，清理后冷却效果恢复正常。' },
      { icon: 'mdi:alert', type: 'warn', title: '冷凝器需定期清洁', text: '冷凝器翅片脏堵较快，建议缩短清洁周期至每月一次。' }
    ]},
    systemFlags: { hostLevel: 'warn', hostStatus: '1项需关注' }
  }),

  'RPT-20260603': genDetail(inspectionReports[23], {
    normal: 26, warn: 0, bad: 0, health: 95,
    aiSummary: { level: 'ok', score: 95, tag: '优秀', text: '全部设备巡检完毕，无异常事项需关注。', points: [
      { icon: 'mdi:information', type: 'info', title: '全系统正常', text: '全部设备巡检完毕，无异常事项需关注。' }
    ]}
  })
}
