import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('observation assistant answers the current event, retains actual measures and records closure',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {observationMessages}=await server.ssrLoadModule('/src/message-flows/observationMessages.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore()
  store.createTodo('fault');store.selectTodo('fault');store.advanceTodo('fault')
  store.advanceTodo('fault',store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'未见异常':'发现异常',note:i?'阀本次未见异常':'滤器通路有实际发现'})))
  const form=store.executionInquiry('fault')
  store.confirmExecutionRecord('fault',form.id,{task0:'已完成',task1:'已完成',equipment:'主机冷却支路',executor:'李建国（大管轮）',measures:'实际清理滤器，未维修阀门',executedAt:'2026-10-15T11:00',acceptance:'出口81.2°C、支路84.6m³/h，复装无泄漏',completion:'completed',verification:'resolved',comparable:'available'})
  store.selectObservation('fault')
  let messages=observationMessages(store,'fault',store.logs.fault)
  assert.deepEqual(messages.map(entry=>entry.role),['user','assistant'])
  assert.match(messages[1].paragraphs.find(item=>item.label==='本轮实际措施').text,/未维修阀门/)
  assert.equal(messages.some(entry=>entry.type==='inquiry'),false)
  store.sendObservation('相近负荷下再次温升，支路流量下降')
  assert.equal(store.getObservationResult('fault').type,'reinspect')
  messages=observationMessages(store,'fault',store.logs.fault)
  assert.deepEqual(messages.slice(-2).map(entry=>entry.role),['user','assistant'])
  assert.match(messages.at(-2).text,/再次温升/)
  store.reopenTodo('fault');assert.equal(store.visibleTodos.length,1)
  store.advanceTodo('fault',store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'发现异常':'未见异常',note:'前轮滤器措施保留，本轮核对调节'})))
  const next=store.executionInquiry('fault')
  store.confirmExecutionRecord('fault',next.id,{task0:'已完成',task1:'已完成',equipment:'主机冷却支路',executor:'李建国（大管轮）',measures:'本轮按实际发现处理调节环节',executedAt:'2026-10-16T09:00',acceptance:'阀动作与流量温度已复测',completion:'completed',verification:'resolved',comparable:'available'})
  store.selectObservation('fault');store.reviewObservation('fault');store.completeObservation('fault')
  messages=observationMessages(store,'fault',store.logs.fault)
  assert.equal(messages.at(-1).title,'本轮已确认闭环')
  store.sendObservation('下一步还需要什么？')
  assert.match(store.logs.fault.at(-1).text,/本轮已人工确认闭环/)
  assert.equal(store.eventStatus.fault,'closed')
 }finally{await server.close()}
})
