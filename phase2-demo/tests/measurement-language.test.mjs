import test from 'node:test'
import assert from 'node:assert/strict'
import {eventBriefingFor} from '../src/mock/eventBriefings.js'
import {realWorkflowCases} from '../src/mock/realCaseAdapter.js'
import {taskPackages,assigneeBriefs} from '../src/mock/realTaskContent.js'
import {compactRepair} from '../src/mock/compactRepair.js'
import {followupStage} from '../src/mock/followupRounds.js'
import {checkPreparation} from '../src/mock/taskGuidance.js'
import {feedbackPresets,executionPreset} from '../src/mock/realScenarioPresets.js'
import {baselineMaintenanceBriefFor} from '../src/mock/baselineTaskContent.js'

const warningId='real-warning-0523'
const warning=realWorkflowCases.find(item=>item.id===warningId)
const text=value=>JSON.stringify(value)
const namedInletPair=value=>{
 assert.match(value,/主机控制空气进口压力/)
 assert.match(value,/主机控制空气进口压力（安全监测）/)
 assert.doesNotMatch(value,/0302|0303|DC0006|DC0007/)
}

test('warning discovery presents AI detection with named measurements and preserves the raw detection evidence',()=>{
 const brief=eventBriefingFor(warningId)
 namedInletPair(brief.discovery.text)
 assert.match(brief.discovery.text,/^AI检测发现[\s\S]*连续5次低于0\.58 MPa/)
 assert.doesNotMatch(brief.discovery.text,/规则触发|触发本次配置规则/)
 const raw=text(brief.sources.find(source=>source.id==='warning-rule').records)
 assert.match(raw,/0302 \/ DC0006[\s\S]*0303 \/ DC0007/)
 assert.match(raw,/0302 连续 5 次检测到数值 <0\.58 MPa/)
 assert.equal(warning.report.system,brief.discovery.text)
 assert.ok(warning.pageContent.analysis.includes(brief.discovery.text))
 assert.match(brief.boundary,/减压阀压降[\s\S]*阀前后/)
 assert.match(brief.facts.find(f=>f.sensorIds?.includes('DC0058')).meaning,/不能把燃油指令当作实测负荷/)
 assert.doesNotMatch(text(brief),/主测点|安全测点压力|未见启停或明显负荷突变|两路低压/)
})

test('measurement clarification leaves the original values, timestamps and source identities intact',()=>{
 const brief=eventBriefingFor(warningId)
 assert.deepEqual(brief.facts.slice(0,2).map(f=>({value:f.value,at:f.at,sampleIds:f.sampleIds,sensorIds:f.sensorIds})),[
  {value:'0.67 → 0.57',at:'2026-05-23 20:58:40–21:28:40',sampleIds:[825588,825685],sensorIds:['DC0006']},
  {value:'0.64 → 0.54',at:'2026-05-23 20:58:40–21:28:40',sampleIds:[825588,825685],sensorIds:['DC0007']},
 ])
 assert.deepEqual(brief.facts[2].sampleIds,[825681,825682,825683,825684,825685])
 assert.equal(brief.facts[2].value,5)
 assert.equal(brief.evidenceCutoff,'2026-05-23 21:28:40')
 const alarm=eventBriefingFor('real-alarm-0430')
 assert.equal(alarm.facts[1].value,80.4)
 assert.equal(alarm.facts[1].at,'2026-04-30 23:32:54')
 assert.doesNotMatch(text(alarm),/严重卡阻|已更换|5月1日|12:26/)
 assert.match(alarm.tasks[0].detail,/喷射控制单元（ICU）[\s\S]*喷射控制阀（ICV）/)
})

test('first-round investigation and both repair paths distinguish inlet sensors from separate field taps',()=>{
 const event=warning.stages.find(stage=>stage.id==='event')
 namedInletPair(text([assigneeBriefs.warning,event.tasks,checkPreparation(warning,event)]))
 assert.match(text(event.tasks),/不是减压阀前后测点|不代表减压阀前后压力/)
 for(const key of ['regulator','air']){
  const repair=compactRepair(warning,[key])
  namedInletPair(text(repair))
  assert.match(text(repair.tasks),/减压阀前后压力另测[\s\S]*不用两个进口测点相减作为阀压降/)
  namedInletPair(text(taskPackages('warning')[key].acceptanceRows))
 }
})

test('second-round tasks and acceptance retain the same measurement meaning without altering round one',()=>{
 const check=warning.stages.find(stage=>stage.id==='investigate')
 const before=text(check)
 const nextCheck=followupStage(warning,check,2)
 namedInletPair(text(checkPreparation(warning,nextCheck)))
 assert.match(text(nextCheck.preparation),/均在主机进口[\s\S]*减压阀前后压力由另外的分段表计测量/)
 for(const key of ['regulator','air']){
  const repair={...warning.stages.find(stage=>stage.kind==='work'),...compactRepair(warning,[key]),packageKeys:[key]}
  const nextWork=followupStage(warning,repair,2)
  namedInletPair(text(nextWork.workDetails.acceptanceRows))
  assert.match(text(nextWork.workDetails.acceptanceRows),/另行测量的减压阀前后/)
 }
 assert.equal(text(check),before)
})

test('simulated feedback does not turn platform history into newly measured field or repaired pressure',()=>{
 const stage=warning.stages.find(stage=>stage.id==='event')
 for(const preset of feedbackPresets(warning,stage)){
  const note=preset.records[0].note
  namedInletPair(note)
  assert.ok(preset.records.every(record=>record.isSimulation))
  assert.doesNotMatch(note,/复核两侧压力|不能确认两侧一致|恢复后的 0\.67\/0\.64/)
  if(preset.records[0].result==='现场与系统一致'){
   assert.match(note,/原平台连续低压片段[\s\S]*0\.57 MPa、0\.54 MPa/)
   assert.match(note,/不能自动填写为现场测量/)
  }
 }
 const repair={...warning.stages.find(stage=>stage.kind==='work'),...compactRepair(warning,['regulator'])}
 const draft=executionPreset(warning,repair,'complete')
 assert.equal(draft.isSimulation,true)
 namedInletPair(draft.acceptance)
 assert.match(draft.acceptance,/本轮实际读数/)
 assert.doesNotMatch(draft.acceptance,/复测约|0\.67|0\.64/)
})

test('both baseline cases keep relative temperature semantics and their evidence limits',()=>{
 const c1=eventBriefingFor('real-tracking-exhaust-baseline'),c4=eventBriefingFor('real-health-c4-baseline')
 assert.match(c1.discovery.text,/多个月份/)
 assert.doesNotMatch(c1.discovery.text,/多个航次/)
 assert.match(c1.boundary,/8 月 4 日同窗缸套冷却水出口温度、进出口温差及活塞冷却油出口温度/)
 assert.match(c1.tasks[1].detail,/一缸排气温度探头/)
 assert.match(c4.tasks[1].detail,/四缸排气温度探头/)
 assert.doesNotMatch(text([c1.tasks,c4.tasks]),/0305|DC0011|DC0008/)
 assert.match(text(c1.sources),/0305A \/ DC0008/)
 assert.match(text(c4.sources),/0305D \/ DC0011/)
 assert.equal(c4.facts[1].value,'−11.23')
 assert.match(c4.facts[1].meaning,/不是四缸绝对排温下降/)
 assert.match(c4.boundary,/并无四缸部件失效或维修完成记录/)
 for(const cylinder of [1,4]){
  assert.match(text(baselineMaintenanceBriefFor(cylinder)),/最高燃烧压力（Pmax）/)
  const item=realWorkflowCases.find(c=>c.id===`real-maintenance-c${cylinder}-baseline`)
  const work=followupStage(item,item.stages.find(stage=>stage.kind==='work'),2)
  assert.match(text(work.workDetails.acceptanceRows),/同刻排气温度及相对均值偏差/)
  assert.match(text(work.workDetails.acceptanceRows),/最高燃烧压力（Pmax）/)
 }
})
