import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {routerKey} from 'vue-router'

test('automatic repair observations accept only human reinspection or closure and retain process receipts',async t=>{
 const start=Date.parse('2026-10-27T00:00:00+08:00'),hour=3600000
 let now=start
 t.mock.method(Date,'now',()=>now)
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {executionPreset}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
  const {storyDossier}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {observationMessages}=await server.ssrLoadModule('/src/message-flows/observationMessages.js')
  const {default:SituationObservation}=await server.ssrLoadModule('/src/components/SituationObservation.vue')
  const ids=['real-alarm-0430','real-warning-0523','real-maintenance-c4-baseline']
  function ready(id){
   now=start
   const pinia=createPinia();setActivePinia(pinia)
   const sensors=useSensorStore()
   sensors.configureSimulation({enabled:false})
   // Supplied test stream, separate from the former manual form and the product's
   // demonstration observation presets. The source retains its own timestamps.
   const stream=Array.from({length:48*60},(_,index)=>({timestamp:start+(index+1)*60000}))
   let availableUntil=Infinity
   sensors.recordedSensorChannels=(channels,from,to)=>channels.map((channelId,index)=>({
    channelId,name:channelId,unit:id==='real-warning-0523'?'MPa':'°C',sourceKind:'prototype-test-fixture',
    trendData:stream.filter(point=>point.timestamp>=from&&point.timestamp<=to&&point.timestamp<=availableUntil)
     .map(point=>({...point,value:id==='real-warning-0523'?[0.66,0.63][index]:id==='real-maintenance-c4-baseline'?[360,361,362,358,361,362][index]:[261,259][index]})),
   }))
   const store=usePhase2DemoStore()
   store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
   const feedback=values=>store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'现场核验已记录：原始反馈唯一内容'}))
   if(id==='real-warning-0523'){store.advanceTodo(id,feedback(['现场与系统一致','工况可比，偏离仍存在']));store.advanceTodo(id)}
   store.advanceTodo(id,feedback(id==='real-maintenance-c4-baseline'?['有提前处理依据','条件具备']:['发现异常','未见异常']))
   const form=store.executionInquiry(id),values={...form.values,...executionPreset(store.cases[id],store.currentStage,'complete'),executedAt:'2026-10-27T00:00',measures:'实际措施唯一原文',acceptance:'验收结果唯一原文'}
   assert.equal(store.confirmExecutionRecord(id,form.id,values),true)
   assert.ok(store.automaticObservations[id])
   const render=()=>{const app=createSSRApp(SituationObservation,{scenario:id});app.use(pinia);app.provide(routerKey,{push(){}});return renderToString(app)}
   return {store,render,limitSamples:until=>{availableUntil=until},sync:hours=>{now=start+hours*hour;return store.syncAutomaticObservation(id,now)}}
  }
  for(const id of ids)await t.test(id+' rejects manual readings, preserves automatic missing data and allows reinspection',async()=>{
   const {store,render,limitSamples,sync}=ready(id)
   const manual={day:0,value0:999,value1:998,conditions:'手填工况不得进入自动数据',note:'手填读数不得进入自动数据'}
   assert.equal(store.submitObservationReview(id,'continue',manual),false)
   assert.equal(store.submitObservationReview(id,'incomplete',manual),false)
   assert.equal(store.observationRecords[id].length,0)
   const html=await render()
   assert.match(html,/class="automatic-status"/) // Status remains visible after explanatory copy was removed.
   assert.match(html,/aria-label="人工处置"/)
   assert.match(html,/>异常复查\s*</)
   assert.match(html,/>确认闭环\s*</)
   assert.doesNotMatch(html,/<input|本次测点读数|已有改善，继续观察/)
   assert.equal(sync(2),true)
   const first=store.observationRecords[id][0]
   assert.ok(first.auto&&first.covered)
   assert.ok(first.values.every(Number.isFinite))
   assert.doesNotMatch(JSON.stringify(first),/手填/)
   const messages=observationMessages(store,id)
   assert.equal(messages.length,1)
   assert.equal(messages[0].role,'assistant','an automatic sample must not impersonate a user submission')
   assert.match(messages[0].title,/自动观察/)
   const target=store.observationTargets[id]
   limitSamples(start+2*hour)
   assert.equal(sync(4),true)
   assert.equal(store.getObservationResult(id).type,'extend')
   assert.equal(store.observationTargets[id],target,'missing windows wait automatically without rewriting the observation target')
   assert.ok(store.observationRecords[id].at(-1).values.every(value=>value===null))
   assert.equal(store.observationRecords[id][0].id,first.id,'missing data does not replace the earlier measured receipt')
   assert.equal(store.submitObservationReview(id,'stable'),false,'missing data cannot be marked stable')
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing')
   assert.equal(store.submitObservationReview(id,'abnormal',{note:'本轮现场异常复查唯一依据'}),true)
   assert.equal(store.observationRecords[id].at(-1).values,null,'reinspection adds a decision, never fabricated measurements')
   assert.equal(store.getObservationResult(id).type,'reinspect')
   assert.match(observationMessages(store,id).at(-2).text,/本轮现场异常复查唯一依据/)
   assert.equal(store.submitObservationReview(id,'stable'),false,'unresolved recurrence blocks closure')
   const receipts=JSON.parse(JSON.stringify(store.observationRecords[id]))
   store.reopenTodo(id)
   assert.deepEqual(store.observationHistory[id][0].records,receipts)
   assert.equal(store.eventStatus[id],'assigned')
  })
  for(const id of ids)await t.test(id+' closure uses covered automatic data without entering extra measurements or notes',()=>{
   const {store,sync}=ready(id)
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing','closure waits for the required observation window')
   assert.equal(sync(store.observationTargets[id]*24),true)
   assert.equal(store.getObservationResult(id).type,'archive')
   const receipts=JSON.stringify(store.observationRecords[id].filter(record=>record.auto))
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'closed')
   assert.equal(JSON.stringify(store.observationRecords[id].filter(record=>record.auto)),receipts,'human closure cannot invent or change sampled readings')
   const confirmations=store.observationRecords[id].filter(record=>!record.auto)
   assert.equal(confirmations.length,1)
   assert.equal(confirmations[0].status,'closed-confirmed')
   assert.equal(confirmations[0].values,null,'closure only appends a human decision to the timeline')
   assert.ok(confirmations[0].actor&&confirmations[0].recordedAt)
   assert.match(storyDossier(store,id).currentMarkdown,/本轮已人工确认结束/)
   assert.equal(store.submitObservationReview(id,'continue',{day:2,value0:1,value1:2,conditions:'conditions',note:'note'}),false)
  })
  for(const id of ids)await t.test(id+' overview and analysis do not duplicate submitted receipts',()=>{
   const {store}=ready(id),root=id==='real-maintenance-c4-baseline'?'real-health-c4-baseline':id
   const dossier=storyDossier(store,root)
   assert.ok(dossier.overviewSummary)
   for(const text of [dossier.overviewSummary,dossier.overviewMarkdown,dossier.analysisMarkdown])assert.doesNotMatch(text,/实际措施唯一原文|验收结果唯一原文|原始反馈唯一内容/)
   assert.equal(dossier.timeline.filter(record=>record.text==='实际措施唯一原文').length,1)
   assert.equal(dossier.timeline.filter(record=>record.assessment==='验收结果唯一原文').length,1)
  })
 }finally{await server.close()}
})
