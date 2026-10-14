import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
test('one shared 30s timer, pause/resume, scenario baselines and auxiliary filtering',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const originalSet=global.setInterval,originalClear=global.clearInterval,originalNow=Date.now
 let callback,delay,cleared=0,now=Date.UTC(2026,9,14,4),store
 try{
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  global.setInterval=(fn,ms)=>{callback=fn;delay=ms;return 1};global.clearInterval=()=>{cleared++};Date.now=()=>now
  setActivePinia(createPinia());store=useSensorStore()
  assert.equal(delay,30000)
  const before=store.allSensors.map(s=>s.value)
  now+=30000;callback()
  assert.equal(store.sampledAt,now)
  assert.ok(store.allSensors.some((s,i)=>s.value!==before[i]),'sampling advances even when RPM or pressure holds its last displayed level')
  store.setDevice('aux-system');assert.equal(store.filteredSensors.length,18)
  store.setSimulationBaselines({'s-007':{value:79.1}})
  now+=30000;callback();assert.ok(store.allSensors.find(s=>s.id==='s-007').value<80)
  const latest=store.allSensors.find(s=>s.id==='s-012').value
  assert.equal(store.getSimulationTrend('s-012',1).at(-1).value,latest)
  store.configureSimulation({enabled:false});await nextTick()
  assert.ok(cleared>0);assert.equal(store.allSensors.find(s=>s.id==='s-012').value,latest)
  store.configureSimulation({enabled:true,intervalSeconds:30});await nextTick();assert.equal(delay,30000)
 }finally{store?.$dispose();global.setInterval=originalSet;global.clearInterval=originalClear;Date.now=originalNow;await server.close()}
})
