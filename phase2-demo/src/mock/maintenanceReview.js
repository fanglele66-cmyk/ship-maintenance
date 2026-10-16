import {maintenanceExample as example} from './maintenanceExample.js'
// Read-only projection. Evidence belongs to the original event; advice never creates another event.
export function maintenanceReview(core,advice,orderInfo={}) {
 const id=example.sourceEventId,checks=(core.logs[id]||[]).filter(m=>m.kind==='feedbackRecord')
 const execution=core.executionRecords[id]?.at(-1),checked=advice.sufficient,linked=Boolean(core.todoCreated[id])
 const decisions=[...advice.records.map(r=>({...r,source:'维保建议决定'})),...(core.assignmentRecords?.[id]||[]).map((r,i)=>({id:'assignment-'+i,label:'前置取证派工',at:r.at,text:`${r.assignedBy}指定${r.owner}：${r.scope}`,source:'原事件安排'}))]
 return {...example,plan:example.plan,status:advice.status,checked,execution,checks,decisions,linked,
  conclusion:execution?`已取得实际执行记录：${execution.values.measures}。效果仍以有效可比观测为准。`:checked?example.conclusion:'前置部件检查尚未经确认，暂不能据排温偏差采纳具体维护措施。',
  recommendation:checked?example.recommendation:'先在原3号缸事件中确认读数与部件检查报告，再审阅维护建议。',
  snapshots:example.snapshots.map(s=>s.name==='部件取证'&&!checked?{...s,value:'待确认',meaning:'不得以阶段推进替代人员确认'}:s.name==='作业安排'&&advice.decision?{...s,value:advice.decision==='execute'?'已采纳 · 待实施':'暂不采纳',meaning:'人员决定已记录；实际时间与作业条件另行确认'}:s),
  origins:checked?example.origins:example.origins.slice(0,2),assignment:core.assignments?.[id],order:orderInfo.linked,
  observationReady:Boolean(execution?.values.completion==='completed'&&core.executionObservationReady(id)),observations:core.observationRecords[id]||[]}
}
