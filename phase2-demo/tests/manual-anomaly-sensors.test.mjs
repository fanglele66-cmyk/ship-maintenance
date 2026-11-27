import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {DatabaseSync} from 'node:sqlite'
import {readEventEvidence} from '../server/event-evidence.mjs'
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
  assert.ok(reportDevices.some(device=>device.id==='aux-system'))
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
 const form={deviceId:'main-engine-1',selectionMode:'selected',systems:['控制系统'],sensorIds:['main-control-air-pressure'],start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'控制空气进口压力异常，待核对现场读数。'}
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
 for(const systems of [[],['控制系统']])for(const sensorIds of [[],['main-control-air-pressure']])assert.throws(()=>validateAnomalyReport({...form,systems,sensorIds},'engineer'),/明确选择/)
 const legacySelection=validateAnomalyReport({...form,selectionMode:undefined,sensorIds:['main-control-air-pressure']},'engineer')
 assert.deepEqual(legacySelection.sensorIds,['main-control-air-pressure'])
 const saved={...legacySelection,selectionMode:'system'}
 assert.deepEqual(validateAnomalyReport(saved,'engineer').sensorIds,saved.sensorIds)
})

test('historical pressure evidence converts every raw MPa statistic and trend sample to the displayed bar unit',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ship-evidence-pressure-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 const directory=join(root,'.local-data')
 await mkdir(directory)
 await mkdir(join(root,'data'))
 await writeFile(join(root,'data','sensor-point-mapping.json'),JSON.stringify({pointList:[]}))
 await writeFile(join(directory,'manifest.json'),JSON.stringify({database:'ship.db'}))
 const db=new DatabaseSync(join(directory,'ship.db'))
 try{
  db.exec('CREATE TABLE sensor_readings(timestamp TEXT,source_time TEXT,source_gap_seconds INTEGER,data TEXT);CREATE TABLE ais_track(postime TEXT,sog REAL,lat REAL,lon REAL)')
  const put=db.prepare('INSERT INTO sensor_readings VALUES(?,?,12,?)')
  for(const [timestamp,raw] of [['2026-05-23 21:28:00',0.57],['2026-05-23 21:28:12',0.64]])
   put.run(timestamp,timestamp,JSON.stringify([101,null,null,null,null,raw]))
 }finally{db.close()}
 const window={deviceId:'main-engine-1',sensorIds:['main-control-air-pressure'],start:'2026-05-23T21:27:59+08:00',end:'2026-05-23T21:28:14+08:00'}
 const [row]=readEventEvidence(root,window,directory)
 assert.equal(row.unit,'bar')
 assert.deepEqual([row.sampleCount,row.firstValue,row.min,row.max,row.value],[2,5.7,5.7,6.4,6.4])
 assert.ok(Math.abs(row.mean-6.05)<1e-10)
 assert.deepEqual(row.trendData.map(p=>p.value),[5.7,6.4])
 const [aux]=readEventEvidence(root,{...window,deviceId:'aux-system',sensorIds:['aux-system::DC0006']},directory)
 assert.equal(aux.sourceKind,'unavailable')
 assert.equal(aux.sampleCount,0)
})
