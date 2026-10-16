import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
test('all actual check outcomes save without forcing the preset repair branch',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault');store.selectTodo('fault');store.selectTodo('fault')
  store.progress.fault=1;store.activeStage.fault=1
  const stage=store.cases.fault.stages[1]
  const feedback=stage.tasks.map((task,i)=>({label:task.label,result:i===0?'未见异常':'发现异常',note:'现场存在异常，待进一步核实',attachments:['现场照片.png']}))
  const result=store.advanceTodo('fault',feedback)
  assert.equal(result.saved,true);assert.equal(result.advanced,true);assert.equal(store.progress.fault,2);assert.match(store.currentStage.title,/温控阀/)
  assert.equal(store.logs.fault.filter(m=>m.kind==='feedbackRecord').length,1)
  assert.equal(store.logs.fault.filter(m=>m.kind==='feedbackRecord')[0].records[1].result,'发现异常')
  feedback[0].note='更改草稿'
  assert.notEqual(store.logs.fault.find(m=>m.kind==='feedbackRecord').records[0].note,feedback[0].note)
  store.progress.fault=1;store.activeStage.fault=1;delete store.checkAssessments.fault
  const unknown=stage.tasks.map(task=>({label:task.label,result:'无法确认',note:'条件不足'}))
  assert.equal(store.advanceTodo('fault',unknown).saved,true);assert.equal(store.progress.fault,1)
  const count=store.logs.fault.filter(m=>m.kind==='feedbackRecord').length
  store.advanceTodo('fault',unknown)
  assert.equal(store.logs.fault.filter(m=>m.kind==='feedbackRecord').length,count)
  assert.equal(store.advanceTodo('fault',[]).saved,false)
  const supported=stage.tasks.map((task,i)=>({label:task.label,result:i===0?'发现异常':'未见异常',note:'现场已核对'}))
  assert.equal(store.advanceTodo('fault',supported).advanced,true);assert.equal(store.progress.fault,2)
  assert.equal(store.logs.fault.filter(m=>m.kind==='feedbackRecord').length,count+1)
 }finally{await server.close()}
})
test('cooling investigation accepts two abnormal findings without losing either result',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 let store
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  setActivePinia(createPinia());store=usePhase2DemoStore();store.createTodo('fault');store.selectTodo('fault')
  store.progress.fault=1;store.activeStage.fault=1
  const stage=store.cases.fault.stages[1]
  const records=stage.tasks.map(task=>({label:task.label,result:'发现异常',note:'现场已发现异常，需按实际情况安排处置'}))
  const outcome=store.advanceTodo('fault',records)
  assert.equal(outcome.saved,true);assert.equal(outcome.advanced,true)
  assert.equal(store.progress.fault,2);assert.equal(store.activeStage.fault,2)
  assert.equal(store.cases.fault.stages[store.activeStage.fault].kind,'work')
  const saved=store.logs.fault.find(entry=>entry.kind==='feedbackRecord')
  assert.deepEqual(saved.records.map(r=>r.result),['发现异常','发现异常'])
  assert.match(outcome.message,/2项异常发现/)
  assert.equal(store.currentStage.tasks.length,4);assert.equal(store.cases.fault.workDetails.acceptance.length,4)
 }finally{store?.$dispose();await server.close()}
})
