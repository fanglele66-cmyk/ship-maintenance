import {readEventStream} from '../src/services/eventStream.js'

export class ProviderUnavailable extends Error {}

export async function invokeModel(provider,config,system,user,fetcher=fetch,callbacks={}){
 let started=false
 const {onDelta,onReasoning,signal}=callbacks
 const deadline=performance.now()+config.timeoutMs
 const attempt=async candidate=>{
  signal?.throwIfAborted()
  const remainingMs=Math.ceil(deadline-performance.now())
  if(remainingMs<=0)throw new ProviderUnavailable('模型响应超时，请稍后重试。')
  const content=typeof user==='function'?user(candidate):user
  // Reserve time for the volume provider if the preferred gateway stays silent.
  const firstResponse=candidate===provider&&provider.loadFallback?new AbortController():null
  const timer=firstResponse&&setTimeout(()=>firstResponse.abort(),Math.min(30000,Math.ceil(remainingMs/2)))
  try{
   const result=await requestModel(candidate,{...config,timeoutMs:remainingMs},system,content,fetcher,{
    ...callbacks,firstResponseSignal:firstResponse?.signal,onResponseStarted:()=>clearTimeout(timer),
    onDelta:onDelta&&((...args)=>{started=true;return onDelta(...args)}),
    onReasoning:onReasoning&&((...args)=>{started=true;return onReasoning(...args)}),
   })
   return {...result,provider:candidate.name}
  }finally{clearTimeout(timer)}
 }
 try{return await attempt(provider)}catch(error){
  if(!(error instanceof ProviderUnavailable)||!provider.loadFallback||started||signal?.aborted)throw error
  let backup
  try{backup=await provider.loadFallback()}catch{throw error}
  if(backup.model===provider.model&&backup.protocol===provider.protocol&&backup.baseUrl===provider.baseUrl&&backup.apiKey===provider.apiKey)throw error
  return attempt(backup)
 }
}

async function requestModel(provider,config,system,user,fetcher,{onDelta,onReasoning,signal,onActivity,firstResponseSignal,onResponseStarted}){
 const base=provider.baseUrl.replace(/\/+$/,''),prefix=/\/v1$/.test(base)?base:base+'/v1',anthropic=provider.protocol==='anthropic'
 const headers={'Content-Type':'application/json',...(anthropic?{'x-api-key':provider.apiKey,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+provider.apiKey})}
 const messages=anthropic?[{role:'user',content:user}]:[{role:'system',content:system},{role:'user',content:user}]
 const tokenLimit=provider.outputTokenLimit?Math.min(config.maxTokens,provider.outputTokenLimit):config.maxTokens
 const body={model:provider.model,max_tokens:tokenLimit,messages,stream:!!onDelta,...(anthropic?{system}:onDelta?{stream_options:{include_usage:true}}:{})}
 // Only interactive callers opt in. Never infer thinking from answer text or
 // expose signatures/redacted blocks; consume the provider's dedicated channel.
 const captureReasoning=typeof onReasoning==='function'
 if(captureReasoning&&new URL(base).hostname==='api.deepseek.com')body.thinking={type:'enabled'}
 let reasoning=''
 async function appendReasoning(delta){if(!captureReasoning||typeof delta!=='string'||!delta)return;reasoning+=delta;if(reasoning.length>120000)throw Error('模型思考内容超出限制。');await onReasoning(delta,reasoning)}
 const timeout=AbortSignal.timeout(config.timeoutMs),requestSignal=AbortSignal.any([timeout,signal,firstResponseSignal].filter(Boolean))
 let response
 try{response=await fetcher(prefix+(anthropic?'/messages':'/chat/completions'),{method:'POST',headers,body:JSON.stringify(body),signal:requestSignal,redirect:'error'})}catch(error){
  if(signal?.aborted)throw Error('请求已取消。')
  throw new ProviderUnavailable(firstResponseSignal?.aborted||timeout.aborted||error.name==='TimeoutError'?'模型响应超时，请稍后重试。':'模型接口暂时无法连接，请检查网络和配置。')
 }
 if(!response.ok){
  await response.body?.cancel?.()
  const retryable=[400,401,403,404,408,415,422,429].includes(response.status)||response.status>=500
  const Failure=retryable?ProviderUnavailable:Error
  throw new Failure(`模型接口返回 HTTP ${response.status}，请检查模型名称、额度和密钥。`)
 }
 if(onDelta){
  if(!response.headers.get('content-type')?.includes('text/event-stream')){
   await response.body?.cancel?.()
   throw new ProviderUnavailable('模型接口未提供流式输出，请检查后台协议配置。')
  }
  let text='',model=provider.model,complete=false,stopReason='',activitySent=false
  const usage={inputTokens:0,outputTokens:0}
  try{
   for await(const frame of readEventStream(response)){
    if(!anthropic&&frame.data==='[DONE]'){complete=true;break}
    let data;try{data=JSON.parse(frame.data)}catch{throw new ProviderUnavailable('模型流式数据格式异常，请重试。')}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new ProviderUnavailable('模型流式数据格式异常，请重试。')
    if(data.error||data.type==='error'||frame.event==='error')throw new ProviderUnavailable('模型生成中断，请稍后重试。')
    const type=data.type||frame.event
    if(!activitySent&&(type==='message_start'||type==='content_block_delta'||data.choices?.length)){activitySent=true;await onActivity?.()}
    if(data.model||data.message?.model)model=data.model||data.message.model
    const tokens=data.usage||data.message?.usage
    if(tokens){usage.inputTokens=tokens.input_tokens??tokens.prompt_tokens??usage.inputTokens;usage.outputTokens=tokens.output_tokens??tokens.completion_tokens??usage.outputTokens}
    stopReason=anthropic?(data.delta?.stop_reason||stopReason):(data.choices?.[0]?.finish_reason||stopReason)
    if(stopReason==='max_tokens'||stopReason==='length')throw Error('模型输出被截断，请提高输出上限后重试。')
    const delta=anthropic?(type==='content_block_delta'&&data.delta?.type==='text_delta'?data.delta.text:type==='content_block_start'&&data.content_block?.type==='text'?data.content_block.text:''):data.choices?.[0]?.delta?.content
    const reasoningDelta=anthropic?(type==='content_block_delta'&&data.delta?.type==='thinking_delta'?data.delta.thinking:type==='content_block_start'&&data.content_block?.type==='thinking'?data.content_block.thinking:''):data.choices?.[0]?.delta?.reasoning_content
    if((typeof delta==='string'&&delta.length)||(typeof reasoningDelta==='string'&&reasoningDelta.length))onResponseStarted()
    await appendReasoning(reasoningDelta)
    if(typeof delta==='string'&&delta){text+=delta;if(text.length>120000)throw Error('模型输出超出限制。');await onDelta(delta,text)}
    if(anthropic&&type==='message_stop'){complete=true;break}
   }
  }catch(error){
   if(signal?.aborted)throw Error('请求已取消。')
   if(timeout.aborted||firstResponseSignal?.aborted)throw new ProviderUnavailable('模型响应超时，请稍后重试。')
   if(error instanceof TypeError)throw new ProviderUnavailable('模型连接提前结束，内容尚未生成完整，请重试。')
   throw error
  }
  if(!complete)throw new ProviderUnavailable('模型连接提前结束，内容尚未生成完整，请重试。')
  if(!text.trim())throw new ProviderUnavailable('模型没有返回可显示的回答。')
  return {text,usage,model,...(captureReasoning?{reasoning}:{})}
 }
 let data
 try{data=await response.json()}catch{throw new ProviderUnavailable('模型响应无效，请检查后台协议配置。')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new ProviderUnavailable('模型响应无效，请检查后台协议配置。')
 if(data.stop_reason==='max_tokens'||data.choices?.[0]?.finish_reason==='length')throw Error('模型输出被截断，请提高输出上限后重试。')
 if(anthropic&&!Array.isArray(data.content))throw new ProviderUnavailable('模型响应无效，请检查后台协议配置。')
 const text=anthropic?data.content.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n'):data.choices?.[0]?.message?.content
 if(typeof text!=='string'||!text.trim())throw new ProviderUnavailable('模型没有返回可显示的回答。')
 onResponseStarted()
 await appendReasoning(anthropic?data.content.filter(x=>x?.type==='thinking'&&typeof x.thinking==='string').map(x=>x.thinking).join('\n'):data.choices?.[0]?.message?.reasoning_content)
 const usage={inputTokens:data.usage?.input_tokens??data.usage?.prompt_tokens??0,outputTokens:data.usage?.output_tokens??data.usage?.completion_tokens??0}
 return {text,usage,model:data.model||provider.model,...(captureReasoning?{reasoning}:{})}
}
export function parseReportPatch(text){
 let value
 try{value=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{throw Error('模型未返回有效的报告修订格式，原报告未修改。')}
 if(!value||typeof value.summary!=='string'||value.summary.trim().length<5||value.summary.length>6000)throw Error('报告结论格式不符合要求，原报告未修改。')
 const analysis={}
 for(const key of ['evidence','interpretation','unverified','next']){if(typeof value.analysis?.[key]!=='string'||!value.analysis[key].trim()||value.analysis[key].length>6000)throw Error('报告分析章节不完整，原报告未修改。');analysis[key]=value.analysis[key].trim()}
 return {summary:value.summary.trim(),analysis}
}
