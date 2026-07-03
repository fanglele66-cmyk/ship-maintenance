/**
 * 传感器数据 Mock - 态势感知第二层/第三层使用
 */
export const mockSensors = [
  // 主机系统
  { id: 's-001', nameEn: 'Exh.Gas Temp', nameCn: '排气温度', system: '主机系统', device: '1号主机',
    value: 92.2, unit: '°C', threshold: 85, status: 'over' },
  { id: 's-002', nameEn: 'Cyl.3 Exh.Temp', nameCn: '3缸排气温度', system: '主机系统', device: '1号主机',
    value: 385, unit: '°C', threshold: 380, status: 'over' },
  { id: 's-003', nameEn: 'Cyl Cool Water Out', nameCn: '缸套水出口', system: '主机系统', device: '1号主机',
    value: 88.5, unit: '°C', threshold: 85, status: 'warning' },
  { id: 's-004', nameEn: 'Cyl Cool Water In', nameCn: '缸套水进口', system: '主机系统', device: '1号主机',
    value: 48.7, unit: '°C', threshold: 55, status: 'normal' },
  { id: 's-005', nameEn: 'Lube Oil Press', nameCn: '滑油压力', system: '主机系统', device: '1号主机',
    value: 0.38, unit: 'MPa', range: '0.3-0.5', status: 'normal' },
  { id: 's-006', nameEn: 'Fuel Oil Temp', nameCn: '燃油温度', system: '主机系统', device: '1号主机',
    value: 62.3, unit: '°C', range: '50-80', status: 'normal' },
  { id: 's-007', nameEn: 'Scavenge Air Press', nameCn: '扫气压力', system: '主机系统', device: '1号主机',
    value: 0.22, unit: 'MPa', range: '0.15-0.30', status: 'normal' },
  { id: 's-008', nameEn: 'Engine Speed', nameCn: '主机转速', system: '主机系统', device: '1号主机',
    value: 450, unit: 'rpm', threshold: 500, status: 'normal' },
  { id: 's-009', nameEn: 'Vibration', nameCn: '振动', system: '主机系统', device: '1号主机',
    value: 2.8, unit: 'mm/s', threshold: 7.1, status: 'normal' },
  // 辅机系统
  { id: 's-010', nameEn: 'Oil Press', nameCn: '机油压力', system: '辅机系统', device: '2号辅机',
    value: 0.18, unit: 'MPa', threshold: 0.25, status: 'over' },
  { id: 's-011', nameEn: 'Oil Temp', nameCn: '机油温度', system: '辅机系统', device: '2号辅机',
    value: 68.5, unit: '°C', threshold: 75, status: 'normal' },
  { id: 's-012', nameEn: 'Cool Water Temp', nameCn: '冷却水温', system: '辅机系统', device: '1号辅机',
    value: 78.0, unit: '°C', threshold: 85, status: 'normal' },
  { id: 's-013', nameEn: 'Air Press', nameCn: '排气压力', system: '辅机系统', device: '空压机',
    value: 0.82, unit: 'MPa', range: '0.75-0.85', status: 'warning' },
  { id: 's-014', nameEn: 'Boiler Water Level', nameCn: '锅炉水位', system: '辅机系统', device: '锅炉',
    value: 72.0, unit: '%', range: '40-85', status: 'normal' },
  { id: 's-015', nameEn: 'Steam Press', nameCn: '蒸汽压力', system: '辅机系统', device: '锅炉',
    value: 0.7, unit: 'MPa', range: '0.5-0.8', status: 'normal' },
  // 泵系统
  { id: 's-016', nameEn: 'Flow Rate', nameCn: '流量', system: '泵系统', device: '1号冷却水泵',
    value: 12.5, unit: 'm³/h', range: '8-15', status: 'normal' },
  { id: 's-017', nameEn: 'Outlet Press', nameCn: '出口压力', system: '泵系统', device: '2号冷却水泵',
    value: 0.33, unit: 'MPa', range: '0.25-0.45', status: 'normal' },
  // 甲板机械
  { id: 's-018', nameEn: 'Hyd Oil Temp', nameCn: '液压油温度', system: '甲板机械', device: '舵机',
    value: 78.0, unit: '°C', threshold: 65, status: 'over' },
  { id: 's-019', nameEn: 'Rudder Angle', nameCn: '舵角', system: '甲板机械', device: '舵机',
    value: 15.0, unit: '°', range: '-35-35', status: 'normal' },
  // 导航系统
  { id: 's-020', nameEn: 'Radar Range', nameCn: '雷达量程', system: '导航系统', device: '雷达',
    value: 12, unit: 'nm', status: 'normal' }
]

export const systemTags = ['全部', '主机系统', '辅机系统', '泵系统', '甲板机械', '导航系统']

/**
 * 生成传感器的趋势数据
 */
export function generateTrendData(baseValue, variance, hours = 72) {
  const now = Date.now()
  return Array.from({ length: hours }, (_, i) => ({
    time: new Date(now - (hours - 1 - i) * 3600000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: baseValue + Math.sin(i / 4) * variance + Math.random() * variance * 0.3
  }))
}
