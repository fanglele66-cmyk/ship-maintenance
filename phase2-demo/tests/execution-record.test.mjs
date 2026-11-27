import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
test('shared execution draft validates, records once and waits for comparable data',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js');setActivePinia(createPinia());const store=usePhase2DemoStore()
  store.openRealCase('bearing-health');assert.ok(store.createTodo('maintenance'));store.progress.maintenance=2;store.selectTodo('maintenance')
  let form=store.executionInquiry('maintenance');assert.ok(form)
  assert.equal(store.confirmExecutionRecord('maintenance',form.id,{}),false)
  const stepForm=store.stageFeedbackForm('maintenance')
  const outcomes=Object.fromEntries(store.currentStage.tasks.map((_,i)=>['result_'+i,i===1?'未完成':'已完成']))
  store.updateStageFeedback('maintenance',outcomes,stepForm.id)
  assert.ok(store.submitStageFeedback('maintenance',stepForm.id).ok)
  const values={measures:'复装并复测',executedAt:'2026-10-01T10:00',acceptance:'复测尚待补齐',verification:'resolved'}
  assert.equal(store.confirmExecutionRecord('maintenance',form.id,values),false)
  assert.equal(store.progress.maintenance,2)
  assert.equal(store.executionRecords.maintenance,undefined)
  assert.ok(store.reviseWorkStepFeedback('maintenance'))
  store.updateStageFeedback('maintenance',{result_1:'已完成',note_1:'复装检查已完成'},stepForm.id)
  assert.ok(store.submitStageFeedback('maintenance',stepForm.id).ok)
  const final={...values,acceptance:'间隙复测合格，复装检查完成'}
  assert.ok(store.confirmExecutionRecord('maintenance',form.id,final))
  const receipt=JSON.stringify(store.executionRecords.maintenance[0])
  assert.ok(store.confirmExecutionRecord('maintenance',form.id,final))
  assert.equal(store.executionRecords.maintenance.length,1)
  assert.equal(JSON.stringify(store.executionRecords.maintenance[0]),receipt)
  assert.equal(store.isTaskHandled('maintenance'),true)
  assert.equal(store.executionRecords.maintenance[0].values.comparable,'missing')
  store.resetDemo();assert.equal(store.executionRecords.maintenance,undefined)
 }finally{await server.close()}
})
