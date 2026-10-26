import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('dispatched tasks retain operator instructions and scope-specific execution content',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {stageReport}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {executionPreset}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {eventBriefingFor}=await server.ssrLoadModule('/src/mock/eventBriefings.js')
  for(const [id,directions] of [
   ['real-alarm-0430',[0]],['real-alarm-0430',[1]],['real-alarm-0430',[0,1]],
   ['real-warning-0523',[0]],['real-warning-0523',[1]],['real-warning-0523',[0,1]],
   ['real-maintenance-c4-baseline',[]],['real-tracking-exhaust-baseline',[]],
  ])await t.test(id+' / '+directions.join(','),()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore()
   store.createTodo(id);store.selectTodo(id)
   const item=store.cases[id],intro=stageReport(store,id,store.currentStage)
   assert.match(intro,/任务目标[\s\S]*接单后工作[\s\S]*提交成果/)
   assert.ok(!intro.includes(eventBriefingFor(id).captainDecision),'decision wording must not leak into operator brief')
   assert.ok(store.logs[id].some(message=>message.markdown?.includes('接单后工作')),'assistant receives the same operator instructions')
   store.advanceTodo(id)
   const submit=values=>store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'本轮检查记录'})))
   if(item.trackingOnly){
    submit(['现场与系统一致','信息已记录'])
    assert.ok(!item.stages.some(stage=>stage.kind==='work'),'normal maneuver verification must not invent repair')
    return
   }
   if(item.realType==='warning'){submit(['现场与系统一致','工况可比，偏离仍存在']);store.advanceTodo(id)}
   submit(item.realType==='maintenance'?['有提前处理依据','条件具备']:[0,1].map(index=>directions.includes(index)?'发现异常':'未见异常'))
   const stage=store.currentStage,detail=item.workDetails
   assert.equal(stage.kind,'work')
   assert.ok(detail.parts.length>=3)
   assert.ok(detail.parts.every(part=>/\d/.test(part.amount)&&part.specification&&part.use))
   assert.equal(detail.acceptanceRows.length,detail.acceptance.length,'package composition must preserve named acceptance methods')
   assert.ok(detail.acceptanceRows.every(row=>row.name&&row.req&&row.method))
   assert.ok(stage.tasks.every(task=>task.checks.length>=2&&task.recordHint&&task.feedback))
   const form=store.executionInquiry(id)
   assert.equal(form.fields.filter(field=>/^task\d+$/.test(field.key)).length,stage.tasks.length)
   assert.ok(!form.values.measures&&!form.values.acceptance,'instructions must not pre-confirm work')
   assert.ok(form.fields.filter(field=>/^note\d+$/.test(field.key)).every(field=>field.placeholder))
   if(item.realType!=='maintenance'){
    const selected=Object.values(item.packages).filter((_,index)=>directions.includes(index))
    assert.deepEqual(detail.parts.map(part=>part.name),selected.flatMap(pack=>pack.parts.map(part=>part.name)))
    assert.deepEqual(stage.tasks.map(task=>task.label),selected.flatMap(pack=>pack.tasks.map(task=>task.label)))
   }
   const draft=executionPreset(item,stage,'complete')
   assert.ok(stage.tasks.every((task,index)=>draft['note'+index]===task.feedback))
   const partial=executionPreset(item,stage,'partial')
   assert.equal(partial['task'+(stage.tasks.length-1)],'待补充')
   assert.equal(partial.verification,'pending')
  })
 }finally{await server.close()}
})
