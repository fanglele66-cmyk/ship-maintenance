<template>
 <aside class="lc-assistant"><header><strong>{{captain?'事件处置助手':'AI检修助手'}}</strong><small>{{people[store.state.role]}} · {{event.title}}</small></header>
  <div ref="stream" class="lc-conversation" @wheel.passive="following=false" @pointerdown="following=false">
   <article v-for="(message,i) in messages" :key="message.id" :class="['lc-message',message.kind]" :data-message-id="message.id">
    <p v-if="message.modelError" class="lc-model-error">{{message.modelError}}</p>
    <ModelReply v-if="message.kind==='model'" :message="message" @apply="apply" @report="$emit('report',$event)" @plan="$emit('plan')"/>
    <AssistantAdviceMessage v-else-if="message.kind==='advice'" :message="{...message,currentAdvice:i===messages.length-1,historical:i!==messages.length-1,actionLabel:i===messages.length-1&&canAct?'填写本阶段表单':''}" @action="showForm" @stream-progress="follow"/>
    <template v-else><strong v-if="message.title">{{message.title}}</strong><p>{{message.text}}</p><button v-if="message.reportId" type="button" @click="$emit('report',message.reportId)">查看报告</button></template><time>{{timeText(message.at)}}</time>
   </article>
   <p v-if="submitError" class="lc-model-error" role="alert">{{submitError}}</p>
   <section v-if="canAct" ref="formArea" class="lc-assistant-form"><button type="button" class="lc-form-toggle" :aria-expanded="formOpen" @click="formOpen=!formOpen">{{formOpen?'收起表单':captain?'填写处置决定':task?.kind==='investigation'?'填写排查反馈':'填写作业反馈'}} <span>{{formOpen?'⌃':'⌄'}}</span></button><LifecycleActionForm v-if="formOpen" :event="event" @submitted="submitted" @expanded="revealForm"/></section>
   <div class="lc-followups"><button v-for="q in questions" :key="q" type="button" @click="ask(q)">{{q}}</button></div>
  </div>
  <form class="lc-composer" @submit.prevent="ask(input)"><div v-if="editableReports.length||editablePlan" class="lc-chat-mode"><button v-if="editableReports.length" type="button" :aria-pressed="mode==='report'" @click="mode=mode==='report'?'chat':'report'">补充报告</button><button v-if="editablePlan" type="button" :aria-pressed="mode==='plan'" :disabled="editablePlan.status!=='ready'" @click="mode=mode==='plan'?'chat':'plan'">修改待派任务</button><select v-if="mode==='report'" v-model="targetReport" aria-label="要补充的报告"><option v-for="r in editableReports" :key="r.id" :value="r.id">{{r.title}}</option></select></div><textarea ref="inputEl" v-model="input" aria-label="询问助手" :placeholder="mode==='plan'?'说明要增加、删除或调整的任务步骤，修改后在任务 Tab 核对…':mode==='report'?'输入要补充的事实，生成修订稿后核对写入…':'询问依据、补充现场情况或后续安排…'" @keydown.enter.exact.prevent="ask(input)"/><footer><button type="button" aria-label="添加文件" @click="upload.click()">＋</button><small v-if="fileNotice">{{fileNotice}}</small><button type="submit" aria-label="发送" :disabled="pending||!input.trim()">{{pending?'…':'↑'}}</button></footer><input ref="upload" type="file" hidden accept=".txt,.md,.csv,.json" @change="attach"/></form>
 </aside>
</template>
<script setup>
import {computed,ref,watch,nextTick} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {people,currentTask,decisionOptions,timeText} from '../workflow/eventLifecycle'
import AssistantAdviceMessage from './messages/AssistantAdviceMessage.vue'
import LifecycleActionForm from './LifecycleActionForm.vue'
import ModelReply from './ModelReply.vue'
import {dispatchAction} from '../workflow/lifecycleDecisions'
import {supplementaryReports} from '../workflow/reportRevisions'
const props=defineProps({event:{type:Object,required:true}}),emit=defineEmits(['submitted','report','plan']),store=useEventLifecycleStore()
const captain=computed(()=>store.state.role==='captain'),messages=computed(()=>props.event.conversations[store.state.role]),task=computed(()=>currentTask(props.event)),canAct=computed(()=>captain.value?decisionOptions(props.event).length>0:task.value?.status==='assigned'&&task.value.owner===people.engineer)
const questions=computed(()=>props.event.phase==='closed'?['回顾本次处理过程']:captain.value?['这次决定的依据是什么？','下一步应如何安排？']:['还需要补充哪些排查依据？','维修范围如何确定？'])
const inputEl=ref(null),editablePlan=computed(()=>captain.value&&dispatchAction(props.event)?props.event.pendingPlan:null)
function editTask(){if(editablePlan.value?.status!=='ready')return;mode.value='plan';emit('plan');nextTick(()=>inputEl.value?.focus())}
function openShore(){props.event.decisionDraft||={action:'',reason:'',owner:people.engineer,deadline:'',order:'',window:''};props.event.decisionDraft.action='shore';showForm()}
defineExpose({editTask,openShore})
watch(editablePlan,plan=>{if(!plan&&mode.value==='plan')mode.value='chat'})
const mode=ref('chat'),targetReport=ref(''),submitError=ref('')
const editableReports=computed(()=>supplementaryReports(props.event,store.state.role)),pending=computed(()=>store.pendingRequests[props.event.id+':'+store.state.role])
watch(editableReports,list=>{if(!list.some(r=>r.id===targetReport.value))targetReport.value=list.at(-1)?.id||'';if(!list.length&&mode.value==='report')mode.value='chat'},{immediate:true})
const formOpen=ref(false),input=ref(''),stream=ref(null),formArea=ref(null),upload=ref(null),fileNotice=ref(''),following=ref(false)
function follow(){if(following.value&&stream.value)stream.value.scrollTo({top:stream.value.scrollHeight,behavior:'smooth'})}
function showForm(){formOpen.value=true;following.value=false;nextTick(revealForm)}
function revealForm(){nextTick(()=>{const scroller=stream.value,form=formArea.value;if(scroller&&form)scroller.scrollTo({top:form.offsetTop-scroller.offsetTop-20,behavior:'smooth'})})}
function submitted(action){formOpen.value=false;following.value=true;emit('submitted',action)}
async function ask(text){if(!text.trim()||pending.value)return;submitError.value='';following.value=true;const selectedMode=mode.value;input.value='';try{await store.ask(props.event.id,text,{mode:selectedMode,reportId:targetReport.value})}catch(e){submitError.value=e.message;input.value=text}nextTick(follow)}
function apply(messageId){submitError.value='';try{const report=store.applySupplement(props.event.id,messageId);emit('report',report.id)}catch(e){submitError.value=e.message}}
watch(()=>messages.value.length,(count,previous)=>{if(count>previous){formOpen.value=false;following.value=true;nextTick(follow)}})
watch(()=>{const m=messages.value.at(-1);return [m?.text,m?.draft?.patch,m?.taskDraft,m?.progress,m?.status]},()=>nextTick(follow))
watch(()=>[props.event.id,store.state.role],()=>{formOpen.value=false;following.value=false;input.value='';fileNotice.value='';mode.value='chat';submitError.value='';nextTick(()=>{if(stream.value)stream.value.scrollTop=0})})
async function attach(ev){const file=ev.target.files?.[0];if(!file)return;fileNotice.value='';try{if(file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的文字记录。');const text=await file.text();if(task.value?.status==='assigned'&&!captain.value){task.value.draft.attachments.push({name:file.name,size:file.size,text});task.value.draft.summary=[task.value.draft.summary,text].filter(Boolean).join('\n');fileNotice.value='文件已填入结果摘要，请核对后提交';showForm()}else{input.value=text;fileNotice.value='文件内容已加入会话草稿'}}catch(e){fileNotice.value=e.message}ev.target.value=''}
</script>

<style scoped>
.lc-chat-mode{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.lc-chat-mode button{font-size:11px;padding:4px 8px;border:1px solid #e0e5eb;background:#fff;color:#8390a0;border-radius:5px;cursor:pointer}.lc-chat-mode button[aria-pressed=true]{color:#96723e;background:#fbf7ef;border-color:#dac8a8}.lc-chat-mode select{width:100%;font-size:11px;padding:5px;border:1px solid #e3e7ec;border-radius:4px;color:#687b92}.lc-model-status,.lc-model-error{font-size:12px;line-height:1.6;color:#8490a0;padding:8px 0}.lc-model-error{color:#b47546}.lc-composer button:disabled{opacity:.4;cursor:wait}
</style>
