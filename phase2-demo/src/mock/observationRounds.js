import {observationConfig,observationResult} from './phase2Observation.js'

const copy=value=>value==null?value:JSON.parse(JSON.stringify(value))

function baselineFor(store,id,round){
  if(round===1)return {before:[...observationConfig[id].before],beforeLabel:'事件初始参考'}
  const previous=(store.observationHistory[id]||[]).find(item=>item.round===round-1)
  const recurrence=previous?.records.findLast(record=>record.status==='abnormal'&&record.values)
  return {before:recurrence?copy(recurrence.values):null,beforeLabel:'前轮复发读数'}
}

// Save an independent receipt before clearing the active round. Later edits to
// current measurements, targets or execution receipts cannot rewrite history.
export function observationRoundSnapshot(store,id){
  const round=store.observationRounds[id]||1,records=store.observationRecords[id]||[],execution=store.executionRecords[id]?.at(-1)||null
  const notStarted=!records.length&&execution?.values.verification==='unresolved'
  return copy({round,workflowRound:store.workflowRounds?.[id]||round,
    records,target:store.observationTargets[id],
    config:observationConfig[id],...baselineFor(store,id,round),
    execution,
    automatic:store.automaticObservations?.[id]||null,
    result:notStarted?{type:'reinspect',title:'验收未通过，未进入效果观察',text:'本轮执行与现场验收已保留；验收仍有异常，直接接续下一轮原因排查。本轮没有效果观察记录。'}:store.getObservationResult?.(id)||observationResult(id,records,store.observationTargets[id]),
    endedAt:new Date().toISOString(),status:notStarted?'not-started':'reinspect'})
}

// Both tabs consume exactly the same chronological rounds, including an empty
// current round while retaining every previous round's measurements and notes.
export function observationRoundViews(store,id){
  const round=store.observationRounds[id]||1,config=observationConfig[id]
  const history=(store.observationHistory[id]||[]).filter(item=>item.round<round).map(item=>({
    ...baselineFor(store,id,item.round),...item,config:item.config||config,
    target:item.target??config.days,current:false,
    result:item.result||observationResult(id,item.records,item.target??config.days),
    execution:item.execution||store.executionRecords[id]?.findLast(record=>record.round===item.round)||null,
  })).sort((a,b)=>a.round-b.round)
  const execution=store.executionRecords[id]?.at(-1)
  // A receipt still belonging to the archived round must not label the new one.
  const currentExecution=execution&&!history.some(item=>item.execution?.id===execution.id)?execution:null
  const closed=store.eventStatus[id]==='closed',result=store.getObservationResult(id)
  return [...history,{round,current:true,config,records:store.observationRecords[id]||[],
    target:store.observationTargets[id],...baselineFor(store,id,round),execution:currentExecution,
    automatic:store.automaticObservations?.[id]?.executionId===currentExecution?.id?store.automaticObservations[id]:null,
    status:closed?'closed':'observing',result:closed?{...result,title:'本轮效果观察已闭环',text:result.text.replace('请结合现场情况确认是否闭环，观测达标不自动代替人工确认。','人工闭环确认已记录，本轮实际措施与观测依据可在设备动态回查。')}:result}]
}

export function observationRecordTime(record){
  if(record.windowEnd)return new Date(record.windowEnd).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
  if(record.recordedAt){
    const date=new Date(record.recordedAt)
    if(!Number.isNaN(date.getTime()))return date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
  }
  return record.executedAt?.replace('T',' ')||`距本轮执行 ${Math.max(0,record.day||0)*24} 小时`
}
