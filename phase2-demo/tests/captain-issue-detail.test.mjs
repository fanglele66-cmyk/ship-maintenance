import test from 'node:test'
import assert from 'node:assert/strict'
import dossiers from '../src/mock/issueDossiers.json' with { type: 'json' }
import {issueCatalog} from '../src/mock/captainWorkbench.js'

test('SIT-04 dossiers cover all six issues with overview-first structure',()=>{
 const ids=issueCatalog.map(item=>item.id)
 for(const id of ids){
  const dossier=dossiers[id]
  assert.ok(dossier,id+' has a dossier')
  assert.ok(dossier.conclusion?.trim(),id+' conclusion first')
  assert.ok(dossier.recommendation?.trim(),id+' recommendation present')
  assert.ok(dossier.action?.trim(),id+' action present')
  assert.ok(Array.isArray(dossier.snapshots)&&dossier.snapshots.length>0,id+' snapshots present')
  for(const snap of dossier.snapshots){
   assert.ok(snap.name&&snap.value&&snap.reference&&snap.meaning&&snap.source,id+' snapshot fields complete: '+snap.name)
  }
 }
})

test('SIT-04 type-specific focus per confirmed structure',()=>{
 // 报警：重在触发与关联信号，不造连续趋势
 for(const id of ['fault','steering-heat']){
  assert.deepEqual(dossiers[id].series,[],id+' alarm keeps no fabricated series')
  assert.ok(dossiers[id].snapshots.some(snap=>/报警|参考上限|已报警/.test(snap.reference+snap.meaning)),id+' alarm snapshot references the trigger')
 }
 // 预警：多指标联动，节点折线成对
 const warning=dossiers['main-warning']
 assert.ok(warning.series.length>=2,'warning links at least two indicators')
 assert.deepEqual(warning.series[0].labels,warning.series[1].labels,'warning indicators share observation nodes')
 // 异动：可比偏离与发展
 const drift=dossiers['drift']
 assert.ok(/偏离|相对差/.test(drift.conclusion),'drift focuses on comparable deviation')
 assert.equal(drift.series.find(s=>s.name==='排温相对差')?.values.join(','),'8,10','drift deviation values match catalog')
 // 维保：原计划与提前依据，plan 来源保留
 const plan=dossiers['maintenance'].plan
 assert.ok(plan.some(row=>/原周期/.test(row.label)&&/保留/.test(row.status)),'maintenance keeps original plan row')
 assert.ok(plan.some(row=>/候选窗口/.test(row.label)),'maintenance includes candidate window')
})

test('SIT-04 series values stay consistent with issueCatalog numbers',()=>{
 // 抽核：预警油压 0.31→0.27→0.24；空压机加载 95/112/128；维保振动 2.1→3.0
 assert.deepEqual(dossiers['main-warning'].series[0].values,[0.31,0.27,0.24])
 assert.deepEqual(dossiers['air-delivery'].series[0].values,[95,112,128])
 assert.deepEqual(dossiers['maintenance'].series[0].values,[2.1,3.0])
 for(const id of ['main-warning','drift','air-delivery','maintenance']){
  for(const series of dossiers[id].series){
   assert.ok(series.labels.length===series.values.length,id+' '+series.name+' labels match values')
   assert.ok(series.scope?.trim(),id+' '+series.name+' states its comparison scope')
  }
 }
 // 空值兜底：fault/steering-heat 无 series 时页面展示缺项提示，而非崩溃
 assert.equal(dossiers['fault'].plan?.length??0,0,'fault has no fabricated plan')
})
