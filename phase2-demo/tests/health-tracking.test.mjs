import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {buildTrackingEvents,importTrackingEvents} from '../server/health-tracking.mjs'
import {createEventRepository,canSeeEvent,validateEventUpdate} from '../server/event-repository.mjs'
import {ensureTaskPlan,decide,people,currentTask} from '../src/workflow/eventLifecycle.js'
import {lifecycleDecisionOptions} from '../src/workflow/lifecycleDecisions.js'
const copy=v=>structuredClone(v)
const bundle=(end='2026-05-16T00:00:00+08:00')=>{
 const point={timestamp:Date.parse(end),at:end,raw_value:410,baseline_median:345,baseline_scale_mad:20,baseline_n:51,residual_raw:65,z:3.25,ewma:3,cusum_7d_area:10,cusum_30d_area:20,health_score:60,rpm:100,zone:'cruise'}
 return {schemaVersion:'ship2.health-tracking.v1',schedulerEnabled:false,baselineSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),policy:{minWindows:30},health:{whole_engine:{health_score:90}},candidates:[{pointCode:'DC0008',name:'1缸排气温度',unit:'℃',zone:'cruise',direction:'上移',validWindows:60,spanDays:15,start:'2026-05-01T00:00:00+08:00',end,latest:point,series:[{...point,timestamp:Date.parse('2026-05-01T00:00:00+08:00')},{...point,timestamp:Date.parse(end)-3600000},point]}]}
}
// Use the catalogue's exact unit rather than a display synonym.
const catalog=JSON.parse(await readFile('data/sensor-point-mapping.json','utf8'))
function input(end){const value=bundle(end);value.candidates[0].unit=catalog.pointList.find(p=>p.pointCode==='DC0008').unit;return value}
async function fixture(t){const directory=await mkdtemp(join(tmpdir(),'tracking-contract-')),repository=await createEventRepository(directory);t.after(async()=>{await repository.close();await rm(directory,{recursive:true,force:true})});return {directory,repository}}
test('tracking produces captain-owned events and six artifacts, with usable investigation and maintenance decisions',async t=>{
 const {directory,repository}=await fixture(t),value=input(),receipt=await importTrackingEvents(repository,value,{directory}),event=repository.get(receipt.created[0])
 assert.equal(event.type,'异动跟踪');assert.equal(event.tracking,true);assert.equal(event.responsible,people.captain);assert.equal(event.manualReport,undefined);assert.equal(event.detectionReport.kind,'health-tracking')
 assert.equal(canSeeEvent(event,{workflowRole:'engineer'}),false)
 for(const file of ['event','analysis','evidence','tasks','reports','conversations'])assert(JSON.parse(await readFile(join(directory,'events',event.id,file+'.json'),'utf8')))
 assert.equal(event.conversations.captain.length,1);assert(event.brief.tasks.length>=2)
 assert.equal(event.conversations.captain[0].kind,'receipt');assert.match(event.conversations.captain[0].text,/固定健康基线/)
 assert.equal(event.detectionReport.healthTracking.latest.z,value.candidates[0].latest.z)
 ensureTaskPlan(event);const state={role:'captain',events:{[event.id]:event},notices:[]}
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const task=currentTask(event);assert(task);assert.equal(canSeeEvent(event,{workflowRole:'engineer'}),true)
 task.status='submitted';task.records=task.steps.map(s=>({step:s.id,result:'偏离仍存在',note:'已核对同工况记录，相对抬升成立。'}));event.phase='decision'
 assert(lifecycleDecisionOptions(event).some(a=>a.value==='maintenance'))
 const changed=copy(event);changed.trackingReport.candidate.latest.z=999;assert.throws(()=>validateEventUpdate(event,changed,{workflowRole:'captain'}),/原始证据/)
})
test('reimport is idempotent; newer evidence preserves tasks, notes and conversations',async t=>{
 const {directory,repository}=await fixture(t);const first=await importTrackingEvents(repository,input(),{directory});const id=first.created[0]
 const old=repository.get(id);old.tasks.push({id:'preserved',draft:{note:'已有备注'}});old.conversations.captain.push({id:'conversation',text:'已有会话'});await repository.save(old)
 assert.deepEqual((await importTrackingEvents(repository,input(),{directory})).unchanged,[id])
 assert.deepEqual((await importTrackingEvents(repository,input('2026-05-17T00:00:00+08:00'),{directory})).updated,[id])
 const next=repository.get(id);assert.equal(next.tasks[0].draft.note,'已有备注');assert.equal(next.conversations.captain.at(-1).text,'已有会话');assert.equal(next.number,old.number)
 next.phase='closed';next.closedAt='2026-05-18T00:00:00+08:00';await repository.save(next)
 assert.equal((await importTrackingEvents(repository,input('2026-05-17T00:00:00+08:00'),{directory})).suppressed.length,1)
})
test('administrator deletion suppresses reimport of old tracking evidence',async t=>{
 const {directory,repository}=await fixture(t),first=await importTrackingEvents(repository,input(),{directory}),db=new DatabaseSync(join(directory,'accounts.sqlite'))
 db.exec('CREATE TABLE deleted_events(id TEXT PRIMARY KEY)');db.prepare('INSERT INTO deleted_events VALUES(?)').run(first.created[0]);db.close()
 assert.equal((await importTrackingEvents(repository,input(),{directory})).suppressed.length,1);assert.equal(repository.list().length,1)
})
test('unknown sensors, future windows, mismatched units and invalid curves cannot publish',()=>{
 for(const alter of [b=>b.candidates[0].pointCode='unknown',b=>b.candidates[0].unit='MPa',b=>b.candidates[0].end='2099-01-01',b=>b.candidates[0].series[1].timestamp=1,b=>b.candidates[0].latest.health_score=null,b=>b.candidates.push(copy(b.candidates[0]))]){const b=input();alter(b);assert.throws(()=>buildTrackingEvents(b))}
 assert.deepEqual(buildTrackingEvents({...input(),candidates:[]}),[])
})
