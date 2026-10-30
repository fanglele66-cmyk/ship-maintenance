import {workflowCases} from '../mock/fourStoryWorkflow.js'
import {automaticObservation} from '../mock/automaticObservation.js'
import {repairObservationSource} from '../mock/repairObservationSource.js'
import {lifecycleSampling} from '../mock/lifecycleSampling.js'

export function observationCase(event){return event.tracking?(event.id.includes('c4')?'real-maintenance-c4-baseline':'real-maintenance-c1-baseline'):event.id}
export function observationSettings(event){return workflowCases[observationCase(event)]?.observation}
export function syncLifecycleObservations(state,sensors,now=Date.now(),{demo=false}={}){
 for(const event of Object.values(state.events))for(const task of event.tasks){
  if(task.kind==='investigation'||task.status!=='submitted')continue
  const config=observationSettings(event),start=Date.parse(task.submittedAt),end=Math.min(now,task.observationEndedAt?Date.parse(task.observationEndedAt):now)
  if(!config||!Number.isFinite(start)||end<start)continue
  const previous=task.observation
  if(task.observationEndedAt&&previous&&Date.parse(previous.checkedAt)>=end&&(!demo||previous.samples))continue
  const channels=demo?lifecycleSampling(event,task,config,end):repairObservationSource(sensors,observationCase(event),config,start,end)
  const update=automaticObservation({sensors:channels,executedAt:start,now:end})
  const saved=new Map((previous?.records||[]).map(record=>[record.id,record]))
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
  task.observation={...update,records:[...saved.values()].sort((a,b)=>a.windowEnd.localeCompare(b.windowEnd)),...(demo?{samples:channels.map(c=>c.trendData)}:{})}
 }
 for(const event of Object.values(state.events)){
  const phase=event.phases.at(-1)
  if(event.phase!=='review'||!phase?.observationWaiting||now<Date.parse(phase.observationDueAt))continue
  phase.observationWaiting=false;phase.observationReview=true;phase.observationCompletedAt=new Date(now).toISOString()
  event.status='待观察确认';event.unread.captain=true
  // The new work item is derived from this phase, so reloads do not duplicate it.
 }
}
