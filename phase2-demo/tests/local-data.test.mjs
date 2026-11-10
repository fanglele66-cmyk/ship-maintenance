import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {openLocalData,coverage,chronology,HOUR,sqlTime,toTime} from '../server/local-data.mjs'
import {createHealthScheduler} from '../server/health-scheduler.mjs'

test('current-time queries cannot see future data; requested coverage includes missing hours',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ship-data-test-'))
 try{
  await mkdir(join(root,'data'));await mkdir(join(root,'.local-data'))
  await writeFile(join(root,'data/sensor-point-mapping.json'),JSON.stringify({pointList:[{pointCode:'DC0001'}]}))
  await writeFile(join(root,'.local-data/manifest.json'),JSON.stringify({database:'ship.db',mode:'historical-copy-replay',tables:{sensor_readings:{end:'2026-11-11 12:00:00'}}}))
  const db=new DatabaseSync(join(root,'.local-data/ship.db'))
  db.exec('CREATE TABLE sensor_readings(timestamp TEXT,source_time TEXT,source_gap_seconds INTEGER,data TEXT);CREATE TABLE ais_track(postime TEXT,sog REAL,lat REAL,lon REAL)')
  const now=toTime('2026-11-10 12:00:00')
  for(const [t,v] of [[now-12000,40],[now+12000,99]])db.prepare('INSERT INTO sensor_readings VALUES (?, ?,12,?)').run(sqlTime(t),'2026-07-01 12:00:00',JSON.stringify([v]))
  db.prepare('INSERT INTO ais_track VALUES (?,5,0,0)').run(sqlTime(now-60000));db.close()
  const data=openLocalData(root)
  const s=data.snapshot(now)
  assert.equal(s.points[0].value,40);assert.equal(s.speed,5);assert.equal(s.load,null)
  assert.equal(s.trends.DC0001.length,1);assert(s.trends.DC0001.every(p=>p.timestamp<=now))
  assert.equal(s.quality.status,'partial');assert.equal(s.quality.maximumGapSeconds,86388)
  assert.equal(data.snapshot(now+HOUR).points[0].value,null)
  data.close()
 }finally{await rm(root,{recursive:true,force:true})}
})

test('operating chronology derives from measurements and never invents alarms, loads or anchoring',()=>{
 const now=toTime('2026-11-10 12:00:00'),start=now-HOUR
 const rows=[{at:start,values:[0]},{at:now-600000,values:[100]}]
 const c=chronology(rows,[],start,now)
 assert.deepEqual(c.periods.map(p=>p.status),['主机停转','主机运行'])
 assert(c.periods.every(p=>p.averageSpeed===null&&!p.incidents))
 assert.equal(coverage([],start,now).status,'insufficient')
})

const facts={result:{devices:{main:{analysis_conclusion:'实测统计结论',recommendations:['核对测点'],context:'## 结论\n实测统计',health_status:'normal'}},analysis_window:{}},coverage:{status:'sufficient',start:'2026-11-10 06:00:00',end:'2026-11-10 12:00:00'},resultPath:'result.json'}
test('hourly jobs persist, deduplicate across processes, recover and retain last good report on failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-job-test-'))
 let now=toTime('2026-11-10 12:00:00'),calls=0,fail=false
 await writeFile(join(dir,'manifest.json'),'{}')
 const options={directory:dir,clock:()=>now,analyze:async()=>{calls++;if(fail)throw Error('test failure');return facts},enhance:async()=>null}
 const a=await createHealthScheduler(dir,options),b=await createHealthScheduler(dir,options)
 try{
  await Promise.all([a.tick(),b.tick()]);assert.equal(calls,1)
  await a.tick();assert.equal(calls,1)
  assert.equal((await a.status()).latest.conclusion,'实测统计结论')
  now+=HOUR;fail=true;await b.tick()
  assert.equal((await b.status()).job.status,'failed')
  assert.equal((await b.status()).latest.conclusion,'实测统计结论')
  await a.tick();assert.equal(calls,2)
  now+=5*60000;fail=false;await a.tick();assert.equal(calls,3)
  assert.equal((await a.status()).job.status,'complete')
 }finally{await a.close();await b.close()}
 const c=await createHealthScheduler(dir,options)
 try{await c.tick();assert.equal(calls,3)}finally{await c.close();await rm(dir,{recursive:true,force:true})}
})

test('model failure publishes computed Skill report explicitly instead of a demo result',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-model-test-'))
 await writeFile(join(dir,'manifest.json'),'{}')
 const scheduler=await createHealthScheduler(dir,{directory:dir,analyze:async()=>facts,enhance:async()=>{throw Error('offline')}})
 try{await scheduler.tick();const s=await scheduler.status();assert.equal(s.latest.modelStatus,'failed');assert.equal(s.latest.detail,facts.result.devices.main.context)}
 finally{await scheduler.close();await rm(dir,{recursive:true,force:true})}
})
