import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,currentTask,submitTask,people,ensureTaskPlan} from '../src/workflow/eventLifecycle.js'
import {decide} from './helpers/confirmed-decision.mjs'
import {maintenancePlans,availableMaintenanceWindows} from '../src/workflow/maintenancePlans.js'
import {generateTaskReport} from '../src/workflow/taskReportGeneration.js'
import {taskExecution} from '../src/workflow/taskExecution.js'
import {decisionAnalysisItems} from '../src/workflow/lifecycleAnalysis.js'
import {shoreReportPresentation} from '../src/workflow/shoreReports.js'

const future=()=>new Date(Date.now()+86400000).toISOString()
function assign(state,event,action,extra={}){
 state.role='captain';event.decisionDraft={action,...extra};ensureTaskPlan(event).status='ready'
 decide(state,event.id,{action,owner:people.engineer,deadline:future(),reason:'核对本轮记录',...extra})
 state.role='engineer';return currentTask(event)
}
function fill(task){task.draft.records.forEach((r,i)=>{r.result=task.steps[i].options[0];r.note='现场记录 '+(i+1);r.executionStatus='已完成'})}
function setup(kind){
 const state=createLifecycleState(),event=state.events[kind==='maintenance'?'real-tracking-exhaust-baseline':'real-alarm-0430']
 let task=assign(state,event,'investigate')
 if(kind!=='investigation'){
  fill(task);submitTask(state,event.id,task.id)
  if(kind==='maintenance'){
   const plan=maintenancePlans(event)[0],window=availableMaintenanceWindows()[0]
   task=assign(state,event,'maintenance',{maintenancePlanId:plan.id,window:window.id,deadline:window.end})
  }else{
   task=assign(state,event,'repair')
   if(kind==='recheck'){fill(task);submitTask(state,event.id,task.id);task=assign(state,event,'recheck')}
  }
 }
 return {state,event,task}
}

for(const kind of ['investigation','repair','maintenance','recheck'])test(kind+' submits step records without requiring a second summary',()=>{
 const {state,event,task}=setup(kind);fill(task)
 const records=JSON.parse(JSON.stringify(task.draft.records)),report=submitTask(state,event.id,task.id)
 assert.equal(task.status,'submitted');assert.deepEqual(task.records,records)
 assert.equal(task.summarySource,'records');assert.equal(report.submissionSnapshot.summarySource,'records')
 for(const r of records)assert.ok(task.summary.includes(r.note))
 assert.doesNotMatch(report.markdown,/### 执行人汇总/)
 assert.throws(()=>submitTask(state,event.id,task.id),/已提交/)
})

test('direct submission rejects skipped results and retains optional executor conclusions',()=>{
 const {state,event,task}=setup('investigation');fill(task);task.draft.records[0].result=''
 assert.throws(()=>submitTask(state,event.id,task.id),/每个步骤/);assert.equal(event.reports.length,0)
 task.draft.records[0].result=task.steps[0].options[0];task.draft.summary='人工补充：缺少独立读数，尚不能确认原因。'
 const report=submitTask(state,event.id,task.id)
 assert.equal(task.summarySource,'executor');assert.match(report.markdown,/人工补充：缺少独立读数/)
})

test('not applicable is not made incomplete by the derived factual summary',()=>{
 const {state,event,task}=setup('repair');fill(task)
 task.draft.records[0].result='不适用';task.draft.records[0].note='该项不适用，本轮暂未实施。'
 submitTask(state,event.id,task.id);assert.equal(taskExecution(task).incomplete,false)
})

test('AI retry uses the first formal step snapshot and does not submit duplicate reports',async()=>{
 const {state,event,task}=setup('investigation');fill(task)
 await assert.rejects(generateTaskReport(state,event.id,task.id,async()=>{throw Error('连接中断')}),/连接中断/)
 const first=structuredClone(event.reports.at(-1));task.draft.records[0].note='提交后的草稿修改'
 await generateTaskReport(state,event.id,task.id,async body=>{
  assert.doesNotMatch(JSON.stringify(body.event.tasks),/提交后的草稿修改/)
  return {model:'test',sources:[],patch:{summary:'现场结果已回交',analysis:{evidence:'原始记录',interpretation:'原因未确认',unverified:'缺少独立测温',next:'补充独立测温'}}}
 })
 assert.equal(event.reports.length,1);assert.equal(event.reports[0].id,first.id)
 assert.deepEqual(event.reports[0].submissionSnapshot,first.submissionSnapshot)
})

test('resuming a task derives its next summary from new records and preserves the previous submission',()=>{
 const {state,event,task}=setup('repair');fill(task)
 task.draft.records[1].result='未完成';task.draft.records[1].note='备件未到，换装未完成。'
 const first=submitTask(state,event.id,task.id),frozen=JSON.stringify(first)
 state.role='captain';decide(state,event.id,{action:'wait',reason:'等待备件到船'})
 decide(state,event.id,{action:'resume',reason:'备件已核验，继续原范围',deadline:future()})
 assert.equal(task.draft.summary,'');fill(task);state.role='engineer'
 const second=submitTask(state,event.id,task.id)
 assert.doesNotMatch(second.summary,/备件未到/);assert.equal(taskExecution(task).incomplete,false)
 assert.equal(JSON.stringify(first),frozen);assert.equal(event.reports.filter(r=>r.taskId===task.id).length,2)
})

test('legacy analysis labels and frozen shore reports get concise presentation without changing originals',()=>{
 const {state,event,task}=setup('investigation');fill(task);const report=submitTask(state,event.id,task.id)
 report.analysisMarkdown='### AI分析（原因与措施判断）\n\n仍需独立复测。'
 assert.equal(decisionAnalysisItems(event,task,report)[0].label,'原因与措施判断')
 state.role='captain';decide(state,event.id,{action:'shore',shoreIncludeHistory:true,shoreSituation:{}})
 const sent=event.shore.at(-1);sent.syncedReport.presentationVersion=2;sent.syncedReport.markdown+='\n\nAI 分析已生成。'
 const frozen=JSON.stringify(sent),view=shoreReportPresentation(sent)
 assert.doesNotMatch(view.markdown,/AI 分析已生成/);assert.match(view.markdown,/现场记录 1/);assert.equal(JSON.stringify(sent),frozen)
 sent.syncedReport.edited=true;assert.equal(shoreReportPresentation(sent).markdown,sent.syncedReport.markdown)
})
