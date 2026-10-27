import {reactive} from 'vue'
import {checkChoices} from '@/mock/eventFeedbackRules'
import {validateInquiry} from '@/message-flows/inquiryFields'

// The two work surfaces address the same task and stage, never separate copies.
export function createSharedWorkflow(core){
 const assignmentDrafts=reactive({}),workStepRecords=reactive({}),observationDecisionDrafts=reactive({}),trackingDecisionDrafts=reactive({}),workSummaries={}
 const copy=value=>JSON.parse(JSON.stringify(value))
 const stageFor=id=>core.cases[id]?.stages[core.progress[id]]
 const chinaLocalMinute=time=>new Date(time+8*3600000).toISOString().slice(0,16)
 const validDue=value=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'+08:00'))&&chinaLocalMinute(Date.parse(value+'+08:00'))===value
 function ensureAssignmentDraft(id){
  if(!assignmentDrafts[id]){const initial={...core.defaultAssignment(id),...core.assignments[id]};if(!validDue(initial.due||''))initial.due=chinaLocalMinute(Date.now()+4*3600000);assignmentDrafts[id]=initial}
  return assignmentDrafts[id]
 }
 function updateAssignmentDraft(id,values){if(!core.cases[id])return false;Object.assign(ensureAssignmentDraft(id),values);return true}
 function submitSharedAssignment(id){
  if(!core.cases[id]||core.eventStatus[id]==='closed')return {ok:false,error:'当前事件不能派发。'}
  const values={...ensureAssignmentDraft(id)}
  if(!values.owner?.trim()||!values.scope?.trim()||!values.due?.trim())return {ok:false,error:'请补齐负责人、计划时间与处理要求。'}
  if(!validDue(values.due))return {ok:false,error:'请选择有效的要求完成时间。'}
  if(Date.parse(values.due+'+08:00')<=Date.now())return {ok:false,error:'要求完成时间应晚于当前时间。'}
  if(values.collaborator==='none')values.collaborator=''
  const previous=core.assignments[id]
  if(core.todoCreated[id]&&previous&&['owner','type','scope','due','collaborator'].every(key=>(previous[key]||'')===(values[key]||'')))return {ok:true,alreadySubmitted:true}
  if(!core.todoCreated[id]&&!core.createTodo(id))return {ok:false,error:'事件状态已变化，请核对派发范围。'}
  if(!core.assignTask(id,values))return {ok:false,error:'指派未保存，请核对任务状态。'}
  Object.assign(ensureAssignmentDraft(id),core.assignments[id])
  core.addLog(id,'assistant','任务已派发给'+values.owner+'。请核对检查条件，并在要求时限前提交反馈。')
  return {ok:true}
 }
 function stageFeedbackForm(id){
  const stage=stageFor(id)
  if(!core.todoCreated[id]||!stage||!['check','work'].includes(stage.kind)||core.isTaskHandled(id))return null
  const key=id+':'+stage.id,work=stage.kind==='work'
  const saved=work?workStepRecords[key]:core.checkAssessments[id]?.stageId===stage.id?core.checkAssessments[id]:null
  const fields=stage.tasks.flatMap((task,index)=>[
   {key:'result_'+index,label:task.label+' · '+(work?'完成情况':'检查结果'),type:'select',required:true,options:(work?['已完成','未完成','不适用']:task.options||checkChoices(id,stage.baseStageId||stage.id,index)).map(value=>({value,label:value}))},
   {key:'note_'+index,label:task.label+' · 备注（选填）',type:'textarea',placeholder:task.recordHint||'填写检查部位、实际措施或尚未完成的原因。'},
  ])
  const values=Object.fromEntries(stage.tasks.flatMap((_,index)=>[['result_'+index,core.taskResults[key+':'+index]||''],['note_'+index,core.taskNotes[key+':'+index]||'']]))
  return {id:'stage-feedback:'+key,stageId:stage.id,role:'assistant',type:'inquiry',status:saved?'submitted':'pending',text:stage.label+' · 整表反馈',fields,values,submittedAt:saved?.at,submitLabel:work?'保存维修步骤记录':'提交本轮反馈'}
 }
 function updateStageFeedback(id,values,messageId){
  const form=stageFeedbackForm(id);if(!form||form.status!=='pending'||messageId&&messageId!==form.id)return false
  const stage=stageFor(id)
  stage.tasks.forEach((_,i)=>{const key=id+':'+stage.id+':'+i;if(Object.hasOwn(values,'result_'+i))core.taskResults[key]=values['result_'+i];if(Object.hasOwn(values,'note_'+i))core.taskNotes[key]=values['note_'+i]})
  return true
 }
 function submitStageFeedback(id,messageId){
  const form=stageFeedbackForm(id)
  if(!form||messageId&&messageId!==form.id)return {ok:false,error:'当前步骤已变化，请查看最新表单。'}
  if(form.status==='submitted')return {ok:true,alreadySubmitted:true}
  if(Object.keys(validateInquiry(form,form.values)).length)return {ok:false,error:'请完成各项结果与实际记录。'}
  const stage=stageFor(id),key=id+':'+stage.id
  const records=stage.tasks.map((task,i)=>({label:task.label,result:form.values['result_'+i],note:form.values['note_'+i],attachments:core.taskAttachments[key+':'+i]||[]}))
  if(stage.kind==='check'){
   core.activeStage[id]=core.progress[id]
   const result=core.advanceTodo(id,records)
   return {ok:Boolean(result?.saved),error:result?.saved?'':result?.message||'未提交，请核对现场反馈。'}
  }
  const at=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})
  workStepRecords[key]={stageId:stage.id,records:copy(records),at}
  core.addLog(id,'user','提交维修步骤记录：'+records.map(record=>record.label+'：'+record.result+(record.note?'；'+record.note:'')).join('；'))
  core.addLog(id,'assistant',{kind:'feedbackRecord',title:'维修步骤记录已保存',task:stage.title,records:copy(records),submittedAt:at,actor:core.taskActors[id]})
  core.recordStory(id,'work-progress','维修步骤记录',records.map(record=>record.label+'：'+record.result+(record.note?'；'+record.note:'')).join('\n'),'逐项记录已保存，待现场验收。')
  const inquiry=core.executionInquiry(id)
  if(inquiry&&(!inquiry.values.measures||inquiry.values.measures===workSummaries[key])){
   workSummaries[key]=records.map(record=>record.label+'：'+record.result+(record.note?'；'+record.note:'')).join('\n')
   core.updateExecutionRecord(id,inquiry.id,{...inquiry.values,measures:workSummaries[key]})
  }
  return {ok:true}
 }
 function ensureObservationDecision(id){observationDecisionDrafts[id] ||= {choice:'',note:'',reason:''};return observationDecisionDrafts[id]}
 function ensureTrackingDecision(id){trackingDecisionDrafts[id] ||= {mode:'',form:{reason:'',scope:'',owner:'李建国（大管轮）',due:'',conditions:'',deadline:'',metrics:'',criteria:''}};return trackingDecisionDrafts[id]}
 function reviseWorkStepFeedback(id){const stage=stageFor(id);if(stage?.kind!=='work'||core.isTaskHandled(id))return false;delete workStepRecords[id+':'+stage.id];return true}
 function resetSharedWorkflow(id){for(const collection of [assignmentDrafts,workStepRecords,observationDecisionDrafts,trackingDecisionDrafts,workSummaries])for(const key of Object.keys(collection))if(!id||key===id||key.startsWith(id+':'))delete collection[key]}
 return {assignmentDrafts,workStepRecords,observationDecisionDrafts,trackingDecisionDrafts,ensureTrackingDecision,ensureAssignmentDraft,updateAssignmentDraft,submitSharedAssignment,stageFeedbackForm,updateStageFeedback,submitStageFeedback,ensureObservationDecision,reviseWorkStepFeedback,resetSharedWorkflow}
}
