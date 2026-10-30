import {currentReportContext} from './reportSubmissions.js'
import {taskExecution} from './taskExecution.js'
import {observationSettings} from './lifecycleObservation.js'
import {isVerificationObservation,observationStart,observationPolicy} from './observationContext.js'

const finite=Number.isFinite
const clock=value=>value?new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16):''

// Product workflow thresholds for trend screening, not manufacturer operating limits.
export const observationAdvicePolicy={version:4,durationMs:2*3600000,trendMs:30*60000,rangeByUnit:{'°C':5,MPa:0.02},relativeRange:1}
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
 const targetTime=Date.parse(observationStart(task))+policy.intervalMs,targetAt=finite(targetTime)?new Date(targetTime).toISOString():null
 const reached=finite(checkedAt)&&checkedAt>=targetTime,trend=stableChannels(observation,config,policy),stable=trend.length>0&&trend.every(c=>c.stable)
 let status='incomplete',label='检查数据质量',summary='当前观察数据尚不完整。',timing='先检查缺测、采样时效与连续性；数据有效且无异常后，观察满两小时推荐闭环。'
 if(available)summary=config.names.map((name,i)=>`${name} ${channels[i].value} ${config.units[i]}`).join('；')+'。'
 if(covered&&stable&&(!reached||complete)){
  status=reached?'review':'waiting';label=reached?'推荐闭环':'等待满两小时'
  summary+='当前数据质量良好，指标平稳，未见新的异常反馈。'
  timing=reached?'修后观察已满两小时，数据平稳，推荐本轮闭环，由轮机长确认。':`当前未满两小时，建议继续观察至 ${clock(targetAt)}；若保持平稳且无异常，届时推荐闭环。`
 }else if(available&&!covered||reached&&!complete){timing='当前采样存在缺测或时段未覆盖，先补齐有效观察数据，再按满两小时、数据平稳且无异常的条件推荐闭环。'}
 else if(covered&&trend.every(c=>c.sampleCount>=2)&&!stable){status='recheck';label='关注数据波动';timing='当前指标尚未平稳，建议检查波动原因；确认异常时派发复查，恢复平稳后再评估闭环。'}
 if(unresolved.length){status='recheck';label='建议复查';summary=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')+'。现场仍有异常或未完成项。';timing=`现场反馈仍有待核实事项：${unresolved.map(r=>r.label).join('、')}。建议先复查确认，再判断闭环时机。`}
 if(verification){
  const values=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')
  summary=values+'。本轮为现场核实后暂不处置的持续观察。'
  if(!covered||reached&&!complete){status='incomplete';label='检查数据质量';timing='先核对采样覆盖、时效和同工况条件，资料不足时派发复查；不能将缺测视为异常恢复。'}
  else if(unresolved.length){status='recheck';label='核对剩余异常';timing=`排查仍保留：${unresolved.map(r=>r.label).join('、')}。有明确部位与处理依据时派发维修；需补充定位时派发复查。`}
  else if(!stable){status='recheck';label='关注变化趋势';timing='当前指标仍在变化，结合原始异常核对是否扩大、回落或复发；出现持续扩大或复发时派发复查，定位后决定维修。'}
  else{
   status=reached?'review':'waiting';label=reached?'请审阅观察结果':'持续跟踪变化'
   summary+='当前采样有效，近期波动平稳；平稳本身不表示原偏差已消失。'
   timing=reached?'本轮两小时观察已完成，请核对原异常是否持续、恢复或复发：有处理依据则维修，尚需核实则复查；已回落且无复发可由轮机长确认闭环。':`继续观察至 ${clock(targetAt)}，跟踪持续性、扩大、恢复与复发。异常自行回落也纳入本轮观察；轮机长可随时依据记录选择维修、复查或闭环。`
  }
 }
 const conditions=observation?.conditions
 const conditionMessage=conditions?.reason||'缺少带时间的航行状态、转速与负荷记录，请先核实观察工况。'
 if(!conditions?.eligible){summary=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')+'。当前数据仅作记录，不据此认定修复效果。';status='incomplete';label=conditions?.currentState&&conditions.currentState!=='未取得'?'等待适用工况':'核实观察工况';timing=conditionMessage+' 观察周期到期也不能据此推荐闭环。'}
 // Stable values can still reproduce the original deviation. This is a comparison
 // with the event evidence, not a new manufacturer alarm or acceptance threshold.
 const original=config.before||[],values=channels.map(c=>c.value)
 const originalDifference=original.length===2?Math.abs(original[0]-original[1]):Math.abs(original[0]||0)
 const currentDifference=values.length===2?Math.abs(values[0]-values[1]):Math.abs(values[0]||0)
 const originalPersists=event.tracking?originalDifference>0&&currentDifference>=originalDifference*.8:event.id==='real-alarm-0430'&&originalDifference>0&&currentDifference>=originalDifference*.8
 if(conditions?.eligible&&covered&&originalPersists){summary=config.names.map((name,i)=>`${name} ${channels[i]?.value??'未取得'} ${config.units[i]}`).join('；')+'。近期平稳本身不表示原偏差已消失。';status='recheck';label='原偏差仍需核实';timing='本轮可比工况读数仍接近事件原有偏差，平稳不等于恢复。请核对处理措施、同工况对比和现场反馈；需要补充定位时派发复查。'}
 if(event.tracking){summary=summary.replaceAll('两小时','一周');timing=timing.replaceAll('两小时','一周');label=label.replaceAll('两小时','一周')}
 const report=event.reports.findLast(r=>r.taskId===feedback?.id)
 const feedbackSummary=report?.summary||feedback?.summary||''
 // Refresh model advice at a new completed window / changed feedback, not per sample.
 const key=JSON.stringify([observationAdvicePolicy.version,task?.id,status,available,covered,reached,stable,completed?.id,feedback?.id,feedbackSummary,feedback?.records,report?.updatedAt,verification,observationStart(task),conditions?.eligible,conditions?.currentState,originalPersists,policy.intervalMs])
 return {key,status,label,summary,timing,feedbackSummary,verification,conditionMessage,conditionsMet:Boolean(conditions?.eligible),checkedAt:observation?.checkedAt,
  evidence:{observedAt:observation?.checkedAt,nextUpdateAt:observation?.nextUpdateAt,targetAt,reachedCycle:reached,reachedTwoHours:!event.tracking&&reached,cycle:policy.label,intervalMs:policy.intervalMs,requiredCondition:policy.requiredCondition,operatingConditions:conditions?{...conditions,samples:undefined}:null,originalProblem:event.brief?.conclusion,originalReadings:config.before,originalPersists,stable,trend,comparableReadings:(conditions?.samples||[]).map((points,i)=>({name:config.names[i],unit:config.units[i],count:points.length,last:points.at(-1)||null})),completeWindow:complete,currentCoverage:covered,unresolved,
   recentWindows:[...(observation?.records||[]).slice(-2),...(observation?.pending?[observation.pending]:[])].map(w=>({start:w.windowStart,end:w.windowEnd,complete:w.complete,covered:w.covered,channels:w.channels?.map(c=>({name:c.name,unit:c.unit,value:c.value,min:c.min,max:c.max,mean:c.mean,sampleCount:c.sampleCount,covered:c.covered,lastAt:c.lastAt}))}))}}
}

export function observationAdviceRequest(event,task,advice){
 const policy=observationPolicy(event)
 return {mode:'observation',role:'captain',text:`结合本轮报告和观察证据给轮机长80—160字建议。观察周期为${policy.label}。先核对数据时效、缺测和工况；停机、非稳态或无工况数据时明确等待有效观测，不把停机的平稳值写成修复有效。只使用本轮开始时间之后的可比工况传感器数据，结合原异常判断变化是否持续、扩大、恢复或复发。周期未满且无异常时等待本周期结束；周期已满、数据有效且适用工况平稳、原异常未复现且无未执行项目，可推荐人工闭环。资料不足说明缺口，有异常建议复查。核实后观察未实施维修，不写修复成功。只给分析摘要和建议，不输出内部思维过程。\n`+JSON.stringify({decision:advice.status,summary:advice.summary,timing:advice.timing,feedback:advice.feedbackSummary,observations:advice.evidence}),
 event:{id:event.id,title:event.title,tracking:event.tracking,number:event.number,phase:event.phase,currentTask:event.currentTask,phases:event.phases.slice(-1),brief:{conclusion:event.brief?.conclusion,facts:event.brief?.facts},reports:currentReportContext(event).slice(-2),tasks:event.tasks.filter(t=>t.id===task.id||t.id===event.currentTask).map(t=>({id:t.id,kind:t.kind,purpose:t.purpose,status:t.status,observationMode:t.observationMode,observationStartedAt:t.observationStartedAt,submittedAt:t.submittedAt,summary:t.summary,records:t.records}))}}
}

export function updateObservationAdvice(state,eventId,phaseId,patch){
 const event=state.events[eventId],phase=event?.phases.at(-1)
 if(state.role!=='captain'||event?.phase!=='review'||phase?.id!==phaseId)throw Error('只有轮机长可以管理当前观察建议。')
 event.observationAdvice||={}
 event.observationAdvice[phaseId]={...event.observationAdvice[phaseId],...patch}
 return event.observationAdvice[phaseId]
}
