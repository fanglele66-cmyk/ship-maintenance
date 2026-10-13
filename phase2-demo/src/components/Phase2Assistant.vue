<template>
  <aside class="p2-assistant p2-restored-assistant">
    <div class="p2-assistant-head"><span class="p2-ai-mark">✦</span><div><strong>{{props.title}}</strong><small>{{ contextLabel }}</small></div><ConversationHistory :conversations="sessions.conversations.value" :current-id="sessions.active.value.id" @select="sessions.select" @new-conversation="sessions.newConversation" /></div>
    <div ref="scrollRef" class="p2-messages" aria-live="polite">
      <MessageRenderer v-for="(message,index) in displayedMessages" :key="message.id || index" :message="message" :expanded="index===(mode==='attention'?lastAttentionSceneIndex:displayedMessages.length-1)" :disabled-actions="maintenanceDisabledActions" @action="runDemoAction" @confirm-record="store.confirmQuickRecord(key)" @submit-inquiry="submitInquiry" @update-inquiry="updateInquiry">
        <template #actions>
          <div v-if="props.dossier && message.noteCandidate" class="p2-demo-actions"><button v-if="!message.noteCandidate.registered" type="button" @click="registerMessageNote(message)">将这条补充登记为留言</button><small v-else>这条补充已登记到跟踪记录</small></div>
          <div v-if="!props.maintenanceDetail && !props.dossier && mode==='attention' && index===lastAttentionSceneIndex" class="p2-demo-actions"><button v-if="!props.dossier && !store.regularMaintenanceInFocus && !store.attentionAction(key).required && ['maintenance','drift'].includes(key) && !store.todoCreated[key] && (key==='maintenance'||store.monitorStep.drift>=1)" type="button" @click="store.sendAttention('确认建立待办')">确认建立检查待办 →</button><button v-if="store.todoCreated[key]" type="button" @click="openLinkedTodo">查看关联待办 →</button></div>
          <div v-if="props.dossier && message.r02Check" class="p2-demo-actions r02-decision"><small v-if="store.dossierReviews[key]?.decision==='deferred'">已保留暂不安排的决定与原因</small><template v-else><button type="button" @click="confirmScriptCheck">{{store.todoCreated[key]?'进入关联检查事件':'确认开展检查'}}</button><button v-if="!store.todoCreated[key]" type="button" @click="requestDeferral">暂不安排，补充原因</button></template></div>
        </template>
      </MessageRenderer>
    </div>
    <form class="p2-compose" @submit.prevent="send"><div class="p2-compose-shell"><textarea v-model="draft" rows="2" :placeholder="placeholder" aria-label="对话输入" @keydown.enter.exact.prevent="send"></textarea><div class="p2-compose-foot"><span></span><button type="submit" aria-label="发送" title="发送" :disabled="!draft.trim()"><img :src="sendIcon" alt="" aria-hidden="true" /></button></div></div></form>
  </aside>
</template>
<script setup>
import { initialIssueMessages, issueReply, issueContext } from '@/message-flows/issueSources'
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import sendIcon from '@/assets/figma/send.svg'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { useRouter } from 'vue-router'
import { observationScene } from '@/mock/phase2Observation'
import { useAgentConversations, demoConversations } from '@/composables/useAgentConversations'
import MessageRenderer from './messages/MessageRenderer.vue'
import ConversationHistory from './messages/ConversationHistory.vue'
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
import maintenanceInquiry from '@/message-flows/maintenance-inquiry.json'
import { operationAssessment } from '@/mock/phase2SituationContent'
import deviceProfiles from '@/mock/deviceOverviewProfiles.json'
import { attentionInquiry } from '@/message-flows/attentionInquiry'
import { validateInquiry } from '@/message-flows/inquiryFields'
const props=defineProps({title:{type:String,default:'检修助手'},mode:{type:String,required:true},dossier:Boolean,maintenanceDetail:Boolean,deviceId:String,deviceName:String,issueId:String}),emit=defineEmits(['open-device','open-todo','open-item','issue-section']),store=usePhase2DemoStore(),scrollRef=ref(null)
const router = useRouter()
const mode=computed(()=>props.issueId?'issue':props.maintenanceDetail ? 'attention' : props.dossier ? (store.situationObservationId?'observation':'attention') : props.mode==='attention'&&store.situationObservationId?'observation':props.mode==='attention'&&!store.attentionInFocus?'device':props.mode)
const key=computed(()=>mode.value==='observation'?store.situationObservationId:mode.value==='attention'?store.selectedAttentionId:mode.value==='todo'?store.selectedTodoId:mode.value)
const advice=useMaintenanceAdviceStore(),workOrders=useEventWorkOrderStore()
const genericDevice=computed(()=>Boolean(props.deviceId && props.deviceId!=='main-engine-1' && !props.dossier && !props.maintenanceDetail))
const genericProfile=computed(()=>deviceProfiles[props.deviceId]||{conclusion:'当前没有已建立的异动跟踪，运行判断仅覆盖已采集指标。',basis:'缺少连续趋势和现场核验信息，不能确认未覆盖部位正常。',next:'先查看数据并按值班规程核对现场。'})
const genericReplies=reactive({})
const genericConversation=computed(()=>[{role:'user',text:`查看${props.deviceName}当前运行情况和建议`},{role:'assistant',kind:'scene',title:props.deviceName+'运行概况',paragraphs:[{label:'当前判断',text:genericProfile.value.conclusion},{label:'判断依据',text:genericProfile.value.basis},{label:'下一步',text:genericProfile.value.next}]},...(genericReplies[props.deviceId]||[])])
const agentId=computed(()=>props.issueId?'issue:'+props.issueId:genericDevice.value?'device:'+props.deviceId:props.maintenanceDetail?(store.regularMaintenanceInFocus?'maintenance-arrangements:1':'maintenance-advice:1'):mode.value==='device'?'device:main-engine-1':`${mode.value}:${key.value}`)
const sessions=useAgentConversations(agentId,id=>props.issueId?[]:demoConversations(id))
const draft=sessions.draft
const inquiryDrafts=reactive({}),inquiryErrors=reactive({})
const currentInquiry=computed(()=>props.dossier && mode.value==='attention' ? attentionInquiry(store,key.value,inquiryDrafts) : null)
function updateInquiry(payload){
  if(mode.value==='todo' && displayedMessages.value.some(message=>message.id===payload.messageId&&message.purpose==='execution-record')){store.updateExecutionRecord(key.value,payload.messageId,payload.values);return}
  if(props.maintenanceDetail){const message=advice.chatMessages.find(item=>item.id===payload.messageId && item.conversationId===sessions.active.value.id);if(message?.status==='pending')message.values={...payload.values};return}

  const other=displayedMessages.value.find(message=>message.id===payload.messageId && ['r02-note','r02-defer'].includes(message.purpose))
  if(other && other.status==='pending'){other.values={...payload.values};return}
  if(currentInquiry.value?.id!==payload.messageId || currentInquiry.value.status!=='pending')return
  inquiryDrafts[payload.messageId]={...payload.values}
  delete inquiryErrors[payload.messageId]
}
function submitInquiry(payload){
  if(mode.value==='todo' && displayedMessages.value.some(message=>message.id===payload.messageId&&message.purpose==='execution-record')){store.confirmExecutionRecord(key.value,payload.messageId,payload.values);sessions.touch();return}
  if(props.maintenanceDetail){
    const message=advice.chatMessages.find(item=>item.id===payload.messageId && item.conversationId===sessions.active.value.id)
    if(!message || message.status!=='pending' || Object.keys(validateInquiry(message,payload.values)).length)return
    const ok=message.purpose==='maintenance-defer'?advice.decide('defer',payload.values.information):advice.supplement(payload.values.information)
    if(!ok)return
    message.status='submitted';message.values={...payload.values};message.submittedAt=advice.records.at(-1).at;message.receiptText='已同步保存到建议的人员操作与记录中。'
    sessions.touch();return
  }

  const other=displayedMessages.value.find(message=>message.id===payload.messageId && ['r02-note','r02-defer'].includes(message.purpose))
  if(other){
    if(other.status!=='pending' || Object.keys(validateInquiry(other,payload.values)).length)return
    const session=sessions.active.value,records=store.logs[key.value]||[],start=records.length
    if(other.purpose==='r02-defer'){
      if(!store.deferR02Check(key.value,payload.values.reason))return
    }else if(!store.registerDossierNote(key.value,`发生时间：${payload.values.time}；工况与位置：${payload.values.context}；现象：${payload.values.phenomenon}`))return
    other.status='submitted';other.values={...payload.values};other.submittedAt=store.dossierNotes[key.value].at(-1).at
    other.receiptText=other.purpose==='r02-defer'?'已保留暂不安排的决定与原因，不代表设备正常或事项结束。':'作为新的人员补充留存，历史结束状态保持不变。'
    const added=records.slice(start);added.forEach(message=>{message.conversationId=session.id})
    if(session.id!==sessions.agent.value.primaryId)session.messages.push(...added)
    sessions.touch(session);return
  }
  const request=currentInquiry.value
  if(!request || request.id!==payload.messageId || request.status!=='pending')return
  if(Object.keys(validateInquiry(request,payload.values)).length)return
  const records=store.logs[key.value]||[],start=records.length
  if(!store.submitAttentionFeedback(key.value,payload.values)){
    inquiryErrors[request.id]='当前要求已变化，请查看最新安排后再提交。';return
  }
  records.slice(start).forEach(message=>{message.conversationId=sessions.agent.value.primaryId})
  delete inquiryDrafts[request.id]
  sessions.touch(sessions.active.value)
}
async function focusInquiry(){
  sessions.select(sessions.agent.value.primaryId)
  await nextTick()
  const element=scrollRef.value?.querySelector('.r02-decision') || scrollRef.value?.querySelector('.p2-inquiry')
  element?.scrollIntoView({block:'nearest',behavior:'smooth'})
  element?.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true})
}
defineExpose({focusInquiry})
const messages=computed(()=>(store.logs[key.value]||[]).filter(message=>!message.conversationId || message.conversationId===sessions.agent.value.primaryId))
const attentionConversation=computed(()=>{
  if (mode.value !== 'attention') return messages.value
  const id = key.value
  const report = id === 'maintenance' ? maintenanceFollowup(store, store.regularMaintenanceInFocus) : attentionFollowup(store, id)
  const topic = store.regularMaintenanceInFocus ? '周期计划 · 当前安排' : id === 'maintenance' ? '提前维保 · 当前建议' : '异动跟踪 · 当前建议'
  const accompanying = messages.value.filter(message => !['scene','feedbackRecord','recordDraft'].includes(message.kind) && !message.stageId && !(message.role === 'user' && /^(查看|进入)/.test(message.text || '')) && !message.observationContext)
  return [...followupConversation(report, topic),...accompanying]
})
function openLinkedTodo(){store.selectTodo(key.value);router.push({path:'/event',query:{todo:key.value}})}
const shipConversation = computed(() => [shipOverviewConversation(store), ...messages.value.filter(message => message.role === 'user' || message.shipFollowup)])
const deviceConversation = computed(() => [
 {role:'user',text:'查看主机当前运行情况和需要关注的事项'},
 {role:'assistant',kind:'scene',title:'主机运行研判',paragraphs:operationAssessment(store).summary.filter(item=>item.label!=='分析依据').map(item=>({label:item.label,text:item.text})),actions:[...(!store.todoCreated.drift&&!store.ignoredSuggestions.drift?[{id:'item:drift',label:'了解3号缸检查依据'}]:[]),{id:'item:maintenance',label:'了解轴承提前检查建议'}]},
 ...deviceConversationRecords(messages.value)
])
const observationConversation=computed(()=>{
  const id=key.value
  if(mode.value!=='observation')return[]
  const records=store.observationRecords[id],target=store.observationTargets[id]
  return [{role:'assistant',kind:'scene',title:'人工处理完成，转入态势跟踪',demoLabel:'来源事件 · '+store.caseMaterials[id]?.sourceId,at:'处理验收后',paragraphs:[{label:'已确认措施',text:store.cases[id].stages[store.observationIndex(id)-1].title},{label:'观察目标',text:'沿用来源事件的研判依据，比对处理前后同工况数据；持续稳定后自动结束本轮观察，反复时再请求现场核实。'}],actions:[{id:'todo:'+id,label:'回看人工处理记录'}]},...records.flatMap((record,index)=>[...(['abnormal','incomplete'].includes(record.status)?[{role:'user',text:record.note,at:record.label}]:[]),{role:'assistant',kind:'scene',demoLabel:record.day?'每日效果回顾 · 第'+record.day+'日':'处理后首测',at:record.label,...observationScene(id,records.slice(0,index+1),target)}]),...messages.value.filter(message=>message.observationContext&&(!message.text||!records.some(record=>record.note===message.text)))]
})
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
const todoConversation=computed(()=>{const rows=messages.value;const first=rows.findIndex(row=>row.stageId);return rows.slice(Math.max(0,first-1)).filter(row=>!row.observationContext&&!row.title?.startsWith('效果观察')&&!row.text?.startsWith('本轮效果观察已自动结束'))})
const automaticMessages=computed(()=>props.issueId?initialIssueMessages(props.issueId,store):genericDevice.value?genericConversation.value:props.maintenanceDetail?maintenanceMessages.value:props.dossier?dossierMessages.value:mode.value==='ship'?shipConversation.value:mode.value==='observation'?observationConversation.value:mode.value==='attention'?attentionConversation.value:mode.value==='device'?deviceConversation.value:mode.value==='todo'?todoConversation.value:messages.value)
watch(automaticMessages, value=>{
  const primary=sessions.agent.value.conversations.find(item=>item.id===sessions.agent.value.primaryId)
  if(props.issueId || props.maintenanceDetail)appendMessages(primary.messages,value)
  else primary.messages=value
}, {immediate:true,deep:true})
const maintenanceDisabledActions=computed(()=>props.maintenanceDetail?[
 ...(store.todoCreated.maintenance || store.isTaskHandled('maintenance')?['maintenance:check']:[]),
 ...(!advice.sufficient || advice.decision==='execute' || store.isTaskHandled('maintenance')?['maintenance:execute']:[]),
 ...(!advice.sufficient || advice.decision==='defer' || store.isTaskHandled('maintenance')?['maintenance:defer']:[])
]:[])
const displayedMessages=computed(()=>sessions.active.value.messages)
watch(()=>sessions.active.value.id,async()=>{if(props.issueId && !sessions.active.value.messages.length){appendMessages(sessions.active.value.messages,initialIssueMessages(props.issueId,store));sessions.touch()}await nextTick();scrollRef.value?.scrollTo({top:scrollRef.value.scrollHeight})})
const lastAttentionSceneIndex=computed(()=>displayedMessages.value.findLastIndex(message=>message.kind==='scene'))
const contextLabel=computed(()=>props.issueId?(issueContext(props.issueId,store)?.issue.device+' · '+issueContext(props.issueId,store)?.issue.title):genericDevice.value?props.deviceName+' · 设备态势':mode.value==='observation'?'主机 · 处理后效果观察':mode.value==='todo'?store.currentStage?.label:mode.value==='attention'?(store.regularMaintenanceInFocus?'1#缸连杆轴承 · 常规维保计划':store.selectedAttention?.title):mode.value==='ship'?'远洋6号 · 态势监测':mode.value==='device'?'主机 · 设备态势':'传感器 · 数据观测')
const placeholder=computed(()=>props.issueId?'询问判断依据、缺失证据或下一步安排…':props.maintenanceDetail?'询问检查依据，或补充现场与安排信息…':props.dossier?'询问当前判断、变化证据或后续安排…':mode.value==='ship'?'询问船舶运行、设备变化或处理建议…':mode.value==='observation'?'补充新的现场现象或数据缺失情况…':mode.value==='todo'?'输入现场发现、检查或处理结果…':mode.value==='attention'?'补充现场情况，或回复是否建立待办…':'输入你想了解的设备情况…')
function send(){
  const text=draft.value.trim();if(!text)return
  if(props.issueId){askIssue(text);draft.value='';return}
  if(genericDevice.value){const rows=genericReplies[props.deviceId] ||= [];rows.push({role:'user',text},{role:'assistant',text:/依据|判断|原因/.test(text)?genericProfile.value.basis:/建议|检查|处理|怎么/.test(text)?genericProfile.value.next:genericProfile.value.conclusion+' '+genericProfile.value.next});draft.value='';return}
  if(props.maintenanceDetail){askMaintenance(text);draft.value='';return}
  const session=sessions.active.value,records=store.logs[key.value]||[],start=records.length
  if(props.dossier){
    const existing=[...displayedMessages.value].reverse().find(message=>message.noteCandidate && !message.noteCandidate.registered)
    if(existing && /^(请)?(把|将)(这|刚才|上一).*(记录|登记|记下)/.test(text)){
      registerMessageNote(existing);draft.value='';return
    }
    const dossier=attentionDossier(store,key.value)
    if(!store.sendR02Message(key.value,text))store.askDossierQuestion(key.value,text,'当前档案判断：'+dossier.conclusion+' 后续观察：'+dossier.tracking.focus+' 新增现场信息可登记到跟踪记录，供后续研判参考。')
  }else if(mode.value==='device' && (store.deviceDataTopic || /压力|泵组|机体|X向|Y向|振动/.test(text)) && !/维保|1#|3#|4#/.test(text)){
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
function confirmScriptCheck(){
  if(store.todoCreated[key.value]){openLinkedTodo();return}
  store.confirmR02Check(key.value)
}
function requestDeferral(){
  const session=sessions.active.value,records=store.logs[key.value],id='r02-defer:'+key.value
  if(displayedMessages.value.some(item=>item.id===id))return
  const request={id,type:'inquiry',purpose:'r02-defer',role:'assistant',status:'pending',text:'请补充暂不安排检查的原因。原事实保留，不等于设备正常或问题结束。',fields:[{key:'reason',label:'暂不安排的原因',type:'textarea',required:true}],values:{},submitLabel:'确认暂不安排',conversationId:session.id}
  records.push(request)
  if(session.id!==sessions.agent.value.primaryId)session.messages.push(request)
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
function askIssue(text){const session=sessions.active.value;session.messages.push({id:session.id+':user:'+session.messages.length,role:'user',text}, {...issueReply(props.issueId,text,store),id:session.id+':reply:'+session.messages.length});sessions.touch()}
function runDemoAction(id){
 if(props.issueId){if(id==='issue:ask:evidence')askIssue('还需核实哪些信息？');else if(id==='issue:ask:next')askIssue('下一步如何安排？');else if(id.startsWith('issue:section:'))emit('issue-section',id.slice('issue:section:'.length));else if(id==='issue:task'&&store.todoCreated[props.issueId]){store.selectTodo(props.issueId);router.push({path:'/event',query:{todo:props.issueId}})}return}

 if(props.maintenanceDetail && id.startsWith('maintenance:')){
  if(id.startsWith('maintenance:ask:')){const topic=id.split(':').at(-1);askMaintenance({basis:'为什么建议提前检查？',evidence:'需要补齐哪些检查证据？',arrangement:'已有安排是否冲突？'}[topic]);return}
  if(id==='maintenance:event'){store.selectTodo('maintenance');router.push({path:'/event',query:{todo:'maintenance'}});return}
  if(id==='maintenance:observation'){router.push('/situation/attention/maintenance');return}
  if(id==='maintenance:advice'){router.push('/situation/maintenance/maintenance');return}
  sessions.select(sessions.agent.value.primaryId)
  if(id==='maintenance:check'){store.assignmentRequest='maintenance';return}
  if(id==='maintenance:execute'){advice.decide('execute');return}
  if(['maintenance:supplement','maintenance:defer'].includes(id)){
   const purpose=id==='maintenance:defer'?'maintenance-defer':'maintenance-supplement'
   const existing=advice.chatMessages.find(message=>message.purpose===purpose&&message.status==='pending'&&message.conversationId===sessions.active.value.id)
   if(!existing)advice.chatMessages.push({...maintenanceInquiry,order:advice.nextOrder(),id:`${purpose}-${advice.chatMessages.length}`,purpose,conversationId:sessions.active.value.id,values:{},...(purpose==='maintenance-defer'?{text:'暂不采纳，记录原因',hint:'必须填写原因。建议和原事件保留，不代表设备恢复正常。',submitLabel:'保存决定'}:{})})
   nextTick(()=>scrollRef.value?.scrollTo({top:scrollRef.value.scrollHeight,behavior:'smooth'}));return
  }
  return
 }

  if(id==='device')emit('open-device')
  else if(id==='todo')emit('open-todo')
  else if(id.startsWith('ask:'))store.sendSituation(id.slice(4),mode.value)
  else if(id.startsWith('item:'))emit('open-item',id.slice(5))
  else if(id.startsWith('todo:')){store.selectTodo(id.slice(5));router.push({path:'/event',query:{todo:id.slice(5)}})}
}
watch([mode,key],()=>{
  if(mode.value==='attention')store.selectAttention(key.value)
  else if(['device','sensor'].includes(mode.value))store.enterSituation(mode.value)
},{immediate:true})
watch([mode,key,()=>store.monitorStep.stable,()=>store.monitorStep.drift,()=>store.todoCreated.drift],()=>{clearMonitorTimer();if(mode.value!=='attention')return;const id=key.value;if(id==='drift'&&store.monitorStep.drift<1&&!store.todoCreated.drift)monitorTimer=setTimeout(()=>store.nextMonitor('drift'),4800)},{immediate:true})
watch(()=>[key.value,displayedMessages.value.length],async()=>{await nextTick();scrollRef.value?.scrollTo({top:props.issueId&&displayedMessages.value.length===2?0:(mode.value==='ship'||props.maintenanceDetail)&&displayedMessages.value.length===1?0:scrollRef.value.scrollHeight,behavior:'smooth'})},{immediate:true})
watch(()=>store.currentStage?.id,async id=>{if(mode.value!=='todo'||!id||store.activeStage[key.value]>=store.progress[key.value])return;await nextTick();const container=scrollRef.value,element=container?.querySelector('[data-stage-id="'+id+'"]');if(element)container.scrollTo({top:element.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-12,behavior:'smooth'})})
watch(() => [store.progress.fault, store.progress.drift, store.progress.maintenance, store.monitorStep.stable, store.todoCreated.maintenance, store.todoCreated.drift], () => { if (mode.value === 'device') store.enterSituation('device') })
onUnmounted(clearMonitorTimer)
</script>
<style>
.p2-restored-assistant{width:350px;min-width:320px}.p2-restored-assistant .p2-messages{padding:16px 14px}.p2-restored-assistant .p2-message{margin-top:18px;gap:8px}.p2-restored-assistant .p2-message:first-child{margin-top:0}.p2-restored-assistant .p2-bubble{font-size:13px;line-height:1.7;min-width:0;flex:1;white-space:normal}.p2-restored-assistant .assistant .p2-bubble{background:transparent;padding:0;box-shadow:none}.p2-restored-assistant .user .p2-bubble{flex:initial;max-width:90%;background:#edf4ff;padding:9px 12px;border-radius:8px}.p2-bubble h3{font-size:14px;color:#24334a;margin:0 0 10px;font-weight:650}.p2-dialog-paragraph{margin:11px 0}.p2-dialog-paragraph b{font-size:12px;color:#52627b}.p2-dialog-paragraph p{margin-top:3px;color:#34465e}.p2-dialog-question{margin-top:13px;color:#34465e}.p2-feedback-record{border:1px solid #dce5f0;border-radius:8px;background:#fff;padding:12px}.p2-record-meta{font-size:11px;color:#7e8da1;padding-bottom:8px;border-bottom:1px solid #e7edf5}.p2-record-row{padding:9px 0;border-bottom:1px solid #edf1f6}.p2-record-row b{font-size:12px;color:#334b6e}.p2-record-row p{font-size:12px;margin-top:3px;color:#61718a}.p2-feedback-record .p2-secondary{margin-top:10px;font-size:12px;padding:7px 10px}.p2-restored-assistant .p2-compose textarea{font-size:13px;line-height:1.6}.p2-restored-assistant .p2-compose-foot button{font-size:12px;padding:7px 14px}
.p2-restored-assistant .p2-assistant-head{gap:9px}.p2-demo-label{display:inline-flex;align-items:center;margin-bottom:6px;border-radius:10px;background:#eff6ff;color:#3874bd;padding:2px 8px;font-size:10px;font-weight:600;line-height:1.5}.p2-restored-assistant .user .p2-demo-label{display:block;width:max-content;margin-left:auto}.p2-demo-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.p2-demo-actions button{border:1px solid #d8e5f4;border-radius:6px;background:#fff;color:#3475c7;padding:7px 9px;font-size:11px;cursor:pointer}.p2-demo-actions button:hover{background:#f1f6fc}.p2-demo-label.is-change{background:#fff3de;color:#a37125}.p2-restored-assistant .p2-message[data-demo="true"] + .p2-message{padding-top:14px;border-top:1px solid #e9eef4}
@media(max-width:1200px){.p2-restored-assistant{width:320px;min-width:300px}}
</style>
