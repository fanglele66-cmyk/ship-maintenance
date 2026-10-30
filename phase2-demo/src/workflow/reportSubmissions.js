// Reports are immutable submission snapshots, not live views of a mutable task.
const copy=value=>JSON.parse(JSON.stringify(value))
export const reportContextVersion=2
export const taskReports=(event,taskId)=>event.reports.filter(r=>r.taskId===taskId)
export function submissionNumber(event,task,reportId){
 const reports=taskReports(event,task.id),index=reports.findIndex(r=>r.id===reportId)
 return index<0?reports.length+1:reports[index].submissionNumber||index+1
}
export function submissionTitle(event,task,number){
 const kind=task.purpose==='recheck'?'复查报告':task.kind==='investigation'?'排查报告':task.kind==='maintenance'?'维保作业报告':'维修报告'
 return `${event.title} · 第${task.round}轮${kind} · 第${number}次提交${number>1?'（恢复后）':''}`
}
export function submissionSnapshot(task){
 return copy(Object.fromEntries(['id','kind','purpose','round','owner','scope','steps','records','summary','attachments','maintenance','assignedAt','deadline','submittedAt','resumedAt'].filter(key=>task[key]!==undefined).map(key=>[key,task[key]])))
}
export function reportTask(event,report){
 const task=event.tasks.find(t=>t.id===report.taskId)
 if(!task)return null
 if(report.submissionSnapshot)return {...task,...copy(report.submissionSnapshot)}
 const old=task.feedbackHistory?.find(h=>h.reportId===report.id)
 if(old)return {...task,...copy(old.draft),submittedAt:old.at,generatedReport:undefined}
 return taskReports(event,task.id).at(-1)?.id===report.id?task:null
}
export function refreshSubmissionLabels(event){
 for(const task of event.tasks){
  const reports=taskReports(event,task.id)
  reports.forEach((report,index)=>{
   const number=index+1,title=submissionTitle(event,task,number),source=reportTask(event,report)
   report.submissionNumber=number;report.title=title
   if(report.markdown)report.markdown=report.markdown.replace(/^# [^\n]+/,()=>`# ${title}`)
   if(!report.submissionSnapshot&&source)report.submissionSnapshot=submissionSnapshot(source)
   for(const phase of event.phases)if(phase.reportId===report.id&&['decision','review'].includes(phase.kind)){
    phase.label=`${task.kind==='investigation'?'排查后决策':'结果处置'} · 第${number}次`
   }
  })
 }
}
// Current analysis receives only the most recent report of each task. Earlier
// submissions remain accessible in the UI, never fed back as current evidence.
export function currentReportContext(event,{excludeTaskId}={}){
 return event.reports.filter((r,i,all)=>(!excludeTaskId||r.taskId!==excludeTaskId)&&(!r.taskId||!all.slice(i+1).some(next=>next.taskId===r.taskId))).map(r=>({id:r.id,taskId:r.taskId,title:r.title,at:r.at,submissionNumber:r.submissionNumber,kind:r.kind,summary:r.summary,markdown:r.markdown}))
}
export function submissionContext(event,task,reportId){
 const number=submissionNumber(event,task,reportId),previous=taskReports(event,task.id).slice(0,number-1)
 return {
  submissionNumber:number,submittedAt:task.submittedAt,resumedAt:task.resumedAt||null,
  authority:'本次逐项结果、备注和执行人汇总是当前事实。恢复前的未完成状态是历史；本次明确完成的项目已更新，不属于记录冲突。不适用表示本项无需执行。',
  previousSubmissions:previous.map(r=>({id:r.id,title:r.title,at:r.at})),
  changes:previous.length?(task.records||[]).map((r,i)=>{
   const old=reportTask(event,previous.at(-1))?.records?.[i]
   return {项目:r.label,上次结果:old?.result||'未记录',本次结果:r.result,本次备注:r.note||''}
  }):[]
 }
}
