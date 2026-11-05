import {pendingDecision,taskName,timeText} from './eventLifecycle.js'
import {taskLocation,taskTitle} from './lifecycleWorkItems.js'
import {lifecycleDecisionOptions} from './lifecycleDecisions.js'

export function currentDecisionPrompt(event){
 const choices=lifecycleDecisionOptions(event).filter(o=>o.value!=='shore')
 if(event.phase==='reminder')return '当前需决定：是否安排本轮现场核实/排查'
 if(!choices.length)return '当前需决定：是否上报岸端协调支持'
 const descriptions={investigate:'继续现场核实/排查',recheck:'安排复查',repair:'安排维修',maintenance:'提前安排维保',observe:'转入效果观察',close:'闭环归档',false:'确认误报',resume:'恢复原任务',wait:'保留任务等待条件',terminate:'终止未执行部分'}
 return '当前需决定：'+choices.map(o=>o.value==='repair'&&/剩余/.test(o.label)?'派发剩余维修':descriptions[o.value]||o.label).join('、')
}

export function decisionStage(event){
 const phase=event.phases.at(-1),task=event.tasks.find(t=>t.id===event.currentTask)
 if(phase?.observationWaiting)return '效果观察中'
 if(phase?.observationReview||event.type==='效果观察')return '效果观察后决策'
 if(task?.status==='waiting')return '等待条件确认'
 if(event.phase==='reminder')return '初始信息决策'
 return (task?.purpose==='recheck'?'复查':task?.kind==='investigation'?'排查':task?.kind==='maintenance'?'维保':'维修')+'后决策'
}

export function workbenchDetails(event,item){
 const task=event.tasks.find(t=>t.id===(item.taskId||event.currentTask)),phase=event.phases.at(-1)
 if(phase?.observationWaiting)return ['系统持续观测',phase.observationDueAt?'计划汇报 '+timeText(phase.observationDueAt):'按计划汇报']
 if(item.kind==='decision')return [currentDecisionPrompt(event),task?.submittedAt?`${task.owner}已回交${taskName(task)}报告`:phase?.observationReview?'观察报告已生成':'',task?.status==='reporting'?'AI 分析生成中':task?.status==='report-error'?'AI 分析待重试':''].filter(Boolean)
 if(!task)return []
 const formal=Boolean(task.submittedAt)&&task.status!=='assigned'
 const count=(formal?task.records:task.draft?.records||[]).filter(r=>r.result).length
 return [`执行人 ${task.owner}`,`${count} / ${task.steps.length} 项${formal?'已回传':'已填写'}${formal?'':' · 尚未提交'}`,task.status==='waiting'?'等待条件':task.deadline?'要求完成 '+timeText(task.deadline):'',!formal&&task.draft?.updatedAt?'最近更新 '+timeText(task.draft.updatedAt):''].filter(Boolean)
}

export function processingWorkItems(events){
 return events.filter(e=>!['closed','transferred','reminder'].includes(e.phase)&&!pendingDecision(e)).flatMap(event=>{
  const phase=event.phases.at(-1),task=event.tasks.find(t=>t.id===event.currentTask)
  if(phase?.observationWaiting)return [{id:'observing:'+event.id,kind:'observation',eventId:event.id,eventTitle:event.title,eventNumber:event.number,device:event.device,eventType:event.type,status:'效果观察中',title:event.title,summary:event.brief.conclusion,location:{path:'/situation/issue/'+event.id},actionLabel:'查看观察进展'}]
  if(!task||!['assigned','waiting'].includes(task.status))return []
  return [{id:'processing:'+task.id,kind:'task',taskId:task.id,eventId:event.id,eventTitle:event.title,eventNumber:event.number,device:event.device,eventType:event.type,status:task.status==='waiting'?'等待条件':taskName(task)+'中',title:taskTitle(task),summary:task.status==='waiting'?task.waiting?.reason:task.scope,location:taskLocation(task),actionLabel:'查看步骤与回传'}]
 })
}
