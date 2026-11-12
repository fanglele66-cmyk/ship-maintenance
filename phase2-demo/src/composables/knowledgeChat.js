import {reactive} from 'vue'

export async function sendKnowledgeQuestion(session,text,scope,request,{signal,onChange=()=>{}}={}){
 const history=session.messages.filter(m=>m.role==='user'||m.kind==='knowledge'&&m.status==='complete').map(m=>({role:m.role,text:m.content||m.text||''})).slice(-8)
 session.messages.push({role:'user',content:text,ts:Date.now()})
 // Keep the reactive object, not the raw object inserted into a reactive array.
 const reply=reactive({role:'assistant',kind:'knowledge',content:'',sources:[],status:'streaming',progress:'正在检索知识库…',error:'',question:text,ts:Date.now()})
 session.messages.push(reply);onChange()
 try{
  const result=await request({mode:'knowledge',text,scope,history},(event,data)=>{
   if(event==='text')reply.content+=data.delta||''
   if(event==='meta')reply.sources=data.sources||[]
   if(event==='progress')reply.progress=data.label||'正在生成回答…'
   onChange()
  },{signal})
  if(!result.answer?.trim())throw Error('模型未返回可显示的回答，请重试。')
  reply.content=result.answer;reply.sources=result.sources||reply.sources;reply.status='complete'
 }catch(error){reply.status='error';reply.error=signal?.aborted?'回答已中断，请重试。':error.message||'回答失败，请重试。'}
 onChange();return reply
}
