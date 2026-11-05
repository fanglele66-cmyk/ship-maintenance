import {ownsTask,people} from './lifecyclePermissions.js'

export const STEP_ASSIST_LIMITS=Object.freeze({maxImages:4,maxImageBytes:3*1024*1024,maxTotalImageBytes:6*1024*1024,maxAttachments:3,maxAttachmentChars:20000,maxTextChars:6000,maxHistory:100})
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

export function canUseStepAssist(event,task,role){
 const current=Array.isArray(event?.tasks)?event.tasks.find(item=>item?.id===task?.id):null
 return Boolean((event?.sourceEventId||event?.id)==='real-alarm-0430'&&event.phase!=='closed'&&current&&event.currentTask===current.id&&current.status==='assigned'&&['investigation','repair'].includes(current.kind)&&ownsTask(role,current))
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
 const event=input?.event,task=Array.isArray(event?.tasks)?event.tasks.find(item=>item?.id===input.taskId):null
 if(input?.mode!=='step-assist'||!canUseStepAssist(event,task,input.role)||input.actor!==people[input.role]||event.tasks.filter(item=>item.id===task.id).length!==1)throw Error('步骤协作仅用于本人当前执行的二缸排查或维修任务。')
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
  return {role:message.role,...(['scripted-demo','model'].includes(message.source)?{source:message.source}:{}),stepIndex,stepNumber:stepIndex===null?null:stepIndex+1,stepLabel:stepIndex===null?'':bounded(task.steps[stepIndex].label,300,'历史步骤标题'),scope:stepIndex===null?'task':stepIndex===index?'current-step':'other-step',text:bounded(message.text,STEP_ASSIST_LIMITS.maxTextChars,'历史消息',{optional:true}),...(message.role==='user'?material(message.images,message.attachments):{})}
 })
 const materials=material(input.images,input.attachments)
 if(images.length>STEP_ASSIST_LIMITS.maxImages||images.reduce((sum,item)=>sum+item.bytes,0)>STEP_ASSIST_LIMITS.maxTotalImageBytes)throw Error('本次任务上下文最多使用 4 张图片，合计不能超过 6 MB。')
 if(files.size>STEP_ASSIST_LIMITS.maxAttachments)throw Error('本次任务上下文最多使用 3 份文字附件。')
 if(!text&&!materials.images.length&&!materials.attachments.length)throw Error('请输入现场情况，或添加本步骤的图片、文字附件。')
 return {
  context:{event:{id:event.id,sourceEventId:event.sourceEventId,title:bounded(event.title,500,'事件标题'),initialClue:bounded(event.brief?.discovery?.text,3000,'初始线索',{optional:true})},task:{id:task.id,kind:task.kind,title:bounded(task.title,500,'任务标题',{optional:true}),scope:bounded(task.scope,3000,'任务范围',{optional:true})},stepIndex:index,stepNumber:index+1,step,record:{result,note:bounded(record.note,12000,'步骤备注',{optional:true}),executionStatus:bounded(record.executionStatus,100,'执行情况',{optional:true})},history,message:{text,...materials}},
  images
 }
}

export function buildStepAssistRequest({event,task,stepIndex,role,text='',history=[],images=[],attachments=[]}){
 const selected=event?.tasks?.find(item=>item.id===task?.id)
 if(!canUseStepAssist(event,selected,role))throw Error('当前任务不能使用步骤协作。')
 const request={mode:'step-assist',role,actor:people[role],event:copy({id:event.id,sourceEventId:event.sourceEventId,title:event.title,phase:event.phase,currentTask:event.currentTask,brief:{discovery:{text:event.brief?.discovery?.text}},tasks:[{id:selected.id,kind:selected.kind,status:selected.status,owner:selected.owner,title:selected.title,scope:selected.scope,steps:selected.steps,draft:{stepIndex:selected.draft?.stepIndex||0,records:selected.steps.map((_,i)=>i===stepIndex?selected.draft?.records?.[i]:{})}}]}),taskId:selected.id,stepIndex,text,history:copy(history),images:copy(images),attachments:copy(attachments)}
 prepareStepAssistInput(request)
 return request
}

export function normalizeStepAssistResult(value){
 if(!object(value)||!['question','draft'].includes(value.kind))throw Error('步骤协作返回格式不完整，请重试。')
 const allowed=value.kind==='draft'?['kind','text','note']:['kind','text']
 if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('步骤协作返回了未允许的操作，未改动执行记录。')
 const text=bounded(value.text,value.kind==='question'?600:500,'步骤协作回复')
 return value.kind==='question'?{kind:'question',text}:{kind:'draft',text,note:bounded(value.note,4000,'备注草稿')}
}
