import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'
import {detailedRepairSteps} from '../src/workflow/repairPlanning.js'
import {taskPackages} from '../src/mock/realTaskContent.js'
import {compactRepair} from '../src/mock/compactRepair.js'
import {normalizeTaskPlan} from '../src/workflow/taskPlanning.js'

test('new repair plans merge duplicated preparation/restoration while retaining all approved requirements',()=>{
 for(const [id,type,keys] of [['real-alarm-0430','alarm',['icv','supply']],['real-warning-0523','warning',['regulator','air']]]){
  const state=createLifecycleState(),event=state.events[id]
  decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
  state.role='engineer';const task=currentTask(event)
  task.draft.records.forEach((r,i)=>{r.result=task.steps[i].options[0];r.note=task.steps[i].label+'已定位异常'})
  submitTask(state,id,task.id)
  const methods=compactRepair({realType:type,packages:taskPackages(type)},keys).tasks
  const plan=detailedRepairSteps(event,methods),operations=plan.flatMap(s=>s.substeps||[s])
  assert.equal(plan.length,4)
  assert.equal(operations.length,9,'eleven original operations merge to nine')
  assert.ok(!operations.some(s=>/^(确认供气配置与隔离范围|确认作业范围与隔离标识|恢复供气并复测压力响应|恢复系统并复测喷射响应)$/.test(s.label)))
  const text=JSON.stringify(plan)
  for(const method of methods)for(const check of method.checks)assert.ok(text.includes(check),check)
  assert.match(text,/停机隔离|零能量/)
  assert.match(text,/分阶段试验/)
 }
})

test('the model operation budget counts nested substeps, not just their parent groups',()=>{
 const step=i=>({label:'作业项目'+i,guide:'按本机作业卡核对本项',checks:['落实本项作业要求','保存本项实际记录'],recordHint:'登记实际结果与未完成项'})
 const plan=count=>({scope:'本轮批准范围',rationale:'依据本轮现场记录',steps:[{...step(0),checks:[],substeps:Array.from({length:count},(_,i)=>step(i+1))},step(99)]})
 assert.equal(normalizeTaskPlan(plan(11),'repair').steps.length,2)
 assert.throws(()=>normalizeTaskPlan(plan(12),'repair'),/子项合计最多 12 项/)
})
