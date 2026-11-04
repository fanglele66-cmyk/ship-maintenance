<template>
 <aside class="home-situation-assistant" aria-label="态势助手" @keydown.esc="$emit('close')">
  <header><strong>态势助手</strong><button type="button" aria-label="收起态势助手" @click="$emit('close')">收起 →</button></header>
  <div ref="stream" class="situation-conversation">
   <p class="situation-overview">当前{{chronology.periods.at(-1)?.status}}，航速 {{readings.speed}} kn，主机转速 {{readings.rpm}} rpm，负荷 {{readings.load}}%。</p>
   <article v-for="(message,i) in messages" :key="i" :class="message.role"><MarkdownContent :content="message.text"/></article>
   <p v-if="pending" role="status" class="situation-status">正在分析工况资料…</p>
   <p v-if="error" role="alert" class="situation-error">{{error}}</p>
   <div v-if="!messages.length" class="situation-questions"><button v-for="question in questions" :key="question" type="button" @click="ask(question)">{{question}} ↗</button></div>
  </div>
  <form @submit.prevent="ask(input)"><textarea ref="inputEl" v-model="input" aria-label="询问态势助手" placeholder="询问航行工况、主机参数或运行变化…" @keydown.enter.exact="submitOnEnter"/><button type="submit" aria-label="发送态势问题" :disabled="pending||!input.trim()">↑</button></form>
 </aside>
</template>
<script setup>
import {ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {aiStreamRequest} from '../services/aiClient'
import MarkdownContent from './MarkdownContent.vue'
const props=defineProps({open:Boolean,chronology:{type:Object,required:true},readings:{type:Object,required:true}})
defineEmits(['close'])
const store=useEventLifecycleStore(),input=ref(''),inputEl=ref(null),messages=ref([]),pending=ref(false),error=ref(''),stream=ref(null)
const questions=['近24小时工况如何变化？','当前主机转速与负荷是多少？']
let controller
function submitOnEnter(event){if(event.isComposing)return;event.preventDefault();ask(input.value)}
async function ask(text){
 if(!text.trim()||pending.value)return
 const history=messages.value.map(m=>({role:m.role,content:m.text})).slice(-8)
 messages.value.push({role:'user',text});messages.value.push({role:'assistant',text:''})
 const index=messages.value.length-1;input.value='';error.value='';pending.value=true
 const requestController=new AbortController();controller=requestController
 try{
  const result=await aiStreamRequest({mode:'situation',role:store.state.role,text,history,situation:{ship:'长航碧玉',readings:props.readings,periods:props.chronology.periods,source:props.chronology.source}},(kind,data)=>{
   if(kind==='text'&&controller===requestController){messages.value[index].text+=data.delta;nextTick(()=>stream.value?.scrollTo({top:stream.value.scrollHeight}))}
  },{signal:requestController.signal})
  if(controller===requestController)messages.value[index].text=result.answer
 }catch(e){if(!requestController.signal.aborted)error.value=e.message}
 finally{if(controller===requestController){pending.value=false;controller=null}}
}
function reset(){controller?.abort();controller=null;pending.value=false;messages.value=[];input.value='';error.value=''}
watch(()=>store.state.role,reset)
watch(()=>props.open,async open=>{if(open){await nextTick();inputEl.value?.focus()}})
onBeforeUnmount(()=>controller?.abort())
</script>
<style scoped>
.home-situation-assistant{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:white;border:1px solid #e1e5e8;border-radius:8px;overflow:hidden}.home-situation-assistant>header{display:flex;justify-content:space-between;align-items:center;padding:20px 16px;border-bottom:1px solid #eee}.home-situation-assistant>header button{border:0;background:none;color:#96723e;cursor:pointer}.situation-conversation{flex:1;min-height:0;overflow:auto;padding:16px;font-size:14px;line-height:1.8;color:#405369}.situation-overview{margin:0 0 24px}.situation-conversation article{margin:18px 0;overflow-wrap:anywhere}.situation-conversation article.user{background:#f4f4ef;padding:12px;border-radius:8px}.situation-conversation :deep(.markdown-content){font-size:14px;line-height:1.8}.situation-questions{display:grid;gap:12px}.situation-questions button{border:0;background:none;text-align:left;color:#647c8b;cursor:pointer;padding:8px 0}.situation-status{color:#7c8790}.situation-error{color:#a8593c}.home-situation-assistant form{margin:12px;padding:12px;border:1px solid #d8ddcf;border-radius:12px;display:grid;justify-items:end;gap:12px}.home-situation-assistant textarea{width:100%;box-sizing:border-box;min-height:76px;resize:none;border:0;outline:none;font:inherit;font-size:13px;color:#405369;background:none}.home-situation-assistant form button{border:1px solid #d8ddcf;border-radius:8px;width:30px;height:30px;background:#f1f3ed;color:#6b7a61;cursor:pointer}.home-situation-assistant form button:disabled{opacity:.4}
</style>
