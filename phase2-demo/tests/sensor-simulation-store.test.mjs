import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
test('one shared 30s timer, pause/resume, scenario baselines and auxiliary filtering',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
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

test('every engine topology measurement resolves through the shared store and trend API',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 let store
 try{
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {buildCylinderMatrix,sharedSystems,sharedSystemDetail}=await server.ssrLoadModule('/src/mock/deviceComparisonTopology.js')
  setActivePinia(createPinia());store=useSensorStore()
  store.configureSimulation({enabled:false});await nextTick()
  store.setDevice('main-engine-1')
  const cells=buildCylinderMatrix(store.allSensors).flatMap(row=>row.cells)
  assert.equal(cells.filter(cell=>cell.available).length,36)
  const related=sharedSystems.flatMap(system=>sharedSystemDetail(system.id,store.allSensors).readings)
  const ids=[...new Set([...cells.map(cell=>cell.sensor.id),...related.map(sensor=>sensor.id)])]
  for(const id of ids){
   store.selectSensor(id)
   assert.equal(store.selectedSensor.id,id)
   assert.ok(store.currentTrendData.length>1)
   assert.equal(store.currentTrendData.at(-1).value,store.selectedSensor.value)
   assert.equal(store.currentTrendData.at(-1).timestamp,store.sampledAt)
   assert.equal(store.getSimulationTrend(id,1).at(-1).value,store.selectedSensor.value)
  }
  for(const tag of ['活塞冷却','喷射控制','排气驱动','伺服油系统','控制空气系统']){
   assert.ok(store.currentSubsystemTags.includes(tag))
   store.setSubsystem(tag)
   assert.ok(store.filteredSensors.length>0)
   assert.ok(store.filteredSensors.every(sensor=>sensor.subsystem===tag))
  }
  store.setSimulationBaselines({'main-cyl-1-icu':{value:null}})
  assert.equal(buildCylinderMatrix(store.allSensors).find(row=>row.id==='icu').cells[0].available,false)
  assert.ok(store.getSimulationTrend('main-cyl-1-icu',1).every(sample=>sample.value===null))
 }finally{store?.$dispose();await server.close()}
})
