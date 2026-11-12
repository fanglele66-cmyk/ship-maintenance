import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {invokeModel} from '../server/model.mjs'
import {sendKnowledgeQuestion} from '../src/composables/knowledgeChat.js'

const provider={baseUrl:'https://api.deepseek.com',apiKey:'test-key',model:'deepseek-v4-flash',protocol:'openai'}
const config={maxTokens:4096,timeoutMs:5000}
const frame=(type,data)=>`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
const response=wire=>new Response(wire,{headers:{'Content-Type':'text/event-stream'}})

test('DeepSeek thinking and answer channels stream separately and are explicitly enabled',async()=>{
 const chunks=[{choices:[{delta:{reasoning_content:'先核对读数。'}}]},{choices:[{delta:{reasoning_content:'再比较工况。',content:'建议核对现场读数。'}}]},{choices:[{delta:{},finish_reason:'stop'}]}]
 const events=[];let body
 const result=await invokeModel(provider,config,'system','question',async(_url,options)=>{body=JSON.parse(options.body);return response(chunks.map(data=>'data: '+JSON.stringify(data)+'\n\n').join('')+'data: [DONE]\n\n')},{onReasoning:delta=>events.push(['reasoning',delta]),onDelta:delta=>events.push(['text',delta])})
 assert.deepEqual(body.thinking,{type:'enabled'})
 assert.deepEqual(events,[['reasoning','先核对读数。'],['reasoning','再比较工况。'],['text','建议核对现场读数。']])
 assert.equal(result.reasoning,'先核对读数。再比较工况。');assert.equal(result.text,'建议核对现场读数。')
})

test('Anthropic-compatible thinking blocks and deltas exclude signatures and redacted blocks',async()=>{
 const wire=frame('content_block_start',{content_block:{type:'thinking',thinking:'核对依据。'}})+frame('content_block_delta',{delta:{type:'thinking_delta',thinking:'保留未确认项。'}})+frame('content_block_delta',{delta:{type:'signature_delta',signature:'signature-must-stay-hidden'}})+frame('content_block_start',{content_block:{type:'redacted_thinking',data:'redacted-must-stay-hidden'}})+frame('content_block_delta',{delta:{type:'text_delta',text:'已整理建议。'}})+frame('message_stop',{})
 let sent
 const result=await invokeModel({...provider,protocol:'anthropic',baseUrl:provider.baseUrl+'/anthropic'},config,'s','u',async(_url,options)=>{sent=JSON.parse(options.body);return response(wire)},{onReasoning(){},onDelta(){}})
 assert.deepEqual(sent.thinking,{type:'enabled'});assert.equal(result.reasoning,'核对依据。保留未确认项。')
 assert.equal(result.text,'已整理建议。');assert.doesNotMatch(JSON.stringify(result),/must-stay-hidden/)
})

test('non-stream responses retain only explicit provider thinking; no provider reasoning means no invented reasoning',async()=>{
 for(const protocol of ['openai','anthropic']){
  const data=protocol==='openai'?{choices:[{message:{content:'回答',reasoning_content:'真实渠道内容'}}]}:{content:[{type:'thinking',thinking:'真实渠道内容'},{type:'text',text:'回答'},{type:'redacted_thinking',data:'hidden'}]}
  const events=[]
  const result=await invokeModel({...provider,protocol},config,'s','u',async()=>({ok:true,json:async()=>data}),{onReasoning:delta=>events.push(delta)})
  assert.equal(result.reasoning,'真实渠道内容');assert.deepEqual(events,['真实渠道内容'])
 }
 const result=await invokeModel(provider,config,'s','u',async()=>({ok:true,json:async()=>({choices:[{message:{content:'<think>正文标签不是推理渠道</think>回答'}}]})}),{onReasoning:()=>assert.fail('must not infer reasoning from text')})
 assert.equal(result.reasoning,'')
})

test('knowledge thinking is retained after streaming and reload but excluded from subsequent model history',async()=>{
 const session={messages:[]}
 const reply=await sendKnowledgeQuestion(session,'第一个问题','主机',async(_body,emit)=>{
  emit('meta',{sources:[{id:'K1'}]});emit('reasoning',{delta:'原始模型推理'});assert.equal(session.messages.at(-1).reasoning,'原始模型推理')
  emit('text',{delta:'正文'});return {answer:'完整正文',reasoning:'原始模型推理',sources:[{id:'K1'}]}
 })
 assert.equal(JSON.parse(JSON.stringify(reply)).reasoning,'原始模型推理')
 await sendKnowledgeQuestion(session,'下一个问题','主机',async(body)=>{assert.doesNotMatch(JSON.stringify(body.history),/原始模型推理/);return {answer:'后续正文'}})
})

test('right-hand model and task replies render thinking before content and references only after completion',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {default:Reply}=await server.ssrLoadModule('/src/components/ModelReply.vue')
  const {default:Step}=await server.ssrLoadModule('/src/components/StepNoteProposal.vue')
  const render=(component,message)=>renderToString(createSSRApp(component,{message}))
  const sources=[{id:'K1',title:'操作规程',file:'concepts/操作规程.md'}]
  for(const [component,content] of [[Reply,{text:'正文已开始'}],[Step,{stepIndex:0,response:{kind:'draft',text:'正文已开始',note:'已记录现场读数。'}}]]){
   const message={...content,status:'streaming',reasoning:'核对 <现场> 读数。',sources,progressLog:[{label:'不应展示的程序进度'}]}
   const streaming=await render(component,message)
   assert.match(streaming,/思考过程/);assert.match(streaming,/&lt;现场&gt;/);assert.doesNotMatch(streaming,/<现场>|参考资料|不应展示的程序进度|分析摘要与处理进度|处理进度/)
   assert.ok(streaming.indexOf('思考过程')<streaming.indexOf('正文已开始'))
   const complete=await render(component,{...message,status:'complete'})
   assert.ok(complete.indexOf('参考资料')>complete.indexOf('正文已开始'));assert.doesNotMatch(complete,/<details[^>]* open/)
   assert.match(await render(component,{...message,status:'interrupted'}),/已中断/)
   assert.doesNotMatch(await render(component,{...message,status:'interrupted'}),/参考资料/)
   assert.doesNotMatch(await render(component,{...message,status:'complete',reasoning:undefined}),/思考过程/)
  }
  const thinking=await render(Reply,{status:'streaming',reasoning:'正在核对',sources})
  assert.match(thinking,/<details[^>]* open/);assert.doesNotMatch(thinking,/参考资料/)
  const revision=await render(Reply,{status:'complete',reasoning:'核对原始报告',sources,proposal:{reportTitle:'报告名称',baseMarkdown:'原文',patch:{summary:'修订结论',analysis:{evidence:'事实',interpretation:'判断',unverified:'缺口',next:'建议'}}}})
  assert.ok(revision.indexOf('参考资料')>revision.indexOf('确认补充并更新报告'))
 }finally{await server.close()}
})
