import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,newEvent,decide,submitTask,currentTask,ensureTaskPlan,people,pendingDecision,refreshLifecyclePresentation} from '../src/workflow/eventLifecycle.js'
import {lifecycleWorkItems,lifecycleNotifications,taskNumber,findTask,canViewTask} from '../src/workflow/lifecycleWorkItems.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
const id='real-alarm-0430'
function assign(state,action='investigate'){
 state.role='captain';const event=state.events[id],plan=ensureTaskPlan(event);plan.status='ready'
 decide(state,id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:plan.scope})
 return currentTask(event)
}
function submit(state){
 state.role='engineer';const task=currentTask(state.events[id])
 task.draft.records.forEach((r,i)=>r.result=task.steps[i].options[0]);task.draft.summary='按本轮范围完成并记录现场结果。'
 return submitTask(state,id,task.id)
}
test('dispatch resolves the captain todo; one stable task is shared by dispatcher and assignee',()=>{
 const state=createLifecycleState(),before=lifecycleWorkItems(state)
 assert.equal(before.pending.length,4);assert.ok(before.pending.every(i=>i.kind==='decision'))
 const task=assign(state),captain=lifecycleWorkItems(state)
 assert.ok(!captain.pending.some(i=>i.eventId===id));assert.ok(captain.completed.some(i=>i.title==='派发排查'))
 const sent=captain.assigned.find(i=>i.taskId===task.id)
 assert.equal(sent.location.path,'/tasks/'+task.id);assert.equal(sent.number,task.number)
 state.role='engineer';const engineer=lifecycleWorkItems(state),received=engineer.pending.find(i=>i.taskId===task.id)
 assert.equal(received.id,sent.id);assert.deepEqual(engineer.assigned,[]);assert.ok(engineer.all.every(i=>i.owner===people.engineer))
 assert.equal(findTask(state,task.id).task,task)
})
test('submission archives only this task and produces a new captain decision, never a duplicate execution task',()=>{
 const state=createLifecycleState(),first=assign(state);submit(state)
 assert.ok(!lifecycleWorkItems(state).pending.some(i=>i.taskId===first.id));assert.ok(!lifecycleWorkItems(state).completed.some(i=>i.taskId===first.id));assert.equal(first.goalStatus,'awaiting-review')
 state.role='captain';assert.ok(lifecycleWorkItems(state).pending.some(i=>i.eventId===id&&i.kind==='decision'))
 assert.equal(state.events[id].tasks.length,1)
 const second=assign(state,'repair'),snapshot=JSON.stringify(second.draft);assert.equal(first.goalStatus,'completed');assert.ok(lifecycleWorkItems(state).completed.some(i=>i.taskId===first.id))
 state.role='engineer';assert.throws(()=>submitTask(state,id,first.id),/不是当前执行任务/)
 assert.equal(JSON.stringify(second.draft),snapshot);assert.equal(first.status,'submitted')
 assert.notEqual(taskNumber(state.events[id],first),taskNumber(state.events[id],second))
 assert.equal(lifecycleWorkItems(state).all.filter(i=>i.eventId===id).length,2)
})
test('pending reminders survive reading; newest reminder is ordered first and stale handoffs disappear',()=>{
 const state=createLifecycleState(),initial=lifecycleNotifications(state)
 assert.equal(initial.length,4)
 for(const e of Object.values(state.events))e.unread.captain=false
 assert.deepEqual(lifecycleNotifications(state).map(n=>n.id),initial.map(n=>n.id))
 const task=assign(state);assert.ok(!lifecycleNotifications(state).some(n=>n.eventId===id))
 state.role='engineer';assert.equal(lifecycleNotifications(state)[0].taskId,task.id)
 submit(state);assert.ok(!lifecycleNotifications(state).some(n=>n.taskId===task.id))
 state.role='captain';assert.equal(lifecycleNotifications(state)[0].eventId,id)
 const reminder=lifecycleNotifications(state)[0];state.notices.forEach(n=>n.read=true);state.events[id].unread.captain=false
 assert.equal(lifecycleNotifications(state)[0].id,reminder.id)
})
test('observation has no personnel todo until its scheduled window ends; reload does not duplicate the reminder',()=>{
 const state=createLifecycleState();assign(state);submit(state);assign(state,'repair');submit(state)
 const event=state.events[id],count=event.tasks.length;state.role='captain'
 decide(state,id,{action:'observe',reason:'先由系统继续观察至本阶段结束。'})
 const phase=event.phases.at(-1),at=phase.at,due=Date.parse(phase.observationDueAt)
 assert.equal(pendingDecision(event),false);assert.ok(!lifecycleWorkItems(state).pending.some(i=>i.eventId===id));assert.equal(event.tasks.length,count)
 syncLifecycleObservations(state,{recordedSensorChannels:()=>[]},due-1)
 assert.equal(pendingDecision(event),false)
 syncLifecycleObservations(state,{recordedSensorChannels:()=>[]},due)
 assert.equal(pendingDecision(event),true);assert.equal(phase.at,at);assert.equal(event.status,'待观察确认')
 const notices=lifecycleNotifications(state).filter(n=>n.eventId===id);assert.equal(notices.length,1);assert.match(notices[0].title,/观察结果/)
 const reloaded=JSON.parse(JSON.stringify(state));syncLifecycleObservations(reloaded,{recordedSensorChannels:()=>[]},due+1000)
 assert.equal(lifecycleNotifications(reloaded).filter(n=>n.eventId===id).length,1)
 state.role='engineer';assert.equal(lifecycleWorkItems(state).pending.length,0)
})
test('task permissions use the assignee, not mere participation in its parent event; legacy tasks remain accessible',()=>{
 const state=createLifecycleState(),task=assign(state);const event=state.events[id]
 delete task.number;delete task.title;delete task.assignedBy
 state.role='captain';assert.ok(lifecycleWorkItems(state).assigned.some(i=>i.taskId===task.id));assert.match(taskNumber(event,task),/CBY-TSK/)
 const other={...task,id:'other-assignee',owner:'王海（其他轮机员）'};event.tasks.push(other)
 state.role='engineer';assert.equal(canViewTask('engineer',other),false);assert.ok(!lifecycleWorkItems(state).all.some(i=>i.taskId===other.id))
 assert.equal(canViewTask('visitor',task),false);assert.equal(findTask(state,'missing'),null)
})
test('newly created events immediately become the latest pending reminder even when source evidence is older',()=>{
 const state=createLifecycleState(),original=state.events[id]
 state.events[id]=newEvent(original,{createdAt:'2026-10-29T11:00:00Z'})
 assert.equal(lifecycleNotifications(state)[0].eventId,id)
 assert.equal(lifecycleNotifications(state)[0].at,'2026-10-29T11:00:00Z')
 assert.equal(state.events[id].brief.discovery.at,original.brief.discovery.at)
 state.events[id].unread.captain=false
 assert.equal(lifecycleNotifications(state)[0].eventId,id)
})

test('a new supplement updates the pending reminder and remains pending after being read',()=>{
 const state=createLifecycleState();assign(state);submit(state);state.role='captain'
 const original=lifecycleNotifications(state)[0],event=state.events[id],at=new Date(Date.parse(original.at)+1000).toISOString()
 state.notices.push({id:'latest-supplement',eventId:id,reportId:event.reports.at(-1).id,recipient:'captain',title:'报告已补充',at,read:false})
 const reminder=lifecycleNotifications(state)[0]
 assert.match(reminder.title,/报告已补充/);assert.equal(reminder.at,at);assert.notEqual(reminder.id,original.id)
 state.notices.forEach(n=>n.read=true)
 assert.equal(lifecycleNotifications(state)[0].id,reminder.id)
 assert.equal(lifecycleNotifications(state).filter(n=>n.eventId===id).length,1)
})

test('observation resumed after a recheck survives reload and ends when the event closes',()=>{
 const state=createLifecycleState();assign(state);submit(state);const work=assign(state,'repair');submit(state)
 work.submittedAt=new Date(Date.now()-3600000).toISOString()
 const recheck=assign(state,'recheck');state.role='engineer'
 recheck.draft.records.forEach((r,i)=>r.result=recheck.steps[i].options.find(o=>o==='未见异常'))
 recheck.draft.summary='本轮复查未见异常。';submitTask(state,id,recheck.id);state.role='captain'
 assert.ok(work.observationEndedAt)
 decide(state,id,{action:'observe',reason:'复查已回交，继续观察至下一汇总窗口。'})
 const reloaded=refreshLifecyclePresentation(JSON.parse(JSON.stringify(state))),event=reloaded.events[id],resumed=event.tasks.find(t=>t.id===work.id)
 assert.ok(resumed.observationResumedAt);assert.equal(resumed.observationEndedAt,null);assert.equal(pendingDecision(event),false)
 decide(reloaded,id,{action:'close',reason:'复查及观察结果已由轮机长确认。'})
 assert.ok(resumed.observationEndedAt);assert.equal(event.phase,'closed');assert.ok(!lifecycleWorkItems(reloaded).pending.some(i=>i.eventId===id))
})

 test('restricted feedback remains unresolved after captain review and is never labeled completed',()=>{
 const state=createLifecycleState(),task=assign(state);state.role='engineer';task.draft.records.forEach((r,i)=>r.result=task.steps[i].options.includes('无法确认')?'无法确认':task.steps[i].options[0]);task.draft.summary='现场条件受限，保留待核实项。';submitTask(state,id,task.id);assert.equal(task.goalStatus,'awaiting-review');assert.equal(task.conversations.engineer.at(-1).reportId,state.events[id].reports.at(-1).id);state.role='captain';const next=ensureTaskPlan(state.events[id]);next.scope='补充核实受限项目';next.steps=structuredClone(task.steps);assign(state,'investigate');assert.equal(task.goalStatus,'unresolved');assert.ok(!lifecycleWorkItems(state).completed.some(i=>i.taskId===task.id));
 })
