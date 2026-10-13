import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('first-phase examples use existing check, execution and unresolved return flow',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {scenarioSensors}=await server.ssrLoadModule('/src/mock/phase2Content.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault')
  assert.equal(store.visibleTodos.length,2)
  assert.equal(store.createTodo('air-delivery'),true)
  assert.equal(store.createTodo('main-warning'),true)
  for(const id of ['air-delivery','steering-heat','main-warning']){
   store.selectTodo(id)
   assert.equal(store.currentStage.kind,'overview')
   assert.ok(scenarioSensors(id).length>=(id==='steering-heat'?5:2))
   store.advanceTodo(id)
   const stage=store.currentStage
   const feedback=stage.tasks.map((task,i)=>({label:task.label,result:i?'未见异常':'发现异常',note:'现场核实结果'}))
   const uncertain=feedback.map(r=>({...r,result:'无法确认'}))
   assert.equal(store.advanceTodo(id,uncertain).saved,true)
   assert.equal(store.currentStage.kind,'check')
   assert.equal(store.advanceTodo(id,feedback).advanced,true)
   assert.equal(store.currentStage.kind,'work')
   assert.equal(store.advanceTodo(id).advanced,false)
   const form=store.executionInquiry(id)
   const values={equipment:store.cases[id].device,task0:'已完成',task1:'已完成',measures:'记录本次实际处理',executedAt:'2026-10-12T10:00',acceptance:'原异常仍存在',completion:'completed',verification:'unresolved',comparable:'missing'}
   assert.equal(store.confirmExecutionRecord(id,form.id,{...values,verification:'pending'}),false)
   assert.equal(store.confirmExecutionRecord(id,form.id,values),true)
   assert.equal(store.isTaskHandled(id),false)
   assert.equal(store.currentStage.kind,'check')
   assert.equal(store.executionRecords[id].length,1)
   assert.equal(store.taskResults[id+':repair:0'],undefined)
   assert.equal(store.visibleTodos.filter(t=>t.id===id).length,1)
   const snapshot=JSON.stringify(store.executionRecords[id][0])
   store.advanceTodo(id,feedback)
   const next=store.executionInquiry(id)
   assert.equal(next.values.task0,'')
   assert.equal(next.values.executedAt,undefined)
   assert.equal(store.confirmExecutionRecord(id,next.id,{...values,verification:'resolved',comparable:'available',acceptance:'已在可比工况复测并核对密封'}),true)
   assert.equal(store.isTaskHandled(id),true)
   assert.equal(JSON.stringify(store.executionRecords[id][0]),snapshot)
   assert.equal(store.executionRecords[id].length,2)
   assert.equal(store.assignments[id].owner,store.cases[id].owner)
  }
  store.resetDemo();store.createTodo('fault');assert.equal(store.visibleTodos.length,2);assert.equal(store.progress['steering-heat'],0);assert.equal(store.executionRecords['steering-heat'],undefined)
 }finally{await server.close()}
})
