import {observationConditions,replayOperatingPeriods} from './observationConditions.js'
import {workflowCases} from '../mock/fourStoryWorkflow.js'
import {automaticObservation} from '../mock/automaticObservation.js'
import {repairObservationSource} from '../mock/repairObservationSource.js'
import {lifecycleSampling} from '../mock/lifecycleSampling.js'
import {hasObservation,observationStart,observationPolicy} from './observationContext.js'

export function observationCase(event){return event.tracking?(event.id.includes('c4')?'real-maintenance-c4-baseline':'real-maintenance-c1-baseline'):event.id}
export function observationSettings(event){return workflowCases[observationCase(event)]?.observation}
export function syncLifecycleObservations(state,sensors,now=Date.now(),{demo=false}={}){
 for(const event of Object.values(state.events))for(const task of event.tasks){
  if(!hasObservation(task)||task.status!=='submitted')continue
  const config=observationSettings(event),start=Date.parse(observationStart(task)),end=Math.min(now,task.observationEndedAt?Date.parse(task.observationEndedAt):now)
  if(!config||!Number.isFinite(start)||end<start)continue
  const previous=task.observation
  if(previous?.policy?.intervalMs===observationPolicy(event).intervalMs&&task.observationEndedAt&&previous&&Date.parse(previous.checkedAt)>=end&&(!demo||previous.samples))continue
  const supplied=sensors?.observationChannels?.[event.id]
  const channels=supplied!==undefined?supplied:demo?lifecycleSampling(event,task,config,end):repairObservationSource(sensors,observationCase(event),config,start,end)
  const policy=observationPolicy(event)
  const previousInterval=previous?.policy?.intervalMs||7200000
  if(previous&&previousInterval!==policy.intervalMs&&(previous.records?.length||previous.pending?.sampleCount)){
   task.observationHistory||=[]
   task.observationHistory.push({intervalMs:previousInterval,changedAt:new Date(now).toISOString(),records:JSON.parse(JSON.stringify([...(previous.records||[]),...(previous.pending?[previous.pending]:[])]))})
  }
  const update=automaticObservation({sensors:channels,executedAt:start,now:end,...policy})
  const periods=sensors?.observationOperatingPeriods??(demo?replayOperatingPeriods(Math.max(start,end-policy.maxWindowMs),end):[])
  const conditions=observationConditions(event,channels,periods,start,end)
  const saved=new Map((previousInterval===policy.intervalMs?previous?.records||[]:[]).map(record=>[record.id,record]))
  for(const record of update.records){
   if(saved.has(record.id))continue
   const partial=previous?.pending
   // A saved partial window is evidence of those samples only. A reload cannot
   // turn it into a fully covered window, or erase it when the buffer is empty.
   if(!record.sampleCount&&partial?.sampleCount&&partial.windowStart===record.windowStart){
    saved.set(record.id,{...record,values:partial.values,channels:partial.channels,sampleCount:partial.sampleCount,covered:false,status:'incomplete'})
   }else saved.set(record.id,record)
  }
  if(!update.pending?.sampleCount&&previous?.pending?.sampleCount&&update.pending?.windowStart===previous.pending.windowStart)update.pending={...update.pending,values:previous.pending.values,channels:previous.pending.channels,sampleCount:previous.pending.sampleCount,covered:false}
  task.observation={...update,records:[...saved.values()].sort((a,b)=>a.windowEnd.localeCompare(b.windowEnd)),policy,conditions,samples:channels.map(c=>c.trendData),currentSourceAvailable:channels.length>0&&channels.every(c=>c.trendData?.some(p=>Number.isFinite(p.value)&&p.timestamp>end-policy.gapThresholdMs&&p.timestamp<=end&&p.timestamp>start))}
 }
 for(const event of Object.values(state.events)){
  const phase=event.phases.at(-1),interval=observationPolicy(event).intervalMs
  if(event.phase==='review'&&phase?.observationWaiting&&phase.observationIntervalMs!==interval){
   const task=event.tasks.find(t=>t.id===(phase.observationTaskId||phase.taskId)),start=Date.parse(observationStart(task)),at=Date.parse(phase.at)
   if(Number.isFinite(start)&&Number.isFinite(at)){phase.observationDueAt=new Date(start+(Math.floor(Math.max(0,at-start)/interval)+1)*interval).toISOString();phase.observationIntervalMs=interval}
  }
  if(event.phase!=='review'||!phase?.observationWaiting||now<Date.parse(phase.observationDueAt))continue
  phase.observationWaiting=false;phase.observationReview=true;phase.observationCompletedAt=new Date(now).toISOString()
  event.status='待观察确认';event.unread.captain=true
  // The new work item is derived from this phase, so reloads do not duplicate it.
 }
}
