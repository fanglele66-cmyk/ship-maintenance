import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('a visible independent pending example supports decision, task feedback and observation',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 let store
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useMaintenanceAdviceStore}=await server.ssrLoadModule('/src/stores/maintenanceAdviceStore.js')
  const {workbenchIssues,filterIssueRows}=await server.ssrLoadModule('/src/mock/captainWorkbench.js')
  const {situationDeviceIds}=await server.ssrLoadModule('/src/mock/situationScope.js')
  const {trackingDossier}=await server.ssrLoadModule('/src/mock/trackingDossier.js')
  const {scenarioSensors}=await server.ssrLoadModule('/src/mock/phase2Content.js')
  const {issueContext}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  setActivePinia(createPinia());store=usePhase2DemoStore()
  const advice=useMaintenanceAdviceStore();advice.enableExample()
  const id='cyl5-drift'
  const rows=filterIssueRows(workbenchIssues(store).filter(r=>situationDeviceIds.includes(r.deviceId)),{state:'待决策',type:'异动跟踪'})
  assert.ok(rows.some(r=>r.id===id),'pending tracking remains visible after the maintenance fixture is enabled')
  assert.equal(store.todoCreated[id],false);assert.equal(store.todoCreated.drift,true)
  assert.equal(store.logs[id].filter(r=>r.kind==='feedbackRecord').length,0)
  const initial=trackingDossier(store,id)
  assert.equal(initial.required,true);assert.deepEqual(initial.charts[0].values,[3,6,9,12])
  assert.ok(issueContext(id,store));assert.equal(scenarioSensors(id).length,2)
  assert.equal(store.createTodo(id),true);assert.equal(store.createTodo(id),false)
  assert.equal(store.assignTask(id,{...store.defaultAssignment(id),owner:'王海涛（二管轮）',type:'现场核实',scope:initial.scope,due:'本班次核实（演示）'}),true)
  store.selectTodo(id);store.advanceTodo(id)
  assert.equal(store.cases[id].stages[store.progress[id]].id,'check')
  let stage=store.cases[id].stages[store.progress[id]]
  const unknown=stage.tasks.map(task=>({label:task.label,result:'无法确认',note:'演示：暂不具备核实条件'}))
  assert.equal(store.advanceTodo(id,unknown).advanced,false)
  const d=trackingDossier(store,id)
  assert.equal(d.required,false);assert.equal(d.assigned,true);assert.equal(d.ended,false)
  assert.ok(d.records.some(r=>r.type==='feedback'&&r.text.includes('无法确认')))
  assert.deepEqual(d.charts[0].values,initial.charts[0].values)
  const verified=stage.tasks.map((task,i)=>({label:task.label,result:i===0?'现场与系统一致':'现场异常可复现',note:'演示核实，后续原因尚待检查'}))
  assert.equal(store.advanceTodo(id,verified).advanced,true)
  assert.equal(store.cases[id].stages[store.progress[id]].id,'investigate')
  stage=store.cases[id].stages[store.progress[id]]
  assert.equal(store.advanceTodo(id,stage.tasks.map((task,i)=>({label:task.label,result:i===0?'发现异常':'未见异常',note:'已核对演示取证及确认范围'}))).advanced,true)
  assert.equal(store.cases[id].stages[store.progress[id]].kind,'work')
  const inquiry=store.requestExecutionRecord(id)
  const values={...inquiry.values,task0:'已完成',task1:'已完成',equipment:'主机5号缸（演示）',executor:'王海涛（二管轮）',measures:'按已确认范围清洁并复装（演示）',executedAt:new Date(Date.now()-86400000).toISOString().slice(0,16),acceptance:'同工况复测相对差4°C，无新增异常（演示）',completion:'completed',verification:'resolved',comparable:'available'}
  assert.equal(store.confirmExecutionRecord(id,inquiry.id,values),true)
  const after=trackingDossier(store,id)
  assert.ok(after.records.some(r=>r.type==='execution'))
  assert.equal(after.charts[0].key,'gap');assert.deepEqual(after.charts[0].values,[3,6,9,12])
  assert.ok(after.charts.some(r=>r.key==='effect-0'))
  store.reviewObservation(id)
  assert.equal(trackingDossier(store,id).ended,true)
  assert.equal(store.visibleTodos.filter(r=>r.id===id).length,1)
  assert.ok(store.logs.drift.some(r=>r.id==='injector-demo-evidence'),'the maintenance case is preserved')
 }finally{store?.resetDemo();store?.$dispose();await server.close()}
})
