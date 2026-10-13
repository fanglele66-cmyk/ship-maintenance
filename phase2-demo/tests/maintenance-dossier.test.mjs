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
    assert.equal(initial.report.sections.length,5)
    assert.deepEqual(initial.actions,[])
    assert.deepEqual(maintenanceDossier(store,true).actions.map(a=>a.id),['early'])
    assert.equal(store.todoCreated.maintenance,false,'reading a dossier must not create a task')
    store.createTodo('maintenance')
    assert.deepEqual(maintenanceDossier(store).actions.map(a=>a.id),['todo'])
    store.progress.maintenance=2
    assert.match(maintenanceDossier(store).report.sections[2].paragraphs.at(-1),/轻微偏磨/)
    store.progress.maintenance=store.observationIndex('maintenance')
    store.observationRecords.maintenance.push({label:'首测',status:'normal',day:0,values:[2.2,64]})
    const observed=maintenanceDossier(store)
    assert.deepEqual(observed.actions.map(a=>a.id),['observation','todo'])
    assert.match(observed.report.sections[4].paragraphs[0],/2.2 mm\/s/)
    assert.match(maintenanceDossier(store,true).report.sections[1].paragraphs[1],/核对是否覆盖原周期项目/)
    assert(observed.report.sections.every(s=>s.paragraphs.every(p=>typeof p==='string' && p.length)))
    const before=JSON.stringify(observed)
    observed.report.sections[0].paragraphs[0]='external change'
    assert.equal(JSON.stringify(maintenanceDossier(store)),before,'presentation data must not mutate shared content')
    store.resetDemo();store.createTodo('fault')
  } finally { await server.close() }
})
