import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('closed event reference and live event processes keep evidence and task history separate',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {eventProcessRecords}=await server.ssrLoadModule('/src/mock/eventProcessRecords.js')
  const {historicalDecisions}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {issueReply,issueConversationMessages,mergeIssueConversation}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {eventDirectoryRows}=await server.ssrLoadModule('/src/mock/eventDirectory.js')
  const fresh=()=>{setActivePinia(createPinia());return usePhase2DemoStore()}
  await t.test('removed warning example is absent from every event catalog',()=>{
   const store=fresh()
   assert.ok(!historicalDecisions.some(item=>item.id==='warning-history'))
   assert.ok(!eventDirectoryRows(store).some(item=>item.id==='warning-history'))
   assert.equal(eventProcessRecords(store,'warning-history').reference,null)
  })
  await t.test('questions stay beside their event revision across dispatch, completion and fresh sessions',()=>{
   const store=fresh(),id='real-tracking-exhaust-baseline',existing=[]
   mergeIssueConversation(existing,issueConversationMessages(id,store))
   const originalIds=existing.filter(message=>message.eventProcess).map(message=>message.id)
   const anchor=existing.findLast(message=>message.eventProcess).eventRecordId
   existing.push({id:'question-before-dispatch',role:'user',text:'派发前先确认依据',afterEventRecordId:anchor},{id:'answer-before-dispatch',role:'assistant',text:'现有采样与操纵背景待核实',afterEventRecordId:anchor})
   store.createTodo(id);store.assignTask(id,store.defaultAssignment(id))
   mergeIssueConversation(existing,issueConversationMessages(id,store))
   assert.ok(existing.findIndex(message=>message.id==='question-before-dispatch')<existing.findIndex(message=>message.eventKind==='assignment'))
   store.selectTodo(id);store.advanceTodo(id)
   store.advanceTodo(id,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:'保留本轮实际核实资料'})))
   store.decideCheck(id,'finish-tracking','本次核实结束，原跟踪继续')
   const incoming=issueConversationMessages(id,store)
   mergeIssueConversation(existing,incoming);mergeIssueConversation(existing,incoming)
   assert.ok(originalIds.every(id=>existing.some(message=>message.id===id)))
   assert.equal(existing.filter(message=>message.id==='question-before-dispatch').length,1)
   assert.equal(existing.filter(message=>message.eventKind==='assignment'&&message.role==='user').length,1)
   assert.ok(existing.some(message=>message.eventKind==='feedback'&&message.role==='assistant'&&message.returnedRecord))
   assert.ok(!existing.some(message=>message.eventKind==='feedback'&&message.role==='user'),'the captain receives the assignee submission as a report, not their own message')
   assert.ok(existing.some(message=>message.eventKind==='feedback'&&message.role==='assistant'))
   const newSession=[];mergeIssueConversation(newSession,incoming)
   assert.deepEqual(newSession.filter(message=>message.eventProcess).map(message=>message.id),existing.filter(message=>message.eventProcess).map(message=>message.id))
   assert.equal(store.activeTaskPortfolio.length,0)
  })
  await t.test('live event process only grows after actual actions, then preserves completed verification',()=>{
   const store=fresh(),id='real-tracking-exhaust-baseline'
   let process=eventProcessRecords(store,id)
   assert.equal(process.reference,null)
   assert.equal(process.records.some(item=>['assignment','execution','closure'].includes(item.kind)),false)
   store.createTodo(id);store.assignTask(id,store.defaultAssignment(id))
   process=eventProcessRecords(store,id)
   assert.equal(process.records.filter(item=>item.kind==='assignment').length,1)
   assert.equal(store.activeTaskPortfolio.length,1)
   store.selectTodo(id);store.advanceTodo(id)
   store.advanceTodo(id,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:'保存本轮实际核实与来源限制'})))
   store.decideCheck(id,'finish-tracking','本次核实结束，原跟踪继续')
   assert.equal(store.activeTaskPortfolio.length,0)
   assert.equal(store.taskPortfolio.length,1)
   process=eventProcessRecords(store,id)
   assert.ok(process.records.some(item=>item.kind==='feedback'))
   assert.ok(process.records.some(item=>item.kind==='decision'&&item.text.includes('本次核实结束')))
   assert.equal(eventDirectoryRows(store).find(item=>item.id===id).eventState,'处置中')
   const answer=issueReply(id,'下一步怎么安排',store)
   assert.deepEqual(answer.actions.map(item=>item.id),['issue:section:decision','issue:section:处置记录'])
  })
  await t.test('closed source events cannot leak into Todos even if older progress is incomplete',()=>{
   const store=fresh(),id='real-alarm-0430'
   store.createTodo(id);store.assignTask(id,store.defaultAssignment(id));store.eventStatus[id]='closed'
   assert.equal(store.isTaskHandled(id),false)
   assert.equal(store.activeTaskPortfolio.length,0)
   assert.equal(store.taskPortfolio.length,1)
   assert.equal(eventDirectoryRows(store).find(item=>item.id===id).eventState,'已闭环')
  })
 }finally{await server.close()}
})
