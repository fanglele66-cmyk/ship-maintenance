import {beginTaskReport,submitTask,people} from './eventLifecycle.js'
import {validateGeneratedReport} from './generatedReport.js'
const copy=value=>JSON.parse(JSON.stringify(value))
export async function generateTaskReport(state,eventId,taskId,request,{ownerSession}={}){
 const requestId=crypto.randomUUID(),task=beginTaskReport(state,eventId,taskId,requestId),event=state.events[eventId]
 Object.assign(task.reportGeneration,{ownerSession,startedAt:Date.now()})
 const messageId='report-'+requestId
 task.conversations.engineer.push({id:messageId,kind:'model',text:'',at:new Date().toISOString(),status:'streaming',progress:task.reportGeneration.progress,progressLog:[],generatedReport:{summary:'',analysis:{}}})
 const current=()=>{const e=state.events[eventId],t=e?.tasks.find(t=>t.id===taskId);return e?.currentTask===taskId&&t?.reportGeneration?.requestId===requestId?{event:e,task:t,message:t.conversations.engineer.find(m=>m.id===messageId)}:null}
 const context=copy({id:event.id,title:event.title,number:event.number,tracking:event.tracking,phase:event.phase,currentTask:task.id,brief:event.brief,reports:event.reports.map(r=>({id:r.id,kind:r.kind,summary:r.summary})),tasks:[task],taskContext:{title:task.title,scope:task.scope,owner:task.owner}})
 // Only original feedback and the dispatched plan are sent, never UI drafts or chat state.
 context.tasks=context.tasks.map(t=>({id:t.id,kind:t.kind,purpose:t.purpose,owner:t.owner,status:t.status,scope:t.scope,steps:t.steps,records:t.records,summary:t.summary,attachments:t.attachments,maintenance:t.maintenance}))
 try{
  const result=await request({mode:'submit-report',role:'engineer',actor:people.engineer,text:'根据本次已提交的逐项现场记录与汇总结论生成本轮报告。保留未完成项与待核实事项。',event:context,taskId},(kind,data)=>{
   const c=current();if(!c||c.task.status!=='reporting')return
   if(kind==='progress'){c.task.reportGeneration.progress=data;c.message.progress=data;c.message.progressLog.push(data)}
   if(kind==='report'){c.task.reportGeneration.patch=data.patch;c.message.generatedReport=data.patch}
   if(kind==='meta')c.message.sources=data.sources
  })
  validateGeneratedReport(result.patch)
  const c=current();if(!c)throw Error('任务已有变化，生成内容未覆盖当前记录。')
  // A role switch in this tab must not change the owner of the in-flight submission.
  const report=submitTask({...state,role:'engineer'},eventId,taskId,{...result,requestId})
  Object.assign(c.message,{status:'complete',text:'报告已生成，已交轮机长审阅。',generatedReport:result.patch,reportId:report.id,model:result.model,usage:result.usage,sources:result.sources})
  return report
 }catch(error){
  const c=current()
  if(c&&c.task.status==='reporting'){c.task.status='report-error';c.event.status='报告待生成';c.task.reportGeneration.status='error';c.task.reportGeneration.error=error.message;Object.assign(c.message,{status:'interrupted',modelError:error.message+' 原填写记录已保留，可重试生成。'})}
  throw error
 }
}
export function recoverTaskReportGeneration(state,ownerSession){
 for(const event of Object.values(state.events))for(const task of event.tasks)if(task.status==='reporting'&&(!ownerSession||task.reportGeneration?.ownerSession===ownerSession||Date.now()-(task.reportGeneration?.startedAt||0)>190000)){
  task.status='report-error';event.status='报告待生成';Object.assign(task.reportGeneration,{status:'error',error:'上次生成已中断，原填写记录已保留，请重试。'})
 }
}
