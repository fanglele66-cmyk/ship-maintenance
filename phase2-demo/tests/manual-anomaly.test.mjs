import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {validateAnomalyReport,createManualAnomaly,reportEvidence} from '../src/workflow/manualAnomaly.js'
import {createLifecycleState,visibleEvents,ensureTaskPlan,currentTask,submitTask,refreshLifecyclePresentation,people} from '../src/workflow/eventLifecycle.js'
import {decide} from './helpers/confirmed-decision.mjs'
import {lifecycleWorkItems} from '../src/workflow/lifecycleWorkItems.js'
import {createObservationEvent} from '../src/workflow/observationEvents.js'
import {lifecycleSnapshot,loadLifecycleState} from '../src/workflow/demoTimeline.js'
import {lifecycleModelContext} from '../src/workflow/lifecycleModelContext.js'
import {initialInformationTimes} from '../src/workflow/initialInformationTimes.js'
import {createAiHandler} from '../server/ai-api.mjs'
const form=()=>({deviceId:'main-engine-1',sensorIds:['s-001','s-002'],start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'主机燃油压力现场读数波动，需核对压力趋势。'})
const analysis={title:'主机燃油压力波动核实',summary:'燃油压力波动待核实；核对原始趋势与现场表计。',interpretation:'当前依据为提交人的描述，尚无对应时段采样。',unverified:'缺少时间段内原始趋势及现场表计读数。',recommendation:'安排核对燃油压力趋势与现场表计，记录对应时刻。',steps:[{label:'核对燃油压力记录',guide:'对齐趋势与现场表计的时间。',checks:['记录压力波动范围与时刻。'],recordHint:'回交时刻、压力读数及表计位置。'}]}
function setup(){const state=createLifecycleState(),report=validateAnomalyReport(form(),'secondEngineer');return {state,report,event:createManualAnomaly(state,report,{anomaly:analysis,model:'test'},'test-report-1234')}}
test('selection validates device sensor ownership, time interval and identities',()=>{
 const value=form();assert.equal(validateAnomalyReport(value,'engineer').sensors.length,2)
 assert.equal(validateAnomalyReport({...value,sensorIds:['s-001','s-001']},'engineer').sensors.length,1)
 for(const [bad,pattern] of [[{sensorIds:[]},/传感器/],[{deviceId:'unknown'},/设备/],[{sensorIds:['bogus']},/传感器/],[{end:value.start},/时间段/],[{end:new Date(Date.now()+3600000).toISOString()},/晚于/],[{description:'短'},/描述/]])assert.throws(()=>validateAnomalyReport({...value,...bad},'engineer'),pattern)
 assert.throws(()=>validateAnomalyReport(value,'visitor'),/身份/)
 const local={...value,start:'2026-11-01T12:00',end:'2026-11-01T12:30'};assert.equal(validateAnomalyReport(local,'captain').start,'2026-11-01T04:00:00.000Z')
})
test('only recorded samples within the requested window become evidence',()=>{
 const report=validateAnomalyReport(form(),'engineer'),time=Date.parse(report.start)
 const evidence=reportEvidence(report,[{channelId:'s-001',trendData:[{timestamp:time-1,value:3},{timestamp:time,value:0},{timestamp:time+2,value:null}]}])
 assert.deepEqual(evidence[0].trendData,[{timestamp:time,value:0}]);assert.equal(evidence[1].trendData.length,0)
})
test('validated AI event is idempotent, captain-owned and submitter stays visible through dispatch and closure',()=>{
 const {state,event,report}=setup();assert.equal(event.type,'报警事件');assert.equal(event.phase,'reminder');assert.equal(event.tasks.length,0)
 assert.equal(createManualAnomaly(state,report,{anomaly:analysis},'test-report-1234').id,event.id);assert.equal(state.notices.filter(n=>n.eventId===event.id).length,1)
 assert.ok(lifecycleWorkItems(state).pending.some(i=>i.eventId===event.id))
 state.role='secondEngineer';assert.ok(visibleEvents(state).includes(event));assert.throws(()=>decide(state,event.id,{action:'investigate'}),/轮机长|身份/)
 state.role='engineer';assert.ok(!visibleEvents(state).includes(event))
 state.role='captain';const draft=ensureTaskPlan(event);assert.equal(draft.steps[0].label,analysis.steps[0].label)
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+3600000).toISOString(),reason:analysis.recommendation})
 state.role='secondEngineer';assert.ok(visibleEvents(state).includes(event));assert.equal(lifecycleWorkItems(state).pending.filter(i=>i.eventId===event.id).length,0)
 const task=currentTask(event);state.role='engineer';task.draft.records[0].result='未见异常';task.draft.records[0].note='核对现场表计，未见持续偏离。';submitTask(state,event.id,task.id)
 const observation=createObservationEvent(state,event,task,{reason:'继续核对原压力波动。'});state.role='secondEngineer';assert.ok(visibleEvents(state).includes(observation));assert.equal(observation.submitter.name,people.secondEngineer)
 state.role='captain';decide(state,observation.id,{action:'close',reason:'轮机长核对记录后确认归档。'})
 state.role='secondEngineer';assert.ok(visibleEvents(state).includes(event));assert.ok(visibleEvents(state).includes(observation))
 const saved=lifecycleSnapshot(state),restored=loadLifecycleState({getItem:()=>saved,setItem(){}},createLifecycleState);refreshLifecyclePresentation(restored);restored.role='secondEngineer';assert.ok(visibleEvents(restored).some(e=>e.id===event.id));assert.equal(restored.events[event.id].manualReport.description,report.description)
 assert.notEqual(initialInformationTimes(event).generatedAt,'未记录')
 assert.match(initialInformationTimes(event).submittedAt,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
 assert.deepEqual(lifecycleModelContext(event,'secondEngineer').manualReport.sensors,report.sensors)
})
test('malformed analysis never creates an event',()=>{const state=createLifecycleState(),count=Object.keys(state.events).length;assert.throws(()=>createManualAnomaly(state,validateAnomalyReport(form(),'engineer'),{anomaly:{title:'bad'}},'invalid-report-123'));assert.equal(Object.keys(state.events).length,count)})
test('backend invokes AI with submitted evidence, fixes submitter identity and rejects failed results',async()=>{
 for(const invalid of [false,true]){
  let output='',request
  const config={source:'manual',baseUrl:'https://example.test',apiKey:'test',model:'test',protocol:'openai',enabled:true,knowledgeEnabled:false,maxTokens:2048,timeoutMs:5000}
  const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async(url,options)=>{request=JSON.parse(options.body);const content=JSON.stringify(invalid?{title:'incomplete'}:analysis);return new Response('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})}})
  const req=Readable.from([Buffer.from(JSON.stringify({mode:'manual-anomaly',text:form().description,role:'engineer',stream:true,report:{...form(),submitter:{name:'伪造人'}}}))]);Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5188','x-engine-room-client':'local-ui'}})
  const res={setHeader(){},flushHeaders(){},write(s){output+=s},end(s=''){output+=s;this.writableEnded=true}}
  await handler(req,res,()=>assert.fail('unexpected next'))
  assert.equal(JSON.parse(request.messages[1].content.replace(/^<yincang>|<\/yincang>$/g,'')).report.submitter.name,people.engineer)
  assert.match(request.messages[0].content,/不得编造历史采样/)
  assert.match(output,invalid?/event: error/:/event: done/)
  assert.doesNotMatch(output,/apiKey|伪造人/)
 }
})
