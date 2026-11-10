<template>
 <aside class="lc-assistant home-situation-assistant" aria-label="态势助手" @keydown.esc="$emit('close')">
  <header><strong>{{title}}</strong><button v-if="collapsible" class="assistant-collapse" type="button" aria-label="收起态势助手" @click="$emit('close')">收起 →</button></header>
  <div ref="stream" class="lc-conversation situation-conversation">
   <article class="lc-message situation-overview"><strong class="situation-overview-label"><span aria-hidden="true">✦</span> 工况概览</strong><p>当前{{chronology.periods.at(-1)?.status||'数据未就绪'}}，航速 {{readings.speed}} kn，主机转速 {{readings.rpm}} rpm，负荷 {{readings.load}}%。</p><time v-if="readings.sampledAt" :datetime="readings.sampledAt">{{timeText(readings.sampledAt)}}</time></article>
   <article v-if="health" class="lc-message situation-overview"><strong>设备健康研判</strong><p>{{health.conclusion}}</p><time>{{health.completedAt}}</time></article>
   <article v-for="(message,i) in messages" :key="i" :class="['lc-message',message.role]"><MarkdownContent v-if="message.text" :content="message.text"/><time v-if="message.text" :datetime="message.at">{{timeText(message.at)}}</time></article>
   <p v-if="pending" role="status" class="situation-status">正在分析工况资料…</p>
   <p v-if="error" role="alert" class="situation-error">{{error}}</p>
   <div v-if="!messages.length" class="lc-followups situation-questions" aria-label="工况追问"><button v-for="question in questions" :key="question" type="button" :disabled="pending" @click="ask(question)"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 4h12v9H9l-4 3v-3H4z"/><path d="M7 7h6M7 10h4"/></svg><span>{{question}}</span><span class="lc-followup-arrow" aria-hidden="true">↗</span></button></div>
  </div>
  <form class="lc-composer" @submit.prevent="ask(input)"><textarea ref="inputEl" v-model="input" aria-label="询问态势助手" placeholder="询问航行工况、主机参数或运行变化…" @keydown.enter.exact="submitOnEnter"/><footer><button type="button" aria-label="添加文件" :disabled="pending" @click="upload.click()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><small v-if="fileNotice" role="status">{{fileNotice}}</small><button type="submit" aria-label="发送态势问题" :disabled="pending||!input.trim()" :aria-busy="pending"><svg v-if="!pending" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></footer><input ref="upload" type="file" hidden accept=".txt,.md,.csv,.json" @change="attach"/></form>
 </aside>
</template>
<script setup>
import {ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {aiStreamRequest} from '../services/aiClient'
import MarkdownContent from './MarkdownContent.vue'
import {timeText} from '../workflow/eventLifecycle'
const props=defineProps({open:Boolean,title:{type:String,default:'态势助手'},collapsible:{type:Boolean,default:true},health:{type:Object,default:null},chronology:{type:Object,required:true},readings:{type:Object,required:true}})
defineEmits(['close'])
const store=useEventLifecycleStore(),input=ref(''),inputEl=ref(null),messages=ref([]),pending=ref(false),error=ref(''),stream=ref(null),upload=ref(null),fileNotice=ref('')
const questions=['近24小时工况如何变化？','当前主机转速与负荷是多少？']
let controller
function submitOnEnter(event){if(event.isComposing)return;event.preventDefault();ask(input.value)}
async function ask(text){
 if(!text.trim()||pending.value)return
 const history=messages.value.map(m=>({role:m.role,content:m.text})).slice(-8)
 messages.value.push({role:'user',text,at:new Date().toISOString()});messages.value.push({role:'assistant',text:'',at:new Date().toISOString()})
 const index=messages.value.length-1;input.value='';error.value='';fileNotice.value='';pending.value=true
 nextTick(()=>stream.value?.scrollTo({top:stream.value.scrollHeight}))
 const requestController=new AbortController();controller=requestController
 try{
  const result=await aiStreamRequest({mode:'situation',role:store.state.role,text,history,situation:{ship:'长航碧玉',readings:props.readings,periods:props.chronology.periods,source:props.chronology.source,health:props.health?{conclusion:props.health.conclusion,next:props.health.next,detail:props.health.detail,completedAt:props.health.completedAt}:undefined}},(kind,data)=>{
   if(kind==='text'&&controller===requestController){messages.value[index].text+=data.delta;nextTick(()=>stream.value?.scrollTo({top:stream.value.scrollHeight}))}
  },{signal:requestController.signal})
  if(controller===requestController){messages.value[index].text=result.answer;nextTick(()=>stream.value?.scrollTo({top:stream.value.scrollHeight}))}
 }catch(e){if(!requestController.signal.aborted)error.value=e.message}
 finally{if(controller===requestController){pending.value=false;controller=null}}
}
async function attach(event){const file=event.target.files?.[0];if(!file)return;fileNotice.value='';try{if(file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的文字记录。');input.value=await file.text();fileNotice.value='文件内容已加入会话草稿';await nextTick();inputEl.value?.focus()}catch(e){fileNotice.value=e.message}event.target.value=''}
function reset(){controller?.abort();controller=null;pending.value=false;messages.value=[];input.value='';error.value='';fileNotice.value=''}
watch(()=>store.state.role,reset)
watch(()=>props.open,async open=>{if(open){await nextTick();inputEl.value?.focus()}})
onBeforeUnmount(()=>controller?.abort())
</script>
<style scoped>
.home-situation-assistant{min-width:0;min-height:0;height:100%;max-height:none;box-sizing:border-box;border:1px solid var(--ui-line,#e9e9e5);color:#405369}
.home-situation-assistant>header{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}
.assistant-collapse{justify-self:end;padding:4px 8px;border:0;border-radius:5px;background:transparent;color:#96723e;font:inherit;font-size:12px;cursor:pointer}
.assistant-collapse:hover{background:#f8f6f0}
.situation-conversation article{overflow-wrap:anywhere}.situation-overview{margin:0}.situation-overview-label{display:flex;align-items:center;gap:8px;margin-bottom:9px;font-size:13px;font-weight:600;color:#a37c3c}
.situation-conversation time{text-align:left}.situation-conversation :deep(.markdown-content){font-size:14px;line-height:1.8}.situation-conversation :deep(.markdown-content>:first-child){margin-top:0}.situation-conversation :deep(.markdown-content>:last-child){margin-bottom:0}
.situation-questions button{font:inherit;font-size:12px;cursor:pointer}.situation-status,.situation-error{font-size:12px;line-height:1.6;padding:8px 0;color:#7c8790}.situation-error{color:#a8593c}.lc-composer footer small{flex:1;min-width:0;line-height:1.5}
.situation-assistant-enter-active{transition:opacity 180ms ease,transform 180ms ease}.situation-assistant-enter-from{opacity:0;transform:translateX(12px)}
@media(prefers-reduced-motion:reduce){.situation-assistant-enter-active{transition:none}}
</style>
