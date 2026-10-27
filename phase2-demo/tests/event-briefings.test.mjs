import test from 'node:test'
import assert from 'node:assert/strict'
import {eventBriefings,eventBriefingFor} from '../src/mock/eventBriefings.js'

test('each event briefing has a distinct decision, traceable facts and explicit branches',()=>{
 assert.deepEqual(Object.keys(eventBriefings),['real-alarm-0430','real-warning-0523','real-tracking-exhaust-baseline','real-health-c4-baseline','real-maintenance-c4-baseline','real-maintenance-c1-baseline'])
 for(const [id,item] of Object.entries(eventBriefings)){
  assert.equal(item.id,id)
  assert.ok(item.conclusion&&item.captainDecision&&item.dispatchReason&&item.boundary)
  assert.ok(item.facts.length>=3&&item.facts.length<=6)
  assert.ok(item.tasks.length>=2&&item.branches.length>=2)
  assert.ok(item.facts.every(fact=>fact.at&&fact.meaning&&fact.value!==undefined))
  assert.ok(item.facts.every(fact=>fact.sourceIds.every(sourceId=>item.sources.some(source=>source.id===sourceId))))
  assert.ok(item.sources.every(source=>source.title&&source.date&&source.kind&&source.summary))
  assert.doesNotMatch(JSON.stringify(item),/D:[/\\]|localhost|127\.0\.0\.1|回放|演示|参考案例|已部署|实时AI/)
 }
 assert.equal(eventBriefingFor('real-alarm-0430-replay'),eventBriefingFor('real-alarm-0430'))
 assert.equal(eventBriefingFor('missing'),null)
 assert.equal(eventBriefingFor(null),null)
})

test('initial cases retain their cutoff and never use later repair or human closure conclusions',()=>{
 const alarm=eventBriefingFor('real-alarm-0430'),warning=eventBriefingFor('real-warning-0523'),tracking=eventBriefingFor('real-tracking-exhaust-baseline')
 assert.equal(alarm.evidenceCutoff,'2026-04-30 23:33:00')
 assert.equal(warning.evidenceCutoff,'2026-05-23 21:28:40')
 assert.equal(tracking.evidenceCutoff,'2026-08-12 11:39:59')
 assert.equal(alarm.discovery.kind,'ship-alarm')
 assert.equal(warning.discovery.kind,'ai-data-analysis')
 assert.equal(tracking.discovery.kind,'ai-data-analysis')
 assert.doesNotMatch(JSON.stringify(alarm),/严重卡阻|更换ICU并|喷油器喷嘴破裂|12:26|11:38|5月1日/)
 assert.doesNotMatch(JSON.stringify(warning),/密封垫老化|临时修复测试正常|HRD-FA|2026-06-09/)
 assert.doesNotMatch(JSON.stringify(tracking),/2026-08-28|已关闭|已确认正常|两次均勾选/)
 assert.match(tracking.tasks.map(task=>task.detail).join(' '),/4—7 月|Pmax/)
 assert.match(tracking.boundary,/喷油器或排气阀维修依据各自检验结果/)
})

test('physical readings retain sensor identity, sampling time and limited interpretation',()=>{
 const alarm=eventBriefingFor('real-alarm-0430'),warning=eventBriefingFor('real-warning-0523'),tracking=eventBriefingFor('real-tracking-exhaust-baseline')
 const exhaust=alarm.facts.find(fact=>fact.label==='二缸排气温度')
 assert.equal(exhaust.value,80.4);assert.equal(exhaust.at,'2026-04-30 23:32:54');assert.deepEqual(exhaust.sampleIds,[127128]);assert.deepEqual(exhaust.sensorIds,['DC0009'])
 const sequence=warning.facts.find(fact=>fact.label==='连续低压记录')
 assert.equal(sequence.value,sequence.sampleIds.length);assert.deepEqual(sequence.sensorIds,['DC0006','DC0007']);assert.equal(sequence.sampleIds.at(-1),825685)
 assert.match(sequence.at,/21:27:34–21:28:40/)
 const thermal=tracking.facts.find(fact=>fact.label==='4—8 月相对偏差')
 assert.equal(thermal.value,'+6.36～+8.93');assert.equal(thermal.unit,'°C');assert.match(thermal.meaning,/已覆盖样本/)
})

test('baseline maintenance stays within the same health tracking without a past repair claim',()=>{
 const parent=eventBriefingFor('real-health-c4-baseline'),child=eventBriefingFor('real-maintenance-c4-baseline')
 assert.equal(child.parentIssueId,parent.id)
 assert.equal(parent.evidenceCutoff,'2026-08-12 11:39:59')
 assert.equal(parent.baselineCylinder,4)
 assert.deepEqual(child.facts,parent.facts);assert.deepEqual(child.sources,parent.sources)
 assert.match(parent.conclusion,/绝对排温并非持续下降/)
 assert.doesNotMatch(JSON.stringify(parent),/临修|HRD|控制空气|2026-06-09/)
 assert.ok(child.branches.some(branch=>branch.next.includes('确认责任人')&&branch.next.includes('闭环本事件')))
 assert.ok(child.branches.some(branch=>branch.condition.includes('条件不具备')))
})
