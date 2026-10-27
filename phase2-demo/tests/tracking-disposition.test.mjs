import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('captain closes or continues a verified tracking event independently of maintenance execution',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {eventDirectoryRows}=await server.ssrLoadModule('/src/mock/eventDirectory.js')
  const {storyDossier}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {issueReply}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {executionPreset}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {taskObservationData,taskObservationWindow}=await server.ssrLoadModule('/src/mock/taskObservationData.js')
  const id='real-tracking-exhaust-baseline',child='real-maintenance-c1-baseline'
  const future=new Date(Date.now()+86400000).toISOString().slice(0,16),past='2026-01-01T10:00'
  const fresh=()=>{setActivePinia(createPinia());return usePhase2DemoStore()}
  const state=(store,key=id)=>eventDirectoryRows(store).find(row=>row.id===key)
  function verify(){
   const store=fresh();assert.equal(store.createTodo(id),true);store.assignTask(id,store.defaultAssignment(id));store.selectTodo(id);store.advanceTodo(id)
   store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'信息已记录':'现场与系统一致',note:'原始核实记录'})))
   assert.equal(store.decideCheck(id,'finish-tracking','核实反馈已提交，变化解释由轮机长确认'),true)
   return store
  }
  await t.test('verification ends its task and presents a captain decision, not automatic closure',()=>{
   const store=fresh();assert.equal(store.decideTracking(id,'explained',{reason:'未经核实'}).ok,false)
   const verified=verify();assert.equal(verified.eventStatus[id],'awaiting-decision');assert.equal(state(verified).eventState,'处置中');assert.equal(state(verified).processingState,'待轮机长确认');assert.equal(verified.activeTaskPortfolio.length,0)
   assert.match(issueReply(id,'下一步',verified).markdown,/轮机长确认/)
  })
  await t.test('explained change requires a signed basis and closes without erasing the health source',()=>{
   const store=verify();assert.equal(store.decideTracking(id,'explained',{}).ok,false)
   assert.equal(store.decideTracking(id,'explained',{reason:'已对齐负荷与调整日期，变化由已记录的热平衡调整解释。'}).ok,true)
   assert.equal(state(store).eventState,'已闭环');assert.equal(store.todoCreated[child],false)
   assert.ok(store.healthUpdates[id+'-track'].feedback.length)
   assert.match(storyDossier(store,id).overviewSummary,/解释.*确认.*闭环/)
   assert.equal(storyDossier(store,id).timeline.filter(e=>e.kind==='closure').length,1)
   assert.equal(store.decideTracking(id,'explained',{reason:'重复'}).ok,false)
   assert.equal(store.decideTracking(id,'observe',{}).ok,false)
  })
  for(const root of [id,'real-health-c4-baseline'])await t.test(root+' closes on confirmed arrangement while maintenance remains executable',()=>{
   const store=root===id?verify():fresh(),taskId=root===id?child:'real-maintenance-c4-baseline'
   assert.equal(store.confirmTrackingMaintenance(root,{}).ok,false)
   assert.equal(store.decideTracking(root,'maintenance',{reason:'独立校验与燃烧分配仍需专项核实',scope:'测温链路校验、六缸燃烧平衡检查；检查支持并获批后实施维护'}).ok,true)
   assert.equal(state(store,root).eventState,'处置中');assert.equal(store.todoCreated[taskId],false)
   assert.equal(store.confirmTrackingMaintenance(root,{owner:'李建国（大管轮）'}).ok,false)
   assert.equal(store.confirmTrackingMaintenance(root,{owner:'李建国（大管轮）',due:'下次靠港窗口',scope:'批准范围的测温校验和燃烧平衡检查',conditions:'核对校验仪与备料，靠港完成许可和停机隔离后执行'}).ok,true)
   assert.equal(state(store,root).eventState,'已闭环');assert.ok(store.activeTaskPortfolio.some(t=>t.id===taskId));assert.equal(store.eventStatus[taskId],'assigned');assert.equal(store.executionRecords[taskId],undefined)
   assert.equal(store.confirmTrackingMaintenance(root,{}).ok,false);assert.equal(store.assignmentRecords[taskId].length,1)
   store.selectTodo(taskId);store.advanceTodo(taskId)
   store.advanceTodo(taskId,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'条件具备':'有提前处理依据',note:'获批范围与条件核对完成'})))
   assert.equal(store.currentStage.kind,'work')
   if(root===id)assert.doesNotMatch(JSON.stringify(store.cases[taskId].workDetails),/四缸/)
   const form=store.executionInquiry(taskId),values={...form.values,...executionPreset(store.cases[taskId],store.currentStage,'complete')}
   assert.equal(store.confirmExecutionRecord(taskId,form.id,values),true)
   assert.equal(state(store,root).eventState,'已闭环','maintenance updates cannot reopen the source event')
   assert.ok(storyDossier(store,root).timeline.some(e=>e.taskId===taskId&&e.kind==='execution'))
  })
  await t.test('observation requires a deadline, metrics, criteria and owner, then returns to the three choices',()=>{
   const store=verify(),plan={deadline:future,metrics:'一缸相对偏差、负荷、独立校验',criteria:'补齐同负荷记录与校验，偏差继续扩大时安排专项检查',owner:'王海涛（二管轮）'}
   for(const key of Object.keys(plan))assert.equal(store.decideTracking(id,'observe',{...plan,[key]:''}).ok,false,key)
   assert.equal(store.decideTracking(id,'observe',{...plan,deadline:past}).ok,false)
   assert.equal(store.decideTracking(id,'observe',plan).ok,true)
   assert.equal(state(store).processingState,'专项观察中');assert.deepEqual(store.activeTaskPortfolio.map(task=>task.id),['real-observation-c1-baseline'])
   assert.ok(state(store).taskIds.includes('real-observation-c1-baseline'))
   assert.equal(store.assignments['real-observation-c1-baseline'].owner,plan.owner)
   assert.equal(store.decideTracking(id,'explained',{reason:'跳过观察'}).ok,false)
   assert.equal(store.submitTrackingObservation(id,{findings:'无日期'}).ok,false)
   assert.equal(store.submitTrackingObservation(id,{observedAt:future,findings:'未来'}).ok,false)
   assert.equal(store.submitTrackingObservation(id,{observedAt:past,findings:'同工况对比已记录，独立校验资料尚缺。'}).ok,true)
   assert.equal(state(store).processingState,'待轮机长确认');assert.equal(store.trackingDispositions[id].observationHistory.length,1)
   assert.equal(store.submitTrackingObservation(id,{observedAt:past,findings:'重复提交'}).ok,false)
   assert.equal(store.decideTracking(id,'observe',{...plan,criteria:'取得独立校验后判断'}).ok,true)
   assert.equal(store.trackingDispositions[id].observationHistory.length,1)
   assert.equal(store.workflowRounds['real-observation-c1-baseline'],2)
   assert.equal(store.isTaskHandled('real-observation-c1-baseline'),false)
   assert.deepEqual({...store.trackingObservationDrafts['real-observation-c1-baseline']},{observedAt:'',findings:''})
   store.submitTrackingObservation(id,{observedAt:past,findings:'独立校验及工况记录已补齐。'})
   assert.equal(store.decideTracking(id,'explained',{reason:'负荷变化与调整记录能够解释基线变化'}).ok,true)
   assert.equal(state(store).eventState,'已闭环');assert.equal(store.trackingDispositions[id].observationHistory.length,2)
   store.resetDemo();assert.deepEqual(Object.keys(store.trackingDispositions),['real-health-c4-baseline'])
   assert.equal(store.trackingDispositions['real-health-c4-baseline'].status,'review')
   assert.equal(store.trackingDispositions['real-health-c4-baseline'].priorProcessId,'real-health-c4-baseline:prior-process')
   assert.equal(store.eventStatus['real-health-c4-baseline'],'awaiting-decision')
  })
  await t.test('C4 observation dispatch remains linked to one event and retains source measurements',()=>{
   const store=fresh(),root='real-health-c4-baseline',task='real-observation-c4-baseline'
   assert.equal(store.decideTracking(root,'observe',{deadline:future,metrics:'四缸相对偏差',criteria:'补充独立测温及同工况记录',owner:'王海涛（二管轮）'}).ok,true)
   assert.ok(store.activeTaskPortfolio.some(item=>item.id===task))
   assert.equal(eventDirectoryRows(store).filter(row=>row.id===task).length,0)
   const data=taskObservationData(task)
   assert.ok(data.sensors.length);assert.equal(data.end,taskObservationData(root).end)
   assert.equal(store.submitTrackingObservation(root,{observedAt:past,findings:'新增C4观察原文'}).ok,true)
   assert.ok(!store.activeTaskPortfolio.some(item=>item.id===task))
   assert.equal(storyDossier(store,root).timeline.filter(row=>row.text.includes('新增C4观察原文')).length,1)
  })
  await t.test('a completed maintenance assessment can be followed by a newly approved execution round',()=>{
   const store=fresh(),root='real-health-c4-baseline',taskId='real-maintenance-c4-baseline'
   store.createTodo(taskId);store.selectTodo(taskId);store.advanceTodo(taskId)
   store.advanceTodo(taskId,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'条件暂不具备':'有提前处理依据',note:'已登记缺少的校验设备与窗口'})))
   assert.equal(store.decideCheck(taskId,'end-maintenance','评估任务结束，维保需求与条件缺口保留'),true)
   assert.equal(store.decideTracking(root,'maintenance',{reason:'评估支持提前检查，已落实后续安排',scope:'四缸测温与燃烧平衡检查'}).ok,true)
   assert.equal(store.confirmTrackingMaintenance(root,{owner:'王海涛（二管轮）',due:'靠港落实窗口后实施',scope:'先校验测温再按依据检查燃烧分配',conditions:'协调校验设备，作业前完成许可与隔离'}).ok,true)
   assert.equal(state(store,root).eventState,'已闭环');assert.equal(store.workflowRounds[taskId],2);assert.ok(store.activeTaskPortfolio.some(t=>t.id===taskId))
   assert.ok(storyDossier(store,root).timeline.some(e=>e.text==='评估任务结束，维保需求与条件缺口保留'))
  })
  await t.test('the new C1 maintenance task uses its own source readings for every time range',()=>{
   const data=taskObservationData(child),original=taskObservationData(id)
   assert.equal(data.dataRole,'baseline-source-history');assert.equal(data.end,original.end)
   assert.match(data.sensors[0].nameCn,/1缸/)
   const counts=[1,6,24].map(hours=>taskObservationWindow(data.sensors,data.end,hours).series[0].count)
   assert.ok(counts[0]>0&&counts[1]>counts[0]&&counts[2]>counts[1])
   assert.deepEqual(data.sensors[0].trendData,original.sensors[0].trendData)
  })
 }finally{await server.close()}
})
