<template>
  <aside class="p2-assistant p2-restored-assistant">
    <div class="p2-assistant-head"><span class="p2-ai-mark">✦</span><div><strong>检修助手</strong><small>{{ contextLabel }}</small></div><ConversationHistory :conversations="sessions.conversations.value" :current-id="sessions.active.value.id" @select="sessions.select" @new-conversation="sessions.newConversation" /></div>
    <div ref="scrollRef" class="p2-messages" aria-live="polite">
      <MessageRenderer v-for="(message,index) in displayedMessages" :key="message.id || index" :message="message" :expanded="index===(mode==='attention'?lastAttentionSceneIndex:displayedMessages.length-1)" @action="runDemoAction" @confirm-record="store.confirmQuickRecord(key)" @submit-inquiry="submitInquiry" @update-inquiry="updateInquiry">
        <template #actions>
          <div v-if="mode==='attention' && index===lastAttentionSceneIndex" class="p2-demo-actions"><button v-if="!store.regularMaintenanceInFocus && !store.attentionAction(key).required && ['maintenance','drift'].includes(key) && !store.todoCreated[key] && (key==='maintenance'||store.monitorStep.drift>=1)" type="button" @click="store.sendAttention('确认建立待办')">确认建立检查待办 →</button><button v-if="store.todoCreated[key]" type="button" @click="openLinkedTodo">查看关联待办 →</button></div>
        </template>
      </MessageRenderer>
    </div>
    <form class="p2-compose" @submit.prevent="send"><div class="p2-compose-shell"><textarea v-model="draft" rows="2" :placeholder="placeholder" aria-label="对话输入" @keydown.enter.exact.prevent="send"></textarea><div class="p2-compose-foot"><span></span><button type="submit" aria-label="发送" title="发送" :disabled="!draft.trim()"><img :src="sendIcon" alt="" aria-hidden="true" /></button></div></div></form>
  </aside>
</template>
<script setup>
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
import { attentionInquiry } from '@/message-flows/attentionInquiry'
import { validateInquiry } from '@/message-flows/inquiryFields'
const props=defineProps({mode:{type:String,required:true},dossier:Boolean}),emit=defineEmits(['open-device','open-todo','open-item']),store=usePhase2DemoStore(),scrollRef=ref(null)
const router = useRouter()
const mode=computed(()=>props.dossier ? (store.situationObservationId?'observation':'attention') : props.mode==='attention'&&store.situationObservationId?'observation':props.mode==='attention'&&!store.attentionInFocus?'device':props.mode)
const key=computed(()=>mode.value==='observation'?store.situationObservationId:mode.value==='attention'?store.selectedAttentionId:mode.value==='todo'?store.selectedTodoId:mode.value)
const agentId=computed(()=>mode.value==='device'?'device:main-engine-1':`${mode.value}:${key.value}`)
const sessions=useAgentConversations(agentId,demoConversations)
const draft=sessions.draft
const inquiryDrafts=reactive({}),inquiryErrors=reactive({})
const currentInquiry=computed(()=>props.dossier && mode.value==='attention' ? attentionInquiry(store,key.value,inquiryDrafts) : null)
function updateInquiry(payload){
  if(currentInquiry.value?.id!==payload.messageId || currentInquiry.value.status!=='pending')return
  inquiryDrafts[payload.messageId]={...payload.values}
  delete inquiryErrors[payload.messageId]
}
function submitInquiry(payload){
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
  const element=scrollRef.value?.querySelector('.p2-inquiry')
  element?.scrollIntoView({block:'nearest',behavior:'smooth'})
  element?.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')?.focus({preventScroll:true})
}
defineExpose({focusInquiry})
const messages=computed(()=>(store.logs[key.value]||[]).filter(message=>!message.conversationId || message.conversationId===sessions.agent.value.primaryId))
const attentionConversation=computed(()=>{
  if (mode.value !== 'attention') return messages.value
  const id = key.value
  const report = id === 'maintenance' ? maintenanceFollowup(store, store.regularMaintenanceInFocus) : attentionFollowup(store, id)
  const topic = store.regularMaintenanceInFocus ? '周期计划 · 当前安排' : id === 'maintenance' ? '提前维保 · 当前建议' : '关注事项 · 当前建议'
  const accompanying = messages.value.filter(message => !['scene','feedbackRecord','recordDraft'].includes(message.kind) && !message.stageId && !(message.role === 'user' && /^(查看|进入)/.test(message.text || '')) && !message.observationContext)
  return [...followupConversation(report, topic),...accompanying]
})
function openLinkedTodo(){store.selectTodo(key.value);router.push('/event')}
const shipConversation = computed(() => [shipOverviewConversation(store), ...messages.value.filter(message => message.role === 'user' || message.shipFollowup)])
const deviceConversation = computed(() => [
  ...resolveMessageFlow(deviceFlow, deviceMessageSources(store)),
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
  const replies=messages.value.filter((message,i)=>(message.text && !(message.role==='user' && /^(查看|进入)/.test(message.text))) || (message.kind==='scene' && messages.value[i-1]?.role==='user' && !/^(查看|进入)/.test(messages.value[i-1]?.text||''))).map(message=>message.kind==='scene'?{...message,title:'当前依据与安排',paragraphs:[{label:'当前判断',text:dossier.conclusion},{label:'比较参考',text:dossier.charts.map(chart=>chart.reference).join('；')},{label:'当前安排',text:dossier.action.text}],question:'以上为原型基于现有档案的演示回复，不代表新一次检测或新的异常事实。'}:message)
  return [{role:'assistant',kind:'scene',title:'当前关注档案',paragraphs:[{label:'本次重点',text:dossier.action.text}],question:'变化依据、比较口径或现场反馈有什么需要进一步解释的？详细证据和历史过程可在左侧切换查看。'},...(currentInquiry.value?[{...currentInquiry.value,submitError:inquiryErrors[currentInquiry.value.id]}]:[]),...replies ]
})
const automaticMessages=computed(()=>props.dossier?dossierMessages.value:mode.value==='ship'?shipConversation.value:mode.value==='observation'?observationConversation.value:mode.value==='attention'?attentionConversation.value:mode.value==='device'?deviceConversation.value:mode.value==='todo'?messages.value.filter(message=>!message.observationContext&&!message.title?.startsWith('效果观察')&&!message.text?.startsWith('本轮效果观察已自动结束')):messages.value)
watch(automaticMessages, value=>{
  const primary=sessions.agent.value.conversations.find(item=>item.id===sessions.agent.value.primaryId)
  primary.messages=value
}, {immediate:true,deep:true})
const displayedMessages=computed(()=>sessions.active.value.messages)
watch(()=>sessions.active.value.id,async()=>{await nextTick();scrollRef.value?.scrollTo({top:scrollRef.value.scrollHeight})})
const lastAttentionSceneIndex=computed(()=>displayedMessages.value.findLastIndex(message=>message.kind==='scene'))
const contextLabel=computed(()=>mode.value==='observation'?'主机 · 处理后效果观察':mode.value==='todo'?store.currentStage?.label:mode.value==='attention'?(store.regularMaintenanceInFocus?'1#缸连杆轴承 · 常规维保计划':store.selectedAttention?.title):mode.value==='ship'?'远洋6号 · 态势监测':mode.value==='device'?'主机 · 设备态势':'传感器 · 数据观测')
const placeholder=computed(()=>mode.value==='ship'?'询问船舶运行、设备变化或处理建议…':mode.value==='observation'?'补充新的现场现象或数据缺失情况…':mode.value==='todo'?'输入现场发现、检查或处理结果…':mode.value==='attention'?'补充现场情况，或回复是否建立待办…':'输入你想了解的设备情况…')
function send(){
  const text=draft.value.trim();if(!text)return
  const session=sessions.active.value,records=store.logs[key.value]||[],start=records.length
  if(mode.value==='observation')store.sendObservation(text);else if(mode.value==='attention')store.sendAttention(text);else if(mode.value==='todo')store.sendTodo(text);else store.sendSituation(text,mode.value)
  const added=records.slice(start)
  added.forEach(message=>{message.conversationId=session.id})
  if(session.id!==sessions.agent.value.primaryId)session.messages.push(...added)
  else session.messages=automaticMessages.value
  sessions.touch(session);draft.value=''
}

let monitorTimer=null
function clearMonitorTimer(){if(monitorTimer){clearTimeout(monitorTimer);monitorTimer=null}}
function runDemoAction(id){
  if(id==='device')emit('open-device')
  else if(id==='todo')emit('open-todo')
  else if(id.startsWith('ask:'))store.sendSituation(id.slice(4),mode.value)
  else if(id.startsWith('item:'))emit('open-item',id.slice(5))
  else if(id.startsWith('todo:')){store.selectTodo(id.slice(5));router.push('/event')}
}
watch([mode,key],()=>{
  if(mode.value==='attention')store.selectAttention(key.value)
  else if(['device','sensor'].includes(mode.value))store.enterSituation(mode.value)
},{immediate:true})
watch([mode,key,()=>store.monitorStep.stable,()=>store.monitorStep.drift,()=>store.todoCreated.drift],()=>{clearMonitorTimer();if(mode.value!=='attention')return;const id=key.value;if(id==='stable'&&store.monitorStep.stable<2)monitorTimer=setTimeout(()=>store.nextMonitor('stable'),4800);if(id==='drift'&&store.monitorStep.drift<1&&!store.todoCreated.drift)monitorTimer=setTimeout(()=>store.nextMonitor('drift'),4800)},{immediate:true})
watch(()=>[key.value,displayedMessages.value.length],async()=>{await nextTick();scrollRef.value?.scrollTo({top:mode.value==='ship'&&displayedMessages.value.length===1?0:scrollRef.value.scrollHeight,behavior:'smooth'})},{immediate:true})
watch(()=>store.currentStage?.id,async id=>{if(mode.value!=='todo'||!id||store.activeStage[key.value]>=store.progress[key.value])return;await nextTick();const container=scrollRef.value,element=container?.querySelector('[data-stage-id="'+id+'"]');if(element)container.scrollTo({top:element.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-12,behavior:'smooth'})})
watch(() => [store.progress.fault, store.progress.drift, store.progress.maintenance, store.monitorStep.stable, store.todoCreated.maintenance, store.todoCreated.drift], () => { if (mode.value === 'device') store.enterSituation('device') })
onUnmounted(clearMonitorTimer)
</script>
<style>
.p2-restored-assistant{width:350px;min-width:320px}.p2-restored-assistant .p2-messages{padding:16px 14px}.p2-restored-assistant .p2-message{margin-top:18px;gap:8px}.p2-restored-assistant .p2-message:first-child{margin-top:0}.p2-restored-assistant .p2-bubble{font-size:13px;line-height:1.7;min-width:0;flex:1;white-space:normal}.p2-restored-assistant .assistant .p2-bubble{background:transparent;padding:0;box-shadow:none}.p2-restored-assistant .user .p2-bubble{flex:initial;max-width:90%;background:#edf4ff;padding:9px 12px;border-radius:8px}.p2-bubble h3{font-size:14px;color:#24334a;margin:0 0 10px;font-weight:650}.p2-dialog-paragraph{margin:11px 0}.p2-dialog-paragraph b{font-size:12px;color:#52627b}.p2-dialog-paragraph p{margin-top:3px;color:#34465e}.p2-dialog-question{margin-top:13px;color:#34465e}.p2-feedback-record{border:1px solid #dce5f0;border-radius:8px;background:#fff;padding:12px}.p2-record-meta{font-size:11px;color:#7e8da1;padding-bottom:8px;border-bottom:1px solid #e7edf5}.p2-record-row{padding:9px 0;border-bottom:1px solid #edf1f6}.p2-record-row b{font-size:12px;color:#334b6e}.p2-record-row p{font-size:12px;margin-top:3px;color:#61718a}.p2-feedback-record .p2-secondary{margin-top:10px;font-size:12px;padding:7px 10px}.p2-restored-assistant .p2-compose textarea{font-size:13px;line-height:1.6}.p2-restored-assistant .p2-compose-foot button{font-size:12px;padding:7px 14px}
.p2-restored-assistant .p2-assistant-head{gap:9px}.p2-demo-label{display:inline-flex;align-items:center;margin-bottom:6px;border-radius:10px;background:#eff6ff;color:#3874bd;padding:2px 8px;font-size:10px;font-weight:600;line-height:1.5}.p2-restored-assistant .user .p2-demo-label{display:block;width:max-content;margin-left:auto}.p2-demo-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.p2-demo-actions button{border:1px solid #d8e5f4;border-radius:6px;background:#fff;color:#3475c7;padding:7px 9px;font-size:11px;cursor:pointer}.p2-demo-actions button:hover{background:#f1f6fc}.p2-demo-label.is-change{background:#fff3de;color:#a37125}.p2-restored-assistant .p2-message[data-demo="true"] + .p2-message{padding-top:14px;border-top:1px solid #e9eef4}
@media(max-width:1200px){.p2-restored-assistant{width:320px;min-width:300px}}
</style>
