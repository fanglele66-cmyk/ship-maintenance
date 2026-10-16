import { observationConfig } from './phase2Observation.js'

// R03 presentation of existing demo end states; no new detection or closure rule.
export function attentionClosure(store, id, timeline = []) {
  if (store.attentionAction(id).phase !== '已结束') return null
  const boundary = '仅针对本档案关注的问题；档案及原始记录保留，恢复常规监测，不代替关联事件关闭或正式工单完成。'
  const limit = '本轮结束仅针对已跟踪指标；未覆盖部位仍需按原有巡检要求检查。'
  if (store.isTaskHandled(id)) {
    const result=store.getObservationResult(id),records=store.observationRecords[id],config=observationConfig[id]
    if (result.type !== 'archive' || !records.length || !config) return null
    const latest=records.at(-1)
    return {reason:'处理后恢复正常',at:latest.label,summary:'实际处理完成后，后续可比观测支持原问题已解决，系统确认事项结束。',
      basis:[config.basis,result.text],
      coverage:`现有记录：${records.map(record=>record.label).join('、')}；观察目标 ${store.observationTargets[id]*24} 小时。`,limit,boundary}
  }
  const last=timeline.at(-1)
  if (id==='cyl2-ended') return {reason:'持续监测确认恢复正常',at:last?.at || '最近有效可比片段',summary:'2#缸原反复偏差在后续有效可比片段中收敛，未再反复出现；本轮观察结束，恢复常规监测。',
    basis:['最初多个独立可比片段反复偏离且不同于此前表现，形成关注依据；偏差开始收敛时仍继续观察。','后续可比片段中原偏差不再反复出现，且没有新增相关异常证据；不是数据中断、没有回复或工单完成导致结束。本轮没有检修。'],coverage:'近72小时6个有效可比片段；缸间差收敛至2–3°C，数据有效覆盖率98.6%。',limit,boundary}
  if (id==='stable') return {reason:'持续监测确认恢复正常',at:last?.at || '第3日 · 同工况复测',summary:'后续可比观测支持泵出口压力波动已恢复正常，系统确认事项结束。',
    basis:['出口压力波动由0.38–0.41 MPa收敛至0.39–0.40 MPa，关联流量和冷却水温未出现异常变化。','后续可比记录支持压力波动收敛；不能仅凭“未扩大”判定事项结束。'],coverage:'第1日至第3日的同工况观测记录；只有压力区间及关联量文字记录。',limit,boundary}
  return null
}
