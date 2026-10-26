import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'

test('real branch feedback keeps evidence limits and gives an actionable next step',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {realWorkflowCases}=await server.ssrLoadModule('/src/mock/realCaseAdapter.js')
  const {composeRepair}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {feedbackPresets,realAssessmentContent,executionPreset,executionPresetOptions,realExecutionContent,realObservationContent,decisionPreset,observationPresets}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {observationResult}=await server.ssrLoadModule('/src/mock/phase2Observation.js')
  const cases=Object.fromEntries(realWorkflowCases.map(item=>[item.realType,item]))
  await t.test('45 combinations preserve scope, missing evidence and distinct conclusions',()=>{
   let count=0
   for(const item of realWorkflowCases)for(const stage of item.stages.filter(stage=>stage.kind==='check')){
    const original=JSON.stringify(item),branches=feedbackPresets(item,stage),messages=[]
    assert.equal(branches.length,9)
    for(const branch of branches){
     count++
     const content=realAssessmentContent(item,stage,branch.records)
     messages.push(content.message)
     assert.ok(content.title)
     assert.match(content.message,/下一步：/)
     assert.doesNotMatch(JSON.stringify(content),/undefined|演示|预设|模拟|参考/)
     assert.ok(branch.records.every(record=>record.isSimulation&&record.sourceCaseId===item.realCaseId&&record.note))
     assert.doesNotMatch(branch.records.map(record=>record.note).join('\n'),/本轮选择|提交时补充|待补具体/)
     if(stage.id==='investigate'){
      const unknown=branch.records.filter(record=>record.result==='无法确认')
      for(const record of unknown)assert.ok(content.message.includes(record.label))
      if(unknown.length)assert.match(content.message,/仍未确认/)
      if(!branch.records.some(record=>record.result==='发现异常'))assert.match(content.message,/尚未取得支持维修范围/)
     }
    }
    assert.equal(new Set(messages).size,9,'each combination must reflect both submitted directions')
    assert.equal(JSON.stringify(item),original,'editable branch drafts must not mutate the initial evidence or stage history')
   }
   assert.equal(count,45)
  })
  await t.test('a load explanation cannot erase an unresolved pressure reading mismatch',()=>{
   const item=cases.warning,stage=item.stages.find(stage=>stage.id==='check')
   for(const reading of ['读数不一致','无法确认']){
    const branch=feedbackPresets(item,stage).find(branch=>branch.records[0].result===reading&&branch.records[1].result==='工况变化可以解释')
    const content=realAssessmentContent(item,stage,branch.records)
    assert.match(content.message,/不能将资料不足写成预警不成立/)
    assert.match(decisionPreset(item,'end-warning',{records:branch.records}),/保留读数差异、缺项/)
   }
  })
  await t.test('available parts are not sufficient necessity and missing conditions retain the maintenance need',()=>{
   const item=cases.maintenance,stage=item.stages.find(stage=>stage.kind==='check'),branches=feedbackPresets(item,stage)
   const get=(first,second)=>branches.find(branch=>branch.records[0].result===first&&branch.records[1].result===second)
   const notNeeded=get('暂无提前处理必要','条件具备'),unknown=get('无法确认','条件具备'),blocked=get('有提前处理依据','条件暂不具备')
   assert.match(realAssessmentContent(item,stage,notNeeded.records).message,/不以资料不足或条件就绪强制形成维修/)
   assert.match(realAssessmentContent(item,stage,unknown.records).title,/先补必要性依据/)
   assert.match(decisionPreset(item,'end-maintenance',{records:blocked.records}),/需求仍在/)
   assert.match(decisionPreset(item,'end-maintenance',{records:unknown.records}),/必要性仍未确认/)
  })
  await t.test('15 work outcomes distinguish unfinished work, missing acceptance, recurrence and absent follow-up measurements',()=>{
   for(const item of [cases.alarm,cases.warning,cases.maintenance]){
    const originalStage=item.stages.find(stage=>stage.kind==='work')
    const stage=item.realType==='maintenance'?originalStage:{...originalStage,...composeRepair(item,Object.keys(item.packages))},messages=[]
    for(const option of executionPresetOptions){
     const values=executionPreset(item,stage,option.id),content=realExecutionContent(item,option.id,stage)
     assert.ok(values.isSimulation);assert.equal(values.sourceCaseId,item.realCaseId)
     assert.ok(content.title&&content.message);messages.push(content.message)
     assert.doesNotMatch(values.measures,/永久更换已完成/)
     if(option.id==='partial'){
      assert.equal(values.completion,'partial');assert.equal(values.verification,'pending')
      assert.equal(values['task'+(stage.tasks.length-1)],'待补充')
      assert.match(values.acceptance,/未完成项与验收待补/)
      assert.match(content.message,/不进入效果观察/)
     }
     if(option.id==='pending')assert.match(content.message,/现场复测尚未完成/)
     if(option.id==='unresolved')assert.match(content.message,/返回排查或评估/)
     if(option.id==='missing')assert.match(content.message,/可比资料尚缺/)
     if(option.id==='complete')assert.match(content.message,/由人员确认闭环/)
    }
    assert.equal(new Set(messages).size,5)
   }
  })
  await t.test('12 observation branches retain case-specific evidence and do not confuse elapsed time with sampling',()=>{
   assert.deepEqual(observationPresets['real-alarm-0430'].before,[80.4,347.5])
   for(const item of [cases.alarm,cases.warning,cases.maintenance]){
    const days=item.observation.days
    for(const type of ['continue','extend','reinspect','archive']){
     const content=realObservationContent(item,type,days)
     assert.ok(content.title&&content.text&&content.next)
     assert.match(content.text,item.realType==='alarm'?/二缸|ICU/:item.realType==='maintenance'?/四缸|排温|Pmax/:/压力|减压阀/)
     if(type==='archive')assert.match(content.next,/由人员确认/)
    }
    const result=observationResult(item.id,[{status:'extended',day:0}],days+1)
    assert.equal(result.type,'continue')
    assert.match(result.text,/尚未因此增加采样/)
    const pending=observationResult(item.id,[{status:'pending-review',day:days,values:[0.1,0.1]}],days)
    assert.equal(pending.type,'continue');assert.match(pending.title,/待人工判读/)
   }
  })
  await t.test('specific investigation and operating feedback appear only in selected editable drafts',()=>{
   const alarmStage=cases.alarm.stages.find(stage=>stage.id==='investigate')
   const alarmFound=feedbackPresets(cases.alarm,alarmStage).find(branch=>branch.records[0].result==='发现异常')
   assert.match(alarmFound.records[0].note,/伺服油液压活塞动作卡滞/)
   assert.doesNotMatch(cases.alarm.report.conclusion,/伺服油液压活塞动作卡滞/)
   const trackingStage=cases.tracking.stages.find(stage=>stage.id==='check')
   const trackingMismatch=feedbackPresets(cases.tracking,trackingStage).find(branch=>branch.records[0].result==='读数不一致'&&branch.records[1].result==='信息已记录')
   assert.match(trackingMismatch.records[1].note,/月度负荷.*调整履历/)
   assert.match(realAssessmentContent(cases.tracking,trackingStage,trackingMismatch.records).message,/继续补充工况、调整履历或独立校验/)
   const supplyStage={...cases.alarm.stages.find(stage=>stage.kind==='work'),...composeRepair(cases.alarm,['supply'])}
   assert.match(executionPreset(cases.alarm,supplyStage,'complete').measures,/未安排二缸 ICU 更换/)
  })
  await t.test('false-alarm and non-adoption reasons do not fabricate channel faults or completed repairs',()=>{
   const falseAlarm=decisionPreset(cases.alarm,'false-alarm')
   assert.match(falseAlarm,/填写具体通道、核对时间、独立核验及判定依据/)
   assert.doesNotMatch(falseAlarm,/现场复核发现报警通道或测点异常/)
   for(const item of realWorkflowCases)assert.match(decisionPreset(item,'ignore'),/再次安排条件/)
   assert.equal(decisionPreset(cases.warning,'unknown'), '')
  })
 }finally{await server.close()}
})
