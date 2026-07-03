/**
 * 事件 Mock 数据
 * 每条事件携带快照数据、AI 诊断、关联案例、处理时间线
 */
export const mockEvents = [
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
        { name: '冷却水流量', value: 68.2, unit: 'm³/h', threshold: 80, status: 'over' },
        { name: '膨胀水箱液位', value: 72.5, unit: '%', range: '50-90', status: 'normal' },
        { name: '主机转速', value: 450, unit: 'rpm', threshold: 500, status: 'normal' }
      ],
      trendData: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        value: 72 + Math.sin(i / 3) * 5 + (i >= 20 ? (i - 20) * 2 : 0)
      })),
      snapshotTime: '2026-07-02T14:05:00'
    },
    aiAnalysis: {
      summary: '冷却水温差异常偏大（43.7°C），高度怀疑冷却系统存在堵塞或热交换器效率下降。',
      faultTable: [
        { name: '海水冷却管路堵塞', probability: 'high', detail: '管路压差增大，流量偏低，典型堵塞特征' },
        { name: '淡水冷却侧水垢', probability: 'medium', detail: '温差大但进口温度正常，可能是换热面结垢' },
        { name: '温控阀故障', probability: 'low', detail: '温控阀卡滞在开度较小位置，需检查执行机构' }
      ],
      suggestions: '建议优先检查：① 海水冷却管路 ② 淡水冷却侧水垢 ③ 温控阀工作状态'
    },
    relatedCases: [
      { title: '2026-05 主机冷却水系统堵塞案例', id: 'case-001' }
    ],
    timeline: [
      { time: '2026-07-02T14:05:00', action: '事件创建（系统自动）' },
      { time: '2026-07-02T14:05:10', action: '快照数据冻结完成' },
      { time: '2026-07-02T14:05:15', action: 'AI 诊断完成' }
    ]
  },
  {
    id: 'EVT-2026-002',
    title: '2号辅机油压偏低预警',
    system: '辅机系统',
    priority: 'normal',
    status: 'pending',
    createdAt: '2026-07-02T11:30:00',
    source: 'sensor_alarm',
    snapshot: {
      sensors: [
        { name: '机油压力', value: 0.18, unit: 'MPa', threshold: 0.25, status: 'over' },
        { name: '机油温度', value: 68.5, unit: '°C', threshold: 75, status: 'normal' },
        { name: '机油滤器压差', value: 0.08, unit: 'MPa', threshold: 0.05, status: 'over' },
        { name: '油底壳液位', value: 82.0, unit: '%', range: '60-90', status: 'normal' },
        { name: '机油泵出口压力', value: 0.35, unit: 'MPa', range: '0.3-0.5', status: 'normal' },
        { name: '轴瓦温度', value: 52.3, unit: '°C', threshold: 65, status: 'normal' }
      ],
      trendData: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        value: 0.28 + Math.sin(i / 4) * 0.03 - (i >= 16 ? (i - 16) * 0.01 : 0)
      })),
      snapshotTime: '2026-07-02T11:30:00'
    },
    aiAnalysis: {
      summary: '机油压力偏低（0.18MPa）且滤器压差偏高，可能为滤器堵塞导致供油不畅。',
      faultTable: [
        { name: '机油滤器堵塞', probability: 'high', detail: '滤器压差0.08MPa超出正常范围，需清洗或更换滤芯' },
        { name: '机油泵磨损', probability: 'medium', detail: '泵出口压力正常但系统压力低，可能内部泄漏' },
        { name: '机油管路渗漏', probability: 'low', detail: '检查管路接头和密封件' }
      ],
      suggestions: '建议优先检查机油滤器压差，如确认堵塞需清洗滤器并检查机油品质。'
    },
    relatedCases: [],
    timeline: [
      { time: '2026-07-02T11:30:00', action: '事件创建（系统自动）' },
      { time: '2026-07-02T11:30:05', action: '快照数据冻结完成' }
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
        { name: '液压油温度', value: 78.0, unit: '°C', threshold: 65, status: 'over' },
        { name: '液压油压力', value: 12.5, unit: 'MPa', range: '10-16', status: 'normal' },
        { name: '舵角反馈', value: 15.0, unit: '°', range: '-35-35', status: 'normal' },
        { name: '油位', value: 68.0, unit: '%', range: '50-85', status: 'normal' },
        { name: '液压油流量', value: 45.2, unit: 'L/min', range: '35-60', status: 'normal' },
        { name: '冷却水温度', value: 38.5, unit: '°C', threshold: 40, status: 'normal' }
      ],
      trendData: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        value: 55 + Math.sin(i / 2) * 5 + (i >= 8 ? (i - 8) * 1.5 : 0)
      })),
      snapshotTime: '2026-07-02T09:15:00'
    },
    aiAnalysis: {
      summary: '舵机液压油温度78°C，超65°C阈值。持续高温会加速油液老化，影响密封件寿命。',
      faultTable: [
        { name: '液压油冷却器效率下降', probability: 'high', detail: '冷却水温正常但油温持续上升，可能是冷却器内部结垢' },
        { name: '液压系统过载', probability: 'medium', detail: '检查舵机负荷是否异常增大' },
        { name: '油液变质或不足', probability: 'low', detail: '检查油液颜色、气味和粘度' }
      ],
      suggestions: '建议优先检查液压油冷却器工作状态，清洗冷却器并检查油液品质。'
    },
    relatedCases: [
      { title: '舵机液压油温度过高处理流程', id: 'case-004' }
    ],
    timeline: [
      { time: '2026-07-02T09:15:00', action: '事件创建（系统自动）' },
      { time: '2026-07-02T09:15:05', action: '快照数据冻结完成' }
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
    snapshot: {
      sensors: [
        { name: '累计运行时间', value: 505, unit: 'h', threshold: 500, status: 'over' },
        { name: '振动值', value: 3.2, unit: 'mm/s', threshold: 7.1, status: 'normal' },
        { name: '轴承温度', value: 42.5, unit: '°C', threshold: 65, status: 'normal' },
        { name: '机械密封状态', value: '正常', unit: '', status: 'normal' },
        { name: '电机电流', value: 22.5, unit: 'A', threshold: 30, status: 'normal' },
        { name: '出口压力', value: 0.35, unit: 'MPa', range: '0.25-0.45', status: 'normal' }
      ],
      trendData: [],
      snapshotTime: '2026-07-02T08:00:00'
    },
    aiAnalysis: {
      summary: '3号冷却泵累计运行505小时，超过500小时维保周期，需安排定期保养。',
      faultTable: [],
      suggestions: '建议安排：① 更换机油和滤芯 ② 检查机械密封 ③ 测量绝缘电阻 ④ 填写维保记录'
    },
    relatedCases: [
      { title: '冷却水泵定期保养操作指南', id: 'case-007' }
    ],
    timeline: [
      { time: '2026-07-02T08:00:00', action: '维保提醒（系统定时触发）' }
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
        { name: '排气压力', value: 0.82, unit: 'MPa', range: '0.75-0.85', status: 'warning' },
        { name: '排气温度', value: 65.0, unit: '°C', threshold: 70, status: 'normal' },
        { name: '冷却水温', value: 38.2, unit: '°C', threshold: 45, status: 'normal' },
        { name: '润滑油压', value: 0.32, unit: 'MPa', threshold: 0.25, status: 'normal' },
        { name: '润滑油温', value: 58.5, unit: '°C', threshold: 65, status: 'normal' },
        { name: '振动', value: 4.5, unit: 'mm/s', threshold: 7.1, status: 'normal' }
      ],
      trendData: Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        value: 0.78 + Math.sin(i / 2) * 0.04
      })),
      snapshotTime: '2026-07-01T22:40:00'
    },
    aiAnalysis: {
      summary: '排气压力在0.78-0.85MPa之间波动，可能存在进气阀或排气阀工作不稳定。',
      faultTable: [
        { name: '进气阀积碳', probability: 'high', detail: '阀片关闭不严导致压力波动' },
        { name: '排气阀弹簧疲劳', probability: 'medium', detail: '弹簧刚度下降，阀门动作异常' },
        { name: '安全阀微漏', probability: 'low', detail: '安全阀设定压力偏低或密封面损伤' }
      ],
      suggestions: '建议检查进气阀和排气阀的工作状态，清洗阀片积碳，检查弹簧弹性。'
    },
    relatedCases: [
      { title: '空压机排气压力波动分析', id: 'case-005' }
    ],
    timeline: [
      { time: '2026-07-01T22:40:00', action: '事件创建（系统自动）' },
      { time: '2026-07-01T22:40:10', action: '快照数据冻结完成' },
      { time: '2026-07-02T08:30:00', action: '用户开始处理' }
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
    snapshot: {
      sensors: [
        { name: '水位', value: 72.0, unit: '%', range: '40-85', status: 'normal' },
        { name: '蒸汽压力', value: 0.7, unit: 'MPa', range: '0.5-0.8', status: 'normal' },
        { name: '给水温度', value: 85.0, unit: '°C', threshold: 90, status: 'normal' },
        { name: '炉膛温度', value: 680, unit: '°C', threshold: 750, status: 'normal' },
        { name: '排烟温度', value: 185, unit: '°C', threshold: 200, status: 'normal' },
        { name: '燃料流量', value: 125, unit: 'kg/h', range: '100-160', status: 'normal' }
      ],
      trendData: [],
      snapshotTime: '2026-07-01T16:00:00'
    },
    aiAnalysis: {
      summary: '季度水位传感器校准提醒，当前水位读数正常但已到校准周期。',
      faultTable: [],
      suggestions: '建议执行锅炉水位传感器季度校准流程，记录校准前后偏差值。'
    },
    relatedCases: [
      { title: '锅炉水位传感器校准规程', id: 'case-008' }
    ],
    timeline: [
      { time: '2026-07-01T16:00:00', action: '校准提醒（系统定时触发）' },
      { time: '2026-07-02T10:00:00', action: '用户标记已处理，校准完成' }
    ]
  }
]

export const eventStatusLabels = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决'
}

export const eventPriorityLabels = {
  critical: '紧急',
  important: '重要',
  normal: '一般'
}

export const eventSourceLabels = {
  sensor_alarm: '传感器告警',
  manual_report: '人工上报',
  maintenance_schedule: '维保计划',
  situation_referral: '态势感知跳转'
}
