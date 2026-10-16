import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('tracking archive preserves history and joins only confirmed task evidence',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {trackingDossier,trackingChartLayout}=await server.ssrLoadModule('/src/mock/trackingDossier.js')
  const {deviceHistory}=await server.ssrLoadModule('/src/mock/phase2History.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore()
  const initial=trackingDossier(store,'drift')
  assert.deepEqual(initial.charts[0].values,[5,8,9,10])
  assert.deepEqual(initial.charts[1].values,[425,428,430,432])
  assert.equal(initial.records.length,2)
  assert.equal(initial.charts[0].recordIds[2],null,'10/11 is an observation, not an invented assessment')
  assert.equal(initial.charts[0].recordIds[1],initial.records[0].id)
  assert.equal(initial.established,'2026/10/10 08:00')
  const before=JSON.stringify(initial.records)
  assert.equal(store.createTodo('drift'),true)
  assert.equal(store.assignTask('drift',{...store.defaultAssignment('drift'),type:'现场核实'}),true)
  const assigned=trackingDossier(store,'drift')
  assert.equal(JSON.stringify(assigned.records.slice(0,2)),before)
  assert.equal(assigned.assigned,true);assert.equal(assigned.required,false)
  assert.equal(assigned.ended,false);assert.equal(assigned.direction,initial.direction)
  store.logs.drift.push({id:'draft-only',kind:'recordDraft',records:[{result:'未确认文字'}]})
  assert.equal(trackingDossier(store,'drift').records.some(r=>r.text.includes('未确认文字')),false)
  store.logs.drift.push({id:'confirmed-feedback',kind:'feedbackRecord',submittedAt:'2026/10/14 12:00',actor:'大管轮',records:[{label:'现场读数',result:'432°C，与系统一致'}]})
  const received=trackingDossier(store,'drift')
  assert.equal(received.records.filter(r=>r.id==='confirmed-feedback').length,1)
  assert.match(received.analysisStatus,/待更新/)
  assert.equal(received.analysisAt,initial.analysisAt,'task feedback does not fake a new analysis')
  assert.equal(received.ended,false)
  assert.deepEqual(trackingDossier(store,'drift').records,received.records,'rereading is idempotent')
  const watch=trackingDossier(store,'cyl4-watch'),ended=trackingDossier(store,'cyl2-ended'),air=trackingDossier(store,'air-delivery')
  assert.equal(watch.required,false);assert.equal(ended.ended,true);assert.match(ended.closure.basis,/未检查或维修/)
  assert.deepEqual(air.charts[0].values,[95,112,128]);assert.doesNotMatch(air.conditions,/rpm|逐缸/)
  assert.equal(air.established,'建档时间尚未取得')
  store.createTodo('air-delivery');store.progress['air-delivery']=1;store.activeStage['air-delivery']=1
  const airStage=store.cases['air-delivery'].stages[1]
  const unknown=airStage.tasks.map(task=>({label:task.label,result:'无法确认',note:'现场条件不足'}))
  assert.equal(store.advanceTodo('air-delivery',unknown).advanced,false)
  assert.equal(store.progress['air-delivery'],1)
  assert.equal(trackingDossier(store,'air-delivery').records.filter(r=>r.type==='feedback').length,1)
  store.advanceTodo('air-delivery',unknown)
  assert.equal(trackingDossier(store,'air-delivery').records.filter(r=>r.type==='feedback').length,1,'duplicate confirmed outcomes are not new findings')
  const noFinding=airStage.tasks.map(task=>({label:task.label,result:'未见异常',note:'未取得处置依据'}))
  assert.equal(store.advanceTodo('air-delivery',noFinding).advanced,false)

  const archives=deviceHistory(store).filter(r=>r.id.startsWith('tracking-'))
  assert.equal(archives.length,5);assert.equal(archives.find(r=>r.target==='air-delivery').deviceId,'air-compressor')
  const chart=trackingChartLayout({labels:['10/09 08:00','10/10 08:00','10/12 08:00'],values:[5,null,10]})
  assert.equal(chart.timed,true);assert.equal(chart.segments.length,2)
  assert.equal(chart.points.length,2)
  const spaced=trackingChartLayout({labels:['10/09 08:00','10/10 08:00','10/12 08:00'],values:[5,8,10]})
  assert.equal(spaced.points[1].x-spaced.points[0].x,180)
  assert.equal(spaced.points[2].x-spaced.points[1].x,360)
  const {seedMaintenanceEvidence}=await server.ssrLoadModule('/src/mock/maintenanceExample.js')
  setActivePinia(createPinia());const shared=usePhase2DemoStore();seedMaintenanceEvidence(shared)
  const joined=trackingDossier(shared,'drift')
  assert.deepEqual(joined.charts[0].values,[5,8,9,10],'maintenance evidence supplements, never replaces tracking history')
  assert.equal(joined.charts[0].key,'gap')
  assert.equal(joined.records.filter(r=>r.id==='injector-demo-evidence').length,1)
  assert.ok(joined.records.some(r=>r.id==='drift-assessment-0'))

 }finally{await server.close()}
})

test('tracking navigation preserves archive/task context and maintenance routing',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {issueDetailPath}=await server.ssrLoadModule('/src/utils/maintenanceNavigation.js')
  const {trackingReturnLocation}=await server.ssrLoadModule('/src/utils/trackingNavigation.js')
  const {dispatchReturnLocation}=await server.ssrLoadModule('/src/mock/dispatchNavigation.js')
  assert.match(issueDetailPath('maintenance'),/^\/situation\/maintenance\//,'maintenance remains in its separate detail flow')
  assert.equal(issueDetailPath('drift'),'/situation/issue/drift','legacy issue links remain compatible and redirect in the router')
  assert.equal(issueDetailPath('fault'),'/situation/issue/fault')
  assert.deepEqual(trackingReturnLocation({returnTracking:'1',todo:'drift'}),{path:'/event',query:{todo:'drift'}})
  const query={from:'history',device:'air-compressor',category:'attention',scroll:'180'}
  assert.equal(trackingReturnLocation(query).query.restoreTab,'history')
  assert.equal(dispatchReturnLocation({path:'/situation/attention/air-delivery',query}).query.restoreDevice,'air-compressor')
  assert.equal(dispatchReturnLocation({path:'/situation/attention/air-delivery',query}).query.scroll,'180')
 }finally{await server.close()}
})
