import { operationAssessment, maintenanceAssessment } from './phase2SituationContent'

export const historyCategories = [
  { id: 'all', label: '全部记录' },
  { id: 'maintenance', label: '实际维护记录' },
  { id: 'event', label: '检查与处置事件' },
  { id: 'attention', label: '历史关注事项' },
  { id: 'recommendation', label: '维保建议记录' },
  { id: 'review', label: '每日健康回顾' }
]

// Reuse the task and attention state. A proposed action never becomes an
// executed maintenance record until that task reaches effect observation.
export function deviceHistory(store) {
  const records = []
  for (const id of ['fault', 'maintenance', 'drift']) {
    if (!store.todoCreated[id]) continue
    const item = store.cases[id], index = store.progress[id], stage = item.stages[index]
    records.push({ id: `event-${id}`, type: 'event', date: '10月08日', time: '10:30', title: id === 'drift' && index >= 2 ? item.eventTitle : item.initialTitle, status: store.isTaskHandled(id)?'已处理':stage.label, source: '待办中心 · 阶段记录', target: id,
      summary: store.isTaskHandled(id)?'现场措施与验收已提交，持续效果由设备态势接续。':stage.summary, conclusion: store.isTaskHandled(id)?'本轮人工处理已完成；原证据、实际措施和反馈保留在来源事件中，后续观测与同一事项关联。':stage.summary,
      recommendation: store.isTaskHandled(id) ? '回看人工处理记录；处理后的持续效果在设备态势查看。' : '打开关联待办，继续当前阶段的现场确认与处理。',
      sections: [{ title: '来源与关联证据', paragraphs: [id === 'drift' ? '来源于3#缸排温关注。同工况偏差8→10°C及后续现场反馈沿同一材料接续，检查用于确认异动是否真实，事件确立后再排查原因。' : id === 'maintenance' ? '来源于1#缸轴承提前维保建议。趋势数据、周期计划和现场检查共同支持提前保养决策。' : '冷却水温升高与流量下降共同触发故障待办，后续排查、维修及效果观察均关联本事件。', ...stage.evidence] }] })
    const observeIndex = item.stages.findIndex(entry => entry.kind === 'observe')
    if (index >= observeIndex) {
      const work = item.stages[observeIndex - 1]
      const feedback = store.logs[id].filter(entry => entry.kind === 'feedbackRecord' && entry.task === work.title).slice(-1).flatMap(entry => (entry.records || []).map(record => record.result))
      records.push({ id: `work-${id}`, type: 'maintenance', date: '10月08日', time: '10:20', title: work.title, status: '已完成作业', source: '待办作业反馈 · 人员确认', target: id,
        summary: feedback.length ? feedback.join('；') : work.evidence.join('；'), conclusion: '现场作业已提交并进入效果观察。实际处理记录与关联待办保留在一起，完成作业不代表效果已持续稳定。',
        recommendation: '在设备态势回看关联的效果观察，核对同工况数据及原异常是否反复。',
        sections: [{ title: '实际作业与反馈', paragraphs: feedback.length ? feedback : work.evidence }, { title: '效果验证', paragraphs: store.observationRecords[id].map(record => `${record.label}：${record.values?.join(' / ') || '待补齐数据'}；${record.note}`) }] })
    }
  }
  const maintenance = maintenanceAssessment(store)
  records.push({ id: 'recommendation-maintenance', type: 'recommendation', date: '10月08日', time: '08:10', title: '1#缸连杆轴承提前维保建议', status: store.isTaskHandled('maintenance') ? '已执行 · ' + store.getObservationResult('maintenance').title : store.todoCreated.maintenance ? '已关联待办' : '待确认建议', source: '维保建议 · 计划与趋势分析', target: 'maintenance', summary: '近7日振动2.1→3.0 mm/s；距周期检修约140 h，结合约48小时后的靠港窗口评估提前检查。', conclusion: maintenance.conclusion, recommendation: maintenance.recommendation, sections: maintenance.sections })

  records.push({id:'ended-cyl2',type:'attention',date:'10月07日',time:'观察结束',title:'2#缸排温反复偏差观察收束',status:'观察已结束',source:'AI 定性演示阶段',target:'cyl2-ended',summary:'最初反复偏离不同于此前表现，后续有效可比片段收敛，原偏差未再反复出现。',conclusion:'本轮专项观察结束，没有检修执行；不代表整台主机健康。',recommendation:'恢复常规监测，保留历史；新的持续变化重新评估。',sections:[{title:'结束依据',paragraphs:['先有反复偏差的关注依据，开始收敛时仍继续观察；后续有效可比证据支持结束。','不是固定三轮或数据中断导致结束；原始采样及正式判据未接入。']}]})
  const assessment = operationAssessment(store)
  records.push({ id: 'review-today', type: 'review', date: '10月08日', time: '08:00', title: '主机每日健康回顾', status: '今日回顾', source: 'AI 健康分析 · 监测与已确认反馈', summary: assessment.conclusion, conclusion: assessment.conclusion, recommendation: assessment.recommendation, sections: assessment.sections })

  return records.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
}
