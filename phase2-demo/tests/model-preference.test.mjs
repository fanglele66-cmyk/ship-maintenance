import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {setImmediate as nextTurn} from 'node:timers/promises'
import {configStore,resolveProvider,publicProvider} from '../server/ai-config.mjs'
import {invokeModel} from '../server/model.mjs'
import {stepAssistUserContent,assertStepAssistVisionProvider} from '../server/step-assist.mjs'

async function modelFiles(t){
 const root=await mkdtemp(join(tmpdir(),'ship-model-preference-'))
 const priorKey=process.env.SHIP_GLM_API_KEY,priorDb=process.env.CC_SWITCH_DB
 process.env.SHIP_GLM_API_KEY='fixture-project-secret'
 process.env.CC_SWITCH_DB=join(root,'missing.db')
 t.after(async()=>{
  if(priorKey===undefined)delete process.env.SHIP_GLM_API_KEY
  else process.env.SHIP_GLM_API_KEY=priorKey
  if(priorDb===undefined)delete process.env.CC_SWITCH_DB
  else process.env.CC_SWITCH_DB=priorDb
  await rm(root,{recursive:true,force:true})
 })
 const serverDir=join(root,'server'),volume=join(root,'volume')
 await mkdir(serverDir);await mkdir(volume)
 const projectFile=join(serverDir,'ai-project.json'),volumeFile=join(volume,'config.json')
 const project={name:'项目供应商',model:'glm-test',protocol:'anthropic',baseUrl:'https://glm.test',maxTokens:8192}
 const backup={source:'manual',baseUrl:'https://backup.test',model:'backup-test',apiKey:'fixture-backup-secret',protocol:'openai',knowledgeEnabled:false,maxTokens:20000}
 await writeFile(projectFile,JSON.stringify(project))
 await writeFile(volumeFile,JSON.stringify(backup))
 return {projectFile,volumeFile,project,backup,store:configStore(root,{directory:volume})}
}

test('project routing keeps volume switches, independent credentials and concurrent administrator edits',async t=>{
 const {store,volumeFile,backup}=await modelFiles(t)
 const original=await readFile(volumeFile,'utf8')
 const config=await store.read(),provider=await resolveProvider(config)
 assert.equal(config.knowledgeEnabled,false);assert.equal(provider.model,'glm-test')
 assert.equal(provider.outputTokenLimit,8192);assert.equal(config.maxTokens,20000)
 assert.equal((await provider.loadFallback()).model,backup.model)
 assert.doesNotMatch(JSON.stringify(publicProvider(provider)),/fixture.*secret/)
 assert.equal(await readFile(volumeFile,'utf8'),original)
 await Promise.all([store.write({enabled:false}),store.write({model:'new-backup'})])
 assert.equal((await store.read()).enabled,false)
 assert.equal(JSON.parse(await readFile(volumeFile,'utf8')).model,'new-backup')
 assert.equal(JSON.parse(await readFile(volumeFile,'utf8')).apiKey,backup.apiKey)
 await assert.rejects(provider.loadFallback(),/已停用/)
})

test('missing credentials and invalid or missing project settings use the saved volume configuration',async t=>{
 const {store,project,projectFile}=await modelFiles(t)
 delete process.env.SHIP_GLM_API_KEY
 assert.equal((await resolveProvider(await store.read())).model,'backup-test')
 process.env.SHIP_GLM_API_KEY='fixture-project-secret'
 for(const bad of ['{',JSON.stringify({...project,baseUrl:'ftp://test'}),JSON.stringify({...project,protocol:'unknown'})]){
  await writeFile(projectFile,bad)
  assert.equal((await resolveProvider(await store.read())).model,'backup-test')
 }
 await rm(projectFile)
 assert.equal((await resolveProvider(await store.read())).model,'backup-test')
})

test('a privately mounted project JSON works without CC Switch and honours a backend credential override',async t=>{
 const {store,project,projectFile}=await modelFiles(t)
 await writeFile(projectFile,JSON.stringify({...project,apiKey:'fixture-file-secret'}))
 assert.equal((await resolveProvider(await store.read())).apiKey,'fixture-project-secret')
 delete process.env.SHIP_GLM_API_KEY
 const provider=await resolveProvider(await store.read())
 assert.equal(provider.apiKey,'fixture-file-secret');assert.equal(provider.model,project.model)
 assert.doesNotMatch(JSON.stringify(publicProvider(provider)),/fixture-file-secret/)
})

test('credential or connection failures retry once with backup credentials and the correct image format',async t=>{
 const {store}=await modelFiles(t),config=await store.read(),provider=await resolveProvider(config)
 const images=[{name:'船上照片',mimeType:'image/png',dataUrl:'data:image/png;base64,YQ=='}]
 const content=candidate=>{
  assertStepAssistVisionProvider(candidate,images)
  return stepAssistUserContent(candidate.protocol,{event:{},task:{},stepNumber:1},images)
 }
 for(const primaryFailure of [()=>new Response('',{status:401}),()=>{throw TypeError('offline')}]){
  const requests=[]
  const result=await invokeModel(provider,config,'system',content,async(url,options)=>{
   const body=JSON.parse(options.body)
   requests.push({url,body,headers:options.headers})
   if(requests.length===1)return primaryFailure()
   return Response.json({model:'backup-served',choices:[{message:{content:'已完成'}}]})
  })
  assert.deepEqual(requests.map(r=>r.url),['https://glm.test/v1/messages','https://backup.test/v1/chat/completions'])
  assert.deepEqual(requests.map(r=>r.body.max_tokens),[8192,20000])
  assert.equal(requests[0].headers['x-api-key'],'fixture-project-secret')
  assert.equal(requests[1].headers.Authorization,'Bearer fixture-backup-secret')
  assert.equal(requests[0].body.messages.at(-1).content.at(-1).source.data,'YQ==')
  assert.equal(requests[1].body.messages.at(-1).content.at(-1).image_url.url,images[0].dataUrl)
  assert.equal(result.model,'backup-served');assert.equal(result.provider,'手动配置')
 }
})

test('first emitted answer or reasoning, and user cancellation, prevent a second model request',async t=>{
 const {store}=await modelFiles(t),config=await store.read(),provider=await resolveProvider(config)
 for(const delta of [{type:'thinking_delta',thinking:'思考'},{type:'text_delta',text:'答复'}]){
  let calls=0
  const fetcher=async()=>{
   calls++
   return new Response('data: '+JSON.stringify({type:'content_block_delta',delta})+'\n\n',{headers:{'content-type':'text/event-stream'}})
  }
  await assert.rejects(invokeModel(provider,config,'system','问题',fetcher,{onReasoning(){},onDelta(){}}),/提前结束/)
  assert.equal(calls,1)
 }
 const controller=new AbortController();let calls=0
 await assert.rejects(invokeModel(provider,config,'system','问题',async()=>{
  calls++;controller.abort();throw Error('interrupt')
 },{signal:controller.signal}),/已取消/)
 assert.equal(calls,1)
})

test('silent project connections leave time for the backup within the same request deadline',async t=>{
 const {store}=await modelFiles(t),config=await store.read(),provider=await resolveProvider(config)
 const deadlines=[];let now=0,calls=0
 t.mock.method(performance,'now',()=>now)
 t.mock.timers.enable({apis:['setTimeout']})
 t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return new AbortController().signal})
 const reply=await invokeModel(provider,{...config,timeoutMs:180000},'system','问题',async(_url,options)=>{
  if(++calls===1)return new Promise((_resolve,reject)=>{
   options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true})
   now=30000;t.mock.timers.tick(now)
  })
  return Response.json({choices:[{message:{content:'备用模型已答复'}}]})
 })
 assert.equal(reply.provider,'手动配置')
 assert.deepEqual(deadlines,[180000,150000])
})

test('a responding project stream can continue past its first-response timeout',async t=>{
 const {store}=await modelFiles(t),config=await store.read(),provider=await resolveProvider(config)
 t.mock.timers.enable({apis:['setTimeout']})
 let calls=0,upstream
 const result=await invokeModel(provider,config,'system','问题',async(_url,{signal})=>{
  calls++;upstream=signal
  const first={type:'content_block_delta',delta:{type:'text_delta',text:'正文'}}
  return new Response('data: '+JSON.stringify(first)+'\n\ndata: {"type":"message_stop"}\n\n',{headers:{'content-type':'text/event-stream'}})
 },{onDelta(){t.mock.timers.tick(60000);assert.equal(upstream.aborted,false)}})
 assert.equal(calls,1);assert.equal(result.text,'正文')
})

test('empty stream frames, headers without a body, and malformed JSON cannot consume the backup window',async t=>{
 const {store}=await modelFiles(t),config=await store.read(),provider=await resolveProvider(config)
 t.mock.timers.enable({apis:['setTimeout']})
 for(const mode of ['headers','empty-frame','null','invalid shape']){
  let calls=0,timedOut=false
  const stream=mode==='empty-frame'
  const result=await invokeModel(provider,config,'system','问题',async(_url,{signal})=>{
   if(++calls===2){
    if(!stream)return Response.json({choices:[{message:{content:'备用回答'}}]})
    return new Response('data: {"choices":[{"delta":{"content":"备用回答"}}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})
   }
   if(mode==='null')return Response.json(null)
   if(mode==='invalid shape')return Response.json({content:{text:'invalid'}})
   if(mode==='headers')return {ok:true,json:async()=>{
    t.mock.timers.tick(30000);timedOut=signal.aborted;signal.throwIfAborted()
    throw Error('missing first-response timeout')
   }}
   let sent=false
   return new Response(new ReadableStream({async pull(controller){
    if(!sent){
     controller.enqueue(new TextEncoder().encode('data: {"type":"content_block_start","content_block":{"type":"text","text":""}}\n\n'))
     sent=true;return
    }
    await nextTurn()
    t.mock.timers.tick(30000);timedOut=signal.aborted
    if(signal.aborted)controller.error(signal.reason)
    else controller.close()
   }}),{headers:{'content-type':'text/event-stream'}})
  },stream?{onDelta(){}}:{})
  assert.equal(calls,2);assert.equal(result.text,'备用回答')
  if(mode==='headers'||stream)assert.equal(timedOut,true)
 }
})
