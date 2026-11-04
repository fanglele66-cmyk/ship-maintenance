import {currentReportContext} from './reportSubmissions.js'
import {taskExecution} from './taskExecution.js'
import {observationSettings} from './lifecycleObservation.js'
import {isVerificationObservation,observationStart,observationPolicy} from './observationContext.js'

const finite=Number.isFinite
const clock=value=>value?new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16):''

// Product workflow thresholds for trend screening, not manufacturer operating limits.
export const observationAdvicePolicy={version:5,durationMs:2*3600000,trendMs:30*60000,rangeByUnit:{'°C':5,MPa:0.02},relativeRange:1}
function stableChannels(observation,config,policy){
 const end=Date.parse(observation?.checkedAt),start=Math.max(Date.parse(observation?.executedAt)||0,end-policy.trendMs)
 const windows=[...(observation?.records||[]),...(observation?.pending?[observation.pending]:[])]
 return config.names.map((name,i)=>{
  const samples=(observation?.conditions?.samples||observation?.samples)?.[i]?.filter(p=>p.timestamp>=start&&p.timestamp<=end&&finite(p.value))
  const channels=windows.filter(w=>Date.parse(w.windowEnd)>start).map(w=>w.channels?.[i]).filter(Boolean)
  const values=samples?.length?samples.map(p=>p.value):observation?.conditions?[]:channels.flatMap(c=>[c.min,c.max]).filter(finite)
  const count=samples?.length||channels.reduce((n,c)=>n+(c.sampleCount||0),0)
  const range=values.length?Math.max(...values)-Math.min(...values):null
  const tolerance=/偏差/.test(name)?observationAdvicePolicy.relativeRange:observationAdvicePolicy.rangeByUnit[config.units[i]]
  return {name,range,tolerance,sampleCount:count,stable:count>=2&&finite(range)&&finite(tolerance)&&range<=tolerance}
 })
}

export function observationAdvice(event,task){
 const policy=observationPolicy(event),verification=isVerificationObservation(task),observation=task?.observation,config=observationSettings(event)||{names:[],units:[]}
 const completed=observation?.records?.at(-1),pending=observation?.pending
 // A newly opened window has no samples until the next tick. Keep the fresh
 // completed window during that tick, while still rejecting actual gaps.
 const freshEmptyWindow=pending?.sampleCount===0&&Date.parse(pending.windowEnd)-Date.parse(pending.windowStart)<=policy.gapThresholdMs
 const latest=freshEmptyWindow?completed:pending||completed
 const current=event.tasks.find(t=>t.id===event.currentTask)
 const feedback=current?.purpose==='recheck'?current:task
 const accepted=['不适用','已完成','未见异常','读数一致','工况可比，偏离已消除',...(verification?['现场与系统一致','现场和系统一致','信息已记录','偏离仍存在']:[])]
 const execution=taskExecution(feedback),unresolved=(feedback?.records||[]).filter(r=>!accepted.includes(r.result));if(execution.summaryBlocked)unresolved.push({label:'汇总中登记的受阻项目',note:feedback.summary})
 const channels=latest?.channels||[],checkedAt=Date.parse(observation?.checkedAt)
 const available=config.names.length>0&&config.names.every((_,i)=>channels[i]?.sampleCount>0&&finite(channels[i]?.value))
 const covered=observation?.currentSourceAvailable!==false&&available&&channels.every(c=>c.covered&&finite(Date.parse(c.lastAt))&&checkedAt-Date.parse(c.lastAt)<=policy.gapThresholdMs)
 const complete=Boolean(completed?.complete&&completed.covered&&completed.channels?.length===config.names.length&&completed.channels.every(c=>c.covered&&finite(c.value)))
 const confirmedDue=event.phases?.at(-1)?.observationPlan?.dueAt
 const targetTime=confirmedDue?Date.parse(confirmedDue):Date.parse(observationStart(task))+policy.intervalMs,targetAt=finite(targetTime)?new Date(targetTime).toISOString():null
 const reached=finite(checkedAt)&&checkedAt>=targetTime,trend=stableChannels(observation,config,policy),stable=trend.length>0&&trend.every(c=>c.stable)
 let status='incomplete',label='检查数据质量',summary='当前观察数据尚不完整。',timing='先补齐本轮缺测通道及对应时段的有效记录。'
 if(available)summary=config.names.map((name,i)=>`${name} ${channels[i].value} ${config.units[i]}`).join('；')+'。'
 if(covered&&stable&&(!reached||complete)){
  status=reached?'review':'waiting';label=reached?'推荐闭环':'等待满两小时'
  summary+='有效工况内近期波动平稳，未登记新的异常反馈。'
  timing=reached?'本轮已满两小时，可比数据平稳且未登记未完成项，建议轮机长审阅闭环依据。':`建议继续观察至 ${clock(targetAt)}，按计划回交本轮读数与报警记录。`
 }else if(available&&!covered||reached&&!complete){timing='本轮存在缺测或覆盖不足，先补齐缺测通道和时段的有效记录。'}
 else if(covered&&trend.every(c=>c.sampleCount>=2)&&!stable){status='recheck';label='关注数据波动';timing='建议复查波动通道的现场读数及同期工况，确认波动来源。'}
 if(unresolved.length){status='recheck';label='建议复查';summary=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')+'。现场仍有异常或未完成项。';timing=`现场反馈仍有待核实事项：${unresolved.map(r=>r.label).join('、')}。先复查上述项目并补交结果。`}
 if(verification){
  const values=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')
  summary=values+'。本轮为现场核实后暂不处置的持续观察。'
  if(!covered||reached&&!complete){status='incomplete';label='检查数据质量';timing='先补齐缺测通道和时段，并补交对应转速、负荷记录。'}
  else if(unresolved.length){status='recheck';label='核对剩余异常';timing=`排查仍保留：${unresolved.map(r=>r.label).join('、')}。先复查上述项目，补齐部位和检查读数。`}
  else if(!stable){status='recheck';label='关注变化趋势';timing='建议复查变化通道的现场读数，并与原异常窗口的同工况数据对照。'}
  else{
   status=reached?'review':'waiting';label=reached?'请审阅观察结果':'持续跟踪变化'
   summary+='当前采样有效，近期波动平稳；平稳本身不表示原偏差已消失。'
   timing=reached?'本轮两小时观察已完成，建议对照原异常窗口复核偏差是否消除，回交同工况比较结果。':`继续观察至 ${clock(targetAt)}，记录原异常信号与同刻工况。`
  }
 }
 const conditions=observation?.conditions
 const conditionMessage=conditions?.reason||'缺少带时间的航行状态、转速与负荷记录，请先核实观察工况。'
 if(!conditions?.eligible){summary=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')+'。当前数据仅作记录，不据此认定修复效果。';status='incomplete';label=conditions?.currentState&&conditions.currentState!=='未取得'?'等待适用工况':'核实观察工况';timing=conditionMessage+(/继续收集|请先核实|等待/.test(conditionMessage)?'':' 先取得本轮要求工况下的有效记录。')}
 // Stable values can still reproduce the original deviation. This is a comparison
 // with the event evidence, not a new manufacturer alarm or acceptance threshold.
 const original=config.before||[],values=channels.map(c=>c.value)
 const originalDifference=original.length===2?Math.abs(original[0]-original[1]):Math.abs(original[0]||0)
 const currentDifference=values.length===2?Math.abs(values[0]-values[1]):Math.abs(values[0]||0)
 const originalPersists=event.tracking?originalDifference>0&&currentDifference>=originalDifference*.8:(event.sourceEventId||event.id)==='real-alarm-0430'&&originalDifference>0&&currentDifference>=originalDifference*.8
 if(conditions?.eligible&&covered&&originalPersists){summary=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')+'。近期平稳本身不表示原偏差已消失。';status='recheck';label='原偏差仍需核实';timing='本轮可比工况仍保留原有偏差，建议复查原异常测点与已处理部位。'}
 if(event.tracking){summary=summary.replaceAll('两小时','一周');timing=timing.replaceAll('两小时','一周');label=label.replaceAll('两小时','一周')}
 if(confirmedDue){summary=summary.replaceAll('两小时','本轮计划窗口').replaceAll('一周','本轮计划窗口');timing=timing.replaceAll('两小时','本轮计划窗口').replaceAll('一周','本轮计划窗口');label=label.replaceAll('两小时','计划汇报时间').replaceAll('一周','计划汇报时间')}
 const missingNames=config.names.filter((_,i)=>!channels[i]?.covered||!finite(channels[i]?.value)||!finite(Date.parse(channels[i]?.lastAt))||checkedAt-Date.parse(channels[i].lastAt)>policy.gapThresholdMs)
 if(status==='incomplete'&&conditions?.eligible)timing=`先补齐${missingNames.length?missingNames.join('、'):'本轮尚未覆盖时段'}的有效记录，保持对应工况记录。`
 if(status==='recheck'&&!originalPersists&&!unresolved.length){const changing=trend.filter(c=>!c.stable).map(c=>c.name);if(changing.length)timing='建议复查'+changing.join('、')+'的现场读数及同期工况，确认波动来源。'}
 const report=event.reports.findLast(r=>r.taskId===feedback?.id)
 const feedbackSummary=report?.summary||feedback?.summary||''
 // Refresh model advice at a new completed window / changed feedback, not per sample.
 const latestReport=event.reports.at(-1)
 const key=JSON.stringify([observationAdvicePolicy.version,task?.id,status,available,covered,reached,stable,completed?.id,feedback?.id,feedbackSummary,feedback?.records,report?.updatedAt,verification,observationStart(task),conditions?.eligible,conditions?.currentState,originalPersists,policy.intervalMs,event.observationPlan,latestReport?.id,latestReport?.summary,latestReport?.updatedAt])
 return {key,status,label,summary,timing,feedbackSummary,verification,conditionMessage,conditionsMet:Boolean(conditions?.eligible),checkedAt:observation?.checkedAt,
  evidence:{observedAt:observation?.checkedAt,nextUpdateAt:confirmedDue||observation?.nextUpdateAt,targetAt,reachedCycle:reached,reachedTwoHours:!event.tracking&&reached,cycle:confirmedDue?'本轮已确认窗口':policy.label,intervalMs:confirmedDue?targetTime-Date.parse(event.phases.at(-1).at):policy.intervalMs,requiredCondition:policy.requiredCondition,operatingConditions:conditions?{...conditions,samples:undefined}:null,originalProblem:event.sourceConclusion||event.brief?.conclusion,originalReadings:config.before,originalPersists,stable,trend,comparableReadings:(conditions?.samples||[]).map((points,i)=>({name:config.names[i],unit:config.units[i],count:points.length,last:points.at(-1)||null})),completeWindow:complete,currentCoverage:covered,unresolved,
   recentWindows:[...(observation?.records||[]).slice(-2),...(observation?.pending?[observation.pending]:[])].map(w=>({start:w.windowStart,end:w.windowEnd,complete:w.complete,covered:w.covered,channels:w.channels?.map(c=>({name:c.name,unit:c.unit,value:c.value,min:c.min,max:c.max,mean:c.mean,sampleCount:c.sampleCount,covered:c.covered,lastAt:c.lastAt}))}))}}
}

export function observationAdviceRequest(event,task,advice){
 const policy=observationPolicy(event)
 return {mode:'observation',role:'captain',text:`结合本轮报告和观察证据给轮机长80—160字建议。${event.observationPlan?'计划汇报时间为'+clock(event.observationPlan.dueAt):'观察周期为'+policy.label}。先核对数据时效、缺测和工况；停机、非稳态或无工况数据时明确等待有效观测，不把停机的平稳值写成修复有效。只使用本轮开始时间之后的可比工况传感器数据，结合原异常判断变化是否持续、扩大、恢复或复发。以 observationPlan.dueAt 为本轮汇报时间；到期应先提交当前证据，不擅自沿用默认周期或修改已确认时间。数据不足可建议下一轮继续观察，由轮机长另行确认。周期未满且无异常时等待本周期结束；周期已满、数据有效且适用工况平稳、原异常未复现且无未执行项目，可推荐人工闭环。资料不足说明缺口，有异常建议复查。核实后观察未实施维修，不写修复成功。只给本轮关键变化和一个首选建议，指出对象、依据与需补交的结果，不罗列全部处置选项。\n`+JSON.stringify({decision:advice.status,summary:advice.summary,timing:advice.timing,feedback:advice.feedbackSummary,observations:advice.evidence}),
 event:{id:event.id,type:event.type,sourceEventId:event.sourceEventId,observationSource:event.observationSource?{task:{id:task.id,kind:task.kind,status:task.status,observationMode:task.observationMode,observationStartedAt:task.observationStartedAt,submittedAt:task.submittedAt,records:task.records,summary:task.summary}}:null,title:event.title,tracking:event.tracking,observationPlan:event.observationPlan,number:event.number,phase:event.phase,currentTask:event.currentTask,phases:event.phases.slice(-1),brief:{conclusion:event.brief?.conclusion,facts:event.brief?.facts},reports:currentReportContext(event).slice(-2),tasks:event.tasks.filter(t=>t.id===task.id||t.id===event.currentTask).map(t=>({id:t.id,kind:t.kind,purpose:t.purpose,status:t.status,observationMode:t.observationMode,observationStartedAt:t.observationStartedAt,submittedAt:t.submittedAt,summary:t.summary,records:t.records}))}}
}

export function updateObservationAdvice(state,eventId,phaseId,patch){
 const event=state.events[eventId],phase=event?.phases.at(-1)
 if(state.role!=='captain'||event?.phase!=='review'||phase?.id!==phaseId)throw Error('只有轮机长可以管理当前观察建议。')
 event.observationAdvice||={}
 event.observationAdvice[phaseId]={...event.observationAdvice[phaseId],...patch}
 return event.observationAdvice[phaseId]
}
