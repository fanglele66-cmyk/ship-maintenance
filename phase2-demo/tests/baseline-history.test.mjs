import test from 'node:test'
import assert from 'node:assert/strict'
import history from '../src/mock/baselineHistory.json' with {type:'json'}
import {realWorkflowCases} from '../src/mock/realCaseAdapter.js'
import {baselineBriefings} from '../src/mock/baselineBriefings.js'
import {feedbackPresets} from '../src/mock/realScenarioPresets.js'
const near=(a,b)=>assert.ok(Math.abs(a-b)<0.005,`${a} should round to ${b}`)
test('paired monthly data reproduces all eight months from the supplied long-term report',()=>{
 assert.deepEqual(history.months.map(m=>m.count),[6962,25189,16442,12973,26914,4789,15294,12235])
 assert.equal(history.months.reduce((s,m)=>s+m.count,0),120798)
 const delta=[1.35,-1.31,1.40,6.36,7.48,8.02,7.41,8.93]
 const max=[-12.77,-19.29,-16.51,-0.10,-0.76,-1.62,2.21,4.42]
 history.months.forEach((m,i)=>{near(m.cylinders[0].deltaPeers,delta[i]);near(m.cylinders[0].deltaMax,max[i])
  m.cylinders.forEach(c=>{const peers=m.cylinders.filter(p=>p!==c);near(c.deltaPeers,c.mean-peers.reduce((s,p)=>s+p.mean,0)/5)})
 })
 assert.equal(history.source.lastSample,'2026-08-07 14:19:59')
 assert.equal(history.source.requestedEnd,'2026-08-12 11:39:59')
 assert.ok(history.months.every(m=>m.first<=m.last&&m.last<=history.source.requestedEnd))
})
test('C4 relative shift is distinct from its absolute temperature and does not presume repair',()=>{
 const c4=history.months.map(m=>m.cylinders[3])
 near(c4[4].deltaPeers,4.79);near(c4[5].deltaPeers,-6.44)
 near(c4[5].deltaPeers-c4[4].deltaPeers,-11.23)
 near(c4[6].deltaPeers,-2.58);near(c4[7].deltaPeers,-2.53)
 assert.ok(c4[7].mean>c4[4].mean,'absolute temperature is not a continuous decline')
 const all=Object.values(baselineBriefings)
 for(const brief of all)assert.doesNotMatch(JSON.stringify(brief),/倒车|负转|临修|HRD-FA|减压阀/)
})
test('both replacement workflows keep baseline-specific, complete branch feedback',()=>{
 for(const item of realWorkflowCases.filter(c=>['tracking','maintenance'].includes(c.realType))){
  assert.match(item.initialTitle,/一缸|四缸/)
  assert.doesNotMatch(JSON.stringify(item),/倒车|负转|HRD-FA|减压阀/)
  const branches=feedbackPresets(item,item.stages.find(s=>s.kind==='check'))
  assert.equal(branches.length,9)
  for(const branch of branches)for(const row of branch.records){assert.ok(row.note.length>30);assert.doesNotMatch(row.note,/倒车|负转|临修|HRD/)}
 }
})
