import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,ensureTaskPlan,people,refreshLifecyclePresentation,pendingDecision} from '../src/workflow/eventLifecycle.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
import {observationTaskFor,isVerificationReview} from '../src/workflow/observationContext.js'
import {observationAdvice,observationAdviceRequest} from '../src/workflow/observationAdvice.js'
import {lifecycleWorkItems,lifecycleNotifications} from '../src/workflow/lifecycleWorkItems.js'
import {taskPlanKey,acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {createAiHandler} from '../server/ai-api.mjs'
import {Readable} from 'node:stream'

const alarm='real-alarm-0430'
function verified(id=alarm){
 const state=createLifecycleState(),event=state.events[id]
 if(!event.tasks.length){
  decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:'现场核实原异常与测点记录。'})
  state.role='engineer'
  const task=currentTask(event)
  task.draft.records.forEach((r,i)=>r.result=task.steps[i].options.find(v=>/未见异常|现场[与和]系统一致|信息已记录/.test(v))||task.steps[i].options[0])
  task.draft.summary='现场核实已完成，保留原变化与记录；尚未实施维修。'
  submitTask(state,id,task.id)
 }
 state.role='captain'
 return {state,event,id,task:currentTask(event)}
}
function observe(fixture){
 decide(fixture.state,fixture.id,{action:'observe',reason:'现场核实后暂不处置，观察变化的持续性、回落及复发。'})
 return fixture
}
for(const id of [alarm,'real-warning-0523','real-tracking-exhaust-baseline','real-health-c4-baseline'])test(id+': investigation can enter observation without manufacturing a repair or task',()=>{
 const f=verified(id),report=structuredClone(f.event.reports.at(-1)),count=f.event.tasks.length
 assert.ok(decisionOptions(f.event).some(o=>o.value==='observe'))
 f.task.submittedAt=new Date(Date.now()-86400000).toISOString()
 const before=Date.now();observe(f)
 assert.equal(f.event.phase,'review');assert.equal(f.event.status,'效果观察中')
 assert.equal(f.event.tasks.length,count);assert.equal(f.task.observationMode,'verification')
 assert.ok(Date.parse(f.task.observationStartedAt)>=before)
 assert.equal(observationTaskFor(f.event).id,f.task.id)
 assert.deepEqual(f.event.reports.at(-1),report)
 assert.deepEqual(decisionOptions(f.event).map(o=>o.value),['close','recheck','repair','shore'])
 assert.ok(!pendingDecision(f.event));assert.ok(!lifecycleWorkItems(f.state).pending.some(i=>i.eventId===id))
 const due=Date.parse(f.event.phases.at(-1).observationDueAt)
 assert.equal(due-Date.parse(f.task.observationStartedAt),7200000)
 syncLifecycleObservations(f.state,{},due-1000,{demo:true})
 assert.ok(f.task.observation.pending.sampleCount>0);assert.ok(!pendingDecision(f.event))
 syncLifecycleObservations(f.state,{},due,{demo:true})
 assert.ok(pendingDecision(f.event));assert.equal(lifecycleNotifications(f.state).filter(n=>n.eventId===id).length,1)
 const saved=refreshLifecyclePresentation(JSON.parse(JSON.stringify(f.state)))
 assert.equal(observationTaskFor(saved.events[id]).id,f.task.id)
 assert.equal(saved.events[id].tasks[0].observationEndedAt,null)
 assert.ok(decisionOptions(saved.events[id]).some(o=>o.value==='observe'))
})
test('waiting-period manual closure preserves verification sampling without recording any repair',()=>{
 const f=observe(verified());syncLifecycleObservations(f.state,{},Date.now()+2000,{demo:true})
 // Close at a timestamp after the saved sample, with actual state kept local.
 f.task.observation.pending.windowEnd=new Date().toISOString()
 decide(f.state,f.id,{action:'close',reason:'核对原变化已回落，保留观察记录并确认本轮闭环。'})
 const report=f.event.reports.at(-1)
 assert.match(report.markdown,/核实后继续观察，本轮暂未处置/);assert.match(report.markdown,/未提交维修或维保作业报告/)
 assert.ok(f.task.observationEndedAt);assert.equal(f.event.phase,'closed')
})
test('verification review offers a repair draft matching the chosen action and rejects stale recheck output',()=>{
 const f=observe(verified()),draft=ensureTaskPlan(f.event),old={key:draft.key,version:draft.version}
 assert.equal(draft.action,'recheck');assert.ok(draft.steps.length)
 assert.doesNotMatch(draft.steps.map(s=>s.label).join(' '),/维修记录|修后|处理部位/)
 f.event.decisionDraft={action:'repair',reason:'仅处理后续证据确认的部位。'}
 const repair=ensureTaskPlan(f.event)
 assert.equal(repair.action,'repair');assert.equal(f.event.decisionDraft.action,'repair');assert.notEqual(taskPlanKey(f.event),old.key)
 assert.throws(()=>acceptTaskPlan(f.event,old,{plan:{}}),/已有变化/)
 decide(f.state,f.id,{action:'repair',reason:repair.scope,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 assert.equal(currentTask(f.event).kind,'repair');assert.ok(f.task.observationEndedAt)
})
test('verification recheck returns to the same observation context; old task draft and report remain immutable',()=>{
 const f=observe(verified()),plan=ensureTaskPlan(f.event);plan.status='ready'
 decide(f.state,f.id,{action:'recheck',reason:plan.scope,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const recheck=currentTask(f.event);f.state.role='engineer';recheck.draft.records.forEach(r=>r.result='未见异常');recheck.draft.summary='复查范围内未见新增异常，原观察继续保留。'
 submitTask(f.state,f.id,recheck.id);f.state.role='captain'
 assert.ok(isVerificationReview(f.event));assert.equal(observationTaskFor(f.event).id,f.task.id)
 decide(f.state,f.id,{action:'observe',reason:'复查后继续观察至本轮汇总时刻。'})
 assert.equal(f.task.observationEndedAt,null);assert.ok(f.task.observationResumedAt)
})
test('verification advice distinguishes a persistent trend from a repaired and restored component',()=>{
 const f=observe(verified('real-tracking-exhaust-baseline')),end=Date.parse(f.task.observationStartedAt)+7200000
 syncLifecycleObservations(f.state,{},end,{demo:true})
 const advice=observationAdvice(f.event,f.task),request=observationAdviceRequest(f.event,f.task,advice)
 assert.ok(advice.verification);assert.equal(advice.label,'请审阅观察结果')
 assert.match(advice.summary,/平稳本身不表示原偏差已消失/);assert.match(request.text,/未实施维修/);assert.match(request.text,/持续、扩大、恢复或复发/)
 assert.ok(f.task.observation.samples[0].at(-1).value>8)
 ;(f.task.observation.pending||f.task.observation.records.at(-1)).channels[0].covered=false
 assert.equal(observationAdvice(f.event,f.task).status,'incomplete')
})
test('verification observation API uses verification-specific instructions and decisions',async()=>{
 const f=observe(verified()),body=observationAdviceRequest(f.event,f.task,observationAdvice(f.event,f.task));let sent,status
 const configuration={read:async()=>({source:'manual',baseUrl:'https://example.test',apiKey:'test-key',model:'test',protocol:'anthropic',maxTokens:1000,timeoutMs:5000,enabled:true,knowledgeEnabled:false})}
 const handler=createAiHandler(process.cwd(),{configuration,fetcher:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:'本轮暂未处置，继续跟踪异常是否复发。'}],usage:{input_tokens:10,output_tokens:10}})}}})
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 await handler(req,{set statusCode(v){status=v},setHeader(){},end(){}},()=>assert.fail())
 assert.equal(status,200);assert.match(sent.system,/核实后继续观察/);assert.doesNotMatch(sent.system,/本次输出修后观察建议/)
 assert.ok(JSON.parse(sent.messages.at(-1).content).availableDecisions.some(o=>o.value==='repair'))
})
