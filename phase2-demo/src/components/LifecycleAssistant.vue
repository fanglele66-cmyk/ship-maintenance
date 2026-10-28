<template>
 <aside class="lc-assistant"><header><strong>{{captain?'事件处置助手':'AI检修助手'}}</strong><small>{{people[store.state.role]}} · {{event.title}}</small></header>
  <div ref="stream" class="lc-conversation" @wheel.passive="following=false" @pointerdown="following=false">
   <article v-for="(message,i) in messages" :key="message.id" :class="['lc-message',message.kind]" :data-message-id="message.id">
    <AssistantAdviceMessage v-if="message.kind==='advice'" :message="{...message,currentAdvice:i===messages.length-1,historical:i!==messages.length-1,actionLabel:i===messages.length-1&&canAct?'填写本阶段表单':''}" @action="showForm" @stream-progress="follow"/>
    <template v-else><strong v-if="message.title">{{message.title}}</strong><p>{{message.text}}</p><button v-if="message.reportId" type="button" @click="$emit('report',message.reportId)">查看报告</button></template><time>{{timeText(message.at)}}</time>
   </article>
   <section v-if="canAct" ref="formArea" class="lc-assistant-form"><button type="button" class="lc-form-toggle" :aria-expanded="formOpen" @click="formOpen=!formOpen">{{formOpen?'收起表单':captain?'填写处置决定':task?.kind==='investigation'?'填写排查反馈':'填写作业反馈'}} <span>{{formOpen?'⌃':'⌄'}}</span></button><LifecycleActionForm v-if="formOpen" :event="event" @submitted="submitted" @expanded="revealForm"/></section>
   <div class="lc-followups"><button v-for="q in questions" :key="q" type="button" @click="ask(q)">{{q}}</button></div>
  </div>
  <form class="lc-composer" @submit.prevent="ask(input)"><textarea v-model="input" aria-label="询问助手" placeholder="询问依据、补充现场情况或后续安排…" @keydown.enter.exact.prevent="ask(input)"/><footer><button type="button" aria-label="添加文件" @click="upload.click()">＋</button><small v-if="fileNotice">{{fileNotice}}</small><button type="submit" aria-label="发送">↑</button></footer><input ref="upload" type="file" hidden accept=".txt,.md,.csv,.json" @change="attach"/></form>
 </aside>
</template>
<script setup>
import {computed,ref,watch,nextTick} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {people,currentTask,decisionOptions,timeText} from '../workflow/eventLifecycle'
import AssistantAdviceMessage from './messages/AssistantAdviceMessage.vue'
import LifecycleActionForm from './LifecycleActionForm.vue'
const props=defineProps({event:{type:Object,required:true}}),emit=defineEmits(['submitted','report']),store=useEventLifecycleStore()
const captain=computed(()=>store.state.role==='captain'),messages=computed(()=>props.event.conversations[store.state.role]),task=computed(()=>currentTask(props.event)),canAct=computed(()=>captain.value?decisionOptions(props.event).length>0:task.value?.status==='assigned'&&task.value.owner===people.engineer)
const questions=computed(()=>props.event.phase==='closed'?['回顾本次处理过程']:captain.value?['这次决定的依据是什么？','下一步应如何安排？']:['还需要补充哪些排查依据？','维修范围如何确定？'])
const formOpen=ref(false),input=ref(''),stream=ref(null),formArea=ref(null),upload=ref(null),fileNotice=ref(''),following=ref(false)
function follow(){if(following.value&&stream.value)stream.value.scrollTo({top:stream.value.scrollHeight,behavior:'smooth'})}
function showForm(){formOpen.value=true;following.value=false;nextTick(revealForm)}
function revealForm(){nextTick(()=>{const scroller=stream.value,form=formArea.value;if(scroller&&form)scroller.scrollTo({top:form.offsetTop-scroller.offsetTop-20,behavior:'smooth'})})}
function submitted(){formOpen.value=false;following.value=true;emit('submitted')}
function ask(text){if(!text.trim())return;following.value=true;store.ask(props.event.id,text);input.value='';nextTick(follow)}
watch(()=>messages.value.length,(count,previous)=>{if(count>previous){formOpen.value=false;following.value=true;nextTick(follow)}})
watch(()=>[props.event.id,store.state.role],()=>{formOpen.value=false;following.value=false;input.value='';fileNotice.value='';nextTick(()=>{if(stream.value)stream.value.scrollTop=0})})
async function attach(ev){const file=ev.target.files?.[0];if(!file)return;fileNotice.value='';try{if(file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的文字记录。');const text=await file.text();if(task.value?.status==='assigned'&&!captain.value){task.value.draft.attachments.push({name:file.name,size:file.size,text});task.value.draft.summary=[task.value.draft.summary,text].filter(Boolean).join('\n');fileNotice.value='文件已填入结果摘要，请核对后提交';showForm()}else{input.value=text;fileNotice.value='文件内容已加入会话草稿'}}catch(e){fileNotice.value=e.message}ev.target.value=''}
</script>
