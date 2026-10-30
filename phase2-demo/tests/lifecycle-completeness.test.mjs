import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,ensureTaskPlan,refreshLifecyclePresentation,people} from '../src/workflow/eventLifecycle.js'
import {acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {applyReportSupplement} from '../src/workflow/reportRevisions.js'
import {createAiHandler} from '../server/ai-api.mjs'
import {groupRepairSteps,compactAssignedRepair} from '../src/workflow/repairStepGroups.js'
import {normalizeTaskPlan} from '../src/workflow/taskPlanning.js'
const id='real-alarm-0430',deadline=()=>new Date(Date.now()+86400000).toISOString()
function dispatch(state,action){state.role='captain';const p=ensureTaskPlan(state.events[id]);decide(state,id,{action,reason:p.scope,owner:people.engineer,deadline:deadline()})}
function submit(state,summary,result){state.role='engineer';const task=currentTask(state.events[id]);task.draft.records.forEach((r,i)=>{r.result=result||task.steps[i].options[0];r.note=`现场记录 ${i+1}：${summary}`});task.draft.summary=summary;return submitTask(state,id)}
function repairState(){const s=createLifecycleState();dispatch(s,'investigate');const task=currentTask(s.events[id]);task.steps=task.steps.slice(0,1);task.draft.records=task.draft.records.slice(0,1);delete task.draft.records[0].package;submit(s,'二缸 ICU 伺服油液压活塞卡滞，电气连接未见异常。');return s}

test('shore is available at every gate and snapshots an event without changing task, report, plan or phase',()=>{
 const state=createLifecycleState(),event=state.events[id]
 const check=()=>{state.role='captain';ensureTaskPlan(event);const before=structuredClone({phase:event.phase,phases:event.phases,tasks:event.tasks,currentTask:event.currentTask,reports:event.reports,plan:event.pendingPlan});assert.ok(decisionOptions(event).some(o=>o.value==='shore'));decide(state,id,{action:'shore',reason:'请协助核对备件。'});assert.deepEqual({phase:event.phase,phases:event.phases,tasks:event.tasks,currentTask:event.currentTask,reports:event.reports,plan:event.pendingPlan},before);const packet=event.shore.at(-1).packet;assert.equal(packet.phase,event.phase);assert.deepEqual(packet.reports,event.reports);return packet}
 const initial=check();dispatch(state,'investigate');check();submit(state,'发现活塞卡滞。');check();dispatch(state,'repair');check();submit(state,'已完成获批总成更换与密封试验，待复查。');check();decide(state,id,{action:'close',reason:'按报告中的验证范围闭环，后续继续观察。'});const archived=event.reports.at(-1).markdown;check();assert.equal(event.reports.at(-1).markdown,archived);assert.equal(initial.tasks.length,0)
})

test('repair without package metadata has concrete preparation, execution and verification steps',()=>{
 const state=repairState(),event=state.events[id],plan=ensureTaskPlan(event),content=JSON.stringify(plan.steps)
 assert.equal(plan.steps.length,4);for(const phrase of ['备件','图号','隔离','残余压力','认可的车间','砂纸','复装','试验'])assert.ok(content.includes(phrase),phrase)
 assert.ok(plan.steps.every(s=>s.guide&&(s.checks.length>=2||s.substeps?.every(c=>c.checks.length>=2))&&s.recordHint));dispatch(state,'repair');assert.deepEqual(currentTask(event).steps,plan.steps)
})

test('legacy dispatched three-step repair retains its steps and feedback across reload',()=>{
 const state=repairState();dispatch(state,'repair');const task=currentTask(state.events[id])
 task.procedureVersion=undefined;task.steps=['核对获批处理范围与作业条件','实施本次批准的处理项目','恢复系统并记录复测结果'].map(label=>({label,options:['已完成','未完成','不适用']}))
 task.draft={records:task.steps.map((s,i)=>({label:s.label,result:i===0?'已完成':'',note:i===0?'原隔离记录：燃油与伺服油已卸压确认。':''})),summary:'原总结内容',attachments:[{name:'原照片.jpg'}],stepIndex:1}
 const original=structuredClone(task.draft);refreshLifecyclePresentation(state)
 assert.deepEqual(task.draft,original);assert.equal(task.procedureHistory,undefined);assert.equal(task.steps.length,3)
 const snapshot=structuredClone(task);refreshLifecyclePresentation(state);assert.deepEqual(task,snapshot)
 state.role='engineer';task.draft.records.forEach(r=>r.result='已完成');task.draft.summary='已完成复装，复测记录另附。';const report=submitTask(state,id);assert.match(report.markdown,/原隔离记录/)
})

test('recheck has a usable full preset while awaiting AI and accepts only a complete current revision',()=>{
 const state=repairState();dispatch(state,'repair');submit(state,'已更换获批 ICU 总成，未覆盖高负荷。');const event=state.events[id],draft=ensureTaskPlan(event)
 assert.equal(draft.source,'preset');assert.equal(draft.status,'pending');assert.equal(draft.steps.length,4);assert.match(JSON.stringify(draft.steps),/未覆盖高负荷/)
 const previous=structuredClone(draft.steps),expected={key:draft.key,version:draft.version}
 assert.throws(()=>acceptTaskPlan(event,expected,{plan:{scope:'未完整生成'}}),/不完整/);assert.deepEqual(draft.steps,previous)
 acceptTaskPlan(event,expected,{plan:{scope:'按修后工况复查原报警。',rationale:'已更换总成，补齐高负荷限制说明。',steps:previous.map(s=>({...s,guide:s.guide+' 核对本轮实际观察时段。'}))}})
 assert.equal(draft.source,'model');assert.equal(draft.status,'ready');assert.notDeepEqual(draft.steps,previous);dispatch(state,'recheck');assert.deepEqual(currentTask(event).steps,draft.steps)
})

test('closure includes full rounds, revisions, actual materials, partial observation and recheck without invented repairs',()=>{
 const state=repairState(),event=state.events[id],investigation=event.reports[0]
 state.role='engineer';applyReportSupplement(state,id,{id:'revision-test',reportId:investigation.id,baseMarkdown:investigation.markdown,text:'补充：垫圈松动，但尚未证实其影响。',patch:{summary:'现场发现活塞卡滞，垫圈松动的影响尚未证实。',analysis:{evidence:'现场记录为据。',interpretation:'活塞卡滞解释响应异常方向。',unverified:'垫圈影响尚未证实。',next:'仅处理获批部位。'}}})
 dispatch(state,'repair');submit(state,'实际领用 ICU 总成 1 件，序列号 UNIT-LOCAL-01；密封复测通过，高负荷未验证。');const work=currentTask(event)
 work.observation={records:[],pending:{windowStart:work.submittedAt,windowEnd:work.submittedAt,complete:false,sampleCount:2,channels:[{name:'二缸排温',unit:'°C',sampleCount:2,min:410,max:415,mean:412.5,value:415,covered:false}]}}
 const draft=ensureTaskPlan(event);acceptTaskPlan(event,{key:draft.key,version:draft.version},{plan:{scope:draft.scope,rationale:draft.rationale,steps:draft.steps}});dispatch(state,'recheck');submit(state,'本次可比工况未见原报警，高负荷仍待验证。','未见异常')
 state.role='captain';decide(state,id,{action:'close',reason:'确认本次范围闭环，继续关注高负荷表现。'})
 const report=event.reports.at(-1),text=report.markdown
 for(const value of ['事件基础信息','原始异常','80.4','SLOW DOWN','排查过程','垫圈松动','尚未证实','UNIT-LOCAL-01','二缸排温','415','部分观察窗口','复查','高负荷仍待验证','完整处置时间线','过程报告与附件索引'])assert.ok(text.includes(value),value)
 const archived=text;refreshLifecyclePresentation(state);assert.equal(report.markdown,archived)
 const falseState=createLifecycleState();decide(falseState,id,{action:'false',reason:'原触发窗口已核对，按记录确认为误报。'});assert.match(falseState.events[id].reports.at(-1).markdown,/未提交维修或维保作业报告/)
})

test('SSE gives real progress before slow config, retrieval and model output, with no hidden reasoning',async()=>{
 let wire='',released=false,firstProgress=false
 let release;const gate=new Promise(resolve=>{release=()=>{released=true;resolve()}})
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>{assert.ok(firstProgress);await gate;return {source:'manual',baseUrl:'https://example.test',apiKey:'secret',model:'test',protocol:'anthropic',enabled:true,knowledgeEnabled:true,maxTokens:4096,timeoutMs:5000}}},knowledge:{search:async()=>{assert.match(wire,/正在检索本地知识库/);return []}},fetcher:async()=>new Response('event: message_start\ndata: {"type":"message_start"}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"PRIVATE"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"核对已提交记录。"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',{headers:{'Content-Type':'text/event-stream'}})})
 const req=Readable.from([Buffer.from(JSON.stringify({text:'概述当前事件',stream:true}))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 const run=handler(req,{setHeader(){},write(text){wire+=text;if(text.includes('已收到请求')){firstProgress=true;assert.equal(released,false)}},end(){}},()=>assert.fail())
 await new Promise(resolve=>setImmediate(resolve));assert.equal(firstProgress,true);release();await run
 assert.match(wire,/AI 已开始分析资料/);assert.match(wire,/event: done/);assert.doesNotMatch(wire,/PRIVATE|secret/)
})

test('repair feedback is capped at four without losing methods or marking partially filled groups complete',()=>{
 const labels=['核对范围','准备备件','落实隔离','标识拆卸','实施维修','复装连接','复测结果','交接观察']
 const raw=labels.map((label,i)=>({label,guide:`第 ${i+1} 项具体作业方法。`,checks:[`第 ${i+1} 项检查要求。`],recordHint:`第 ${i+1} 项实际记录。`,options:['已完成','未完成','不适用']}))
 const groups=groupRepairSteps(raw)
 assert.equal(groups.length,4);assert.deepEqual(groups.flatMap(g=>g.substeps).map(s=>s.label),labels)
 const value={scope:'仅处理已经确认的部位。',rationale:'依据现场报告安排详细作业。',steps:raw}
 const normalized=normalizeTaskPlan(value,'repair');assert.equal(normalized.steps.length,4);assert.deepEqual(normalizeTaskPlan(normalized,'repair'),normalized)
 const task={kind:'repair',status:'assigned',steps:raw,draft:{stepIndex:1,summary:'原作业摘要',attachments:[],records:raw.map((s,i)=>({label:s.label,result:i===0?'已完成':'',note:i===0?'原检查记录':i===4?'已换备件，待复验':''}))}}
 const original=structuredClone(task.draft);compactAssignedRepair(task)
 assert.equal(task.steps.length,4);assert.deepEqual(task.feedbackHistory[0].draft,original);assert.equal(task.draft.records[0].result,'');assert.match(task.draft.records[0].note,/原检查记录/);assert.match(task.draft.records[1].note,/已换备件/)
 const snapshot=structuredClone(task);assert.equal(compactAssignedRepair(task),false);assert.deepEqual(task,snapshot)
 const submitted={...task,status:'submitted',steps:raw};assert.equal(compactAssignedRepair(submitted),false);assert.equal(submitted.steps.length,8)
})
