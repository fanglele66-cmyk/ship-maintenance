import {observationPolicy,observationStart} from './observationContext.js'

const copy=value=>JSON.parse(JSON.stringify(value))
export const isObservationEvent=event=>event?.type==='效果观察'
export const evidenceEventId=event=>event?.sourceEventId||event?.id
export const observationTasks=event=>[...(event.observationSource?[event.observationSource.task]:[]),...event.tasks]

// Walk both directions so a closed observation also reaches sibling and later
// observations. Only explicit event links belong to this chain.
export function observationChain(state,eventId){
 const links=new Map(Object.keys(state.events).map(id=>[id,new Set()]))
 for(const event of Object.values(state.events)){
  const related=[event.parentEventId,event.observationSource?.parentEventId,
   ...(isObservationEvent(event)?[event.sourceEventId]:[]),
   ...(event.observationEventIds||[]),...(event.phases||[]).map(p=>p.observationEventId)]
  for(const id of related)if(links.has(id)){links.get(event.id).add(id);links.get(id).add(event.id)}
 }
 const seen=new Set(),queue=[eventId]
 for(const id of queue){
  if(seen.has(id)||!links.has(id))continue
  seen.add(id);queue.push(...links.get(id))
 }
 return [...seen].map(id=>state.events[id])
}

// A separate event owns observation samples and decisions; source tasks stay in
// their original event. The source report is a read-only submission snapshot.
export function createObservationEvent(state,parent,task,{at=new Date().toISOString(),reason,migrate=false,plan}={}){
 const report=parent.reports.findLast(r=>r.taskId===task.id)
 if(!report)throw Error('请先提交本轮报告，再创建效果观察事件。')
 const id=`${parent.id}-observation-${report.id}`
 if(state.events[id])return state.events[id]
 const source=copy(task),policy=observationPolicy(parent)
 source.status='submitted'
 source.observationMode=task.kind==='investigation'?'verification':'effect'
 if(!migrate){source.observationStartedAt=at;delete source.observation;delete source.observationHistory;delete source.observationResumedAt}
 source.observationStartedAt||=observationStart(source)
 delete source.observationEndedAt
 const oldPhase=parent.phases.at(-1),start=Date.parse(observationStart(source))
 const observing={id:`${id}-start`,kind:'review',label:'效果观察',at,reportId:report.id,observationTaskId:source.id,observationWaiting:true,observationIntervalMs:policy.intervalMs,observationDueAt:new Date(start+policy.intervalMs).toISOString()}
 if(migrate)Object.assign(observing,...['observationWaiting','observationReview','observationCompletedAt','observationDueAt'].filter(k=>oldPhase[k]!==undefined).map(k=>({[k]:oldPhase[k]})))
 if(plan){observing.observationPlan=copy(plan);observing.observationDueAt=plan.dueAt;observing.observationIntervalMs=Date.parse(plan.dueAt)-Date.parse(at)}
 const title=parent.title.replace(/ · 效果观察$/,'')+' · 效果观察'
 const event={id,number:parent.number+'-OBS-'+String((parent.observationEventIds||[]).length+1).padStart(2,'0'),title,type:'效果观察',device:parent.device,tracking:parent.tracking,sourceEventId:evidenceEventId(parent),parentEventId:parent.id,sourceTaskId:task.id,sourceReportId:report.id,createdAt:at,phase:'review',status:observing.observationWaiting?'效果观察中':'待观察确认',currentTask:null,tasks:[],reports:[{...copy(report),linkedSource:true}],decisions:[],shore:[],participants:[...parent.participants],maintenance:null,phases:[observing],brief:{...copy(parent.brief),conclusion:`${task.kind==='investigation'?'排查':'作业'}已回交，继续核对原异常是否持续、恢复或复发。`,discovery:{...copy(parent.brief.discovery),at,label:'关联报告 → 效果观察'}},observationSource:{parentEventId:parent.id,taskId:task.id,reportId:report.id,task:source},conversations:{captain:[{id:id+'-receipt',kind:'receipt',title:'效果观察事件已建立',text:reason||'依据本轮报告继续观察，原事件与作业记录保留。',at}],engineer:[]},unread:{captain:!observing.observationWaiting,engineer:false}}
 if(plan)event.observationPlan=copy(plan)
 state.events[id]=event
 event.sourceConclusion=parent.sourceConclusion||parent.brief.conclusion
 parent.observationEventIds||=[];parent.observationEventIds.push(id)
 task.observationEndedAt=at
 parent.phase='transferred';parent.status='已转效果观察'
 parent.phases.push({id:id+'-link',kind:'transferred',label:'已转效果观察',at,taskId:task.id,reportId:report.id,observationEventId:id})
 parent.unread.captain=false
 return event
}

export function migrateObservationEvents(state){
 for(const event of Object.values(state.events)){
  if(isObservationEvent(event)||event.phase!=='review')continue
  const phase=event.phases.at(-1)
  if(!phase?.observationWaiting&&!phase?.observationReview)continue
  const task=event.tasks.find(t=>t.id===(phase.observationTaskId||phase.taskId||event.currentTask))
  if(task?.status==='submitted')createObservationEvent(state,event,task,{at:phase.at,migrate:true,reason:'沿用原观察记录与开始时间，独立跟踪本轮效果。'})
 }
 return state
}
