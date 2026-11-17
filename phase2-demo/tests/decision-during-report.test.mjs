import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,ensureTaskPlan,beginTaskReport,submitTask,people,decisionOptions} from '../src/workflow/eventLifecycle.js'
import {hasSubmittedFeedback,carryForwardSteps} from '../src/workflow/taskExecution.js'
import {taskPlanKey,acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {applyReportSupplement} from '../src/workflow/reportRevisions.js'
import {refreshTaskReport} from '../src/workflow/reportRefresh.js'

const result={model:'isolated-test',requestId:'pending-analysis',patch:{summary:'现场检查发现连接异常，按已核对范围安排处理。',analysis:{evidence:'现场检查记录已正式提交。',interpretation:'连接异常需要按范围处理。',unverified:'维修后的效果尚待复测。',next:'由轮机长确认后续安排。'}}}
function reporting(id='real-alarm-0430'){
 const state=createLifecycleState(),event=state.events[id]
 event.decisionDraft={action:'investigate'};ensureTaskPlan(event)
 decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer';const task=currentTask(event)
 task.draft.records.forEach((r,i)=>{const options=task.steps[i].options;r.result=options.includes('发现异常')?'发现异常':options.find(v=>/现场与系统一致|工况可比/.test(v))||options[0];r.executionStatus='已完成';r.note='已完成现场核对。'})
 task.draft.summary='现场核对完成，发现连接异常。'
 beginTaskReport(state,id,task.id,result.requestId)
 event.decisionDraft={action:'repair',owner:people.engineer,evidence:'保留轮机长填写的处理范围'}
 return {state,event,task}
}

for(const id of ['real-alarm-0430','real-warning-0523'])for(const status of ['reporting','report-error'])test(`${id}: repair is actionable with formal feedback while AI is ${status}`,()=>{
 const {state,event,task}=reporting(id);task.status=status
 assert.equal(hasSubmittedFeedback(event,task),true)
 assert.ok(decisionOptions(event).some(o=>o.value==='repair'))
 const plan=ensureTaskPlan(event)
 assert.equal(plan.status,'ready');assert.ok(plan.steps.length)
 state.role='captain';decide(state,id,{action:'repair',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 assert.equal(currentTask(event).kind,'repair');assert.equal(task.status,'submitted')
})

test('optional enrichment preserves the prepared plan, its edits and decision fields',()=>{
 const {state,event,task}=reporting(),plan=ensureTaskPlan(event),key=taskPlanKey(event)
 plan.scope='人工限定的维修范围';plan.version=2
 const draft=structuredClone(event.decisionDraft),facts=structuredClone(event.reports[0].submissionSnapshot)
 submitTask(state,event.id,task.id,result)
 assert.equal(taskPlanKey(event),key);assert.equal(ensureTaskPlan(event),plan)
 assert.equal(plan.scope,'人工限定的维修范围');assert.equal(plan.version,2)
 assert.deepEqual(event.decisionDraft,draft);assert.deepEqual(event.reports[0].submissionSnapshot,facts)
 assert.equal(event.reports[0].summary,result.patch.summary)
})

test('an in-flight generated plan remains valid across automatic report enrichment',()=>{
 const {state,event,task}=reporting();event.backendManaged=true
 const draft=ensureTaskPlan(event),expected={key:draft.key,version:draft.version}
 assert.equal(draft.status,'pending')
 submitTask(state,event.id,task.id,result)
 acceptTaskPlan(event,expected,{plan:{scope:'核对连接并处理已确认异常',rationale:'依据已回交现场记录安排。',steps:[{label:'处理已确认连接异常',guide:'核对批准范围和隔离条件后处理连接。',checks:['记录处理前后状态。'],recordHint:'回交连接复核和复测结果。'}]}})
 assert.equal(draft.status,'ready');assert.ok(draft.steps.length)
})

test('explicit report supplements and regeneration still invalidate a prepared plan',async()=>{
 for(const mode of ['supplement','regenerate']){
  const {state,event,task}=reporting();ensureTaskPlan(event);submitTask(state,event.id,task.id,result)
  const before=taskPlanKey(event),report=event.reports[0]
  if(mode==='supplement')applyReportSupplement(state,event.id,{id:'revision-1',reportId:report.id,baseMarkdown:report.markdown,text:'补充实际检查范围。',patch:{...result.patch,summary:'新增现场核对结果，需调整处理范围。'},sources:[]})
  else await refreshTaskReport(state,event.id,report.id,async()=>({...result,patch:{...result.patch,summary:'重新核对提交记录，调整后续范围。'}}))
  assert.notEqual(taskPlanKey(event),before);assert.equal(report.planningBasisMarkdown,undefined)
 }
})

test('remaining work is retained before AI finishes a repair report',()=>{
 const {state,event,task}=reporting();submitTask(state,event.id,task.id,result);ensureTaskPlan(event)
 state.role='captain';decide(state,event.id,{action:'repair',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const repair=currentTask(event);state.role='engineer'
 repair.draft.records.forEach((r,i)=>{r.result=i?'已完成':'未完成';r.executionStatus=i?'已完成':'未完成';r.note=i?'已完成该项。':'等待备件。'})
 repair.draft.summary='部分完成，剩余项目等待备件。';beginTaskReport(state,event.id,repair.id,'repair-report')
 assert.ok(carryForwardSteps(event).some(step=>step.carryFromTaskId===repair.id))
 assert.ok(ensureTaskPlan(event).steps.length)
})

test('unsubmitted work cannot qualify merely by changing AI status; empty cached plans recover',()=>{
 const {event,task}=reporting()
 assert.equal(hasSubmittedFeedback({...event,reports:[]},task),false)
 assert.equal(hasSubmittedFeedback(event,{...task,submittedAt:null}),false)
 const plan=ensureTaskPlan(event);plan.steps=[]
 assert.ok(ensureTaskPlan(event).steps.length)
})
