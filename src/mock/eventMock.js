// V2.0 事件中心 Mock 数据

export const eventList = [
  {
    id: 'EVT-2026-001',
    title: '主机冷却水温异常偏高',
    system: '主机系统',
    priority: 'critical',
    status: 'pending',
    createdAt: '2026-07-02T14:05:00',
    source: 'sensor_alarm',
    snapshot: {
      sensors: [
        { name: '冷却水出口温度', value: 92.4, unit: '°C', threshold: 85, status: 'over' },
        { name: '冷却水进口温度', value: 48.7, unit: '°C', threshold: 55, status: 'normal' },
        { name: '温差', value: 43.7, unit: '°C', range: '15-25', status: 'over' },
        { name: '海水泵压力', value: 0.28, unit: 'MPa', range: '0.25-0.35', status: 'normal' },
        { name: '淡水泵压力', value: 0.32, unit: 'MPa', range: '0.25-0.35', status: 'normal' },
        { name: '热交换器效率', value: 68, unit: '%', threshold: 75, status: 'over' }
      ],
      trendData: [
        { time: '14:00', value: 78 },
        { time: '15:00', value: 80 },
        { time: '16:00', value: 82 },
        { time: '17:00', value: 85 },
        { time: '18:00', value: 87 },
        { time: '19:00', value: 89 },
        { time: '20:00', value: 91 },
        { time: '21:00', value: 92 },
        { time: '22:00', value: 92.4 }
      ],
      snapshotTime: '2026-07-02T14:05:00'
    },
    aiAnalysis: {
      summary: '冷却水温差异常偏大（43.7°C），高度怀疑冷却系统存在堵塞或热交换器效率下降。建议优先检查海水冷却管路和热交换器。',
      faultTable: [
        { name: '海水冷却管路堵塞', probability: 'high', detail: '海水管路可能存在海生物附着或杂质堵塞' },
        { name: '淡水冷却侧水垢', probability: 'medium', detail: '长期运行导致水垢积累，影响热交换效率' },
        { name: '温控阀故障', probability: 'low', detail: '温控阀卡滞或响应迟钝' }
      ],
      suggestions: '建议优先检查：① 海水冷却管路是否通畅 ② 热交换器效率测试 ③ 温控阀工作状态'
    },
    relatedCases: [
      { title: '2026-05 主机冷却水系统堵塞案例', url: '#' }
    ],
    timeline: [
      { time: '2026-07-02T14:05:00', action: '事件创建（系统自动）' },
      { time: '2026-07-02T14:10:00', action: 'AI 分析完成' }
    ]
  },
  {
    id: 'EVT-2026-002',
    title: '2号辅机油压偏低预警',
    system: '辅机系统',
    priority: 'important',
    status: 'pending',
    createdAt: '2026-07-02T11:30:00',
    source: 'sensor_alarm',
    snapshot: {
      sensors: [
        { name: '润滑油压力', value: 2.1, unit: 'MPa', range: '2.5-3.5', status: 'warning' },
        { name: '油温', value: 68, unit: '°C', range: '60-75', status: 'normal' },
        { name: '油位', value: 72, unit: '%', threshold: 70, status: 'normal' }
      ],
      trendData: [
        { time: '08:00', value: 2.8 },
        { time: '09:00', value: 2.6 },
        { time: '10:00', value: 2.4 },
        { time: '11:00', value: 2.2 },
        { time: '11:30', value: 2.1 }
      ],
      snapshotTime: '2026-07-02T11:30:00'
    },
    aiAnalysis: {
      summary: '2号辅机润滑油压力持续下降，目前已低于正常范围下限。可能原因包括油泵磨损、滤芯堵塞或管路泄漏。',
      faultTable: [
        { name: '油泵磨损', probability: 'medium', detail: '长期运行导致油泵内部磨损' },
        { name: '滤芯堵塞', probability: 'medium', detail: '润滑油滤芯杂质积累' },
        { name: '管路泄漏', probability: 'low', detail: '管路接头或密封件老化' }
      ],
      suggestions: '建议检查：① 油泵工作状态 ② 滤芯压差 ③ 管路密封性'
    },
    relatedCases: [],
    timeline: [
      { time: '2026-07-02T11:30:00', action: '事件创建（系统自动）' }
    ]
  },
  {
    id: 'EVT-2026-003',
    title: '舵机液压油温度超限',
    system: '甲板机械',
    priority: 'critical',
    status: 'pending',
    createdAt: '2026-07-02T09:15:00',
    source: 'sensor_alarm',
    snapshot: {
      sensors: [
        { name: '液压油温度', value: 78, unit: '°C', threshold: 70, status: 'over' },
        { name: '油位', value: 65, unit: '%', threshold: 70, status: 'warning' },
        { name: '系统压力', value: 12.5, unit: 'MPa', range: '10-15', status: 'normal' }
      ],
      trendData: [
        { time: '06:00', value: 62 },
        { time: '07:00', value: 65 },
        { time: '08:00', value: 68 },
        { time: '09:00', value: 72 },
        { time: '09:15', value: 78 }
      ],
      snapshotTime: '2026-07-02T09:15:00'
    },
    aiAnalysis: {
      summary: '舵机液压油温度快速上升并超过阈值，同时油位偏低。可能原因是冷却系统故障或油液不足导致过热。',
      faultTable: [
        { name: '油冷却器故障', probability: 'high', detail: '冷却器散热不良或堵塞' },
        { name: '油液不足', probability: 'high', detail: '油位低于正常范围，可能导致过热' },
        { name: '系统内泄', probability: 'medium', detail: '液压系统内部泄漏导致能量损失' }
      ],
      suggestions: '立即检查：① 补充液压油至正常油位 ② 检查油冷却器 ③ 监测系统压力变化'
    },
    relatedCases: [],
    timeline: [
      { time: '2026-07-02T09:15:00', action: '事件创建（系统自动）' }
    ]
  },
  {
    id: 'EVT-2026-004',
    title: '3号泵计划维保到期提醒',
    system: '泵系统',
    priority: 'normal',
    status: 'pending',
    createdAt: '2026-07-02T08:00:00',
    source: 'maintenance_schedule',
    snapshot: null,
    aiAnalysis: {
      summary: '3号冷却水泵运行已达500小时，按照维保计划需要进行定期保养，包括更换轴承、清洗叶轮、检查密封件。',
      faultTable: [],
      suggestions: '建议安排下次靠港时进行维保作业'
    },
    relatedCases: [],
    timeline: [
      { time: '2026-07-02T08:00:00', action: '维保提醒生成' }
    ]
  },
  {
    id: 'EVT-2026-005',
    title: '空压机排气压力波动',
    system: '辅机系统',
    priority: 'important',
    status: 'processing',
    createdAt: '2026-07-01T22:40:00',
    source: 'sensor_alarm',
    snapshot: {
      sensors: [
        { name: '排气压力', value: 0.82, unit: 'MPa', range: '0.7-0.85', status: 'warning' },
        { name: '排气温度', value: 65, unit: '°C', range: '60-80', status: 'normal' }
      ],
      trendData: [
        { time: '20:00', value: 0.78 },
        { time: '21:00', value: 0.80 },
        { time: '22:00', value: 0.83 },
        { time: '22:30', value: 0.81 },
        { time: '22:40', value: 0.82 }
      ],
      snapshotTime: '2026-07-01T22:40:00'
    },
    aiAnalysis: {
      summary: '空压机排气压力在正常范围内波动，但波动幅度较大。可能是气阀工作不稳定或负载变化导致。',
      faultTable: [
        { name: '气阀工作不稳定', probability: 'medium', detail: '气阀弹簧疲劳或阀片磨损' },
        { name: '负载变化', probability: 'low', detail: '用气设备启停频繁' }
      ],
      suggestions: '建议观察并记录压力波动规律，必要时检查气阀'
    },
    relatedCases: [],
    timeline: [
      { time: '2026-07-01T22:40:00', action: '事件创建（系统自动）' },
      { time: '2026-07-02T08:00:00', action: '开始排查' }
    ]
  },
  {
    id: 'EVT-2026-006',
    title: '锅炉水位传感器校准提醒',
    system: '辅机系统',
    priority: 'normal',
    status: 'resolved',
    createdAt: '2026-07-01T16:00:00',
    source: 'maintenance_schedule',
    snapshot: null,
    aiAnalysis: {
      summary: '锅炉水位传感器已按计划完成季度校准，读数准确可靠。',
      faultTable: [],
      suggestions: '下次校准时间：2026年10月'
    },
    relatedCases: [],
    timeline: [
      { time: '2026-07-01T16:00:00', action: '校准提醒生成' },
      { time: '2026-07-01T17:00:00', action: '校准完成' },
      { time: '2026-07-01T17:05:00', action: '事件解决' }
    ]
  }
]
