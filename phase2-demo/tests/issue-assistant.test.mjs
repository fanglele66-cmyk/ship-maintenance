import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'

test('issue conversations use the selected evidence and never dispatch from chat',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {initialIssueMessages,issueReply}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {workflowCases}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const store={todoCreated:{},ignoredSuggestions:{},assignments:{},cases:workflowCases,progress:{},unlockedRecommendations:{fault:true,'main-warning':true,'aux-health':true,maintenance:true}}
  for(const id of ['fault','main-warning','aux-health','maintenance']){
   const messages=initialIssueMessages(id,store)
   assert.deepEqual(messages.map(item=>item.role),['user','assistant'])
   assert.ok(messages[1].paragraphs.find(p=>p.label==='判断边界').text)
   assert.equal(messages[1].actions.length,2)
   assert.ok(issueReply(id,'还需核实哪些信息？',store).paragraphs.find(p=>p.label==='尚需核对').text)
  }
  const before=JSON.stringify(store)
  assert.match(issueReply('aux-health','采纳并派发',store).paragraphs[1].text,/不会自动建立任务/)
  assert.equal(JSON.stringify(store),before)
  store.todoCreated['aux-health']=true;store.assignments['aux-health']={owner:'赵明（三管轮）'}
  const assigned=issueReply('aux-health','下一步如何安排？',store)
  assert.match(assigned.paragraphs[0].text,/赵明.*不重复安排/)
  assert.equal(assigned.actions[0].id,'issue:task')
  store.ignoredSuggestions.maintenance={reason:'保留原周期'}
  assert.match(issueReply('maintenance','下一步',store).paragraphs[0].text,/保留原周期/)
 }finally{await server.close()}
})
