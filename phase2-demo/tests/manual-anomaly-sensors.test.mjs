import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {reportDevices,reportSensors,reportSensorsForSystems,validateAnomalyReport,reportEvidence} from '../src/workflow/manualAnomaly.js'

const fields=({id,nameCn,nameEn,deviceId,subsystem,unit})=>({id,nameCn,nameEn,deviceId,subsystem,unit})

test('report sensor options match the situation device/system store, including expanded engine points',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 try{
  setActivePinia(pinia)
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const store=useSensorStore();store.configureSimulation({enabled:false})
  assert.ok(reportDevices.some(device=>device.id==='aux-engine-1'))
  for(const device of reportDevices){
   store.setDevice(device.id)
   const actual=store.allSensors.filter(s=>s.deviceId===device.id)
   assert.deepEqual(reportSensors(device.id).map(fields),actual.map(fields),device.id)
   for(const system of [...new Set(actual.map(s=>s.subsystem))]){
    assert.ok(store.currentSubsystemTags.includes(system),device.id+' / '+system)
    store.setSubsystem(system)
    assert.deepEqual(reportSensorsForSystems(device.id,[system]).map(s=>s.id).sort(),store.filteredSensors.map(s=>s.id).sort())
   }
  }
  const main=reportSensors('main-engine-1')
  for(const id of ['main-cyl-1-coolant','main-cyl-4-exhaust','main-cyl-6-piston','main-control-air-pressure','main-fuel-rail-pressure'])assert.ok(main.some(s=>s.id===id),id)
 }finally{disposePinia(pinia);await server.close()}
})

test('only explicitly chosen points within the device and selected systems enter report evidence',()=>{
 const form={deviceId:'main-engine-1',selectionMode:'selected',systems:['控制空气系统'],sensorIds:['main-control-air-pressure'],start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'控制空气进口压力异常，待核对现场读数。'}
 const report=validateAnomalyReport(form,'engineer')
 assert.deepEqual(report.sensorIds,['main-control-air-pressure'])
 assert.equal(report.sensors.length,1)
 assert.equal(report.sensors[0].name,'控制空气压力')
 assert.equal(reportEvidence(report,[]).length,1)
 assert.equal(reportEvidence(report,[])[0].trendData.length,0,'catalog metadata is not sampled evidence')
 for(const sensorIds of [[],['main-servo-rail-pressure'],['aux-1-oil-press'],['invented']])assert.throws(()=>validateAnomalyReport({...form,sensorIds},'engineer'),/传感器/)
 assert.throws(()=>validateAnomalyReport({...form,systems:[]},'engineer'),/系统/)
 assert.throws(()=>validateAnomalyReport({...form,systems:['不存在的系统']},'engineer'),/系统/)
})


test('a raw system-mode request cannot bypass explicit sensor selection',()=>{
 const form={deviceId:'main-engine-1',selectionMode:'system',start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'主机压力异常，需核对选中的测点。'}
 for(const systems of [[],['控制空气系统']])for(const sensorIds of [[],['main-control-air-pressure']])assert.throws(()=>validateAnomalyReport({...form,systems,sensorIds},'engineer'),/明确选择/)
 const legacySelection=validateAnomalyReport({...form,selectionMode:undefined,sensorIds:['main-control-air-pressure']},'engineer')
 assert.deepEqual(legacySelection.sensorIds,['main-control-air-pressure'])
 const saved={...legacySelection,selectionMode:'system'}
 assert.deepEqual(validateAnomalyReport(saved,'engineer').sensorIds,saved.sensorIds)
})
