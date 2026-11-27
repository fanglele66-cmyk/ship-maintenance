import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHealthScheduler,validateHealthLanguage} from '../server/health-scheduler.mjs'
import {createWorkflowService} from '../server/workflow-service.mjs'
import {normalizeTaskPlan} from '../src/workflow/taskPlanning.js'
import {normalizeStepAssistResult,stepFollowUpState} from '../src/workflow/stepAssistContract.js'
import {enforceStepFollowUpPolicy} from '../server/step-assist.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
async function example(skill,name){
 return JSON.parse(await readFile(join(root,'.claude','skills',skill,'template',name+'.example.json'),'utf8'))
}

test('event and task examples produce a dispatchable plan and a step-scoped adoptable note',async()=>{
 const plan=normalizeTaskPlan(await example('ship-event-assistant','plan'),'investigate')
 assert.deepEqual(plan.steps[0].options,['发现异常','未见异常','无法确认'])
 const reply=normalizeStepAssistResult(await example('ship-task-assistant','question'))
 const context={record:{note:'已核对接头外观。'},message:{text:'已核对接头外观。'},followUpState:stepFollowUpState(0)}
 const first=enforceStepFollowUpPolicy(reply,context)
 assert.equal(first.kind,'question')
 assert.equal(first.note,context.record.note)
 assert.deepEqual(first.choices,reply.choices)
 assert.ok(first.allowOther)
 const afterLimit=enforceStepFollowUpPolicy(reply,{...context,followUpState:stepFollowUpState(3)})
 assert.equal(afterLimit.kind,'draft')
 assert.equal(afterLimit.note,context.record.note)
 assert.equal(afterLimit.choices,undefined)
})

test('health example reaches the published latest and independent archived health report',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-skill-health-'))
 const now=Date.parse('2026-10-27T06:00:00+08:00')
 await writeFile(join(directory,'manifest.json'),'{}')
 const reply=await example('ship-engine-health','local-response')
 const window={start_time:'2026-10-27 00:00:00',end_time:'2026-10-27 06:00:00'}
 const facts={result:{analysis_window:window,devices:{主机:{device_name:'主机',context:'窗口末转速 0 rpm。'}}},
  units:{},coverage:{status:'partial',start:window.start_time,end:window.end_time}}
 const scheduler=await createHealthScheduler(directory,{directory,clock:()=>now,analyze:async()=>facts,
  enhance:async()=>{validateHealthLanguage(reply);return {...reply,model:'fixture'}}})
 t.after(async()=>{await scheduler.close();await rm(directory,{recursive:true,force:true})})
 await scheduler.tick()
 const {latest}=await scheduler.status()
 assert.equal(latest.modelStatus,'complete')
 assert.equal(latest.healthStatus,'unknown')
 const archive=JSON.parse(await readFile(join(latest.archivePath,'report.json'),'utf8'))
 for(const field of ['conclusion','next','detail']){
  assert.equal(latest[field],reply[field])
  assert.equal(archive[field],reply[field])
 }
})

test('the observation example publishes the source window, measured channels and follow-up once',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-skill-observation-'))
 const now=Date.parse('2026-10-27T06:00:00+08:00'),start=new Date(now-3600000).toISOString(),end=new Date(now).toISOString()
 const plan=await example('ship-event-assistant','plan'),reply=await example('ship-effect-observation','result')
 const sensors=[{channelId:'s-012',pointCode:'DC0001',name:'主机转速',unit:'rpm',sampleCount:61,covered:true,
  sourceKind:'local-database',start,end,min:0,max:0,mean:0,firstValue:0,value:0,trendData:[{timestamp:now,value:0}]}]
 const service=await createWorkflowService(root,{directory,clock:()=>now,detect:async()=>({rows:0,devices:[]}),
  evidenceReader:()=>sensors,observationModel:async()=>reply})
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true})})
 const phase={id:'window-1',at:start,observationDueAt:end,observationWaiting:true}
 const event={id:'detected-test-observation',title:plan.scope,number:'TEST-OBS',type:'效果观察',phase:'review',unread:{},
  brief:{conclusion:plan.rationale},sensorScope:{deviceId:'main-engine-1'},tasks:[],reports:[],phases:[phase],conversations:{captain:[]}}
 await service.repository.save(event)
 await service.tick()
 await service.tick()
 const saved=service.repository.get(event.id),[report]=saved.reports
 assert.equal(saved.reports.length,1)
 assert.equal(saved.phases[0].observationReportId,report.id)
 assert.deepEqual(report.observationSnapshot.sensors,sensors)
 assert.equal(report.observationSnapshot.windowStart,start)
 assert.equal(report.observationSnapshot.windowEnd,end)
 assert.equal(report.summary,reply.summary)
 assert.ok(report.markdown.includes(reply.analysis)&&report.markdown.includes(reply.next))
})
