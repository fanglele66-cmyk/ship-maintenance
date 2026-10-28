import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'

test('real check submission anchors repair advice after the saved form, excluding a pending acceptance draft',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const pinia=createPinia();setActivePinia(pinia)
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {workflowAdvice,reconcileWorkflowAdvice,presentWorkflowConversation}=await server.ssrLoadModule('/src/message-flows/assistantPresentation.js')
  const {eventBriefingFor}=await server.ssrLoadModule('/src/mock/eventBriefings.js')
  useSensorStore().configureSimulation({enabled:false})
  const store=usePhase2DemoStore(),id='real-alarm-0430',conversation={}
  store.ensureAssignmentDraft(id)
  assert.equal(store.submitSharedAssignment(id).ok,true)
  store.selectTodo(id);store.advanceTodo(id)
  assert.equal(store.cases[id].stages[store.progress[id]].kind,'check')
  const advice=()=>workflowAdvice(store,id,{audience:'assignee',brief:eventBriefingFor(id)})
  const rows=()=>store.logs[id].filter(row=>row.audience!=='captain')
  reconcileWorkflowAdvice(conversation,rows(),advice())
  const form=store.stageFeedbackForm(id)
  store.updateStageFeedback(id,Object.fromEntries(form.fields.map(field=>[field.key,field.key.startsWith('result_')?'发现异常':'现场已确认 ICU 液压活塞卡滞，燃油供给另行记录。'])),form.id)
  assert.equal(store.submitStageFeedback(id,form.id).ok,true)
  assert.equal(store.cases[id].stages[store.progress[id]].kind,'work')
  // The work panel creates the next acceptance form before the repair is done.
  store.requestExecutionRecord(id)
  assert.ok(rows().some(row=>row.purpose==='execution-record'&&row.status==='pending'))
  reconcileWorkflowAdvice(conversation,rows(),advice(),{animate:true})
  const visible=rows().filter(row=>!(row.purpose==='execution-record'&&row.status==='pending'))
  const projected=presentWorkflowConversation(visible,advice(),conversation.adviceHistory)
  const feedback=projected.findIndex(row=>row.kind==='feedbackRecord')
  const current=projected.findIndex(row=>row.currentAdvice)
  assert.ok(feedback>=0)
  assert.match(projected[feedback].title,/李建国（大管轮）提交了排查结果/)
  assert.ok(current>feedback,'new repair advice follows the submitted check form')
  assert.ok(projected.slice(0,feedback).some(row=>row.presentation==='advice'),'initial check advice remains before the form')
  assert.equal(projected.filter(row=>row.purpose==='execution-record'&&row.status==='pending').length,0)
  const withDrafts=presentWorkflowConversation(rows(),advice(),conversation.adviceHistory)
  assert.deepEqual(withDrafts.map(row=>row.id),projected.map(row=>row.id),'projection owns the same pending-form filter as the snapshot anchor')
 }finally{disposePinia(pinia);await server.close()}
})
