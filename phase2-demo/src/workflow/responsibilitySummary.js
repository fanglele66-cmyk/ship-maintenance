import {reportGenerationStatus} from './reportGenerationState.js'
import {eventSubject,taskRecommendation,shortSentence} from './contentRecommendations.js'
const clock=value=>value?new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16):'计划汇报时间'
export function responsibilitySummary(event,state,task){
 const subject=eventSubject(event),phase=event.phases?.at(-1)
 if(state==='已闭环')return `${subject.name}已确认闭环；按闭环记录落实后续监测。`
 if(task?.waiting?.reviewRequested)return `${shortSentence(task.waiting.reviewRequested.reason)||subject.name+'执行条件已更新'}；审阅恢复条件与完成时限。`
 if(task?.status==='waiting')return `${shortSentence(task.waiting.reason)||subject.name+'作业条件尚缺'}；先落实本轮受阻条件。`
 if(state==='观察中')return `${subject.name}观察中；跟踪原异常信号至${clock(event.observationPlan?.dueAt||phase?.observationDueAt)}。`
 if(['streaming','error'].includes(reportGenerationStatus(task)))return `${subject.name}现场记录已提交，可据此决定下一步；${reportGenerationStatus(task)==='error'?'AI 分析待重试':'AI 分析正在补充'}。`
 if(state==='待决策'){
  if(!task&&event.manualReport&&event.phase==='reminder')return event.manualReport.analysis.summary
  if(event.type==='效果观察'){
   const report=event.reports?.findLast(r=>r.kind==='观察报告')
   return report?.responsibility||`${subject.name}观察结果已回交；核对原异常信号与本轮可比工况。`
  }
  const advice=taskRecommendation(event,task)
  return `${advice.reason}；${advice.shortNext||advice.next}`
 }
 const scope=task?.steps?.[0]?.label||subject.name
 return `${scope}${task?.purpose==='recheck'?'待复查':task?.kind==='investigation'?'待核查':'已批准'}；按任务记录实际结果并提交。`
}
