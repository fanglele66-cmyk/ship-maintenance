import {ownsTask,people} from './lifecyclePermissions.js'

export const MAX_STEP_FOLLOWUP_ROUNDS=3
// Hide conversation-control commentary while retaining the actual answer.
// Operational limits such as a pressure alarm or equipment cycle stay visible.
const roundComment=/followUpState|followUpRound|maxFollowUpRounds|limitReached|(?:追问|提问|补充确认).{0,8}(?:上限|限额|超限|额度|轮次|次数|已满|\d+\s*\/\s*\d+)|(?:停止|结束|不再|不会再|不能再|无法再|无需再|不再继续)(?:继续)?(?:追问|提问)|[一二三四五六七八九十\d]+\s*轮(?:追问|提问)|(?:本步|本步骤|当前步骤)(?:的)?(?:已(?:经)?)?(?:达(?:到)?|超(?:过)?|触发)(?:轮次|次数)?上限/
export function crewFacingStepText(value,{noQuestions=false}={}){
 const original=String(value||'')
 const cleaned=original.replace(/[^，,；;。！？!?\n]+[，,；;。！？!?\n]?/g,part=>{
  const asksCrew=noQuestions&&(/[？?]\s*$/.test(part)||/请(?:再|继续)?(?:告知|告诉我|回答|补充(?:说明|一下|具体情况|现场情况|读数|信息))/.test(part))
  return roundComment.test(part)||asksCrew?'':part
 })
 return cleaned===original?original:cleaned.trim().replace(/[,，;；]+$/,'。')
}
export const STEP_ASSIST_LIMITS=Object.freeze({maxImages:4,maxImageBytes:3*1024*1024,maxTotalImageBytes:6*1024*1024,maxAttachments:3,maxAttachmentChars:20000,maxTextChars:6000,maxHistory:100,maxFollowUpRounds:MAX_STEP_FOLLOWUP_ROUNDS})
export function stepFollowUpState(used=0){
 const max=MAX_STEP_FOLLOWUP_ROUNDS
 used=Number.isInteger(used)?Math.min(max,Math.max(0,used)):0
 return {used,max,remaining:max-used,limitReached:used===max}
}
export function completedStepQuestions(task,role,index){
 const turns=task?.conversations?.[role]||[]
 return turns.filter(turn=>turn.kind==='step-assist'&&turn.status==='complete'&&turn.stepIndex===index&&turn.response?.kind==='question'&&!turn.isOpening).length
}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const copy=value=>JSON.parse(JSON.stringify(value))
const bounded=(value,max,label,{optional=false}={})=>{
 if(optional&&(value===undefined||value===null))return ''
 if(typeof value!=='string'||value.length>max||(!optional&&!value.trim()))throw Error(label+'格式不正确或过长。')
 return value.trim()
}
const list=(value,label,max)=>{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>max)throw Error(label+'数量超出限制。')
 return value
}

export const isStepAssistEvent=event=>Boolean(event?.manualReport||event?.backendManaged||/^(manual-|detected-)/.test(event?.id||''))||['real-alarm-0430','real-warning-0523','real-tracking-exhaust-baseline','real-health-c4-baseline'].includes(event?.sourceEventId||event?.id)
export function canUseStepAssist(event,task,role){
 const current=Array.isArray(event?.tasks)?event.tasks.find(item=>item?.id===task?.id):null
 return Boolean(isStepAssistEvent(event)&&event.phase!=='closed'&&current&&event.currentTask===current.id&&current.status==='assigned'&&['investigation','repair','maintenance'].includes(current.kind)&&ownsTask(role,current))
}

function operation(value){
 if(!object(value))throw Error('当前步骤内容不完整。')
 return {label:bounded(value.label,300,'步骤标题'),guide:bounded(value.guide,2000,'步骤说明',{optional:true}),checks:list(value.checks,'步骤要求',20).map(item=>bounded(item,2000,'步骤要求')),recordHint:bounded(value.recordHint,2000,'回交要求',{optional:true})}
}

function image(value){
 if(!object(value)||!['image/png','image/jpeg','image/webp'].includes(value.mimeType))throw Error('仅支持 PNG、JPEG 或 WebP 图片。')
 const name=bounded(value.name,200,'图片名称'),url=value.dataUrl
 if(typeof url!=='string'||url.length>Math.ceil(STEP_ASSIST_LIMITS.maxImageBytes/3)*4+40)throw Error('单张图片不能超过 3 MB。')
 const match=url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
 if(!match||match[1]!==value.mimeType||match[2].length%4!==0)throw Error('图片内容或 MIME 类型不正确，请重新选择图片。')
 let bytes;try{bytes=atob(match[2])}catch{throw Error('图片内容无效，请重新选择图片。')}
 if(!bytes.length||bytes.length>STEP_ASSIST_LIMITS.maxImageBytes)throw Error('单张图片不能超过 3 MB。')
 const correct=value.mimeType==='image/png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):value.mimeType==='image/jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP'
 if(!correct)throw Error('图片实际格式与 MIME 类型不一致，请重新选择图片。')
 return {name,mimeType:value.mimeType,dataUrl:url,bytes:bytes.length}
}
const attachment=value=>{
 if(!object(value))throw Error('文字附件格式不正确。')
 return {name:bounded(value.name,200,'附件名称'),text:bounded(value.text,STEP_ASSIST_LIMITS.maxAttachmentChars,'文字附件')}
}

// This local prototype receives task state from the UI. Validate that snapshot,
// then send the selected writable step and this task's labelled conversation.
export function prepareStepAssistInput(input){
 if(input?.requestId!==undefined&&!/^[a-z\d-]{8,80}$/i.test(typeof input.requestId==='string'?input.requestId:''))throw Error('本次步骤协助的消息编号无效。')
 const event=input?.event,task=Array.isArray(event?.tasks)?event.tasks.find(item=>item?.id===input.taskId):null
 if(input?.mode!=='step-assist'||!canUseStepAssist(event,task,input.role)||input.actor!==people[input.role]||event.tasks.filter(item=>item.id===task.id).length!==1)throw Error('步骤协作仅用于本人当前执行的排查、维修或维保任务。')
 const index=input.stepIndex
 if(!Array.isArray(task.steps)||!Number.isInteger(index)||index<0||index>=task.steps.length)throw Error('请选择当前任务内的有效步骤。')
 if((task.draft?.stepIndex||0)!==index)throw Error('请先返回对应步骤，再开启步骤协作。')
 const rawStep=task.steps[index],step={...operation(rawStep),substeps:list(rawStep.substeps,'作业子项',12).map(operation)}
 const record=task.draft?.records?.[index]
 if(!object(record))throw Error('当前步骤的执行草稿不存在。')
 const result=bounded(record.result,100,'检查结果',{optional:true})
 if(result&&!rawStep.options?.includes(result))throw Error('当前步骤的检查结果无效。')
 const text=bounded(input.text,STEP_ASSIST_LIMITS.maxTextChars,'消息',{optional:true})
 const images=[],imageIndex=new Map(),files=new Map()
 function material(rawImages,rawAttachments){
  const refs=list(rawImages,'图片',STEP_ASSIST_LIMITS.maxImages).map(raw=>{
   const item=image(raw)
   if(!imageIndex.has(item.dataUrl)){imageIndex.set(item.dataUrl,images.length+1);images.push(item)}
   return {image:imageIndex.get(item.dataUrl),name:item.name,mimeType:item.mimeType}
  })
  const attachments=list(rawAttachments,'文字附件',STEP_ASSIST_LIMITS.maxAttachments).map(attachment)
  attachments.forEach(file=>files.set(file.name+'\n'+file.text,file))
  return {images:refs,attachments}
 }
 const history=list(input.history,'当前任务对话',STEP_ASSIST_LIMITS.maxHistory).filter(message=>object(message)&&message.eventId===event.id&&message.taskId===task.id&&['user','assistant'].includes(message.role)&&(message.stepIndex==null||Number.isInteger(message.stepIndex)&&message.stepIndex>=0&&message.stepIndex<task.steps.length)).map(message=>{
  const stepIndex=message.stepIndex??null
  const responseKind=message.role==='assistant'&&['answer','question','draft','receipt'].includes(message.responseKind)?message.responseKind:undefined
  const isOpening=message.role==='assistant'&&message.isOpening===true?true:undefined
  const choiceLabels=responseKind==='question'&&!isOpening?list(message.choiceLabels,'历史选项',4).map(text=>bounded(text,30,'历史选项')):[]
  return {role:message.role,...(['scripted-demo','model'].includes(message.source)?{source:message.source}:{}),...(responseKind?{responseKind}:{}),...(choiceLabels.length?{choiceLabels}:{}),...(isOpening?{isOpening}:{}),stepIndex,stepNumber:stepIndex===null?null:stepIndex+1,stepLabel:stepIndex===null?'':bounded(task.steps[stepIndex].label,300,'历史步骤标题'),scope:stepIndex===null?'task':stepIndex===index?'current-step':'other-step',text:bounded(message.text,STEP_ASSIST_LIMITS.maxTextChars,'历史消息',{optional:true}),...(message.role==='user'?material(message.images,message.attachments):{})}
 })
 const materials=material(input.images,input.attachments)
 if(images.length>STEP_ASSIST_LIMITS.maxImages||images.reduce((sum,item)=>sum+item.bytes,0)>STEP_ASSIST_LIMITS.maxTotalImageBytes)throw Error('本次任务上下文最多使用 4 张图片，合计不能超过 6 MB。')
 if(files.size>STEP_ASSIST_LIMITS.maxAttachments)throw Error('本次任务上下文最多使用 3 份文字附件。')
 if(!text&&!materials.images.length&&!materials.attachments.length)throw Error('请输入现场情况，或添加本步骤的图片、文字附件。')
 const photoNames=Array.isArray(record.photos)?list(record.photos,'步骤照片',STEP_ASSIST_LIMITS.maxImages).map(item=>bounded(item?.name?.slice(0,200),200,'照片名称')):[]
 const visibleQuestions=history.filter(item=>item.role==='assistant'&&item.scope==='current-step'&&item.responseKind==='question'&&!item.isOpening).length
 const followUpState=stepFollowUpState(Math.max(visibleQuestions,completedStepQuestions(task,input.role,index),stepFollowUpState(input.followUpUsed).used))
 return {
  context:{event:{id:event.id,sourceEventId:event.sourceEventId,title:bounded(event.title,500,'事件标题'),initialClue:bounded(event.brief?.discovery?.text,3000,'初始线索',{optional:true})},task:{id:task.id,kind:task.kind,title:bounded(task.title,500,'任务标题',{optional:true}),scope:bounded(task.scope,3000,'任务范围',{optional:true})},stepIndex:index,stepNumber:index+1,step,record:{result,note:bounded(record.note,12000,'步骤备注',{optional:true}),executionStatus:bounded(record.executionStatus,100,'执行情况',{optional:true}),...(photoNames.length?{photoNames}:{})},followUpState,history,message:{text,...materials}},
  images
 }
}

export function buildStepAssistRequest({event,task,stepIndex,role,text='',history=[],images=[],attachments=[]}){
 const selected=event?.tasks?.find(item=>item.id===task?.id)
 if(!canUseStepAssist(event,selected,role))throw Error('当前任务不能使用步骤协作。')
 const recordForStep=selected.draft?.records?.[stepIndex]
 const cleanRecord=recordForStep?.photos?.length?{...recordForStep,photos:recordForStep.photos.map(({name,mimeType})=>({name,mimeType}))}:recordForStep
 const request={mode:'step-assist',role,actor:people[role],event:copy({id:event.id,sourceEventId:event.sourceEventId,title:event.title,phase:event.phase,currentTask:event.currentTask,brief:{discovery:{text:event.brief?.discovery?.text}},tasks:[{id:selected.id,kind:selected.kind,status:selected.status,owner:selected.owner,title:selected.title,scope:selected.scope,steps:selected.steps,draft:{stepIndex:selected.draft?.stepIndex||0,records:selected.steps.map((_,i)=>i===stepIndex?cleanRecord:{})}}]}),taskId:selected.id,stepIndex,text,history:copy(history),images:copy(images),attachments:copy(attachments)}
 request.followUpUsed=stepFollowUpState(completedStepQuestions(selected,role,stepIndex)).used
 prepareStepAssistInput(request)
 return request
}

// Labels are the entire answer. Older responses may contain an expanded value
// or description; neither is a statement the crew selected.
const predictedDetail=/(?:\d{1,2}[:：]\d{2}|\d{4}年|[A-Za-z]{2,}-[A-Za-z\d-]+|[一二三四五六七八九十\d]+\s*(?:次|套|件|分钟|小时|名|bar|rpm))/i
export function crewFollowUpChoices(rawChoices){
 const choices=[],ids=new Set(),labels=new Set()
 function add(raw){
  const label=crewFacingStepText(typeof raw==='string'?raw:raw?.label).trim()
  if(!label||label.length>30||predictedDetail.test(label)||labels.has(label)||/^(?:其他|采用.*草稿|采用到本步骤|继续修改|直接询问助手)/.test(label))return
  if(Object.values(people).some(name=>label.includes(name.split('（')[0])))return
  let id=typeof raw?.id==='string'&&/^[\w-]{1,64}$/.test(raw.id)&&!raw.id.startsWith('__')?raw.id:'opt-'+(choices.length+1)
  while(ids.has(id))id+='x'
  ids.add(id);labels.add(label);choices.push({id,label})
 }
 for(const raw of Array.isArray(rawChoices)?rawChoices:[]){
  add(raw)
  if(choices.length===4)break
 }
 for(const fallback of [{id:'unconfirmed',label:'暂时无法确认'},{id:'not-checked',label:'尚未开展这项检查'}]){
  if(choices.length>=2)break
  add(fallback)
 }
 return choices
}

export function normalizeStepAssistResult(value){
 if(!object(value)||!['answer','question','draft'].includes(value.kind))throw Error('步骤协作返回格式不完整，请重试。')
 const allowed=value.kind==='draft'?['kind','text','note','limitReached']:value.kind==='question'?['kind','text','note','question','choices','allowOther','followUpRound','maxFollowUpRounds']:['kind','text','note']
 if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('步骤协作返回了未允许的操作，未改动执行记录。')
 const text=bounded(value.text,value.kind==='question'?600:2000,'步骤协作回复')
 const note=value.note===undefined?undefined:bounded(value.note,4000,'备注草稿')
 if(value.kind==='answer')return {kind:'answer',text,...(note?{note}:{})}
 if(value.kind==='draft'){
  const result={kind:'draft',text,note:bounded(value.note,4000,'备注草稿')}
  if(value.limitReached!==undefined){
   if(typeof value.limitReached!=='boolean')throw Error('追问上限标记格式不正确。')
   result.limitReached=value.limitReached
  }
  return result
 }
 const result={kind:'question',text,...(note?{note}:{})}
 if(value.question!==undefined){
  const question=bounded(value.question,300,'追问标题',{optional:true})
  if(question)result.question=question
 }
 if(value.choices!==undefined){
  if(!Array.isArray(value.choices)||value.choices.length<1||value.choices.length>5)throw Error('步骤协作追问选项数量应在 1—5 项之间。')
  for(const raw of value.choices){
   if(typeof raw!=='string'&&(!object(raw)||Object.keys(raw).some(key=>!['id','label','description','value'].includes(key))))throw Error('步骤协作追问选项包含未允许字段。')
   bounded(typeof raw==='string'?raw:raw.label,120,'追问选项')
  }
  result.choices=crewFollowUpChoices(value.choices)
 }
 if(value.allowOther!==undefined){
  if(typeof value.allowOther!=='boolean')throw Error('自定义选项标记格式不正确。')
  result.allowOther=value.allowOther
 }
 if(value.followUpRound!==undefined){
  if(!Number.isInteger(value.followUpRound)||value.followUpRound<1||value.followUpRound>10)throw Error('追问轮次格式不正确。')
  result.followUpRound=value.followUpRound
 }
 if(value.maxFollowUpRounds!==undefined){
  if(!Number.isInteger(value.maxFollowUpRounds)||value.maxFollowUpRounds<1||value.maxFollowUpRounds>10)throw Error('追问上限格式不正确。')
  result.maxFollowUpRounds=value.maxFollowUpRounds
 }
 return result
}
