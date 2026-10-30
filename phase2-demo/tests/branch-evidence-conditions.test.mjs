import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,submitTask,currentTask,ensureTaskPlan,decisionOptions,people,pendingDecision} from '../src/workflow/eventLifecycle.js'
import {generateTaskReport} from '../src/workflow/taskReportGeneration.js'
import {acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {taskExecution} from '../src/workflow/taskExecution.js'
import {lifecycleWorkItems,lifecycleNotifications} from '../src/workflow/lifecycleWorkItems.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
import {observationAdvice,observationAdviceRequest} from '../src/workflow/observationAdvice.js'
import {observationPolicy} from '../src/workflow/observationContext.js'
import {maintenancePlans,availableMaintenanceWindows} from '../src/workflow/maintenancePlans.js'
const id='real-alarm-0430',deadline=()=>new Date(Date.now()+86400000).toISOString()
function dispatch(state,action){state.role='captain';const event=state.events[id];event.decisionDraft={action};const plan=ensureTaskPlan(event);decide(state,id,{action,reason:plan.scope,owner:people.engineer,deadline:deadline()});return currentTask(event)}
function finish(state,summary='本轮执行完成，原报警未复现。'){state.role='engineer';const task=currentTask(state.events[id]);task.draft.summary=summary;return submitTask(state,id,task.id)}
function repair(partial=false){const state=createLifecycleState();let task=dispatch(state,'investigate');task.draft.records.forEach(r=>r.result='发现异常');finish(state);task=dispatch(state,'repair');task.draft.records.forEach(r=>r.result='已完成');if(partial){task.draft.records.at(-1).result='未完成';task.draft.records.at(-1).note='尚不具备稳态试航条件，留待恢复航行后复测。'}finish(state);state.role='captain';return {state,event:state.events[id],task}}
test('4.1 unknown cause report streams from actual feedback and separates facts from AI interpretation',async()=>{
 const state=createLifecycleState(),task=dispatch(state,'investigate');task.draft.records.forEach(r=>{r.result='未见异常';r.note='已核对本项记录，当前未复现。'});task.draft.summary='检查已完成，原因尚不能确认。';state.role='engineer'
 let calls=0;const report=await generateTaskReport(state,id,task.id,async(body,on)=>{calls++;assert.match(body.text,/现场事实和AI分析建议分开/);assert.equal(body.event.tasks[0].summary,task.summary);on('report',{patch:{summary:'检查已完成',analysis:{}}});assert.equal(state.events[id].reports.length,0);return {model:'test',patch:{summary:'检查已完成，原因尚不能确认。',analysis:{evidence:'两项核查已完成，未复现异常。',interpretation:'不能据此定位故障原因。',unverified:'故障原因与复发条件待核实。',next:'交轮机长决定继续观察或补充检查。'}},usage:{inputTokens:90,outputTokens:80}}})
 assert.equal(calls,1);assert.equal(taskExecution(task).incomplete,false);assert.match(report.markdown,/现场事实（执行人原始记录）/);assert.match(report.markdown,/AI分析与建议（不作为现场事实）/);assert.match(report.markdown,/原因尚不能确认/);assert.equal(state.events[id].phase,'decision');assert.ok(pendingDecision(state.events[id]))
})
test('4.7 skipped repair is in report, captain options and the next dispatch; model cannot erase it',()=>{
 const {state,event,task}=repair(true),skipped=task.records.at(-1).label,report=structuredClone(event.reports.at(-1))
 assert.match(report.markdown,/未执行与待核实事项/);assert.ok(report.markdown.includes(skipped));assert.equal(task.goalStatus,'unresolved');assert.ok(decisionOptions(event).some(o=>o.value==='wait'))
 event.decisionDraft={action:'repair'};const draft=ensureTaskPlan(event);assert.deepEqual(draft.steps.map(s=>s.label),[skipped])
 assert.throws(()=>acceptTaskPlan(event,{key:draft.key,version:draft.version},{plan:{scope:'仅做其他项目',rationale:'仅做其他项目',steps:[{label:'其他项目',guide:'核对其他项目',checks:['核对现场记录'],recordHint:'提交现场记录'}]}}),/上轮未执行项目必须保留/)
 const next=dispatch(state,'repair');assert.notEqual(next.id,task.id);assert.equal(next.steps[0].label,skipped);assert.equal(next.steps[0].carryFromTaskId,task.id);assert.deepEqual(event.reports.at(-1),report)
})
test('4.7 summary-only constraints cannot silently become a fully completed repair',()=>{
 const {event,task}=repair();task.summary='前两项已实施，复测暂未实施，不具备试航条件。'
 assert.equal(taskExecution(task).incomplete,true);event.decisionDraft={action:'repair'};assert.match(ensureTaskPlan(event).steps[0].guide,/不具备试航条件/);assert.ok(decisionOptions(event).some(o=>o.value==='wait'))
})
test('waiting survives reload, has no repeated alert and resumes the same task and completed records',()=>{
 const {state,event,task}=repair(true),first=structuredClone(event.reports.at(-1)),done=structuredClone(task.records[0])
 decide(state,id,{action:'wait',reason:'等待航行工况，保留本轮已完成记录。'})
 assert.equal(task.status,'waiting');assert.ok(!pendingDecision(event));state.role='engineer';assert.equal(lifecycleWorkItems(state).pending.find(i=>i.taskId===task.id).status,'等待条件');assert.ok(!lifecycleNotifications(state).some(n=>n.taskId===task.id))
 const restored=JSON.parse(JSON.stringify(state));restored.role='captain';decide(restored,id,{action:'resume',reason:'已进入批准的试航工况。',deadline:deadline()});const original=currentTask(restored.events[id]);assert.equal(original.id,task.id);assert.deepEqual(original.draft.records[0],done);assert.equal(restored.events[id].tasks.length,2)
 original.draft.records.at(-1).result='已完成';original.draft.records.at(-1).note='在批准工况完成复测。';finish(restored,'剩余复测已完成。');assert.equal(restored.events[id].reports.length,3);assert.deepEqual(restored.events[id].reports[1],first);assert.ok(original.feedbackHistory[0].reportId===first.id)
})
test('terminating a blocked task is distinct from closing; closure retains skipped items and reason',()=>{
 const {state,event,task}=repair(true);decide(state,id,{action:'terminate',reason:'该项转由岸基安排，保留未验证范围。'});assert.equal(event.phase,'review');assert.equal(task.status,'terminated');decide(state,id,{action:'close',reason:'本轮完成范围确认，剩余事项另行安排。'});assert.match(event.reports.at(-1).markdown,/未执行部分已终止/);assert.match(event.reports.at(-1).markdown,/未完成/);assert.match(event.reports.at(-1).markdown,/转由岸基安排/)
})
test('4.3 stable stopped-engine data cannot produce a closure recommendation',()=>{
 const {state,event,task}=repair(),end=Date.now(),start=end-3*3600000;task.submittedAt=new Date(start).toISOString()
 syncLifecycleObservations(state,{observationOperatingPeriods:[{start,end,state:'锚泊停机',tone:'anchored',rpm:[0,0],load:[0,0]}]},end,{demo:true})
 const advice=observationAdvice(event,task);assert.equal(advice.status,'incomplete');assert.match(advice.timing,/停机/);assert.equal(advice.conditionsMet,false);assert.equal(advice.evidence.operatingConditions.comparableMs,0)
})
test('4.3 data missing after previous coverage does not reuse old values as valid evidence',()=>{
 const {state,event,task}=repair(),end=Date.now();task.submittedAt=new Date(end-3*3600000).toISOString();syncLifecycleObservations(state,{},end,{demo:true});assert.equal(observationAdvice(event,task).status,'review')
 const source={recordedSensorChannels:ids=>ids.map(channelId=>({channelId,unit:'°C',sourceKind:'live',trendData:[]})),observationOperatingPeriods:[]}
 syncLifecycleObservations(state,source,end+300000)
 const advice=observationAdvice(event,task);assert.equal(advice.status,'incomplete');assert.equal(advice.evidence.currentCoverage,false);assert.match(advice.conditionMessage,/缺少/);assert.ok(task.observation.records.length)
})
test('post-repair evidence uses only later comparable measurements and ties the original problem to advice',()=>{
 const {state,event,task}=repair(),end=Date.now(),start=end-3*3600000;task.submittedAt=new Date(start).toISOString();syncLifecycleObservations(state,{},end,{demo:true})
 assert.ok(task.observation.conditions.samples.every(c=>c.every(p=>p.timestamp>start&&p.timestamp<=end)))
 const advice=observationAdvice(event,task);assert.equal(advice.status,'review');assert.equal(advice.evidence.originalProblem,event.brief.conclusion);assert.match(observationAdviceRequest(event,task,advice).text,/本轮开始时间之后/)
 task.observation.pending.channels[0].value=80;assert.equal(observationAdvice(event,task).status,'recheck')
})
test('tracking observes full weeks with matching sampling, due date and recommendation, alarm stays two hours',()=>{
 const state=createLifecycleState(),event=state.events['real-health-c4-baseline'],task=currentTask(event);decide(state,event.id,{action:'observe',reason:'保留现场核实，继续跟踪一周。'})
 const start=Date.parse(task.observationStartedAt),week=7*86400000
 assert.equal(Date.parse(event.phases.at(-1).observationDueAt)-start,week);assert.equal(observationPolicy(state.events[id]).intervalMs,7200000)
 syncLifecycleObservations(state,{},start+week-1000,{demo:true});assert.equal(task.observation.records.length,0);assert.ok(!pendingDecision(event));assert.match(observationAdviceRequest(event,task,observationAdvice(event,task)).text,/观察周期为一周/)
 syncLifecycleObservations(state,{},start+week,{demo:true});assert.equal(task.observation.records.length,1);assert.equal(task.observation.records[0].covered,true);assert.ok(pendingDecision(event));assert.equal(observationAdvice(event,task).evidence.reachedCycle,true)
})
test('early-maintenance plan includes formal work order snapshot without auto completing it',()=>{
 const state=createLifecycleState(),event=state.events['real-tracking-exhaust-baseline'];decide(state,event.id,{action:'investigate',reason:'核实相对抬升',owner:people.engineer,deadline:deadline()});let task=currentTask(event);task.draft.records.forEach((r,i)=>r.result=i?'信息已记录':'现场与系统一致');task.draft.summary='现场与系统相符，已记录背景。';state.role='engineer';submitTask(state,event.id,task.id);state.role='captain'
 const plan=maintenancePlans(event)[0],window=availableMaintenanceWindows()[0];event.decisionDraft={action:'maintenance',maintenancePlanId:plan.id};decide(state,event.id,{action:'maintenance',reason:'按计划提前维保。',owner:people.engineer,deadline:window.end,maintenancePlanId:plan.id,window:window.id});task=currentTask(event);assert.equal(task.maintenance.plan.workOrder.number,plan.workOrder.number);assert.ok(task.maintenance.plan.workOrder.content.length);task.draft.records.forEach(r=>r.result='已完成');task.draft.summary='本次计划作业已完成。';state.role='engineer';const report=submitTask(state,event.id,task.id);assert.match(report.markdown,/关联正式工单/);assert.equal(task.maintenance.plan.workOrder.status,'待执行')
})
test('changing tracking to weekly observation preserves earlier receipts without treating them as full weeks',()=>{
 const state=createLifecycleState(),event=state.events['real-health-c4-baseline'],task=currentTask(event);decide(state,event.id,{action:'observe',reason:'调整为每周汇总。'})
 const start=Date.parse(task.observationStartedAt),old={id:'original-two-hour-window',windowStart:new Date(start).toISOString(),windowEnd:new Date(start+7200000).toISOString(),sampleCount:1,complete:true,covered:false,values:[-6],channels:[{name:'四缸相对偏差',unit:'°C',value:-6,sampleCount:1,covered:false}]}
 task.observation={records:[structuredClone(old)],checkedAt:old.windowEnd};syncLifecycleObservations(state,{},start+3*3600000,{demo:true});assert.deepEqual(task.observationHistory[0].records,[old]);assert.equal(task.observation.records.length,0)
 syncLifecycleObservations(state,{},start+4*3600000,{demo:true});assert.equal(task.observationHistory.length,1);assert.equal(observationAdvice(event,task).evidence.reachedCycle,false)
})
