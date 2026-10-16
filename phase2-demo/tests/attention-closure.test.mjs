import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('R03 closure shares evidence, records once and does not close events',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try {
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {attentionDossier}=await server.ssrLoadModule('/src/mock/attentionDossier.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault')
  const ended=attentionDossier(store,'cyl2-ended')
  assert.equal(ended.closure.reason,'持续监测确认恢复正常')
  assert.equal(ended.closure.at,'2026/10/12 08:00')
  assert.match(ended.closure.basis.join(' '),/反复/)
  assert.match(ended.closure.coverage,/6个有效可比片段/)
  assert.doesNotMatch(ended.closure.basis.join(' '),/420|421|1→1→0/)
  assert.equal(ended.records.filter(r=>r.type==='closure').length,1)
  assert.equal(ended.records.at(-1).label,'系统确认事项结束')
  assert.equal(attentionDossier(store,'drift').closure,null)
  store.progress.fault=store.observationIndex('fault')
  store.observationRecords.fault.push({label:'首测',status:'normal',day:0,values:[79.1,86.5]},{label:'第1日',status:'normal',day:1,values:[79.1,86.5]})
  const previous=store.progress.fault
  const result=attentionDossier(store,'fault')
  assert.equal(result.closure.reason,'处理后恢复正常')
  assert.equal(result.closure.at,'第1日')
  assert.equal(store.progress.fault,previous)
  assert.equal(result.records.filter(r=>r.type==='closure').length,1)
  store.observationRecords.fault.push({label:'缺失记录',status:'incomplete',day:2})
  assert.equal(attentionDossier(store,'fault').closure,null)
 } finally {await server.close()}
})
