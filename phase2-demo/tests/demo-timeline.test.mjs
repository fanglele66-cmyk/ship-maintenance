import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState} from '../src/workflow/eventLifecycle.js'
import {loadLifecycleState,lifecycleSnapshot,lifecycleStorageKey,sourceTime,timelineText,shiftTimelineContent} from '../src/workflow/demoTimeline.js'
import {initialInformationTimes} from '../src/workflow/initialInformationTimes.js'
import {taskObservationData} from '../src/mock/taskObservationData.js'
import {eventBriefingFor} from '../src/mock/eventBriefings.js'
import {navigationChronology} from '../src/workflow/navigationChronology.js'
import {navigationStages} from '../src/workflow/navigationStages.js'
import {mockDevices} from '../src/mock/devices.js'
const T=Date.parse('2026-11-04T01:02:00+08:00'),alarmId='real-alarm-0430',warningId='real-warning-0523'
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}}

test('new workspace fixes T before any action; reload and second tab share it; independent storage starts new T',()=>{
 const disk=storage(),first=loadLifecycleState(disk,createLifecycleState,T)
 assert.equal(first.timeBase,T)
 for(const [id,hours] of [[alarmId,1],[warningId,3]])assert.equal(sourceTime(first.events[id].createdAt),T-hours*3600000)
 const second=loadLifecycleState(disk,createLifecycleState,T+600000)
 assert.equal(second.timeBase,T)
 assert.deepEqual(second.events,first.events)
 assert.equal(loadLifecycleState(storage(),createLifecycleState,T+600000).timeBase,T+600000)
})
test('legacy workspaces keep timestamps, draft notes, submitted reports and decisions intact',()=>{
 const disk=storage(),old=createLifecycleState()
 old.events[alarmId].decisionDraft={action:'investigate',note:'原草稿'}
 disk.setItem(lifecycleStorageKey,lifecycleSnapshot(old))
 const loaded=loadLifecycleState(disk,createLifecycleState,T)
 assert.deepEqual(loaded.events,old.events)
 assert.equal(loaded.events[alarmId].timeline,undefined)
 assert.equal(loadLifecycleState(disk,createLifecycleState,T+600000).timeBase,T)
})
test('alarm sequence and metadata cross midnight without changing six-minute or six-second evidence gaps',()=>{
 const state=createLifecycleState({timeBase:T}),alarm=state.events[alarmId],warning=state.events[warningId]
 assert.equal(alarm.brief.discovery.at,'2026-11-04 00:02')
 assert.equal(alarm.brief.facts[0].value,'2026-11-03 23:56 → 00:02')
 assert.equal(sourceTime(alarm.brief.facts[1].at),T-3600000-6000)
 assert.match(alarm.brief.tasks[0].detail,/2026-11-03 23:56及00:02/)
 assert.deepEqual(initialInformationTimes(alarm),{dataWindow:'2026-11-03 23:32 — 2026-11-04 00:02',generatedAt:'2026-11-04 00:07'})
 assert.equal(warning.brief.discovery.at,'2026-11-03 22:02')
 assert.equal(initialInformationTimes(warning).generatedAt,'2026-11-03 22:07')
 assert.doesNotMatch(shiftTimelineContent('4月30日停车待引水后重启',alarm.timeline),/4月30日/)
 assert.match(alarm.conversations.captain[0].detailsMarkdown,/23:56.*00:02/)
 assert.equal(alarm.phases[0].at,alarm.createdAt)
 assert.equal(sourceTime(alarm.conversations.captain[0].at),T-3600000+5*60000)
})
test('source evidence and long-term month cases remain unchanged',()=>{
 const base=createLifecycleState(),state=createLifecycleState({timeBase:T})
 for(const id of [alarmId,warningId])assert.deepEqual(state.events[id].brief.sources,eventBriefingFor(id).sources)
 for(const id of ['real-tracking-exhaust-baseline','real-health-c4-baseline']){
  assert.deepEqual(state.events[id].brief,base.events[id].brief)
  assert.equal(state.events[id].createdAt,base.events[id].createdAt)
 }
 assert.equal(eventBriefingFor(alarmId).facts[0].value,'23:27 → 23:33')
})
for(const [id,hours] of [[alarmId,1],[warningId,3]])test(`${id}: all chart samples and gaps shift together, never altering measured values`,()=>{
 const timeline=createLifecycleState({timeBase:T}).events[id].timeline
 const original=taskObservationData(id),shifted=taskObservationData(id,timeline)
 assert.equal(shifted.end,T-hours*3600000)
 shifted.sensors.forEach((sensor,j)=>{
  assert.equal(sensor.value,original.sensors[j].value)
  sensor.trendData.forEach((point,i)=>{
   assert.equal(point.value,original.sensors[j].trendData[i].value)
   assert.equal(sourceTime(point.time)-sourceTime(original.sensors[j].trendData[i].time),timeline.offsetMs)
  })
 })
 assert.deepEqual(shifted.coverage.gaps.map(g=>g.seconds),original.coverage.gaps.map(g=>g.seconds))
 assert.equal(original.coverage.lastSampleAt,taskObservationData(id).coverage.lastSampleAt)
})
test('stage boundaries stay fixed while current stage extends; one auxiliary and simulated means',()=>{
 const a=navigationChronology({},T,{timeBase:T}),b=navigationChronology({},T+600000,{timeBase:T})
 assert.deepEqual(a.periods.slice(-4).map(p=>p.start),b.periods.slice(-4).map(p=>p.start))
 assert.equal(b.periods.at(-1).end,T+600000)
 assert.deepEqual(a.periods.slice(-4,-1).map(p=>p.averageSpeed),[0.2,2.4,7.2])
 assert.ok(a.periods.every(p=>p.aux===1&&!/[123]号辅机|并联/.test(p.detail)))
 assert.deepEqual(mockDevices.filter(d=>d.id.startsWith('aux-engine-')).map(d=>d.name),['辅机'])
})
test('captain summary follows linked observation without double counting or misdating old cases; engineers get no event data',()=>{
 const state=createLifecycleState({timeBase:T}),alarm=state.events[alarmId],periods=navigationChronology({},T).periods
 alarm.phase='transferred';alarm.observationEventIds=['observation-1']
 state.events['observation-1']={id:'observation-1',type:'效果观察',parentEventId:alarmId,createdAt:timelineText(T),phase:'review',phases:[{observationWaiting:true}]}
 let stages=navigationStages(periods,Object.values(state.events))
 assert.equal(stages.at(-1).incidents.length,2)
 assert.deepEqual(stages.at(-1).concerns[0].states,[{label:'待决策',count:1},{label:'观察中',count:1}])
 assert.equal(stages.at(-1).severity,'alarm')
 state.events['observation-1'].phase='closed';state.events[warningId].phase='closed'
 stages=navigationStages(periods,Object.values(state.events))
 assert.equal(stages.at(-1).severity,null)
 assert.deepEqual(stages.at(-1).concerns[0].states,[{label:'已闭环',count:2}])
 const engineer=navigationStages(periods,Object.values(state.events),{captain:false})
 assert.ok(engineer.every(p=>!p.incidents.length&&!p.concerns.length&&!p.severity))
})
