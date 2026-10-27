import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('event briefings explain decisions using selected evidence and retain live workflow context',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {issueReply}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {eventProcessRecords}=await server.ssrLoadModule('/src/mock/eventProcessRecords.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore()
  const ids=['real-alarm-0430','real-warning-0523','real-tracking-exhaust-baseline','real-health-c4-baseline']
  for(const id of ids){
   const before=JSON.stringify(store.todoCreated)
   const answer=issueReply(id,'为什么需要轮机长判断并指派？',store)
   if(id==='real-health-c4-baseline'){
    assert.match(answer.markdown,/首轮核实已回交，待轮机长再次决策/)
    assert.match(answer.markdown,/尚未开展维修及修后效果观察/)
    assert.equal(answer.actions[0].id,'issue:section:decision')
   }else assert.match(answer.markdown,/需要您确认|建议指派的原因/)
   assert.ok(answer.markdown.length>200)
   const source=issueReply(id,'依据哪些数据和资料？',store)
   assert.doesNotMatch(source.markdown,/[A-Z]:[\\/]|ship_sop|模拟|演示|null|undefined/)
   assert.match(source.markdown,/2026-/)
   assert.equal(JSON.stringify(store.todoCreated),before,'answering must not dispatch')
  }
  const tracking='real-tracking-exhaust-baseline'
  assert.match(issueReply(tracking,'核实正常、异常和无法确认分别怎么办？',store).markdown,/历史记录|测温|基线/)
  assert.match(issueReply(tracking,'如何发现？',store).markdown,/AI|两段/)
  assert.equal(eventProcessRecords(store,'real-alarm-0430').records[0].actor,'船端报警系统')
  assert.equal(eventProcessRecords(store,'real-warning-0523').records[0].actor,'智能机舱监测')
  assert.equal(store.createTodo(tracking),true)
  const assigned=issueReply(tracking,'下一步怎么核实？',store)
  assert.equal(assigned.actions[0].id,'issue:task')
  assert.match(assigned.markdown,/已派发|原任务/)
  assert.match(store.assignments[tracking].scope,/月度工况|测温通道/)
  store.selectTodo(tracking);store.advanceTodo(tracking)
  store.advanceTodo(tracking,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'信息已记录':'现场与系统一致',note:'已核对六缸月度配对记录与调整履历，未确认项留存。'})))
  assert.match(issueReply(tracking,'当前核实结果是什么？',store).markdown,/已提交反馈后的进展|本轮判断|实际读数/)
 }finally{await server.close()}
})
