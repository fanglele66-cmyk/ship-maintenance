import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {baselineMaintenanceWorkFor,baselineMaintenanceBriefFor,maintenanceTaskPreparation} from '../src/mock/baselineTaskContent.js'

test('maintenance plans preserve cylinder, source window and conditional execution boundaries',()=>{
 const c1=baselineMaintenanceWorkFor(1),c4=baselineMaintenanceWorkFor(4)
 assert.match(JSON.stringify(c1),/一缸 1—8 月/)
 assert.doesNotMatch(JSON.stringify(c1),/四缸|5—8 月|相对下移/)
 assert.match(JSON.stringify(c4),/四缸 5—8 月/)
 assert.match(JSON.stringify(c4),/相对下移/)
 for(const [cylinder,work] of [[1,c1],[4,c4]]){
  const brief=baselineMaintenanceBriefFor(cylinder)
  assert.equal(work.tasks.length,6)
  assert.ok(work.tasks.every(task=>task.checks.length>=2&&task.recordHint&&task.feedback))
  assert.match(work.preparation.join(' '),/来源异动[\s\S]*校验设备编号[\s\S]*隔离[\s\S]*验收见证/)
  assert.match(JSON.stringify(work.tasks),/实际措施[\s\S]*旧件[\s\S]*未完成项/)
  assert.ok(work.parts.every(part=>part.specification&&part.amount&&part.use))
  assert.match(JSON.stringify(work.parts),/确认[\s\S]*获批|获准/)
  assert.match(brief.observation,/本轮实际完成时间[\s\S]*两个不同时间[\s\S]*可比工况[\s\S]*异常反复返回复查/)
  assert.match(JSON.stringify(work.acceptanceRows),/执行人与复核人分别签认/)
 }
 c1.preparation[0]='external mutation'
 assert.notEqual(baselineMaintenanceWorkFor(1).preparation[0],'external mutation')
 assert.equal(maintenanceTaskPreparation({id:'real-alarm-0430'}),null)
 assert.doesNotMatch(maintenanceTaskPreparation({id:'real-maintenance-c1-baseline',baselineCylinder:1}).join(' '),/四缸/)
})

test('confirmed tracking arrangements create detailed independent maintenance tasks without prefilled findings',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {stageReport}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {executionPreset,executionPresetOptions}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {checkPreparation}=await server.ssrLoadModule('/src/mock/taskGuidance.js')
  for(const [root,id,cylinder] of [
   ['real-tracking-exhaust-baseline','real-maintenance-c1-baseline',1],
   ['real-health-c4-baseline','real-maintenance-c4-baseline',4],
  ])await t.test('cylinder '+cylinder,()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore()
   if(cylinder===1){
    store.createTodo(root);store.selectTodo(root);store.advanceTodo(root)
    store.advanceTodo(root,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:'核实资料按原跟踪记录保留'})))
    store.decideCheck(root,'finish-tracking','已有核实资料，独立测温及燃烧分配仍需专项核对')
   }
   assert.equal(store.decideTracking(root,'maintenance',{reason:'已核实资料支持专项检查，尚不能指定故障部件',scope:'测温校验与六缸燃烧平衡对照'}).ok,true)
   const arrangement={owner:'王海涛（二管轮）',due:'靠港获得隔离许可后实施',scope:'先校验测温通道，再按现场依据开展批准范围的燃烧检查',conditions:'校验设备及适配备料完成核对，落实停机窗口、隔离和复测见证'}
   assert.equal(store.confirmTrackingMaintenance(root,arrangement).ok,true)
   store.selectTodo(id)
   const item=store.cases[id],intro=stageReport(store,id,store.currentStage)
   assert.match(intro,/任务目标[\s\S]*接单后工作[\s\S]*提交成果/)
   assert.match(intro,/来源|原一缸异动/)
   assert.match(intro,/实际措施[\s\S]*签认|验收/)
   assert.ok(store.assignments[id].scope.includes(arrangement.scope))
   assert.ok(store.assignments[id].scope.includes(arrangement.conditions))
   assert.equal(store.executionRecords[id],undefined,'a maintenance arrangement cannot fabricate execution')
   assert.equal(store.eventStatus[root],'closed')
   store.advanceTodo(id)
   assert.equal(checkPreparation(item,store.currentStage).length,6)
   assert.match(store.currentStage.tasks[0].checks.join(' '),/来源异动|原异动/)
   store.advanceTodo(id,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'条件具备':'有提前处理依据',note:'批准范围和本次条件已核对'})))
   assert.equal(store.currentStage.kind,'work')
   assert.equal(store.currentStage.tasks.length,6)
   const form=store.executionInquiry(id)
   assert.equal(form.values.measures,undefined)
   assert.equal(form.values.acceptance,undefined)
   for(const option of executionPresetOptions){
    const draft=executionPreset(item,store.currentStage,option.id)
    assert.equal(draft.isSimulation,true)
    if(cylinder===1)assert.doesNotMatch(JSON.stringify(draft),/四缸/,'C1 must never receive C4 measures or acceptance')
   }
   if(cylinder===1){
    assert.doesNotMatch(JSON.stringify(item.stages),/四缸|相对下移/)
    assert.match(item.observation.basis,/一缸[\s\S]*两个不同时间|两个不同时间[\s\S]*一缸/)
   }
   assert.equal(store.executionRecords[id],undefined,'reading guidance and draft presets does not submit work')
  })
 }finally{await server.close()}
})
