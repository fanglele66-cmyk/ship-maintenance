import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
test('maintenance JSON flow isolates topics and follows shared decisions',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try {
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useMaintenanceAdviceStore}=await server.ssrLoadModule('/src/stores/maintenanceAdviceStore.js')
  const {appendMessages}=await server.ssrLoadModule('/src/message-flows/appendMessages.js')
  const {maintenanceMessageFlow,maintenanceReply}=await server.ssrLoadModule('/src/message-flows/maintenanceSources.js')
  setActivePinia(createPinia());const core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore()
  const first=maintenanceMessageFlow(core,advice)
  assert.equal(first.length,1)
  assert.equal(first[0].type,'report')
  assert.equal(first[0].expanded,true)
  assert.equal(first[0].actions.some(a=>a.id==='maintenance:check'),false)
  assert.match(maintenanceReply(core,'已有安排是否冲突？').text,/尚未取得/)
  advice.enableExample()
  const published=appendMessages([],first),original=JSON.stringify(published[0])
  advice.supplement('备件需确认')
  assert.equal(core.todoCreated.maintenance,false)
  assert.ok(maintenanceMessageFlow(core,advice).some(m=>m.title==='补充信息'))
  advice.decide('execute')
  const linked=maintenanceMessageFlow(core,advice)
  appendMessages(published,linked)
  assert.equal(JSON.stringify(published[0]),original,'clicking does not rewrite published replies')
  assert.ok(published.some(m=>m.role==='user'&&m.text==='采纳并安排执行'))
  assert.ok(published.some(m=>m.title==='采纳并安排执行'))
  const length=published.length;appendMessages(published,linked);assert.equal(published.length,length,'recomputation does not duplicate replies')
  assert.equal(linked[0].actions.some(a=>a.id==='maintenance:check'),false)
  assert.equal(linked[0].actions.some(a=>a.id==='maintenance:event'),true)
  assert.ok(linked.some(m=>m.title==='采纳并安排执行'))
  core.progress.drift=4
  assert.equal(maintenanceMessageFlow(core,advice)[0].actions.some(a=>a.id==='maintenance:execute'),false)
  advice.decide('defer','当前靠港条件不具备')
  assert.match(maintenanceMessageFlow(core,advice)[0].paragraphs[0].text,/暂不采纳原因/)
  assert.equal(maintenanceMessageFlow(core,advice,true)[0].actions[0].id,'maintenance:advice')
 }finally{await server.close()}
})
