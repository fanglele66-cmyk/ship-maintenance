import {makeReport,people} from './eventLifecycle.js'
import {validateGeneratedReport} from './generatedReport.js'
import {currentReportContext,submissionContext,submissionSnapshot,reportTask,taskReports} from './reportSubmissions.js'
const copy=value=>JSON.parse(JSON.stringify(value))
export function canRefreshReport(state,event,report){
 const task=event?.tasks.find(t=>t.id===report?.taskId)
 return Boolean(event&&event.phase!=='closed'&&task?.status==='submitted'&&event.currentTask===task.id&&taskReports(event,task.id).at(-1)?.id===report.id&&(state.role==='captain'||state.role==='engineer'&&task.owner===people.engineer))
}
export async function refreshTaskReport(state,eventId,reportId,request,onProgress=()=>{}){
 const event=state.events[eventId],report=event?.reports.find(r=>r.id===reportId)
 if(!canRefreshReport(state,event,report))throw Error('只能重新整理当前任务的最新报告，历史报告保持归档。')
 const task=reportTask(event,report),base=report.markdown,actor=people[state.role]
 const context=copy({id:event.id,title:event.title,tracking:event.tracking,number:event.number,phase:event.phase,currentTask:task.id,brief:event.brief,reports:currentReportContext(event,{excludeTaskId:task.id}),submissionContext:{...submissionContext(event,task,reportId),supplements:(report.revisions||[]).filter(r=>r.kind!=='regenerate').map(r=>({at:r.at,actor:r.actor,text:r.text}))},tasks:[{...submissionSnapshot(task),status:'submitted'}]})
 const result=await request({mode:'refresh-report',role:state.role,actor,taskId:task.id,reportId,text:'按本次原始反馈重新整理报告。使用本次结果与提交后补充，不沿用原 AI 分析。恢复前缺件、未实施只是历史；本次已更换、复装完成应如实反映。不适用是无需执行，未完成才列待补做。',event:context},onProgress)
 validateGeneratedReport(result.patch)
 if(state.events[eventId]!==event||event.reports.find(r=>r.id===reportId)!==report||report.markdown!==base||!canRefreshReport(state,event,report))throw Error('报告或任务已有变化，本次整理未覆盖当前内容。')
 const at=new Date().toISOString(),before=copy({summary:report.summary,analysis:report.analysis,analysisMarkdown:report.analysisMarkdown,markdown:report.markdown}),generation=copy({...result,at})
 const updated=makeReport(event,{...task,generatedReport:generation},report.id)
 Object.assign(report,updated,{updatedAt:at,original:report.original||before,revisions:[...(report.revisions||[]),{id:crypto.randomUUID(),kind:'regenerate',at,actor,text:'依据本次原始记录重新整理 AI 分析；历史提交保持原样。',model:result.model,before}]})
 const liveTask=event.tasks.find(t=>t.id===task.id);liveTask.generatedReport=generation
 event.unread.captain=true
 for(const messages of [event.conversations.captain,liveTask.conversations?.engineer].filter(Boolean))messages.push({id:crypto.randomUUID(),kind:'receipt',title:'本次报告已重新整理',text:report.summary,reportId:report.id,at})
 return report
}
