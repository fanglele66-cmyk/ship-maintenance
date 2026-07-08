/**
 * 传感器数据 Mock - 态势感知第二层/第三层使用
 *
 * 层级结构：设备层(device) → 子系统(subsystem) → 传感器(sensor)
 * - 设备层：1号主机、锅炉、舵机、空压机 等
 * - 子系统：燃油系统、排温系统、冷却系统 等（隶属于设备）
 */
export const mockSensors = [
  // ==========================
  // 1号主机 (main-engine-1)
  // ==========================
  // -- 燃油系统 --
  { id: 's-001', nameEn: 'Fuel Oil Temp', nameCn: '燃油温度', system: '主机系统', subsystem: '燃油系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 62.3, unit: '°C', range: '50-80', status: 'normal' },
  { id: 's-002', nameEn: 'Fuel Oil Press', nameCn: '燃油压力', system: '主机系统', subsystem: '燃油系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 0.72, unit: 'MPa', range: '0.6-0.9', status: 'normal' },
  { id: 's-003', nameEn: 'Fuel Oil Viscosity', nameCn: '燃油粘度', system: '主机系统', subsystem: '燃油系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 12.5, unit: 'cSt', range: '10-15', status: 'normal' },
  // -- 排温系统 --
  { id: 's-004', nameEn: 'Exh.Gas Temp', nameCn: '排气温度', system: '主机系统', subsystem: '排温系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 92.2, unit: '°C', threshold: 85, status: 'over' },
  { id: 's-005', nameEn: 'Cyl.3 Exh.Temp', nameCn: '3缸排气温度', system: '主机系统', subsystem: '排温系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 385, unit: '°C', threshold: 380, status: 'over' },
  { id: 's-006', nameEn: 'Exh.Manifold Press', nameCn: '排气管压力', system: '主机系统', subsystem: '排温系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 0.18, unit: 'MPa', range: '0.10-0.25', status: 'normal' },
  // -- 冷却系统 --
  { id: 's-007', nameEn: 'Cyl Cool Water Out', nameCn: '缸套水出口温度', system: '主机系统', subsystem: '冷却系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 88.5, unit: '°C', threshold: 85, status: 'warning' },
  { id: 's-008', nameEn: 'Cyl Cool Water In', nameCn: '缸套水进口温度', system: '主机系统', subsystem: '冷却系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 48.7, unit: '°C', threshold: 55, status: 'normal' },
  // -- 滑油系统 --
  { id: 's-009', nameEn: 'Lube Oil Press', nameCn: '滑油压力', system: '主机系统', subsystem: '滑油系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 0.38, unit: 'MPa', range: '0.3-0.5', status: 'normal' },
  { id: 's-010', nameEn: 'Lube Oil Temp', nameCn: '滑油温度', system: '主机系统', subsystem: '滑油系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 55.2, unit: '°C', range: '45-65', status: 'normal' },
  // -- 扫气系统 --
  { id: 's-011', nameEn: 'Scavenge Air Press', nameCn: '扫气压力', system: '主机系统', subsystem: '扫气系统', device: '1号主机', deviceId: 'main-engine-1',
    value: 0.22, unit: 'MPa', range: '0.15-0.30', status: 'normal' },
  // -- 转速监测 --
  { id: 's-012', nameEn: 'Engine Speed', nameCn: '主机转速', system: '主机系统', subsystem: '转速监测', device: '1号主机', deviceId: 'main-engine-1',
    value: 450, unit: 'rpm', threshold: 500, status: 'normal' },
  // -- 振动监测 --
  { id: 's-013', nameEn: 'Vibration X', nameCn: '振动(X向)', system: '主机系统', subsystem: '振动监测', device: '1号主机', deviceId: 'main-engine-1',
    value: 2.8, unit: 'mm/s', threshold: 7.1, status: 'normal' },
  { id: 's-014', nameEn: 'Vibration Y', nameCn: '振动(Y向)', system: '主机系统', subsystem: '振动监测', device: '1号主机', deviceId: 'main-engine-1',
    value: 3.1, unit: 'mm/s', threshold: 7.1, status: 'normal' },

  // ==========================
  // 锅炉 (boiler)
  // ==========================
  // -- 水位系统 --
  { id: 's-020', nameEn: 'Boiler Water Level', nameCn: '锅炉水位', system: '辅机系统', subsystem: '水位系统', device: '锅炉', deviceId: 'boiler',
    value: 72.0, unit: '%', range: '40-85', status: 'normal' },
  { id: 's-021', nameEn: 'Water Level Alarm', nameCn: '水位报警信号', system: '辅机系统', subsystem: '水位系统', device: '锅炉', deviceId: 'boiler',
    value: 0, unit: '', range: '0-1', status: 'normal' },
  // -- 蒸汽系统 --
  { id: 's-022', nameEn: 'Steam Press', nameCn: '蒸汽压力', system: '辅机系统', subsystem: '蒸汽系统', device: '锅炉', deviceId: 'boiler',
    value: 0.7, unit: 'MPa', range: '0.5-0.8', status: 'normal' },
  { id: 's-023', nameEn: 'Steam Temp', nameCn: '蒸汽温度', system: '辅机系统', subsystem: '蒸汽系统', device: '锅炉', deviceId: 'boiler',
    value: 168, unit: '°C', range: '150-180', status: 'normal' },
  { id: 's-024', nameEn: 'Steam Flow', nameCn: '蒸汽流量', system: '辅机系统', subsystem: '蒸汽系统', device: '锅炉', deviceId: 'boiler',
    value: 2.4, unit: 't/h', range: '1.5-3.0', status: 'normal' },
  // -- 燃烧系统 --
  { id: 's-025', nameEn: 'Fuel Flow', nameCn: '燃油流量', system: '辅机系统', subsystem: '燃烧系统', device: '锅炉', deviceId: 'boiler',
    value: 185, unit: 'kg/h', range: '150-220', status: 'warning' },
  { id: 's-026', nameEn: 'Flue Gas Temp', nameCn: '排烟温度', system: '辅机系统', subsystem: '燃烧系统', device: '锅炉', deviceId: 'boiler',
    value: 245, unit: '°C', threshold: 250, status: 'warning' },
  // -- 给水系统 --
  { id: 's-027', nameEn: 'Feed Water Temp', nameCn: '给水温度', system: '辅机系统', subsystem: '给水系统', device: '锅炉', deviceId: 'boiler',
    value: 82, unit: '°C', range: '75-95', status: 'normal' },

  // ==========================
  // 舵机 (steering-gear)
  // ==========================
  // -- 液压系统 --
  { id: 's-030', nameEn: 'Hyd Oil Temp', nameCn: '液压油温度', system: '甲板机械', subsystem: '液压系统', device: '舵机', deviceId: 'steering-gear',
    value: 78.0, unit: '°C', threshold: 65, status: 'over' },
  { id: 's-031', nameEn: 'Hyd Oil Press', nameCn: '液压油压力', system: '甲板机械', subsystem: '液压系统', device: '舵机', deviceId: 'steering-gear',
    value: 16.5, unit: 'MPa', range: '14-18', status: 'normal' },
  { id: 's-032', nameEn: 'Hyd Oil Level', nameCn: '液压油液位', system: '甲板机械', subsystem: '液压系统', device: '舵机', deviceId: 'steering-gear',
    value: 85, unit: '%', range: '60-95', status: 'normal' },
  // -- 舵角监测 --
  { id: 's-033', nameEn: 'Rudder Angle', nameCn: '舵角', system: '甲板机械', subsystem: '舵角监测', device: '舵机', deviceId: 'steering-gear',
    value: 15.0, unit: '°', range: '-35-35', status: 'normal' },
  { id: 's-034', nameEn: 'Rudder Response', nameCn: '舵角响应时间', system: '甲板机械', subsystem: '舵角监测', device: '舵机', deviceId: 'steering-gear',
    value: 2.1, unit: 's', threshold: 3.0, status: 'normal' },
  // -- 电气系统 --
  { id: 's-035', nameEn: 'Motor Current', nameCn: '舵机电机电流', system: '甲板机械', subsystem: '电气系统', device: '舵机', deviceId: 'steering-gear',
    value: 28.5, unit: 'A', threshold: 35, status: 'normal' },

  // ==========================
  // 空压机 (air-compressor)
  // ==========================
  // -- 压缩空气系统 --
  { id: 's-040', nameEn: 'Air Press', nameCn: '排气压力', system: '辅机系统', subsystem: '压缩空气系统', device: '空压机', deviceId: 'air-compressor',
    value: 0.82, unit: 'MPa', range: '0.75-0.85', status: 'warning' },
  { id: 's-041', nameEn: 'Air Flow', nameCn: '排气流量', system: '辅机系统', subsystem: '压缩空气系统', device: '空压机', deviceId: 'air-compressor',
    value: 3.2, unit: 'm³/min', range: '2.8-3.5', status: 'normal' },
  { id: 's-042', nameEn: 'Air Temp', nameCn: '排气温度', system: '辅机系统', subsystem: '压缩空气系统', device: '空压机', deviceId: 'air-compressor',
    value: 68, unit: '°C', threshold: 75, status: 'normal' },
  // -- 冷却系统 --
  { id: 's-043', nameEn: 'Cool Water Temp', nameCn: '冷却水温', system: '辅机系统', subsystem: '冷却系统', device: '空压机', deviceId: 'air-compressor',
    value: 42, unit: '°C', threshold: 55, status: 'normal' },
  // -- 润滑系统 --
  { id: 's-044', nameEn: 'Oil Press', nameCn: '滑油压力', system: '辅机系统', subsystem: '润滑系统', device: '空压机', deviceId: 'air-compressor',
    value: 0.28, unit: 'MPa', range: '0.2-0.4', status: 'normal' },
  { id: 's-045', nameEn: 'Oil Temp', nameCn: '滑油温度', system: '辅机系统', subsystem: '润滑系统', device: '空压机', deviceId: 'air-compressor',
    value: 58, unit: '°C', range: '45-70', status: 'normal' },
]

/**
 * 各设备对应的子系统标签列表
 * 用于 SensorGrid 的子系统筛选 tab
 */
export const subsystemTagsByDevice = {
  'main-engine-1': ['燃油系统', '排温系统', '冷却系统', '滑油系统', '扫气系统', '转速监测', '振动监测'],
  'boiler': ['水位系统', '蒸汽系统', '燃烧系统', '给水系统'],
  'steering-gear': ['液压系统', '舵角监测', '电气系统'],
  'air-compressor': ['压缩空气系统', '冷却系统', '润滑系统'],
}

/**
 * 默认系统标签（兼容旧的全局视图）
 */
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
