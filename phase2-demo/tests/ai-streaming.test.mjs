import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {readEventStream} from '../src/services/eventStream.js'
import {aiStreamRequest} from '../src/services/aiClient.js'
import {previewReportPatch} from '../server/report-preview.mjs'
import {invokeModel} from '../server/model.mjs'
import {createAiHandler} from '../server/ai-api.mjs'
import {businessLanguageInstruction} from '../server/business-language.mjs'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'

const provider={baseUrl:'https://example.test/v1',apiKey:'private-test-key',model:'demo',protocol:'anthropic'}
const config={...provider,source:'manual',enabled:true,maxTokens:4096,timeoutMs:5000,knowledgeEnabled:false}
const patch={summary:'执行人补充：阀门垫圈松动，仍待核实。',analysis:{evidence:'原始记录保留。',interpretation:'该发现不能确认故障原因。',unverified:'垫圈具体位置与影响待核实。',next:'由轮机长审核。'}}
const frame=(event,data)=>`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`
function response(text,chunkSize=7){
 const bytes=new TextEncoder().encode(text)
 return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=chunkSize)controller.enqueue(bytes.slice(i,i+chunkSize));controller.close()}}),{headers:{'Content-Type':'text/event-stream'}})
}
function anthropic(text,{stop=true,reason='end_turn'}={}){
 return frame('message_start',{type:'message_start',message:{model:'stream-model',usage:{input_tokens:42,output_tokens:0}}})+
 frame('content_block_delta',{type:'content_block_delta',delta:{type:'thinking_delta',thinking:'private hidden reasoning'}})+
 [...text].map(char=>frame('content_block_delta',{type:'content_block_delta',delta:{type:'text_delta',text:char}})).join('')+
 frame('message_delta',{type:'message_delta',delta:{stop_reason:reason},usage:{output_tokens:21}})+(stop?frame('message_stop',{type:'message_stop'}):'')
}
test('SSE decoder retains Chinese characters, CRLF boundaries, comments and multiline data',async()=>{
 const output=[]
 for await(const event of readEventStream(response(': ping\r\nevent: text\r\ndata: 中文\r\ndata: 第二行\r\n\r\nevent: done\ndata: {}\n\n',1)))output.push(event)
 assert.deepEqual(output,[{event:'text',data:'中文\n第二行'},{event:'done',data:'{}'}])
})
test('partial report preview decodes escaped prose without mistaking quoted keys for schema',()=>{
 const target={...patch,summary:'检查中提到 "summary":"不是字段"，换行\n核实路径 C:\\ICU；Unicode：温度'}
 const json=JSON.stringify(target).replace('温度','\\u6e29\\u5ea6')
 let prior=0
 for(let i=0;i<=json.length;i++){
  const preview=previewReportPatch(json.slice(0,i))
  assert.ok(target.summary.startsWith(preview.summary));assert.ok(preview.summary.length>=prior);prior=preview.summary.length
  for(const [key,value] of Object.entries(preview.analysis))assert.ok(target.analysis[key].startsWith(value))
 }
 assert.deepEqual(previewReportPatch(json),target)
 assert.deepEqual(previewReportPatch('```json\n'+JSON.stringify(patch)+'\n```'),patch)
})
test('Anthropic streams visible text and usage while withholding reasoning',async()=>{
 const deltas=[];let request
 const result=await invokeModel(provider,config,'s','u',async(url,options)=>{request=JSON.parse(options.body);return response(anthropic('检查垫圈，记录结果。'))},{onDelta:(delta,full)=>deltas.push({delta,full})})
 assert.equal(request.stream,true);assert.ok(deltas.length>3);assert.equal(deltas[0].full,'检')
 assert.equal(result.text,'检查垫圈，记录结果。');assert.deepEqual(result.usage,{inputTokens:42,outputTokens:21})
 assert.equal(result.model,'stream-model');assert.doesNotMatch(JSON.stringify(deltas),/private/)
})
test('OpenAI-compatible streams preserve content, usage and require a terminal event',async()=>{
 const chunks=[{model:'openai-model',choices:[{delta:{reasoning_content:'private'}}]},{choices:[{delta:{content:'检查'}}]},{choices:[{delta:{content:'完成'},finish_reason:'stop'}]},{choices:[],usage:{prompt_tokens:11,completion_tokens:8}}]
 const wire=chunks.map(data=>'data: '+JSON.stringify(data)+'\n\n').join(''),deltas=[]
 const result=await invokeModel({...provider,protocol:'openai'},config,'s','u',async()=>response(wire+'data: [DONE]\n\n'),{onDelta:delta=>deltas.push(delta)})
 assert.deepEqual(deltas,['检查','完成']);assert.equal(result.text,'检查完成');assert.deepEqual(result.usage,{inputTokens:11,outputTokens:8})
 await assert.rejects(invokeModel({...provider,protocol:'openai'},config,'s','u',async()=>response(wire),{onDelta(){}}),/提前结束/)
})
test('truncated, failed and disconnected streams never produce a successful result',async()=>{
 for(const [wire,pattern] of [[anthropic('未完',{stop:false}),/提前结束/],[anthropic('未完',{reason:'max_tokens'}),/截断/],[frame('error',{type:'error',error:{message:'upstream secret'}}),/生成中断/]]){
  await assert.rejects(invokeModel(provider,config,'s','u',async()=>response(wire),{onDelta(){}}),pattern)
 }
})
test('report API emits previews but only makes a validated completed patch applicable',async()=>{
 const body={text:'补充垫圈松动。',mode:'report',stream:true,role:'engineer',actor:'执行人',event:{id:'event',phase:'investigation_review'},report:{id:'report',taskId:'task',eventId:'event',kind:'排查报告',owner:'执行人',markdown:'原报告内容。'}}
 for(const [content,complete] of [[JSON.stringify(patch),true],['{"summary":"只有结论没有分析"}',false]]){
  let output=''
  const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async()=>response(anthropic(content))})
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
  await handler(req,{setHeader(){},write(text){output+=text},end(){}},()=>assert.fail())
  const events=[];for await(const event of readEventStream(response(output)))events.push({event:event.event,data:JSON.parse(event.data)})
  assert.ok(events.some(e=>e.event==='report'&&e.data.patch.summary.length>0))
  const final=events.find(e=>e.event==='done')
  if(complete)assert.deepEqual(final.data.patch,patch)
  else{assert.equal(final,undefined);assert.ok(events.some(e=>e.event==='error'))}
  assert.doesNotMatch(output,/private-test-key/);assert.equal(events.find(e=>e.event==='reasoning').data.delta,'private hidden reasoning')
 }
})
test('browser stream client delivers progress before completion and rejects disconnects',async t=>{
 const preview=frame('report',{patch:{summary:'正在生成',analysis:{}}}),events=[]
 t.mock.method(globalThis,'fetch',async()=>response(preview+frame('done',{patch})))
 assert.deepEqual((await aiStreamRequest({mode:'report'},(type,data)=>events.push({type,data}))).patch,patch)
 assert.equal(events[0].type,'report')
 globalThis.fetch=async()=>response(preview)
 await assert.rejects(aiStreamRequest({mode:'report'},()=>{}),/提前结束/)
 globalThis.fetch=async()=>response(preview+frame('error',{error:'生成中断'}))
 await assert.rejects(aiStreamRequest({mode:'report'},()=>{}),/生成中断/)
})

test('report generation, revision, chat and note prompts separate presentation metadata from actual evidence gaps',async()=>{
 for(const mode of ['submit-report','refresh-report','report','chat','note']){
  const state=createLifecycleState(),event=state.events['real-alarm-0430']
  decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
  const task=currentTask(event)
  task.status=mode==='submit-report'?'reporting':'submitted'
  task.records=task.steps.map(step=>({result:step.options[0],note:'已完成允许范围检查，内部原因待检验，现场附件未上传。'}))
  task.summary='二缸检查已回交，具体原因待检验。'
  const body={text:'请按当前记录整理，保留尚未完成的试验和资料缺口。',mode,stream:true,role:'engineer',actor:people.engineer,event,taskId:task.id,report:{id:'current-report',taskId:task.id,eventId:event.id,kind:'排查报告',owner:people.engineer,markdown:'原始记录与检查范围。'}}
  const before=structuredClone(body)
  let sent,output=''
  const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async(url,options)=>{sent=JSON.parse(options.body);return response(anthropic(['chat','note'].includes(mode)?'具体原因待检验，作业附件未上传。':JSON.stringify(patch)))}})
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
  await handler(req,{setHeader(){},write(text){output+=text},end(){}},()=>assert.fail())
  assert.ok(sent,mode+' reached the model adapter')
  assert.ok(sent.system.includes(businessLanguageInstruction),mode)
  assert.match(sent.system,/不把演示、练习、虚构等包装标签、图片来源或 AI 生成说明写入业务正文/,mode)
  assert.match(sent.system,/必须保留真正的证据缺口、未完成事项、未覆盖工况、原因不确定性/,mode)
  assert.match(sent.system,/不得把生成图片、参考图、历史照片或助手预设回复说成本轮现场照片/,mode)
  assert.match(output,/event: done/,mode);assert.doesNotMatch(output,/event: error/,mode)
  assert.deepEqual(body,before,'prompt policy must not mutate the original records')
 }
})
