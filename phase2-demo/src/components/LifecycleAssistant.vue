<template>
 <aside class="lc-assistant"><header><strong>{{taskId?'任务助手':captain?'事件处置助手':'AI检修助手'}}</strong><small>{{people[store.state.role]}} · {{taskId?taskTitle(task):event.title}}</small></header>
  <div ref="stream" class="lc-conversation" @wheel.passive="following=false" @pointerdown="following=false">
   <article v-if="taskId" class="lc-message advice"><strong>本次任务要求</strong><p>{{task?.scope}}</p><p class="lc-muted">{{task?.status==='submitted'?'本次反馈已提交，可查看结果或补充本任务报告；任务目标与后续安排由轮机长审阅。':captain?'由执行人按步骤填写；此处可查看进度与询问本次任务。':'按本次步骤记录实际结果，汇总后提交给轮机长。'}}</p></article>
   <article v-for="(message,i) in messages" :key="message.id" :class="['lc-message',message.kind]" :data-message-id="message.id">
    <p v-if="message.modelError" class="lc-model-error">{{message.modelError}}</p>
    <ModelReply v-if="message.kind==='model'" :message="message" @apply="apply" @report="$emit('report',$event)" @plan="$emit('plan')"/>
    <AssistantAdviceMessage v-else-if="message.kind==='advice'" :message="{...message,currentAdvice:i===messages.length-1,historical:i!==messages.length-1,actionLabel:''}" @stream-progress="follow"/>
    <template v-else><strong v-if="message.title">{{message.title}}</strong><p>{{message.text}}</p><button v-if="message.reportId" type="button" @click="$emit('report',message.reportId)">查看报告</button></template><time>{{timeText(message.at)}}</time>
   </article>
   <article v-if="taskId&&task?.status==='submitted'&&!messages.some(m=>m.reportId)" class="lc-message receipt"><strong>本轮反馈已收录</strong><p>{{task.summary}}</p><p>逐项结果及汇总结论已归入关联事件，可回看本次报告。</p><button type="button" @click="$emit('report',event.reports.find(r=>r.taskId===task.id)?.id)">查看报告</button><time>{{timeText(task.submittedAt)}}</time></article>
   <p v-if="submitError" class="lc-model-error" role="alert">{{submitError}}</p>
   <section v-if="canAct||(captain&&closed&&closedShoreOpen)" ref="formArea" class="lc-assistant-form"><button type="button" class="lc-form-toggle" :aria-expanded="formOpen" @click="toggleForm">{{closed?'取消岸基同步':formOpen?'收起表单':captain?'填写处置决定':task?.kind==='investigation'?'填写排查反馈':'填写作业反馈'}} <span aria-hidden="true">{{closed?'×':formOpen?'⌃':'⌄'}}</span></button><LifecycleActionForm v-if="formOpen" :event="event" :shore-only="closed" :show-basis="!closed" @submitted="submitted" @expanded="revealForm"/></section>
   <section v-if="taskId&&canExecuteTask(store.state,event,task)" class="lc-assistant-form"><button type="button" class="lc-form-toggle" :aria-expanded="formOpen" @click="formOpen=!formOpen">{{formOpen?'收起表单':task.kind==='investigation'?'填写排查反馈':'填写作业反馈'}}</button><LifecycleActionForm v-if="formOpen" :event="event" :task-id="taskId" :show-basis="false" @submitted="submitted"/></section>
   <button v-if="!taskId&&!captain&&task?.status==='assigned'" class="lc-task-open" @click="$emit('task',task.id)">进入本轮{{task.kind==='investigation'?'排查':'作业'}}任务 →</button>
   <div class="lc-followups" aria-label="继续追问"><span class="lc-followups-label">继续了解</span><button v-for="q in questions" :key="q" type="button" :disabled="!!pending" @click="askFollowup(q)"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 4h12v9H9l-4 3v-3H4z"/><path d="M7 7h6M7 10h4"/></svg><span>{{q}}</span><span class="lc-followup-arrow" aria-hidden="true">↗</span></button></div>
  </div>
  <form class="lc-composer" @submit.prevent="ask(input)"><div v-if="editableReports.length||editablePlan" class="lc-chat-mode"><button v-if="editableReports.length" type="button" :aria-pressed="mode==='report'" @click="mode=mode==='report'?'chat':'report'">补充报告</button><button v-if="editablePlan" type="button" :aria-pressed="mode==='plan'" :disabled="editablePlan.status!=='ready'" @click="mode=mode==='plan'?'chat':'plan'">修改AI建议</button><select v-if="mode==='report'" v-model="targetReport" aria-label="要补充的报告"><option v-for="r in editableReports" :key="r.id" :value="r.id">{{r.title}}</option></select></div><textarea ref="inputEl" v-model="input" aria-label="询问助手" :placeholder="mode==='plan'?'说明要增加、删除或调整的任务步骤，修改后在建议页签核对…':mode==='report'?'输入要补充的事实，生成修订稿后核对写入…':'询问依据、补充现场情况或后续安排…'" @keydown.enter.exact.prevent="ask(input)"/><footer><button type="button" aria-label="添加文件" @click="upload.click()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><small v-if="fileNotice">{{fileNotice}}</small><button type="submit" aria-label="发送" :disabled="pending||!input.trim()" :aria-busy="pending"><svg v-if="!pending" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></footer><input ref="upload" type="file" hidden accept=".txt,.md,.csv,.json" @change="attach"/></form>
 </aside>
</template>
<script setup>
import {computed,ref,watch,nextTick} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {people,currentTask,decisionOptions,timeText,ensureTaskPlan} from '../workflow/eventLifecycle'
import AssistantAdviceMessage from './messages/AssistantAdviceMessage.vue'
import LifecycleActionForm from './LifecycleActionForm.vue'
import ModelReply from './ModelReply.vue'
import {suggestionAction} from '../workflow/lifecycleDecisions'
import {supplementaryReports} from '../workflow/reportRevisions'
import {taskConversation,taskTitle,canExecuteTask} from '../workflow/lifecycleWorkItems'
const props=defineProps({event:{type:Object,required:true},taskId:{type:String,default:''},historical:{type:Boolean,default:false},pendingPlanView:{type:Boolean,default:false}}),emit=defineEmits(['submitted','report','plan','task']),store=useEventLifecycleStore()
const captain=computed(()=>store.state.role==='captain'),closed=computed(()=>props.event.phase==='closed'),task=computed(()=>props.taskId?props.event.tasks.find(t=>t.id===props.taskId):currentTask(props.event)),messages=computed(()=>props.taskId&&task.value?taskConversation(task.value,store.state.role):props.event.conversations[store.state.role]),canAct=computed(()=>!props.taskId&&!props.historical&&!closed.value&&captain.value&&decisionOptions(props.event).length>0)
const questions=computed(()=>props.taskId?['本次任务需要注意哪些事项？','这次记录还需要补充什么？']:props.event.phase==='closed'?['回顾本次处理过程']:captain.value?['这次决定的依据是什么？','下一步应如何安排？']:['还需要补充哪些排查依据？','维修范围如何确定？'])
const inputEl=ref(null),editablePlan=computed(()=>!props.taskId&&!props.historical&&captain.value&&suggestionAction(props.event)?props.event.pendingPlan:null)
function editTask(){if(editablePlan.value?.status!=='ready')return;mode.value='plan';emit('plan');nextTick(()=>inputEl.value?.focus())}
function openShore(){if(!captain.value||!closed.value)return;props.event.decisionDraft||={action:'',reason:'',owner:people.engineer,deadline:'',order:'',window:''};props.event.decisionDraft.action='shore';closedShoreOpen.value=true;showForm()}
function openDispatch(){
 if(!canAct.value||editablePlan.value?.status!=='ready')return
 const plan=ensureTaskPlan(props.event)
 if(!plan||plan.status!=='ready'||!decisionOptions(props.event).some(o=>o.value===plan.action))return
 props.event.decisionDraft||={action:'',reason:'',owner:people.engineer,deadline:'',maintenancePlanId:'',window:''}
 props.event.decisionDraft.action=plan.action;mode.value='chat';showForm()
 nextTick(()=>{const form=formArea.value;if(window.matchMedia('(max-width:900px)').matches)form?.scrollIntoView({behavior:'smooth',block:'center'});form?.querySelector('select')?.focus({preventScroll:true})})
}
function supplementReport(reportId){
 if(!editableReports.value.some(report=>report.id===reportId))return
 targetReport.value=reportId;mode.value='report';formOpen.value=false
 nextTick(()=>{inputEl.value?.scrollIntoView({block:'nearest'});inputEl.value?.focus({preventScroll:true})})
}
defineExpose({editTask,openShore,openDispatch,supplementReport})
watch(editablePlan,plan=>{if(!plan&&mode.value==='plan')mode.value='chat'})
const mode=ref('chat'),targetReport=ref(''),submitError=ref('')
const editableReports=computed(()=>supplementaryReports(props.event,store.state.role).filter(r=>!props.taskId||r.taskId===props.taskId)),pending=computed(()=>store.pendingRequests[props.event.id+':'+store.state.role+(props.taskId?':'+props.taskId:'')])
watch(editableReports,list=>{if(!list.some(r=>r.id===targetReport.value))targetReport.value=list.at(-1)?.id||'';if(!list.length&&mode.value==='report')mode.value='chat'},{immediate:true})
const formOpen=ref(false),closedShoreOpen=ref(false),input=ref(''),stream=ref(null),formArea=ref(null),upload=ref(null),fileNotice=ref(''),following=ref(false)
function follow(){if(following.value&&stream.value)stream.value.scrollTo({top:stream.value.scrollHeight,behavior:'smooth'})}
function showForm(){if(!canAct.value&&!closedShoreOpen.value)return;formOpen.value=true;following.value=false;nextTick(revealForm)}
function toggleForm(){if(closed.value){closedShoreOpen.value=false;formOpen.value=false}else formOpen.value=!formOpen.value}
function revealForm(){nextTick(()=>{const scroller=stream.value,form=formArea.value;if(scroller&&form)scroller.scrollTo({top:form.offsetTop-scroller.offsetTop-20,behavior:'smooth'})})}
function submitted(action){formOpen.value=false;closedShoreOpen.value=false;following.value=true;emit('submitted',action)}
async function ask(text){if(!text.trim()||pending.value)return;submitError.value='';following.value=true;const selectedMode=mode.value;input.value='';try{await store.ask(props.event.id,text,{mode:selectedMode,reportId:targetReport.value,taskId:props.taskId})}catch(e){submitError.value=e.message;input.value=text}nextTick(follow)}
function askFollowup(text){mode.value='chat';return ask(text)}
function apply(messageId){submitError.value='';try{const report=store.applySupplement(props.event.id,messageId,props.taskId);emit('report',report.id)}catch(e){submitError.value=e.message}}
watch(()=>messages.value.length,(count,previous)=>{if(count>previous){formOpen.value=false;closedShoreOpen.value=false;following.value=true;nextTick(follow)}})
watch(()=>{const m=messages.value.at(-1);return [m?.text,m?.draft?.patch,m?.generatedReport,m?.taskDraft,m?.progress,m?.status]},()=>nextTick(follow))
watch(()=>[props.event.id,props.taskId,store.state.role,closed.value],()=>{formOpen.value=false;closedShoreOpen.value=false;following.value=false;input.value='';fileNotice.value='';mode.value='chat';submitError.value='';nextTick(()=>{if(stream.value)stream.value.scrollTop=0})})
async function attach(ev){const file=ev.target.files?.[0];if(!file)return;fileNotice.value='';try{if(file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的文字记录。');const text=await file.text();if(task.value&&canExecuteTask(store.state,props.event,task.value)){task.value.draft.attachments.push({name:file.name,size:file.size,text});task.value.draft.summary=[task.value.draft.summary,text].filter(Boolean).join('\n');fileNotice.value='文件已填入本任务结果摘要，请核对后提交';if(!props.taskId)showForm()}else{input.value=text;fileNotice.value='文件内容已加入会话草稿'}}catch(e){fileNotice.value=e.message}ev.target.value=''}
</script>

<style scoped>
.lc-chat-mode{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.lc-chat-mode button{font-size:11px;padding:4px 8px;border:1px solid #e0e5eb;background:#fff;color:#8390a0;border-radius:5px;cursor:pointer}.lc-chat-mode button[aria-pressed=true]{color:#96723e;background:#fbf7ef;border-color:#dac8a8}.lc-chat-mode select{width:100%;font-size:11px;padding:5px;border:1px solid #e3e7ec;border-radius:4px;color:#687b92}.lc-model-status,.lc-model-error{font-size:12px;line-height:1.6;color:#8490a0;padding:8px 0}.lc-model-error{color:#b47546}.lc-composer button:disabled{opacity:.4;cursor:wait}
</style>
