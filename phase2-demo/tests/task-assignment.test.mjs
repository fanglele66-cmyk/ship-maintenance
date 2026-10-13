import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('decision to task preserves assignment, feedback actor and history without duplicate tasks',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {deviceHistory}=await server.ssrLoadModule('/src/mock/phase2History.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault')
  assert.equal(store.ignoreSuggestion('drift','已安排本班巡检复测，暂不追加检查'),true)
  assert.equal(store.todoCreated.drift,false)
  assert.ok(deviceHistory(store).some(row=>row.id==='decision-drift'))
  assert.equal(store.createTodo('drift'),true)
  assert.equal(store.ignoredSuggestions.drift,undefined)
  assert.equal(store.createTodo('drift'),false)
  const assignment={owner:'李建国（大管轮）',collaborator:'赵明（三管轮）',type:'现场核实',due:'本班次',scope:'核实排温、工况和现场现象'}
  assert.equal(store.assignTask('drift',assignment),true)
  assert.equal(store.assignmentRecords.drift.length,1)
  assert.equal(store.taskActors.drift,assignment.owner)
  assert.equal(store.visibleTodos.filter(t=>t.id==='drift').length,1)
  store.progress.drift=1;store.activeStage.drift=1
  store.taskActors.drift='赵明（三管轮）'
  const result=store.advanceTodo('drift',store.cases.drift.stages[1].tasks.map((task,i)=>({label:task.label,result:i?'异响可复现':'现场与系统一致',note:i?'相同工况轻微异响可复现':'现场432°C，450 rpm，负荷70%'})))
  assert.equal(result.saved,true)
  assert.equal(store.logs.drift.findLast(row=>row.kind==='feedbackRecord').actor,'赵明（三管轮）')
  assert.ok(deviceHistory(store).some(row=>row.id==='assignment-drift-0'))
  assert.equal(store.assignStage('drift',3,'王海涛（二管轮）'),true)
  assert.equal(store.stageAssignments.drift[store.cases.drift.stages[3].id].owner,'王海涛（二管轮）')
  store.assignStage('drift',4,'李建国（大管轮）')
  assert.equal(store.stageAssignments.drift[store.cases.drift.stages[3].id].owner,'王海涛（二管轮）')
  const {fleetAssessment,todoAssessment}=await server.ssrLoadModule('/src/mock/captainAssessments.js')
  assert.match(fleetAssessment(store).conclusion,/优先核实/)
  assert.match(todoAssessment(store),/3 项任务/)
  store.progress.fault=store.observationIndex('fault')
  assert.match(fleetAssessment(store).conclusion,/验证处置效果/)
  assert.doesNotMatch(todoAssessment(store),/优先推进冷却系统任务/)
  assert.ok(!store.visibleTodos.some(t=>t.id==='aux-oil'))
  assert.equal(store.todoCreated['air-delivery'],false)
  assert.ok(store.visibleTodos.some(t=>t.id==='steering-heat'))
  const {todoBrief}=await server.ssrLoadModule('/src/mock/captainAssessments.js')
  assert.match(todoBrief(store).bottleneck,/现场反馈/)
  store.resetDemo();store.createTodo('fault')
  assert.deepEqual({...store.assignmentRecords},{})
  assert.equal(store.todoCreated.drift,false)
 }finally{await server.close()}
})
