import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {taskAssistantTimeline} from '../src/workflow/taskAssistantTimeline.js'
import {createLifecycleState,decide,submitTask,currentTask,people} from '../src/workflow/eventLifecycle.js'

const at='2026-11-12T03:30:00.000Z'
const task={id:'task-1',kind:'investigation',status:'submitted',submittedAt:at,summary:'已核对接线和现场示值。'}
const report={id:'report-1',taskId:task.id,at}
const question={id:'question',kind:'user',text:'这次记录还需要补充什么？',at:'2026-11-12T03:33:00.000Z'}
const reply={id:'reply',kind:'model',text:'请补充核对时间。',at:question.at}
const receiptId=`task-feedback:${task.id}:${at}`

test('completed task feedback precedes later discussion for all task kinds, without changing chat history',()=>{
 for(const variant of [{kind:'investigation'},{kind:'repair'},{kind:'maintenance'},{kind:'investigation',purpose:'recheck'}]){
  const before={id:'before',kind:'user',text:'检查时应注意什么？',at:'2026-11-12T03:20:00.000Z'}
  const messages=[before,question,reply],snapshot=structuredClone(messages)
  const displayed=taskAssistantTimeline({...task,...variant},messages,[report])
  assert.deepEqual(displayed.map(message=>message.id),['before',receiptId,'question','reply'])
  assert.equal(displayed[1].text,task.summary)
  assert.equal(displayed[1].at,at)
  assert.equal(displayed[3],reply,'streaming replies keep their reactive object identity')
  assert.deepEqual(messages,snapshot,'synthetic receipts never enter model history or persistence')
 }
})

test('a new submission gets its own receipt even when an older report is in the conversation',()=>{
 const old={id:'old-receipt',kind:'receipt',reportId:'old-report',at:'2026-11-12T02:00:00.000Z'}
 const messages=[old,question,reply]
 const displayed=taskAssistantTimeline(task,messages,[{id:'old-report',taskId:task.id,at:old.at},report])
 assert.deepEqual(displayed.map(message=>message.id),[old.id,receiptId,question.id,reply.id])
})

test('an existing submission receipt or generated report is not duplicated',()=>{
 for(const kind of ['receipt','model']){
  const existing={id:'recorded',kind,reportId:report.id,at:'2026-11-12T03:30:03.000Z'}
  const messages=[existing,question,reply]
  assert.equal(taskAssistantTimeline(task,messages,[report]),messages)
  assert.equal(taskAssistantTimeline({...task,reportGeneration:{factReportId:report.id}},messages),messages)
 }
 const legacy=[{id:'legacy',kind:'receipt',reportId:report.id,at},question]
 assert.equal(taskAssistantTimeline(task,legacy),legacy)
})

test('receipt ordering is stable before the first question, at tied timestamps and with legacy missing timestamps',()=>{
 assert.deepEqual(taskAssistantTimeline(task,[],[report]).map(message=>message.id),[receiptId])
 for(const questionAt of [at,'2026-11-12T11:30:00+08:00',undefined]){
  const messages=[{...question,at:questionAt},reply]
  assert.deepEqual(taskAssistantTimeline(task,messages,[report]).map(message=>message.id),[receiptId,question.id,reply.id])
 }
 const before=[{...question,at:'2026-11-12T03:20:00.000Z'}]
 assert.deepEqual(taskAssistantTimeline(task,before,[report]).map(message=>message.id),[question.id,receiptId])
 assert.equal(taskAssistantTimeline({...task,submittedAt:undefined},[question,reply])[0].taskFeedback,true)
})

test('unsubmitted tasks do not acquire a completion receipt',()=>{
 const messages=[question,reply]
 for(const status of ['assigned','waiting','reporting','report-error','terminated'])assert.equal(taskAssistantTimeline({...task,status},messages,[report]),messages)
 assert.equal(taskAssistantTimeline(null,messages),messages)
})

test('the rendered assistant places feedback before captain follow-ups, survives reload and preserves executor/event conversations',async()=>{
 const priorWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const pinia=createPinia();setActivePinia(pinia)
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  useSensorStore().configureSimulation({enabled:false})
  const state=createLifecycleState(),id='real-alarm-0430',event=state.events[id]
  decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
  const work=currentTask(event)
  work.draft.records.forEach(record=>record.result='发现异常')
  work.draft.summary='现场已检查接线，需继续核查液压机构。'
  state.role='engineer';submitTask(state,id,work.id)
  const store=useEventLifecycleStore();store.state.events=state.events;store.state.role='captain'
  const render=extra=>renderToString(createSSRApp({render:()=>h(Assistant,{event:store.state.events[id],taskId:work.id,...extra})}).use(pinia))
  const before=await render();assert.equal((before.match(/本轮反馈已收录/g)||[]).length,1)
  const followups=[{...question,at:new Date(Date.parse(work.submittedAt)+60000).toISOString()},{...reply,at:new Date(Date.parse(work.submittedAt)+61000).toISOString(),status:'complete'}]
  work.conversations.captain=followups
  const after=await render()
  assert.ok(after.indexOf('本轮反馈已收录')<after.indexOf('data-message-id="question"'))
  assert.ok(after.indexOf('data-message-id="question"')<after.indexOf('data-message-id="reply"'))
  assert.equal((after.match(/本轮反馈已收录/g)||[]).length,1)
  assert.equal(work.conversations.captain.length,2)
  store.state.events=JSON.parse(JSON.stringify(store.state.events))
  const reloaded=await render()
  assert.ok(reloaded.indexOf('本轮反馈已收录')<reloaded.indexOf('data-message-id="question"'))
  store.state.role='engineer'
  const executor=await render()
  assert.doesNotMatch(executor,/本轮反馈已收录/)
  assert.equal((executor.match(/反馈已收录，等待轮机长审阅/g)||[]).length,1)
  store.state.role='captain'
  assert.doesNotMatch(await render({taskId:''}),/task-feedback:/,'event assistant uses its existing timeline')
 }finally{disposePinia(pinia);await server.close();if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow}
})
