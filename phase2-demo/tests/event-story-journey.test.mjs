import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('additional stories accept independent check choices and retain the group-lead execution flow',async()=>{
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
   assert.equal(store.advanceTodo(id,feedback.slice(0,1)).saved,false)
   assert.equal(store.currentStage.kind,'check')
   const actual=feedback.map((r,i)=>({...r,result:i?'发现异常':'未见异常'}))
   assert.equal(store.advanceTodo(id,actual).advanced,true)
   assert.equal(store.currentStage.kind,'work')
   assert.deepEqual(store.logs[id].findLast(r=>r.kind==='feedbackRecord').records.map(r=>r.result),['未见异常','发现异常'])
   const form=store.executionInquiry(id)
   const values={equipment:store.cases[id].device,task0:'已完成',task1:'已完成',measures:'记录本次实际处理',executedAt:'2026-10-12T10:00',acceptance:'原异常仍存在',completion:'completed',verification:'unresolved',comparable:'missing'}
   assert.equal(store.confirmExecutionRecord(id,form.id,values),true)
   assert.equal(store.isTaskHandled(id),true)
   assert.equal(store.executionRecords[id].length,1)
   assert.equal(store.taskResults[id+':repair:0'],'已完成')
   assert.equal(store.visibleTodos.filter(t=>t.id===id).length,1)
   assert.equal(store.confirmExecutionRecord(id,form.id,values),false)
   assert.equal(store.executionRecords[id][0].values.verification,'unresolved')
   assert.equal(store.assignments[id].owner,store.cases[id].owner)
  }
  store.resetDemo();store.createTodo('fault');assert.equal(store.visibleTodos.length,2);assert.equal(store.progress['steering-heat'],0);assert.equal(store.executionRecords['steering-heat'],undefined)
 }finally{await server.close()}
})
