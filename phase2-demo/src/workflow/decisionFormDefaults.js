import {observationPlanDraft,closureDraft} from './decisionDrafts.js'

const copy=value=>JSON.parse(JSON.stringify(value))
const fields=['reason','evidence','deadline','remainingDisposition','observationPlan','closureDraft']
const inputTime=value=>new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16).replace(' ','T')

// These are editable proposals. Creating a draft never executes or confirms work.
export function decisionFormDefaults(event,action,now=Date.now()){
 const task=event.tasks?.find(t=>t.id===event.currentTask),report=event.reports?.findLast(r=>r.taskId===task?.id)
 const basis=report?`依据《${report.title}》及本轮逐项记录`:`依据「${event.title}」的初始信息`
 const reasons={
  close:`拟${basis}结束本轮关注；仅归档已核实范围，未验证部分及剩余事项单独保留。`,
  false:`拟对照「${event.title}」的原始信号、同刻现场读数与工况核实是否误报；请将确认依据补入后再归档。`,
  wait:`拟保留「${task?.title||event.title}」原任务，等待作业窗口、许可或所需备件；由执行人补充具体受阻项目和预计具备时间。`,
  resume:`拟在执行人与监护人确认作业窗口、许可及所需材料具备后恢复原任务；范围变化仍交轮机长重新确认。`,
  terminate:`拟终止本轮未执行部分并逐项保留原因；剩余风险及后续安排由轮机长确认，不记为已完成。`,
 }
 const result={reason:reasons[action]||'',evidence:`${basis}，按已批准范围实施；涉及停机、介质隔离或拆检时先落实本船许可和适用作业卡。`,deadline:inputTime(now+4*3600000)}
 if(action==='observe')result.observationPlan=observationPlanDraft(event,now)
 if(['close','false'].includes(action)){
  result.closureDraft={...closureDraft(event),conclusion:result.reason}
  if(task)result.remainingDisposition=`未完成事项按本轮记录逐项保留，由${task.owner||'原执行人'}核对清单并提交轮机长确认后续安排，不计为已完成。`
 }
 return result
}

// Keep each choice's own edits, including intentionally cleared fields, on reopen.
export function seedDecisionForm(event,draft,action,now=Date.now()){
 if(!action||action==='shore'||draft._draftAction===action)return draft
 draft._actionDrafts||={}
 const previous=draft._draftAction
 if(previous)draft._actionDrafts[previous]=Object.fromEntries(fields.filter(k=>draft[k]!==undefined).map(k=>[k,copy(draft[k])]))
 const defaults=decisionFormDefaults(event,action,now)
 if(draft._actionDrafts[action]){
  for(const key of fields)delete draft[key]
  Object.assign(draft,copy(draft._actionDrafts[action]))
 }else if(previous){
  for(const key of fields)delete draft[key]
  Object.assign(draft,defaults)
 }else{
  for(const [key,value] of Object.entries(defaults)){
   if(value&&typeof value==='object')draft[key]={...value,...Object.fromEntries(Object.entries(draft[key]||{}).filter(([,v])=>v!==''&&v!==undefined))}
   else if(draft[key]===undefined||draft[key]==='')draft[key]=value
  }
 }
 draft._draftAction=action
 return draft
}
