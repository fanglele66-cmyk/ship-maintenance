import test from 'node:test'
import assert from 'node:assert/strict'
import {mockSensors} from '../src/mock/sensors.js'
import {simulationDefaults,buildSimulationSensors,simulationSample,simulationValue,simulationTrend} from '../src/mock/sensorSimulation.js'
import {cruiseMotion} from '../src/mock/cruiseMotion.js'
const sensors=buildSimulationSensors(mockSensors),at=Date.UTC(2026,9,14,3)
test('navigation speed stays near 9.8kn and changes more slowly than engine measurements',()=>{
 const speed=sensors.find(s=>s.id==='ship-speed')
 const values=Array.from({length:121},(_,n)=>simulationValue(speed,at+n*30000))
 assert.ok(values.every(v=>v>=9.7&&v<=9.9))
 assert.ok(values.slice(1).every((v,n)=>Math.abs(v-values[n])<=0.101))
 assert.equal(sensors.find(s=>s.id==='main-load').value,70)
})
test('slow-speed engine and three auxiliary groups have plausible configured modes',()=>{
 const rpm=sensors.find(s=>s.id==='s-012')
 for(let n=0;n<120;n++)assert.ok(simulationValue(rpm,at+n*30000)>=93.5&&simulationValue(rpm,at+n*30000)<=96.5)
 assert.equal(sensors.filter(s=>s.deviceId.startsWith('aux-engine-')).length,18)
 assert.equal(simulationValue(sensors.find(s=>s.id==='aux-3-rpm'),at),0)
 assert.equal(simulationValue(sensors.find(s=>s.id==='aux-3-load'),at),0)
 assert.equal(mockSensors.find(s=>s.id==='s-012').value,450,'existing scenario fixtures are not mutated')
})
test('30-second samples vary smoothly, remain bounded and respect precision',()=>{
 assert.equal(simulationDefaults.intervalSeconds,30)
 const point=sensors.find(s=>s.id==='s-002')
 const values=Array.from({length:121},(_,n)=>simulationValue(point,at+n*30000))
 assert.ok(values.slice(1).some((v,n)=>v===values[n]),'real pressure plateau is retained, not forced to move every tick')
 assert.ok(values.every(v=>v>=0.70&&v<=0.74))
 assert.ok(values.slice(1).every((v,n)=>Math.abs(v-values[n])<=0.02))
 assert.equal(simulationValue({...point,unit:'',value:0},at),0,'digital bits do not become fractions')
 assert.equal(simulationValue(point,at,{enabled:false}),point.value)
})
test('mapped exhaust reproduces chronological source deviations while pressure retains quantized plateaus',()=>{
 const exhaust=sensors.find(s=>s.id==='s-005'),column=cruiseMotion.channels.indexOf('DC0010')
 const values=cruiseMotion.frames.map((frame,i)=>{
  const value=simulationValue(exhaust,i*30000)
  assert.equal(value,Number((exhaust.value+frame[column]*cruiseMotion.sourceP95Deviation[column]).toFixed(1)))
  return value
 })
 assert.ok(new Set(values).size>20)
 const pressure=sensors.find(s=>s.id==='s-002'),p=cruiseMotion.frames.map((_,i)=>simulationValue(pressure,i*30000))
 assert.ok(new Set(p).size>=2)
 assert.ok(p.slice(1).filter((v,i)=>v===p[i]).length>p.length*.8)
})
test('existing cooling alarm remains and lower-limit flow uses correct alarm direction',()=>{
 assert.equal(simulationSample(sensors.find(s=>s.id==='s-007'),at).status,'over')
 assert.equal(simulationSample(sensors.find(s=>s.id==='s-017'),at).status,'over')
 assert.equal(simulationSample(sensors.find(s=>s.id==='s-016'),at).status,'normal')
})
test('trend samples are reproducible and endpoint matches the current value',()=>{
 const point=sensors.find(s=>s.id==='s-012')
 const a=simulationTrend(point,at-3600000,at)
 const b=simulationTrend(point,at-3600000,at+30000)
 assert.equal(a.at(-1).value,simulationValue(point,at))
 assert.equal(a[3].value,b.find(p=>p.timestamp===a[3].timestamp).value)
 assert.ok(simulationTrend(point,at-168*3600000,at).length<=902)
})
