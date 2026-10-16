import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
test('shared execution draft validates, records once and waits for comparable data',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js');setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault')
  store.createTodo('maintenance');store.progress.maintenance=2;store.selectTodo('maintenance')
  let form=store.executionInquiry('maintenance');assert.ok(form)
  assert.equal(store.confirmExecutionRecord('maintenance',form.id,{}),false)
  const values={equipment:'主机1#缸连杆轴承',task0:'已完成',task1:'待补充',measures:'复装并复测',executedAt:'2026-10-01T10:00',acceptance:'复测尚待补齐',completion:'completed',verification:'resolved',comparable:'missing'}
  store.updateExecutionRecord('maintenance',form.id,values);assert.equal(store.taskResults['maintenance:service:1'],'待补充')
  assert.equal(store.confirmExecutionRecord('maintenance',form.id,values),false)
  values.completion='partial';assert.equal(store.confirmExecutionRecord('maintenance',form.id,values),true);assert.equal(store.progress.maintenance,2)
  const old=JSON.stringify(form);form=store.executionInquiry('maintenance');assert.ok(form);assert.equal(store.executionRecords.maintenance.length,1)
  store.selectedTodoId='maintenance';store.sendTodo('补充：复装检查已完成');assert.match(form.values.supplement,/复装检查已完成/)
  const final={...form.values,task1:'已完成',completion:'completed',acceptance:'间隙复测合格，复装检查完成'}
  assert.equal(store.confirmExecutionRecord('maintenance',form.id,final),true);assert.equal(store.isTaskHandled('maintenance'),true)
  assert.equal(store.confirmExecutionRecord('maintenance',form.id,final),false)
  assert.equal(store.executionRecords.maintenance.length,2);assert.equal(store.executionObservationReady('maintenance'),false);assert.equal(store.observationRecords.maintenance.length,0)
  assert.equal(JSON.stringify(store.logs.maintenance.find(m=>m.id===JSON.parse(old).id)),old)
  store.resetDemo();store.createTodo('fault');assert.equal(store.executionRecords.maintenance,undefined)
 }finally{await server.close()}
})
