import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('R01 action completion, linked events and post-treatment requirements', async () => {
  const server = await createServer({ server:{middlewareMode:true,hmr:false,ws:false}, appType:'custom' })
  try {
    const {usePhase2DemoStore} = await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    setActivePinia(createPinia())
    const store = usePhase2DemoStore();store.createTodo('fault')
    assert.equal(store.attentionAction('drift').required,true)
    store.selectAttention('drift')
    store.sendAttention('现场读数432，记录一下')
    assert.equal(store.attentionAction('drift').required,true,'ordinary chat must not fulfill the requirement')
    const fields={reading:432,conditions:'稳定负荷，450 rpm，08:00',phenomenon:'未见明显异响',confirmed:true}
    assert.equal(store.submitAttentionFeedback('drift',{...fields,conditions:' '}),false)
    assert.equal(store.submitAttentionFeedback('drift',{...fields,confirmed:false}),false)
    assert.equal(store.submitAttentionFeedback('drift',fields),true)
    assert.equal(store.attentionAction('drift').phase,'系统跟踪中')
    assert.equal(store.todoCreated.drift,false,'feedback must not create an event')
    assert.equal(store.submitAttentionFeedback('drift',fields),false,'no duplicate completion')
    store.createTodo('drift')
    assert.equal(store.attentionAction('drift').linked,true)
    assert.equal(store.attentionAction('drift').required,undefined,'linked checks have no second form')
    store.progress.drift=store.observationIndex('drift')
    store.observationRecords.drift.push({status:'incomplete',day:1})
    assert.equal(store.attentionAction('drift').phase,'处理后观察')
    assert.equal(store.attentionAction('drift').linked,true,'same post-treatment item also requires human action')
    assert.equal(store.effectObservations.filter(item=>item.id==='drift').length,1)
    store.resetDemo();store.createTodo('fault')
    assert.deepEqual({...store.attentionFeedback},{})
    assert.equal(store.attentionAction('drift').required,true)
  } finally { await server.close() }
})
