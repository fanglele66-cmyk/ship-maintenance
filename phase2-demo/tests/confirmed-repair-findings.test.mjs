import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {realWorkflowCases} from '../src/mock/realCaseAdapter.js'
import {compactRepair} from '../src/mock/compactRepair.js'
import {followupStage} from '../src/mock/followupRounds.js'
import {confirmedRepairFinding,applyConfirmedRepairFinding} from '../src/mock/confirmedRepairFindings.js'

const item=id=>realWorkflowCases.find(entry=>entry.id===id)
const fixtures=[
 {id:'real-alarm-0430',key:'icv',label:'核查 C2 ICU 液压机构与反馈',result:'发现异常',cause:'二缸 ICU 伺服油液压活塞卡滞',object:/液压活塞/,scope:/ICU/},
 {id:'real-warning-0523',key:'regulator',label:'核查空气减压阀状态',result:'发现异常',cause:'控制空气减压阀阀芯密封垫老化破损',object:/阀芯密封垫/,scope:/密封垫/},
 {id:'real-maintenance-c1-baseline',key:'baseline',label:'评估一缸专项检查必要性',result:'有提前处理依据',cause:'一缸喷油器喷嘴积碳导致雾化不良',object:/喷油器喷嘴/,scope:/喷嘴清洁/},
 {id:'real-maintenance-c4-baseline',key:'baseline',label:'评估四缸专项检查必要性',result:'有提前处理依据',cause:'四缸排气温度探头接线端子松动',object:/接线端子/,scope:/端子恢复/},
]
const feedback=f=>[{label:f.label,result:f.result,note:'演示假设。现场确认：'+f.cause+'。本轮检查附件与批准范围另行记录。'}]
function repairFor(f){const c=item(f.id);return f.key==='baseline'?c.stages.find(stage=>stage.kind==='work'):{...compactRepair(c,[f.key]),packageKeys:[f.key]}}

test('four explicit findings produce concrete, conditional repair plans without mutating source cases',()=>{
 for(const f of fixtures){
  const c=item(f.id),repair=repairFor(f),before=JSON.stringify({c,repair})
  const finding=confirmedRepairFinding(c,{records:feedback(f)})
  assert.match(finding.component,f.object)
  assert.equal(finding.isSimulation,true)
  assert.equal(finding.dataOrigin,'prototype-confirmed-finding')
  assert.equal(finding.sourceKind,f.key==='baseline'?'prototype-assumption':'historical-case-informed-simulation')
  const result=applyConfirmedRepairFinding(c,repair,feedback(f))
  assert.match(result.title,f.scope)
  assert.equal(result.confirmedFinding.cause,f.cause)
  assert.ok(result.tasks.length>=4)
  assert.ok(result.tasks.every(task=>task.checks?.length&&task.recordHint))
  assert.ok(result.workDetails.parts.length>=2)
  assert.ok(result.workDetails.acceptanceRows.every(row=>row.req&&row.method))
  assert.equal(JSON.stringify({c,repair}),before)
  assert.equal(applyConfirmedRepairFinding(c,result,feedback(f)),result)
 }
})

test('bare keywords, negative, uncertain, quoted or wrong-direction notes never authorize a specific repair',()=>{
 for(const f of fixtures){
  const c=item(f.id),repair=repairFor(f),base=feedback(f)[0]
  for(const note of [f.cause,'未现场确认：'+f.cause,'现场确认：疑似'+f.cause,'现场确认：未发现'+f.cause,'参考“现场确认：'+f.cause+'”','现场确认：'+f.cause+'可能是原因']){
   const records=[{...base,note}]
   assert.equal(confirmedRepairFinding(c,records),null,note)
   assert.equal(applyConfirmedRepairFinding(c,repair,records),repair)
  }
  for(const result of ['未见异常','无法确认','条件具备','现场与系统一致','暂无提前处理必要'])assert.equal(confirmedRepairFinding(c,[{...base,result}]),null)
  assert.equal(confirmedRepairFinding(c,[{...base,label:'核对校验、备料与停机窗口'}]),null)
 }
 const f=fixtures[2]
 assert.equal(confirmedRepairFinding(item('real-tracking-exhaust-baseline'),feedback(f)),null)
 assert.equal(confirmedRepairFinding(item('real-maintenance-c4-baseline'),feedback(f)),null)
})

test('diagnosis marker aliases and selected package boundaries are respected',()=>{
 const f=fixtures[0],c=item(f.id),records=feedback(f)
 records[0].note='已确认原因：'+f.cause
 assert.ok(confirmedRepairFinding(c,records))
 const unrelated={...compactRepair(c,['supply']),packageKeys:['supply']}
 assert.equal(applyConfirmedRepairFinding(c,unrelated,records),unrelated)
 const multiple={...compactRepair(c,['icv','supply']),packageKeys:['icv','supply']}
 const result=applyConfirmedRepairFinding(c,multiple,records)
 assert.ok(result.tasks.some(task=>task.label==='处理已定位的燃油供给问题'))
 assert.ok(result.workDetails.parts.some(part=>part.name==='燃油供给滤器滤芯'))
 assert.equal(result.workDetails.parts.filter(part=>/ICU 总成/.test(part.name)).length,1)
 assert.match(result.workDetails.parts.find(part=>/ICU 总成/.test(part.name)).use,/仅清洁后仍卡滞[\s\S]*获批/)
})

test('baseline findings narrow work and parts without claiming new field measurements or unrelated replacement',()=>{
 for(const f of fixtures.slice(2)){
  const c=item(f.id),repair=repairFor(f),records=feedback(f)
  const pending=[...records,{label:'核对校验、备料与停机窗口',result:'条件暂不具备',note:'停机窗口未落实'}]
  assert.equal(applyConfirmedRepairFinding(c,repair,pending),repair)
  const result=applyConfirmedRepairFinding(c,repair,records)
  assert.doesNotMatch(JSON.stringify(result.workDetails.acceptanceRows),/\d+(?:\.\d+)?\s*(?:MPa|°C)/)
  if(f.id.includes('c1'))assert.doesNotMatch(result.workDetails.parts.map(part=>part.name).join(' '),/排气阀|排温传感器/)
  else assert.doesNotMatch(result.workDetails.parts.map(part=>part.name).join(' '),/喷油器|排气机构|传感器组件/)
 }
})

test('second-round confirmed findings remain round-specific and preserve other approved directions',()=>{
 for(const f of fixtures){
  const c=item(f.id),base=repairFor(f),first=JSON.stringify(base)
  const round=followupStage(c,{...base,kind:'work',packageKeys:[f.key]},2)
  const records=[{...feedback(f)[0],label:f.key==='icv'?'复核 ICU 修后状态与间歇反馈':f.key==='regulator'?'复核临时密封与调压保持能力':`复核${f.id.includes('c1')?'一缸':'四缸'}修后校验与剩余偏差`}]
  const result=applyConfirmedRepairFinding(c,round,records)
  assert.equal(result.round,2)
  assert.match(result.title,/第2轮/)
  assert.equal(result.confirmedFinding.cause,f.cause)
  assert.equal(JSON.stringify(base),first)
  assert.match(result.tasks[0].label,/前轮措施/)
  assert.match(result.tasks.at(-1).label,/复发工况/)
  const previous=applyConfirmedRepairFinding(c,base,records)
  const rebuilt=followupStage(c,{...previous,kind:'work',packageKeys:[f.key]},2)
  const reapplied=applyConfirmedRepairFinding(c,rebuilt,records)
  assert.match(reapplied.title,/第2轮/)
  assert.ok(reapplied.confirmedFinding.steps.every(step=>reapplied.tasks.some(task=>task.label===step.label)),'copied previous metadata must not suppress new-round plan application')
 }
})

test('the four scripted feedback paths reach specific work and individual acceptance fields',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  for(const f of fixtures)await t.test(f.id,()=>{
   setActivePinia(createPinia());const store=usePhase2DemoStore()
   if(f.key==='baseline'){
    const root=f.id.includes('c1')?'real-tracking-exhaust-baseline':'real-health-c4-baseline'
    if(f.id.includes('c1')){
     store.createTodo(root);store.selectTodo(root);store.advanceTodo(root)
     store.advanceTodo(root,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:'演示假设：本轮基线核对完成，需补专项检验。'})))
     assert.equal(store.decideCheck(root,'finish-tracking','演示假设：回交轮机长确认专项检查范围。'),true)
    }
    assert.equal(store.decideTracking(root,'maintenance',{reason:'演示假设：需要专项核验解释剩余偏差。',scope:'先核验对应气缸的测温与喷射资料，按检验结果作业。'}).ok,true)
    assert.equal(store.confirmTrackingMaintenance(root,{owner:'李建国（大管轮）',due:new Date(Date.now()+86400000).toISOString().slice(0,16),scope:'按本轮检验记录开展批准的专项维护。',conditions:'演示假设：人员、设备与批准窗口已落实。'}).ok,true)
   }else assert.equal(store.createTodo(f.id),true)
   store.selectTodo(f.id);store.advanceTodo(f.id)
   if(f.id==='real-warning-0523')store.advanceTodo(f.id,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'工况可比，偏离仍存在':'现场与系统一致',note:'演示假设：进口压力与操作时序核对完成。'})))
   const records=store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?(f.key==='baseline'?'条件具备':'未见异常'):f.result,note:index?'演示假设：本轮对应检查范围及条件已登记。':feedback(f)[0].note}))
   assert.equal(store.advanceTodo(f.id,records).advanced,true)
   assert.equal(store.currentStage.kind,'work')
   assert.equal(store.currentStage.confirmedFinding?.cause,f.cause)
   assert.match(store.currentStage.title,f.scope)
   assert.deepEqual(store.cases[f.id].workDetails.parts,store.currentStage.workDetails.parts)
   assert.equal(store.executionRecords[f.id],undefined,'a specific plan must not fabricate an execution receipt')
   const form=store.executionInquiry(f.id),fields=form.fields.filter(field=>field.acceptanceItem)
   assert.equal(fields.length,store.currentStage.workDetails.acceptanceRows.length)
   assert.ok(fields.every(field=>!form.values[field.key]))
  })
 }finally{await server.close()}
})
