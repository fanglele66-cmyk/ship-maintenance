import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Readable} from 'node:stream'
import {createLifecycleState,decide,submitTask,currentTask,people} from '../src/workflow/eventLifecycle.js'
import {supplementaryReports,applyReportSupplement} from '../src/workflow/reportRevisions.js'
import {lifecycleSampling} from '../src/mock/lifecycleSampling.js'
import {observationSettings} from '../src/workflow/lifecycleObservation.js'
import {parseReportPatch,invokeModel} from '../server/model.mjs'
import {createAiHandler} from '../server/ai-api.mjs'
import {configStore,publicProvider,maxOutputTokens} from '../server/ai-config.mjs'
import {createKnowledge} from '../server/knowledge.mjs'
const patch={summary:'执行人补充：插接件复核未见松动，液压活塞仍需拆检定位。',analysis:{evidence:'保留原始检查记录和执行人补充。',interpretation:'连接正常不能排除液压机构异常。',unverified:'液压活塞具体位置尚未确认。',next:'交由轮机长审阅后安排。'}}
function submitted(kind='investigation'){
 const state=createLifecycleState(),id='real-alarm-0430'
 const dispatch=action=>{state.role='captain';decide(state,id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:'核查已批准范围'})}
 const finish=()=>{state.role='engineer';const t=currentTask(state.events[id]);t.draft.records.forEach((r,i)=>r.result=t.steps[i].options[0]);t.draft.summary='记录原始事实，具体异常位置仍需核对。';submitTask(state,id)}
 dispatch('investigate');finish();if(kind==='repair'){dispatch('repair');finish()}
 const event=state.events[id],report=event.reports.at(-1)
 return {state,id,event,report,proposal:{id:'proposal-one',reportId:report.id,baseMarkdown:report.markdown,patch,text:'补充：插接件无松动，活塞尚未拆检。',model:'test-model',sources:[]}}
}
for(const kind of ['investigation','repair'])test(`${kind} supplement updates fixed report sections while preserving records and original`,()=>{
 const {state,id,event,report,proposal}=submitted(kind),original=report.markdown,records=structuredClone(currentTask(event).records),phase=event.phase
 applyReportSupplement(state,id,proposal)
 assert.equal(report.summary,patch.summary);assert.equal(report.original.markdown,original);assert.equal(report.revisions[0].before.markdown,original)
 assert.deepEqual(currentTask(event).records,records);assert.equal(event.phase,phase);assert.equal(report.id,proposal.reportId)
 assert.ok(report.markdown.includes('## 提交后补充记录'));assert.ok(report.markdown.includes('## AI分析'));assert.ok(report.markdown.includes(proposal.text))
 assert.equal(event.conversations.captain.at(-1).reportId,report.id);assert.throws(()=>applyReportSupplement(state,id,proposal),/已经写入/)
 const reloaded=JSON.parse(JSON.stringify(state));assert.equal(reloaded.events[id].reports.at(-1).original.markdown,original)
})
test('supplement refuses wrong role, closed events, other reports and stale proposals',()=>{
 const {state,id,event,report,proposal}=submitted();state.role='captain';assert.equal(supplementaryReports(event,state.role).length,0);assert.throws(()=>applyReportSupplement(state,id,proposal),/不能补充/)
 state.role='engineer';assert.throws(()=>applyReportSupplement(state,id,{...proposal,reportId:'other'}),/不能补充/)
 report.markdown+='\nnew';assert.throws(()=>applyReportSupplement(state,id,proposal),/已有更新/)
 event.phase='closed';assert.throws(()=>applyReportSupplement(state,id,proposal),/不能补充/)
})
test('model report structure rejects malformed or missing sections',()=>{
 assert.deepEqual(parseReportPatch(JSON.stringify(patch)),patch)
 assert.throws(()=>parseReportPatch('plain prose'),/有效/);assert.throws(()=>parseReportPatch('{"summary":"一段不完整的报告结论"}'),/不完整/)
})
test('provider adapter uses only display text, reports usage and never returns reasoning',async()=>{
 let request
 const result=await invokeModel({baseUrl:'https://example.test/v1',apiKey:'secret',model:'demo',protocol:'anthropic'},{maxTokens:1000,timeoutMs:5000},'system','user',async(url,options)=>{request={url,...options};return {ok:true,json:async()=>({model:'demo',content:[{type:'thinking',thinking:'private'},{type:'text',text:'回答'}],usage:{input_tokens:5,output_tokens:9}})}})
 assert.equal(request.url,'https://example.test/v1/messages');assert.equal(result.text,'回答');assert.equal(result.usage.outputTokens,9);assert.ok(!JSON.stringify(result).includes('secret'))
 await assert.rejects(invokeModel({baseUrl:'https://example.test',apiKey:'secret',model:'demo'},{timeoutMs:5000},'s','u',async()=>({ok:false,status:401})),/HTTP 401/)
})
test('config is stored locally and public response excludes key',async()=>{
 const root=await mkdtemp(join(tmpdir(),'engine-config-'))
 try{const store=configStore(root);await store.write({source:'manual',model:'demo',baseUrl:'https://example.test',apiKey:'private-key'});assert.equal((await store.read()).apiKey,'private-key');assert.equal(publicProvider(await store.read()).apiKey,undefined);await assert.rejects(store.write({timeoutMs:1}),/超出范围/)}finally{await rm(root,{recursive:true,force:true})}
})
test('configured DeepSeek output ceiling survives persistence and reaches the provider unchanged',async()=>{
 const root=await mkdtemp(join(tmpdir(),'engine-output-limit-'))
 try{
  const store=configStore(root),settings=await store.write({maxTokens:maxOutputTokens,taskMaxTokens:maxOutputTokens})
  assert.equal(settings.maxTokens,393216);assert.equal((await store.read()).taskMaxTokens,393216)
  for(const key of ['maxTokens','taskMaxTokens'])await assert.rejects(store.write({[key]:maxOutputTokens+1}),/超出范围/)
  let sent
  await invokeModel({baseUrl:'https://example.test',apiKey:'test-key',model:'test',protocol:'anthropic'},settings,'s','u',async(url,options)=>{
   sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:'已完成'}]})}
  })
  assert.equal(sent.max_tokens,maxOutputTokens)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('task-scoped chat reaches the model with only its supplied task context and no event decision actions',async()=>{
 let sent,code,result
 const configuration={read:async()=>({source:'manual',baseUrl:'https://example.test',apiKey:'test-key',model:'test',protocol:'anthropic',maxTokens:1000,timeoutMs:5000,enabled:true,knowledgeEnabled:false})}
 const handler=createAiHandler(process.cwd(),{configuration,fetcher:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:'请核对本次任务记录。'}],usage:{input_tokens:10,output_tokens:10}})}}})
 const req=Readable.from([Buffer.from(JSON.stringify({text:'本次任务需要注意什么？',role:'engineer',mode:'chat',event:{id:'task-event',phase:'review',currentTask:'task-one',tasks:[{id:'task-one',status:'submitted',scope:'本轮范围'}],reports:[],taskContext:{title:'本轮排查',scope:'本轮范围'}}}))])
 Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 await handler(req,{set statusCode(v){code=v},setHeader(){},end(text){result=JSON.parse(text)}},()=>assert.fail())
 assert.equal(code,200);assert.match(sent.system,/已派发任务的独立视图/);assert.match(result.answer,/本次任务/)
 const data=JSON.parse(sent.messages.at(-1).content)
 assert.deepEqual(data.availableDecisions,[]);assert.deepEqual(data.event.tasks.map(t=>t.id),['task-one']);assert.equal(data.event.taskContext.scope,'本轮范围')
})
test('knowledge retrieval retains exact document line provenance without reading images',async()=>{
 const root=await mkdtemp(join(tmpdir(),'engine-kb-'))
 try{await writeFile(join(root,'ICU.md'),'# 喷射控制单元ICU\n\n伺服油液压活塞卡滞需要检查反馈。');await writeFile(join(root,'image.jpg'),'not text');const kb=createKnowledge(root);assert.equal((await kb.status()).documents,1);const sources=await kb.search('ICU伺服油活塞');assert.equal(sources[0].file,'ICU.md');assert.equal(sources[0].startLine,1);assert.ok(sources[0].text.includes('卡滞'))}finally{await rm(root,{recursive:true,force:true})}
})
test('local API blocks cross-origin and remote calls before model access',async()=>{
 const handler=createAiHandler(process.cwd(),{configuration:{read(){assert.fail('must not read secrets')}}})
 for(const remote of ['192.168.1.2','127.0.0.1']){
  const req=Readable.from([]);Object.assign(req,{url:'/api/ai/config',method:'GET',socket:{remoteAddress:remote},headers:{host:'localhost:5173',origin:'https://evil.test','x-engine-room-client':'local-ui'}})
  let code;await handler(req,{set statusCode(v){code=v},setHeader(){},end(){}},()=>assert.fail());assert.equal(code,403)
 }
})
test('report API rejects provider failures and incomplete revisions without returning an applicable patch',async()=>{
 const config={source:'manual',baseUrl:'https://example.test',apiKey:'private-test-key',model:'demo',protocol:'anthropic',maxTokens:1000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 const {event,report}=submitted()
 const body={text:'补充现场记录。',mode:'report',role:'engineer',actor:people.engineer,event:{id:event.id,phase:event.phase},report}
 for(const fetcher of [async()=>({ok:false,status:503}),async()=>({ok:true,json:async()=>({content:[{type:'text',text:'{"summary":"只有结论但缺少分析章节"}'}]})})]){
  const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher})
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173',origin:'http://localhost:5173','x-engine-room-client':'local-ui'}})
  let code,result;await handler(req,{set statusCode(v){code=v},setHeader(){},end(text){result=JSON.parse(text)}},()=>assert.fail())
  assert.equal(code,400);assert.ok(result.error);assert.equal(result.patch,undefined);assert.ok(!JSON.stringify(result).includes('private-test-key'))
 }
})
test('automatic demo samples grow left to right, are deterministic, bounded and stop on archive',()=>{
 for(const event of Object.values(createLifecycleState().events)){
  const start=Date.now()-10000,task={id:'sampling',submittedAt:new Date(start).toISOString()},config=observationSettings(event)
  const first=lifecycleSampling(event,task,config,start+4000),later=lifecycleSampling(event,task,config,start+10000)
  assert.deepEqual(later[0].trendData.slice(0,2),first[0].trendData);assert.equal(later[0].trendData.length,5)
  for(const channel of later){assert.equal(channel.sourceKind,'prototype');assert.ok(channel.trendData.every(p=>Number.isFinite(p.value)&&p.timestamp>start&&p.timestamp<=start+10000));if(channel.unit==='MPa')assert.ok(channel.trendData.every(p=>p.value>0.6&&p.value<0.8))}
  task.observationEndedAt=new Date(start+4000).toISOString();assert.deepEqual(lifecycleSampling(event,task,config,start+10000),first)
 }
})
