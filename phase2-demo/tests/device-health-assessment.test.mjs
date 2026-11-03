import test from 'node:test'
import assert from 'node:assert/strict'
import {deviceHealthAssessment} from '../src/workflow/deviceHealthAssessment.js'
import {eventAssessmentContext} from '../src/workflow/eventAssessmentContext.js'
import {createLifecycleState} from '../src/workflow/eventLifecycle.js'
import {buildSimulationSensors} from '../src/mock/sensorSimulation.js'
import {mockSensors} from '../src/mock/sensors.js'
const setup=()=>({deviceId:'main-engine-1',sensors:buildSimulationSensors(mockSensors),events:Object.values(createLifecycleState().events),period:{state:'海上稳态航行'}})

test('current sensor updates change current assessment without rewriting historical voyage context',()=>{
  const input=setup(),before=deviceHealthAssessment(input)
  input.sensors.find(p=>p.id==='s-012').value=80
  input.period={state:'低速操纵'}
  const after=deviceHealthAssessment(input)
  assert.notEqual(before.conclusion,after.conclusion)
  assert.match(after.conclusion,/低速操纵.*80.0 rpm/)
  assert.equal(before.basis,after.basis)
  assert.match(after.basis,/停车待引水后重启/)
  assert.match(after.basis,/具体航行状态待核对/)
  assert.ok([before.conclusion,before.basis,before.next].join('').length<=650,'keep the existing main-engine copy budget')
})
test('closed events leave the attention conclusion but keep their historical assessment',()=>{
  const input=setup();input.events.forEach(e=>{e.phase='closed';e.status='已闭环'})
  const result=deviceHealthAssessment(input)
  assert.match(result.conclusion,/无待处置事件/)
  assert.doesNotMatch(result.conclusion,/需关注二缸/)
  assert.match(result.basis,/已闭环/)
})
test('auxiliary running, standby, missing and flagged readings remain distinct',()=>{
  const input={...setup(),deviceId:'aux-engine-1'}
  input.sensors.find(p=>p.id==='aux-1-rpm').value=0
  const standby=deviceHealthAssessment(input)
  assert.match(standby.conclusion,/辅机备用/)
  assert.match(standby.basis,/备用不代表带载正常/)
  assert.match(deviceHealthAssessment({...input,sensors:[]}).conclusion,/测点缺失/)
  input.sensors.find(p=>p.id==='aux-1-oil-temp').status='over'
  assert.match(deviceHealthAssessment(input).conclusion,/异常读数待核验/)
  for(const deviceId of ['aux-system','aux-engine-1']){
    const r=deviceHealthAssessment({...setup(),deviceId})
    assert.ok([r.conclusion,r.basis,r.next].join('').length<=65,'keep compact auxiliary copy')
  }
})
test('candidate priorities use discovery evidence for alarm and warning only',()=>{
  for(const id of ['real-alarm-0430','real-warning-0523']){
    const c=eventAssessmentContext[id]
    assert.deepEqual(c.candidates.map(r=>r.level),['高','中','低'])
    assert.ok(c.candidates.every(r=>r.basis&&r.impact))
  }
  assert.equal(eventAssessmentContext['real-health-c4-baseline'].candidates,undefined)
  assert.match(eventAssessmentContext['real-warning-0523'].boundary,/燃油指令不等于实测负荷/)
})
