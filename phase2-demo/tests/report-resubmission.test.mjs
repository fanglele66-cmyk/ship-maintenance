import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,people,refreshLifecyclePresentation} from '../src/workflow/eventLifecycle.js'
import {generateTaskReport} from '../src/workflow/taskReportGeneration.js'
import {taskExecution,carryForwardSteps} from '../src/workflow/taskExecution.js'
import {currentReportContext,submissionContext,reportTask} from '../src/workflow/reportSubmissions.js'
import {refreshTaskReport} from '../src/workflow/reportRefresh.js'
import {applyReportSupplement} from '../src/workflow/reportRevisions.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
import {observationAdvice,observationAdviceRequest} from '../src/workflow/observationAdvice.js'
import {Readable} from 'node:stream'
import {createAiHandler} from '../server/ai-api.mjs'
import {aiStreamRequest} from '../src/services/aiClient.js'
const id='real-alarm-0430',deadline=()=>new Date(Date.now()+86400000).toISOString()
const patch={summary:'本次已更换备件并完成复装、试验及交接。',analysis:{evidence:'本次维修记录明确备件换装完成、复装完成，其余步骤已完成。',interpretation:'原受阻条件已解除，不能据旧报告认定本次缺备件。',unverified:'本次未登记需补做项目；后续持续运行效果待观察。',next:'交轮机长审阅本次记录，结合观察决定闭环。'}}
const result={patch,model:'test',usage:{inputTokens:9,outputTokens:8},sources:[]}
function ready(lastResult='未完成'){
 const state=createLifecycleState(),event=state.events[id]
 const dispatch=action=>{state.role='captain';event.decisionDraft={action};decide(state,id,{action,reason:'按批准范围执行',owner:people.engineer,deadline:deadline()})}
 const finish=()=>{state.role='engineer';return submitTask(state,id,currentTask(event).id)}
 dispatch('investigate');let task=currentTask(event);task.draft.records.forEach(r=>r.result='发现异常');task.draft.summary='液压活塞卡滞，批准范围内处理。';finish();dispatch('repair');task=currentTask(event);task.draft.records.forEach(r=>r.result='已完成');task.draft.records[1].result=lastResult;task.draft.records[1].note=lastResult==='不适用'?'检查后无需更换该件。':'缺少备件，等待备件到船。';task.draft.summary=lastResult==='不适用'?'适用项目已完成，本项无需实施。':'其他项目已记录，换装未完成，等待备件。';const first=finish();state.role='captain';return {state,event,task,first}
}
function resume(fixture){const {state,event,task}=fixture;decide(state,id,{action:'wait',reason:'等待备件到船'});decide(state,id,{action:'resume',reason:'备件已到船并核验',deadline:deadline()});task.draft.records.forEach(r=>{r.result='已完成';r.note='本次已完成。'});task.draft.records[1].note='备件换装完成';task.draft.records[2].note='完成复装';task.draft.summary=patch.summary;state.role='engineer'}
test('not applicable does not block, carry forward or recommend resuming a task',()=>{
 const {state,event,task}=ready('不适用'),execution=taskExecution(task)
 assert.equal(execution.incomplete,false);assert.equal(execution.notApplicable.length,1);assert.equal(execution.outstanding.length,0);assert.equal(task.goalStatus,'awaiting-review');assert.deepEqual(carryForwardSteps(event),[])
 assert.ok(!decisionOptions(event).some(o=>['wait','resume','terminate'].includes(o.value)));assert.match(event.reports.at(-1).markdown,/本轮无需执行项目/)
 task.submittedAt=new Date(Date.now()-3*3600000).toISOString();syncLifecycleObservations(state,{},Date.now(),{demo:true});const advice=observationAdvice(event,task);assert.equal(advice.evidence.unresolved.length,0);assert.equal(advice.status,'review')
})
test('resumed report request excludes stale AI text and records the updated submission separately',async()=>{
 const f=ready(),{state,event,task,first}=f,before=structuredClone(first);resume(f)
 const report=await generateTaskReport(state,id,task.id,async(body)=>{
  assert.equal(body.event.submissionContext.submissionNumber,2);assert.equal(body.event.submissionContext.previousSubmissions[0].id,first.id)
  assert.ok(!body.event.reports.some(r=>r.taskId===task.id));assert.equal(body.event.submissionContext.changes[1].上次结果,'未完成');assert.equal(body.event.submissionContext.changes[1].本次结果,'已完成');assert.equal(body.event.tasks[0].records[1].note,'备件换装完成');return result
 })
 assert.notEqual(first.title,report.title);assert.match(first.title,/第1次提交/);assert.match(report.title,/第2次提交（恢复后）/);assert.equal(report.taskId,first.taskId);assert.deepEqual(first,before)
 const phases=event.phases.filter(p=>p.reportId===first.id||p.reportId===report.id);assert.notEqual(phases[0].label,phases[1].label)
 const context=currentReportContext(event);assert.ok(!context.some(r=>r.id===first.id));assert.ok(context.some(r=>r.id===report.id));assert.equal(reportTask(event,first).records[1].result,'未完成')
 syncLifecycleObservations(state,{},Date.now(),{demo:true});const request=observationAdviceRequest(event,task,observationAdvice(event,task));assert.ok(!request.event.reports.some(r=>r.id===first.id));assert.ok(!request.event.reports.some(r=>r.summary.includes('等待备件')))
})
test('legacy reports get unique labels without replacing old facts with the resumed task',()=>{
 const f=ready(),{state,event,task,first}=f;resume(f);submitTask(state,id,task.id);const second=event.reports.at(-1)
 for(const report of [first,second]){delete report.submissionSnapshot;delete report.submissionNumber;delete report.analysisContextVersion;report.title='旧的重复标题';report.markdown=report.markdown.replace(/^# [^\n]+/,'# 旧的重复标题');report.presentationVersion=1}
 const firstBody=first.markdown.split('\n').slice(1).join('\n');refreshLifecyclePresentation(state)
 assert.notEqual(first.title,second.title);assert.equal(first.markdown.split('\n').slice(1).join('\n'),firstBody);assert.equal(first.submissionSnapshot.records[1].result,'未完成');assert.equal(second.submissionSnapshot.records[1].note,'备件换装完成');assert.equal(second.analysisContextVersion,undefined)
 const saved=JSON.stringify(state);refreshLifecyclePresentation(state);assert.equal(JSON.stringify(state),saved)
})
test('refresh streams into the same report, preserves earlier report and audit; failure changes nothing',async()=>{
 const f=ready(),{state,event,task,first}=f;resume(f);submitTask(state,id,task.id);state.role='captain';const report=event.reports.at(-1),before=structuredClone(report),old=structuredClone(first),phase=event.phase,records=structuredClone(task.records)
 await assert.rejects(refreshTaskReport(state,id,report.id,async()=>{throw Error('断网')}),/断网/);assert.deepEqual(report,before)
 let progress=false;await refreshTaskReport(state,id,report.id,async(body,on)=>{assert.equal(body.event.submissionContext.submissionNumber,2);assert.equal(body.event.reports.some(r=>r.taskId===task.id),false);on('report',{patch});assert.equal(report.markdown,before.markdown);return result},()=>progress=true)
 assert.equal(progress,true);assert.equal(event.reports.length,3);assert.equal(report.id,before.id);assert.equal(report.summary,patch.summary);assert.deepEqual(first,old);assert.deepEqual(task.records,records);assert.equal(event.phase,phase);assert.equal(report.revisions.at(-1).before.markdown,before.markdown)
 await assert.rejects(refreshTaskReport(state,id,first.id,async()=>assert.fail()),/最新报告/)
})
test('historical supplement cannot inherit the resumed task facts',()=>{
 const f=ready(),{state,event,task,first}=f;resume(f);submitTask(state,id,task.id);applyReportSupplement(state,id,{id:'supplement',reportId:first.id,baseMarkdown:first.markdown,patch:{...patch,summary:'首次提交时换装尚未完成。'},text:'补充首次交接的情况',model:'test'})
 assert.equal(first.submissionSnapshot.records[1].result,'未完成');assert.equal(event.reports.at(-1).submissionSnapshot.records[1].result,'已完成')
})
test('terminated work cannot enter an observation route that requires submitted status',()=>{const {state,event}=ready();decide(state,id,{action:'terminate',reason:'剩余部分另行安排'});assert.ok(!decisionOptions(event).some(o=>o.value==='observe'));assert.ok(decisionOptions(event).some(o=>o.value==='close'))})
test('refresh client accepts structured streamed reports without requiring a chat answer',async()=>{
 const original=globalThis.fetch,frames=[]
 globalThis.fetch=async()=>new Response(`event: report\ndata: ${JSON.stringify({patch})}\n\nevent: done\ndata: ${JSON.stringify(result)}\n\n`,{headers:{'content-type':'text/event-stream'}})
 try{const received=await aiStreamRequest({mode:'refresh-report'},(kind,data)=>frames.push({kind,data}));assert.deepEqual(received.patch,patch);assert.equal(frames[0].kind,'report')}finally{globalThis.fetch=original}
})
test('refresh API accepts current captain review and sends only this submission to the model',async()=>{
 const f=ready(),{state,event,task}=f;resume(f);submitTask(state,id,task.id);state.role='captain';let calls=0
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>({source:'manual',baseUrl:'https://example.test',apiKey:'test',model:'test',protocol:'anthropic',enabled:true,knowledgeEnabled:false,maxTokens:2000,timeoutMs:5000})},fetcher:async(url,options)=>{
  calls++;const body=JSON.parse(options.body),data=JSON.parse(body.messages.at(-1).content);assert.equal(data.event.submissionContext.submissionNumber,2);assert.ok(!data.event.reports.some(r=>r.taskId===task.id));assert.match(body.system,/不适用表示该项无需执行/);assert.match(body.system,/不同时间提交的状态变化不是冲突/)
  return new Response(JSON.stringify({model:'test',content:[{type:'text',text:JSON.stringify(patch)}],usage:{input_tokens:9,output_tokens:8}}),{headers:{'content-type':'application/json'}})
 }})
 await refreshTaskReport(state,id,event.reports.at(-1).id,async(body)=>{const req=Readable.from([JSON.stringify(body)]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}});let response;const res={setHeader(){},end(text){response=JSON.parse(text)}};await handler(req,res,()=>assert.fail());assert.equal(res.statusCode,200);return response})
 assert.equal(calls,1);assert.equal(event.reports.length,3);assert.equal(event.reports.at(-1).summary,patch.summary)
})
