import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('integrated warning assessment retains every evidence branch and operator guidance',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  for(const reading of ['现场与系统一致','读数不一致','无法确认'])for(const condition of ['工况可比，偏离仍存在','工况变化可以解释','无法确认'])await t.test(reading+' / '+condition,()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore(),id='real-warning-0523'
   store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
   assert.equal(store.currentStage.label,'异常研判')
   assert.ok(!store.cases[id].stages.some(stage=>stage.label==='真实性核实'))
   const feedback=store.currentStage.tasks.map((task,i)=>({label:task.label,result:[reading,condition][i],note:'同刻记录与操作时序已留存。'}))
   assert.ok(store.advanceTodo(id,feedback).saved)
   if(reading==='现场与系统一致'&&condition==='工况可比，偏离仍存在'){
    assert.equal(store.currentStage.label,'原因排查')
    assert.equal(store.executionRecords[id]?.length||0,0)
   }else{
    assert.equal(store.currentStage.label,'异常研判')
    assert.deepEqual(store.checkAssessments[id].records,feedback)
    assert.ok(!store.decideCheck(id,'end-warning',''))
    assert.ok(store.decideCheck(id,'retry'))
    assert.equal(store.taskResults[id+':event:0'],reading)
    store.advanceTodo(id,feedback)
    assert.ok(store.decideCheck(id,'end-warning','已核对发生窗口，记录本轮解释与缺项，由人员确认结束核实。'))
    assert.equal(store.completedTasks[id].action,'end-warning')
    assert.equal(store.executionRecords[id]?.length||0,0)
   }
  })
  await t.test('all active real task checks have instructions without pre-submitted findings',()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore()
   for(const item of Object.values(store.cases).filter(item=>item.realCaseId))for(const stage of item.stages.filter(stage=>stage.kind==='check'))for(const task of stage.tasks){
    assert.ok(task.checks?.length>=2,`${item.id} / ${task.label}`)
    assert.ok(task.recordHint)
    assert.equal(task.result,undefined)
   }
  })
 }finally{await server.close()}
})
