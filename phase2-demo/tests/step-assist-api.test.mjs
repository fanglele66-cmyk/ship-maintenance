import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {readFileSync} from 'node:fs'
import {createAiHandler} from '../server/ai-api.mjs'
import {assistTaskStep,stepAssistInstruction,stepAssistUserContent,assertStepAssistVisionProvider} from '../server/step-assist.mjs'
import {buildStepAssistRequest} from '../src/workflow/stepAssistContract.js'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'
import {aiStreamRequest} from '../src/services/aiClient.js'
import {readEventStream} from '../src/services/eventStream.js'

const png={name:'C2现场.png',mimeType:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT8AAAAASUVORK5CYII='}
const config={source:'manual',enabled:true,apiKey:'test-private-key',model:'test-vision',baseUrl:'https://example.test/v1',protocol:'openai',maxTokens:4096,timeoutMs:5000,knowledgeEnabled:false}
const reply={kind:'draft',text:'已整理为备注草稿，请核对。',note:'已检查二缸插接件，未见松动；液压动作尚未检查。'}
const frame=(event,data)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const task=currentTask(event);task.draft.records[0].note='插接件未见松动，液压动作尚未检查。';task.draft.records[1].note='其他步骤隐藏标记'
 return buildStepAssistRequest({event,task,stepIndex:0,role:'engineer',text:'请整理目前的检查记录。',images:[png],attachments:[{name:'record.txt',text:'现场记录：插接件未见松动。'}]})
}
const stream=text=>new Response(text,{headers:{'Content-Type':'text/event-stream'}})
function modelResponse(value,protocol='openai'){
 const text=typeof value==='string'?value:JSON.stringify(value)
 return protocol==='openai'?stream('data: '+JSON.stringify({model:'test-vision',choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'):
 stream(frame('message_start',{type:'message_start',message:{model:'test-vision',usage:{input_tokens:5,output_tokens:0}}})+frame('content_block_delta',{type:'content_block_delta',delta:{type:'text_delta',text}})+frame('message_delta',{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:12}})+frame('message_stop',{type:'message_stop'}))
}
async function request(body,fetcher,protocol='openai',configuration={read:async()=>({...config,protocol})}){
 const handler=createAiHandler(process.cwd(),{configuration,fetcher})
 const raw=Buffer.from(JSON.stringify(body)),req=Readable.from([raw.subarray(0,41),raw.subarray(41)])
 Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 let output='';const headers={},res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},write(text){output+=text},end(text=''){output+=text;this.writableEnded=true}}
 await handler(req,res,()=>assert.fail())
 return {code:res.statusCode,headers,output}
}

test('step-assist sends actual image parts to OpenAI and Anthropic and returns only validated JSON',async()=>{
 for(const protocol of ['openai','anthropic']){
  let sent,url
  const result=await request({...fixture(),stream:true},async(next,options)=>{url=next;sent=JSON.parse(options.body);return modelResponse(reply,protocol)},protocol)
  assert.equal(result.code,200);assert.match(result.headers['content-type'],/event-stream/)
  assert.ok(url.endsWith(protocol==='openai'?'/chat/completions':'/messages'))
  const user=sent.messages.at(-1).content,image=user.find(item=>item.type===(protocol==='openai'?'image_url':'image'))
  assert.ok(image)
  if(protocol==='openai')assert.equal(image.image_url.url,png.dataUrl)
  else{assert.equal(image.source.type,'base64');assert.equal(image.source.media_type,'image/png');assert.equal(image.source.data,png.dataUrl.split(',')[1])}
  const context=JSON.parse(user[0].text)
  assert.equal(context.stepNumber,1);assert.equal(context.stepIndex,undefined,'the model never receives zero-based internal step numbering')
  assert.equal(context.message.attachments[0].text,'现场记录：插接件未见松动。')
  assert.doesNotMatch(JSON.stringify(context),/其他步骤隐藏标记/)
  const events=[];for await(const event of readEventStream(stream(result.output)))events.push({event:event.event,data:JSON.parse(event.data)})
  assert.deepEqual(events.find(event=>event.event==='done')?.data.stepAssist,reply)
  assert.equal(events.find(event=>event.event==='done')?.data.source,'model')
  assert.ok(events.some(event=>event.event==='progress'))
  assert.equal(events.some(event=>['text','report'].includes(event.event)),false,'partial JSON is never presented as an accepted draft')
  assert.doesNotMatch(result.output,/test-private-key/)
 }
 assert.match(stepAssistInstruction,/没有现场依据不得补造/)
 assert.match(stepAssistInstruction,/未说明不等于未执行/)
 assert.match(stepAssistInstruction,/核心动作是否实施或实际结果仍不清楚，必须优先返回 kind=question/)
 assert.match(stepAssistInstruction,/紧凑连续正文/)
 assert.match(stepAssistInstruction,/不把演示、练习、虚构等包装标签、图片来源或 AI 生成说明写入业务正文/)
 assert.match(stepAssistInstruction,/必须保留真正的证据缺口/)
 assert.doesNotMatch(stepAssistInstruction,/备注开头原样保留该标签/)
 assert.match(stepAssistInstruction,/每个.*完成态陈述，都必须能够直接对应 record 或 role=user 的原话/)
 assert.match(stepAssistInstruction,/历史 role=assistant 草稿不构成独立事实来源/)
 assert.match(stepAssistInstruction,/通常80—180字/)
 assert.match(stepAssistInstruction,/scope=other-step.*不能当作当前步骤已执行证据/)
 assert.throws(()=>stepAssistUserContent('unknown',{},[png]),/协议不支持图片/)
 assert.throws(()=>assertStepAssistVisionProvider({protocol:'anthropic',model:'deepseek-v4-pro',baseUrl:'https://api.deepseek.com/anthropic'},[png]),/不处理图片/)
 assert.doesNotThrow(()=>assertStepAssistVisionProvider({protocol:'anthropic',model:'deepseek-v4-flash',baseUrl:'https://api.deepseek.com/anthropic'},[png]))
})

test('an exact scripted prompt returns a labelled demo before reading config, retrieving knowledge or calling the provider',async()=>{
 const script=readFileSync(new URL('../docs/二缸步骤协作演示/排查演示脚本.md',import.meta.url),'utf8')
 const start=script.split('### 2. 发送原话和图片，留下一个关键缺口')[1].match(/^> (.+)$/m)[1]
 const answer=script.split('### 3. 回答后生成备注卡')[1].match(/^> (.+)$/m)[1]
 const input=fixture();input.text=start;input.attachments=[]
 const options={configuration:{read:()=>assert.fail('scripted demo must not read model configuration')},knowledge:{search:()=>assert.fail('scripted demo must not retrieve knowledge')},fetcher:()=>assert.fail('scripted demo must not call a provider')}
 const events=[];const first=await assistTaskStep(input,{...options,emit:(type,data)=>events.push({type,data})})
 assert.equal(events[0].data.label,'正在整理本步骤记录')
 assert.equal(first.stepAssist.kind,'question');assert.equal(first.source,'scripted-demo')
 assert.equal(first.provider,'scripted-demo');assert.equal(first.model,'c2-step-demo')
 assert.deepEqual(first.usage,{inputTokens:0,outputTokens:0})
 const http=await request(input,options.fetcher,'openai',options.configuration)
 assert.equal(http.code,200);assert.equal(JSON.parse(http.output).source,'scripted-demo')
 input.history=[{eventId:input.event.id,taskId:input.taskId,stepIndex:0,role:'user',text:start}];input.text=answer
 const next=await assistTaskStep(input,options)
 assert.equal(next.stepAssist.kind,'draft');assert.doesNotMatch(next.stepAssist.note,/演示|练习|虚构|AI 生成|图片来源/)
 assert.match(next.stepAssist.note,/原因未确认|原因.*未确认/)
 const different={...input,text:answer.replace('三次','四次')};let called=false
 const real=await assistTaskStep(different,{configuration:{read:async()=>config},knowledge:{search:async()=>[]},fetcher:async()=>{called=true;return modelResponse(reply)}})
 assert.equal(called,true);assert.equal(real.source,'model','an altered fact cannot reuse a fixed script response')
})

test('real fallback sees the whole current task conversation with step scope but no cross-task data',async()=>{
 const input=fixture(),stamp={eventId:input.event.id,taskId:input.taskId}
 input.history=[{...stamp,role:'user',stepIndex:1,text:'第二步只查看了滤器状态'},
  {...stamp,role:'assistant',stepIndex:0,source:'scripted-demo',text:'此前是模拟演示回复'},
  {...stamp,role:'user',stepIndex:null,text:'任务级背景说明'},
  {...stamp,taskId:'another-task',role:'user',stepIndex:0,text:'禁止传出的其它任务情况'},
  {...stamp,eventId:'another-event',role:'user',stepIndex:0,text:'禁止传出的其它事件情况'}]
 let context
 const result=await request(input,async(url,options)=>{const content=JSON.parse(options.body).messages.at(-1).content;context=JSON.parse(content[0].text);return modelResponse(reply)})
 assert.equal(result.code,200);assert.equal(context.history.length,3)
 assert.equal(context.history[0].stepNumber,2);assert.equal(context.history[0].scope,'other-step')
 assert.equal(context.history[0].stepIndex,undefined)
 assert.equal(context.history[1].source,'scripted-demo')
 assert.equal(context.history[2].scope,'task');assert.equal(context.history[2].stepNumber,null)
 assert.doesNotMatch(JSON.stringify(context),/禁止传出/)
 assert.equal(context.record.note,'插接件未见松动，液压动作尚未检查。')
})

test('wrong scene, identity, step and invalid pictures are rejected before any model request',async()=>{
 for(const change of [body=>body.event.id='real-warning-0523',body=>body.role='captain',body=>body.actor='伪造执行人',body=>body.stepIndex=40,body=>body.event.tasks[0].status='submitted',body=>body.images[0].mimeType='image/svg+xml',body=>body.images[0].dataUrl='https://example.test/hidden']){
  const body=fixture();change(body);let called=false
  const result=await request(body,async()=>{called=true;return modelResponse(reply)})
  assert.equal(result.code,400);assert.equal(called,false);assert.ok(JSON.parse(result.output).error)
 }
 const oversized={...fixture(),text:'字'.repeat(5*1024*1024)}
 const result=await request(oversized,()=>assert.fail());assert.equal(result.code,413)
 const legacy=await request({mode:'chat',text:'x'.repeat(300001)},()=>assert.fail());assert.equal(legacy.code,413,'other modes retain the original 300 KB cap')
})

test('incompatible image endpoints, incomplete JSON and model action fields fail without a usable draft',async()=>{
 const rejected=await request({...fixture(),stream:true},async()=>new Response('private provider error',{status:400}))
 assert.match(rejected.output,/未接受图片请求/);assert.doesNotMatch(rejected.output,/event: done|private provider error/)
 for(const value of ['{"kind":"draft"', {...reply,result:'未见异常'},{...reply,submit:true},'```json\n'+JSON.stringify(reply)+'\n```']){
  const result=await request({...fixture(),stream:true},async()=>modelResponse(value))
  assert.match(result.output,/event: error/);assert.doesNotMatch(result.output,/event: done/)
 }
 const question={kind:'question',text:'液压动作实际检查了哪些部位，是否已记录动作情况？'}
 const body=fixture();body.images=[];body.attachments=[];body.text='帮我完成这一步';body.event.tasks[0].draft.records[0].note=''
 const result=await request({...body,stream:true},async()=>modelResponse(question))
 assert.match(result.output,/"kind":"question"/)
})

test('stream client validates step-assist drafts and does not accept unexpected task operations',async t=>{
 t.mock.method(globalThis,'fetch',async()=>stream(frame('done',{stepAssist:reply,answer:reply.text,source:'scripted-demo',model:'c2-step-demo'})))
 const received=await aiStreamRequest({mode:'step-assist'},()=>{})
 assert.deepEqual(received.stepAssist,reply);assert.equal(received.source,'scripted-demo');assert.equal(received.model,'c2-step-demo')
 globalThis.fetch=async()=>stream(frame('done',{stepAssist:{...reply,result:'未见异常'}}))
 await assert.rejects(aiStreamRequest({mode:'step-assist'},()=>{}),/未允许的操作/)
 globalThis.fetch=async()=>stream(frame('done',{answer:'只有普通文字'}))
 await assert.rejects(aiStreamRequest({mode:'step-assist'},()=>{}),/格式不完整/)
})
