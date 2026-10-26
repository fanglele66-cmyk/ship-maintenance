import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {readFile} from 'node:fs/promises'

test('closed event reference and live event processes keep evidence and task history separate',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {eventProcessRecords}=await server.ssrLoadModule('/src/mock/eventProcessRecords.js')
  const {storyDossier,historicalDecisions}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {issueReply,initialIssueMessages,issueConversationMessages,mergeIssueConversation}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {eventDirectoryRows}=await server.ssrLoadModule('/src/mock/eventDirectory.js')
  const fresh=()=>{setActivePinia(createPinia());return usePhase2DemoStore()}
  await t.test('reference contains the full process and preserves the original no-repair outcome',async()=>{
   const store=fresh(),before=await readFile('src/mock/realCases.json','utf8')
   const history=historicalDecisions.find(item=>item.id==='warning-history'),original=JSON.stringify(history)
   const process=eventProcessRecords(store,'warning-history'),dossier=storyDossier(store,'warning-history')
   assert.equal(process.reference.dataOrigin,'prototype-reference')
   assert.deepEqual([...new Set(process.records.map(item=>item.phase))],['发现','研判','派发','执行反馈','验收与观察','闭环'])
   assert.ok(process.records.some(item=>item.role==='user'));assert.ok(process.records.some(item=>item.role==='assistant'))
   assert.ok(process.records.every(item=>item.dataOrigin==='prototype-reference'))
   assert.equal(dossier.timeline.length,8);assert.match(dossier.reference.boundary,/不作为真实船舶维修或闭环凭证/)
   assert.match(dossier.reference.task.result,/现场核实已完成/)
   assert.ok(dossier.reference.feedback.finding);assert.ok(dossier.reference.acceptance.basis);assert.ok(dossier.reference.closure.followup)
   assert.equal(process.records.some(item=>/虚构|编造/.test(item.text+item.assessment)),false)
   assert.match(dossier.overviewMarkdown,/没有|未拆检|未安排拆检/)
   assert.match(dossier.overviewMarkdown,/预警不成立/)
   for(const text of [dossier.overviewMarkdown,dossier.analysisMarkdown,dossier.evidenceMarkdown])assert.doesNotMatch(text,/参考案例|参考回放|补全过程|不作为真实船舶/)
   assert.equal(JSON.stringify(history),original)
   assert.equal(await readFile('src/mock/realCases.json','utf8'),before)
   assert.equal(store.activeTaskPortfolio.length,0);assert.equal(store.taskPortfolio.length,0)
  })
  await t.test('closed history answers point to records and never offer a task or redispatch',()=>{
   const store=fresh(),answer=issueReply('warning-history','下一步怎么处理',store)
   assert.match(answer.markdown,/已闭环事件不会再次进入待办/)
   assert.doesNotMatch(answer.markdown,/参考案例|回放|不作为真实船舶/)
   assert.deepEqual(answer.actions.map(item=>item.id),['issue:section:处置记录','issue:section:证据资料'])
   assert.equal(eventDirectoryRows(store).find(item=>item.id==='warning-history').actionTaskId,null)
  })
  await t.test('completed event renders operations and responses as one expanded message stream',()=>{
   const store=fresh(),messages=issueConversationMessages('warning-history',store)
   const records=messages.filter(message=>message.eventProcess)
   assert.deepEqual([...new Set(records.map(message=>message.eventPhase))],['发现','研判','派发','执行反馈','验收与观察','闭环'])
   assert.equal(new Set(records.map(message=>message.eventRecordId)).size,8)
   assert.ok(records.filter(message=>message.role==='user').every(message=>message.at.includes('（')))
   assert.ok(records.filter(message=>message.role==='assistant').every(message=>message.expanded))
   for(const text of messages.flatMap(message=>[message.title,message.text,message.markdown]).filter(Boolean))assert.doesNotMatch(text,/参考案例|参考回放|不作为真实船舶/)
   const existing=[...initialIssueMessages('warning-history',store),{id:'question-old',role:'user',text:'保留之前的问题'},{id:'answer-old',role:'assistant',text:'保留之前的答复'}]
   mergeIssueConversation(existing,messages);mergeIssueConversation(existing,messages)
   assert.equal(existing.filter(message=>message.id==='question-old').length,1)
   assert.equal(existing.filter(message=>message.eventProcess).length,records.length)
   assert.equal(existing.filter(message=>message.issueSummary).length,1)
   assert.ok(existing.findIndex(message=>message.id==='question-old')>existing.findLastIndex(message=>message.eventProcess))
   assert.equal(existing.some(message=>message.id?.startsWith('issue-start-user:')),false)
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
   assert.ok(existing.some(message=>message.eventKind==='feedback'&&message.role==='user'))
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
   assert.deepEqual(answer.actions.map(item=>item.id),['issue:section:处置记录','issue:section:健康趋势观测'])
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
