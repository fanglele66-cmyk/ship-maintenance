export async function aiRequest(path,body,method=body?'POST':'GET'){
 const response=await fetch('/api/ai/'+path,{method,headers:{'Content-Type':'application/json','X-Engine-Room-Client':'local-ui'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(185000)})
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('当前站点未启用本地模型后台。')
 const result=await response.json()
 if(!response.ok)throw Error(result.error||'模型服务暂不可用。')
 return result
}
import {readEventStream} from './eventStream.js'


export async function aiStreamRequest(body,onProgress){
 const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Engine-Room-Client':'local-ui'},body:JSON.stringify({...body,stream:true}),signal:AbortSignal.timeout(185000)})
 if(response.headers.get('content-type')?.includes('application/json')){
  const result=await response.json();throw Error(result.error||'当前后台未启用流式输出。')
 }
 if(!response.ok||!response.headers.get('content-type')?.includes('text/event-stream'))throw Error('当前站点未启用本地模型流式后台。')
 for await(const frame of readEventStream(response)){
  let data;try{data=JSON.parse(frame.data)}catch{throw Error('流式内容格式异常，请重新生成。')}
  if(frame.event==='error')throw Error(data.error||'生成中断，请重试。')
  if(frame.event==='done'){
   if(body.mode==='plan'?!data.plan:body.mode==='report'?!data.patch:typeof data.answer!=='string')throw Error('生成结果不完整，请重试。')
   return data
  }
  onProgress(frame.event,data)
 }
 throw Error('连接提前结束，请重新生成。')
}
