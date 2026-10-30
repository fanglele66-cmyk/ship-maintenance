import {people,pendingDecision,taskName} from './eventLifecycle.js'

export const taskLocation=task=>({path:'/tasks/'+task.id})
export const taskTitle=task=>task.title||`第${task.round}轮${taskName(task)}任务 · ${task.steps?.[0]?.short||task.steps?.[0]?.label||'现场执行'}`
export const taskNumber=(event,task)=>task.number||`${event.number?.replace('EVT','TSK')||event.id}-${String(event.tasks.indexOf(task)+1).padStart(2,'0')}`
export const canViewTask=(role,task)=>Boolean(task&&(role==='captain'||role==='engineer'&&task.owner===people.engineer))
export const canExecuteTask=(state,event,task)=>state.role==='engineer'&&canViewTask(state.role,task)&&task.status==='assigned'&&event.currentTask===task.id
export function findTask(state,id){
 for(const event of Object.values(state.events)){
  const task=event.tasks.find(t=>t.id===id)
  if(task)return {event,task}
 }
 return null
}
const timestamp=value=>{const text=String(value||'').split(' / ')[0].replace(' ','T');return Date.parse(text+(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?'':'+08:00'))||0}
const newest=(a,b)=>timestamp(b.at)-timestamp(a.at)||b.id.localeCompare(a.id)
const decisionLabels={investigate:'派发排查',repair:'派发维修',maintenance:'安排维保',recheck:'派发复查',observe:'进入效果观察',shore:'同步岸基',close:'确认闭环',false:'确认误报',wait:'等待执行条件',resume:'恢复原任务',terminate:'终止未执行部分'}
export function decisionWorkItem(event){
 const phase=event.phases.at(-1),task=event.tasks.find(t=>t.id===event.currentTask)
 const label=event.phase==='reminder'?'评估风险并安排排查':event.phase==='decision'?'审阅排查结果并决定下一步':phase?.observationReview?'审阅观察结果并确认后续安排':'审阅作业结果并决定后续安排'
 return {id:'decision:'+event.id+':'+phase.id,kind:'decision',eventId:event.id,eventTitle:event.title,eventNumber:event.number,device:event.device,type:'决策 / 确认',eventType:event.type,title:label,summary:event.phase==='reminder'?event.brief.conclusion:event.reports.findLast(r=>r.taskId===task?.id)?.summary||event.brief.conclusion,owner:people.captain,status:'待我处理',at:phase.observationCompletedAt||(event.phase==='reminder'?event.createdAt:null)||phase.at,location:{path:'/situation/issue/'+event.id,query:{from:'tasks'}},actionLabel:'查看并决策'}
}
export function lifecycleWorkItems(state){
 const role=state.role,actor=people[role],tasks=[],pending=[],completed=[]
 if(!actor)return {pending,assigned:[],completed,all:[]}
 for(const event of Object.values(state.events)){
  for(const task of event.tasks){
   if(!canViewTask(role,task))continue
   const report=event.reports.findLast(r=>r.taskId===task.id),submitted=task.status==='submitted',done=task.goalStatus==='completed'
   const item={id:'task:'+task.id,taskId:task.id,kind:'task',eventId:event.id,eventTitle:event.title,eventNumber:event.number,device:event.device,type:taskName(task)+'任务',eventType:event.type,title:taskTitle(task),number:taskNumber(event,task),summary:submitted?report?.summary||task.summary:task.scope,owner:task.owner,assignedBy:task.assignedBy||people.captain,deadline:task.deadline,at:task.resumedAt||task.assignedAt,completedAt:task.submittedAt,waiting:task.status==='waiting',status:task.status==='waiting'?'等待条件':task.status==='terminated'?'已终止':task.status==='reporting'?'报告生成中':task.status==='report-error'?'报告待生成':done?'已完成':submitted?(task.goalStatus==='unresolved'?'目标未完成':'反馈待审阅'):'待执行',done,progress:(submitted?task.records:task.draft?.records||[]).filter(r=>r.result).length,total:task.steps.length,location:taskLocation(task),actionLabel:task.status==='waiting'?'查看等待条件':submitted?'查看任务记录':canExecuteTask(state,event,task)?'执行任务':'查看执行进度'}
   tasks.push(item)
   if(canExecuteTask(state,event,task)||role==='engineer'&&task.owner===actor&&['report-error','waiting'].includes(task.status)){if(task.status==='report-error')item.actionLabel='重新生成报告';pending.push(item)}
   if(done&&(task.owner===actor||item.assignedBy===actor))completed.push({...item,at:task.submittedAt})
   if(role==='captain'&&item.assignedBy===actor&&!event.decisions.some(d=>d.taskId===task.id&&['investigate','repair','maintenance','recheck'].includes(d.action))){
    completed.push({id:'legacy-dispatch:'+task.id,kind:'decision',eventId:event.id,eventTitle:event.title,eventNumber:event.number,device:event.device,type:'决策记录',eventType:event.type,title:'派发'+taskName(task),summary:task.scope,owner:actor,status:'已完成',at:task.assignedAt,done:true,location:{path:'/situation/issue/'+event.id,query:{from:'tasks',phase:task.id}},actionLabel:'查看处置记录'})
   }
  }
  if(role!=='captain')continue
  if(pendingDecision(event))pending.push(decisionWorkItem(event))
  for(const decision of event.decisions){
   if(decision.owner!==actor)continue
   // A dispatch record is a completed decision, not a second execution task.
   const phaseId=decision.sourcePhaseId||event.phases.findLast(p=>Date.parse(p.at)<=Date.parse(decision.at)&&['reminder','decision','review'].includes(p.kind))?.id
   completed.push({id:'decision-record:'+decision.id,kind:'decision',eventId:event.id,eventTitle:event.title,eventNumber:event.number,device:event.device,type:'决策记录',eventType:event.type,title:decisionLabels[decision.action]||'处置决定',summary:decision.reason,owner:decision.owner,status:'已完成',at:decision.at,done:true,location:{path:'/situation/issue/'+event.id,query:{from:'tasks',...(phaseId?{phase:phaseId}:{})}},actionLabel:'查看处置记录'})
  }
 }
 const assigned=role==='captain'?tasks.filter(t=>t.assignedBy===actor):[]
 const all=role==='captain'?[...tasks,...pending.filter(i=>i.kind==='decision'),...completed.filter(i=>i.kind==='decision')]:tasks
 return {pending:pending.sort(newest),assigned:assigned.sort(newest),completed:completed.sort(newest),all:all.sort(newest)}
}

// Reading an event or dismissing a popup never resolves a pending decision.
// Stable work-item IDs keep reminders across reloads without making new notices.
export function lifecycleNotifications(state){
 const work=lifecycleWorkItems(state),pending=work.pending.filter(item=>!item.waiting).map(item=>{
  const supplement=item.kind==='decision'?(state.notices||[]).filter(n=>n.recipient===state.role&&n.eventId===item.eventId&&n.title==='报告已补充'&&timestamp(n.at)>=timestamp(item.at)).sort(newest)[0]:null
  return {id:item.id+(item.kind==='task'&&state.events[item.eventId].tasks.find(t=>t.id===item.taskId)?.resumedAt?':'+item.at:'')+(supplement?':'+supplement.id:''),eventId:item.eventId,taskId:item.taskId,title:supplement?'报告已补充，待您复核':item.kind==='task'?'收到'+item.type:item.title,text:item.kind==='task'?item.title+'；'+item.summary:item.eventTitle+'：'+item.summary,at:supplement?.at||item.at,location:item.location,pending:true}
 })
 const covered=new Set(pending.map(n=>n.eventId))
 const updates=(state.notices||[]).filter(n=>n.recipient===state.role&&!n.read&&!covered.has(n.eventId)).flatMap(n=>{
  const event=state.events[n.eventId]
  if(!event||state.role!=='captain'&&!event.tasks.some(t=>canViewTask(state.role,t)))return []
  // Do not resurrect old handoffs after their work has been completed.
  if(n.taskId&&event.tasks.find(t=>t.id===n.taskId)?.status!=='assigned')return []
  if(/收到新的.+任务|已回交，待您决策/.test(n.title))return []
  return [{...n,location:{path:'/situation/issue/'+event.id,query:{from:'tasks',...(n.reportId?{report:n.reportId}:{})}},pending:false}]
 })
 return [...pending,...updates].sort(newest)
}

export function taskConversation(task,role){
 task.conversations||={captain:[],engineer:[]}
 return task.conversations[role]||(task.conversations[role]=[])
}
