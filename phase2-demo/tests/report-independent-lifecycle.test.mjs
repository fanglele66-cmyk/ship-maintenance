import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,ensureTaskPlan,people,decisionOptions} from '../src/workflow/eventLifecycle.js'
import {generateTaskReport,recoverTaskReportGeneration} from '../src/workflow/taskReportGeneration.js'
import {lifecycleSnapshot} from '../src/workflow/demoTimeline.js'
import {mergeDemoWorkspace} from '../src/workflow/workspaceCache.js'
import {createDecisionEditing} from '../src/workflow/decisionEditing.js'
import {taskPlanKey} from '../src/workflow/taskPlanning.js'
import {createBackendWorkflowSync} from '../src/workflow/backendWorkflowSync.js'
import {createEventRepository} from '../server/event-repository.mjs'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const model={model:'isolated',patch:{summary:'现场检查发现连接松动，建议按已确认范围处理。',analysis:{evidence:'执行人员已正式提交连接检查记录。',interpretation:'连接异常需要处理并复测。',unverified:'处理后效果尚待验证。',next:'由轮机长确定后续安排。'}},sources:[]}
function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 event.decisionDraft={action:'investigate'};ensureTaskPlan(event)
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer';const task=currentTask(event)
 task.draft.records.forEach(r=>{r.result='发现异常';r.executionStatus='已完成';r.note='检查连接，发现松动。'})
 task.draft.summary='检查完成，发现连接松动。'
 return {state,event,task}
}
function dispatch(state,event){
 state.role='captain';event.decisionDraft={action:'repair'};ensureTaskPlan(event)
 decide(state,event.id,{action:'repair',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
}
for(const action of ['repair','observe','close'])test(`AI completes its original report after chief chooses ${action}`,async()=>{
 const {state,event,task}=fixture();let finish,emit
 const pending=generateTaskReport(state,event.id,task.id,(_body,on)=>{emit=on;return new Promise(resolve=>finish=resolve)})
 assert.equal(task.status,'submitted');assert.equal(task.reportGeneration.status,'streaming');assert.equal(event.reports.length,1)
 assert.ok(decisionOptions(event).some(o=>o.value===action))
 const original=event.reports[0],facts=structuredClone(original.submissionSnapshot)
 state.role='captain';event.decisionDraft={action,reason:'依据已提交记录确认本次安排。'}
 if(action==='repair')dispatch(state,event)
 else decide(state,event.id,{action,reason:'依据已提交记录确认本次安排。'})
 const business=JSON.stringify([event.phase,event.status,event.currentTask,event.decisions,event.phases])
 const next=currentTask(event),nextDraft=structuredClone(next.draft)
 if(action==='repair')assert.ok(next.steps.every(step=>(step.substeps?.length||0)<=2),'repair dispatched while AI is streaming has at most two substeps per feedback step')
 emit('report',{patch:{summary:'AI 报告继续生成',analysis:{}}});finish(model)
 const result=await pending
 assert.equal(result.id,original.id);assert.deepEqual(result.submissionSnapshot,facts)
 assert.equal(result.summary,model.patch.summary);assert.equal(task.reportGeneration.status,'complete')
 assert.equal(JSON.stringify([event.phase,event.status,event.currentTask,event.decisions,event.phases]),business)
 assert.deepEqual(next.draft,nextDraft)
})

test('failure and historical retry leave the new task and decision intact',async()=>{
 const {state,event,task}=fixture();let fail
 const pending=generateTaskReport(state,event.id,task.id,()=>new Promise((_resolve,reject)=>fail=reject))
 const rejected=assert.rejects(pending,/离线/)
 dispatch(state,event);const next=currentTask(event),business=JSON.stringify([event.phase,event.status,event.currentTask,event.decisions])
 fail(Error('离线'));await rejected
 assert.equal(task.status,'submitted');assert.equal(task.reportGeneration.status,'error')
 state.role='engineer'
 await generateTaskReport(state,event.id,task.id,async body=>{assert.equal(body.event.tasks[0].id,task.id);assert.equal(body.reportId,event.reports[0].id);return model})
 assert.equal(currentTask(event),next);assert.equal(next.status,'assigned')
 assert.equal(JSON.stringify([event.phase,event.status,event.currentTask,event.decisions]),business)
 assert.equal(event.reports.length,1)
})

test('late model output cannot replace a human revision of the same report',async()=>{
 const {state,event,task}=fixture();let finish
 const pending=generateTaskReport(state,event.id,task.id,()=>new Promise(resolve=>finish=resolve))
 const report=event.reports[0];report.markdown+='\n人工补充的检查范围。';const revised=structuredClone(report)
 finish(model);await assert.rejects(pending,/报告已有补充/)
 assert.deepEqual(report,revised);assert.equal(task.status,'submitted');assert.equal(task.reportGeneration.status,'error')
})

test('stream deltas do not rewrite shared snapshots and incoming updates preserve live progress',async()=>{
 const {state,event,task}=fixture();let finish,emit
 const pending=generateTaskReport(state,event.id,task.id,(_body,on)=>{emit=on;return new Promise(resolve=>finish=resolve)})
 const before=lifecycleSnapshot(state)
 for(let i=0;i<100;i++){emit('reasoning',{delta:'增量'});emit('report',{patch:{summary:'部分报告 '+i,analysis:{}}});emit('progress',{label:'生成中 '+i})}
 assert.equal(lifecycleSnapshot(state),before)
 const incoming=JSON.parse(before);incoming.events[event.id].decisionDraft={action:'observe'}
 const merged=mergeDemoWorkspace(state,incoming),live=merged.events[event.id].tasks.find(t=>t.id===task.id)
 assert.equal(live.conversations.engineer.at(-1).reasoning.length,200)
 assert.equal(live.reportGeneration.patch.summary,'部分报告 99')
 state.events=merged.events;finish(model);await pending
 assert.notEqual(lifecycleSnapshot(state),before)
})

test('open decision edits survive report refresh but are not carried into a different stage',()=>{
 const {state,event,task}=fixture();const editing=createDecisionEditing()
 event.decisionDraft={action:'observe',observationPlan:{purpose:'保留人工输入'}};editing.begin(event)
 const incoming=structuredClone(event);incoming.decisionDraft={action:''}
 editing.preserve(event,incoming);assert.equal(incoming.decisionDraft,event.decisionDraft)
 const next=structuredClone(event);next.phase='closed';next.decisionDraft={action:''}
 editing.preserve(event,next);assert.equal(next.decisionDraft.action,'')
 editing.end(event.id);const after=structuredClone(event);after.decisionDraft={action:''}
 editing.preserve(event,after);assert.equal(after.decisionDraft.action,'')
})

test('legacy recovery and reload failure do not move the business phase back',()=>{
 const {state,event,task}=fixture()
 // A persisted pre-upgrade task may still use the old overloaded status.
 task.status='reporting';task.submittedAt=new Date().toISOString();task.reportGeneration={status:'streaming',ownerSession:'owner',startedAt:Date.now()};event.reports.push({id:'fact',taskId:task.id})
 event.phase='repair';event.status='维修中'
 recoverTaskReportGeneration(state,'another');assert.equal(task.status,'submitted');assert.equal(task.reportGeneration.status,'streaming')
 recoverTaskReportGeneration(state,'owner');assert.equal(task.reportGeneration.status,'error');assert.equal(event.phase,'repair');assert.equal(event.status,'维修中')
})

test('two backend accounts merge a late report into the old task without losing the new dispatch',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-independent-report-')),repository=await createEventRepository(directory)
 const {event}=fixture();event.backendManaged=true;await repository.save(event)
 const clients=[]
 const client=async role=>{const state={role,events:{},notices:[]},sync=createBackendWorkflowSync(state,async(path,body)=>path==='workflow/events'?{events:repository.list()}:{event:await repository.save(body.event,{expected:body.revision,user:{workflowRole:role}})});await sync.pull();clients.push(sync);return {state,sync}}
 try{
  const chief=await client('captain'),engineer=await client('engineer');const task=currentTask(engineer.state.events[event.id]);let finish
  const pending=generateTaskReport(engineer.state,event.id,task.id,()=>new Promise(resolve=>finish=resolve))
  await engineer.sync.flush();await chief.sync.refresh()
  const e=chief.state.events[event.id];e.decisionDraft={action:'repair'};const plan=ensureTaskPlan(e)
  // Isolated ready model plan; real requests are tested through the browser fixture.
  Object.assign(plan,{status:'ready',steps:[{label:'处理已确认连接',guide:'隔离后处理。',checks:['复测记录。'],recordHint:'回交状态。',options:['已完成','未完成','不适用']}]})
  decide(chief.state,e.id,{action:'repair',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()});await chief.sync.flush()
  const newTaskId=currentTask(e).id
  // Engineer has not pulled the dispatch yet: the completion must rebase safely.
  finish(model);await pending;await engineer.sync.flush();await chief.sync.refresh()
  const saved=repository.get(event.id)
  assert.equal(saved.currentTask,newTaskId);assert.equal(saved.phase,'repair')
  assert.equal(saved.tasks.find(t=>t.id===newTaskId).status,'assigned')
  assert.equal(saved.reports[0].summary,model.patch.summary)
  assert.equal(saved.tasks.find(t=>t.id===task.id).reportGeneration.status,'complete')
 }finally{clients.forEach(c=>c.close());await repository.close();await rm(directory,{recursive:true,force:true})}
})
