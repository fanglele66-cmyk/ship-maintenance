import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('observation assistant preserves submitted measures, distinguishes automatic samples and records the actual closure reason',async t=>{
 const start=Date.parse('2026-10-27T08:00:00+08:00')
 let now=start
 t.mock.method(Date,'now',()=>now)
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {observationMessages}=await server.ssrLoadModule('/src/message-flows/observationMessages.js')
  setActivePinia(createPinia())
  const store=usePhase2DemoStore(),id='real-alarm-0430'
  useSensorStore().recordedSensorChannels=ids=>ids.map(channelId=>({channelId,trendData:[]}))
  const history=()=>observationMessages(store,id,store.logs[id])
  const check=()=>store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'未见异常':'发现异常',note:'已核对本轮位置与反馈。'})))
  function accept(executedAt,measures){
   const form=store.executionInquiry(id)
   const items=Object.fromEntries(form.fields.filter(field=>field.acceptanceItem).map(field=>[field.key,'已现场核对 '+field.label]))
   assert.equal(store.confirmExecutionRecord(id,form.id,{...items,executedAt,measures,acceptance:'已核对本轮反馈及密封。',verification:'resolved'}),true)
  }
  assert.ok(store.createTodo(id));store.selectTodo(id);store.advanceTodo(id)
  check();accept('2026-10-27T08:00','核实 ICU 反馈接头；本轮未处理供给阀。')
  store.selectObservation(id)
  now+=2*3600000;store.syncAutomaticObservation(id,now)
  const [sample]=history()
  assert.deepEqual(history().map(entry=>entry.role),['assistant'])
  assert.match(sample.title,/自动观察/)
  assert.match(sample.paragraphs.find(item=>item.label==='本轮实际措施').text,/未处理供给阀/)
  assert.match(sample.markdown,/未处理供给阀/);assert.ok(!history().some(entry=>entry.type==='inquiry'))
  store.sendObservation('再次出现指令与反馈不一致。')
  assert.equal(store.getObservationResult(id).type,'reinspect')
  assert.deepEqual(history().slice(-2).map(entry=>entry.role),['user','assistant'])
  assert.match(history().at(-2).text,/再次出现/)
  store.reopenTodo(id);assert.equal(store.currentStage.round,2)
  check();accept('2026-10-27T10:00','本轮已核对复发时段的反馈。')
  store.selectObservation(id)
  const reason='轮机长确认本次作业结束，缺少后续可比数据，交接继续跟踪。'
  assert.ok(store.completeObservation(id,{reason}).ok)
  assert.equal(history().filter(entry=>entry.role==='user'&&entry.text===reason).length,1)
  assert.equal(history().at(-1).title,'本轮已确认闭环')
  assert.equal(history().at(-1).paragraphs[0].text,reason)
  assert.ok(!history().some(entry=>entry.text?.includes('确认本轮观察无新异常')))
  store.sendObservation('下一步还需要什么？')
  assert.match(store.logs[id].at(-1).text,/本轮已人工确认闭环/)
  assert.equal(store.eventStatus[id],'closed')
 }finally{await server.close()}
})
