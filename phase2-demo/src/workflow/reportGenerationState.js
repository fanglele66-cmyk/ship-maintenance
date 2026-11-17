// Execution and optional AI enrichment have independent lifecycles.
export const reportGenerationStatus=task=>task?.reportGeneration?.status||(task?.status==='reporting'?'streaming':task?.status==='report-error'?'error':'')
export function normalizeSubmittedTask(event,task){
 if(['reporting','report-error'].includes(task.status)&&task.submittedAt&&event.reports?.some(r=>r.taskId===task.id)){
  task.reportGeneration||={}
  task.reportGeneration.status||=task.status==='reporting'?'streaming':'error'
  task.status='submitted'
 }
}
export function generationReport(event,task){
 const generation=task?.reportGeneration
 const report=event?.reports.find(r=>r.id===generation?.factReportId&&r.taskId===task.id)
 if(!report)return null
 if(generation.submissionNumber!==undefined&&report.submissionNumber!==generation.submissionNumber)return null
 if(generation.baseMarkdown!==undefined&&report.markdown!==generation.baseMarkdown)return null
 return report
}

// Stream deltas belong to the generating page. Persist the start/final result,
// not a whole shared event for every token (which can overwrite another editor).
export function persistedEvent(event){
 const value=JSON.parse(JSON.stringify(event))
 for(const task of value.tasks||[])if(reportGenerationStatus(task)==='streaming'){
  if(task.reportGeneration){delete task.reportGeneration.patch;delete task.reportGeneration.progress}
  for(const messages of Object.values(task.conversations||{}))for(const message of messages)if(message.id==='report-'+task.reportGeneration?.requestId&&message.status==='streaming'){
   message.reasoning='';message.generatedReport={summary:'',analysis:{}};message.progressLog=[];delete message.progress;delete message.sources
  }
 }
 return value
}
export function preserveReportStream(local,incoming){
 for(const task of incoming.tasks||[]){
  const prior=local?.tasks?.find(t=>t.id===task.id)
  if(!prior||reportGenerationStatus(prior)!=='streaming'||reportGenerationStatus(task)!=='streaming'||!prior.reportGeneration?.requestId||prior.reportGeneration.requestId!==task.reportGeneration?.requestId)continue
  for(const field of ['patch','progress'])if(prior.reportGeneration[field])task.reportGeneration[field]=prior.reportGeneration[field]
  for(const [role,messages] of Object.entries(task.conversations||{})){
   const i=messages.findIndex(m=>m.id==='report-'+task.reportGeneration.requestId)
   const live=prior.conversations?.[role]?.find(m=>m.id==='report-'+task.reportGeneration.requestId)
   if(i>=0&&live)messages[i]=live
  }
 }
 return incoming
}
