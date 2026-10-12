import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {relatedEvents} from '../src/mock/r06Events.js'
test('R06 event identity, sources, business timestamps and closure boundaries',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore()
  assert.equal(relatedEvents(store).length,1);assert.equal(relatedEvents(store)[0].source,null)
  const at=store.eventUpdatedAt.fault
  store.selectTodo('fault');store.closeTodo();store.sendSituation('是不是滤器堵了？','device')
  assert.equal(store.eventUpdatedAt.fault,at)
  store.submitAttentionFeedback('drift',{reading:432,conditions:'09:00稳定负荷',phenomenon:'未见异响',confirmed:true})
  assert.equal(relatedEvents(store).length,1)
  store.createTodo('drift');store.createTodo('drift')
  assert.equal(relatedEvents(store).length,2)
  assert.equal(relatedEvents(store).find(e=>e.id==='drift').source.type,'关注事项')
  assert.notEqual(relatedEvents(store).find(e=>e.id==='drift').updatedAt,'更新时间未同步')
  store.createTodo('maintenance');assert.equal(relatedEvents(store).length,3)
  assert.equal(relatedEvents(store).find(e=>e.id==='maintenance').source.type,'维保建议')
  store.progress.fault=store.observationIndex('fault')
  store.observationRecords.fault.push({label:'首测',day:0,status:'normal',values:[79.1,86.5]},{label:'第1日',day:1,status:'normal',values:[79.1,86.5]})
  store.completeObservation('fault')
  const observed=relatedEvents(store).find(e=>e.id==='fault')
  assert.equal(observed.ended,false);assert.match(observed.processing,/本轮观察已结束/)
  assert.equal(relatedEvents(store).filter(e=>!e.ended).length,3)
  // Adapter contract only: a future event service supplies a true closed status.
  // Legacy closed stage is reached by automatic observation and is not such a status.
  const canonical={...store,eventStatus:{fault:'closed'}}
  assert.equal(relatedEvents(canonical).find(e=>e.id==='fault').ended,true)
  assert.equal(relatedEvents(canonical).filter(e=>!e.ended).length,2)
  store.resetDemo();assert.equal(relatedEvents(store).length,1)
  assert.equal(store.eventUpdatedAt.fault,'2026/10/12 07:50');assert.equal(store.eventUpdatedAt.drift,undefined)
 }finally{await server.close()}
})
