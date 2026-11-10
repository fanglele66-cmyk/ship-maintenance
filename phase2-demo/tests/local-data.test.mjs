import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises'
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

test('stages show measured speed or rpm, actual transitions and fuel commands instead of unavailable load',()=>{
 const start=toTime('2026-11-10 12:00:00'),frame=(offset,rpm,fuel)=>({at:start+offset*60000,values:Array.from({length:59},(_,i)=>i===0?rpm:i===57?fuel:0)})
 const rows=[frame(0,70,20),frame(10,90,40),frame(20,110,60),frame(31,0,0),frame(50,0,0)]
 const first=chronology(rows,[],start,start+HOUR).periods[0]
 assert.equal(first.primaryMetric.label,'平均转速');assert.equal(first.primaryMetric.value,90)
 assert.equal(first.averageSpeed,null);assert.equal(first.fuelCommandAverage,40)
 assert.match(first.operation,/70.0 → 110.0 rpm/);assert.match(first.loadTrend,/20.0～60.0 %/)
 assert.equal(first.loadTrendLabel,'燃油指令');assert(!/负荷|推断|未采集/.test(first.detail+first.operation+first.loadTrend))
 const ais=[{at:start,sog:8},{at:start+15*60000,sog:12},{at:start+16*60000,sog:102.3}]
 const stage=chronology(rows,ais,start,start+HOUR).periods[0]
 assert.equal(stage.primaryMetric.label,'平均航速');assert.equal(stage.primaryMetric.value,10)
 assert.match(stage.operation,/8.0 → 12.0 kn/)
 const reverse=chronology([frame(0,-90,25),frame(10,90,25)],[],start,start+30*60000).periods[0]
 assert.equal(reverse.state,'running');assert.equal(reverse.averageRpm,90)
 assert.equal(reverse.primaryMetric.label,'平均转速幅值');assert.match(reverse.operation,/-90.0 → 90.0/)
})

test('restart recovers an interrupted owner and removes only its incomplete archive',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-recovery-'));await writeFile(join(dir,'manifest.json'),'{}')
 let calls=0;const now=toTime('2026-11-10 12:00:00')
 const scheduler=await createHealthScheduler(dir,{directory:dir,clock:()=>now,analyze:async()=>{calls++;return facts},enhance:async()=>null})
 const old='run-1-1234abcd-0',archive=join(dir,'health-history',old)
 await mkdir(archive,{recursive:true});await writeFile(join(archive,'report.md'),'incomplete')
 const db=new DatabaseSync(join(dir,'jobs.sqlite'))
 db.prepare('INSERT INTO health_jobs VALUES(?,?,?,?,?,?,?)').run(old,'running',1,now+600000,now,null,2147483646)
 try{await scheduler.tick();assert.equal(calls,1);assert.equal(db.prepare('SELECT status FROM health_jobs WHERE id=?').get(old).status,'interrupted');assert.equal((await scheduler.status()).job.status,'complete');await assert.rejects(readFile(join(archive,'report.md')),e=>e.code==='ENOENT')}
 finally{db.close();await scheduler.close();await rm(dir,{recursive:true,force:true})}
})

const facts={result:{devices:{main:{analysis_conclusion:'实测统计结论',recommendations:['核对测点'],context:'## 结论\n实测统计',health_status:'normal'}},analysis_window:{}},coverage:{status:'sufficient',start:'2026-11-10 06:00:00',end:'2026-11-10 12:00:00'},resultPath:'result.json'}
test('each startup analyzes immediately and repeats hourly from its own start, with bounded retries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-job-test-'))
 let now=toTime('2026-11-10 12:35:00'),calls=0,fail=false
 await writeFile(join(dir,'manifest.json'),'{}')
 const options={directory:dir,clock:()=>now,analyze:async()=>{calls++;if(fail)throw Error('test failure');return facts},enhance:async()=>null}
 const a=await createHealthScheduler(dir,options)
 try{
  await a.tick();assert.equal(calls,1)
  assert.equal((await a.status()).nextRunAt,toTime('2026-11-10 13:35:00'))
  now=toTime('2026-11-10 13:00:00');await a.tick();assert.equal(calls,1,'wall-clock hour must not trigger')
  now=toTime('2026-11-10 13:35:00');fail=true;await a.tick();assert.equal(calls,2)
  assert.equal((await a.status()).job.status,'failed');assert.equal((await a.status()).latest.conclusion,'实测统计结论')
  now+=60000;await a.tick();assert.equal(calls,2)
  now+=4*60000;fail=false;await a.tick();assert.equal(calls,3)
  assert.equal((await a.status()).nextRunAt,toTime('2026-11-10 14:35:00'),'retry must not move the regular cadence')
 }finally{await a.close()}
 const b=await createHealthScheduler(dir,options)
 try{
  await b.tick();assert.equal(calls,4,'restart in the same hour must run again')
  assert.equal((await b.status()).nextRunAt,toTime('2026-11-10 14:40:00'))
  now+=55*60000;await b.tick();assert.equal(calls,4)
  now+=5*60000;await b.tick();assert.equal(calls,5)
 }finally{await b.close();await rm(dir,{recursive:true,force:true})}
})

test('parallel service instances cannot analyze the shared workspace concurrently',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-lease-test-'));await writeFile(join(dir,'manifest.json'),'{}')
 let release,entered,calls=0
 const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r)
 const options={directory:dir,analyze:async()=>{calls++;entered();await gate;return facts},enhance:async()=>null}
 const a=await createHealthScheduler(dir,options),b=await createHealthScheduler(dir,options)
 try{const running=a.tick();await ready;await b.tick();assert.equal(calls,1);release();await running;await b.tick();assert.equal(calls,2)}
 finally{release();await a.close();await b.close();await rm(dir,{recursive:true,force:true})}
})

test('model failure publishes computed Skill report explicitly instead of a demo result',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-model-test-'))
 await writeFile(join(dir,'manifest.json'),'{}')
 const scheduler=await createHealthScheduler(dir,{directory:dir,analyze:async()=>facts,enhance:async()=>{throw Error('offline')}})
 try{await scheduler.tick();const s=await scheduler.status();assert.equal(s.latest.modelStatus,'failed');assert.equal(s.latest.detail,facts.result.devices.main.context)}
 finally{await scheduler.close();await rm(dir,{recursive:true,force:true})}
})
