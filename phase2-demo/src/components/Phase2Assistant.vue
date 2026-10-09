<template>
  <aside class="p2-assistant p2-restored-assistant">
    <div class="p2-assistant-head"><span class="p2-ai-mark">✦</span><div><strong>检修助手</strong><small>{{ contextLabel }}</small></div></div>
    <div ref="scrollRef" class="p2-messages" aria-live="polite">
      <div v-for="(message,index) in displayedMessages" :key="index" class="p2-message" :class="message.role" :data-stage-id="message.stageId" :data-demo="Boolean(message.demoLabel)">
        <span v-if="message.role==='assistant'" class="p2-avatar">✦</span>
        <div class="p2-bubble">
          <span v-if="message.demoLabel" class="p2-demo-label" :class="{'is-change':message.demoLabel.includes('新证据') || message.demoLabel.includes('行动提醒')}">{{ message.demoLabel }}</span>
          <template v-if="message.kind==='scene'">
            <h3>{{ message.title }}</h3>
            <div v-for="(paragraph,i) in message.paragraphs" :key="i" class="p2-dialog-paragraph"><b>{{ paragraph.label }}</b><p>{{ paragraph.text }}</p></div>
            <p class="p2-dialog-question">{{ message.question }}</p>
            <div v-if="message.actions?.length" class="p2-demo-actions"><button v-for="action in message.actions" :key="action.id" type="button" @click="runDemoAction(action.id)">{{ action.label }} →</button></div>
          </template>
          <section v-else-if="['feedbackRecord','recordDraft'].includes(message.kind)" class="p2-feedback-record">
            <h3>{{ message.title }}</h3><p class="p2-record-meta">任务：{{ message.task }}<br>反馈时间：{{ message.at }}</p>
            <div v-for="(record,i) in message.records" :key="i" class="p2-record-row"><b>{{ record.label }}</b><p>反馈：{{ record.result }}</p><p v-if="record.note">备注：{{ record.note }}</p><p v-if="record.attachments?.length">附件：{{ record.attachments.join('、') }}</p></div>
            <template v-if="message.kind==='recordDraft'"><p class="p2-dialog-question">{{ message.cancelled?'此份记录已取消或由后续补充更新。':message.confirmed?'以上反馈已确认记录。':message.canAdvance?(message.destination==='observe'?'以上是我整理的措施与验收结果，是否确认记录并完成本轮人工处理？':'以上是我整理的现场反馈，是否确认记录并继续下一阶段？如有遗漏，可以直接补充。'):'以上是我整理的现场反馈，是否确认保存？仍需补齐本轮检查或验收结果后再推进。' }}</p><button v-if="!message.confirmed&&!message.cancelled" class="p2-secondary" @click="store.confirmQuickRecord(key)">确认以上记录</button></template>
          </section>
          <p v-else>{{ message.text }}</p>
          <div v-if="mode==='attention' && index===lastAttentionSceneIndex" class="p2-demo-actions"><button v-if="!store.regularMaintenanceInFocus && ['maintenance','drift'].includes(key) && !store.todoCreated[key] && (key==='maintenance'||store.monitorStep.drift>=1)" type="button" @click="store.sendAttention('确认建立待办')">确认建立检查待办 →</button><button v-if="store.todoCreated[key]" type="button" @click="openLinkedTodo">查看关联待办 →</button></div>
          <small>{{ message.at }}</small>
        </div>
      </div>
    </div>
    <form class="p2-compose" @submit.prevent="send"><textarea v-model="draft" rows="2" :placeholder="placeholder" @keydown.enter.exact.prevent="send"></textarea><div class="p2-compose-foot"><span></span><button type="submit" :disabled="!draft.trim()">发送 ↗</button></div></form>
  </aside>
</template>
<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { useRouter } from 'vue-router'
import { observationScene } from '@/mock/phase2Observation'
import { operationAssessment } from '@/mock/phase2SituationContent'
import { attentionFollowup, maintenanceFollowup, followupConversation } from '@/mock/phase2Followup'
import { shipOverviewConversation } from '@/mock/phase2ShipConversation'
const props=defineProps({mode:{type:String,required:true}}),emit=defineEmits(['open-device','open-todo','open-item']),store=usePhase2DemoStore(),draft=ref(''),scrollRef=ref(null)
const router = useRouter()
const mode=computed(()=>props.mode==='attention'&&store.situationObservationId?'observation':props.mode==='attention'&&!store.attentionInFocus?'device':props.mode)
const key=computed(()=>mode.value==='observation'?store.situationObservationId:mode.value==='attention'?store.selectedAttentionId:mode.value==='todo'?store.selectedTodoId:mode.value)
const messages=computed(()=>store.logs[key.value]||[])
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
const deviceConversation = computed(() => {
  const review = operationAssessment(store)
  const recorded = messages.value.filter(message => !(message.role === 'assistant' && message.title === '主机每日健康回顾') && !(message.role === 'user' && message.text?.startsWith('查看')))
  const drift = store.cases.drift.stages[store.progress.drift]
  return [
    {role:'assistant',kind:'scene',demoLabel:'每日健康回顾',title:'主机每日健康回顾',at:'10月08日 · 08:00',paragraphs:[{label:'当前结论',text:review.conclusion},{label:'下一步建议',text:review.recommendation},{label:'关联证据',text:review.basis}],question:'需要查看哪项研判依据？可进入对应事项，继续查看监测材料或处理进展。'},
    {role:'assistant',kind:'scene',demoLabel:store.monitorStep.drift||store.todoCreated.drift?'行动提醒 · 状态变化':'持续关注',title:store.isTaskHandled('drift') ? store.getObservationResult('drift').title : store.todoCreated.drift ? '3#缸检查与处置正在接续' : store.monitorStep.drift ? '3#缸出现新证据，需要现场核对' : '3#缸排温偏差持续关注',at:'10月08日 · 08:10',paragraphs:store.isTaskHandled('drift')?[{label:'效果判断',text:store.getObservationResult('drift').text},{label:'验证口径',text:'继续对照原排温差与异响，依据连续记录决定收束、补证或复查。'}]:store.todoCreated.drift?[{label:'处理进展',text:drift.summary},{label:'当前任务',text:store.progress.drift<2?'人员已同意建立检查待办，仍需核对读数和异响，才能判断异常是否成立。':'事件已经确立，后续排查验证原因；原监测证据和人员反馈继续保留。'}]:[{label:store.monitorStep.drift?'证据变化':'监测证据',text:store.monitorStep.drift?'同工况排温相对差8→10°C，当前432°C，并出现轻微波动。数据尚不能单独确认异动真实。':'同工况排温428°C，比其余缸高约8°C，尚无现场异响或振动佐证。'},{label:'当前建议',text:store.monitorStep.drift?'核对现场仪表、异响与振动能否复现，先判断是否需要建立检查待办。':'继续比较相近转速与负荷样本；出现偏差扩大等新证据后再请求现场确认。'}],actions:[{id:'item:drift',label:store.isTaskHandled('drift')?'查看3#缸效果观察':'查看3#缸关注材料'},...(store.todoCreated.drift?[{id:'todo:drift',label:'查看关联待办'}]:[])]},
    {role:'assistant',kind:'scene',demoLabel:'计划与执行关联',title:'轴承建议与冷却系统待办',at:'10月08日 · 08:10',paragraphs:[{label:'轴承维保',text:store.todoCreated.maintenance?`提前维保已关联待办，${store.isTaskHandled('maintenance')?'人工处理已完成，持续效果在设备态势验证':'当前处于'+store.cases.maintenance.stages[store.progress.maintenance].label}；实际作业由现场反馈记录，效果由观察数据验证。`:'轴承近7日振动持续上行，距周期检修约140 h。提前建议与常规计划针对同一部件，先检查后决定是否提前保养。'},{label:'冷却系统',text:store.cases.fault.stages[store.progress.fault].summary}],actions:[{id:'item:maintenance',label:'查看轴承维保建议'},{id:store.isTaskHandled('fault')?'item:fault':'todo:fault',label:store.isTaskHandled('fault')?'查看冷却系统效果观察':'查看冷却系统待办'}]},
    ...recorded
  ]
})
const observationConversation=computed(()=>{
  const id=key.value
  if(mode.value!=='observation')return[]
  const records=store.observationRecords[id],target=store.observationTargets[id]
  return [{role:'assistant',kind:'scene',title:'人工处理完成，转入态势跟踪',demoLabel:'来源事件 · '+store.caseMaterials[id]?.sourceId,at:'处理验收后',paragraphs:[{label:'已确认措施',text:store.cases[id].stages[store.observationIndex(id)-1].title},{label:'观察目标',text:'沿用来源事件的研判依据，比对处理前后同工况数据；持续稳定后自动结束本轮观察，反复时再请求现场核实。'}],actions:[{id:'todo:'+id,label:'回看人工处理记录'}]},...records.flatMap((record,index)=>[...(['abnormal','incomplete'].includes(record.status)?[{role:'user',text:record.note,at:record.label}]:[]),{role:'assistant',kind:'scene',demoLabel:record.day?'每日效果回顾 · 第'+record.day+'日':'处理后首测',at:record.label,...observationScene(id,records.slice(0,index+1),target)}]),...messages.value.filter(message=>message.observationContext&&(!message.text||!records.some(record=>record.note===message.text)))]
})
const displayedMessages=computed(()=>mode.value==='ship'?shipConversation.value:mode.value==='observation'?observationConversation.value:mode.value==='attention'?attentionConversation.value:mode.value==='device'?deviceConversation.value:mode.value==='todo'?messages.value.filter(message=>!message.observationContext&&!message.title?.startsWith('效果观察')&&!message.text?.startsWith('本轮效果观察已自动结束')):messages.value)
const lastAttentionSceneIndex=computed(()=>displayedMessages.value.findLastIndex(message=>message.kind==='scene'))
const contextLabel=computed(()=>mode.value==='observation'?'主机 · 处理后效果观察':mode.value==='todo'?store.currentStage?.label:mode.value==='attention'?(store.regularMaintenanceInFocus?'1#缸连杆轴承 · 常规维保计划':store.selectedAttention?.title):mode.value==='ship'?'远洋6号 · 态势监测':mode.value==='device'?'主机 · 设备态势':'传感器 · 数据观测')
const placeholder=computed(()=>mode.value==='ship'?'询问船舶运行、设备变化或处理建议…':mode.value==='observation'?'补充新的现场现象或数据缺失情况…':mode.value==='todo'?'输入现场发现、检查或处理结果…':mode.value==='attention'?'补充现场情况，或回复是否建立待办…':'输入你想了解的设备情况…')
function send(){const text=draft.value.trim();if(!text)return;if(mode.value==='observation')store.sendObservation(text);else if(mode.value==='attention')store.sendAttention(text);else if(mode.value==='todo')store.sendTodo(text);else store.sendSituation(text,mode.value);draft.value=''}
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
  draft.value=''
  if(mode.value==='attention')store.selectAttention(key.value)
  else if(['device','sensor'].includes(mode.value))store.enterSituation(mode.value)
},{immediate:true})
watch([mode,key,()=>store.monitorStep.stable,()=>store.monitorStep.drift,()=>store.todoCreated.drift],()=>{clearMonitorTimer();if(mode.value!=='attention')return;const id=key.value;if(id==='stable'&&store.monitorStep.stable<2)monitorTimer=setTimeout(()=>store.nextMonitor('stable'),4800);if(id==='drift'&&store.monitorStep.drift<1&&!store.todoCreated.drift)monitorTimer=setTimeout(()=>store.nextMonitor('drift'),4800)},{immediate:true})
watch(()=>[key.value,displayedMessages.value.length],async()=>{await nextTick();scrollRef.value?.scrollTo({top:mode.value==='ship'&&displayedMessages.value.length===1?0:scrollRef.value.scrollHeight,behavior:'smooth'})},{immediate:true})
watch(()=>store.currentStage?.id,async id=>{if(mode.value!=='todo'||!id||store.activeStage[key.value]>=store.progress[key.value])return;await nextTick();const container=scrollRef.value,element=container?.querySelector('[data-stage-id="'+id+'"]');if(element)container.scrollTo({top:element.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-12,behavior:'smooth'})})
watch(() => [store.progress.fault, store.progress.drift, store.progress.maintenance, store.monitorStep.stable, store.todoCreated.maintenance, store.todoCreated.drift], () => { if (mode.value === 'device') store.enterSituation('device') })
onUnmounted(clearMonitorTimer)
</script>
<style scoped>
.p2-restored-assistant{width:350px;min-width:320px}.p2-restored-assistant .p2-messages{padding:16px 14px}.p2-restored-assistant .p2-message{margin-top:18px;gap:8px}.p2-restored-assistant .p2-message:first-child{margin-top:0}.p2-restored-assistant .p2-bubble{font-size:13px;line-height:1.7;min-width:0;flex:1;white-space:normal}.p2-restored-assistant .assistant .p2-bubble{background:transparent;padding:0;box-shadow:none}.p2-restored-assistant .user .p2-bubble{flex:initial;max-width:90%;background:#edf4ff;padding:9px 12px;border-radius:8px}.p2-bubble h3{font-size:14px;color:#24334a;margin:0 0 10px;font-weight:650}.p2-dialog-paragraph{margin:11px 0}.p2-dialog-paragraph b{font-size:12px;color:#52627b}.p2-dialog-paragraph p{margin-top:3px;color:#34465e}.p2-dialog-question{margin-top:13px;color:#34465e}.p2-feedback-record{border:1px solid #dce5f0;border-radius:8px;background:#fff;padding:12px}.p2-record-meta{font-size:11px;color:#7e8da1;padding-bottom:8px;border-bottom:1px solid #e7edf5}.p2-record-row{padding:9px 0;border-bottom:1px solid #edf1f6}.p2-record-row b{font-size:12px;color:#334b6e}.p2-record-row p{font-size:12px;margin-top:3px;color:#61718a}.p2-feedback-record .p2-secondary{margin-top:10px;font-size:12px;padding:7px 10px}.p2-restored-assistant .p2-compose textarea{font-size:13px;line-height:1.6}.p2-restored-assistant .p2-compose-foot button{font-size:12px;padding:7px 14px}
.p2-restored-assistant .p2-assistant-head{gap:9px}.p2-demo-label{display:inline-flex;align-items:center;margin-bottom:6px;border-radius:10px;background:#eff6ff;color:#3874bd;padding:2px 8px;font-size:10px;font-weight:600;line-height:1.5}.p2-restored-assistant .user .p2-demo-label{display:block;width:max-content;margin-left:auto}.p2-demo-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.p2-demo-actions button{border:1px solid #d8e5f4;border-radius:6px;background:#fff;color:#3475c7;padding:7px 9px;font-size:11px;cursor:pointer}.p2-demo-actions button:hover{background:#f1f6fc}.p2-demo-label.is-change{background:#fff3de;color:#a37125}.p2-restored-assistant .p2-message[data-demo="true"] + .p2-message{padding-top:14px;border-top:1px solid #e9eef4}
@media(max-width:1200px){.p2-restored-assistant{width:320px;min-width:300px}}
</style>

