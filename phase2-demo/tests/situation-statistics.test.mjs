import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState, currentTask, decide, people, resumeOwnTask, submitTask, visibleEvents} from '../src/workflow/eventLifecycle.js'
import {situationStatistics} from '../src/workflow/situationStatistics.js'
import {startObservation} from './helpers/observation-fixture.mjs'

const now = Date.parse('2026-11-25T14:00:00+08:00')
const occurrence = (id, createdAt, extra={}) => ({
  id, type:'报警事件', device:'主机', title:id, createdAt, phase:'reminder', tasks:[], decisions:[], phases:[], ...extra,
})

test('a period includes new and handled events, once per event ID, with four types and independent observations', () => {
  const past = occurrence('past','2026-11-18 23:59')
  const older = occurrence('older','2026-11-18 23:59', {type:'预警事件',phase:'closed',closedAt:'2026-11-24 16:10',
    decisions:[{at:'2026-11-23 09:00'},{at:'2026-11-24 16:10'}]})
  const observation = occurrence('obs','2026-11-22 12:00',{type:'效果观察',parentEventId:'older',phase:'review',
    phases:[{observationWaiting:true}]})
  const tracking = occurrence('tracking','2026-11-19 00:00',{type:'异动跟踪'})
  const alarm = occurrence('alarm','2026-11-25 11:00',{phase:'investigation',tasks:[{assignedAt:'2026-11-25 11:00',submittedAt:'2026-11-25 11:05'}]})
  const future = occurrence('future','2026-11-25 23:50')
  const stats = situationStatistics([past,older,observation,tracking,alarm,future,alarm],7,now)
  assert.deepEqual(stats.types.map(type=>[type.label,type.count]),[['报警',1],['预警',1],['异动跟踪',1],['效果观察',1]])
  assert.deepEqual([stats.rows.length,stats.added,stats.handled,stats.closed,stats.pending],[4,3,2,1,1])
  assert.equal(stats.rows.find(row=>row.pending).id,'tracking')
  assert.equal(stats.rows.find(row=>row.type==='效果观察').id,'obs')
  assert.equal(stats.trend.at(-1).handled,1)
  assert.equal(stats.trend[0].added,1)
})

test('device totals include a single occurrence, distinguish device instances, and ignore legacy classification', () => {
  const at = '2026-11-23 12:00'
  const alias = occurrence('legacy',at,{decisions:[{at,classification:{fault:'confirmed',urgency:'urgent',component:'控制阀'}}]})
  const alarm = occurrence('current',at,{deviceId:'me-1'})
  const other = occurrence('other',at,{type:'异动跟踪',device:'辅机',deviceId:'ae-1'})
  const stats = situationStatistics([alias,alarm,other],30,now)
  assert.deepEqual(stats.devices.map(group=>[group.device,group.count,group.types['报警'],group.types['异动跟踪']]),
    [['主机',2,2,0],['辅机',1,0,1]])
  const twoInstances = situationStatistics([alarm,{...other,device:'主机',deviceId:'me-2'}],30,now)
  assert.deepEqual(twoInstances.devices.map(row=>[row.identifier,row.count]),[['me-1',1],['me-2',1]])
  const empty = situationStatistics([],0,now)
  assert.equal(empty.rows.length,0)
  assert.deepEqual(empty.types.map(type=>type.count),[0,0,0,0])
  assert.equal(empty.trend.length,1)
})

test('dashboard uses each real lifecycle event visible to the account and links to the observation itself', () => {
  const state = createLifecycleState({timeBase:now})
  const parent = state.events['real-health-c4-baseline']
  const {event:observation} = startObservation(state,parent,new Date(now).toISOString())
  const all = situationStatistics(visibleEvents(state),0,now)
  assert.deepEqual(all.types.map(type=>type.count),[1,1,2,1])
  assert.equal(all.rows.find(row=>row.id===observation.id).state,'观察中')
  state.role='engineer'
  const crew = situationStatistics(visibleEvents(state),0,now,state.role)
  assert.deepEqual(new Set(crew.rows.map(row=>row.id)),new Set([parent.id,observation.id]))
  assert.equal(crew.types.find(type=>type.label==='报警').count,0)
})

test('pending metric and drilldown follow the task owner through submission, waiting, and return to the chief', () => {
  const state = createLifecycleState()
  const event = state.events['real-alarm-0430']
  const verify = (role, expected) => {
    state.role = role
    const visible = visibleEvents(state).filter(row => row.id === event.id)
    for (const days of [7,0]) {
      const stats = situationStatistics(visible,days,Date.now(),role)
      assert.equal(stats.pendingLabel,role === 'captain' ? '待决策事件' : '待处理事件')
      assert.equal(stats.pending,Number(expected))
      assert.deepEqual(stats.rows.filter(row => row.pending).map(row => row.id),expected ? [event.id] : [])
    }
  }
  decide(state,event.id,{action:'investigate',owner:people.secondEngineer,deadline:new Date(Date.now()+86400000).toISOString()})
  const task = currentTask(event)
  // A previous participant can see the event even when the current task belongs to a colleague.
  if (!event.participants.includes(people.engineer)) event.participants.push(people.engineer)
  verify('engineer',false)
  verify('captain',false)
  verify('secondEngineer',true)

  task.draft.records.forEach((record,index) => { record.result = task.steps[index].options[0] })
  task.draft.records[0].result = '无法确认'
  task.draft.records[0].executionStatus = '未完成'
  task.draft.records[0].note = '等待停机检查'
  submitTask(state,event.id,task.id)
  verify('secondEngineer',false)
  verify('captain',true)

  decide(state,event.id,{action:'wait',reason:'等待停机窗口。'})
  verify('engineer',false)
  verify('captain',false)
  verify('secondEngineer',true)
  resumeOwnTask(state,event.id,task.id,{reason:'现场条件变化，需要调整范围。',unchanged:false})
  verify('secondEngineer',false)
  verify('captain',true)
})

test('only an open current report retry counts for its engineer; background generation and historical tasks do not', () => {
  const at = '2026-11-25 12:00'
  const task = {id:'current',assignedAt:at,submittedAt:at,owner:people.engineer,status:'submitted'}
  const make = (id,status,extra={}) => occurrence(id,at,{phase:'review',currentTask:task.id,
    tasks:[{...task,reportGeneration:{status,factReportId:'fact'}}],reports:[{id:'fact'}],...extra})
  const events = [make('retry','error'),make('stream','streaming'),make('done','complete'),
    make('closed','error',{phase:'closed',closedAt:at}),make('old-task','error',{currentTask:'next'}),
    make('revised','error',{reports:[{id:'fact',revisions:[{}]}]}),make('missing','error',{reports:[]})]
  const stats = situationStatistics(events,7,now,'engineer')
  assert.equal(stats.pending,1)
  assert.deepEqual(stats.rows.filter(row => row.pending).map(row => row.id),['retry'])
  assert.equal(situationStatistics(events,7,now,'secondEngineer').pending,0)
  const oldError = {...task,status:'report-error',reportGeneration:{factReportId:'fact'}}
  assert.equal(situationStatistics([make('legacy-error',null,{tasks:[oldError]})],7,now,'engineer').pending,1)
})
