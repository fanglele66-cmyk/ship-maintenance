import assert from 'node:assert/strict'
import {test} from 'node:test'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {existsSync} from 'node:fs'
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {DatabaseSync} from 'node:sqlite'
import {createDefaultShipConfig,loadDeviceTypeTemplate} from '../server/ship-config-api.mjs'
import {createEventRepository} from '../server/event-repository.mjs'
import {initialInformationTimes} from '../src/workflow/initialInformationTimes.js'
import {normalizeAnomalyAnalysis} from '../src/workflow/manualAnomaly.js'
import {prepareAlarm,publishAlarm} from '../.claude/skills/ship-oem-alarm-analysis/scripts/oem-event.mjs'

const app=fileURLToPath(new URL('../',import.meta.url))
const skill=join(app,'.claude/skills/ship-oem-alarm-analysis')
const trigger=JSON.parse(await readFile(join(skill,'template/trigger.example.json')))
const periodic=JSON.parse(await readFile(join(app,'.claude/skills/ship-anomaly-detection/template/ship2-analysis.example.json')))
const analysis={title:'主机伺服油泄漏信号激活',summary:'伺服油泄漏硬件触点已激活，请核实现场。',interpretation:'本次记录证明触点变化，尚无现场观察佐证实际泄漏。',unverified:'泄漏位置和报警回路状态待核实。',recommendation:'核对报警回路及现场可见情况。',steps:[{label:'核对伺服油报警',guide:'查看同刻报警记录和现场可见情况。',checks:['记录触点状态及核查时间'],recordHint:'说明观察位置、时间及结果。'}]}

async function setup(t){
  const directory=await mkdtemp(join(tmpdir(),'ship-oem-'))
  t.after(()=>rm(directory,{recursive:true,force:true}))
  await writeFile(join(directory,'manifest.json'),JSON.stringify({database:'fixture.db'}))
  const db=new DatabaseSync(join(directory,'fixture.db'))
  db.exec('CREATE TABLE sensor_readings(timestamp TEXT,source_time TEXT,source_gap_seconds INTEGER,data TEXT); CREATE TABLE ais_track(postime TEXT,sog REAL,lat REAL,lon REAL)')
  for(const [time,value] of [['16:29:00',0],['16:30:00',1]]){
    const points=Array(59).fill(null);points[42]=value
    db.prepare('INSERT INTO sensor_readings(timestamp,data) VALUES(?,?)').run('2026-04-30 '+time,JSON.stringify(points))
  }
  db.close()
  return directory
}

test('OEM preview, concurrent duplicate delivery, page projection and subsequent human edits',async t=>{
  const directory=await setup(t)
  const prepared=await prepareAlarm(trigger,directory)
  assert.equal(prepared.report.evidence[0].sampleCount,2)
  assert.equal(existsSync(join(directory,'workflow.sqlite')),false)
  const review={outcome:'event',reviewId:prepared.reviewId,analysis}
  await writeFile(join(directory,'review.json'),JSON.stringify(review))
  const command=()=>promisify(execFile)(process.execPath,[join(skill,'scripts/oem-event.mjs'),'--data-dir',directory,'--trigger',join(skill,'template/trigger.example.json'),'--review',join(directory,'review.json'),'--publish'])
  const receipts=(await Promise.all([command(),command()])).map(r=>JSON.parse(r.stdout))
  assert.equal(receipts[0].eventId,receipts[1].eventId)
  assert.equal(receipts.filter(r=>r.replayed).length,1)
  const repository=await createEventRepository(directory)
  try{
    const [event]=repository.list()
    assert.equal(repository.list().length,1)
    assert.equal(event.type,'报警事件');assert.equal(event.status,'待决策')
    assert.equal(event.brief.discovery.kind,'ship-alarm')
    assert.equal(event.manualReport,undefined);assert.equal(event.detectionReport.submitter,undefined)
    assert.equal(event.detectionReport.analysis.steps[0].label,analysis.steps[0].label)
    assert.equal(event.detectionReport.evidence[0].trendData.at(-1).value,1)
    assert.ok(initialInformationTimes(event).generatedAt)
    const file=JSON.parse(await readFile(join(directory,'events',event.id,'event.json')))
    assert.equal(file.detectionReport.alarm.pointDataId,trigger.pointDataId)
    event.decisions.push({reason:'轮机长已安排现场复核'})
    const edited=await repository.save(event,{expected:event.serverRevision})
    assert.equal((await publishAlarm(prepared,review,directory)).replayed,true)
    assert.deepEqual(repository.get(event.id).decisions,edited.decisions)
    const collision=await prepareAlarm({...trigger,trigger_time:'2026-04-30T16:31:00+08:00'},directory)
    await assert.rejects(publishAlarm(collision,review,directory),/流水号/)
  }finally{await repository.close()}
})

test('disabled or reset alarms retain receipts, invalid evidence and mismatched model replies cannot create events',async t=>{
  const directory=await setup(t)
  assert.equal(normalizeAnomalyAnalysis(periodic).steps.length,1)
  const prepared=await prepareAlarm(trigger,directory)
  await assert.rejects(publishAlarm(prepared,{reviewId:'wrong',outcome:'event',analysis},directory),/匹配/)
  await assert.rejects(prepareAlarm({...trigger,pointDataId:'foreign-point'},directory),/唯一匹配/)
  const config=createDefaultShipConfig(loadDeviceTypeTemplate(app));config.devices[0].alarms.oem.enabled=false
  const cfg=join(directory,'ship-device-config.json')
  await writeFile(cfg,JSON.stringify(config))
  assert.equal((await publishAlarm(await prepareAlarm(trigger,directory),null,directory)).outcome,'record-only')
  config.devices[0].alarms.oem.enabled=true
  await writeFile(cfg,JSON.stringify(config))
  assert.equal((await publishAlarm(await prepareAlarm(trigger,directory),null,directory)).replayed,true)
  const reset=await prepareAlarm({...trigger,alarm_state_transition:{previous_state:1,current_state:0}},directory)
  assert.equal((await publishAlarm(reset,null,directory)).outcome,'record-only')
  const repository=await createEventRepository(directory)
  try{assert.equal(repository.list().length,0);assert.equal(repository.db.prepare('SELECT count(*) AS n FROM oem_alarm_receipts').get().n,2)}
  finally{await repository.close()}
})

test('an interrupted file export cannot commit an event or receipt, and the original delivery can resume',async t=>{
  const directory=await setup(t),prepared=await prepareAlarm(trigger,directory)
  const review={reviewId:prepared.reviewId,outcome:'event',analysis}
  const obstruction=join(directory,'events',prepared.key,'tasks.json')
  await mkdir(obstruction,{recursive:true})
  await assert.rejects(publishAlarm(prepared,review,directory))
  const db=new DatabaseSync(join(directory,'workflow.sqlite'),{readOnly:true})
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM events').get().n,0)
    assert.equal(db.prepare('SELECT count(*) AS n FROM oem_alarm_receipts').get().n,0)
  }finally{db.close()}
  await rm(obstruction,{recursive:true})
  await publishAlarm(prepared,review,directory)
  const laterSensorDb=new DatabaseSync(join(directory,'fixture.db'))
  try{laterSensorDb.prepare('UPDATE sensor_readings SET data=?').run(JSON.stringify(Array(59).fill(0)))}
  finally{laterSensorDb.close()}
  const after=await prepareAlarm(trigger,directory)
  assert.notEqual(after.reviewId,prepared.reviewId)
  assert.equal((await publishAlarm(after,null,directory)).replayed,true)
  const stored=JSON.parse(await readFile(join(directory,'events',prepared.key,'event.json')))
  assert.equal(stored.detectionReport.evidence[0].max,1)
})
