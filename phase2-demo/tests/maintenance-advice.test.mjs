import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
test('R04 decisions validate evidence, retain reason and reuse the same event',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try {
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useMaintenanceAdviceStore}=await server.ssrLoadModule('/src/stores/maintenanceAdviceStore.js')
  setActivePinia(createPinia());const core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore()
  assert.equal(advice.decide('execute'),false)
  advice.supplement('靠港时间待核对')
  assert.equal(core.todoCreated.maintenance,false)
  assert.equal(advice.decide('check'),false)
  advice.enableExample()
  assert.equal(core.todoCreated.drift,true)
  assert.equal(core.todoCreated.maintenance,false)
  assert.equal(advice.sufficient,true)
  const count=core.visibleTodos.length
  core.progress.drift=4
  assert.equal(advice.decide('defer',''),false)
  assert.equal(advice.decide('defer','备件暂未到船'),true)
  assert.equal(advice.status,'暂不采纳')
  assert.match(advice.records.at(-1).text,/不代表设备已恢复正常/)
  assert.equal(advice.decide('execute'),true)
  assert.equal(core.visibleTodos.length,count)
  assert.equal(core.progress.drift,4,'a decision never claims execution or advances the event')
  assert.equal(advice.decide('execute'),false)
  core.resetDemo();await nextTick()
  assert.equal(advice.records.length,0)
 } finally {await server.close()}
})
