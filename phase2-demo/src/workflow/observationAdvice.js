import {observationSettings} from './lifecycleObservation.js'
import {isVerificationObservation,observationStart} from './observationContext.js'

const finite=Number.isFinite
const clock=value=>value?new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16):''

// Product workflow thresholds for trend screening, not manufacturer operating limits.
export const observationAdvicePolicy={version:2,durationMs:2*3600000,trendMs:30*60000,rangeByUnit:{'°C':5,MPa:0.02},relativeRange:1}
function stableChannels(observation,config){
 const end=Date.parse(observation?.checkedAt),start=Math.max(Date.parse(observation?.executedAt)||0,end-observationAdvicePolicy.trendMs)
 const windows=[...(observation?.records||[]),...(observation?.pending?[observation.pending]:[])]
 return config.names.map((name,i)=>{
  const samples=observation?.samples?.[i]?.filter(p=>p.timestamp>=start&&p.timestamp<=end&&finite(p.value))
  const channels=windows.filter(w=>Date.parse(w.windowEnd)>start).map(w=>w.channels?.[i]).filter(Boolean)
  const values=samples?.length?samples.map(p=>p.value):channels.flatMap(c=>[c.min,c.max]).filter(finite)
  const count=samples?.length||channels.reduce((n,c)=>n+(c.sampleCount||0),0)
  const range=values.length?Math.max(...values)-Math.min(...values):null
  const tolerance=/偏差/.test(name)?observationAdvicePolicy.relativeRange:observationAdvicePolicy.rangeByUnit[config.units[i]]
  return {name,range,tolerance,sampleCount:count,stable:count>=2&&finite(range)&&finite(tolerance)&&range<=tolerance}
 })
}

export function observationAdvice(event,task){
 const verification=isVerificationObservation(task),observation=task?.observation,config=observationSettings(event)||{names:[],units:[]}
 const completed=observation?.records?.at(-1),pending=observation?.pending
 // A newly opened window has no samples until the next tick. Keep the fresh
 // completed window during that tick, while still rejecting actual gaps.
 const freshEmptyWindow=pending?.sampleCount===0&&Date.parse(pending.windowEnd)-Date.parse(pending.windowStart)<=120000
 const latest=freshEmptyWindow?completed:pending||completed
 const current=event.tasks.find(t=>t.id===event.currentTask)
 const feedback=current?.purpose==='recheck'?current:task
 const accepted=['已完成','不适用','未见异常','读数一致','工况可比，偏离已消除',...(verification?['现场与系统一致','现场和系统一致','信息已记录','偏离仍存在']:[])]
 const unresolved=(feedback?.records||[]).filter(r=>!accepted.includes(r.result))
 const channels=latest?.channels||[],checkedAt=Date.parse(observation?.checkedAt)
 const available=config.names.length>0&&config.names.every((_,i)=>channels[i]?.sampleCount>0&&finite(channels[i]?.value))
 const covered=available&&channels.every(c=>c.covered&&finite(Date.parse(c.lastAt))&&checkedAt-Date.parse(c.lastAt)<=120000)
 const complete=Boolean(completed?.complete&&completed.covered&&completed.channels?.length===config.names.length&&completed.channels.every(c=>c.covered&&finite(c.value)))
 const targetTime=Date.parse(observationStart(task))+observationAdvicePolicy.durationMs,targetAt=finite(targetTime)?new Date(targetTime).toISOString():null
 const reached=finite(checkedAt)&&checkedAt>=targetTime,trend=stableChannels(observation,config),stable=trend.length>0&&trend.every(c=>c.stable)
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
 const report=event.reports.findLast(r=>r.taskId===feedback?.id)
 const feedbackSummary=report?.summary||feedback?.summary||''
 // Refresh model advice at a new completed window / changed feedback, not per sample.
 const key=JSON.stringify([observationAdvicePolicy.version,task?.id,status,available,covered,reached,stable,completed?.id,feedback?.id,feedbackSummary,feedback?.records,report?.updatedAt,verification,observationStart(task)])
 return {key,status,label,summary,timing,feedbackSummary,verification,checkedAt:observation?.checkedAt,
  evidence:{observedAt:observation?.checkedAt,nextUpdateAt:observation?.nextUpdateAt,targetAt,reachedTwoHours:reached,stable,trend,completeWindow:complete,currentCoverage:covered,unresolved,
   recentWindows:[...(observation?.records||[]).slice(-2),...(observation?.pending?[observation.pending]:[])].map(w=>({start:w.windowStart,end:w.windowEnd,complete:w.complete,covered:w.covered,channels:w.channels?.map(c=>({name:c.name,unit:c.unit,value:c.value,min:c.min,max:c.max,mean:c.mean,sampleCount:c.sampleCount,covered:c.covered,lastAt:c.lastAt}))}))}}
}

export function observationAdviceRequest(event,task,advice){
 if(isVerificationObservation(task))return {mode:'observation',role:'captain',text:'请依据现场核实报告及本轮采样，给轮机长一段80—120字观察建议。本轮为核实后暂不处置的继续观察，含异常自行回落后继续跟踪；未实施维修，不写修后恢复或维修有效。判断变化是否持续、扩大、恢复或复发；稳定偏差不等于恢复。采样不足先说明缺口；有定位与处理依据可维修，需要补证可复查，原异常回落且无复发可提请人工闭环，两小时仅为本轮汇总时机。轮机长最终决定。\n'+JSON.stringify({summary:advice.summary,timing:advice.timing,feedback:advice.feedbackSummary,observations:advice.evidence}),event:{id:event.id,title:event.title,tracking:event.tracking,number:event.number,phase:event.phase,currentTask:event.currentTask,phases:event.phases.slice(-1),brief:{conclusion:event.brief?.conclusion,facts:event.brief?.facts},reports:event.reports.slice(-2).map(r=>({kind:r.kind,summary:r.summary})),tasks:event.tasks.filter(t=>t.id===task.id||t.id===event.currentTask).map(t=>({id:t.id,kind:t.kind,purpose:t.purpose,status:t.status,observationMode:t.observationMode,observationStartedAt:t.observationStartedAt,summary:t.summary,records:t.records}))}}
 return {mode:'observation',role:'captain',text:'请按本轮观察结果给轮机长一段简短建议（80—120字）。满两小时且采样有效、数据平稳、无新的异常反馈：直接推荐本轮闭环。未满两小时：先说明数据质量和有无异常；数据良好且平稳时，明确等待至本轮满两小时的时间，届时仍无异常就推荐闭环。数据缺测或实际异常时才建议补齐或复查。缺少正常基线、未验证高负荷和本轮范围外未维修项不作为本轮闭环的新增前置条件；不要要求再等一个完整周期。保留明确的异常及未完成项，不虚构测量或故障消除。只输出当前情况与下一步建议，不另列“依据与待核实事项”。人工最终决定。\n'+JSON.stringify({decision:advice.status,summary:advice.summary,timing:advice.timing,feedback:advice.feedbackSummary,observations:advice.evidence}),
  event:{id:event.id,title:event.title,number:event.number,phase:event.phase,currentTask:event.currentTask,brief:{conclusion:event.brief?.conclusion,facts:event.brief?.facts},reports:event.reports.slice(-2).map(r=>({kind:r.kind,summary:r.summary})),tasks:[{id:task.id,kind:task.kind,status:task.status,summary:advice.feedbackSummary,records:task.records}]}}
}

export function updateObservationAdvice(state,eventId,phaseId,patch){
 const event=state.events[eventId],phase=event?.phases.at(-1)
 if(state.role!=='captain'||event?.phase!=='review'||phase?.id!==phaseId)throw Error('只有轮机长可以管理当前观察建议。')
 event.observationAdvice||={}
 event.observationAdvice[phaseId]={...event.observationAdvice[phaseId],...patch}
 return event.observationAdvice[phaseId]
}
