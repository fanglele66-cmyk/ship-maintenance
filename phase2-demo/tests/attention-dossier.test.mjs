import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('attention dossier reuses evidence, preserves history and handles all phases',async()=>{
  const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    const {attentionDossier}=await server.ssrLoadModule('/src/mock/attentionDossier.js')
    setActivePinia(createPinia())
    const store=usePhase2DemoStore()
    const initial=attentionDossier(store,'drift')
    assert.deepEqual(initial.charts[0].values,[428,432])
    const before=JSON.stringify(initial.records)
    store.submitAttentionFeedback('drift',{reading:432,conditions:'450rpm，稳定负荷，08:00',phenomenon:'未见明显异响',confirmed:true})
    const after=attentionDossier(store,'drift')
    assert.equal(JSON.stringify(after.records.slice(0,initial.records.length)),before)
    assert.equal(after.feedback.reading,432)
    assert.equal(after.action.phase,'系统跟踪中')
    assert.equal(store.todoCreated.drift,false)
    store.createTodo('drift')
    assert.equal(attentionDossier(store,'drift').records.some(record=>record.label==='现场核实 · 已提交'),true,'creating a linked event must not hide earlier feedback')
    assert.equal(attentionDossier(store,'cyl2-ended').action.phase,'已结束')
    assert.equal(attentionDossier(store,'stable').charts[0].rangeOnly,true)
    assert.deepEqual(attentionDossier(store,'stable').charts[0].values,[],'do not invent exact pressure samples')
    store.progress.fault=store.observationIndex('fault')
    store.observationRecords.fault.push({label:'首测',status:'normal',day:0,values:[79.1,86.5]},{label:'缺失记录',status:'incomplete',day:1})
    const observed=attentionDossier(store,'fault')
    assert.equal(observed.action.phase,'处理后观察')
    assert.deepEqual(observed.charts[0].values,[92.4,79.1,null],'missing samples stay missing')
    assert.equal(observed.records.at(-1).label,'缺失记录')
    assert.equal(attentionDossier(store,'missing'),null)
    store.resetDemo()
  } finally {await server.close()}
})
