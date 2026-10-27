import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('acceptance is the only work submission and failed acceptance appends an independent investigation round',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  for(const id of ['real-alarm-0430','real-warning-0523','real-maintenance-c4-baseline'])await t.test(id,()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore()
   store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
   const check=values=>store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'第一轮核实原文'})))
   if(id==='real-warning-0523'){check(['现场与系统一致','工况可比，偏离仍存在'])}
   const options=id.includes('maintenance')?['有提前处理依据','条件具备']:['发现异常','未见异常']
   check(options)
   assert.equal(store.currentStage.kind,'work')
   const workId=store.currentStage.id,oldTasks=JSON.stringify(store.currentStage.tasks),oldCount=store.cases[id].stages.length
   const form=store.executionInquiry(id)
   assert.deepEqual(form.fields.map(field=>field.key),['executedAt','measures','acceptance','verification'])
   const values={executedAt:'2026-08-01T10:00',measures:'第一轮实际处理记录',acceptance:'复测仍有原异常',verification:'unresolved'}
   assert.equal(store.confirmExecutionRecord(id,form.id,{...values,verification:'pending'}),false)
   assert.equal(store.confirmExecutionRecord(id,form.id,values),true)
   assert.equal(store.currentStage.kind,'check');assert.match(store.currentStage.id,/-r2$/)
   assert.equal(store.cases[id].stages.length,oldCount+2)
   assert.equal(store.executionRecords[id][0].values.measures,values.measures)
   assert.equal(JSON.stringify(store.cases[id].stages.find(stage=>stage.id===workId).tasks),oldTasks)
   const outcome=check(options)
   assert.equal(outcome.advanced,true);assert.equal(store.currentStage.kind,'work');assert.match(store.currentStage.id,/-r2$/)
   const next=store.executionInquiry(id)
   assert.equal(next.values.measures,undefined)
   assert.equal(store.confirmExecutionRecord(id,next.id,{...values,measures:'第二轮实际处理记录',acceptance:'复测通过',verification:'resolved'}),true)
   assert.equal(store.eventStatus[id],'observing');assert.equal(store.executionObservationReady(id),true)
   assert.equal(store.executionRecords[id].length,2)
   assert.equal(store.executionRecords[id][1].values.comparable,'missing')
   assert.equal(store.observationRecords[id].length,0,'acceptance must not invent monitoring data')
   assert.equal(store.isTaskHandled(id),true)
  })
 }finally{await server.close()}
})
