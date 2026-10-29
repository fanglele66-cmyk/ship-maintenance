import test from 'node:test'
import assert from 'node:assert/strict'
import {observationAdvice,observationAdviceRequest,updateObservationAdvice} from '../src/workflow/observationAdvice.js'
import {createLifecycleState,decide,submitTask,currentTask,people,ensureTaskPlan} from '../src/workflow/eventLifecycle.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
import {createAiHandler} from '../server/ai-api.mjs'
import {Readable} from 'node:stream'

function fixture(hours=3){
 const state=createLifecycleState(),id='real-alarm-0430',event=state.events[id],now=Date.now()
 const assign=action=>{state.role='captain';decide(state,id,{action,reason:ensureTaskPlan(event).scope,owner:people.engineer,deadline:new Date(now+86400000).toISOString()})}
 const submit=()=>{state.role='engineer';const task=currentTask(event);task.draft.records.forEach(r=>r.result=task.kind==='investigation'?'发现异常':'已完成');task.draft.summary='已处理确认的卡滞，完成试车，需核对修后观察。';submitTask(state,id)}
 assign('investigate');submit();assign('repair');submit();state.role='captain'
 const task=currentTask(event);task.submittedAt=new Date(now-hours*3600000).toISOString();syncLifecycleObservations(state,{},now,{demo:true})
 return {state,id,event,task,phaseId:event.phases.at(-1).id}
}
test('two hours of valid stable observation recommends manual closure without another window',()=>{
 const {event,task}=fixture(),before=JSON.stringify(event),advice=observationAdvice(event,task)
 assert.equal(advice.status,'review');assert.equal(advice.label,'推荐闭环');assert.match(advice.summary,/指标平稳/);assert.match(advice.timing,/推荐本轮闭环/)
 assert.ok(advice.evidence.completeWindow);assert.equal(JSON.stringify(event),before)
 const prompt=observationAdviceRequest(event,task,advice)
 assert.equal(prompt.mode,'observation');assert.match(prompt.text,/不要要求再等一个完整周期/);assert.match(prompt.text,/不作为本轮闭环的新增前置条件/);assert.ok(prompt.text.includes(task.observation.pending.channels[0].value.toString()))
})
test('fresh partial windows and missing channels never inherit a previous complete window decision',()=>{
 const {event,task}=fixture(1);assert.equal(observationAdvice(event,task).status,'waiting');assert.match(observationAdvice(event,task).summary,/数据质量良好/);assert.match(observationAdvice(event,task).timing,/未满两小时/)
 const complete=fixture();complete.task.observation.pending.channels[1].value=null;complete.task.observation.pending.channels[1].sampleCount=0
 assert.equal(observationAdvice(complete.event,complete.task).status,'incomplete')
 complete.task.observation.pending.channels[1].value=347;complete.task.observation.pending.channels[1].sampleCount=5;complete.task.observation.pending.channels[1].covered=false
 assert.equal(observationAdvice(complete.event,complete.task).status,'incomplete')
})
test('the first two-hour boundary is sufficient and existing old-rule advice is invalidated',()=>{
 const before=fixture(2-1/3600000),exact=fixture(2),nextTick=fixture(2+500/3600000)
 assert.equal(observationAdvice(before.event,before.task).status,'waiting')
 const advice=observationAdvice(exact.event,exact.task)
 assert.equal(advice.status,'review');assert.equal(advice.evidence.reachedTwoHours,true)
 assert.equal(nextTick.task.observation.pending.sampleCount,0);assert.equal(observationAdvice(nextTick.event,nextTick.task).status,'review')
 assert.equal(exact.task.observation.records.length,1);assert.equal(JSON.parse(advice.key)[0],2)
 assert.equal(Date.parse(advice.evidence.targetAt)-Date.parse(exact.task.submittedAt),7200000)
})
test('elapsed time alone never recommends closure for an unstable or empty trend',()=>{
 const {event,task}=fixture()
 task.observation.samples[0].at(-1).value+=50
 assert.equal(observationAdvice(event,task).status,'recheck')
 task.observation={records:[],pending:null,checkedAt:new Date().toISOString()}
 assert.equal(observationAdvice(event,task).status,'incomplete')
})
test('uncompleted repair and abnormal recheck feedback take priority over full sampling',()=>{
 const {event,task}=fixture();task.records[1].result='未完成'
 assert.equal(observationAdvice(event,task).status,'recheck')
 const recheck={id:'recheck',purpose:'recheck',records:[{label:'密封复核',result:'发现异常'}],summary:'仍有泄漏'}
 event.tasks.push(recheck);event.currentTask=recheck.id
 assert.match(observationAdvice(event,task).timing,/密封复核/)
})
test('model refresh key changes for windows or report revisions, not every new reading',()=>{
 const {event,task}=fixture(),before=observationAdvice(event,task).key
 task.observation.pending.channels[0].value+=0.1;task.observation.checkedAt=new Date(Date.parse(task.observation.checkedAt)+2000).toISOString()
 assert.equal(observationAdvice(event,task).key,before)
 event.reports.at(-1).summary+=' 执行人补充：仍需复核。'
 assert.notEqual(observationAdvice(event,task).key,before)
})
test('dismissal persists per review, is captain-only, and never blocks manual closure',()=>{
 const {state,id,event,phaseId}=fixture();const before=event.tasks.length
 updateObservationAdvice(state,id,phaseId,{dismissed:true})
 assert.equal(JSON.parse(JSON.stringify(state)).events[id].observationAdvice[phaseId].dismissed,true)
 assert.equal(event.phase,'review');assert.equal(event.tasks.length,before)
 state.role='engineer';assert.throws(()=>updateObservationAdvice(state,id,phaseId,{dismissed:false}),/只有轮机长/)
 state.role='captain';assert.throws(()=>updateObservationAdvice(state,id,'previous',{dismissed:false}),/当前观察/)
 decide(state,id,{action:'close',reason:'轮机长核实后人工闭环。'})
 assert.equal(event.phase,'closed');assert.throws(()=>updateObservationAdvice(state,id,phaseId,{answer:'late response'}),/当前观察/)
})
test('observation API enforces the two-hour instruction without appending generic waiting conditions',async()=>{
 const {event,task}=fixture(),body=observationAdviceRequest(event,task,observationAdvice(event,task));let sent,code,result
 const configuration={read:async()=>({source:'manual',baseUrl:'https://example.test',apiKey:'test-key',model:'test',protocol:'anthropic',maxTokens:1000,timeoutMs:5000,enabled:true,knowledgeEnabled:false})}
 const handler=createAiHandler(process.cwd(),{configuration,fetcher:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:'已满两小时，数据平稳，推荐本轮闭环。'}],usage:{input_tokens:10,output_tokens:10}})}}})
 async function call(role){const req=Readable.from([Buffer.from(JSON.stringify({...body,role}))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}});await handler(req,{set statusCode(v){code=v},setHeader(){},end(text){result=JSON.parse(text)}},()=>assert.fail())}
 await call('engineer');assert.equal(code,400);assert.equal(sent,undefined)
 await call('captain');assert.equal(code,200);assert.match(sent.system,/直接推荐本轮闭环/);assert.match(sent.system,/不要再等待下一周期/);assert.ok(!sent.system.includes('有技术判断时附简短的'));assert.match(result.answer,/推荐本轮闭环/)
})
