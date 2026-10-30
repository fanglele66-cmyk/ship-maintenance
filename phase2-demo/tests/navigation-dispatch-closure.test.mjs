import test from 'node:test'
import assert from 'node:assert/strict'
import {navigationStages,occurrenceTime} from '../src/workflow/navigationStages.js'
import {aisNavigationReplay} from '../src/mock/aisNavigationReplay.js'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,people} from '../src/workflow/eventLifecycle.js'

test('navigation events use Shanghai occurrence times, exact boundaries, and alarm priority',()=>{
 const end=Date.parse('2026-10-30T12:00:00+08:00'),periods=aisNavigationReplay(end),last=periods.at(-1)
 const event=(id,type,at)=>({id,type,title:id,createdAt:new Date(at).toISOString()})
 const stages=navigationStages(periods,[event('old','报警事件',periods[0].start-1),event('boundary','预警事件',last.start),event('tracking','异动跟踪',last.start+1000),event('alarm','报警事件',end),event('future','报警事件',end+1),{id:'invalid',createdAt:'unknown'}])
 assert.equal(stages.at(-2).incidents.length,0)
 assert.deepEqual(stages.at(-1).incidents.map(i=>i.id),['boundary','tracking','alarm'])
 assert.equal(stages.at(-1).severity,'alarm')
 assert.deepEqual(stages.at(-1).incidents.map(i=>i.severity),['warning','warning','alarm'])
 assert.equal(occurrenceTime({createdAt:'2026-10-30 12:00'}),end)
 assert.equal(occurrenceTime({createdAt:'2026-10-30T12:00:00+08:00'}),end)
 assert.equal(occurrenceTime({createdAt:'2026-04-30 23:27 / 23:33'}),Date.parse('2026-04-30T23:27:00+08:00'))
 assert.equal(navigationStages(periods,[event('yellow','异动跟踪',last.start)]).at(-1).severity,'warning')
})

for(const id of ['real-alarm-0430','real-warning-0523','real-tracking-exhaust-baseline','real-health-c4-baseline'])test(`${id}: captain may close after first report, preserving feedback and requiring a reason`,()=>{
 const state=createLifecycleState(),event=state.events[id]
 if(!event.tasks.length){
  assert.ok(decisionOptions(event).some(o=>o.value==='false'))
  assert.ok(!decisionOptions(event).some(o=>o.value==='close'))
  decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:'核对现场情况'})
  assert.ok(!decisionOptions(event).some(o=>o.value==='close'))
  state.role='engineer'
  const task=currentTask(event)
  task.draft.records.forEach((r,i)=>r.result=task.steps[i].options[0])
  task.draft.summary='逐项核对结果和未完成范围均已记录。'
  submitTask(state,id,task.id)
 }
 assert.ok(decisionOptions(event).some(o=>o.value==='close'))
 const first=structuredClone(event.reports[0]),records=structuredClone(currentTask(event).records)
 state.role='engineer';assert.throws(()=>decide(state,id,{action:'close',reason:'已核对'}),/轮机长/)
 state.role='captain';assert.throws(()=>decide(state,id,{action:'close',reason:''}),/依据/)
 decide(state,id,{action:'close',reason:'已审阅本轮结果，人工确认归档，保留原始反馈。'})
 assert.equal(event.phase,'closed');assert.equal(event.reports.at(-1).kind,'闭环报告')
 assert.deepEqual(event.reports[0],first);assert.deepEqual(currentTask(event).records,records)
 assert.deepEqual(decisionOptions(event).map(o=>o.value),['shore'])
})

test('a phase flag alone cannot enable closure without a submitted report',()=>{
 const event=createLifecycleState().events['real-alarm-0430'];event.phase='decision'
 assert.ok(!decisionOptions(event).some(o=>o.value==='close'))
})
