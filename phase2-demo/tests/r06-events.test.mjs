import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {relatedEvents} from '../src/mock/r06Events.js'
test('R06 event identity, sources, business timestamps and closure boundaries',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();for(const id of ['fault','aux-health','maintenance'])store.unlockedRecommendations[id]=true;store.createTodo('fault')
  assert.equal(relatedEvents(store).length,1);assert.equal(relatedEvents(store)[0].source,null)
  const at=store.eventUpdatedAt.fault
  store.selectTodo('fault');store.closeTodo();store.sendSituation('是不是滤器堵了？','device')
  assert.equal(store.eventUpdatedAt.fault,at)
  store.submitAttentionFeedback('drift',{reading:432,conditions:'09:00稳定负荷',phenomenon:'未见异响',confirmed:true})
  assert.equal(relatedEvents(store).length,1)
  store.createTodo('aux-health');store.createTodo('aux-health')
  assert.equal(relatedEvents(store).length,2)
  assert.equal(relatedEvents(store).find(e=>e.id==='aux-health').source.type,'异动跟踪')
  assert.notEqual(relatedEvents(store).find(e=>e.id==='aux-health').updatedAt,'更新时间未同步')
  store.createTodo('maintenance');assert.equal(relatedEvents(store).length,3)
  assert.equal(relatedEvents(store).find(e=>e.id==='bearing-health').source.type,'异动跟踪')
  store.progress.fault=store.observationIndex('fault')
  store.observationRecords.fault.push({label:'首测',day:0,status:'normal',values:[79.1,86.5]},{label:'第1日',day:1,status:'normal',values:[79.1,86.5]})
  assert.equal(store.completeObservation('fault').ok,false,'observation alone cannot replace accepted work')
  const workIndex=store.cases.fault.stages.findIndex(stage=>stage.kind==='work')
  store.progress.fault=workIndex;store.activeStage.fault=workIndex
  store.selectTodo('fault')
  const execution=store.executionInquiry('fault')
  assert.equal(store.confirmExecutionRecord('fault',execution.id,{...execution.values,executedAt:'2026-10-26T08:00',measures:'本轮获批范围已完成',acceptance:'本轮现场验收通过',verification:'resolved'}),true)
  assert.equal(store.completeObservation('fault',{reason:'本轮现场验收已确认，现有观察资料及后续常规跟踪安排已核对。'}).ok,true)
  const observed=relatedEvents(store).find(e=>e.id==='fault')
  assert.equal(observed.ended,true);assert.match(observed.processing,/已结束/)
  assert.equal(relatedEvents(store).filter(e=>!e.ended).length,2)
  // Adapter contract only: a future event service supplies a true closed status.
  // Legacy closed stage is reached by automatic observation and is not such a status.
  const canonical={...store,eventStatus:{fault:'closed'}}
  assert.equal(relatedEvents(canonical).find(e=>e.id==='fault').ended,true)
  assert.equal(relatedEvents(canonical).filter(e=>!e.ended).length,2)
  store.resetDemo();store.unlockedRecommendations.fault=true;store.createTodo('fault');assert.equal(relatedEvents(store).length,1)
  assert.ok(store.eventUpdatedAt.fault);assert.equal(store.eventUpdatedAt.drift,undefined)
 }finally{await server.close()}
})
