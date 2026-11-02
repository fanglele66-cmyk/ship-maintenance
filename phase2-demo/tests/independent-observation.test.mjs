import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,submitTask,ensureTaskPlan,people,refreshLifecyclePresentation,pendingDecision} from '../src/workflow/eventLifecycle.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
import {observationTaskFor} from '../src/workflow/observationContext.js'
import {lifecycleWorkItems,lifecycleNotifications} from '../src/workflow/lifecycleWorkItems.js'
import {lifecycleDecisionOptions} from '../src/workflow/lifecycleDecisions.js'
import {shoreReportSnapshot} from '../src/workflow/shoreReports.js'
const root='real-alarm-0430'
function dispatch(state,event,action){state.role='captain';event.decisionDraft={action};const plan=ensureTaskPlan(event);plan.status='ready';decide(state,event.id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:plan.scope});return currentTask(event)}
function submit(state,event,task,result){state.role='engineer';task.draft.records.forEach(r=>r.result=result);task.draft.summary='已按批准范围完成，具体原因和效果仍待核实。';submitTask(state,event.id,task.id);state.role='captain'}
function observed(repair=false){const state=createLifecycleState(),parent=state.events[root],check=dispatch(state,parent,'investigate');submit(state,parent,check,repair?'发现异常':'未见异常');const task=repair?dispatch(state,parent,'repair'):check;if(repair)submit(state,parent,task,'已完成');const report=structuredClone(parent.reports.at(-1));decide(state,parent.id,{action:'observe',reason:'继续核对原异常与工况，确认效果。'});const event=state.events[parent.observationEventIds.at(-1)];return {state,parent,event,task,report,source:observationTaskFor(event)}}
for(const repair of [false,true])test(`${repair?'维修':'排查'}完成后建立独立观察事件，任务和来源报告不重复`,()=>{
 const {state,parent,event,task,report,source}=observed(repair)
 assert.equal(task.goalStatus,'completed');assert.equal(event.type,'效果观察');assert.equal(parent.phase,'transferred');assert.equal(parent.closedAt,undefined)
 assert.equal(event.parentEventId,parent.id);assert.equal(event.sourceReportId,report.id);assert.notEqual(source,task);assert.equal(event.tasks.length,0)
 assert.equal(event.reports[0].markdown,report.markdown);assert.equal(event.reports[0].linkedSource,true);assert.ok(!pendingDecision(parent));assert.ok(!pendingDecision(event))
 assert.equal(lifecycleWorkItems(state).all.filter(i=>i.kind==='task'&&i.taskId===task.id).length,1)
 const due=Date.parse(event.phases.at(-1).observationDueAt);syncLifecycleObservations(state,{},due-1,{demo:true});assert.ok(source.observation.pending.sampleCount>0)
 syncLifecycleObservations(state,{},due,{demo:true});assert.ok(pendingDecision(event));assert.equal(lifecycleNotifications(state).filter(n=>n.eventId===event.id).length,1)
 const saved=refreshLifecyclePresentation(structuredClone(state));assert.equal(Object.keys(saved.events).length,Object.keys(state.events).length);assert.equal(saved.events[event.id].reports[0].markdown,report.markdown)
 decide(state,event.id,{action:'close',reason:'本次观察结果已核对，保留边界并结束观察。'});assert.equal(parent.phase,'transferred');assert.equal(event.phase,'closed');assert.ok(source.observationEndedAt);assert.match(event.reports.at(-1).markdown,/关联原事件/)
})
test('观察事件可复查，来源观察停止且源任务保持完成',()=>{
 const {state,parent,event,task,source}=observed();const next=dispatch(state,event,'recheck');assert.equal(parent.tasks.length,1);assert.ok(source.observationEndedAt);assert.equal(task.goalStatus,'completed');assert.equal(event.currentTask,next.id)
 submit(state,event,next,'未见异常');decide(state,event.id,{action:'observe',reason:'复查后延续原观察。'});assert.equal(source.observationEndedAt,null);assert.equal(event.type,'效果观察');assert.equal(event.tasks.length,1)
})
test('观察中追加维修完成后，新的观察采样仍等待轮机长确认',()=>{
 const {state,event}=observed();const task=dispatch(state,event,'repair');submit(state,event,task,'已完成')
 syncLifecycleObservations(state,{},Date.now()+7200000,{demo:true});assert.equal(task.observation,undefined)
 decide(state,event.id,{action:'observe',reason:'依据本次维修报告继续核对效果。'});assert.ok(task.observationStartedAt)
 syncLifecycleObservations(state,{},Date.parse(task.observationStartedAt)+7200000,{demo:true});assert.ok(task.observation.records.length);assert.equal(event.type,'效果观察')
})
test('维修未完成保留剩余工作，不允许创建效果观察事件',()=>{
 const {state,parent}=observed(true); // Restore a fresh current submitted work gate with unfinished work.
 parent.phase='review';parent.phases.push({id:'unfinished-review',kind:'review',taskId:parent.currentTask});const task=currentTask(parent);task.records[0].result='未完成';task.goalStatus='unresolved'
 assert.ok(!lifecycleDecisionOptions(parent).some(o=>o.value==='observe'));assert.throws(()=>decide(state,parent.id,{action:'observe',reason:'等待结果'}),/当前阶段/)
})
test('旧观察迁移保留开始时刻、采样与报告，重复加载不再建事件',()=>{
 const {state,parent,event,task,report,source}=observed();source.observation={records:[{id:'saved-window',sampleCount:8}],policy:{intervalMs:7200000}};Object.assign(task,structuredClone(source));parent.phase='review';parent.status='效果观察中';parent.phases=[structuredClone(event.phases[0])];delete parent.observationEventIds;delete state.events[event.id]
 refreshLifecyclePresentation(state);const child=state.events[parent.observationEventIds[0]];assert.equal(child.observationSource.task.observationStartedAt,source.observationStartedAt);assert.equal(child.observationSource.task.observation.records[0].sampleCount,8);assert.equal(child.reports[0].markdown,report.markdown)
 const ids=Object.keys(state.events);refreshLifecyclePresentation(state);assert.deepEqual(Object.keys(state.events),ids)
})
test('岸基只能同步最新报告，保留编辑快照和会话记录，拒绝过期报告',()=>{
 const state=createLifecycleState(),parent=state.events[root];assert.ok(!lifecycleDecisionOptions(parent).some(o=>o.value==='shore'));assert.throws(()=>decide(state,root,{action:'shore',reason:'查阅'}),/当前阶段/)
 const task=dispatch(state,parent,'investigate');submit(state,parent,task,'未见异常');const report=parent.reports.at(-1),original=report.markdown
 const form={action:'shore',reason:'请岸基核对',shoreReportId:report.id,shoreBaseMarkdown:original,shoreMarkdown:original+'\n\n补充核对意见。'}
 assert.throws(()=>shoreReportSnapshot(parent,{...form,shoreReportId:'old'}),/最近报告已更新/)
 decide(state,root,form);assert.equal(parent.reports.at(-1).markdown,original);assert.match(parent.shore[0].syncedReport.markdown,/补充核对意见/);assert.equal(parent.shore[0].status,'待岸基接收');assert.ok(parent.conversations.captain.some(m=>m.shoreId===parent.shore[0].id));assert.equal(parent.phase,'decision')
})
