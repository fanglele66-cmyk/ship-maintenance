import test from 'node:test'
import assert from 'node:assert/strict'
import {workflowDossiers as dossiers,workflowCases} from '../src/mock/fourStoryWorkflow.js'
import {issueCatalog} from '../src/mock/captainWorkbench.js'

test('current and historical issue materials have a readable conclusion and recommendation',()=>{
 for(const issue of issueCatalog){
  const dossier=dossiers[issue.id]
  assert.ok(dossier?.conclusion?.trim());assert.ok(dossier?.recommendation?.trim())
  if(!issue.history){assert.ok(dossier.snapshots.length>0);for(const snap of dossier.snapshots)assert.ok(snap.name&&snap.value&&snap.reference&&snap.meaning&&snap.source)}
  else assert.ok(dossier.steps.length>0,'historical decisions retain their actual facts without fabricated sensor readings')
 }
})
test('alarm keeps its snapshot; warning combines evidence; health preserves a long record; maintenance keeps plan',()=>{
 assert.equal(dossiers.fault.series.length,2,'alarm compares the two actual loaded time points without filling a continuous trace')
 assert.ok(dossiers['main-warning'].series.length>=2)
 assert.deepEqual(dossiers['main-warning'].series[0].labels,dossiers['main-warning'].series[2].labels)
 assert.equal(dossiers['aux-health'].series[0].values.join(','),'404,406,409')
 assert.ok(dossiers.maintenance.plan.some(row=>row.label==='原周期计划'&&row.status==='保持有效'))
 assert.equal(workflowCases['aux-health'].trackingOnly,true)
})
test('all observation nodes state a scope and remain aligned with their samples',()=>{
 for(const dossier of Object.values(dossiers))for(const series of dossier.series){assert.equal(series.labels.length,series.values.length);assert.ok(series.scope.trim())}
 assert.deepEqual(dossiers['main-warning'].series[0].values,[.31,.27,.24])
 assert.deepEqual(dossiers['main-warning'].series[1].values,[.34,.32,.31])
 assert.deepEqual(dossiers.maintenance.series[0].values,[2.1,2.5,3])
})
