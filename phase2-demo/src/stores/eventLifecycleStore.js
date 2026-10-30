import {defineStore} from 'pinia'
import {reactive,computed,watch} from 'vue'
import {createLifecycleState,visibleEvents,pendingDecision,activeTask,decide,askAssistant,people,refreshLifecyclePresentation,ensureTaskPlan} from '../workflow/eventLifecycle.js'
import {useSensorStore} from './sensorStore'
import {syncLifecycleObservations} from '../workflow/lifecycleObservation.js'
import {aiStreamRequest} from '../services/aiClient'
import {supplementaryReports,applyReportSupplement} from '../workflow/reportRevisions'
import {acceptTaskPlan} from '../workflow/taskPlanning.js'
import {updateObservationAdvice} from '../workflow/observationAdvice.js'
import {lifecycleWorkItems,lifecycleNotifications,canViewTask,taskConversation,taskTitle} from '../workflow/lifecycleWorkItems.js'
import {generateTaskReport,recoverTaskReportGeneration} from '../workflow/taskReportGeneration.js'
import {observationTaskFor} from '../workflow/observationContext.js'
import {suggestionAction} from '../workflow/lifecycleDecisions.js'
const storageKey='engine-room-captain-workflow-v1',roleKey='engine-room-current-role'
export const useEventLifecycleStore=defineStore('event-lifecycle',()=>{
 let reportSession=crypto.randomUUID();try{reportSession=sessionStorage.getItem('engine-room-report-session')||reportSession;sessionStorage.setItem('engine-room-report-session',reportSession)}catch{}
 let initial=createLifecycleState()
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.version===1&&Object.keys(initial.events).every(id=>saved.events?.[id]))initial=saved;const role=sessionStorage.getItem(roleKey);if(['captain','engineer'].includes(role))initial.role=role}catch{}
 refreshLifecyclePresentation(initial)
 recoverTaskReportGeneration(initial,reportSession)
 for(const event of Object.values(initial.events))for(const messages of Object.values(event.conversations))for(const message of messages)if(message.status==='streaming'){
  message.status='interrupted';message.text='';message.modelError='上次生成已中断，请重新发送。原报告未修改。'
 }
 for(const event of Object.values(initial.events))for(const task of event.tasks)for(const messages of Object.values(task.conversations||{}))for(const message of messages)if(message.status==='streaming'&&(!message.generatedReport||task.status!=='reporting')){message.status='interrupted';message.modelError='上次生成已中断，请重新发送。原报告未修改。';delete message.draft}
 initial.notices||=[];initial.role||='captain'
 for(const event of Object.values(initial.events))if(['generating','updating'].includes(event.pendingPlan?.status))event.pendingPlan.status=event.pendingPlan.source==='preset'?'pending':event.pendingPlan.steps?.length?'ready':'pending'
 const state=reactive(initial)
 const sensors=useSensorStore(),syncObservations=()=>syncLifecycleObservations(state,sensors,Date.now(),{demo:true})
 watch(()=>sensors.sampledAt,syncObservations,{immediate:true})
 const snapshot=()=>JSON.stringify({version:1,events:state.events,notices:state.notices})
 let lastStored=snapshot()
 watch(()=>[state.events,state.notices],()=>{const value=snapshot();if(value!==lastStored)try{lastStored=value;localStorage.setItem(storageKey,value)}catch{}},{deep:true})
 // Each browser tab keeps its role; only shared workflow data crosses tabs.
 window.addEventListener('storage',event=>{
  if(event.key!==storageKey||!event.newValue)return
  try{const incoming=JSON.parse(event.newValue);if(incoming.version!==1||!Object.keys(state.events).every(id=>incoming.events?.[id]))return
   refreshLifecyclePresentation(incoming)
   lastStored=JSON.stringify({version:1,events:incoming.events,notices:incoming.notices||[]});state.events=incoming.events;state.notices=incoming.notices||[]
  }catch{}
 })
 const events=computed(()=>visibleEvents(state)),pending=computed(()=>events.value.filter(pendingDecision)),tasks=computed(()=>events.value.filter(e=>activeTask(e))),reports=computed(()=>events.value.flatMap(e=>e.reports).sort((a,b)=>b.at.localeCompare(a.at)))
 const workItems=computed(()=>lifecycleWorkItems(state)),notifications=computed(()=>lifecycleNotifications(state))
 const unread=computed(()=>workItems.value.pending.length)
 const notices=computed(()=>state.notices.filter(n=>n.recipient===state.role&&!n.read))
 function setRole(role){if(['captain','engineer'].includes(role)){state.role=role;try{sessionStorage.setItem(roleKey,role)}catch{}}}
 function markRead(id){if(state.events[id])state.events[id].unread[state.role]=false}
 function acknowledge(id){markRead(id);state.notices.filter(n=>n.eventId===id&&n.recipient===state.role).forEach(n=>n.read=true)}
 const pendingRequests=reactive({})
 const planRequests=new Map()
 function modelEvent(event){return {id:event.id,title:event.title,tracking:event.tracking,phase:event.phase,phases:event.phases.slice(-1),decisionDraft:{action:event.decisionDraft?.action},currentTask:event.currentTask,number:event.number,brief:event.brief,reports:event.reports.map(r=>({id:r.id,kind:r.kind,summary:r.summary,markdown:r.markdown})),tasks:event.tasks.map(t=>({id:t.id,kind:t.kind,purpose:t.purpose,status:t.status,scope:t.scope,summary:t.summary,steps:t.steps,records:t.records,maintenance:t.maintenance,observationMode:t.observationMode,observationStartedAt:t.observationStartedAt,submittedAt:t.submittedAt}))}}
 function prepareTaskPlan(id,{retry=false,editText='',onProgress}={}){
  const event=state.events[id],draft=event&&suggestionAction(event)&&ensureTaskPlan(event)
  if(!draft)return Promise.resolve(null)
  const requestKey=draft.key
  if(planRequests.has(requestKey))return planRequests.get(requestKey)
  if(!editText&&(draft.status==='ready'&&!retry||draft.status==='error'&&!retry))return Promise.resolve(null)
  if(editText&&draft.status!=='ready')return Promise.reject(Error('请等待待派任务生成完成后再修改。'))
  const before=JSON.parse(JSON.stringify({scope:draft.scope,rationale:draft.rationale,steps:draft.steps}))
  const expected={key:draft.key,version:draft.version,...(editText?{editText,plan:before}:{})},previousStatus=draft.status,requestId=crypto.randomUUID()
  draft.status=editText?'updating':'generating';draft.error='';draft.preview=null;draft.requestId=requestId
  const run=(async()=>{
   try{
    const work=observationTaskFor(event)
    const result=await aiStreamRequest({mode:'plan',planMode:editText?'edit':'generate',role:'captain',actor:people.captain,text:editText||'请依据已提交的逐项记录与历轮报告预生成下一步任务，说明已经排除的方向、尚存疑点和验证方法。',event:modelEvent(event),plan:{action:draft.action,...before},observations:work?.observation?{records:work.observation.records.slice(-3),pending:work.observation.pending}:null},(kind,data)=>{
     const current=state.events[id]?.pendingPlan
     if(current?.requestId!==requestId||current.key!==expected.key)return
     if(kind==='plan')current.preview=data.plan
     if(kind==='progress')current.progress=data
     onProgress?.(kind,data)
    })
    const currentEvent=state.events[id]
    if(currentEvent?.pendingPlan?.requestId!==requestId)throw Error('待派任务已有新的修改，本次结果未覆盖当前任务。')
    const accepted=acceptTaskPlan(currentEvent,expected,result)
    return {draft:accepted,result}
   }catch(error){
    const current=state.events[id]?.pendingPlan
    if(current?.key===expected.key&&current.requestId===requestId){current.status=previousStatus==='ready'||current.source==='preset'&&current.steps.length?'ready':'error';current.error=error.message;current.preview=null}
    throw error
   }finally{planRequests.delete(requestKey)}
  })()
  planRequests.set(requestKey,run);return run
 }
 async function askPlan(id,text){
  const event=state.events[id],draft=event&&suggestionAction(event)&&ensureTaskPlan(event),key=id+':captain'
  if(state.role!=='captain'||!draft)throw Error('当前身份或阶段不能修改待派任务。')
  if(pendingRequests[key])return
  if(draft.status!=='ready')throw Error('请等待待派任务生成完成后再修改。')
  const at=new Date().toISOString(),replyId='plan-'+crypto.randomUUID()
  event.conversations.captain.push({id:crypto.randomUUID(),kind:'user',text:text.trim(),at},{id:replyId,kind:'model',text:'',at,status:'streaming',progress:{label:'正在提交任务修改请求'},progressLog:[],taskDraft:{scope:'',rationale:''}})
  const reply=()=>state.events[id]?.conversations.captain.find(m=>m.id===replyId)
  pendingRequests[key]=true
  try{
   const {draft:updated,result}=await prepareTaskPlan(id,{editText:text,onProgress:(kind,data)=>{const m=reply();if(m&&kind==='plan')m.taskDraft=data.plan;if(m&&kind==='progress'){m.progress=data;m.progressLog.push(data)}}})
   const m=reply();Object.assign(m,{status:'complete',text:updated.editHistory.at(-1).summary,taskChange:{scope:updated.scope,rationale:updated.rationale,steps:updated.steps},usage:result.usage,sources:result.sources});delete m.taskDraft
  }catch(error){const m=reply();if(m){m.status='interrupted';m.modelError=error.message+(error.message.includes('原待派任务未修改')?'':' 原待派任务未修改。');delete m.taskDraft}}
  finally{delete pendingRequests[key]}
 }
 async function ask(id,text,{mode='chat',reportId,taskId}={}){
  if(taskId&&mode==='plan')throw Error('任务已派发，不能在执行页面修改派发范围。')
  if(mode==='plan')return askPlan(id,text)
  const event=state.events[id],role=state.role,key=id+':'+role+(taskId?':'+taskId:'')
  if(!event||pendingRequests[key]||!text.trim())return
  if(role!=='captain'&&!event.participants.includes(people.engineer))throw Error('当前身份无权访问该事件。')
  const task=taskId?event.tasks.find(t=>t.id===taskId):null
  if(taskId&&!canViewTask(role,task))throw Error('当前身份无权访问该任务。')
  const editable=supplementaryReports(event,role).filter(r=>!taskId||r.taskId===taskId),report=editable.find(r=>r.id===reportId)||editable.at(-1)
  if(mode==='report'&&!report)throw Error('没有可补充的本人已提交报告。')
  const at=new Date().toISOString(),requestId='chat-'+crypto.randomUUID(),conversation=task?taskConversation(task,role):event.conversations[role]
  conversation.push({id:requestId,kind:'user',text:text.trim(),at})
  const baseMarkdown=report?.markdown
  const history=conversation.slice(-9,-1).map(m=>({role:m.kind==='user'?'user':'assistant',text:m.text||m.analysis||''}))
  const replyId='reply-'+requestId,reply=()=>{const current=state.events[id],messages=taskId?current?.tasks.find(t=>t.id===taskId)?.conversations?.[role]:current?.conversations[role];return messages?.find(m=>m.id===replyId)}
  conversation.push({id:replyId,kind:'model',text:'',at,status:'streaming',progress:{label:'正在提交请求'},progressLog:[],...(mode==='report'?{draft:{reportTitle:report.title,baseMarkdown,patch:{summary:'',analysis:{}}}}:{})})
  pendingRequests[key]=true
  let queuedText='',queuedPatch=null,progressTimer
  function flushProgress(){
   clearTimeout(progressTimer);progressTimer=null
   const message=reply();if(!message)return
   if(queuedText){message.text+=queuedText;queuedText=''}
   if(queuedPatch){message.draft.patch=queuedPatch;queuedPatch=null}
  }
  try{
   const context=modelEvent(event)
   if(task){context.currentTask=task.id;context.tasks=context.tasks.filter(t=>t.id===task.id).map(t=>({...t,records:task.status==='assigned'?task.draft.records:task.records}));context.reports=context.reports.filter(r=>r.id===task.sourceReportId||event.reports.find(x=>x.id===r.id)?.taskId===task.id);context.taskContext={title:taskTitle(task),scope:task.scope,owner:task.owner,instruction:'仅回答本任务的范围、步骤与结果，不改写其他轮次任务或代替轮机长决策。'}}
   const result=await aiStreamRequest({text,mode,role,actor:people[role],event:context,history,...(mode==='report'?{report:{id:report.id,taskId:report.taskId,eventId:report.eventId,kind:report.kind,owner:report.owner,summary:report.summary,markdown:baseMarkdown}}:{})},(kind,data)=>{
    const message=reply();if(!message)return
    if(kind==='meta')message.sources=data.sources
    if(kind==='progress'){message.progress=data;message.progressLog.push(data)}
    if(kind==='text')queuedText+=data.delta||''
    if(kind==='report'&&mode==='report')queuedPatch=data.patch
    if(!progressTimer)progressTimer=setTimeout(flushProgress,45)
   })
   flushProgress()
   const message=reply();if(!message)return
   Object.assign(message,{status:'complete',text:result.answer||'已根据补充内容整理报告修订稿，请核对后写入。',at:new Date().toISOString(),model:result.model,sources:result.sources,usage:result.usage})
   if(mode==='report')message.proposal={id:requestId,reportId:report.id,reportTitle:report.title,baseMarkdown,patch:result.patch,text,model:result.model,sources:result.sources,applied:false}
   delete message.draft
  }catch(error){
   flushProgress()
   const message=reply()
   if(message){message.status='interrupted';message.modelError=error.message+(mode==='report'?' 原报告未修改，补充原文已保留在会话中。':' 回答尚未完成，请重试。')}
   if(mode!=='report'&&!message?.text){if(task&&message){message.text='本次任务范围：'+task.scope+' 请按本次步骤记录实际结果，未确认内容保留在备注中。';message.modelError=error.message+' 以下为已派发任务信息。'}else{const messages=state.events[id]?.conversations[role];if(message)messages.splice(messages.indexOf(message),1);askAssistant({...state,role},id,text,{skipUser:true});messages.at(-1).modelError=error.message+' 以下为现有规则建议。'}}
  }finally{clearTimeout(progressTimer);delete pendingRequests[key]}
 }
 function applySupplement(id,messageId,taskId){const event=state.events[id],task=event?.tasks.find(t=>t.id===taskId),message=(taskId?task?.conversations?.engineer:event?.conversations.engineer)?.find(m=>m.id===messageId);if(!message?.proposal||taskId&&event.reports.find(r=>r.id===message.proposal.reportId)?.taskId!==taskId)throw Error('找不到本任务的修订稿。');return applyReportSupplement(state,id,message.proposal)}
 async function submit(id,taskId){const report=await generateTaskReport(state,id,taskId,aiStreamRequest,{ownerSession:reportSession});syncObservations();acknowledge(id);void prepareTaskPlan(id).catch(()=>{});return report}
 return {state,events,pending,tasks,reports,workItems,notifications,unread,notices,people,pendingRequests,prepareTaskPlan,refreshObservations:syncObservations,setRole,markRead,acknowledge,ask,applySupplement,updateObservationAdvice:(id,phaseId,patch)=>updateObservationAdvice(state,id,phaseId,patch),decide:(id,f)=>{syncObservations();decide(state,id,f);syncObservations();acknowledge(id)},submit}
})
