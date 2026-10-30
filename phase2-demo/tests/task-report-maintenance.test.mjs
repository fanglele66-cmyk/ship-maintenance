import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,ensureTaskPlan,people,refreshLifecyclePresentation} from '../src/workflow/eventLifecycle.js'
import {generateTaskReport,recoverTaskReportGeneration} from '../src/workflow/taskReportGeneration.js'
import {maintenancePlans,availableMaintenanceWindows} from '../src/workflow/maintenancePlans.js'
import {lifecycleWorkItems} from '../src/workflow/lifecycleWorkItems.js'
import {createAiHandler} from '../server/ai-api.mjs'
import {aiStreamRequest} from '../src/services/aiClient.js'
const id='real-tracking-exhaust-baseline'
const patch={summary:'现场与系统一致，背景信息已记录，异动已核实。',analysis:{evidence:'本轮两项现场记录均已回交。',interpretation:'支持异动成立，不等同于确认部件损坏。',unverified:'具体部件原因待计划内检查确认。',next:'选择维保计划和靠港时间提前执行。'}}
const model={patch,model:'test-model',usage:{inputTokens:120,outputTokens:80},sources:[]}
function ready(){const state=createLifecycleState();decide(state,id,{action:'investigate',reason:'核实长期排温变化',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()});state.role='engineer';const task=currentTask(state.events[id]);task.draft.records.forEach((r,i)=>{r.result=i?'信息已记录':'现场与系统一致';r.note='现场原始记录 '+i});task.draft.summary='现场与系统对应，已记录月度工况和调整信息。';return {state,event:state.events[id],task}}
test('first report streams real response fields before final handoff and preserves raw records',async()=>{
 const {state,event,task}=ready(),original=JSON.parse(JSON.stringify(task.draft));let finish,calls=0
 const pending=generateTaskReport(state,id,task.id,async(body,on)=>{calls++;assert.equal(body.mode,'submit-report');assert.deepEqual(body.event.tasks[0].records,original.records);on('progress',{label:'分析本轮反馈'});on('report',{patch:{summary:'现场与系统一致',analysis:{}}});return new Promise(resolve=>finish=resolve)})
 assert.equal(task.status,'reporting');assert.equal(event.reports.length,0);assert.equal(event.phase,'investigation');assert.match(task.reportGeneration.patch.summary,/现场/)
 await assert.rejects(generateTaskReport(state,id,task.id,async()=>assert.fail()),/正在生成/)
 state.role='captain';assert.equal(lifecycleWorkItems(state).pending.some(t=>t.eventId===id),false)
 finish(model);const report=await pending
 assert.equal(calls,1);assert.equal(task.status,'submitted');assert.equal(event.phase,'decision');assert.equal(report.summary,patch.summary);assert.deepEqual(report.usage,model.usage);assert.deepEqual(task.records,original.records);assert.equal(task.summary,original.summary)
 assert.match(report.markdown,/现场原始记录 0/);assert.match(report.markdown,/具体部件原因待计划内检查确认/)
 assert.deepEqual(decisionOptions(event).map(o=>o.value),['maintenance','shore'])
 assert.equal(task.conversations.engineer.filter(m=>m.kind==='user').length,1)
 refreshLifecyclePresentation(state);assert.equal(report.summary,patch.summary)
})
test('failed or malformed report retains feedback; retry creates exactly one report',async()=>{
 const {state,event,task}=ready()
 await assert.rejects(generateTaskReport(state,id,task.id,async(body,on)=>{on('report',{patch:{summary:'部分内容',analysis:{}}});throw Error('连接中断')}),/连接中断/)
 assert.equal(task.status,'report-error');assert.equal(event.reports.length,0);assert.equal(event.phase,'investigation');assert.ok(lifecycleWorkItems(state).pending.some(t=>t.taskId===task.id))
 task.draft.summary='未提交的意外草稿变化'
 await assert.rejects(generateTaskReport(state,id,task.id,async()=>({patch:{summary:'只有结论'}})),/不完整/)
 const report=await generateTaskReport(state,id,task.id,async body=>{assert.notEqual(body.event.tasks[0].summary,task.draft.summary);return model})
 assert.equal(event.reports.length,1);assert.equal(task.conversations.engineer.filter(m=>m.kind==='user').length,1);assert.ok(report.id)
})
test('reload recovery is scoped to the generating session; another role tab does not cancel it',async()=>{
 const {state,task}=ready();let finish
 const pending=generateTaskReport(state,id,task.id,()=>new Promise(resolve=>finish=resolve),{ownerSession:'one'})
 recoverTaskReportGeneration(state,'two');assert.equal(task.status,'reporting')
 recoverTaskReportGeneration(state,'one');assert.equal(task.status,'report-error')
 finish(model);await assert.rejects(pending,/状态已变化/);assert.equal(state.events[id].reports.length,0)
})
test('unknown, restricted or inconsistent tracking feedback never silently enables early maintenance',()=>{
 for(const results of [['现场与系统一致','无法确认'],['现场与系统一致','条件受限，已记录限制'],['无法确认','信息已记录'],['读数不一致','信息已记录']]){
  const {state,event,task}=ready();task.draft.records.forEach((r,i)=>r.result=results[i]);submitTask(state,id,task.id)
  assert.ok(!decisionOptions(event).some(o=>o.value==='maintenance'))
 }
})
test('early maintenance validates plan/window, snapshots selected steps, hands off and closes',async()=>{
 const {state,event,task}=ready();await generateTaskReport(state,id,task.id,async()=>model);state.role='captain'
 const plan=maintenancePlans(event)[1],window=availableMaintenanceWindows()[0],form={action:'maintenance',reason:'已核实异动，按批准计划提前维保',owner:people.engineer,deadline:window.end,maintenancePlanId:plan.id,window:window.id}
 assert.throws(()=>decide(state,id,{...form,maintenancePlanId:'wrong'}),/维保计划/)
 assert.throws(()=>decide(state,id,{...form,window:'expired'}),/靠港/)
 assert.throws(()=>decide(state,id,{...form,deadline:'2026-11-20T00:00:00Z'}),/窗口内/)
 event.decisionDraft={maintenancePlanId:plan.id};const draft=ensureTaskPlan(event);assert.deepEqual(draft.steps,plan.steps)
 decide(state,id,form);const work=currentTask(event)
 assert.equal(work.kind,'maintenance');assert.equal(work.maintenance.plan.id,plan.id);assert.equal(work.maintenance.window.id,window.id);assert.deepEqual(work.steps,plan.steps);assert.ok(work.steps.length<=4)
 assert.equal(lifecycleWorkItems(state).pending.some(t=>t.eventId===id),false);state.role='engineer';assert.ok(lifecycleWorkItems(state).pending.some(t=>t.taskId===work.id))
 work.draft.records.forEach(r=>{r.result='已完成';r.note='按所选计划完成并记录复测'});work.draft.summary='本轮按计划完成维保和复测，无未完成项目。'
 await generateTaskReport(state,id,work.id,async()=>({...model,patch:{...patch,summary:work.draft.summary}}));assert.equal(event.phase,'review');assert.match(event.reports.at(-1).markdown,new RegExp(plan.id))
 state.role='captain';decide(state,id,{action:'close',reason:'本次维保记录和复测结果已核对，确认闭环。'});assert.equal(event.phase,'closed');assert.match(event.reports.at(-1).markdown,new RegExp(plan.id));assert.equal(task.goalStatus,'completed')
})
test('control air event stays warning in fresh and restored state',()=>{
 const state=createLifecycleState(),event=state.events['real-warning-0523'];assert.equal(event.type,'预警事件');event.type='报警事件';refreshLifecyclePresentation(state);assert.equal(event.type,'预警事件');assert.match(event.brief.discovery.label,/预警/)
})
test('submission API invokes provider, streams report previews and validates completed structure',async()=>{
 const {state,event,task}=ready();let sent,calls=0
 const config={source:'manual',baseUrl:'https://example.test',apiKey:'test-private',model:'test',protocol:'anthropic',maxTokens:2000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 const frame=(event,data)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async(url,options)=>{
  calls++;sent=JSON.parse(options.body);assert.equal(sent.stream,true)
  const json=JSON.stringify(patch),wire=frame('message_start',{type:'message_start',message:{model:'test',usage:{input_tokens:12}}})+Array.from(json).map(text=>frame('content_block_delta',{type:'content_block_delta',delta:{type:'text_delta',text}})).join('')+frame('message_delta',{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:24}})+frame('message_stop',{type:'message_stop'})
  return new Response(wire,{headers:{'content-type':'text/event-stream'}})
 }})
 const report=await generateTaskReport(state,id,task.id,async(body,on)=>{
  let wire='';const req=Readable.from([JSON.stringify({...body,stream:true})]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
  await handler(req,{setHeader(){},write(v){wire+=v},end(){}},()=>assert.fail())
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(wire,{headers:{'content-type':'text/event-stream'}})
  try{return await aiStreamRequest(body,on)}finally{globalThis.fetch=original}
 })
 assert.equal(calls,1);assert.match(sent.system,/首次生成报告/);assert.equal(JSON.parse(sent.messages.at(-1).content).availableDecisions[0].value,'maintenance');assert.equal(report.usage.inputTokens,12);assert.equal(report.usage.outputTokens,24);assert.equal(report.summary,patch.summary)
})
