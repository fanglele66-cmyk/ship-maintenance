import {isTrackingContainer,taskChildIds,recommendationAvailable} from '@/mock/issueRelationships'
import {validateInquiry} from './inquiryFields'

export function assistantWorkflowTask(store,{issueId,taskId,decisionId}={}){
 const usable=id=>id&&store.cases?.[id]&&!isTrackingContainer(id)
 if(!issueId)return usable(taskId)?taskId:null
 const related=[issueId,...taskChildIds(issueId)]
 const preferred=[taskId,decisionId,...related.filter(id=>store.todoCreated?.[id]),issueId,
  ...related.filter(id=>recommendationAvailable(store,id))]
 return preferred.find(id=>related.includes(id)&&usable(id))||null
}

export function assistantWorkflowStage(store,id){return store.cases?.[id]?.stages?.[store.progress?.[id]||0]||null}

function missingFields(message){
 if(!message?.fields?.length||message.status==='submitted')return []
 const errors=validateInquiry(message,message.values||{})
 return message.fields.filter(field=>errors[field.key]).map(field=>field.label)
}

// Chat explains the current form and evidence. It never executes a command,
// changes a draft, supplies sensor values, or advances a business stage.
export function assistantWorkflowReply(store,id,text,{audience='assignee'}={}){
 const item=store.cases?.[id]
 if(!item)return {role:'assistant',text:'当前事项尚未关联可处理的任务，请先选择需要核对的事件。'}
 const stage=assistantWorkflowStage(store,id),execution=store.executionRecords?.[id]?.at(-1)
 const tracking=store.trackingDispositions[id]
 if(item.trackingOnly&&tracking)return {role:'assistant',kind:'scene',expanded:true,title:'本次异动的后续安排',markdown:tracking.status==='recommendation'?`建议范围：${tracking.recommendation.scope}。\n\n按本次停机、隔离、备件及校验条件选择计划窗口，再确认责任人与完成范围。` :tracking.arrangement?`维保负责人：${tracking.arrangement.owner}。\n\n计划窗口：${tracking.arrangement.due}。\n\n实施范围：${tracking.arrangement.scope}。\n\n作业条件：${tracking.arrangement.conditions}。`:`本轮核实结果已保留。请根据变化解释、未确认项及专项检查必要性决定后续安排。`}
 if(store.eventStatus?.[id]==='closed'){
  const completed=store.completedTasks?.[id]
  return {role:'assistant',kind:'scene',expanded:true,title:completed?.title||'本轮已闭环',markdown:completed?`${completed.reason}\n\n已保留本次核实范围、缺项与后续安排。结束核实不自动代表故障已消除或维修已完成。`:`本轮人工确认与执行、验收、观察记录已保留。${execution?.values?.acceptance?'\n\n现场验收：'+execution.values.acceptance:''}\n\n新增情况请沿原事件记录具体时刻、工况与现象；聊天不会改写已提交的闭环记录。`}
 }
 if(audience==='captain'&&store.todoCreated?.[id]&&!store.isTaskHandled?.(id)){
  const assignment=store.assignments[id],assessment=store.checkAssessments?.[id]
  return {role:'assistant',kind:'scene',expanded:true,title:'已派发任务的执行进展',markdown:`### 当前安排\n\n负责人：${assignment?.owner||item.owner}。\n\n要求完成：${assignment?.due||'尚未安排'}。\n\n当前阶段：${stage?.label||'待接收'}。\n\n### 现场回交\n\n${assessment?.message||'执行人尚未提交本轮现场核实结果。'}\n\n### 轮机长关注\n\n核对完成时限、检查范围与现场回交结论；需要人员、备件或停机窗口时协调安排。排查、作业和验收由任务负责人在对应待办中提交。`}
 }
 let next='',missing=[]
 if(!store.todoCreated?.[id]){
  const draft=store.assignmentDrafts?.[id]||store.defaultAssignment?.(id)||{}
  missing=[['owner','负责人'],['scope','处理范围与反馈要求'],['due','要求完成时间']].filter(([key])=>!String(draft[key]||'').trim()).map(([,label])=>label)
  next='核对负责人、处理范围和要求完成时间后，在本事项派发表单确认。'
 }else if(store.isTaskHandled?.(id)&&!item.trackingOnly&&!store.completedTasks?.[id]){
  const result=store.getObservationResult?.(id)
  const automatic=store.automaticObservations?.[id]
  next=`${result?.text||'核对本轮验收、后续观察资料与现场情况。'}\n\n发现原异常反复时填写现象和时间，提交后返回本轮任务复查。人工确认闭环请说明判断依据；观察窗口尚未覆盖时也可由人员决定，但要保留缺项与理由。`
  if(automatic)next+='\n\n自动图表按传感器实际采样时间更新；未接入或缺失的通道保持缺测，不能用历史读数补填修后数据。'
 }else{
  const form=store.stageFeedbackForm?.(id),acceptance=store.executionInquiry?.(id)
  const relevant=stage?.kind==='work'&&/验收|签认|复测|闭环/.test(text)?acceptance:form||acceptance
  missing=missingFields(relevant)
  next=stage?.kind==='work'?'先逐项记录实际实施的维修步骤，再单独填写执行时间、实际措施与逐项验收。保存步骤不会自动视为验收通过。':['intro','overview'].includes(stage?.kind)?'先阅读本阶段准备事项，再开始整表核实；逐项记录发现、无法确认项与证据后提交。':'逐项填写本轮排查结果与现场证据，整表提交后再根据实际发现确定下一步。'
  if(relevant?.status==='submitted')next='本阶段表单已提交，回执保留原填写内容。请继续当前待处理阶段，不需要重复提交。'
 }
 const rows=[]
 if(missing.length)rows.push(`### 当前尚待填写\n\n${missing.map(label=>'- '+label).join('\n')}\n\n请保留实际结果；无法确认的项目应说明缺项和补充安排。`)
 else rows.push('当前表单未发现空缺的必填字段。请核对实际结果、范围和来源后，再使用表单的提交按钮确认。')
 const unresolved=(store.checkAssessments?.[id]?.records||[]).filter(record=>/无法确认|尚未确认|未完成/.test(record.result||''))
 if(unresolved.length)rows.push('### 尚未取得的证据\n\n'+unresolved.map(record=>'- '+record.label+'：'+(record.note||'请补充检查范围、实际读数与来源；保留无法确认结果。')).join('\n'))
 if(/依据|证据|原因|为什么|现场|读数|数据/.test(text)){
  const records=store.checkAssessments?.[id]?.records||[]
  if(records.length)rows.push('### 已提交的现场依据\n\n'+records.map(record=>'- **'+record.label+'**：'+record.result+(record.note?'；'+record.note:'；尚未附现场说明，不能据此扩大处置范围。')).join('\n'))
  else if(stage?.evidence?.length)rows.push('### 本阶段关联资料\n\n'+stage.evidence.map(value=>'- '+(typeof value==='string'?value:value.text||value.title||'请核对本阶段资料来源。')).join('\n'))
 }
 if(stage?.tasks?.length&&/步骤|如何|怎么|排查|核实|检查|依据|证据|原因|资料|缺|下一步/.test(text))rows.push(`### 当前步骤与依据\n\n${stage.tasks.map(task=>'- **'+task.label+'**：'+(task.guide||task.feedback||'记录现场发现、读数时刻及资料来源。')).join('\n')}`)
 rows.push('### 下一步\n\n'+next)
 if(/提交|确认|派发|完成|闭环|复查|同意/.test(text))rows.push('这条消息已作为对话保留。业务记录须由对应表单明确提交，聊天不会替代签认。')
 return {role:'assistant',kind:'scene',expanded:true,title:'当前任务的缺项与处理步骤',markdown:rows.join('\n\n')}
}
