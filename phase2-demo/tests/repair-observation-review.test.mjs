import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('repair observation records follow the chosen outcome and keep receipts in the process timeline',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {executionPreset}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {storyDossier}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {observationMessages}=await server.ssrLoadModule('/src/message-flows/observationMessages.js')
  const {observationReviewFields}=await server.ssrLoadModule('/src/mock/observationReview.js')
  const ids=['real-alarm-0430','real-warning-0523','real-maintenance-c4-baseline']
  function ready(id){
   setActivePinia(createPinia());const store=usePhase2DemoStore()
   store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
   const feedback=values=>store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'现场核验已记录：原始反馈唯一内容'}))
   if(id==='real-warning-0523'){store.advanceTodo(id,feedback(['现场与系统一致','工况可比，偏离仍存在']));store.advanceTodo(id)}
   store.advanceTodo(id,feedback(id==='real-maintenance-c4-baseline'?['有提前处理依据','条件具备']:['发现异常','未见异常']))
   const form=store.executionInquiry(id),values={...form.values,...executionPreset(store.cases[id],store.currentStage,'complete'),measures:'实际措施唯一原文',acceptance:'验收结果唯一原文'}
   assert.equal(store.confirmExecutionRecord(id,form.id,values),true)
   return store
  }
  for(const id of ids)await t.test(id+' saves required observations and keeps optional outcomes free of required fields',()=>{
   const store=ready(id),config=store.cases[id].observation
   assert.equal(store.submitObservationReview(id,'continue',{}),false)
   assert.equal(store.submitObservationReview(id,'incomplete',{}),false)
   const fields=observationReviewFields(config,'incomplete')
   assert.equal(fields.find(field=>field.key==='value0').required,false)
   assert.equal(observationReviewFields(config,'stable').length,0)
   assert.equal(observationReviewFields(config,'abnormal').length,0)
   const values={day:0,value0:config.samples[0][0],value1:config.samples[0][1],conditions:'10月26日14:40，相近负荷',note:'本次观察内容唯一原文'}
   assert.equal(store.submitObservationReview(id,'continue',values),true)
   assert.deepEqual(store.observationRecords[id].at(-1).values,config.samples[0])
   assert.match(store.observationRecords[id].at(-1).note,/本次观察内容唯一原文/)
   assert.equal(store.getObservationResult(id).type,'continue')
   const conversation=observationMessages(store,id)
   assert.match(conversation.at(-2).text,/本次观察内容唯一原文/)
   const target=store.observationTargets[id]
   assert.equal(store.submitObservationReview(id,'incomplete',{day:1,conditions:'负荷变化，14:50—15:00不可比',note:'补充下一稳定时段记录'}),true)
   assert.equal(store.observationTargets[id],Math.max(target,1)+1)
   assert.equal(store.observationRecords[id].at(-1).values,null)
   assert.equal(store.getObservationResult(id).extensionApplied,true)
   assert.match(observationMessages(store,id).at(-2).text,/补充下一稳定时段记录/)
   assert.equal(store.submitObservationReview(id,'abnormal'),true)
   assert.equal(store.getObservationResult(id).type,'reinspect')
   assert.equal(store.submitObservationReview(id,'stable'),false,'unresolved recurrence blocks closure')
   const count=store.observationRecords[id].length
   store.reopenTodo(id)
   assert.equal(store.observationHistory[id][0].records.length,count)
   assert.equal(store.eventStatus[id],'assigned')
  })
  for(const id of ids)await t.test(id+' stable confirmation requires no extra measurements or note',()=>{
   const store=ready(id)
   const samples=store.observationRecords[id].filter(record=>record.values).length
   assert.equal(store.submitObservationReview(id,'stable'),true)
   assert.equal(store.observationRecords[id].filter(record=>record.values).length,samples,'status confirmation cannot invent readings')
   assert.equal(store.getObservationResult(id).type,'archive')
   assert.equal(store.eventStatus[id],'observing')
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'closed')
   assert.match(storyDossier(store,id).currentMarkdown,/本轮已人工确认结束/)
   assert.equal(store.submitObservationReview(id,'continue',{day:2,value0:1,value1:2,conditions:'conditions',note:'note'}),false)
  })
  for(const id of ids)await t.test(id+' overview and analysis do not duplicate submitted receipts',()=>{
   const store=ready(id),root=id==='real-maintenance-c4-baseline'?'real-health-c4-baseline':id
   const dossier=storyDossier(store,root)
   assert.ok(dossier.overviewSummary)
   for(const text of [dossier.overviewSummary,dossier.overviewMarkdown,dossier.analysisMarkdown])assert.doesNotMatch(text,/实际措施唯一原文|验收结果唯一原文|原始反馈唯一内容/)
   assert.equal(dossier.timeline.filter(record=>record.text==='实际措施唯一原文').length,1)
   assert.equal(dossier.timeline.filter(record=>record.assessment==='验收结果唯一原文').length,1)
  })
 }finally{await server.close()}
})
