import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const data=JSON.parse(readFileSync(new URL('../src/mock/realObservationHistory.json',import.meta.url),'utf8'))
const cases=JSON.parse(readFileSync(new URL('../src/mock/realCases.json',import.meta.url),'utf8')).cases
const seconds=time=>Date.parse(time.replace(' ','T')+'Z')/1000
const point=(windowId,rowId)=>{
 const window=data.windows[windowId],index=window.rowIds.indexOf(rowId)
 assert.notEqual(index,-1,`Original row ${rowId} must be retained`)
 return {time:window.times[index],...Object.fromEntries(Object.entries(window.columns).map(([id,values])=>[id,values[index]]))}
}

test('original timestamps, row identities and channel arrays remain aligned within fixed windows',()=>{
 assert.equal(data.schemaVersion,1)
 assert.equal(data.source.shipCode,'CHBY');assert.equal(data.source.deviceCode,'DEVICE1')
 assert.deepEqual(Object.keys(data.windows),['0430','0523','0804','0807'])
 for(const window of Object.values(data.windows)){
  assert.equal(window.times.length,window.rowIds.length)
  assert.equal(new Set(window.rowIds).size,window.rowIds.length)
  assert.equal(seconds(window.requestedEnd)-seconds(window.requestedStart),86400)
  window.times.forEach((time,index)=>{
   assert.match(time,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
   assert.ok(time>=window.requestedStart&&time<=window.requestedEnd)
   if(index)assert.ok(window.times[index-1]<time)
  })
  for(const [id,values] of Object.entries(window.columns)){
   assert.equal(values.length,window.times.length)
   assert.ok(values.every(value=>value===null||Number.isFinite(value)))
   assert.equal(window.coverage.channels[id].numericCount,values.filter(value=>value!==null).length)
   assert.equal(window.coverage.channels[id].missingCount,values.filter(value=>value===null).length)
  }
 }
})

test('current observation series use exact source channels and order including C2 piston oil',()=>{
 const expected={
  'real-alarm-0430':['DC0009','DC0008','DC0032','DC0047','DC0001'],
  'real-warning-0523':['DC0006','DC0007','DC0001','DC0058'],
  'real-tracking-exhaust-baseline':['DC0008','DC0011','DC0001','DC0058'],
  'real-maintenance-c4-baseline':['DC0011','DC0001','DC0058'],
 }
 for(const [id,channels] of Object.entries(expected)){
  assert.deepEqual(data.cases[id].channelIds,channels)
  const original=cases.find(item=>item.id===id)
  original.series.forEach((series,index)=>{
   assert.equal(data.channels[channels[index]].name,series.name)
   assert.equal(data.channels[channels[index]].unit,series.unit)
  })
 }
 assert.equal(data.channels.DC0032.sourceIndex,31)
 assert.equal(data.channels.DC0047.sourceIndex,46)
 assert.equal(data.channels.DC0058.unit,'%')
 assert.ok(!data.channels.DC0039,'fuel pump inlet pressure is not C2 piston cooling oil')
})

test('1H/6H/24H metadata reflects actual inclusive samples, endpoints and retained gaps',()=>{
 const expected={'0430':[288,1725,6976],'0523':[194,1106,5825],'0804':[233,1179,5806],'0807':[283,1736,6888]}
 const expectedMax={'0430':588,'0523':742,'0804':877,'0807':275}
 for(const [id,window] of Object.entries(data.windows)){
  assert.deepEqual(Object.values(window.coverage.ranges).map(range=>range.sampleCount),expected[id])
  for(const range of Object.values(window.coverage.ranges)){
   const times=window.times.filter(time=>time>=range.requestedStart&&time<=range.requestedEnd)
   assert.equal(times.length,range.sampleCount)
   assert.equal(times[0],range.firstSampleAt);assert.equal(times.at(-1),range.lastSampleAt)
   const intervals=times.slice(1).map((time,index)=>seconds(time)-seconds(times[index]))
   assert.equal(Math.max(...intervals),range.maxGapSeconds)
  }
  assert.equal(window.coverage.maxGapSeconds,expectedMax[id])
  for(const gap of window.coverage.gaps){
   assert.ok(gap.seconds>60)
   const index=window.times.indexOf(gap.after)
   assert.equal(window.times[index+1],gap.before,'gap contains no inserted samples')
   assert.equal(seconds(gap.before)-seconds(gap.after),gap.seconds)
  }
 }
})

test('alarm, consecutive low pressure and baseline source samples survive without decimation',()=>{
 assert.deepEqual(point('0430',127128),{
  time:'2026-04-30 23:32:54',DC0009:80.4,DC0008:347.5,DC0032:46.5,DC0047:76.4,DC0001:76.1,
 })
 for(const rowId of [825681,825682,825683,825684,825685]){
  const p=point('0523',rowId)
  assert.equal(p.DC0006,0.57);assert.equal(p.DC0007,0.54)
 }
 const tracking=data.windows['0804']
 const samples=tracking.times.map((time,index)=>({time,index})).filter(({time})=>time>='2026-08-04 17:00:00')
 assert.equal(samples.length,1179)
 const mean=samples.reduce((sum,{index})=>sum+tracking.columns.DC0008[index],0)/samples.length
 assert.ok(Math.abs(mean-380.33)<0.01)
 assert.equal(data.channels.DC0011.sourceIndex,10)

})

test('baseline task and parent share raw pre-assessment readings, never repair evidence',()=>{
 const maintenance=data.cases['real-maintenance-c4-baseline'],health=data.cases['real-health-c4-baseline']
 assert.deepEqual(health,maintenance)
 assert.equal(maintenance.windowId,'0807')
 assert.equal(maintenance.sourceCaseId,'real-health-c4-baseline')
 assert.equal(maintenance.dataRole,'baseline-source-history')
 assert.equal(maintenance.isPostRepairEvidence,false)
 assert.equal(maintenance.evidenceCutoff,'2026-08-07 14:20:00')
 assert.equal(data.windows[maintenance.windowId].times.at(-1),'2026-08-07 14:19:59')
 assert.notEqual(maintenance.windowId,data.cases['real-warning-0523'].windowId)
})
