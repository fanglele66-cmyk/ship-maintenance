import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('repeat investigation uses distinct evidence-based instructions and retains round-one records',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {scenarioCases}=await server.ssrLoadModule('/src/mock/phase2Scenarios.js')
  const {workflowCases,composeRepair,stageReport}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {followupStage}=await server.ssrLoadModule('/src/mock/followupRounds.js')
  const {checkPreparation,guidedTask}=await server.ssrLoadModule('/src/mock/taskGuidance.js')
  const {executionPreset,feedbackPresets}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const cases=Object.values(scenarioCases).filter(item=>item.stages.some(stage=>stage.kind==='work'))
  await t.test('all repairable event templates have separate check, preparation, work and acceptance content',()=>{
   assert.ok(cases.length>=11)
   for(const item of cases){
    const check=item.stages.find(stage=>stage.id===(item.workflowKind==='maintenance'?'check':'investigate'))
    const work=item.stages.find(stage=>stage.kind==='work')
    assert.ok(check,item.id)
    const original=JSON.stringify(item),nextCheck=followupStage(item,check,2,{execution:{values:{measures:'前轮实际措施唯一原文',acceptance:'前轮验收唯一原文'}}})
    const nextWork=followupStage(item,work,2)
    assert.notEqual(JSON.stringify(check.tasks),JSON.stringify(nextCheck.tasks),item.id)
    assert.notDeepEqual(checkPreparation(item,check),checkPreparation(item,nextCheck),item.id)
    assert.notDeepEqual(work.tasks,nextWork.tasks,item.id)
    assert.ok(nextWork.workDetails.acceptanceRows.some(row=>/复发工况/.test(row.name)),item.id)
    assert.match(nextCheck.markdown,/前轮实际措施唯一原文/)
    for(const [index,task] of nextCheck.tasks.entries()){
     assert.equal(guidedTask(task),task,'specific follow-up instructions must not be overwritten by first-round guidance')
     assert.ok(task.checks.length>=2&&task.recordHint,item.id)
     assert.deepEqual(task.options,check.tasks[index].options)
     assert.equal(task.package,check.tasks[index].package)
     assert.equal(task.result,undefined)
    }
    assert.equal(JSON.stringify(item),original,'shared blueprint remains unchanged')
   }
  })
  for(const id of ['real-alarm-0430','real-warning-0523','real-maintenance-c1-baseline','real-maintenance-c4-baseline','fault','main-warning','maintenance','aux-maintenance'])await t.test(id+' starts a new round through failed acceptance, then executes the selected new scope',()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore(),item=store.cases[id]
   store.unlockedRecommendations[id]=true;store.createTodo(id)
   const checkIndex=item.stages.findIndex(stage=>stage.id===(item.workflowKind==='maintenance'?'check':'investigate'))
   store.progress[id]=checkIndex;store.selectTodo(id)
   const firstCheck=JSON.stringify(store.currentStage)
   const choices=()=>item.workflowKind==='maintenance'?['有提前处理依据','条件具备']:['发现异常','未见异常']
   const feedback=values=>store.currentStage.tasks.map((task,index)=>({label:task.label,result:values[index],note:'本轮实际检查依据'}))
   assert.equal(store.advanceTodo(id,feedback(choices())).advanced,true)
   const firstWork=JSON.stringify({...store.currentStage,workDetails:store.currentStage.workDetails||item.workDetails||{}}),firstId=store.currentStage.id
   const form=store.executionInquiry(id)
   assert.ok(store.confirmExecutionRecord(id,form.id,{executedAt:'2026-10-26T10:00',measures:'前轮实际措施原文',acceptance:'本轮验收仍异常原文',verification:'unresolved'}))
   assert.equal(store.workflowRounds[id],2)
   assert.equal(store.currentStage.round,2)
   assert.equal(store.currentStage.label,'第2轮原因排查')
   assert.match(store.currentStage.markdown,/前轮实际措施原文/)
   assert.equal(JSON.stringify(item.stages[checkIndex]),firstCheck)
   assert.equal(JSON.stringify(item.stages.find(stage=>stage.id===firstId)),firstWork,'first-round repair details stay immutable')
   assert.ok(store.logs[id].at(-1).markdown.includes('第2轮'))
   const secondChoices=item.workflowKind==='maintenance'?choices():['未见异常','发现异常']
   assert.equal(store.advanceTodo(id,feedback(secondChoices)).advanced,true)
   assert.equal(store.currentStage.label,'第2轮对应处置')
   assert.equal(store.currentStage.round,2)
   if(item.realType==='maintenance'){
    assert.match(store.checkAssessments[id].title,/第2轮/)
    assert.match(store.checkAssessments[id].message,/本轮实际检查依据/)
    assert.doesNotMatch(store.checkAssessments[id].message,/6月下移后|1—8 月|建议先完成独立测温核验/)
   }
   assert.ok(store.currentStage.tasks.every(task=>task.checks?.length>=2))
   if(item.packages&&Object.keys(item.packages).length){
    const chosen=Object.keys(item.packages)[1]
    assert.deepEqual(store.currentStage.packageKeys,[chosen])
    assert.equal(store.currentStage.tasks.length,3,'only the selected cause plus shared setup and verification')
   }
   assert.match(stageReport(store,id,store.currentStage),/复发工况验证/)
   const secondForm=store.executionInquiry(id)
   assert.equal(secondForm.values.measures,undefined,'new round cannot prefill the first-round completion')
   assert.ok(store.confirmExecutionRecord(id,secondForm.id,{executedAt:'2026-10-26T12:00',measures:'第二轮新增措施',acceptance:'第二轮复测通过',verification:'resolved'}))
   assert.deepEqual(store.executionRecords[id].map(record=>record.round),[1,2])
   assert.equal(store.executionRecords[id][0].values.measures,'前轮实际措施原文')
   assert.equal(store.observationRounds[id],2)
  })
  await t.test('round two scope branches and demo drafts do not reuse first-round component conclusions',()=>{
   for(const id of ['real-alarm-0430','real-warning-0523']){
    const item=workflowCases[id],check=item.stages.find(stage=>stage.id==='investigate')
    const next=followupStage(item,{...check,id:'investigate-r2',baseStageId:'investigate'},2)
    for(const preset of feedbackPresets(item,next))for(const record of preset.records){
     assert.match(record.note,/第2轮/)
     assert.doesNotMatch(record.note,/二缸 ICU 拆检记录显示伺服油液压活塞动作卡滞|密封垫老化/)
    }
    for(const keys of [[Object.keys(item.packages)[0]],[Object.keys(item.packages)[1]],Object.keys(item.packages)]){
     const repair=composeRepair(item,keys,2)
     assert.equal(repair.tasks.length,keys.length+2)
     assert.equal(repair.round,2)
     assert.match(executionPreset(item,{...repair,kind:'work'},'complete').measures,/第2轮/)
     assert.doesNotMatch(executionPreset(item,{...repair,kind:'work'},'complete').measures,/更换二缸 ICU|密封垫临时制作/)
    }
   }
  })
  await t.test('legacy observation recurrence appends independent stages while retaining first-round feedback',()=>{
   for(const id of ['drift','steering-heat','air-delivery']){
    setActivePinia(createPinia());const store=usePhase2DemoStore(),item=store.cases[id]
    store.createTodo(id);store.progress[id]=store.observationIndex(id);store.activeStage[id]=store.progress[id]
    store.observationRecords[id].push({day:1,status:'abnormal',label:'原异常反复',note:'修后复发记录',values:[1,2]})
    store.executionRecords[id]=[{round:1,values:{measures:'第一轮历史措施',acceptance:'第一轮历史验收',completion:'completed',verification:'resolved'}}]
    const firstStages=JSON.stringify(item.stages.filter(stage=>stage.kind==='check'))
    store.taskResults[id+':investigate:0']='发现异常'
    store.reopenTodo(id);store.selectTodo(id)
    assert.equal(store.currentStage.round,2,id)
    assert.equal(store.currentStage.label,'第2轮原因排查')
    assert.equal(store.taskResults[id+':investigate:0'],'发现异常')
    assert.equal(JSON.stringify(item.stages.filter(stage=>stage.kind==='check'&&!stage.round)),firstStages)
    const feedback=store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'未见异常':'发现异常',note:'复查发现'}))
    assert.equal(store.advanceTodo(id,feedback).advanced,true,id)
    assert.equal(store.currentStage.round,2)
    assert.equal(store.currentStage.tasks.length,3,'legacy second round includes only the confirmed direction')
    assert.equal(store.currentStage.packageKeys.length,1)
    assert.equal(store.executionInquiry(id).values.measures,undefined,'legacy second-round receipt also starts without old measures')
    assert.equal(store.observationHistory[id].length,1)
   }
  })
  await t.test('legacy second-direction findings get only their matching conditional materials',()=>{
   for(const [id,expected,excluded] of [['drift',/排气阀检修密封包/,/喷油器/],['steering-heat',/油样瓶|液压部位/,/冷却器/],['air-delivery',/进气滤器|加载阀/,/止回部位/]]){
    setActivePinia(createPinia());const store=usePhase2DemoStore()
    store.createTodo(id);store.progress[id]=store.observationIndex(id);store.activeStage[id]=store.progress[id]
    store.observationRecords[id].push({day:1,status:'abnormal',label:'复发',note:'复发片段已保留',values:[1,2]})
    store.reopenTodo(id);store.selectTodo(id)
    const pending=store.currentStage.tasks.map(task=>({label:task.label,result:'未见异常',note:'检查范围内未见异常'}))
    assert.equal(store.advanceTodo(id,pending).advanced,false,'no finding cannot carry forward old work')
    const feedback=store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'发现异常':'未见异常',note:'第二方向本轮有定位依据'}))
    assert.equal(store.advanceTodo(id,feedback).advanced,true)
    const parts=store.currentStage.workDetails.parts
    assert.ok(parts.length>0)
    assert.match(parts.map(part=>part.name).join('；'),expected)
    assert.doesNotMatch(JSON.stringify(parts),excluded)
    assert.ok(parts.every(part=>part.use.includes('本轮')&&part.specification))
   }
  })
 }finally{await server.close()}
})
