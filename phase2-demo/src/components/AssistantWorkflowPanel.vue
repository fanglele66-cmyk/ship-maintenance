<template>
 <section v-if="item" class="assistant-workflow" :data-workflow-task="taskId" aria-label="当前事项操作">
  <header><div><small>当前事项操作</small><strong>{{item.title||item.initialTitle}}</strong></div><span>{{statusLabel}}</span></header>
  <TrackingDisposition v-if="trackingDecisionActive" ref="trackingPanel" :scenario="trackingRoot" compact @submitted="reportTracking" @reveal="emit('reveal')" />
  <details v-if="assigned&&!trackingDecisionActive" class="workflow-receipt"><summary>查看派发回执</summary><InquiryMessage :message="assignmentForm" read-only /></details>
  <template v-else-if="captain&&!trackingDecisionActive&&!closed&&!store.completedTasks[taskId]">
   <InquiryMessage :message="assignmentForm" @update-inquiry="updateAssignment" @submit-inquiry="submitAssignment" />
  </template>
  <template v-if="assigned&&!trackingDecisionActive&&!closed&&!store.completedTasks[taskId]">
   <section v-if="captain&&!observing" class="workflow-assignment-status" aria-label="已派发任务进展"><strong>{{store.assignments[taskId]?.owner||item.owner}}负责执行</strong><p>要求完成：{{store.assignments[taskId]?.due?.replace('T',' ')}}</p><p>当前阶段：{{stage?.label}}。{{assessment?'已收到本轮现场反馈，可结合回交结果确认后续安排。':'等待执行人提交本轮结果。'}}</p></section>
   <template v-if="!captain&&feedbackForm">
    <h3>{{stage?.kind==='work'?'维修步骤反馈':'本轮整表排查反馈'}}</h3>
    <p v-if="stage?.kind==='work'" class="workflow-hint">逐项记录已实施、未实施与待补项目；步骤反馈与现场验收分别提交。</p>
    <InquiryMessage v-if="stage?.kind!=='work'||feedbackForm.status==='pending'" :message="feedbackForm" @update-inquiry="updateFeedback" @submit-inquiry="submitFeedback" />
    <button v-if="stage?.kind==='work'&&feedbackForm.status==='submitted'" class="p2-secondary workflow-revise" type="button" @click="reviseWorkSteps">补充维修步骤</button>
    <section v-if="assessment?.actions?.length&&feedbackForm.status==='submitted'" class="workflow-check-decision" aria-label="本轮核实后的安排">
     <p>{{assessment.message}}</p>
     <button v-if="assessment.actions.includes('retry')" class="p2-secondary" type="button" @click="retryCheck">补充本轮排查反馈</button>
     <template v-if="checkDecisionOptions.length">
      <label :for="checkDecisionId" class="workflow-choice-label">本轮后续安排</label>
      <FormSelect :id="checkDecisionId" v-model="checkAction" :options="checkDecisionOptions" />
      <InquiryMessage v-if="checkDecisionForm" :message="checkDecisionForm" @update-inquiry="updateCheckDecision" @submit-inquiry="submitCheckDecision" />
     </template>
    </section>
   </template>
   <template v-if="!captain&&executionForm?.status==='pending'&&feedbackForm?.status==='submitted'">
    <h3>本轮执行与逐项验收</h3>
    <InquiryMessage :message="executionForm" @update-inquiry="updateExecution" @submit-inquiry="submitExecution" />
   </template>
   <details v-else-if="!captain&&executionForm?.status==='submitted'" class="workflow-receipt"><summary>查看本轮执行验收回执</summary><InquiryMessage :message="executionForm" read-only /></details>
   <section v-if="captain&&observing" class="workflow-observation" aria-label="效果观察人工决定">
    <h3>效果观察 · 人工决定</h3><p>{{observationResult.text}}</p>

    <label class="workflow-choice-label" :for="decisionId">本次处理</label>
    <FormSelect :id="decisionId" v-model="observationDraft.choice" :options="observationOptions" />
    <InquiryMessage v-if="decisionForm" :message="decisionForm" @update-inquiry="updateObservation" @submit-inquiry="submitObservation" />
   </section>
  </template>
  <div v-if="!trackingDecisionActive&&(closed||store.completedTasks[taskId])" class="workflow-completed" role="status">
   <strong>{{store.completedTasks[taskId]?.title||(closed?'本轮已人工确认闭环':'本次任务已处理')}}</strong>
   <p>{{store.completedTasks[taskId]?.reason||closureReason||'实际措施、验收与观察记录已保留，可在本事件处置记录中回查。'}}</p>
   <details v-if="executionForm"><summary>查看本轮执行验收回执</summary><InquiryMessage :message="executionForm" read-only /></details>
  </div>
  <section v-if="followup&&showFollowups" class="workflow-followups" aria-label="后续追问"><strong>{{followup.title}}</strong><p>{{followup.question}}</p><button v-for="question in followup.questions" :key="question" type="button" class="p2-secondary" @click="emit('ask',question)">{{question}}</button></section>
  <p v-if="error" class="workflow-error" role="alert">{{error}}</p>
  <p v-if="receipt" class="workflow-notice" role="status">{{receipt}}</p>
 </section>
</template>
<script setup>
import {computed,ref,watch,useId,nextTick} from 'vue'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {assistantWorkflowStage} from '@/message-flows/assistantWorkflow'
import InquiryMessage from './messages/InquiryMessage.vue'
import FormSelect from './forms/FormSelect.vue'
import TrackingDisposition from './TrackingDisposition.vue'
import {isTrackingContainer} from '@/mock/issueRelationships'
import {workflowFollowup} from '@/message-flows/workflowFollowup'
import crew from '@/mock/crew.json'
const props=defineProps({taskId:{type:String,required:true},trackingId:String,audience:{type:String,default:'assignee'},showFollowups:{type:Boolean,default:true}}),store=usePhase2DemoStore(),error=ref(''),receipt=ref(''),decisionId=useId(),checkDecisionId=useId(),checkAction=ref(''),checkReason=ref('')
const captain=computed(()=>props.audience==='captain')
const emit=defineEmits(['submitted','reveal','ask'])
const trackingPanel=ref(null),trackingRoot=computed(()=>props.trackingId||(store.cases[props.taskId]?.trackingOnly?props.taskId:null)),trackingDecisionActive=computed(()=>captain.value&&trackingRoot.value&&(store.canDecideTracking(trackingRoot.value)||isTrackingContainer(props.taskId)))
const item=computed(()=>store.cases[props.taskId]),assigned=computed(()=>Boolean(store.todoCreated[props.taskId])),closed=computed(()=>store.eventStatus[props.taskId]==='closed')
const stage=computed(()=>assistantWorkflowStage(store,props.taskId))
watch(()=>props.taskId,()=>{error.value='';receipt.value='';store.ensureAssignmentDraft?.(props.taskId);store.ensureObservationDecision?.(props.taskId)},{immediate:true})
const assignmentFields=[{key:'owner',label:'负责人',type:'select',required:true,options:crew.map(person=>({value:person.name+'（'+person.role+'）',label:person.name+'（'+person.role+'）'}))},
 {key:'scope',label:'处理范围与反馈要求',type:'textarea',required:true},{key:'due',label:'要求完成时间',type:'datetime-local',required:true}]
const assignmentForm=computed(()=>({id:'assistant-assignment-'+props.taskId,text:assigned.value?'本次派发记录':'确认本次派发安排',status:assigned.value?'submitted':'pending',fields:assignmentFields,
 values:assigned.value?store.assignments[props.taskId]:store.assignmentDrafts?.[props.taskId]||{},submitLabel:'确认派发任务',submittedAt:store.assignmentRecords[props.taskId]?.at(-1)?.at,receiptText:undefined}))
const feedbackForm=computed(()=>assigned.value&&!closed.value&&['check','work'].includes(stage.value?.kind)?store.stageFeedbackForm?.(props.taskId)||null:null)
const assessment=computed(()=>store.checkAssessments[props.taskId]?.stageId===stage.value?.id?store.checkAssessments[props.taskId]:null)
const checkDecisionLabels={supplement:'登记补充线索', 'finish-tracking':'提交本次核实结果', 'end-warning':'结束本次预警核实', 'end-maintenance':'结束本次提前评估'}
const checkDecisionOptions=computed(()=>(assessment.value?.actions||[]).filter(action=>checkDecisionLabels[action]).map(value=>({value,label:checkDecisionLabels[value]})))
const checkDecisionForm=computed(()=>checkDecisionOptions.value.some(option=>option.value===checkAction.value)?{
 id:'assistant-check-decision:'+props.taskId+':'+stage.value.id+':'+checkAction.value,status:'pending',text:checkDecisionLabels[checkAction.value],
 hint:'填写已核实范围、尚缺资料与后续安排；结束本次核实不自动代表故障消除或维护已完成。',
 fields:[{key:'reason',label:'决定依据与后续安排',type:'textarea',required:true}],values:{reason:checkReason.value},submitLabel:'确认本轮安排',
}:null)
watch([()=>props.taskId,()=>stage.value?.id],()=>{checkAction.value='';checkReason.value=''})
const executionForm=computed(()=>{
 const current=store.executionInquiry(props.taskId)
 if(current&&stage.value?.kind==='work')return current
 return store.logs[props.taskId]?.findLast(message=>message.purpose==='execution-record'&&message.status==='submitted'&&message.round===(store.workflowRounds[props.taskId]||1))||null
})
const observing=computed(()=>assigned.value&&!closed.value&&!item.value?.trackingOnly&&!store.completedTasks[props.taskId]&&store.isTaskHandled(props.taskId)&&store.executionRecords[props.taskId]?.at(-1)?.values.verification==='resolved')
const automatic=computed(()=>store.automaticObservations[props.taskId]),observationResult=computed(()=>store.getObservationResult(props.taskId)),observationDraft=computed(()=>store.observationDecisionDrafts?.[props.taskId]||{})
const observationOptions=[{value:'abnormal',label:'原异常反复，返回复查'},{value:'stable',label:'人工确认闭环'}]
const decisionForm=computed(()=>{
 const choice=observationDraft.value.choice
 if(!['abnormal','stable'].includes(choice))return null
 const abnormal=choice==='abnormal',early=observationResult.value.type!=='archive',key=abnormal?'note':'reason'
 return {id:'assistant-observation-'+props.taskId+'-'+choice,status:'pending',text:abnormal?'记录本次异常复查依据':early?'说明提前闭环的人工判断依据':'确认本轮闭环依据',
  hint:abnormal?'填写发现时间、工况、异常现象与需复核的方向；前轮措施和观察记录继续保留。':early?'当前观察资料尚未完整覆盖窗口。请说明现场验收、已取得证据、未覆盖项及后续安排。':'核对现场验收和观察范围后确认；采样覆盖本身不代表修复成功。',
  fields:[{key,label:abnormal?'异常现象与复查依据':'人工闭环依据',type:'textarea',required:abnormal||early}],values:observationDraft.value,submitLabel:abnormal?'提交并返回复查':'确认本轮闭环'}
})
const closureReason=computed(()=>store.logs[props.taskId]?.findLast(message=>message.role==='user'&&/闭环/.test(message.text||''))?.text)
const statusLabel=computed(()=>closed.value?'已闭环':observing.value?'效果观察中':assigned.value?stage.value?.label||'处置中':'待派发')
function report(result,success){
 const ok=result===true||result?.ok===true
 error.value=ok?'':result?.error||'本次尚未提交，请核对当前阶段及必填资料。'
 receipt.value=ok?success:''
 if(ok)emit('submitted')
 return ok
}
function applyAssignment(values){store.updateAssignmentDraft(props.taskId,values);error.value=''}
function updateAssignment(payload){applyAssignment(payload.values)}
function submitAssignment(payload){if(assigned.value||payload.messageId!==assignmentForm.value.id)return;updateAssignment(payload);report(store.submitSharedAssignment(props.taskId),'派发已确认。')}
function applyFeedback(values){const form=feedbackForm.value;if(form?.status==='pending')store.updateStageFeedback(props.taskId,values,form.id);error.value=''}
function updateFeedback(payload){if(feedbackForm.value?.id===payload.messageId&&feedbackForm.value.status==='pending')applyFeedback(payload.values)}
function submitFeedback(payload){if(!feedbackForm.value||feedbackForm.value.status==='submitted'||feedbackForm.value.id!==payload.messageId)return;updateFeedback(payload);report(store.submitStageFeedback(props.taskId,payload.messageId),'本阶段整表反馈已提交，原始结果与备注已保留。')}
function reviseWorkSteps(){report(store.reviseWorkStepFeedback(props.taskId),'可补充本轮维修步骤，之前的提交回执继续保留。')}
function retryCheck(){if(report(store.decideCheck(props.taskId,'retry'),'可以补充本轮核实，之前已提交的反馈回执继续保留。')){checkAction.value='';checkReason.value=''}}
function updateCheckDecision(payload){if(payload.messageId===checkDecisionForm.value?.id){checkReason.value=payload.values.reason||'';error.value=''}}
function submitCheckDecision(payload){if(payload.messageId!==checkDecisionForm.value?.id)return;updateCheckDecision(payload);if(report(store.decideCheck(props.taskId,checkAction.value,checkReason.value),'本轮决定和后续安排已记录。')){checkAction.value='';checkReason.value=''}}
function applyExecution(values){const message=executionForm.value;if(message?.status==='pending'){store.updateExecutionRecord(props.taskId,message.id,{...message.values,...values});error.value=''}}
function updateExecution(payload){if(executionForm.value?.id===payload.messageId)applyExecution(payload.values)}
function submitExecution(payload){if(executionForm.value?.status!=='pending'||executionForm.value.id!==payload.messageId)return;updateExecution(payload);report(store.confirmExecutionRecord(props.taskId,payload.messageId,payload.values),'执行与逐项验收已提交，按实际结果接续后续阶段。')}
function updateObservation(payload){if(decisionForm.value?.id===payload.messageId){Object.assign(observationDraft.value,payload.values);error.value=''}}
function submitObservation(payload){
 if(!observing.value||decisionForm.value?.id!==payload.messageId)return
 updateObservation(payload)
 if(observationDraft.value.choice==='abnormal'){
  if(!String(observationDraft.value.note||'').trim()){error.value='请填写异常现象与复查依据。';return}
  if(report(store.submitObservationReview(props.taskId,'abnormal',{note:observationDraft.value.note}),'异常复查依据已登记，前轮记录完整保留。'))store.reopenTodo(props.taskId)
 }else report(store.completeObservation(props.taskId,{reason:observationDraft.value.reason}),'人工闭环确认已保存。')
}
watch([captain,assigned,()=>stage.value?.id,trackingDecisionActive],()=>{if(!captain.value&&assigned.value&&!trackingDecisionActive.value&&['intro','overview','event'].includes(stage.value?.kind)){store.selectTodo(props.taskId);store.advanceTodo(props.taskId)}},{immediate:true})
const followup=computed(()=>captain.value&&assigned.value&&!observing.value&&!trackingDecisionActive.value&&!closed.value?{title:'派发后的跟进',question:'需要核对当前进展、完成时限或现场回交结果吗？',questions:['这项任务目前进展如何？','现场已经回交了哪些结果？']}:workflowFollowup(store,props.taskId,trackingRoot.value))
function reportTracking(){error.value='';receipt.value='';emit('submitted')}
const importMessage=computed(()=>trackingDecisionActive.value?trackingPanel.value?.importMessage:captain.value?(!assigned.value?assignmentForm.value:observing.value?decisionForm.value:null):feedbackForm.value?.status==='pending'?feedbackForm.value:executionForm.value?.status==='pending'&&feedbackForm.value?.status==='submitted'?executionForm.value:checkDecisionForm.value)
function applyImported(values){const message=importMessage.value;if(!message)return;if(trackingDecisionActive.value)trackingPanel.value?.applyImported(values);else if(message.id===assignmentForm.value.id)applyAssignment(values);else if(message.id===feedbackForm.value?.id)applyFeedback(values);else if(message.id===executionForm.value?.id)applyExecution(values);else if(message.id===decisionForm.value?.id)updateObservation({messageId:message.id,values});else updateCheckDecision({messageId:message.id,values});emit('reveal',trackingDecisionActive.value?undefined:message.id)}
defineExpose({importMessage,applyImported,followup})
// Watch individual identifiers: rebuilding a form's values is not a new form.
watch([()=>decisionForm.value?.id,()=>checkDecisionForm.value?.id],async([decision,check])=>{const id=decision||check;if(id){await nextTick();emit('reveal',id)}})
watch([()=>props.taskId,()=>stage.value?.id,()=>feedbackForm.value?.status,observing,closed,trackingDecisionActive],async()=>{await nextTick();emit('reveal')})
</script>
<style scoped>
.assistant-workflow{margin-top:22px;padding-top:18px;border-top:1px solid #dce4ee;min-width:0;font-size:13px;line-height:1.7}.assistant-workflow header{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.assistant-workflow header div{min-width:0}.assistant-workflow header small{display:block;color:#8b7148;font-size:11px}.assistant-workflow header strong{display:block;color:#24334a;font-size:14px;overflow-wrap:anywhere}.assistant-workflow header span{flex-shrink:0;color:#748297;font-size:11px}.workflow-sync,.workflow-hint{color:#7b8797;font-size:12px;margin:8px 0 12px}.assistant-workflow h3{font-size:13px;color:#33465f;margin:20px 0 8px}.workflow-receipt{margin:12px 0}.assistant-workflow summary{cursor:pointer;color:#7f6845}.workflow-completed,.workflow-preparation{margin-top:14px;padding:12px 0}.workflow-completed p,.workflow-preparation p{margin:8px 0;color:#65758a}.workflow-observation{margin-top:14px}.workflow-choice-label{display:block;color:#50596a;font-size:12px;margin:10px 0 5px}.workflow-observation :deep(.p2-inquiry){margin-top:12px}.workflow-error{color:#b23b36;margin:10px 0}.workflow-notice{color:#397f68;margin:10px 0}.assistant-workflow :deep(.p2-inquiry){min-width:0}.assistant-workflow :deep(.p2-inquiry-field){max-width:100%}.assistant-workflow :deep(input),.assistant-workflow :deep(textarea){max-width:100%}.assistant-workflow :deep(button){max-width:100%;white-space:normal}.workflow-receipt :deep(.p2-inquiry){border:0;padding:10px 0}
</style>

<style scoped>.workflow-followups{margin:16px 0;padding:12px 0;border-top:1px solid #edf0f3}.workflow-followups p{margin:6px 0}.workflow-followups button{display:block;width:100%;text-align:left;margin-top:6px;font-size:12px;padding:7px 10px}.workflow-revise,.workflow-check-decision>button{font-size:12px;min-height:32px;padding:6px 10px}</style>
