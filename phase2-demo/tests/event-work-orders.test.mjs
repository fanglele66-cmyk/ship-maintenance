import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
test('R07 recommends, replaces selection with confirmation and never modifies source orders',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useMaintenanceAdviceStore}=await server.ssrLoadModule('/src/stores/maintenanceAdviceStore.js')
  const {useEventWorkOrderStore}=await server.ssrLoadModule('/src/stores/eventWorkOrderStore.js')
  setActivePinia(createPinia());const core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore(),orders=useEventWorkOrderStore()
  await orders.load('maintenance');const state=orders.state('maintenance'),original=JSON.stringify(state.orders)
  assert.equal(state.pendingId,'WO-ME-01');assert.equal(state.linked,null)
  assert.equal(orders.confirm('maintenance'),false)
  core.createTodo('maintenance');const before=core.progress.maintenance
  assert.equal(orders.choose('maintenance','WO-ME-02'),true);assert.equal(state.linked,null)
  assert.equal(orders.confirm('maintenance'),true);assert.equal(state.linked.id,'WO-ME-02')
  assert.equal(orders.confirm('maintenance'),false)
  orders.choose('maintenance','WO-ME-01');assert.equal(state.linked.id,'WO-ME-02')
  assert.equal(orders.confirm('maintenance'),true);assert.equal(state.records.at(-1).previousId,'WO-ME-02')
  assert.equal(JSON.stringify(state.orders),original);assert.equal(state.linked.status,'待执行')
  assert.equal(core.progress.maintenance,before)
  core.progress.maintenance=2;advice.decide('execute');assert.equal(core.progress.maintenance,2)
  assert.equal(core.todoCreated.maintenance,true)
  assert.ok(core.logs.maintenance.some(message=>message.role==='user'&&/确认关联/.test(message.text)))
  core.resetDemo();assert.equal(orders.state('maintenance').linked,null)
 }finally{await server.close()}
})
