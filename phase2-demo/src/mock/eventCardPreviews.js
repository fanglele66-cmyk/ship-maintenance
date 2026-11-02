// Presentation-only examples: these cards have no detail route or lifecycle tasks.
export const eventCardPreviews = [
  {
    id: 'preview-aux-oil-pressure', number: 'CBY-EVT-20261102-005',
    title: '1号辅机滑油压力偏低核查', type: '预警事件', rank: 1,
    device: '1号辅机', eventState: '待决策', stage: '风险提醒',
    summary: '海上稳态航行、辅机持续供电期间，1号辅机滑油压力低于近期同负荷水平，滑油温度未同步升高。优先核对就地压力与滤器前后读数，确认测量偏差或供油变化。',
    taskOwner: '陈志远（轮机长）', firstObserved: '2026-11-02 14:18',
    progressNote: '已汇集滑油压力、温度与发电负荷变化，等待轮机长确认排查安排。',
    continuation: '待核对测点与运行背景，尚未建立人工执行任务。', cardOnly: true,
  },
  {
    id: 'preview-main-scavenge', number: 'CBY-EVT-20261102-006',
    title: '主机扫气压力相对基线下移跟踪', type: '异动跟踪', rank: 2,
    device: '主机', eventState: '待决策', stage: '风险提醒',
    summary: '主机在约70%负荷稳态航行时，扫气压力较近期同工况基线小幅下移，各缸排温整体变化一致。结合增压器运行、扫气温度及负荷记录，继续核对偏差是否持续。',
    taskOwner: '陈志远（轮机长）', firstObserved: '2026-11-02 14:36',
    progressNote: '已整理可比工况下的趋势差异，等待轮机长确认跟踪与核查范围。',
    continuation: '保留趋势变化与工况对应关系，现场原因尚待核实。', cardOnly: true,
  },
]
