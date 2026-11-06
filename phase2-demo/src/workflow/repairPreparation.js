const unique=values=>[...new Set(values.filter(Boolean))]

// Merge only the known C2 preparation template. Keep isolation as a separate
// operation and retain every assigned requirement, including later additions.
export function compactC2RepairPreparation(event,step){
 if((event?.sourceEventId||event?.id)!=='real-alarm-0430'||step?.label!=='作业准备与安全隔离'||step.substeps?.length!==3)return step
 const [scope,tools,isolation]=step.substeps
 if(scope.label!=='核对异常、批准范围与作业工单'||tools.label!=='准备备件、耗材与检修工具'||isolation.label!=='落实停机隔离与零能量确认')return step
 const preparation={...scope,label:'核对批准范围并备齐工单、备件与工具',guide:unique([scope.guide,tools.guide]).join(' '),checks:unique([...(scope.checks||[]),...(tools.checks||[])]),recordHint:unique([scope.recordHint,tools.recordHint]).join(' ')}
 const substeps=[preparation,isolation]
 return {...step,substeps,recordHint:substeps.map(part=>`${part.label}：${part.recordHint||'记录实际措施与结果。'}`).join('\n')}
}

// Legacy assigned cards remain immutable snapshots. Compact their presentation
// only; submitted records, draft answers and AI proposal baselines stay intact.
export function repairStepForDisplay({event,task,step}){
 return task?.kind==='repair'&&task.status==='assigned'?compactC2RepairPreparation(event,step):step
}
