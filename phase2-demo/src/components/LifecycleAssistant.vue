<template>
 <aside class="lc-assistant"><header><div class="assistant-heading"><strong>{{taskId?'任务助手':'事件助手'}}</strong></div><button v-if="taskId" type="button" class="assistant-collapse" aria-label="收起任务助手" @click="$emit('collapse')">收起 →</button></header>
  <div ref="stream" class="lc-conversation" @wheel.passive="following=false" @pointerdown="following=false">
   <article v-if="introduction.length" class="lc-message task-assistant-intro"><p v-for="(sentence,i) in introduction" :key="i">{{sentence}}</p></article>
   <article v-for="(message,i) in messages" :key="message.id" :class="['lc-message',message.kind,{'step-assist-user':message.kind==='user'&&message.stepAssistance}]" :data-message-id="message.id">
    <p v-if="message.modelError" class="lc-model-error">{{message.modelError}}</p>
    <ModelReply v-if="message.kind==='model'" :message="message" @apply="apply" @report="$emit('report',$event)" @plan="$emit('plan')"/>
    <AssistantAdviceMessage v-else-if="message.kind==='advice'" :message="{...message,currentAdvice:i===messages.length-1,historical:i!==messages.length-1,actionLabel:'',compact:true,basisLabel:'思考过程'}" @stream-progress="follow"/>
    <StepNoteProposal v-else-if="message.kind==='step-assist'" :message="message" :disabled="!!pending||!stepAvailable" @apply="applyStepNote" @revise="reviseStep"/>
    <template v-else><strong v-if="message.title">{{message.title}}</strong><p v-if="message.text">{{message.text}}</p></template>
    <div v-if="message.images?.length" class="message-images"><div v-for="(photo,j) in message.images" :key="j"><button type="button" :aria-label="`查看图片：${photo.name}`" :title="photo.name" @click="previewImage(photo)"><img :src="photo.dataUrl" :alt="photo.name" loading="lazy"/></button><small v-if="isStepPhotoCopy(photo)">上传压缩副本</small></div></div>
    <ul v-if="message.attachments?.length" class="message-files"><li v-for="(file,j) in message.attachments" :key="j">附件 · {{file.name}}</li></ul>
    <time>{{timeText(message.at)}}</time>
   </article>
   <article v-if="taskId&&task?.status==='submitted'&&!messages.some(m=>m.reportId)" class="lc-message receipt"><strong>本轮反馈已收录</strong><p>{{task.summary}}</p><p>本轮报告待审阅。</p><time>{{timeText(task.submittedAt)}}</time></article>
   <p v-if="submitError" class="lc-model-error" role="alert">{{submitError}}</p>
   <div v-if="!stepAvailable" class="lc-followups" aria-label="继续追问"><button v-for="q in questions" :key="q" type="button" :disabled="!!pending" @click="askFollowup(q)"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 4h12v9H9l-4 3v-3H4z"/><path d="M7 7h6M7 10h4"/></svg><span>{{q}}</span><span class="lc-followup-arrow" aria-hidden="true">↗</span></button></div>
  </div>
  <AssistantQuestionCard v-if="decisionQuestion" :key="decisionQuestion.key" :title="decisionQuestion.title" :context="decisionQuestion.context" :choices="decisionQuestion.choices" :disabled="!!pending||readingFiles" @confirm="confirmQuestion" @custom="customQuestion"/>
  <form class="lc-composer" :class="{'step-focus':composerHighlight}" @submit.prevent="ask(input)">
   <div v-if="(!taskId&&editableReports.length)||editablePlan||(mode==='report'&&editableReports.length>1)" class="lc-chat-mode"><button v-if="!taskId&&editableReports.length" type="button" :aria-pressed="mode==='report'" @click="setMode(mode==='report'?'chat':'report')">补充报告</button><button v-if="editablePlan" type="button" :aria-pressed="mode==='plan'" :disabled="editablePlan.status!=='ready'" @click="setMode(mode==='plan'?'chat':'plan')">修改AI建议</button><select v-if="mode==='report'&&editableReports.length>1" v-model="targetReport" aria-label="要补充的报告"><option v-for="r in editableReports" :key="r.id" :value="r.id">{{r.title}} · {{r.number||r.submissionNumber}}</option></select></div>
   <textarea ref="inputEl" v-model="input" aria-label="询问助手" :placeholder="composerPlaceholder" @keydown.enter.exact.prevent="ask(input)"/>
   <div v-if="mode==='step'&&images.length" class="composer-images" aria-label="待发送照片"><div v-for="(photo,i) in images" :key="i"><button type="button" class="image-thumbnail" :aria-label="`预览图片：${photo.name}`" :title="photo.name" @click="previewImage(photo)"><img :src="photo.dataUrl" :alt="photo.name"/></button><button type="button" class="remove-material" :aria-label="`移除图片：${photo.name}`" @click="images.splice(i,1)">×</button><small v-if="isStepPhotoCopy(photo)">上传压缩副本</small></div></div>
   <ul v-if="mode==='step'&&attachments.length" class="composer-files"><li v-for="(file,i) in attachments" :key="i"><span>{{file.name}}</span><button type="button" :aria-label="`移除附件：${file.name}`" @click="attachments.splice(i,1)">×</button></li></ul>
   <footer>
    <button type="button" aria-label="添加文件" title="添加文字附件" :disabled="!!pending||readingFiles" @click="upload?.click()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9M7 14l8-8"/></svg></button>
    <button v-if="isC2Task" type="button" class="composer-photo" aria-label="添加现场照片" title="添加现场照片或拍照" :disabled="!!pending||readingFiles" @click="choosePhoto"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="8" cy="10" r="1.5"/><path d="m4 17 5-4 4 3 4-5 4 5M9 5l1-2h4l1 2"/></svg></button>
    <button type="button" class="composer-voice" :aria-label="speech.listening?'停止语音输入':'开始语音输入'" :title="speech.listening?'停止语音输入':'开始语音输入'" :aria-pressed="speech.listening" :disabled="!!pending" @click="voice.toggle()"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button>
    <button type="submit" class="composer-send" aria-label="发送" :disabled="pending||readingFiles||!hasMessage" :aria-busy="!!pending"><svg v-if="!pending" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button>
   </footer>
   <small v-if="fileNotice" class="composer-file-notice" role="status">{{fileNotice}}</small><small v-if="speech.listening" class="composer-voice-status" role="status">{{speech.stopping?'正在结束录音…':'正在听取语音…'}} {{speech.interim}}</small><small v-if="speech.error" class="composer-voice-error" role="alert">{{speech.error}}</small>
   <input ref="upload" type="file" hidden accept=".txt,.md,.csv,.json" :multiple="mode==='step'" @change="attach"/>
   <input ref="photoUpload" type="file" hidden accept="image/png,image/jpeg,image/webp" capture="environment" multiple @change="attachPhotos"/>
  </form>
  <dialog ref="imageDialog" class="step-image-preview" aria-label="现场照片预览" @close="selectedImage=null" @click="closeImageBackdrop"><header><strong>{{selectedImage?.name}}</strong><button type="button" aria-label="关闭图片预览" @click="imageDialog?.close()">关闭 ×</button></header><img v-if="selectedImage" :src="selectedImage.dataUrl" :alt="selectedImage.name"/></dialog>
 </aside>
</template>
<script setup>
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {currentTask,timeText} from '../workflow/eventLifecycle'
import AssistantAdviceMessage from './messages/AssistantAdviceMessage.vue'
import ModelReply from './ModelReply.vue'
import StepNoteProposal from './StepNoteProposal.vue'
import AssistantQuestionCard from './AssistantQuestionCard.vue'
import {suggestionAction} from '../workflow/lifecycleDecisions'
import {supplementaryReports} from '../workflow/reportRevisions'
import {taskConversation} from '../workflow/lifecycleWorkItems'
import {taskAssistantIntro} from '../workflow/taskAssistantIntro.js'
import {createSpeechDraftInput} from '../workflow/speechDraftInput.js'
import {canUseStepAssist,STEP_ASSIST_LIMITS} from '../workflow/stepAssistContract.js'
import {taskAssistantOpening} from '../workflow/taskAssistantOpening.js'
import {prepareStepPhoto,stepPhotoBytes,isStepPhotoCopy} from '../workflow/stepPhotoUpload.js'
const props=defineProps({event:{type:Object,required:true},taskId:{type:String,default:''},activeStepIndex:{type:Number,default:0},historical:{type:Boolean,default:false},pendingPlanView:{type:Boolean,default:false},phaseId:String}),emit=defineEmits(['submitted','report','plan','task','collapse','shore-report']),store=useEventLifecycleStore()
const captain=computed(()=>store.state.role==='captain'),closed=computed(()=>props.event.phase==='closed'),task=computed(()=>props.taskId?props.event.tasks.find(t=>t.id===props.taskId):currentTask(props.event)),messages=computed(()=>props.taskId&&task.value?taskConversation(task.value,store.state.role):props.event.conversations[store.state.role]||[])
const isC2Task=computed(()=>!!props.taskId&&(props.event.sourceEventId||props.event.id)==='real-alarm-0430'&&['investigation','repair'].includes(task.value?.kind)),stepAvailable=computed(()=>!!props.taskId&&canUseStepAssist(props.event,task.value,store.state.role))
const introduction=computed(()=>props.taskId?taskAssistantIntro(props.event,task.value):[])
const opening=computed(()=>taskAssistantOpening(task.value))
const questions=computed(()=>mode.value==='step'?['本步骤还需要核对哪些现场信息？','帮我根据已提供的情况整理本步骤备注。']:props.taskId?['本次任务需要注意哪些事项？','这次记录还需要补充什么？']:props.event.phase==='closed'?['回顾本次处理过程']:captain.value?['这次决定的依据是什么？','下一步应如何安排？']:['还需要补充哪些排查依据？','维修范围如何确定？'])
const inputEl=ref(null),editablePlan=computed(()=>!props.taskId&&captain.value&&suggestionAction(props.event)?props.event.pendingPlan:null)
function editTask(){if(editablePlan.value?.status!=='ready')return;setMode('plan');emit('plan');nextTick(()=>inputEl.value?.focus())}
function supplementReport(reportId){
 if(!editableReports.value.some(report=>report.id===reportId))return
 targetReport.value=reportId;setMode('report')
 void focusComposer()
}
async function revealReport(){
 following.value=false
 await nextTick()
 const message=[...messages.value].reverse().find(m=>m.generatedReport)
 const article=message&&[...(stream.value?.querySelectorAll('[data-message-id]')||[])].find(el=>el.dataset.messageId===message.id)
 article?.scrollIntoView({block:'start',behavior:'auto'})
}
defineExpose({editTask,supplementReport,revealReport,assistStep})
watch(editablePlan,plan=>{if(!plan&&mode.value==='plan')mode.value='chat'})
const mode=ref('chat'),targetReport=ref(''),submitError=ref(''),stepIndex=ref(0),editingMessageId=ref('')
const editableReports=computed(()=>supplementaryReports(props.event,store.state.role).filter(r=>!props.taskId||r.taskId===props.taskId)),pending=computed(()=>store.pendingRequests[props.event.id+':'+store.state.role+(props.taskId?':'+props.taskId:'')])
watch(editableReports,list=>{if(!list.some(r=>r.id===targetReport.value))targetReport.value=list.at(-1)?.id||'';if(!list.length&&mode.value==='report')mode.value='chat'},{immediate:true})
const input=ref(''),stream=ref(null),upload=ref(null),photoUpload=ref(null),fileNotice=ref(''),following=ref(false),images=ref([]),attachments=ref([]),readingFiles=ref(false),composerHighlight=ref(false),imageDialog=ref(null),selectedImage=ref(null)
const hasMessage=computed(()=>!!input.value.trim()||(mode.value==='step'&&(images.value.length>0||attachments.value.length>0)))
const composerPlaceholder=computed(()=>mode.value==='step'?`描述第 ${stepIndex.value+1} 步现场情况，可添加照片；我会帮你核实信息、整理备注…`:mode.value==='plan'?'说明要增加、删除或调整的任务步骤，修改后在建议页签核对…':mode.value==='report'?'输入要补充的事实，生成修订稿后核对写入…':'询问依据、补充现场情况或后续安排…')
const stepDrafts=new Map()
const dismissedOpening=ref(false)
const currentProposal=computed(()=>{
 if(!stepAvailable.value||mode.value!=='step')return null
 const latest=messages.value.findLast(message=>message.kind==='step-assist'&&message.stepIndex===props.activeStepIndex&&message.status==='complete'&&message.response?.kind==='draft')
 return latest&&!latest.appliedAt&&!latest.supersededAt&&latest.id!==editingMessageId.value?latest:null
})
const decisionQuestion=computed(()=>{
 if(!stepAvailable.value||pending.value)return null
 if(currentProposal.value)return {key:currentProposal.value.id,title:'这份备注草稿怎么处理？',context:`第 ${props.activeStepIndex+1} 步`,choices:[{id:'apply',label:'采用到本步骤'},{id:'revise',label:'继续修改'}]}
 if(opening.value&&!dismissedOpening.value&&!messages.value.some(message=>message.kind==='user'))return {key:`opening-${props.taskId}`,...opening.value}
 return null
})
let nonStepDraft='',highlightTimer,contextVersion=0
const snapshot=()=>({text:input.value,images:images.value.map(photo=>({...photo})),attachments:attachments.value.map(file=>({...file})),editingMessageId:editingMessageId.value})
function loadDraft(draft={}){input.value=draft.text||'';images.value=draft.images||[];attachments.value=draft.attachments||[];editingMessageId.value=draft.editingMessageId||''}
function saveStepDraft(){if(mode.value==='step')stepDrafts.set(stepIndex.value,snapshot())}
function setMode(next){
 if(mode.value==='step'&&next!=='step'){saveStepDraft();loadDraft({text:nonStepDraft})}
 mode.value=next;fileNotice.value=''
}
async function focusComposer(){
 composerHighlight.value=false;clearTimeout(highlightTimer);await nextTick()
 inputEl.value?.scrollIntoView({block:'nearest'});inputEl.value?.focus({preventScroll:true})
 composerHighlight.value=true;highlightTimer=setTimeout(()=>{composerHighlight.value=false},1200)
}
function assistStep(index,focus=true){
 if(!stepAvailable.value||!Number.isInteger(index)||!task.value?.steps?.[index]){submitError.value='当前任务不能使用步骤协助。';return false}
 if(index!==props.activeStepIndex){submitError.value=`请先返回第 ${index+1} 步，再继续本步骤协助。`;return false}
 if(mode.value!=='step'||stepIndex.value!==index){
  const previousMode=mode.value,saved=stepDrafts.get(index)
  if(previousMode==='step')saveStepDraft();else nonStepDraft=input.value
  loadDraft(saved||{text:previousMode==='step'?'':nonStepDraft})
  if(!saved&&previousMode!=='step')nonStepDraft=''
  stepIndex.value=index;mode.value='step'
 }
 submitError.value='';fileNotice.value='';if(focus)void focusComposer();return true
}
function reviseStep(message){if(assistStep(message.stepIndex))editingMessageId.value=message.id}
function applyStepNote(messageId){submitError.value='';try{store.applyStepNote(props.event.id,props.taskId,messageId);following.value=true;nextTick(follow)}catch(error){submitError.value=error.message}}
function confirmQuestion(choice){
 if(pending.value||readingFiles.value)return
 if(currentProposal.value){if(choice==='apply')applyStepNote(currentProposal.value.id);else if(choice==='revise')reviseStep(currentProposal.value);return}
 const option=opening.value?.choices.find(item=>item.id===choice)
 if(!option)return
 // A prepared message or uploaded material remains in the composer until sent.
 if(hasMessage.value){dismissedOpening.value=true;void focusComposer();return}
 void ask(option.prompt)
}
function customQuestion(){if(currentProposal.value)reviseStep(currentProposal.value);else{dismissedOpening.value=true;void focusComposer()}}
const speech=ref({listening:false,stopping:false,interim:'',error:''})
const voice=createSpeechDraftInput({readDraft:()=>input.value,writeDraft:text=>input.value=text,disabled:()=>!!pending.value,onChange:state=>speech.value=state})
watch(pending,value=>{if(value)voice.cancel()})
onBeforeUnmount(()=>{contextVersion++;voice.dispose();clearTimeout(highlightTimer)})
function follow(){if(following.value&&stream.value)stream.value.scrollTo({top:stream.value.scrollHeight,behavior:'smooth'})}
async function ask(text){
 if(pending.value||readingFiles.value||(!text.trim()&&!(mode.value==='step'&&(images.value.length||attachments.value.length))))return
 if(mode.value==='chat'&&stepAvailable.value&&Number.isInteger(props.activeStepIndex)&&task.value?.steps?.[props.activeStepIndex]){
  // Route the visible draft, without restoring another cached step draft or
  // borrowing any text or photographs from a previously visited step.
  mode.value='step';stepIndex.value=props.activeStepIndex;nonStepDraft=''
 }
 const selectedMode=mode.value,selectedIndex=stepIndex.value,version=contextVersion
 if(selectedMode==='step'&&(!stepAvailable.value||selectedIndex!==props.activeStepIndex)){submitError.value='当前步骤已切换，请从当前步骤重新开启协助。';return}
 voice.cancel();submitError.value='';fileNotice.value='';following.value=true
 const sent={...snapshot(),text};loadDraft()
 try{
  if(selectedMode==='step')await store.assistStep(props.event.id,props.taskId,selectedIndex,text,{images:sent.images,attachments:sent.attachments})
  else await store.ask(props.event.id,text,{mode:selectedMode,reportId:targetReport.value,taskId:props.taskId,phaseId:props.phaseId})
 }catch(error){
  if(version!==contextVersion)return
  submitError.value=error.message
  if(selectedMode==='step'&&(mode.value!=='step'||selectedIndex!==stepIndex.value)){
   const current=stepDrafts.get(selectedIndex)||{}
   stepDrafts.set(selectedIndex,restoreSentDraft(sent,current))
  }else loadDraft(restoreSentDraft(sent,snapshot()))
 }
 nextTick(follow)
}
function restoreSentDraft(sent,current){return {text:[sent.text,current.text].filter(Boolean).join('\n'),images:[...sent.images,...(current.images||[])].filter((photo,i,list)=>list.findIndex(item=>item.dataUrl===photo.dataUrl)===i),attachments:[...sent.attachments,...(current.attachments||[])].filter((file,i,list)=>list.findIndex(item=>item.name===file.name&&item.text===file.text)===i),editingMessageId:current.editingMessageId||sent.editingMessageId}}
function askFollowup(text){if(mode.value==='step'&&hasMessage.value){input.value=[input.value,text].filter(Boolean).join('\n');void focusComposer();return}if(mode.value!=='step')setMode('chat');return ask(text)}
function apply(messageId){submitError.value='';try{const report=store.applySupplement(props.event.id,messageId,props.taskId);emit('report',report.id)}catch(e){submitError.value=e.message}}
watch(()=>[props.taskId,task.value?.status],()=>{if(props.taskId&&['reporting','report-error','submitted'].includes(task.value?.status))void revealReport()},{immediate:true})
watch(()=>messages.value.length,(count,previous)=>{if(count>previous){following.value=true;nextTick(follow)}})
watch(()=>{const m=messages.value.at(-1);return [m?.text,m?.response?.text,m?.response?.note,m?.draft?.patch,m?.generatedReport,m?.taskDraft,m?.progress,m?.progressLog?.length,m?.progressLog?.at(-1)?.label,m?.status]},()=>nextTick(follow))
watch(()=>props.activeStepIndex,index=>{if(stepAvailable.value&&stepIndex.value!==index){voice.cancel();assistStep(index,false)}})
watch(stepAvailable,available=>{if(available)assistStep(props.activeStepIndex,false);else if(mode.value==='step'){voice.cancel();setMode('chat')}},{immediate:true})
watch(()=>[props.event.id,props.taskId,store.state.role,closed.value],()=>{contextVersion++;voice.cancel();following.value=false;loadDraft();stepDrafts.clear();nonStepDraft='';fileNotice.value='';mode.value='chat';submitError.value='';dismissedOpening.value=false;imageDialog.value?.close();if(stepAvailable.value)assistStep(props.activeStepIndex,false);nextTick(()=>{if(stream.value)stream.value.scrollTop=0})})
function choosePhoto(){if(!stepAvailable.value){fileNotice.value='当前任务已不可填写，可在报告中补充现场资料。';return}if(mode.value!=='step')assistStep(props.activeStepIndex,false);photoUpload.value?.click()}
function draftDestination(){return {version:contextVersion,index:stepIndex.value,mode:mode.value}}
function matchingDestination(destination){return destination.version===contextVersion&&destination.mode===mode.value&&(destination.mode!=='step'||destination.index===stepIndex.value)}
async function attach(ev){
 const files=Array.from(ev.target.files||[]),destination=draftDestination();ev.target.value=''
 if(!files.length||pending.value||readingFiles.value)return
 fileNotice.value='';readingFiles.value=true
 try{
  if(destination.mode==='step'){
   if(!stepAvailable.value)throw Error('当前任务已不可填写。')
   if(attachments.value.length+files.length>STEP_ASSIST_LIMITS.maxAttachments)throw Error('每次最多添加 3 份文字附件。')
   const added=[]
   for(const file of files){
    if(file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的文字记录。')
    const text=await file.text()
    if(!text.trim()||text.length>STEP_ASSIST_LIMITS.maxAttachmentChars)throw Error('文字附件不能为空，且每份不超过 20,000 字符。')
    added.push({name:file.name,text})
   }
   if(matchingDestination(destination))attachments.value.push(...added)
   else if(destination.version===contextVersion){const draft=stepDrafts.get(destination.index)||{};stepDrafts.set(destination.index,{...draft,attachments:[...(draft.attachments||[]),...added]})}
  }else{
   const file=files[0];if(file.size>2*1024*1024)throw Error('请选择不超过 2 MB 的文字记录。')
   const text=await file.text()
   if(matchingDestination(destination)){input.value=[input.value,text].filter(Boolean).join('\n');fileNotice.value='文件内容已加入会话草稿'}
  }
 }catch(error){if(destination.version===contextVersion)fileNotice.value=error.message}finally{readingFiles.value=false}
}
async function attachPhotos(ev){
 const files=Array.from(ev.target.files||[]),destination=draftDestination();ev.target.value=''
 if(!files.length||pending.value||readingFiles.value)return
 if(mode.value!=='step'||!stepAvailable.value){fileNotice.value='当前任务已不可填写。';return}
 fileNotice.value='';readingFiles.value=true
 try{
  if(images.value.length+files.length>STEP_ASSIST_LIMITS.maxImages)throw Error('每次最多添加 4 张照片。')
  for(const file of files){if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPEG 或 WebP 照片。');if(file.size>STEP_ASSIST_LIMITS.maxImageBytes)throw Error('单张照片不能超过 3 MB。')}
  const added=await Promise.all(files.map(file=>prepareStepPhoto(file)))
  if(destination.version!==contextVersion)return
  const existing=matchingDestination(destination)?images.value:stepDrafts.get(destination.index)?.images||[]
  if([...existing,...added].reduce((sum,photo)=>sum+stepPhotoBytes(photo),0)>STEP_ASSIST_LIMITS.maxTotalImageBytes)throw Error('上传照片合计不能超过 6 MB。')
  if(matchingDestination(destination)){images.value.push(...added);if(added.some(isStepPhotoCopy))fileNotice.value='大照片已生成上传压缩副本，原文件保留；预览与发送内容一致。'}
  else if(destination.version===contextVersion){const draft=stepDrafts.get(destination.index)||{};stepDrafts.set(destination.index,{...draft,images:[...(draft.images||[]),...added]})}
 }catch(error){if(destination.version===contextVersion)fileNotice.value=error.message}finally{readingFiles.value=false}
}
async function previewImage(photo){selectedImage.value=photo;await nextTick();imageDialog.value?.showModal()}
function closeImageBackdrop(ev){if(ev.target===imageDialog.value)imageDialog.value.close()}
</script>

<style scoped>
.lc-composer footer{justify-content:flex-start;gap:7px}.lc-composer footer .composer-send{margin-left:auto}.lc-composer footer .composer-voice[aria-pressed=true]{background:#f9e9e5;color:#b55f51}.composer-voice-status,.composer-voice-error,.composer-file-notice{display:block;margin-top:6px;font-size:11px;line-height:1.5;color:#7d8b9d;overflow-wrap:anywhere}.composer-voice-error,.composer-file-notice{color:#b47546}
.task-assistant-intro p{margin:0 0 8px}.task-assistant-intro p:last-child{margin-bottom:0}
.lc-message p,.lc-message :deep(p){text-align:justify;text-align-last:left;overflow-wrap:anywhere}
.lc-message>time{text-align:left!important}.lc-conversation .lc-message :deep(.assistant-basis-content){background:transparent}

.lc-assistant>header{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.lc-assistant>header small{grid-column:1/-1}.lc-assistant>header .assistant-collapse{justify-self:end;width:auto;padding:4px 8px;border:0;background:transparent;font-size:12px}
.assistant-heading{display:flex;align-items:center;gap:10px;min-width:0}
.lc-assistant .lc-conversation .lc-message.step-assist-user{background:#edf5ff;border:1px solid #dce9f5;color:#3e576e;border-radius:11px 11px 3px 11px}.lc-assistant .lc-conversation .lc-message.step-assist,.lc-assistant .lc-conversation .lc-message.task-assistant-intro{padding:13px 14px;margin:12px 12px 16px 0;background:#f0f7f1;border:1px solid #deeadf;border-radius:11px 11px 11px 3px;color:#435d4a}.lc-assistant .lc-conversation .lc-message.task-assistant-intro{margin-top:0}
.message-images,.composer-images{display:flex;gap:7px;overflow-x:auto;padding:4px 0}.message-images button,.composer-images .image-thumbnail{display:block;width:70px;height:70px;padding:0;overflow:hidden;border:1px solid #dbe3dc;border-radius:7px;background:#fff;flex:none}.message-images img,.composer-images img{width:100%;height:100%;object-fit:cover;display:block}.message-images>div,.composer-images>div{position:relative;flex:none;width:70px}.message-images small,.composer-images small{display:block;font-size:10px;line-height:1.5;color:#778577;text-align:center;margin-top:3px}.composer-images .remove-material{position:absolute;right:3px;top:3px;width:20px;height:20px;padding:0;background:#ffffffed;border:1px solid #dbe1db;border-radius:50%;font-size:14px;line-height:1;color:#5a665c}.composer-files,.message-files{list-style:none;padding:0;margin:7px 0;font-size:11px;color:#6c7c71}.composer-files li{display:flex;align-items:center;gap:8px;padding:3px 0}.composer-files span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.composer-files button{margin-left:auto;flex:none;padding:0 5px;border:0;background:transparent;color:#6d7f71}.message-files li{overflow-wrap:anywhere}
.step-image-preview{max-width:min(92vw,1100px);max-height:90vh;padding:14px;border:1px solid #d8dfd8;border-radius:10px;background:#fff}.step-image-preview::backdrop{background:#15231ec2}.step-image-preview header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px}.step-image-preview strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.step-image-preview img{display:block;max-width:100%;max-height:76vh;object-fit:contain;margin:auto}.step-image-preview button{flex:none;font-size:12px}
.lc-composer.step-focus{animation:step-composer-focus 1.2s ease-out}@keyframes step-composer-focus{0%,25%{border-color:#b39a68;box-shadow:0 0 0 4px #b3945a2e,0 3px 12px #29332108}100%{border-color:#c3ac7d;box-shadow:0 0 0 3px #b3945a17,0 3px 12px #29332108}}@media(prefers-reduced-motion:reduce){.lc-composer.step-focus{animation:none}}
.lc-chat-mode{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.lc-chat-mode button{font-size:11px;padding:4px 8px;border:1px solid #e0e5eb;background:#fff;color:#8390a0;border-radius:5px;cursor:pointer}.lc-chat-mode button[aria-pressed=true]{color:#96723e;background:#fbf7ef;border-color:#dac8a8}.lc-chat-mode select{width:100%;font-size:11px;padding:5px;border:1px solid #e3e7ec;border-radius:4px;color:#687b92}.lc-model-status,.lc-model-error{font-size:12px;line-height:1.6;color:#8490a0;padding:8px 0}.lc-model-error{color:#b47546}.lc-composer button:disabled{opacity:.4;cursor:wait}
</style>
