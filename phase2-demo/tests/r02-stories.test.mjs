import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {r02Reply,r02Reports,r02InitialMessage} from '../src/mock/r02Stories.js'

test('R02 replies differ by story and do not offer note registration on ordinary questions',()=>{
 const fixture={attentionFeedback:{},todoCreated:{drift:false}}
 assert.match(r02Reply(fixture,'cyl4-watch','为什么没有报警还要关注？').text,/反复变化/)
 assert.equal(r02Reply(fixture,'cyl4-watch','为什么没有报警还要关注？').supplement,false)
 assert.equal(r02Reply(fixture,'cyl4-watch','现场暂时没听到异常声音').supplement,true)
 assert.equal(r02Reply(fixture,'cyl2-ended','今天又听到异常声音').newSituation,true)
 assert.match(r02Reply(fixture,'stable','是不是滤器堵了？').text,/不能套用/)
 assert.equal(r02Reply(fixture,'stable','现场切换了泵组').supplement,false)
 assert.match(r02Reply(fixture,'vibration-trend','某个轴承磨损了吗？').text,/不能直接定位/)
 assert.equal(r02Reply(fixture,'vibration-trend','现场感觉松动了').supplement,false)
 assert.equal(r02InitialMessage(fixture,'cyl4-watch').actions,undefined)
 const snapshot=JSON.stringify(r02Reports)
 r02Reply(fixture,'drift','现场未见异响')
 assert.equal(JSON.stringify(r02Reports),snapshot)
})

test('R02 preserves three dossiers, qualitative evidence and explicit decision requirements',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try {
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {attentionDossier}=await server.ssrLoadModule('/src/mock/attentionDossier.js')
  const {deviceHistory}=await server.ssrLoadModule('/src/mock/phase2History.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault')
  assert.deepEqual(store.attention.filter(i=>i.tab==='attention').map(i=>i.id).sort(),['cyl2-ended','cyl4-watch','drift'])
  for(const id of ['cyl2-ended','cyl4-watch','drift']){
   const dossier=attentionDossier(store,id)
   assert.equal(dossier.charts[0].unit,'°C')
   assert.equal(dossier.charts[0].values.length,dossier.charts[0].labels.length)
   assert.match(dossier.background,/反复/)
  }
  assert.equal(attentionDossier(store,'stable'),null)
  assert.equal(attentionDossier(store,'vibration-trend'),null)
  store.nextMonitor('stable');assert.equal(store.monitorStep.stable,0)
  assert.equal(deviceHistory(store).some(record=>record.target==='stable'),false)
  store.sendR02Message('cyl4-watch','为什么没有报警还要关注？')
  assert.equal(store.logs['cyl4-watch'].at(-1).noteCandidate,undefined)
  store.sendR02Message('cyl4-watch','现场没有异常声音')
  assert.equal(store.logs['cyl4-watch'].at(-1).noteCandidate.registered,false)
  assert.equal(store.todoCreated.drift,false)
  assert.equal(store.confirmR02Check('drift'),false)
  const before=JSON.stringify(attentionDossier(store,'drift').records)
  assert.equal(store.submitAttentionFeedback('drift',{reading:432,conditions:'08:00，稳定工况（人员演示填写）',phenomenon:'未见明显异响',confirmed:true}),true)
  assert.equal(store.dossierReviews.drift,undefined,'receipt is not a new analysis')
  store.sendR02Message('drift','演示证据不足研判')
  assert.equal(store.confirmR02Check('drift'),false)
  store.sendR02Message('drift','演示进一步检查研判')
  assert.equal(store.attentionAction('drift').decisionRequired,true)
  assert.equal(store.submitAttentionFeedback('drift',{reading:432,conditions:'其他',phenomenon:'其他',confirmed:true}),false)
  assert.equal(store.deferR02Check('drift',''),false)
  assert.equal(store.deferR02Check('drift','暂不具备停机窗口'),true)
  assert.equal(store.attentionAction('drift').required,undefined)
  assert.equal(store.todoCreated.drift,false)
  store.sendR02Message('drift','演示进一步检查研判')
  assert.equal(store.confirmR02Check('drift'),true)
  assert.equal(store.confirmR02Check('drift'),false)
  assert.equal(store.visibleTodos.filter(item=>item.id==='drift').length,1)
  assert.equal(JSON.stringify(attentionDossier(store,'drift').records.slice(0,2)),before,'initial qualitative evidence remains in history after linking an event')
  store.sendR02Message('cyl2-ended','今天又出现异常声音')
  const request=store.logs['cyl2-ended'].at(-1)
  assert.equal(request.purpose,'r02-note')
  assert.equal(request.fields.length,3)
  store.registerDossierNote('cyl2-ended','发生时间：今天，工况与位置：2#缸附近，现象：新异响')
  assert.equal(attentionDossier(store,'cyl2-ended').action.phase,'已结束')
  assert.equal(attentionDossier(store,'cyl2-ended').records.filter(record=>record.type==='closure').length,1)
  store.resetDemo();store.createTodo('fault');assert.equal(Object.keys(store.dossierReviews).length,0)
 } finally {await server.close()}
})
