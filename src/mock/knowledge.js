/**
 * 知识库 Mock 数据 - 船舶设备检修标准知识库
 */
export const mockKnowledge = [
  {
    id: 1,
    system: '主机系统',
    component: '气缸盖',
    standard: '气缸盖触火面检查，不得有裂纹、拉毛或异常磨损',
    status: 'ok',
    statusText: '正常'
  },
  {
    id: 2,
    system: '主机系统',
    component: '燃油喷油器',
    standard: '启阀压力及雾化状态检查，喷油嘴不得有滴油、启阀压力不均现象',
    status: 'warn',
    statusText: '需关注'
  },
  {
    id: 3,
    system: '轴系及推进',
    component: '尾轴密封装置',
    standard: '防油污密封漏油量检查，每小时漏油量不得超过航行规定阈值',
    status: 'bad',
    statusText: '异常'
  },
  {
    id: 4,
    system: '船舶辅机',
    component: '副骨架/发电机',
    standard: '绝缘电阻测量，热态绝缘电阻值不得低于 1MΩ',
    status: 'ok',
    statusText: '正常'
  },
  {
    id: 5,
    system: '甲板机械',
    component: '锚机液压系统',
    standard: '工作油压与油质检查，油液不得有乳化、金属颗粒杂质',
    status: 'warn',
    statusText: '待检测'
  }
]

/** 系统筛选项 */
export const systemFilters = ['全部', '主机系统', '轴系及推进', '船舶辅机', '甲板机械']

/** 状态颜色映射 */
export const statusStyleMap = {
  ok:   { bg: '#52c41a1f', color: '#52c41a', cls: 'sts-ok' },
  warn: { bg: '#faad141f', color: '#faad14', cls: 'sts-warn' },
  bad:  { bg: '#ff4d4f1f', color: '#ff4d4f', cls: 'sts-bad' }
}
