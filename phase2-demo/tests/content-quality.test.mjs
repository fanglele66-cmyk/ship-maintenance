import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {workflowCases,workflowIssues,healthTracks} from '../src/mock/fourStoryWorkflow.js'

test('warning uses matching upstream/downstream measurements and labels derived evidence',()=>{
 const item=workflowCases['main-warning']
 const [down,up,delta]=item.series
 assert.deepEqual(down.labels,up.labels)
 for(let i=0;i<down.values.length;i++)assert.ok(Math.abs(up.values[i]-down.values[i]-delta.values[i])<1e-9)
 assert.match(delta.scope,/计算|共享/)
 assert.doesNotMatch(item.report.basis,/67.?69|排温/)
 assert.equal(workflowIssues.some(i=>i.id==='cyl3-warning'),false)
 assert.equal(healthTracks.find(i=>i.id==='main-cyl3-candidate').requestId,undefined)
})

test('auxiliary maintenance keeps the original measurand without inherited bearing content',()=>{
 const item=workflowCases['aux-maintenance']
 assert.equal(item.latent,true)
 assert.doesNotMatch(JSON.stringify(item),/原振动|轴承相关|间隙|轴瓦/)
 assert.deepEqual(item.observation.before,[412,400])
 assert.match(item.plan.map(row=>row.value).join(' '),/10月30日/)
 assert.match(item.pageContent.overview,/不预定更换/)
 assert.equal(workflowCases['aux-health'].series[0].values.join(','),'404,406,409')
})

test('submitted evidence changes issue, device and daily reports without inventing findings',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {storyDossier,deviceStoryAssessment}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {deviceHistory}=await server.ssrLoadModule('/src/mock/phase2History.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore()
  assert.doesNotMatch(storyDossier(store,'aux-health').overviewMarkdown,/现场确认410/)
  store.createTodo('aux-health');store.selectTodo('aux-health');store.advanceTodo('aux-health')
  const feedback=store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'信息已记录':'读数不一致',note:i?'运行背景记录有缺项':'现场409°C，平台420°C，时间未核清'}))
  assert.equal(store.advanceTodo('aux-health',feedback).saved,true)
  const updated=storyDossier(store,'aux-health')
  assert.match(updated.overviewMarkdown,/现场409°C，平台420°C/)
  assert.doesNotMatch(updated.overviewMarkdown,/现场核实一致|已确认喷油器/)
  assert.match(deviceStoryAssessment(store,'aux-engine-2').basis,/可信度|核对/)
  store.decideCheck('aux-health','finish-tracking','保存限制，本次人工核实结束，长期记录继续')
  store.advanceHealthTrack('aux2-health');store.advanceHealthTrack('aux2-health')
  assert.equal(store.unlockedRecommendations['aux-maintenance'],undefined)
  assert.match(deviceStoryAssessment(store,'aux-engine-2').conclusion,/可信度仍待核对/)
  assert.deepEqual(storyDossier(store,'aux-health').series[0].values,[404,406,409,409,412])
  const reviews=deviceHistory(store).filter(row=>row.type==='review')
  assert.equal(new Set(reviews.filter(row=>row.deviceId?.startsWith('aux-engine-')).map(row=>row.deviceId)).size,3)
  assert.deepEqual(reviews.filter(row=>row.deviceId==='aux-engine-2').map(row=>row.date).sort(),['2026-10-15','2026-10-18','2026-10-22'])
  assert.match(reviews.find(row=>row.deviceId==='aux-engine-3').conclusion,/备用|试运行/)
  assert.match(deviceStoryAssessment(store,'aux-engine-1').basis,/61%—64%/)
 }finally{await server.close()}
})

test('the accepted future maintenance node uses its record date without bypassing execution validation',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore()
  store.unlockedRecommendations['aux-maintenance']=true;store.createTodo('aux-maintenance');store.selectTodo('aux-maintenance');store.advanceTodo('aux-maintenance')
  const feedback=store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'条件具备':'有提前处理依据',note:'本次检查范围与条件已核对'}))
  store.advanceTodo('aux-maintenance',feedback)
  const form=store.executionInquiry('aux-maintenance')
  const values={equipment:'2号辅机3号缸',measures:'检查后按实际发现处理，保留检验与复查',task0:'已完成',task1:'已完成',executedAt:'2026-10-24T10:00',acceptance:'已补同工况复测',completion:'completed',verification:'resolved',comparable:'available'}
  assert.equal(store.confirmExecutionRecord('aux-maintenance',form.id,{...values,executedAt:'2099-01-01T10:00'}),false)
  assert.equal(store.confirmExecutionRecord('aux-maintenance',form.id,values),true)
  assert.equal(store.isTaskHandled('aux-maintenance'),true)
 }finally{await server.close()}
})
