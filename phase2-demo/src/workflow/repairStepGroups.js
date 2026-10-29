export const maxRepairFeedbackSteps=4
export const repairFeedbackVersion=1
const clone=value=>JSON.parse(JSON.stringify(value))

// Combine contiguous operations, retaining every method and record requirement.
export function groupRepairSteps(steps){
 if(steps.length<=maxRepairFeedbackSteps)return clone(steps)
 const execution=steps.findIndex((s,i)=>i>0&&/标识|拆|实施|修复|清洁|处理|更换|检修|送修/.test(s.label)&&!/核对|范围|隔离|准备/.test(s.label))
 const restoration=steps.findIndex((s,i)=>i>execution&&/复装|恢复|试验|复测|试运行|验证/.test(s.label)&&!/交接|整理/.test(s.label))
 const handoff=steps.findIndex((s,i)=>i>restoration&&/交接|汇总|报告|整理|观察/.test(s.label))
 const semantic=execution>0&&restoration>execution&&handoff>restoration
 const bounds=semantic?[0,execution,restoration,handoff,steps.length]:[0,1,2,3,steps.length]
 const labels=['作业准备与安全隔离','实施维修与过程记录','复装与分阶段试验','交接与效果观察']
 return bounds.slice(0,-1).map((start,i)=>{
  const substeps=clone(steps.slice(start,bounds[i+1]))
  return {label:semantic?labels[i]:i<3?substeps[0].label:'后续作业与复核',guide:substeps.length>1?'按以下顺序完成本项作业，再统一填写本项结果；未完成或不适用的子项请在备注中注明。':substeps[0].guide,checks:[],recordHint:substeps.map(s=>`${s.label}：${s.recordHint||'记录实际措施与结果。'}`).join('\n'),options:['已完成','未完成','不适用'],substeps,sourceIndices:Array.from({length:bounds[i+1]-start},(_,n)=>start+n)}
 })
}

export function mergeRepairRecords(groups,records){
 return groups.map(group=>{
  const original=(group.sourceIndices||[]).map(i=>records[i]).filter(Boolean),complete=original.length===(group.sourceIndices||[]).length&&original.every(r=>r.result)
  const result=complete?(original.some(r=>r.result==='未完成')?'未完成':original.every(r=>r.result==='不适用')?'不适用':'已完成'):''
  return {label:group.label,result,note:original.filter(r=>r.result||r.note).map(r=>`${r.label} · ${r.result||'待反馈'}${r.note?'\n'+r.note:''}`).join('\n\n'),subrecords:clone(original)}
 })
}

export function compactAssignedRepair(task){
 if(!['repair','maintenance'].includes(task.kind)||task.status!=='assigned'||task.steps.length<=maxRepairFeedbackSteps)return false
 task.feedbackHistory=[...(task.feedbackHistory||[]),{at:new Date().toISOString(),steps:clone(task.steps),draft:clone(task.draft)}]
 const groups=groupRepairSteps(task.steps),oldIndex=task.draft.stepIndex||0
 task.steps=groups;task.draft={...task.draft,records:mergeRepairRecords(groups,task.draft.records),stepIndex:Math.max(0,groups.findIndex(g=>g.sourceIndices.includes(oldIndex)))};task.feedbackVersion=repairFeedbackVersion
 return true
}
