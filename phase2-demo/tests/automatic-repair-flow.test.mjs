import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'

const minute=60000,hour=60*minute
const firstExecution=Date.parse('2026-10-20T08:00:00+08:00')
const executionText=time=>new Date(time+8*hour).toISOString().slice(0,16)

test('automatic repair observation uses emitted-time samples and requires human closure',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const originalNow=Date.now,pinias=[]
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {observationRoundViews}=await server.ssrLoadModule('/src/mock/observationRounds.js')

  function context({missing=()=>false}={}){
   const clock={value:firstExecution+minute}
   Date.now=()=>clock.value
   const pinia=createPinia();pinias.push(pinia);setActivePinia(pinia)
   const sensors=useSensorStore();sensors.configureSimulation({enabled:false})
   // These fixture frames have absolute acquisition times. Queries only select
   // frames; they never move an old sample to the repair date or fill a gap.
   const frames=Array.from({length:75*60+1},(_,index)=>({timestamp:firstExecution+(index-60)*minute,sequence:index-60}))
   const requests=[]
   sensors.recordedSensorChannels=(ids,start,end)=>{
    requests.push({ids:[...ids],start,end})
    return ids.map((id,index)=>({channelId:id,name:id,unit:id.includes('pressure')?'bar':'°C',sourceKind:'prototype-fixture',
     trendData:frames.filter(frame=>frame.timestamp>=start&&frame.timestamp<=end).map(frame=>({timestamp:frame.timestamp,
      value:missing(id,frame.timestamp)?null:(id.includes('pressure')?6.7:400+index+frame.sequence/10000)}))}))
   }
   return {store:usePhase2DemoStore(),sensors,clock,requests,frames}
  }
  function reachWork(store,id){
   store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
   const feedback=values=>store.currentStage.tasks.map((task,index)=>({label:task.label,result:values[index],note:'现场核验依据；测试记录不代表实船结论'}))
   if(id==='real-warning-0523'){
    store.advanceTodo(id,feedback(['现场与系统一致','工况可比，偏离仍存在']))
    store.advanceTodo(id)
   }
   store.advanceTodo(id,feedback(id==='real-maintenance-c4-baseline'?['有提前处理依据','条件具备']:['发现异常','未见异常']))
   assert.ok(store.executionInquiry(id),'checks must reach a real execution inquiry')
  }
  function accept(store,id,time=firstExecution,verification='resolved'){
   const form=store.executionInquiry(id)
   assert.ok(form)
   assert.equal(store.confirmExecutionRecord(id,form.id,{executedAt:executionText(time),measures:'已实施本轮现场措施',acceptance:'已记录本轮现场验收结果',verification}),true)
  }
  function repair(context,id,time=firstExecution){reachWork(context.store,id);accept(context.store,id,time)}
  function sync(context,id,elapsedHours){context.clock.value=firstExecution+elapsedHours*hour;return context.store.syncAutomaticObservation(id)}

  await t.test('resolved acceptance starts with a partial window and never invents a first measurement',()=>{
   const ctx=context(),{store}=ctx,id='real-alarm-0430'
   assert.equal(store.syncAutomaticObservation(id),false)
   reachWork(store,id)
   assert.equal(store.syncAutomaticObservation(id),false,'work instructions alone do not start observation')
   accept(store,id)
   assert.equal(store.eventStatus[id],'observing')
   assert.equal(store.observationRecords[id].length,0)
   const auto=store.automaticObservations[id]
   assert.equal(auto.executionId,store.executionRecords[id][0].id)
   assert.equal(auto.pending.status,'pending')
   assert.equal(auto.pending.complete,false)
   assert.equal(auto.pending.covered,false)
   assert.equal(auto.pending.sampleCount,2,'only the two samples after execution belong to pending')
   assert.deepEqual(auto.pending.values,[400,401],'source adapter retains three-decimal measurement precision')
   assert.equal(auto.sourceKind,'prototype')
   assert.match(auto.source,/非实船实时数据/)
   assert.match(auto.pending.note,/不等同于.*修复成功/)
   assert.equal(store.getObservationResult(id).type,'continue')
   assert.equal(store.submitObservationReview(id,'stable'),false)
   assert.equal(store.submitObservationReview(id,'continue',{day:0,value0:1,value1:2,conditions:'相近负荷',note:'人工传感器值'}),false)
   assert.equal(store.submitObservationReview(id,'incomplete',{day:0,conditions:'缺测',note:'人工填写'}),false)
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing')
  })

  await t.test('each completed two-hour window is stored once with original boundaries and source',()=>{
   const ctx=context(),{store}=ctx,id='real-alarm-0430';repair(ctx,id)
   assert.equal(sync(ctx,id,2),true)
   const first=store.observationRecords[id][0],journalCount=store.storyJournal.length,requestCount=ctx.requests.length
   assert.equal(first.auto,true)
   assert.equal(first.status,'observed')
   assert.equal(first.covered,true)
   assert.equal(first.sampleCount,240)
   assert.equal(first.day,2/24)
   assert.equal(first.windowStart,new Date(firstExecution).toISOString())
   assert.equal(first.windowEnd,new Date(firstExecution+2*hour).toISOString())
   assert.deepEqual(first.values,[400.012,401.012])
   assert.equal(first.sourceKind,'prototype-fixture')
   assert.equal(first.isSimulation,true)
   assert.equal(store.automaticObservations[id].pending,null)
   assert.equal(sync(ctx,id,2),false)
   assert.equal(sync(ctx,id,3),false)
   assert.equal(ctx.requests.length,requestCount,'no source read before the next scheduled boundary')
   assert.equal(store.storyJournal.length,journalCount)
   assert.equal(sync(ctx,id,4),true)
   assert.equal(store.observationRecords[id].length,2)
   assert.equal(new Set(store.observationRecords[id].map(record=>record.id)).size,2)
   assert.equal(store.storyJournal.length,journalCount+1)
   assert.equal(store.observationRecords[id][0].recordedAt,first.recordedAt,'later synchronization preserves saved receipts')
   assert.ok(ctx.requests.every(request=>request.start===firstExecution&&request.end<=ctx.clock.value))
   assert.equal(store.eventStatus[id],'observing')
  })

  await t.test('missing safety pressure remains null, while converted pressure keeps its units',()=>{
   const ctx=context({missing:id=>id==='main-control-air-safety-pressure'}),{store}=ctx,id='real-warning-0523';repair(ctx,id)
   sync(ctx,id,24)
   assert.equal(store.observationRecords[id].length,12)
   assert.ok(store.observationRecords[id].every(record=>record.status==='incomplete'&&!record.covered))
   assert.deepEqual(store.observationRecords[id].at(-1).values,[0.67,null])
   assert.deepEqual(store.observationRecords[id].at(-1).channels.map(channel=>channel.unit),['MPa','MPa'])
   assert.equal(store.getObservationResult(id).type,'extend')
   assert.equal(store.getObservationResult(id).coveredHours,0)
   assert.equal(store.observationReady[id],false)
   assert.equal(store.submitObservationReview(id,'stable'),false)
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing','elapsed time cannot close a missing-data window')
  })

  for(const [id,targetHours] of [['real-alarm-0430',24],['real-maintenance-c4-baseline',48]])await t.test(id+' requires '+targetHours+' hours of coverage and an explicit human closure',()=>{
   const ctx=context(),{store}=ctx;repair(ctx,id)
   assert.equal(store.observationTargets[id]*24,targetHours)
   sync(ctx,id,targetHours-2)
   assert.equal(store.getObservationResult(id).type,'continue')
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing')
   sync(ctx,id,targetHours)
   assert.equal(store.getObservationResult(id).coveredHours,targetHours)
   assert.equal(store.getObservationResult(id).type,'archive')
   assert.equal(store.observationReady[id],true)
   assert.equal(store.eventStatus[id],'observing','coverage only makes a human decision available')
   assert.ok(store.observationRecords[id].every(record=>record.auto&&record.status==='observed'))
   const samples=JSON.stringify(store.observationRecords[id].filter(record=>record.auto))
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'closed')
   assert.equal(JSON.stringify(store.observationRecords[id].filter(record=>record.auto)),samples,'human closure must not fabricate or rewrite sensor points')
   const confirmations=store.observationRecords[id].filter(record=>!record.auto)
   assert.equal(confirmations.length,1)
   assert.equal(confirmations[0].status,'closed-confirmed')
   assert.equal(confirmations[0].values,null,'the human confirmation is a timeline decision without measurements')
   assert.ok(confirmations[0].actor&&confirmations[0].recordedAt)
   const state=JSON.stringify(store.automaticObservations[id]),requests=ctx.requests.length
   assert.equal(sync(ctx,id,targetHours+2),false)
   assert.equal(JSON.stringify(store.automaticObservations[id]),state)
   assert.equal(ctx.requests.length,requests)
   assert.equal(store.submitObservationReview(id,'abnormal'),false)
  })

  await t.test('a missing earlier window cannot be hidden by the latest healthy-looking readings',()=>{
   const ctx=context({missing:(_id,time)=>time>firstExecution+4*hour&&time<=firstExecution+6*hour}),{store}=ctx,id='real-alarm-0430';repair(ctx,id)
   sync(ctx,id,24)
   assert.equal(store.observationRecords[id][2].status,'incomplete')
   assert.deepEqual(store.observationRecords[id][2].values,[null,null])
   assert.equal(store.getObservationResult(id).coveredHours,18)
   assert.equal(store.getObservationResult(id).type,'continue')
   store.completeObservation(id)
   assert.equal(store.eventStatus[id],'observing')
   sync(ctx,id,30)
   assert.equal(store.getObservationResult(id).coveredHours,24)
   assert.equal(store.getObservationResult(id).type,'archive','24 subsequent complete hours can establish coverage without deleting the gap')
   assert.equal(store.observationRecords[id][2].status,'incomplete')
  })

  await t.test('reinspection archives automatic records and pending samples, then isolates the next execution',()=>{
   const ctx=context(),{store}=ctx,id='real-alarm-0430';repair(ctx,id)
   sync(ctx,id,3)
   const first=store.observationRecords[id][0],firstExecutionId=first.executionId,pending=store.automaticObservations[id].pending
   assert.equal(pending.sampleCount,120)
   assert.equal(store.submitObservationReview(id,'abnormal',{note:'现场发现原异常再次出现，复查依据已记录'}),true)
   assert.equal(store.getObservationResult(id).type,'reinspect')
   store.reopenTodo(id)
   assert.equal(store.observationRounds[id],2)
   assert.equal(store.workflowRounds[id],2)
   assert.equal(store.observationHistory[id].length,1)
   const history=store.observationHistory[id][0]
   assert.equal(history.execution.id,firstExecutionId)
   assert.equal(history.automatic.pending.windowEnd,pending.windowEnd)
   assert.equal(history.automatic.pending.sampleCount,120)
   assert.equal(history.records[0].id,first.id)
   assert.match(history.records.at(-1).note,/现场发现原异常/)
   first.values[0]=999;pending.values[0]=999
   assert.notEqual(history.records[0].values[0],999,'archived readings are independent snapshots')
   assert.notEqual(history.automatic.pending.values[0],999)
   assert.equal(store.automaticObservations[id],undefined)
   assert.equal(store.observationRecords[id].length,0)
   const requests=ctx.requests.length
   assert.equal(sync(ctx,id,5),false,'previous execution cannot restart automatic observation during reinspection')
   assert.equal(ctx.requests.length,requests)
   store.advanceTodo(id,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'未见异常':'发现异常',note:'复查现场证据'})))
   ctx.clock.value=firstExecution+6*hour+minute
   accept(store,id,firstExecution+6*hour)
   const secondExecutionId=store.executionRecords[id].at(-1).id
   assert.notEqual(secondExecutionId,firstExecutionId)
   assert.equal(store.automaticObservations[id].pending.sampleCount,2)
   assert.equal(store.observationRecords[id].length,0)
   sync(ctx,id,8)
   assert.equal(store.observationRecords[id].length,1)
   assert.equal(store.observationRecords[id][0].executionId,secondExecutionId)
   assert.equal(store.observationRecords[id][0].windowStart,new Date(firstExecution+6*hour).toISOString())
   assert.deepEqual(store.observationRecords[id][0].values,[400.048,401.048])
   const rounds=observationRoundViews(store,id)
   assert.deepEqual(rounds.map(round=>round.round),[1,2])
   assert.equal(rounds[0].automatic.executionId,firstExecutionId)
   assert.equal(rounds[1].automatic.executionId,secondExecutionId)
   assert.equal(rounds[0].result.type,'reinspect')
   assert.equal(rounds[1].result.type,'continue')
  })

  await t.test('failed acceptance and tracking-only tasks never start automatic repair observation',()=>{
   const ctx=context(),{store}=ctx,id='real-alarm-0430'
   reachWork(store,id);accept(store,id,firstExecution,'unresolved')
   assert.equal(store.workflowRounds[id],2)
   assert.equal(store.automaticObservations[id],undefined)
   assert.equal(sync(ctx,id,24),false)
   assert.equal(store.observationRecords[id].length,0)
   assert.equal(store.observationHistory[id][0].status,'not-started')
   assert.equal(store.observationHistory[id][0].automatic,null)
   assert.equal(store.syncAutomaticObservation('real-health-c4-baseline'),false)
   assert.equal(ctx.requests.length,0)
  })
 }finally{
  Date.now=originalNow
  pinias.forEach(disposePinia)
  await server.close()
 }
})
