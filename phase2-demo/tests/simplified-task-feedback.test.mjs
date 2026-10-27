import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('acceptance is the only work submission and failed acceptance appends an independent investigation round',async t=>{
 const start=Date.parse('2026-10-27T00:00:00+08:00'),hour=3600000
 let now=start
 t.mock.method(Date,'now',()=>now)
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  for(const id of ['real-alarm-0430','real-warning-0523','real-maintenance-c4-baseline'])await t.test(id,()=>{
   now=start
   setActivePinia(createPinia())
   const sensors=useSensorStore();sensors.configureSimulation({enabled:false})
   const frames=Array.from({length:3*60},(_,index)=>({timestamp:start+(index+1)*60000}))
   sensors.recordedSensorChannels=(ids,from,to)=>ids.map((channelId,index)=>({channelId,name:channelId,unit:id==='real-warning-0523'?'MPa':'°C',sourceKind:'prototype-test-fixture',
    trendData:frames.filter(frame=>frame.timestamp>=from&&frame.timestamp<=to).map(frame=>({...frame,value:id==='real-warning-0523'?0.66-index*0.03:400+index}))}))
   const store=usePhase2DemoStore()
   store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
   const check=values=>store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:values[i],note:'第一轮核实原文'})))
   if(id==='real-warning-0523'){check(['现场与系统一致','工况可比，偏离仍存在'])}
   const options=id.includes('maintenance')?['有提前处理依据','条件具备']:['发现异常','未见异常']
   check(options)
   assert.equal(store.currentStage.kind,'work')
   const workId=store.currentStage.id,oldTasks=JSON.stringify(store.currentStage.tasks),oldCount=store.cases[id].stages.length
   const form=store.executionInquiry(id)
   assert.deepEqual(form.fields.filter(field=>!field.acceptanceItem).map(field=>field.key),['executedAt','measures','acceptance','verification'])
   const details=store.currentStage.workDetails||store.cases[id].workDetails
   const expectedRows=details.acceptanceRows||details.acceptance.map((req,i)=>({name:'验收项目 '+(i+1),req}))
   const itemFields=form.fields.filter(field=>field.acceptanceItem)
   assert.ok(itemFields.length>0,'the actual repair scope supplies item-level acceptance fields')
   assert.deepEqual(itemFields.map(field=>({key:field.key,label:field.label,type:field.type,placeholder:field.placeholder})),expectedRows.map((row,i)=>({key:'acceptance_'+i,label:row.name+' · 验收记录',type:'textarea',placeholder:row.req})))
   const itemValues=Object.fromEntries(itemFields.map((field,i)=>[field.key,'第一轮验收项目 '+(i+1)+'：复核原文']))
   const values={...itemValues,executedAt:'2026-10-27T00:00',measures:'第一轮实际处理记录',acceptance:'复测仍有原异常',verification:'unresolved'}
   assert.equal(store.confirmExecutionRecord(id,form.id,{...values,verification:'pending'}),false)
   assert.equal(store.currentStage.id,workId,'pending acceptance must not advance or start a second round')
   assert.equal(store.executionRecords[id]?.length||0,0,'invalid acceptance must not become an execution receipt')
   assert.equal(store.syncAutomaticObservation(id,now),false,'work without a valid acceptance cannot start observation')
   assert.equal(store.confirmExecutionRecord(id,form.id,values),true)
   assert.equal(store.currentStage.kind,'check');assert.match(store.currentStage.id,/-r2$/)
   assert.equal(store.cases[id].stages.length,oldCount+2)
   assert.equal(store.executionRecords[id][0].values.measures,values.measures)
   for(const [key,value] of Object.entries(itemValues))assert.equal(store.executionRecords[id][0].values[key],value,'item-level findings remain in the same execution receipt')
   assert.equal(JSON.stringify(store.cases[id].stages.find(stage=>stage.id===workId).tasks),oldTasks)
   const outcome=check(options)
   assert.equal(outcome.advanced,true);assert.equal(store.currentStage.kind,'work');assert.match(store.currentStage.id,/-r2$/)
   const next=store.executionInquiry(id)
   assert.equal(next.values.measures,undefined)
   assert.equal(store.observationHistory[id][0].status,'not-started')
   assert.equal(store.observationHistory[id][0].records.length,0,'failed first-round acceptance creates no observation data')
   now=start+hour
   assert.equal(store.confirmExecutionRecord(id,next.id,{...values,executedAt:'2026-10-27T01:00',measures:'第二轮实际处理记录',acceptance:'复测通过',verification:'resolved'}),true)
   assert.equal(store.eventStatus[id],'observing');assert.equal(store.executionObservationReady(id),true)
   assert.equal(store.executionRecords[id].length,2)
   assert.equal(store.executionRecords[id][1].values.comparable,'missing')
   assert.equal(store.observationRecords[id].length,0,'acceptance must not invent monitoring data')
   assert.equal(store.isTaskHandled(id),true)
   now=start+3*hour
   assert.equal(store.syncAutomaticObservation(id,now),true)
   const record=store.observationRecords[id][0]
   assert.equal(record.windowStart,new Date(start+hour).toISOString(),'second-round observations begin at the second execution time')
   assert.equal(record.windowEnd,new Date(start+3*hour).toISOString())
   assert.equal(record.executionId,store.executionRecords[id][1].id)
   assert.ok(record.auto&&record.covered&&record.values.every(Number.isFinite))
   assert.equal(store.observationHistory[id][0].records.length,0,'new sensor windows never backfill failed acceptance')
   assert.equal(store.executionRecords[id][0].values.measures,values.measures)
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing','two hours of samples do not bypass the required observation window')
  })
 }finally{await server.close()}
})
