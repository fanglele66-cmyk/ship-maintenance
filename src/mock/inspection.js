/**
 * 巡检报告 Mock 数据 — 从 V1.0 迁移
 */
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

/** 巡检报告详情 */
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
          title: '2#缸排温异常偏高',
          text: 'AI排温异常，超出范围（50~400℃上限），较平均温度高11℃。问题原因：燃烧不充分，缸内积碳。建议检查喷油器供油量是否偏大及雾化情况。'
        },
        {
          icon: 'mdi:alert', type: 'warn',
          title: '涡轮增压效率下降',
          text: '涡轮转速6000RPM，压比84.9%（正常85~94%），扫气压力为1.18bar偏低，预测增压器效率0.38bar低于OEM限值1.8bar。建议检查叶片和叶轮磨损情况。'
        },
        {
          icon: 'mdi:information', type: 'info',
          title: '液压系统压力略低',
          text: '液压泵压力1.18MPa，标准范围1.2~1.5MPa，已低于下限。虽未触发报警，但若长期处于该低值可能加速部件磨损，建议下次进港时检查管路密封件。'
        }
      ]
    },
    systems: [
      {
        name: '主机系统', level: 'warn', statusText: '1项需关注', icon: 'mdi:engine',
        items: [
          { name: '1#缸排气温度', unit: '℃', value: '342', range: '50 ~ 400', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '2#缸排气温度', unit: '℃', value: '387', range: '50 ~ 400', status: 'warning', statusText: '⚠ 关注', remark: '偏高，较均值高17℃，建议检查喷油嘴' },
          { name: '3#缸排气温度', unit: '℃', value: '338', range: '50 ~ 400', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '4#缸排气温度', unit: '℃', value: '345', range: '50 ~ 400', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '主轴承温度', unit: '℃', value: '72', range: '60 ~ 150', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '增压器转速', unit: 'rpm', value: '18,200', range: '17,000 ~ 19,000', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '扫气温度', unit: '℃', value: '42', range: '30 ~ 55', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '扫气压力', unit: 'bar', value: '0.37', range: '0.20 ~ 0.45', status: 'warning', statusText: '⚠ 关注', remark: '偏低，可能与空冷器脏堵相关' }
        ]
      },
      {
        name: '辅机系统', level: 'ok', statusText: '全部正常', icon: 'mdi:power-plug',
        items: [
          { name: '1号辅机冷却水温', unit: '℃', value: '78', range: '70 ~ 85', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '1号辅机滑油压力', unit: 'MPa', value: '0.38', range: '0.30 ~ 0.45', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '2号辅机冷却水温', unit: '℃', value: '80', range: '70 ~ 85', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '2号辅机滑油压力', unit: 'MPa', value: '0.36', range: '0.30 ~ 0.45', status: 'normal', statusText: '✓ 正常', remark: '' }
        ]
      },
      {
        name: '泵系统', level: 'ok', statusText: '全部正常', icon: 'mdi:water-pump',
        items: [
          { name: '1号冷却水泵流量', unit: 'm³/h', value: '12.5', range: '8 ~ 15', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '2号冷却水泵流量', unit: 'm³/h', value: '11.8', range: '8 ~ 15', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '3号冷却水泵流量', unit: 'm³/h', value: '10.2', range: '8 ~ 15', status: 'normal', statusText: '✓ 正常', remark: '' }
        ]
      },
      {
        name: '甲板机械', level: 'ok', statusText: '全部正常', icon: 'mdi:anchor',
        items: [
          { name: '舵机油温', unit: '℃', value: '48', range: '40 ~ 65', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '舵机系统压力', unit: 'MPa', value: '14.2', range: '12 ~ 16', status: 'normal', statusText: '✓ 正常', remark: '' },
          { name: '锚机油位', unit: '%', value: '72', range: '50 ~ 90', status: 'normal', statusText: '✓ 正常', remark: '' }
        ]
      }
    ]
  }
}
