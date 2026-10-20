import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {healthReview,healthReviewReceipt,overviewActions,deviceHealthReply} from '../src/mock/r05Overview.js'
test('R05 overview separates current actions from the shared execution snapshot',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.unlockedRecommendations.fault=true;store.createTodo('fault')
  assert.deepEqual(overviewActions(store).map(r=>r.id),['fault','drift','bearing-health','cyl4-watch'])
  assert.equal(new Set(overviewActions(store).map(r=>r.id)).size,4)
  assert.equal(healthReviewReceipt.conclusion,healthReview.conclusion)
  assert.equal(healthReviewReceipt.runId,healthReview.runId)
  assert.match(healthReview.sections[0].paragraphs[0],/可能减弱/)
  const snapshot=JSON.stringify(healthReviewReceipt)
  store.submitAttentionFeedback('drift',{reading:432,conditions:'08:00，稳定负荷',phenomenon:'未听到明显异响',confirmed:true})
  assert.match(overviewActions(store).find(r=>r.id==='drift').text,/后续分析尚未更新/)
  assert.equal(overviewActions(store)[1].id,'bearing-health')
  store.createTodo('drift')
  assert.equal(overviewActions(store).find(r=>r.id==='drift').type,'关联事件')
  assert.equal(JSON.stringify(healthReviewReceipt),snapshot)
  assert.match(deviceHealthReply(store,'是不是滤器堵了？'),/尚不能定位/)
  assert.match(deviceHealthReply(store,'都正常了吗？'),/不能认定/)
  assert.match(overviewActions(store,{decision:'execute',status:'已采纳 · 待执行'}).find(r=>r.id==='bearing-health').text,/已采纳/)
  assert.doesNotMatch(overviewActions(store,{decision:'execute',status:'已采纳 · 待执行'}).find(r=>r.id==='bearing-health').text,/需要决定/)
  store.progress.fault=store.observationIndex('fault')
  assert.equal(overviewActions(store).find(r=>r.id==='fault').tag,'处理后观察')
 }finally{await server.close()}
})
