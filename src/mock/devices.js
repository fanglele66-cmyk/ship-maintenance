/**
 * 设备数据 + 船舶信息 Mock
 */
export const shipInfo = {
  name: '远洋6号',
  status: 'sailing',
  latitude: '23°N',
  longitude: '118°E',
  speed: 12.5,
  heading: 215,
  healthScore: 82,
  onlineDevices: 10,
  totalDevices: 10
}

export const statusLabels = {
  sailing: '航行中',
  anchoring: '锚泊中',
  docking: '靠港中'
}

export const statusColors = {
  sailing: '#52C41A',
  anchoring: '#FAAD14',
  docking: '#1890FF'
}

/**
 * 10 台设备，含系统归属和状态
 */
export const mockDevices = [
  {
    id: 'main-engine-1',
    name: '1号主机',
    system: '主机系统',
    status: 'danger',
    metrics: [
      { label: '冷却水温', value: 92, unit: '°C', status: 'over' },
      { label: '转速', value: 450, unit: 'rpm', status: 'normal' }
    ],
    position: { x: '63%', y: '60%' }
  },
  {
    id: 'aux-engine-1',
    name: '1号辅机',
    system: '辅机系统',
    status: 'normal',
    metrics: [
      { label: '水温', value: 78, unit: '°C', status: 'normal' },
      { label: '转速', value: 1800, unit: 'rpm', status: 'normal' }
    ],
    position: { x: '50%', y: '25%' }
  },
  {
    id: 'aux-engine-2',
    name: '2号辅机',
    system: '辅机系统',
    status: 'warning',
    metrics: [
      { label: '油压', value: 2.1, unit: 'MPa', status: 'over' },
      { label: '转速', value: 1750, unit: 'rpm', status: 'normal' }
    ],
    position: { x: '45%', y: '20%' }
  },
  {
    id: 'cooling-pump-1',
    name: '1号冷却水泵',
    system: '泵系统',
    status: 'normal',
    metrics: [
      { label: '流量', value: 12.5, unit: 'm³/h', status: 'normal' },
      { label: '压力', value: 0.35, unit: 'MPa', status: 'normal' }
    ],
    position: { x: '30%', y: '45%' }
  },
  {
    id: 'cooling-pump-2',
    name: '2号冷却水泵',
    system: '泵系统',
    status: 'normal',
    metrics: [
      { label: '流量', value: 11.8, unit: 'm³/h', status: 'normal' },
      { label: '压力', value: 0.33, unit: 'MPa', status: 'normal' }
    ],
    position: { x: '25%', y: '50%' }
  },
  {
    id: 'cooling-pump-3',
    name: '3号冷却水泵',
    system: '泵系统',
    status: 'normal',
    metrics: [
      { label: '流量', value: 10.2, unit: 'm³/h', status: 'normal' },
      { label: '压力', value: 0.30, unit: 'MPa', status: 'normal' }
    ],
    position: { x: '28%', y: '55%' }
  },
  {
    id: 'steering-gear',
    name: '舵机',
    system: '甲板机械',
    status: 'danger',
    metrics: [
      { label: '油温', value: 78, unit: '°C', status: 'over' },
      { label: '舵角', value: 15, unit: '°', status: 'normal' }
    ],
    position: { x: '91%', y: '62%' }
  },
  {
    id: 'air-compressor',
    name: '空压机',
    system: '辅机系统',
    status: 'warning',
    metrics: [
      { label: '排气', value: 0.82, unit: 'MPa', status: 'warning' },
      { label: '温度', value: 65, unit: '°C', status: 'normal' }
    ],
    position: { x: '35%', y: '54%' }
  },
  {
    id: 'boiler',
    name: '锅炉',
    system: '辅机系统',
    status: 'normal',
    metrics: [
      { label: '水位', value: 72, unit: '%', status: 'normal' },
      { label: '压力', value: 0.7, unit: 'MPa', status: 'normal' }
    ],
    position: { x: '70%', y: '36%' }
  },
  {
    id: 'radar',
    name: '雷达',
    system: '导航系统',
    status: 'normal',
    metrics: [
      { label: '量程', value: 12, unit: 'nm', status: 'normal' },
      { label: '转速', value: 24, unit: 'rpm', status: 'normal' }
    ],
    position: { x: '40%', y: '15%' }
  }
]

export const systems = ['全部', '主机系统', '辅机系统', '泵系统', '甲板机械', '导航系统']
