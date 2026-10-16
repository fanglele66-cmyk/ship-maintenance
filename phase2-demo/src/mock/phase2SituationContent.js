import {maintenanceExample as example} from './maintenanceExample.js'
import { healthReview } from './r05Overview.js'
// Situation reports and companion summaries share the same mock evidence.
// Values are scenario data; no equipment-specific limits are inferred here.
function latestValues(store, id, fallback) {
  return store.observationRecords[id].filter(record => record.values).at(-1)?.values || fallback
}

function followUp(store, id) {
  const result = store.getObservationResult(id)
  const names = { fault: '冷却系统', drift: '3#缸', maintenance: '轴承' }
  if (result.type === 'archive') return `${names[id]}连续观测已满足本轮收束条件，恢复常规监测。`
  if (result.type === 'reinspect') return `${names[id]}处理后出现反复，需要人工复查新证据。`
  if (result.type === 'extend') return `${names[id]}本日可比数据不足，建议延长观察并补齐记录。`
  return `${names[id]}人工处理已完成，持续效果仍由 AI 跟踪。`
}

export function operationAssessment(store) {
  const coolingDone=store.isTaskHandled('fault'),driftDone=store.isTaskHandled('drift'),bearingDone=store.isTaskHandled('maintenance')
  const conclusion=coolingDone?'主机冷却系统已提交处置与验收，研判重点转为同负荷下温度、流量是否持续恢复。其余局部变化需独立验证，不能因为一项任务完成而将整台主机判为恢复正常。':'主机当前同时存在冷却水报警、润滑供油预警、单缸排温偏离及相应的喷油器维保建议。温升与流量下降指向冷却能力受限，优先级最高；单缸相对偏差与部件取证应沿同一档案接续，当前不足以判为同一原因。'
  const basis='润滑油压力0.31→0.24 MPa与滤器压差0.03→0.07 MPa同步变化，需先核对现场仪表一致性，尚不确认堵塞部位。冷却水出口92.4℃、进口48.7℃，温差43.7℃，流量68.2 m³/h低于80 m³/h参考下限，关联信号支持先核对供流与换热。3号缸在可比工况下相对差由8℃扩大至10℃；喷油器维护建议引用原3号缸事件的部件检查，不直接归因于冷却回路。'
  const recommendation=(coolingDone?'先核对冷却系统处置后可比样本是否持续稳定。':store.todoCreated.fault?'查看已派发冷却回路任务的排查进展与现场反馈。':'先查看冷却水报警依据，指定负责人安排排查；随后核对润滑供油预警的真实性与处置范围。')+(driftDone?'3号缸已有人工处理记录，复核后续效果。':store.todoCreated.drift?'3号缸沿已指派任务核对现场读数及可复现现象，避免重复建任务。':store.ignoredSuggestions.drift?'3号缸本次暂不检查的决定已保留，重新出现关联证据时再评估。':'再查看3号缸异动跟踪详情中的变化证据和核实建议，决定是否建立检查待办。')+'喷油器清洁与复校建议由轮机长审阅安排，正式周期计划尚未取得。'
  return {...healthReview, sections:[{title:'跨指标分析与判断边界',paragraphs:[basis]},{title:'当前处置与人员安排',paragraphs:[recommendation]},{title:'什么新证据会改变判断',paragraphs:['若温度与流量在相近负荷下同步恢复，冷却受限方向的支持程度会降低；若单缸排温偏差仍独立扩大，应转向局部燃烧、密封与测量链路的核验。喷油器维护以人员确认的部件证据为依据，效果需处理后可比监测验证。']}], summary:[{label:'综合判断',tone:'blue',text:conclusion},{label:'分析依据',tone:'gray',text:basis},{label:'安排建议',tone:'amber',text:recommendation}], readings:{fault:latestValues(store,'fault',[79.1,86.5]),drift:latestValues(store,'drift',[3,425]),bearing:latestValues(store,'maintenance',[2.2,64])}}

}

export const maintenanceProposalScene={title:'喷油器清洁与复校建议',paragraphs:[{label:'当前建议',text:example.recommendation},{label:'判断边界',text:example.limitation},{label:'数据口径',text:example.provenance}],question:'请轮机长审阅是否安排清洁与复校；沿原3号缸事件接续。'}
export function maintenanceAssessment(store,planned=false){
 const evidence=store.logs.drift.some(m=>m.id==='injector-demo-evidence'),execution=store.executionRecords.drift?.at(-1)
 return {conclusion:planned?example.plan.basis:execution?`实际措施：${execution.values.measures}；效果另行验证。`:evidence?example.conclusion:'原事件的部件取证尚未确认。',recommendation:planned?example.plan.note:example.recommendation,sections:[{title:'依据来源',paragraphs:[example.provenance,example.limitation]},{title:'安排边界',paragraphs:[example.plan.basis,example.plan.note]}]}
}
