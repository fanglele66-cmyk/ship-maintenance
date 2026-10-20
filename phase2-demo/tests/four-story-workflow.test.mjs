import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('four scenario journeys preserve evidence and route every valid outcome',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {workbenchIssues,activeWorkbenchIssues}=await server.ssrLoadModule('/src/mock/captainWorkbench.js')
  function fresh(id){setActivePinia(createPinia());const store=usePhase2DemoStore();if(id){store.unlockedRecommendations[id]=true;store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)}return store}
  function feedback(store,id,values){return store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'现场记录 '+i,attachments:['记录'+i+'.png']}))}
  function execute(store,id,overrides={}){const form=store.executionInquiry(id);return store.confirmExecutionRecord(id,form.id,{...Object.fromEntries(store.currentStage.tasks.map((_,i)=>['task'+i,'已完成'])),equipment:store.cases[id].device,measures:'按现场发现完成本轮处置',executedAt:'2026-10-14T10:00',acceptance:'已记录现场复测',completion:'completed',verification:'resolved',comparable:'available',...overrides})}
  await t.test('only the four current requests are active; historical decisions are retained',()=>{
   const store=fresh();assert.deepEqual(activeWorkbenchIssues(store).map(i=>i.type),['报警事件','预警事件','异动跟踪','异动跟踪']);assert.equal(store.visibleTodos.length,0)
   assert.equal(workbenchIssues(store).filter(i=>i.history&&i.state==='已闭环').length,1)
  })
  for(const values of [['发现异常','未见异常'],['未见异常','发现异常'],['发现异常','发现异常']])await t.test('cooling repair scope follows '+values.join('/'),()=>{
   const store=fresh('fault');const result=store.advanceTodo('fault',feedback(store,'fault',values));assert.equal(result.advanced,true)
   const labels=store.currentStage.tasks.map(task=>task.label).join('；')
   assert.equal(labels.includes('滤器'),values[0]==='发现异常');assert.equal(labels.includes('温控阀'),values[1]==='发现异常')
   assert.equal(store.currentStage.tasks.length,values.filter(v=>v==='发现异常').length*2)
   assert.equal(store.cases.fault.workDetails.acceptance.length,store.currentStage.tasks.length)
   assert.deepEqual(store.stageHistory.fault[0].records.map(r=>r.result),values)
  })
  await t.test('no finding and unknown save feedback with an explicit continuation instead of a false repair',()=>{
   const store=fresh('fault');const result=store.advanceTodo('fault',feedback(store,'fault',['未见异常','无法确认']))
   assert.equal(result.saved,true);assert.equal(result.advanced,false);assert.ok(store.checkAssessments.fault.actions.includes('retry'));assert.equal(store.executionInquiry('fault'),null)
   assert.equal(store.decideCheck('fault','retry'),true);assert.equal(store.currentStage.id,'investigate')
  })
  await t.test('warning first verifies reality then proceeds to cause investigation',()=>{
   const store=fresh('main-warning');assert.equal(store.currentStage.id,'check')
   assert.equal(store.advanceTodo('main-warning',feedback(store,'main-warning',['现场与系统一致','工况可比，偏离仍存在'])).advanced,true)
   assert.equal(store.currentStage.id,'event');assert.ok(store.currentStage.evidence[0].includes('现场与系统一致'))
   store.advanceTodo('main-warning');assert.equal(store.currentStage.id,'investigate')
   assert.equal(store.advanceTodo('main-warning',feedback(store,'main-warning',['未见异常','发现异常'])).advanced,true)
   assert.ok(store.currentStage.tasks[0].label.includes('供油'));assert.doesNotMatch(store.currentStage.title,/滤器|喷油器/)
  })
  await t.test('warning not established needs a human explanation and retains evidence',()=>{
   const store=fresh('main-warning');store.advanceTodo('main-warning',feedback(store,'main-warning',['读数不一致','工况变化可以解释']))
   assert.equal(store.decideCheck('main-warning','end-warning',''),false)
   assert.equal(store.decideCheck('main-warning','end-warning','已核对负荷切换与采集时间，原比较不可比'),true)
   assert.equal(store.isTaskHandled('main-warning'),true);assert.equal(store.caseMaterials['main-warning'],undefined)
   assert.equal(store.completedTasks['main-warning'].completedAtIndex,1)
   store.selectStage('main-warning',3);assert.notEqual(store.activeStage['main-warning'],3,'unvisited investigation cannot be opened as completed')
   assert.equal(activeWorkbenchIssues(store).some(i=>i.id==='main-warning'),false);assert.equal(store.stageHistory['main-warning'].length,2);assert.equal(store.stageHistory['main-warning'].at(-1).stageId,'decision')
  })
  await t.test('health verification completes a task while the same health record continues',()=>{
   const store=fresh('aux-health');store.advanceTodo('aux-health',feedback(store,'aux-health',['现场与系统一致','信息已记录']))
   assert.equal(store.decideCheck('aux-health','finish-tracking','读数与运行背景已补充，目前无立即维修依据'),true)
   assert.equal(store.healthUpdates['aux2-health'].taskComplete,true);assert.equal(store.advanceHealthTrack('aux2-health'),true)
   assert.equal(store.advanceHealthTrack('aux2-health'),true);assert.equal(store.advanceHealthTrack('aux2-health'),false);assert.equal(store.unlockedRecommendations['aux-maintenance'],true);assert.equal(store.executionInquiry('aux-health'),null)
   assert.equal(store.effectObservations.some(item=>item.id==='aux-health'),false)
  })
  await t.test('maintenance can end without advancing work or cancelling its plan',()=>{
   const store=fresh('maintenance');store.advanceTodo('maintenance',feedback(store,'maintenance',['暂无提前处理必要','条件暂不具备']))
   assert.equal(store.decideCheck('maintenance','end-maintenance','现场未取得提前依据，保留原2000 h计划'),true)
   assert.equal(store.executionRecords.maintenance,undefined);assert.equal(store.completedTasks.maintenance.action,'end-maintenance');assert.equal(store.executionObservationReady('maintenance'),false)
  })
  await t.test('unverified readings cannot generate early maintenance from later health samples',()=>{
   const store=fresh('aux-health');assert.equal(store.createTodo('aux-maintenance'),false)
   store.advanceTodo('aux-health',feedback(store,'aux-health',['读数不一致','信息已记录']))
   store.decideCheck('aux-health','finish-tracking','记录测量偏差，继续核对数据来源')
   store.advanceHealthTrack('aux2-health');store.advanceHealthTrack('aux2-health')
   assert.equal(store.unlockedRecommendations['aux-maintenance'],undefined)
   assert.equal(activeWorkbenchIssues(store).some(item=>item.id==='aux-maintenance'),false)
  })
  await t.test('accepted maintenance uses the standard execution record and observation, not a predetermined replacement',()=>{
   const store=fresh('maintenance');assert.equal(store.advanceTodo('maintenance',feedback(store,'maintenance',['有提前处理依据','条件具备'])).advanced,true)
   assert.equal(store.currentStage.id,'service');assert.equal(execute(store,'maintenance'),true)
   assert.equal(store.isTaskHandled('maintenance'),true);assert.notEqual(store.eventStatus.maintenance,'closed')
   store.selectObservation('maintenance');store.reviewObservation('maintenance');store.reviewObservation('maintenance');store.completeObservation('maintenance')
   assert.equal(store.eventStatus.maintenance,'closed');assert.ok(store.executionRecords.maintenance[0].values.measures)
  })
  await t.test('needed maintenance without conditions stays arranged with no forced answer',()=>{
   const store=fresh('maintenance');const result=store.advanceTodo('maintenance',feedback(store,'maintenance',['有提前处理依据','条件暂不具备']))
   assert.equal(result.saved,true);assert.equal(result.advanced,false);assert.equal(store.currentStage.id,'check');assert.match(result.message,/条件/)
  })
  await t.test('finished work with unresolved symptoms reopens the same task and preserves scope and feedback',()=>{
   const store=fresh('fault');store.advanceTodo('fault',feedback(store,'fault',['发现异常','发现异常']))
   assert.equal(execute(store,'fault',{verification:'unresolved',comparable:'missing'}),true)
   assert.equal(store.currentStage.id,'investigate');assert.equal(store.isTaskHandled('fault'),false);assert.equal(store.executionRecords.fault.length,1);assert.equal(store.workflowRounds.fault,2)
   store.advanceTodo('fault',feedback(store,'fault',['未见异常','发现异常']))
   assert.equal(store.currentStage.tasks.length,2);assert.equal(store.executionInquiry('fault').values.verification,undefined)
   assert.equal(store.executionRecords.fault[0].scope.length,4);assert.equal(store.visibleTodos.length,1)
  })
  await t.test('unfinished work and pending acceptance retain progress without pretending recovery',()=>{
   const store=fresh('fault');store.advanceTodo('fault',feedback(store,'fault',['发现异常','未见异常']))
   assert.equal(execute(store,'fault',{completion:'partial',task1:'待补充',verification:'pending'}),true);assert.equal(store.currentStage.kind,'work')
   assert.equal(execute(store,'fault',{verification:'pending'}),true);assert.equal(store.currentStage.kind,'work');assert.equal(store.executionObservationReady('fault'),false)
  })
  await t.test('missing comparable records do not fabricate improvement; stable records need explicit closure',()=>{
   const store=fresh('fault');store.advanceTodo('fault',feedback(store,'fault',['未见异常','发现异常']))
   execute(store,'fault',{comparable:'missing'});store.selectObservation('fault')
   assert.equal(store.observationRecords.fault.length,0);assert.equal(store.eventStatus.fault,'observing')
   assert.equal(store.supplementObservation('fault',{value0:79.1,value1:86.5,conditions:'同负荷，10月14日11:00',note:'现场已复测'}),true)
   store.reviewObservation('fault');assert.equal(store.getObservationResult('fault').type,'archive');assert.notEqual(store.eventStatus.fault,'closed')
   store.completeObservation('fault');assert.equal(store.eventStatus.fault,'closed');assert.equal(activeWorkbenchIssues(store).some(i=>i.id==='fault'),false)
  })
  await t.test('observation recurrence reopens the original event and retains earlier observations',()=>{
   const store=fresh('fault');store.advanceTodo('fault',feedback(store,'fault',['发现异常','未见异常']));execute(store,'fault');store.selectObservation('fault')
   store.recordObservationEvidence('fault','abnormal','相近负荷下再次温升');store.reopenTodo('fault')
   assert.equal(store.progress.fault,1);assert.equal(store.observationHistory.fault.length,1);assert.equal(store.visibleTodos.filter(t=>t.id==='fault').length,1)
  })
  await t.test('false alarm preserves the source and reset restores independent fixture copies',()=>{
   const store=fresh();assert.equal(store.confirmFalseAlarm('fault','现场核对采集链错误，原报警记录留存'),true)
   assert.equal(activeWorkbenchIssues(store).some(i=>i.id==='fault'),false);store.resetDemo();store.createTodo('fault');store.selectTodo('fault');store.advanceTodo('fault')
   assert.equal(store.currentStage.id,'investigate');assert.equal(store.cases.fault.stages.find(s=>s.kind==='work').tasks.length,0)
  })
 }finally{await server.close()}
})
