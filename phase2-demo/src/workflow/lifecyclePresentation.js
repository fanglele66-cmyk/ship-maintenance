import {responsibilitySummary} from './responsibilitySummary.js'
// Public event state is independent of the viewer and internal processing labels.
export const eventStates=['研判中','待决策','处理中','观察中','已闭环']
export function eventState(event){
 if(!event)return '研判中'
 if(event.phase==='closed')return '已闭环'
 const task=event.tasks?.find(t=>t.id===event.currentTask),phase=event.phases?.at(-1)
 if(task?.waiting?.reviewRequested)return '待决策'
 if(['reminder','decision','review'].includes(event.phase)&&!phase?.observationWaiting&&!['assigned','waiting'].includes(task?.status))return '待决策'
 if(phase?.observationWaiting||event.phase==='transferred')return '观察中'
 if(task||event.tasks?.length)return '处理中'
 return '研判中'
}
function responsibilityContext(event){
 const task=event.tasks?.find(t=>t.id===event.currentTask),state=eventState(event)
 if(state==='已闭环')return {owner:'轮机长',action:'已确认归档',detail:event.closeReason}
 if(state==='待决策')return {owner:'轮机长',action:task?.waiting?.reviewRequested?'审阅执行条件变化':'审阅当前资料并决定后续安排',detail:task?.waiting?.reviewRequested?.reason||event.reports?.at(-1)?.summary||event.brief?.conclusion}
 if(state==='观察中')return {owner:'系统观察',action:event.phase==='transferred'?'由关联效果观察事件继续跟踪':'按已确认方案采样，到期提交报告',detail:event.observationPlan?.purpose||event.decisions?.at(-1)?.reason}
 return {owner:task?.owner||'系统',action:task?.status==='waiting'?'等待原执行条件；具备后由原执行人确认':task?.status==='report-error'?'现场事实已回交，AI 报告待重试':task?.status==='reporting'?'现场事实已回交，AI 报告生成中':'按本轮批准范围执行',detail:task?.waiting?.reason||task?.scope||event.brief?.conclusion,deadline:task?.deadline}
}
export function currentResponsibility(event){
 const context=responsibilityContext(event),task=event.tasks?.find(t=>t.id===event.currentTask)
 return {...context,detail:responsibilitySummary(event,eventState(event),task)}
}
// Raw transitions remain audit records; the navigation groups them by actual task.
export function eventRounds(event){
 const rounds=[]
 for(const phase of event.phases||[]){
  const task=event.tasks.find(t=>t.id===phase.taskId)
  const key=task&&!['transferred','closed'].includes(phase.kind)&&!phase.observationWaiting&&!phase.observationReview?task.id:phase.id
  let round=rounds.find(p=>p.id===key)
  if(!round){round={...phase,id:key,aliases:[],label:phase.kind==='reminder'?'初始信息':task&&key===task.id?`第${task.round}轮${task.purpose==='recheck'?'复查':task.kind==='investigation'?'排查':task.kind==='maintenance'?'维保':'维修'}`:phase.label};rounds.push(round)}
  round.aliases.push(phase.id);round.kind=task?.status==='assigned'&&task.id===event.currentTask&&key===task.id?task.kind:phase.kind;round.reportId=phase.reportId||round.reportId
  round.latestTransitionId=phase.id
 }
 return rounds
}
