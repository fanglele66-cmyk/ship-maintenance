import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('maintenance dossier keeps plan and early execution linked without changing state', async () => {
  const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {usePhase2DemoStore} = await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    const {maintenanceDossier} = await server.ssrLoadModule('/src/mock/maintenanceDossier.js')
    setActivePinia(createPinia())
    const store = usePhase2DemoStore();store.createTodo('fault')
    const initial = maintenanceDossier(store)
    assert.equal(initial.report.sections.length,2)
    assert.deepEqual(initial.actions,[])
    assert.deepEqual(maintenanceDossier(store,true).actions.map(a=>a.id),['early'])
    assert.equal(store.todoCreated.maintenance,false,'reading a dossier must not create a task')
    store.createTodo('drift')
    assert.deepEqual(maintenanceDossier(store).actions.map(a=>a.id),['todo'])
    store.executionRecords.drift=[{values:{completion:'completed',measures:'清洁与复校'}}]
    const observed=maintenanceDossier(store)
    assert.match(observed.report.conclusion,/清洁与复校/)
    assert(observed.report.sections.every(s=>s.paragraphs.every(p=>typeof p==='string' && p.length)))
    const before=JSON.stringify(observed)
    observed.report.sections[0].paragraphs[0]='external change'
    assert.equal(JSON.stringify(maintenanceDossier(store)),before,'presentation data must not mutate shared content')
    store.resetDemo();store.createTodo('fault')
  } finally { await server.close() }
})
