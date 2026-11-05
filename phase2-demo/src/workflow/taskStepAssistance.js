import {buildStepAssistRequest,canUseStepAssist,normalizeStepAssistResult,STEP_ASSIST_LIMITS} from './stepAssistContract.js'
import {taskConversation} from './lifecycleWorkItems.js'
import {lifecycleSnapshot} from './demoTimeline.js'

const copy=value=>JSON.parse(JSON.stringify(value))
const signature=step=>JSON.stringify(step)
const now=()=>new Date().toISOString()
const requestKey=(eventId,role,taskId)=>`${eventId}:${role}:${taskId}`
function context(state,eventId,taskId,stepIndex,role=state.role){
 const event=state.events[eventId],task=event?.tasks.find(item=>item.id===taskId)
 if(!canUseStepAssist(event,task,role))throw Error('当前任务或身份不能使用步骤协助。')
 if(!Number.isInteger(stepIndex)||!task.steps[stepIndex]||!task.draft?.records[stepIndex])throw Error('找不到当前协助步骤。')
 return {event,task,record:task.draft.records[stepIndex],conversation:taskConversation(task,role)}
}

export async function assistTaskStep(state,eventId,taskId,stepIndex,text,uploads,request,pendingRequests={}){
 const role=state.role,key=requestKey(eventId,role,taskId)
 if(pendingRequests[key])throw Error('助手正在处理上一条消息，请稍候。')
 const {event,task,record,conversation}=context(state,eventId,taskId,stepIndex,role)
 if((task.draft.stepIndex||0)!==stepIndex)throw Error('请先返回对应步骤，再开启 AI 协助。')
 const history=conversation.filter(m=>['user','model','advice','step-assist'].includes(m.kind)&&m.status!=='interrupted'&&m.status!=='streaming').slice(-STEP_ASSIST_LIMITS.maxHistory).map(m=>({
  eventId,taskId,stepIndex:Number.isInteger(m.stepIndex)?m.stepIndex:null,role:m.kind==='user'?'user':'assistant',
  text:m.kind==='step-assist'?[m.response?.text,m.response?.note].filter(Boolean).join('\n'):m.text||'',
  ...(m.source?{source:m.source}:{}),
  ...(m.kind==='user'?{images:m.images||[],attachments:m.attachments||[]}:{})
 }))
 const body=buildStepAssistRequest({event,task,stepIndex,role,text,history,images:uploads?.images||[],attachments:uploads?.attachments||[]})
 // Leave room for subsequent text edits in the existing local demo storage.
 const estimated=2*(lifecycleSnapshot(state)+JSON.stringify({images:body.images,attachments:body.attachments})).length
 if(estimated>4*1024*1024)throw Error('演示记录中的图片较大，请压缩图片后重试；现有备注和对话未修改。')
 const at=now(),replyId=crypto.randomUUID(),baseNote=record.note||'',baseResult=record.result||'',baseExecutionStatus=record.executionStatus||'',baseStep=signature(task.steps[stepIndex])
 conversation.push({id:crypto.randomUUID(),kind:'user',text:text.trim(),at,stepAssistance:true,stepIndex,images:copy(body.images||[]),attachments:copy(body.attachments||[])})
 conversation.push({id:replyId,kind:'step-assist',stepIndex,baseNote,baseResult,baseExecutionStatus,baseStep,at,status:'streaming',response:null,progress:'正在整理本步骤的现场信息…'})
 const locate=()=>state.events[eventId]?.tasks.find(t=>t.id===taskId)?.conversations?.[role]?.find(m=>m.id===replyId)
 pendingRequests[key]=true
 try{
  const result=await request(body,(kind,data)=>{const m=locate();if(m&&kind==='progress')m.progress=data.label||'正在整理本步骤的现场信息…'})
  const response=normalizeStepAssistResult(result.stepAssist),message=locate()
  if(!message)return null
  const latest=state.events[eventId]?.tasks.find(t=>t.id===taskId)
  if(!canUseStepAssist(state.events[eventId],latest,role)||signature(latest.steps[stepIndex])!==baseStep)throw Error('任务范围或状态已变化，请回到当前步骤重新协助。')
  Object.assign(message,{response,status:'complete',source:result.source||'model',model:result.model,usage:result.usage,sources:result.sources||[],at:now()})
  for(const old of latest.conversations[role])if(old.id!==replyId&&old.kind==='step-assist'&&old.stepIndex===stepIndex&&old.response?.kind==='draft'&&!old.appliedAt)old.supersededAt=message.at
  return message
 }catch(error){const message=locate();if(message)Object.assign(message,{status:'interrupted',modelError:error.message});throw error}
 finally{delete pendingRequests[key]}
}

export function applyTaskStepNote(state,eventId,taskId,messageId,pendingRequests={}){
 const task=state.events[eventId]?.tasks.find(t=>t.id===taskId),message=task?.conversations?.[state.role]?.find(m=>m.id===messageId)
 if(!message||message.kind!=='step-assist'||message.status!=='complete'||message.response?.kind!=='draft')throw Error('找不到可采用的本步骤备注草稿。')
 const {record,conversation}=context(state,eventId,taskId,message.stepIndex)
 if(pendingRequests[requestKey(eventId,state.role,taskId)])throw Error('请等待本次协助完成后再采用。')
 if((task.draft.stepIndex||0)!==message.stepIndex)throw Error(`请先回到左侧第 ${message.stepIndex+1} 步，再采用该草稿。`)
 if(message.appliedAt)throw Error('本草稿已经采用，请勿重复写入。')
 if(message.supersededAt)throw Error('已有更新的协助内容，请核对最新草稿。')
 const resultChanged=Object.hasOwn(message,'baseResult')&&(record.result||'')!==message.baseResult
 const executionChanged=Object.hasOwn(message,'baseExecutionStatus')&&(record.executionStatus||'')!==message.baseExecutionStatus
 if(signature(task.steps[message.stepIndex])!==message.baseStep||(record.note||'')!==message.baseNote||resultChanged||executionChanged)throw Error('步骤或现场记录已被修改，请点击“继续修改”重新整理，避免覆盖新记录。')
 const note=normalizeStepAssistResult(message.response).note
 record.note=note;task.draft.updatedAt=now();message.appliedAt=task.draft.updatedAt
 const next=task.steps[message.stepIndex+1],nextStep=next?{index:message.stepIndex+1,title:next.label,summary:(next.substeps?.length?next.substeps.map(part=>part.label).join('、'):next.guide||next.checks?.[0]||'按步骤要求记录实际发现。').slice(0,140)}:null
 const text=nextStep?`本步骤备注已记录，请核对左侧${task.kind==='investigation'?'检查结果':'作业反馈'}。您可以点击“下一步”继续；下一步主要是${nextStep.title}：${nextStep.summary}`:'本步骤备注已记录。请核对各步骤结果和备注，确认后点击左侧“提交报告”，生成本轮报告。'
 conversation.push({id:crypto.randomUUID(),kind:'step-assist',stepIndex:message.stepIndex,status:'complete',at:now(),response:{kind:'receipt',text}})
 return {stepIndex:message.stepIndex,nextStep}
}
