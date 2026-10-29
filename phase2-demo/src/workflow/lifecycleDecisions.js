export const isAbnormalResult=record=>/发现异常|读数不一致|偏离仍存在/.test(record.result||'')
export const hasAbnormalFindings=task=>(task?.records||[]).some(isAbnormalResult)
export function lifecycleDecisionOptions(event){
 const shore={value:'shore',label:'同步岸基'}
 if(event.phase==='closed')return [shore]
 if(event.phase==='reminder')return [{value:'investigate',label:'派发排查'},{value:'false',label:'确认误报'},shore]
 const task=event.tasks.find(t=>t.id===event.currentTask)
 if(task?.status==='assigned')return [shore]
 if(event.phase==='review')return [{value:'close',label:'闭环'},{value:'recheck',label:'派发复查'},shore]
 if(event.phase==='decision')return [...(hasAbnormalFindings(task)?[{value:'repair',label:'派发维修'}]:[{value:'investigate',label:'继续排查'}]),shore]
 return [shore]
}
export const dispatchAction=event=>lifecycleDecisionOptions(event).find(o=>['investigate','repair','maintenance','recheck'].includes(o.value))?.value
export const taskName=task=>task?.purpose==='recheck'?'复查':task?.kind==='investigation'?'排查':task?.kind==='maintenance'?'维保':'维修'
