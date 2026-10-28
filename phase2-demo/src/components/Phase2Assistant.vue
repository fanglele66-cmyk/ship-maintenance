<template>
  <aside class="p2-assistant p2-restored-assistant" :data-audience="audience" :data-viewer="viewer">
    <div class="p2-assistant-head"><span class="p2-ai-mark">✦</span><div><strong>{{props.title}}</strong><small>{{viewer}} · {{ contextLabel }}</small></div><ConversationHistory :conversations="sessions.conversations.value" :current-id="sessions.active.value.id" @select="sessions.select" @new-conversation="sessions.newConversation" /></div>
    <button v-if="workflowTaskId" type="button" class="assistant-workflow-shortcut" @click="focusWorkflow">{{audience==='assignee'?'查看当前反馈与处理表单':store.todoCreated[workflowTaskId]?'查看本事项决策与回交':'填写本事项派发安排'}} <span aria-hidden="true">↓</span></button>
    <div ref="scrollRef" class="p2-messages" @wheel.passive="pauseAutoScroll" @pointerdown="pauseAutoScroll" @focusin="pauseAutoScroll" @keydown="pauseAutoScroll" @touchmove.passive="pauseAutoScroll">
     <div ref="contentRef" class="assistant-message-content">
      <MessageRenderer v-for="(message,index) in displayedMessages" :key="message.id || index" :message="message" :expanded="index===(mode==='attention'?lastAttentionSceneIndex:displayedMessages.length-1)" @action="runDemoAction" @stream-progress="followResponse" @stream-complete="completeResponse" />
      <small v-if="props.dossier && store.dossierReviews[key]?.decision==='deferred'">已保留暂不安排的决定与原因</small>
      <div v-if="workflowTaskId||trackingIssueId" class="assistant-form-disclosure">
       <button v-if="workflowExpanded" type="button" class="assistant-form-collapse" :aria-expanded="workflowExpanded" @click="workflowExpanded=false">收起当前表单 ↑</button>
       <AssistantWorkflowPanel v-show="workflowExpanded" :key="workflowTaskId||trackingIssueId" ref="workflowPanel" :task-id="workflowTaskId||trackingIssueId" :tracking-id="trackingIssueId" :audience="audience" :show-followups="false" @submitted="workflowSubmitted" @reveal="revealWorkflow" @ask="askFollowup" />
      </div>
      <section v-if="workflowFollowup" class="assistant-followups" aria-label="后续追问"><p>{{workflowFollowup.question}}</p><button v-for="question in workflowFollowup.questions" :key="question" type="button" @click="askFollowup(question)">{{question}}</button></section>
      <RecordImport v-if="importMessage" ref="recordImport" :message="importMessage" @apply="applyFile" @preview="revealImport" />
     </div>
    </div>
    <button v-if="hasNewReply" class="assistant-new-reply" type="button" @click="showLatestReply">有新回复 ↓</button>
    <form class="p2-compose" @submit.prevent="send"><div class="p2-compose-shell"><textarea v-model="draft" rows="2" :placeholder="placeholder" aria-label="对话输入" @keydown.enter.exact.prevent="send"></textarea><div class="p2-compose-foot"><button type="button" class="compose-attachment" aria-label="上传文件" title="上传 TXT、Markdown、CSV 或 JSON 记录" :disabled="!importMessage" @click="fileInput?.click()">＋</button><input ref="fileInput" class="compose-file-input" type="file" accept=".txt,.md,.csv,.json" @change="readAttachment"/><button type="submit" aria-label="发送" title="发送" :disabled="!draft.trim()"><img :src="sendIcon" alt="" aria-hidden="true" /></button></div></div></form>
  </aside>
</template>
<script setup>
import {deviceStoryAssessment} from '@/mock/fourStoryWorkflow'
import { issueConversationMessages, mergeIssueConversation, issueReply, issueContext } from '@/message-flows/issueSources'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import sendIcon from '@/assets/figma/send.svg'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { observationScene } from '@/mock/phase2Observation'
import { observationMessages } from '@/message-flows/observationMessages'
import { useAgentConversations, demoConversations } from '@/composables/useAgentConversations'
import MessageRenderer from './messages/MessageRenderer.vue'
import ConversationHistory from './messages/ConversationHistory.vue'
import AssistantWorkflowPanel from './AssistantWorkflowPanel.vue'
import RecordImport from './RecordImport.vue'
import {assistantWorkflowTask,assistantWorkflowReply} from '@/message-flows/assistantWorkflow'
import {workflowAdvice,presentWorkflowConversation,reconcileWorkflowAdvice} from '@/message-flows/assistantPresentation'
import {eventBriefingFor} from '@/mock/eventBriefings'
import deviceFlow from '@/message-flows/device-overview.json'
import { resolveMessageFlow } from '@/message-flows/resolveMessageFlow'
import { deviceMessageSources, deviceConversationRecords } from '@/message-flows/deviceSources'
import { attentionFollowup, maintenanceFollowup, followupConversation } from '@/mock/phase2Followup'
import { shipOverviewConversation } from '@/mock/phase2ShipConversation'
import { attentionDossier } from '@/mock/attentionDossier'
import { r02InitialMessage, r02Reply } from '@/mock/r02Stories'
import { useEventWorkOrderStore } from '@/stores/eventWorkOrderStore'
import { useMaintenanceAdviceStore } from '@/stores/maintenanceAdviceStore'
import { appendMessages } from '@/message-flows/appendMessages'
import { maintenanceMessageFlow, maintenanceReply } from '@/message-flows/maintenanceSources'
import { dispatchConversationAction } from '@/message-flows/conversationActions'
import { operationAssessment } from '@/mock/phase2SituationContent'
import deviceProfiles from '@/mock/deviceOverviewProfiles.json'
import { attentionInquiry } from '@/message-flows/attentionInquiry'
const props=defineProps({title:{type:String,default:'检修助手'},mode:{type:String,required:true},dossier:Boolean,maintenanceDetail:Boolean,planOnly:Boolean,deviceId:String,deviceName:String,issueId:String}),store=usePhase2DemoStore(),scrollRef=ref(null)
const mode=computed(()=>props.issueId?'issue':props.maintenanceDetail ? 'attention' : props.dossier ? (store.situationObservationId?'observation':'attention') : props.mode==='attention'&&store.situationObservationId?'observation':props.mode==='attention'&&!store.attentionInFocus?'device':props.mode)
const key=computed(()=>mode.value==='observation'?store.situationObservationId:mode.value==='attention'?store.selectedAttentionId:mode.value==='todo'?store.selectedTodoId:mode.value)
const audience=computed(()=>mode.value==='todo'?'assignee':'captain')
const viewer=computed(()=>audience.value==='captain'?'陈志远（轮机长）':store.assignments[key.value]?.owner||store.cases[key.value]?.owner||'任务负责人')
const workflowPanel=ref(null),recordImport=ref(null),fileInput=ref(null)
const trackingIssueId=computed(()=>props.issueId&&store.cases[props.issueId]?.trackingOnly?props.issueId:store.cases[key.value]?.trackingOnly?key.value:null)
const importMessage=computed(()=>workflowPanel.value?.importMessage||null)
const workflowFollowup=computed(()=>workflowPanel.value?.followup||null)
function readAttachment(event){recordImport.value?.readFile(event)}
async function applyFile(values){workflowExpanded.value=true;await nextTick();workflowPanel.value?.applyImported(values)}
async function revealImport(){pauseAutoScroll();await nextTick();revealMessage(recordImport.value?.$el)}
const contentRef=ref(null),workflowExpanded=ref(false),hasNewReply=ref(false)
let followNewReply=false,entryLandingPending=false,entryGeneration=0,followFrame=null
// Editing and reading never trigger a jump. Only an explicit send/submit follows a new reply.
function pauseAutoScroll(){followNewReply=false}
function messageElement(id){return [...(scrollRef.value?.querySelectorAll?.('[data-message-id]')||[])].find(node=>node.dataset.messageId===id)}
function revealMessage(element,behavior='smooth'){
 const container=scrollRef.value;if(!container||!element)return
 container.scrollTo({top:Math.max(0,container.scrollTop+element.getBoundingClientRect().top-container.getBoundingClientRect().top-12),behavior})
}
async function showLatestReply(){
 followNewReply=true;hasNewReply.value=false;await nextTick()
 const latest=[...displayedMessages.value].reverse().find(message=>message.role==='assistant')
 revealMessage(messageElement(latest?.id)||scrollRef.value?.querySelector?.('.is-current-advice'))
}
async function scrollLatest(){if(!entryLandingPending)await showLatestReply()}
function followResponse(payload){
 if(!followNewReply||entryLandingPending||followFrame!==null)return
 if(typeof requestAnimationFrame==='undefined')return
 followFrame=requestAnimationFrame(()=>{
  followFrame=null
  const container=scrollRef.value
  const response=messageElement(payload?.messageId)?.querySelector?.('.assistant-advice')||container?.querySelector?.('.is-current-advice')
  if(!followNewReply||!container||!response)return
  const box=container.getBoundingClientRect(),target=response.getBoundingClientRect()
  if(target.bottom>box.bottom-16)container.scrollTo({top:container.scrollTop+target.bottom-box.bottom+24,behavior:'smooth'})
 })
}
function completeResponse(payload){
 const id=payload?.messageId||payload?.id||payload
 const snapshot=sessions.active.value.adviceHistory?.find(row=>row.id===id)
 if(snapshot)snapshot.animate=false
 followResponse(payload)
}
async function revealWorkflow(messageId){
 if(entryLandingPending||!workflowExpanded.value)return
 pauseAutoScroll();await nextTick()
 if(entryLandingPending)return
 const panel=workflowPanel.value?.$el,container=scrollRef.value
 const element=messageId?[...(panel?.querySelectorAll?.('[data-inquiry-id]')||[])].find(node=>node.dataset.inquiryId===messageId):panel?.querySelector?.('.decision-form, .workflow-observation, .p2-inquiry:has(form)')
 if(!container||!element)return
 const box=container.getBoundingClientRect(),target=element.getBoundingClientRect(),padding=12
 if(target.top>=box.top+padding&&target.bottom<=box.bottom-padding)return
 const offset=target.height>box.height-padding*2||target.top<box.top+padding?target.top-box.top-padding:target.bottom-box.bottom+padding
 container.scrollTo({top:container.scrollTop+offset,behavior:'smooth'})
}
onUnmounted(()=>{if(followFrame!==null)cancelAnimationFrame(followFrame)})
function workflowSubmitted(){workflowExpanded.value=false;entryGeneration++;entryLandingPending=false;sessions.touch();showLatestReply()}
function askFollowup(text){if(props.issueId)askIssue(text);else askWorkflow(text);scrollLatest()}
const workflowTaskId=computed(()=>{
 if(props.planOnly||props.maintenanceDetail)return null
 if(props.issueId){const context=issueContext(props.issueId,store);return assistantWorkflowTask(store,{issueId:props.issueId,taskId:context?.taskId,decisionId:context?.decisionId})}
 return ['todo','observation'].includes(mode.value)||props.dossier?assistantWorkflowTask(store,{taskId:key.value}):null
})
const advice=useMaintenanceAdviceStore(),workOrders=useEventWorkOrderStore()
const genericDevice=computed(()=>Boolean(props.deviceId && props.deviceId!=='main-engine-1' && !props.dossier && !props.maintenanceDetail))
const genericProfile=computed(()=>deviceStoryAssessment(store,props.deviceId))
const genericReplies=reactive({})
const genericConversation=computed(()=>[{role:'user',text:`查看${props.deviceName}当前运行情况和建议`},{role:'assistant',kind:'scene',title:props.deviceName+'运行概况',paragraphs:[{label:'当前判断',text:genericProfile.value.conclusion},{label:'判断依据',text:genericProfile.value.basis},{label:'下一步',text:genericProfile.value.next}]},...(genericReplies[props.deviceId]||[])])
const pageContext=computed(()=>props.planOnly?'routine-plan:maintenance':props.issueId?'issue:'+props.issueId:genericDevice.value?'device:'+props.deviceId:props.maintenanceDetail?(store.regularMaintenanceInFocus?'maintenance-arrangements:1':'maintenance-advice:1'):mode.value==='device'?'device:main-engine-1':`${mode.value}:${key.value}`)
const agentId=computed(()=>`${audience.value}:${viewer.value}:${pageContext.value}`)
const sessions=useAgentConversations(agentId,id=>props.issueId?[]:demoConversations(id))
const draft=sessions.draft
const inquiryDrafts=reactive({}),inquiryErrors=reactive({})
const currentInquiry=computed(()=>props.dossier && mode.value==='attention' ? attentionInquiry(store,key.value,inquiryDrafts) : null)
async function focusInquiry(){
  sessions.select(sessions.agent.value.primaryId)
  await nextTick()
  if(workflowTaskId.value){focusWorkflow();return}
  const element=scrollRef.value?.querySelector('.r02-decision') || scrollRef.value?.querySelector('.p2-inquiry')
  element?.scrollIntoView({block:'nearest',behavior:'smooth'})
  element?.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true})
}
async function focusWorkflow(){pauseAutoScroll();workflowExpanded.value=true;await nextTick();const element=workflowPanel.value?.$el;revealMessage(element);element?.querySelector?.('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true})}
defineExpose({focusInquiry})
const messages=computed(()=>(store.logs[key.value]||[]).filter(message=>(!message.conversationId || message.conversationId===sessions.agent.value.primaryId)&&(audience.value!=='assignee'||message.audience!=='captain')))
const attentionConversation=computed(()=>{
  if (mode.value !== 'attention') return messages.value
  const id = key.value
  const report = id === 'maintenance' ? maintenanceFollowup(store, store.regularMaintenanceInFocus) : attentionFollowup(store, id)
  const topic = store.regularMaintenanceInFocus ? '周期计划 · 当前安排' : id === 'maintenance' ? '提前维保 · 当前建议' : '异动跟踪 · 当前建议'
  const accompanying = messages.value.filter(message => !['scene','feedbackRecord','recordDraft'].includes(message.kind) && !message.stageId && !(message.role === 'user' && /^(查看|进入)/.test(message.text || '')) && !message.observationContext)
  return [...followupConversation(report, topic),...accompanying]
})
const shipConversation = computed(() => [shipOverviewConversation(store), ...messages.value.filter(message => message.role === 'user' || message.shipFollowup)])
const deviceConversation = computed(() => [
 {role:'user',text:'查看主机当前运行情况和需要关注的事项'},
 {role:'assistant',kind:'scene',title:'主机运行研判',paragraphs:operationAssessment(store).summary.filter(item=>item.label!=='分析依据').map(item=>({label:item.label,text:item.text})),actions:[...(!store.todoCreated['real-warning-0523']&&!store.ignoredSuggestions['real-warning-0523']?[{id:'item:real-warning-0523',label:'了解控制空气低压依据'}]:[]),{id:'item:real-maintenance-c4-baseline',label:'了解四缸专项检查建议'}]},
 ...deviceConversationRecords(messages.value)
])
const observationConversation=computed(()=>mode.value==='observation'?observationMessages(store,key.value,messages.value):[])
const dossierMessages=computed(()=>{
  const dossier=attentionDossier(store,key.value)
  if(!dossier)return []
  const records=messages.value.filter(message=>!/^现场核实已提交：|^本次核实已提交/.test(message.text||''))
  const replies=records.filter((message,i)=>(message.text && !(message.role==='user' && /^(查看|进入)/.test(message.text))) || (message.type==='inquiry' || message.kind==='scene' && records[i-1]?.role==='user' && !/^(查看|进入)/.test(records[i-1]?.text||''))).map(message=>message.kind==='scene'?{...message,title:'当前依据与安排',paragraphs:[{label:'当前判断',text:dossier.conclusion},{label:'比较参考',text:dossier.charts.map(chart=>chart.reference).join('；')},{label:'当前安排',text:dossier.action.text}],question:'以上依据当前档案回答；新增现场信息将保留到跟踪记录。'}:message)
  if(key.value==='drift'){
    const linked=store.todoCreated.drift,ignored=store.ignoredSuggestions.drift
    return [{role:'user',text:'查看主机3号缸排温变化的判断依据和建议安排'}, {role:'assistant',kind:'scene',title:linked?'检查待办已安排':ignored?'本次决定已记录':'3号缸排温偏离 · 需要决策',paragraphs:[{label:'判断',text:'相近工况下，排温由430升至432°C，缸间相对差由9扩大至10°C，变化值得核验。单一排温信号不足以判断喷油器或排气阀故障。'},{label:'安排',text:linked?store.assignments.drift.owner+'负责'+store.assignments.drift.type+'。后续核实、检查结果在原待办接续。':ignored?'本次暂不安排检查：'+ignored.reason:'建议先核实现场仪表、转速负荷和有无异响。接受建议后在左侧确认负责人和反馈要求，建立检查待办；也可记录忽略建议的依据。'}],actions:linked?[{id:'todo:drift',label:'查看当前待办'}]:[]},...replies]
  }
  const summary=r02InitialMessage(store,key.value) || {role:'assistant',kind:'scene',title:'当前异动跟踪档案',paragraphs:[{label:'本次重点',text:dossier.action.text}]}
  return [summary,...(currentInquiry.value?[{...currentInquiry.value,submitError:inquiryErrors[currentInquiry.value.id]}]:[]),...replies ]
})
const maintenanceMessages=computed(()=>[...maintenanceMessageFlow(store,advice,store.regularMaintenanceInFocus,workOrders.state('maintenance')),...advice.chatMessages.filter(message=>message.conversationId===sessions.agent.value.primaryId)])
const todoConversation=computed(()=>{
 const rows=messages.value,first=rows.findIndex(row=>row.stageId),assignment=store.assignments[key.value]
 const receipt=assignment&&store.todoCreated[key.value]?[{id:'task-dispatch:'+key.value+':'+(store.assignmentRecords[key.value]?.length||0),role:'assistant',kind:'scene',title:'收到轮机长派发的任务',markdown:`负责人：${assignment.owner}\n\n要求完成：${assignment.due?.replace('T',' ')}\n\n任务范围：${assignment.scope}`,at:[assignment.assignedBy,assignment.at].filter(Boolean).join(' · ')}]:[]
 return [...receipt,...rows.slice(Math.max(0,first-1)).filter(row=>!row.observationContext&&!row.title?.startsWith('效果观察')&&!row.text?.startsWith('本轮效果观察已自动结束')).map(row=>row.stageId&&row.kind==='scene'?{...row,expanded:row.stageId===store.currentStage?.id,historical:row.stageId!==store.currentStage?.id}:row.role==='user'&&row.actor&&row.actor!==viewer.value?{...row,role:'assistant',text:`${row.actor}已提交记录：${row.text}`} :row)]
})
const routineMessages=[{role:'user',text:'查看主机连杆轴承的常规维保计划及提前建议关系'},{role:'assistant',text:'原周期计划当前为1860／2000运行小时，尚余约140小时。提前建议是基于健康变化和窗口的独立评估，未采纳或评估后不提前都不取消原计划。实际执行是否覆盖原项目，以作业范围与现场记录核对，不自动重置全部周期。'}]
const automaticMessages=computed(()=>props.planOnly?routineMessages:props.issueId?issueConversationMessages(props.issueId,store):genericDevice.value?genericConversation.value:props.maintenanceDetail?maintenanceMessages.value:mode.value==='observation'?observationConversation.value:props.dossier?dossierMessages.value:mode.value==='ship'?shipConversation.value:mode.value==='attention'?attentionConversation.value:mode.value==='device'?deviceConversation.value:mode.value==='todo'?todoConversation.value:messages.value)
watch(automaticMessages, value=>{
  const primary=sessions.agent.value.conversations.find(item=>item.id===sessions.agent.value.primaryId)
  if(props.issueId)sessions.agent.value.conversations.forEach(conversation=>mergeIssueConversation(conversation.messages,value))
  else if(props.maintenanceDetail){
    if(value.some(message=>message.id&&!primary.messages.some(saved=>saved.id===message.id)))primary.messages.forEach(message=>{if(message.kind==='scene'){message.expanded=false;message.historical=true}})
    appendMessages(primary.messages,value)
  }
  else primary.messages=value
}, {immediate:true,deep:true})
const currentAdvice=computed(()=>{
 const context=props.issueId?issueContext(props.issueId,store):null
 const id=audience.value==='captain'&&trackingIssueId.value&&store.canDecideTracking(trackingIssueId.value)?trackingIssueId.value:workflowTaskId.value||props.issueId
 return id?workflowAdvice(store,id,{audience:audience.value,context,brief:eventBriefingFor(props.issueId||id)}):null
})
watch([currentAdvice,()=>sessions.active.value.messages,()=>sessions.active.value.id],([advice,messages])=>{
 if(!advice)return
 const conversation=sessions.active.value,hadHistory=Boolean(conversation.adviceHistory?.length)
 reconcileWorkflowAdvice(conversation,messages,advice,{animate:hadHistory})
},{immediate:true,deep:true,flush:'post'})
const displayedMessages=computed(()=>presentWorkflowConversation(sessions.active.value.messages.filter(message=>!(workflowTaskId.value&&message.purpose==='execution-record'&&message.status==='pending')),currentAdvice.value,sessions.active.value.adviceHistory||[]))
watch(()=>currentAdvice.value?.lifecycleKey,()=>{workflowExpanded.value=false})
async function landInConversation(){
 const generation=++entryGeneration
 entryLandingPending=true;followNewReply=false;workflowExpanded.value=false;hasNewReply.value=false
 await nextTick()
 if(typeof requestAnimationFrame!=='undefined')await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
 if(generation!==entryGeneration)return
 entryLandingPending=false
 const returnedFromAcceptance=audience.value==='captain'&&workflowTaskId.value&&store.isTaskHandled?.(workflowTaskId.value)&&store.executionRecords?.[workflowTaskId.value]?.length
 if(returnedFromAcceptance){await showLatestReply();return}
 const container=scrollRef.value,advice=container?.querySelector?.('.is-current-advice')
 if(container&&advice)container.scrollTo({top:Math.max(0,container.scrollTop+advice.getBoundingClientRect().top-container.getBoundingClientRect().top-12),behavior:'auto'})
 else if(container)container.scrollTo({top:0,behavior:'auto'})
}
watch(agentId,landInConversation,{immediate:true})
watch(()=>sessions.active.value.id,()=>{if(props.issueId)mergeIssueConversation(sessions.active.value.messages,automaticMessages.value);landInConversation()})
const lastAttentionSceneIndex=computed(()=>displayedMessages.value.findLastIndex(message=>message.kind==='scene'))
const contextLabel=computed(()=>props.issueId?(issueContext(props.issueId,store)?.issue.title):genericDevice.value?props.deviceName+' · 设备态势':mode.value==='observation'?'主机 · 处理后效果观察':mode.value==='todo'?store.currentStage?.label:mode.value==='attention'?(store.regularMaintenanceInFocus?'1#缸连杆轴承 · 常规维保计划':store.selectedAttention?.title):mode.value==='ship'?'远洋6号 · 态势监测':mode.value==='device'?'主机 · 设备态势':'传感器 · 数据观测')
const placeholder=computed(()=>props.issueId?'询问判断依据、缺失证据或下一步安排…':props.maintenanceDetail?'询问检查依据，或补充现场与安排信息…':props.dossier?'询问当前判断、变化证据或后续安排…':mode.value==='ship'?'询问船舶运行、设备变化或处理建议…':mode.value==='observation'?'补充新的现场现象或数据缺失情况…':mode.value==='todo'?'输入现场发现、检查或处理结果…':mode.value==='attention'?'补充现场情况，或回复是否建立待办…':'输入你想了解的设备情况…')
function send(){
  const text=draft.value.trim();if(!text)return
  followNewReply=true;hasNewReply.value=false
  if(props.planOnly){sessions.active.value.messages.push({role:'user',text},{role:'assistant',text:'常规计划按原项目和周期保留。提前评估、实际执行和周期完成是不同记录；可以查看本部件提前建议及人员决定，实际执行后再核对覆盖范围。'});sessions.touch();draft.value='';return}
  if(props.issueId){askIssue(text);draft.value='';return}
  if(workflowTaskId.value){askWorkflow(text);draft.value='';return}
  if(genericDevice.value){const rows=genericReplies[props.deviceId] ||= [];rows.push({role:'user',text},{role:'assistant',text:/依据|判断|原因/.test(text)?genericProfile.value.basis:/建议|检查|处理|怎么/.test(text)?genericProfile.value.next:genericProfile.value.conclusion+' '+genericProfile.value.next});draft.value='';return}
  if(props.maintenanceDetail){askMaintenance(text);draft.value='';return}
  const session=sessions.active.value,records=store.logs[key.value]||[],start=records.length
  if(props.dossier&&mode.value!=='observation'){
    const existing=[...displayedMessages.value].reverse().find(message=>message.noteCandidate && !message.noteCandidate.registered)
    if(existing && /^(请)?(把|将)(这|刚才|上一).*(记录|登记|记下)/.test(text)){
      registerMessageNote(existing);draft.value='';return
    }
    const dossier=attentionDossier(store,key.value)
    if(!store.sendR02Message(key.value,text))store.askDossierQuestion(key.value,text,'当前档案判断：'+dossier.conclusion+' 后续观察：'+dossier.tracking.focus+' 新增现场信息可登记到跟踪记录，供后续研判参考。')
  }else if(mode.value==='device' && (store.deviceDataTopic || /压力|泵组|机体|X向|Y向|振动/.test(text)) && !/维保|润滑|供油|滤器|1#|3#|4#/.test(text)){
    const topic=/压力|泵组/.test(text)?'stable':/机体|X向|Y向|振动/.test(text)?'vibration-trend':store.deviceDataTopic
    store.deviceDataTopic=topic;store.sendR02Message('device',text,topic)
  }else if(mode.value==='observation')store.sendObservation(text);else if(mode.value==='attention')store.sendAttention(text);else if(mode.value==='todo')store.sendTodo(text);else store.sendSituation(text,mode.value)
  const added=records.slice(start)
  added.forEach(message=>{message.conversationId=session.id})
  if(session.id!==sessions.agent.value.primaryId)session.messages.push(...added)
  else session.messages=automaticMessages.value
  sessions.touch(session);draft.value=''
}

function registerMessageNote(message){
  const candidate=message.noteCandidate
  if(!candidate || candidate.registered)return
  const session=sessions.active.value,records=store.logs[key.value]||[],start=records.length
  if(!store.registerDossierNote(key.value,candidate.text))return
  candidate.registered=true
  const added=records.slice(start)
  added.forEach(record=>{record.conversationId=session.id})
  if(session.id!==sessions.agent.value.primaryId)session.messages.push(...added)
  sessions.touch(session)
}
let monitorTimer=null
function clearMonitorTimer(){if(monitorTimer){clearTimeout(monitorTimer);monitorTimer=null}}
function askMaintenance(text){
 const id=sessions.active.value.id,at=new Date().toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})
 const userOrder=advice.nextOrder(),replyOrder=advice.nextOrder()
 const added=[{id:`maintenance-chat-${userOrder}`,order:userOrder,role:'user',text,at,conversationId:id},{id:`maintenance-chat-${replyOrder}`,order:replyOrder,...maintenanceReply(store,text,workOrders.state('maintenance')),at,conversationId:id}]
 advice.chatMessages.push(...added)
 if(id!==sessions.agent.value.primaryId)sessions.active.value.messages.push(...added)
 sessions.touch()
}
function askIssue(text){const session=sessions.active.value,afterEventRecordId=automaticMessages.value.findLast(message=>message.eventProcess)?.eventRecordId,at=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'});session.messages.push({id:session.id+':user:'+session.messages.length,role:'user',text,at,afterEventRecordId}, {...((workflowTaskId.value||trackingIssueId.value)?assistantWorkflowReply(store,trackingIssueId.value&&store.canDecideTracking(trackingIssueId.value)?trackingIssueId.value:workflowTaskId.value||trackingIssueId.value,text,{audience:audience.value}):issueReply(props.issueId,text,store)),id:session.id+':reply:'+session.messages.length,animate:true,at,afterEventRecordId});sessions.touch()}
function askWorkflow(text){
 const id=workflowTaskId.value;if(!id)return
 const session=sessions.active.value,at=new Date().toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})
 const rows=[{role:'user',text},{...assistantWorkflowReply(store,id,text,{audience:audience.value}),animate:true}].map((message,index)=>({...message,id:session.id+':workflow:'+Date.now()+':'+session.messages.length+':'+index,at,conversationId:session.id,audience:audience.value,actor:viewer.value}))
 ;(store.logs[id] ||= []).push(...rows)
 if(session.id!==sessions.agent.value.primaryId)session.messages.push(...rows)
 else session.messages=automaticMessages.value
 sessions.touch(session)
}
function runDemoAction(id){
  if(id==='workflow:focus'){focusWorkflow();return}
  return dispatchConversationAction(id,{
    issue:props.issueId ? askIssue : undefined,
    maintenance:props.maintenanceDetail ? askMaintenance : undefined,
    situation:!props.issueId && !props.maintenanceDetail ? text=>workflowTaskId.value?askWorkflow(text):store.sendSituation(text,mode.value) : undefined
  })
}
watch([mode,key],()=>{
  if(mode.value==='attention')store.selectAttention(key.value)
  else if(['device','sensor'].includes(mode.value))store.enterSituation(mode.value)
},{immediate:true})
watch([mode,key,()=>store.monitorStep.stable,()=>store.monitorStep.drift,()=>store.todoCreated.drift],()=>{clearMonitorTimer();if(mode.value!=='attention')return;const id=key.value;if(id==='drift'&&store.monitorStep.drift<1&&!store.todoCreated.drift)monitorTimer=setTimeout(()=>store.nextMonitor('drift'),4800)},{immediate:true})
watch(()=>displayedMessages.value.map(message=>message.id).join('|'),async(next,previous)=>{
 if(entryLandingPending)return
 if((mode.value==='ship'||props.maintenanceDetail)&&displayedMessages.value.length===1){pauseAutoScroll();await nextTick();scrollRef.value?.scrollTo({top:0,behavior:'auto'})}
 else if(previous&&next!==previous){if(followNewReply)showLatestReply();else hasNewReply.value=true}
})
watch(()=>store.currentStage?.id,async id=>{if(mode.value!=='todo'||!id||store.activeStage[key.value]>=store.progress[key.value])return;await nextTick();const container=scrollRef.value,element=container?.querySelector('[data-stage-id="'+id+'"]');if(element)container.scrollTo({top:element.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-12,behavior:'smooth'})})
watch(() => [store.progress.fault, store.progress.drift, store.progress.maintenance, store.monitorStep.stable, store.todoCreated.maintenance, store.todoCreated.drift], () => { if (mode.value === 'device') store.enterSituation('device') })
onUnmounted(clearMonitorTimer)
</script>
<style>
.p2-restored-assistant{width:350px;min-width:320px}.p2-restored-assistant .p2-messages{padding:16px 14px}.p2-restored-assistant .p2-message{margin-top:18px;gap:8px}.p2-restored-assistant .p2-message:first-child{margin-top:0}.p2-restored-assistant .p2-bubble{font-size:13px;line-height:1.7;min-width:0;flex:1;white-space:normal}.p2-restored-assistant .assistant .p2-bubble{background:transparent;padding:0;box-shadow:none}.p2-restored-assistant .user .p2-bubble{flex:initial;max-width:90%;background:#edf4ff;padding:9px 12px;border-radius:8px}.p2-bubble h3{font-size:14px;color:#24334a;margin:0 0 10px;font-weight:650}.p2-dialog-paragraph{margin:11px 0}.p2-dialog-paragraph b{font-size:12px;color:#52627b}.p2-dialog-paragraph p{margin-top:3px;color:#34465e}.p2-dialog-question{margin-top:13px;color:#34465e}.p2-feedback-record{border:1px solid #dce5f0;border-radius:8px;background:#fff;padding:12px}.p2-record-meta{font-size:11px;color:#7e8da1;padding-bottom:8px;border-bottom:1px solid #e7edf5}.p2-record-row{padding:9px 0;border-bottom:1px solid #edf1f6}.p2-record-row b{font-size:12px;color:#334b6e}.p2-record-row p{font-size:12px;margin-top:3px;color:#61718a}.p2-feedback-record .p2-secondary{margin-top:10px;font-size:12px;padding:7px 10px}.p2-restored-assistant .p2-compose textarea{font-size:13px;line-height:1.6}.p2-restored-assistant .p2-compose-foot button{font-size:12px;padding:7px 14px}
.p2-restored-assistant .p2-assistant-head{gap:9px}.p2-demo-label{display:inline-flex;align-items:center;margin-bottom:6px;border-radius:10px;background:#eff6ff;color:#3874bd;padding:2px 8px;font-size:10px;font-weight:600;line-height:1.5}.p2-restored-assistant .user .p2-demo-label{display:block;width:max-content;margin-left:auto}.p2-demo-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.p2-demo-actions button{border:1px solid #d8e5f4;border-radius:6px;background:#fff;color:#3475c7;padding:7px 9px;font-size:11px;cursor:pointer}.p2-demo-actions button:hover{background:#f1f6fc}.p2-demo-label.is-change{background:#fff3de;color:#a37125}.p2-restored-assistant .p2-message[data-demo="true"] + .p2-message{padding-top:14px;border-top:1px solid #e9eef4}
.assistant-workflow-shortcut{display:flex;justify-content:space-between;gap:12px;border:0;border-bottom:1px solid #e9eef4;background:#faf8f4;color:#8b7148;padding:10px 16px;text-align:left;font-size:12px;cursor:pointer}.assistant-workflow-shortcut:focus-visible{outline:2px solid #cbb58e;outline-offset:-2px}
.assistant-form-disclosure:empty{display:none}.assistant-form-collapse{display:block;margin:18px 0 0 auto;border:0;background:transparent;color:#8b7148;font-size:13px;padding:6px 0;cursor:pointer}.assistant-form-disclosure .assistant-workflow{margin-top:8px}.assistant-new-reply{align-self:center;flex:none;margin:5px auto;padding:6px 14px;border:1px solid #e0d5c4;border-radius:16px;background:#fffaf1;color:#8b7148;font-size:13px;cursor:pointer}.p2-restored-assistant .p2-messages{overflow-anchor:none;scroll-behavior:smooth}
.assistant-followups{margin-top:20px;padding-top:12px;border-top:1px solid #edf0f3;color:#66758a;font-size:13px;line-height:1.7}.assistant-followups p{margin:0 0 8px}.assistant-followups button{display:block;width:100%;margin-top:6px;padding:7px 10px;border:1px solid #e4e9ef;border-radius:5px;background:#fff;color:#627287;font-size:13px;text-align:left;cursor:pointer}
@media(max-width:1200px){.p2-restored-assistant{width:320px;min-width:300px}}
</style>

<style>.compose-file-input{display:none}.app-container.app-container .p2-restored-assistant .p2-compose-foot .compose-attachment{font-size:24px;width:30px;height:30px;min-height:30px;padding:0;display:grid;place-items:center;line-height:1;background:transparent;color:#7a8292;border:0;border-radius:5px;transform:none}.p2-restored-assistant .p2-compose{flex:none;position:relative}.p2-restored-assistant .p2-messages{min-height:0;scroll-padding-bottom:16px}</style>
