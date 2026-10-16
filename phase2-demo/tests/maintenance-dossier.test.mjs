import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('maintenance dossier keeps plan and early execution linked without changing state', async () => {
  const server = await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try {
    const {usePhase2DemoStore} = await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    const {maintenanceDossier} = await server.ssrLoadModule('/src/mock/maintenanceDossier.js')
    setActivePinia(createPinia())
    const store = usePhase2DemoStore();store.createTodo('fault')
    const initial = maintenanceDossier(store)
    assert.ok(initial.report.sections.length>=3)
    assert.deepEqual(initial.actions,[])
    assert.deepEqual(maintenanceDossier(store,true).actions.map(a=>a.id),['early'])
    assert.equal(store.todoCreated.maintenance,false,'reading a dossier must not create a task')
    store.createTodo('maintenance')
    assert.deepEqual(maintenanceDossier(store).actions.map(a=>a.id),['todo'])
    store.progress.maintenance=2
    assert.doesNotMatch(JSON.stringify(maintenanceDossier(store).report),/现场已确认轴瓦轻微偏磨/,'stage position cannot fabricate a wear finding')
    assert.match(JSON.stringify(maintenanceDossier(store).report),/尚未提交|尚无已提交/)
    store.executionRecords.maintenance=[{values:{measures:'实际检查未见需换件问题，保留检查记录',acceptance:'检查结果与当前范围已复核',verification:'resolved'}}]
    store.progress.maintenance=store.observationIndex('maintenance')
    store.observationRecords.maintenance.push({label:'首测',status:'normal',day:0,values:[2.2,64]})
    const observed=maintenanceDossier(store)
    assert.deepEqual(observed.actions.map(a=>a.id),['observation','todo'])
    assert.match(JSON.stringify(observed.report),/实际检查未见需换件问题/)
    assert.match(JSON.stringify(maintenanceDossier(store,true).report),/未覆盖|未做项目/)
    assert(observed.report.sections.every(s=>s.paragraphs.every(p=>typeof p==='string' && p.length)))
    const before=JSON.stringify(observed)
    observed.report.sections[0].paragraphs[0]='external change'
    assert.equal(JSON.stringify(maintenanceDossier(store)),before,'presentation data must not mutate shared content')
    store.resetDemo();store.createTodo('fault')
  } finally { await server.close() }
})
