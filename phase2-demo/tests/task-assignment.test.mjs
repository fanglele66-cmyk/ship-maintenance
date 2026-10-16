import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('decision to task preserves assignment, feedback actor and history without duplicate tasks',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {deviceHistory}=await server.ssrLoadModule('/src/mock/phase2History.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore();store.createTodo('fault')
  assert.equal(store.ignoreSuggestion('aux-health','已安排本班巡检复测，暂不追加检查'),true)
  assert.equal(store.todoCreated['aux-health'],false)
  assert.ok(deviceHistory(store).some(row=>row.id==='decision-aux-health'))
  assert.equal(store.createTodo('aux-health'),true)
  assert.equal(store.ignoredSuggestions['aux-health'],undefined)
  assert.equal(store.createTodo('aux-health'),false)
  const assignment={owner:'李建国（大管轮）',collaborator:'赵明（三管轮）',type:'现场核实',due:'本班次',scope:'核实排温、工况和现场现象'}
  assert.equal(store.assignTask('aux-health',assignment),true)
  assert.equal(store.assignmentRecords['aux-health'].length,1)
  assert.equal(store.taskActors['aux-health'],assignment.owner)
  assert.equal(store.visibleTodos.filter(t=>t.id==='aux-health').length,1)
  store.progress['aux-health']=1;store.activeStage['aux-health']=1
  store.taskActors['aux-health']='赵明（三管轮）'
  const result=store.advanceTodo('aux-health',store.cases['aux-health'].stages[1].tasks.map((task,i)=>({label:task.label,result:i?'信息已记录':'现场与系统一致',note:i?'相同工况轻微异响可复现':'现场读数与系统一致，已记录本机负荷与转速'})))
  assert.equal(result.saved,true)
  assert.equal(store.logs['aux-health'].findLast(row=>row.kind==='feedbackRecord').actor,'赵明（三管轮）')
  assert.ok(deviceHistory(store).some(row=>row.id==='assignment-aux-health-0'))
  assert.equal(store.assignments['aux-health'].owner,assignment.owner,'owner stays at task level')
  const {fleetAssessment,todoAssessment}=await server.ssrLoadModule('/src/mock/captainAssessments.js')
  assert.match(fleetAssessment(store).conclusion,/优先核实/)
  assert.match(todoAssessment(store),/2 项任务/)
  store.progress.fault=store.observationIndex('fault')
  assert.match(fleetAssessment(store).conclusion,/验证处置效果/)
  assert.doesNotMatch(todoAssessment(store),/优先推进冷却系统任务/)
  assert.ok(!store.visibleTodos.some(t=>t.id==='aux-oil'))
  assert.equal(store.todoCreated['air-delivery'],false)
  assert.ok(!store.visibleTodos.some(t=>t.id==='steering-heat'))
  const {todoBrief}=await server.ssrLoadModule('/src/mock/captainAssessments.js')
  assert.match(todoBrief(store).bottleneck,/已取得部分反馈/)
  store.resetDemo();store.createTodo('fault')
  assert.deepEqual({...store.assignmentRecords},{})
  assert.equal(store.todoCreated['aux-health'],false)
 }finally{await server.close()}
})
