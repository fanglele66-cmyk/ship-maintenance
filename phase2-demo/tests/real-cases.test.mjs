import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('real incidents replace situation examples and support every preset branch',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {realCaseRecords,realSeries}=await server.ssrLoadModule('/src/mock/realCaseAdapter.js')
  const {activeWorkbenchIssues}=await server.ssrLoadModule('/src/mock/captainWorkbench.js')
  const {storyTimeline}=await server.ssrLoadModule('/src/mock/storyRecords.js')
  const {assessWorkflow}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {feedbackPresets,executionPreset,executionPresetOptions,decisionPreset}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {useEventWorkOrderStore}=await server.ssrLoadModule('/src/stores/eventWorkOrderStore.js')
  const fresh=()=>{setActivePinia(createPinia());return usePhase2DemoStore()}
  const ids=realCaseRecords.map(c=>c.id),alarm='real-alarm-0430',warning='real-warning-0523',tracking='real-tracking-0816',maintenance='real-maintenance-0523'
  const start=(store,id)=>{assert.equal(store.createTodo(id),true);store.selectTodo(id);store.advanceTodo(id)}
  const feedback=(store,id,values)=>store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'【预设演示】测试该处理分支',attachments:[]}))
  const toWork=(store,id)=>{
   start(store,id)
   if(id===warning){store.advanceTodo(id,feedback(store,id,['现场与系统一致','工况可比，偏离仍存在']));store.advanceTodo(id)}
   store.advanceTodo(id,feedback(store,id,id===maintenance?['有提前处理依据','条件具备']:['发现异常','未见异常']))
   assert.equal(store.currentStage.kind,'work')
  }
  const execute=(store,id,key)=>{
   const form=store.executionInquiry(id),preset=executionPreset(store.cases[id],store.currentStage,key)
   const values={...form.values,...preset,scenarioPreset:key}
   store.updateExecutionRecord(id,form.id,values)
   // InquiryMessage serializes declared fields only; preset metadata stays in the store draft.
   const submitted=Object.fromEntries(form.fields.map(field=>[field.key,values[field.key]]))
   store.updateExecutionRecord(id,form.id,submitted)
   assert.equal(store.confirmExecutionRecord(id,form.id,submitted),true,form.submitError)
  }
  await t.test('only four active initial matters; source measurements and cutoff remain intact',()=>{
   const store=fresh();assert.deepEqual(activeWorkbenchIssues(store).map(r=>r.id),ids.map(id=>id===maintenance?'real-health-0523':id))
   for(const record of realCaseRecords){
    const item=store.cases[record.id];assert.equal(store.todoCreated[item.id],false);assert.equal(store.eventStatus[item.id],'pending');assert.equal(store.executionRecords[item.id],undefined)
    assert.equal(item.report.basis,record.steps[0].summary)
    assert.doesNotMatch(JSON.stringify([item.source,item.report,item.pageContent,item.stages,item.observation.basis]),/演示|改编|回放/)
    for(const series of item.series)if(item.realEvidenceCutoff)assert.ok(series.labels.every(time=>time.replace('T',' ')<=item.realEvidenceCutoff))
    for(const [i,series] of realSeries(record).entries()){assert.deepEqual(series.values,record.series[i].points.map(p=>p.value));assert.deepEqual(series.labels,record.series[i].points.map(p=>p.time))}
   }
   assert.doesNotMatch(store.cases[alarm].report.conclusion,/严重卡阻|更换ICU并测试正常/)
   assert.equal(storyTimeline(store,tracking+'-track').length,1)
   assert.equal(store.createTodo('fault'),false)
  })
  for(const id of ids)await t.test(id+' exposes and respects all check-result combinations',()=>{
   const store=fresh(),item=store.cases[id]
   for(const stage of item.stages.filter(s=>s.kind==='check')){
    const presets=feedbackPresets(item,stage);assert.equal(presets.length,9)
    for(const preset of presets){
     const result=assessWorkflow(id,stage,preset.records),values=preset.records.map(r=>r.result)
     assert.equal(result.valid,true);assert.ok(preset.records.every(r=>r.note.length>0&&!/演示|改编|预设|undefined/.test(r.note)))
     if(stage.id==='investigate'){
      assert.equal(result.advance,values.includes('发现异常'))
      assert.deepEqual(result.packages,stage.tasks.filter((_,i)=>values[i]==='发现异常').map(t=>t.package))
      assert.equal(result.unknown.length,values.filter(v=>v==='无法确认').length)
     }else if(id===warning)assert.equal(result.advance,values[0]==='现场与系统一致'&&values[1]==='工况可比，偏离仍存在')
     else if(id===maintenance)assert.equal(result.advance,values[0]==='有提前处理依据'&&values[1]==='条件具备')
     else {assert.equal(result.advance,false);assert.ok(result.actions.includes('finish-tracking'))}
    }
   }
  })
  await t.test('alarm scope follows either, both or neither investigation directions',()=>{
   for(const values of [['发现异常','未见异常'],['未见异常','发现异常'],['发现异常','发现异常'],['无法确认','未见异常']]){
    const store=fresh();start(store,alarm);const result=store.advanceTodo(alarm,feedback(store,alarm,values))
    assert.equal(result.advanced,values.includes('发现异常'))
    if(result.advanced){assert.equal(store.currentStage.tasks.length,values.filter(v=>v==='发现异常').length*2);assert.doesNotMatch(store.currentStage.title,/温控阀|冷却滤器/)}
    else {assert.equal(store.currentStage.id,'investigate');assert.equal(store.decideCheck(alarm,'supplement','预设新线索待核实'),true);assert.equal(store.decideCheck(alarm,'retry'),true)}
   }
  })
  for(const id of [alarm,warning,maintenance])for(const {id:key} of executionPresetOptions)await t.test(id+' execution '+key,()=>{
   const store=fresh();toWork(store,id);execute(store,id,key)
   assert.equal(store.executionRecords[id][0].isSimulation,true)
   if(['partial','pending'].includes(key)){assert.equal(store.currentStage.kind,'work');assert.equal(store.isTaskHandled(id),false)}
   else if(key==='unresolved'){assert.equal(store.currentStage.id,id===maintenance?'check':'investigate');assert.equal(store.workflowRounds[id],2)}
   else{assert.equal(store.eventStatus[id],'observing');assert.equal(store.executionObservationReady(id),key==='complete');assert.equal(store.observationRecords[id].length,0)}
  })
  for(const id of [alarm,warning,maintenance])await t.test(id+' observation continues, extends, reopens and closes only on confirmation',()=>{
   const store=fresh();toWork(store,id);execute(store,id,'missing')
   assert.equal(store.applyObservationPreset(id,'continue'),true);assert.equal(store.getObservationResult(id).type,'continue');store.completeObservation(id);assert.equal(store.eventStatus[id],'observing')
   store.applyObservationPreset(id,'incomplete');assert.equal(store.getObservationResult(id).type,'extend')
   const target=store.observationTargets[id];store.extendObservation(id);assert.equal(store.observationTargets[id],target+1)
   store.applyObservationPreset(id,'abnormal');assert.equal(store.getObservationResult(id).type,'reinspect')
   store.reopenTodo(id);assert.equal(store.observationHistory[id].length,1);assert.equal(store.observationRecords[id].length,0)
   assert.equal(store.currentStage.id,id===maintenance?'check':'investigate')
   store.advanceTodo(id,feedback(store,id,id===maintenance?['有提前处理依据','条件具备']:['发现异常','未见异常']));execute(store,id,'complete')
   store.applyObservationPreset(id,'stable');assert.equal(store.getObservationResult(id).type,'archive');assert.equal(store.eventStatus[id],'observing')
   assert.ok(store.observationRecords[id].every(r=>r.isSimulation&&r.preset&&r.source==='处理后观察记录'))
   store.completeObservation(id);assert.equal(store.eventStatus[id],'closed');assert.equal(store.applyObservationPreset(id,'abnormal'),false)
  })
  await t.test('manual arbitrary values cannot masquerade as stable recovery',()=>{
   const store=fresh();toWork(store,warning);execute(store,warning,'missing')
   assert.equal(store.supplementObservation(warning,{day:1,value0:0.1,value1:0.1,conditions:'演示补录工况',note:'低压输入'}),true)
   assert.equal(store.getObservationResult(warning).type,'continue');store.completeObservation(warning);assert.equal(store.eventStatus[warning],'observing')
  })
  for(const [id,values,action] of [[warning,['现场与系统一致','工况变化可以解释'],'end-warning'],[tracking,['现场与系统一致','条件受限，已记录限制'],'finish-tracking'],[maintenance,['有提前处理依据','条件暂不具备'],'end-maintenance'],[maintenance,['暂无提前处理必要','条件具备'],'end-maintenance']])await t.test(id+' can finish verification without inventing repairs: '+values.join('/'),()=>{
   const store=fresh();start(store,id);assert.equal(store.advanceTodo(id,feedback(store,id,values)).advanced,false)
   assert.equal(store.decideCheck(id,action,''),false);assert.equal(store.decideCheck(id,action,'【演示】保留原资料和未完成事项'),true)
   assert.equal(store.eventStatus[id],'closed');assert.equal(store.executionRecords[id],undefined)
   if(id===tracking)assert.equal(store.healthUpdates[id+'-track'].taskComplete,true)
  })
  await t.test('false-alarm and ignore presets preserve sources and allow fresh decisions after reset',()=>{
   const store=fresh(),source=JSON.stringify(realCaseRecords)
   assert.equal(store.confirmFalseAlarm(alarm,decisionPreset(store.cases[alarm],'false-alarm')),true)
   assert.equal(store.eventStatus[alarm],'closed');assert.equal(store.todoCreated[alarm],false)
   store.resetRealScenario(alarm);assert.equal(store.eventStatus[alarm],'pending');assert.equal(store.createTodo(alarm),true)
   for(const id of [warning,tracking,maintenance]){assert.equal(store.ignoreSuggestion(id,decisionPreset(store.cases[id],'ignore')),true);assert.equal(activeWorkbenchIssues(store).some(row=>row.id===id),false);store.resetRealScenario(id);assert.equal(store.createTodo(id),true)}
   assert.equal(JSON.stringify(realCaseRecords),source)
  })
  await t.test('reset clears only current case including work-order association',async()=>{
   const store=fresh();start(store,maintenance);const links=useEventWorkOrderStore();await links.load(maintenance);assert.equal(links.confirm(maintenance),true)
   assert.match(links.state(maintenance).linked.title,/减压阀/)
   start(store,tracking);store.taskNotes[tracking+':check:0']='keep my note'
   store.resetRealScenario(maintenance);assert.equal(links.events[maintenance],undefined)
   assert.equal(store.taskNotes[tracking+':check:0'],'keep my note');assert.equal(store.todoCreated[tracking],true)
   assert.equal(store.todoCreated[maintenance],false);assert.equal(store.eventStatus[maintenance],'pending')
   assert.equal(store.storyJournal.some(r=>r.taskId===maintenance),false)
   assert.equal(store.logs[maintenance].length,0)
   store.createTodo(maintenance);store.assignTask(maintenance,{...store.assignments[maintenance]})
   assert.equal(new Set(store.storyJournal.map(row=>row.id)).size,store.storyJournal.length)
  })
 }finally{await server.close()}
})
