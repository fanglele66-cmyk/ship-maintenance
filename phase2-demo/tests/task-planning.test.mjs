import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,ensureTaskPlan,people} from '../src/workflow/eventLifecycle.js'
import {acceptTaskPlan,normalizeTaskPlan,taskPlanKey} from '../src/workflow/taskPlanning.js'
import {createAiHandler} from '../server/ai-api.mjs'
const id='real-alarm-0430',deadline=()=>new Date(Date.now()+86400000).toISOString()
const generated={scope:'核对上一轮未覆盖的二缸测量链路与报警时序。',rationale:'ICU机械动作与燃油供给未见异常，需要区分测温偏移与瞬态指令差异。',steps:[{label:'独立校验二缸测温链路',guide:'对照独立测温与采集通道，核实传感器、端子及时间对齐。',checks:['记录同刻测量结果与方法。'],recordHint:'提交独立读数、时间、对照结果与未确认项。'}]}
function dispatch(state,action){state.role='captain';const plan=ensureTaskPlan(state.events[id]);decide(state,id,{action,owner:people.engineer,deadline:deadline(),reason:plan.scope||'核对本轮范围。'})}
function submit(state,results){state.role='engineer';const task=currentTask(state.events[id]);task.draft.records.forEach((r,i)=>r.result=results?.[i]||task.steps[i].options[0]);task.draft.summary='实际检查结果已逐项登记，未实施范围外处理。';submitTask(state,id)}
function accept(state,plan=generated){const event=state.events[id],draft=ensureTaskPlan(event);return acceptTaskPlan(event,{key:draft.key,version:draft.version},{plan,usage:{inputTokens:1,outputTokens:2},sources:[]})}
test('a pre-dispatch preview is not an assigned task; edited steps are the dispatched steps',()=>{
 const state=createLifecycleState(),event=state.events[id],draft=ensureTaskPlan(event)
 assert.equal(draft.status,'ready');assert.ok(draft.steps.length);assert.equal(event.tasks.length,0);assert.deepEqual(event.participants,[])
 const updated=accept(state),steps=structuredClone(updated.steps);dispatch(state,'investigate')
 assert.deepEqual(currentTask(event).steps,steps);assert.equal(currentTask(event).scope,generated.scope)
 assert.equal(currentTask(event).draft.records.length,steps.length);assert.equal(currentTask(event).plan.source,'model')
 assert.equal(ensureTaskPlan(event),null)
})
for(const results of [['未见异常','未见异常'],['无法确认','未见异常']])test(`no abnormal result requires a new generated investigation: ${results}`,()=>{
 const state=createLifecycleState();dispatch(state,'investigate');submit(state,results);const event=state.events[id],first=structuredClone(event.tasks[0]),report=structuredClone(event.reports[0])
 assert.deepEqual(decisionOptions(event).map(o=>o.value),['investigate','shore']);assert.equal(ensureTaskPlan(event).steps.length,0)
 assert.throws(()=>dispatch(state,'repair'),/当前阶段/);assert.throws(()=>dispatch(state,'investigate'),/尚未生成/)
 const plan=accept(state);assert.notDeepEqual(plan.steps,first.steps);dispatch(state,'investigate')
 assert.equal(currentTask(event).round,2);assert.equal(currentTask(event).sourceReportId,report.id);assert.deepEqual({...event.tasks[0],goalStatus:first.goalStatus,reviewedAt:undefined},{...first,reviewedAt:undefined});assert.equal(event.tasks[0].goalStatus,results.includes('无法确认')?'unresolved':'completed');assert.deepEqual(event.reports[0],report)
})
test('one abnormal finding wins over normal and unknown findings and forbids repeat investigation',()=>{
 for(const other of ['未见异常','无法确认']){
  const state=createLifecycleState();dispatch(state,'investigate');submit(state,['发现异常',other]);const event=state.events[id]
  assert.deepEqual(decisionOptions(event).map(o=>o.value),['repair','shore']);assert.equal(ensureTaskPlan(event).action,'repair');assert.throws(()=>dispatch(state,'investigate'),/当前阶段/);dispatch(state,'repair');assert.equal(currentTask(event).kind,'repair')
 }
})
test('effect observation offers closure, recheck or continued observation; normal recheck returns to observation',()=>{
 const state=createLifecycleState();dispatch(state,'investigate');submit(state);dispatch(state,'repair');submit(state);const event=state.events[id],repair=currentTask(event)
 assert.deepEqual(decisionOptions(event).map(o=>o.value),['close','recheck','observe','shore']);assert.equal(ensureTaskPlan(event).action,'recheck');assert.throws(()=>dispatch(state,'recheck'),/尚未生成/)
 accept(state);dispatch(state,'recheck');assert.equal(currentTask(event).purpose,'recheck');assert.ok(repair.observationEndedAt)
 submit(state,['未见异常']);assert.equal(event.phase,'review');assert.deepEqual(decisionOptions(event).map(o=>o.value),['close','recheck','observe','shore'])
 state.role='captain';decide(state,id,{action:'close',reason:'结合复查和观察记录确认闭环。'});assert.equal(event.phase,'closed');assert.equal(ensureTaskPlan(event),null)
})
test('a recheck with an abnormal result returns to repair',()=>{
 const state=createLifecycleState();dispatch(state,'investigate');submit(state);dispatch(state,'repair');submit(state);accept(state);dispatch(state,'recheck');submit(state,['发现异常']);assert.deepEqual(decisionOptions(state.events[id]).map(o=>o.value),['repair','shore'])
})
test('late AI output cannot overwrite edited drafts, revised reports, dispatched tasks or closed events',()=>{
 for(const change of ['draft','report','dispatched','closed']){
  const state=createLifecycleState(),event=state.events[id],draft=ensureTaskPlan(event),expected={key:draft.key,version:draft.version}
  if(change==='draft'){draft.scope='人工修改范围';draft.version++}
  if(change==='report')event.reports.push({id:'new-report',markdown:'补充后的依据'})
  if(change==='dispatched')dispatch(state,'investigate')
  if(change==='closed')decide(state,id,{action:'false',reason:'核实误报，予以归档。'})
  assert.throws(()=>acceptTaskPlan(event,expected,{plan:generated}),/已有变化/)
 }
})
test('plan schema fixes execution options, rejects partial data and does not trust model action or role',()=>{
 assert.throws(()=>normalizeTaskPlan({scope:'只有范围'},'investigate'),/不完整/)
 const normalized=normalizeTaskPlan({...generated,action:'close',owner:'someone',steps:generated.steps.map(s=>({...s,options:['已确认故障']}))},'recheck')
 assert.deepEqual(normalized.steps[0].options,['发现异常','未见异常','无法确认']);assert.equal(normalized.action,undefined);assert.equal(normalized.owner,undefined)
})
test('plan API receives first-round findings, rejects wrong role or branch, returns only a complete plan',async()=>{
 const state=createLifecycleState();dispatch(state,'investigate');submit(state,['未见异常','未见异常']);const event=state.events[id];ensureTaskPlan(event)
 const config={source:'manual',baseUrl:'https://example.test',apiKey:'private',model:'demo',protocol:'anthropic',maxTokens:2000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 let modelInput,calls=0
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async(url,options)=>{calls++;modelInput=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify(generated)}]})}}})
 for(const [role,action,expected] of [['engineer','investigate',400],['captain','repair',400],['captain','investigate',200]]){
  const body={mode:'plan',role,text:'请依据首轮结果生成后续排查。',event,plan:{action}},req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
  let code,result;await handler(req,{set statusCode(v){code=v},setHeader(){},end(text){result=JSON.parse(text)}},()=>assert.fail());assert.equal(code,expected);if(expected===200)assert.equal(result.plan.scope,generated.scope);else assert.equal(result.plan,undefined)
 }
 assert.equal(calls,1);const context=JSON.parse(modelInput.messages[0].content);assert.ok(context.event.tasks[0].records.every(r=>r.result==='未见异常'));assert.ok(context.event.reports[0].markdown);assert.match(modelInput.system,/不要原样重复/)
 assert.equal(taskPlanKey(event),event.pendingPlan.key)
})
