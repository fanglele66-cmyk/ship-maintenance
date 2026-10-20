import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('maintenance assessments stay within their health tracking and preserve executable task identities',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {workbenchIssues,activeWorkbenchIssues,issueTypes,isIssueClosed,issueCatalog}=await server.ssrLoadModule('/src/mock/captainWorkbench.js')
  const {parentIssueId,maintenanceChildIds,maintenanceRecommendations,canonicalIssueRoute}=await server.ssrLoadModule('/src/mock/issueRelationships.js')
  const {relatedEvents}=await server.ssrLoadModule('/src/mock/r06Events.js')
  const {storyTimeline,storyRevision,sourceTrack}=await server.ssrLoadModule('/src/mock/storyRecords.js')
  const {storyDossier,deviceStoryAssessment}=await server.ssrLoadModule('/src/mock/fourStoryWorkflow.js')
  const {issueContext,issueReply}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {realCaseRecords}=await server.ssrLoadModule('/src/mock/realCaseAdapter.js')
  const fresh=()=>{setActivePinia(createPinia());return usePhase2DemoStore()}
  const child='real-maintenance-0523',parent='real-health-0523'
  await t.test('three event types and four initial matters retain three source problems without exposing child events',()=>{
   const store=fresh(),rows=activeWorkbenchIssues(store)
   assert.deepEqual(issueTypes,['报警事件','预警事件','异动跟踪'])
   assert.deepEqual(rows.map(row=>row.id),['real-alarm-0430','real-warning-0523','real-tracking-0816',parent])
   assert.equal(new Set(rows.map(row=>row.sourceEventId)).size,3)
   assert.equal(rows.some(row=>row.id===child),false)
   assert.equal(rows.find(row=>row.id===parent).decisionId,child)
   assert.equal(rows.find(row=>row.id===parent).maintenanceRecommendations[0].id,child)
   assert.equal(store.cases[child].workflowKind,'maintenance')
   assert.equal(store.cases[child].cardType,'异动跟踪')
   assert.deepEqual(store.cases[parent].relatedIssueIds,['real-warning-0523'])
   assert.equal(store.createTodo(parent),false)
   assert.equal(store.selectTodo(parent),false)
   assert.equal(store.visibleTodos.length,0)
  })
  await t.test('existing child state maps to one parent event while its execution identity remains available',()=>{
   const store=fresh()
   // Represents an already stored task under the previous public ID.
   store.todoCreated[child]=true;store.eventStatus[child]='assigned'
   store.assignTask(child,{...store.defaultAssignment(child),owner:'李建国（大管轮）'})
   const row=workbenchIssues(store).find(row=>row.id===parent)
   assert.equal(row.state,'已派发');assert.equal(row.taskId,child)
   assert.equal(store.visibleTodos[0].id,child)
   assert.deepEqual(store.eventPortfolio.map(item=>item.id),[parent])
   assert.deepEqual(relatedEvents(store).map(item=>({id:item.id,taskId:item.taskId,taskIds:item.taskIds})),[{id:parent,taskId:child,taskIds:[child]}])
   assert.equal(issueContext(parent,store).taskId,child)
   assert.equal(issueReply(parent,'下一步',store).actions[0].id,'issue:task')
   assert.match(storyTimeline(store,parent).find(item=>item.kind==='assignment').text,/李建国/)
   assert.notEqual(storyRevision(store,parent),'origin')
  })
  await t.test('health verification gates a recommendation; new recommendation does not create another event',()=>{
   const store=fresh();store.unlockedRecommendations['aux-health']=true
   assert.deepEqual(maintenanceRecommendations(store,'aux-health'),[])
   assert.equal(store.createTodo('aux-maintenance'),false)
   store.createTodo('aux-health');store.selectTodo('aux-health');store.advanceTodo('aux-health')
   store.advanceTodo('aux-health',store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:'同刻读数和相近负荷已记录；同源显示不等于校准'})))
   store.decideCheck('aux-health','finish-tracking','核实完成，继续健康趋势观测')
   assert.equal(isIssueClosed(store,'aux-health'),false,'ending verification does not close the health record')
   store.advanceHealthTrack('aux2-health')
   assert.equal(maintenanceRecommendations(store,'aux-health').length,0)
   store.advanceHealthTrack('aux2-health')
   assert.equal(maintenanceRecommendations(store,'aux-health').length,1)
   const row=activeWorkbenchIssues(store).find(item=>item.id==='aux-health')
   assert.equal(row.decisionId,'aux-maintenance')
   assert.equal(workbenchIssues(store).some(item=>item.id==='aux-maintenance'),false)
   assert.equal(store.createTodo('aux-maintenance'),true)
   assert.deepEqual(store.eventPortfolio.map(item=>item.id),['aux-health'])
   assert.equal(relatedEvents(store).length,1)
   assert.deepEqual(relatedEvents(store)[0].taskIds,['aux-health','aux-maintenance'])
   assert.equal(relatedEvents(store)[0].taskId,'aux-maintenance')
   assert.equal(sourceTrack('aux-maintenance',store).id,'aux2-health')
  })
  await t.test('recorded decisions and executions remain on the parent without declaring full health closure',()=>{
   const store=fresh(),raw=JSON.stringify(realCaseRecords)
   store.createTodo(child);store.selectTodo(child);store.advanceTodo(child)
   store.advanceTodo(child,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'条件具备':'有提前处理依据',note:'按实际取得资料记录本轮范围'})))
   const inquiry=store.executionInquiry(child)
   assert.ok(inquiry)
   assert.equal(store.confirmExecutionRecord(child,inquiry.id,{
    ...Object.fromEntries(store.currentStage.tasks.map((_,index)=>['task'+index,'已完成'])),
    equipment:'控制空气减压阀',measures:'完成批准范围检查，未更换减压阀',executedAt:'2026-10-20T10:00',executor:'李建国（大管轮）',
    acceptance:'本轮检查范围已记录；永久更换仍待实际安排',completion:'completed',verification:'resolved',comparable:'missing',
   }),true)
   assert.match(storyDossier(store,parent).currentMarkdown,/未更换减压阀/)
   assert.match(storyDossier(store,parent).currentMarkdown,/缺可比记录/)
   assert.match(deviceStoryAssessment(store,'main-engine-1').basis,/未更换减压阀/)
   assert.ok(storyTimeline(store,parent).some(row=>row.kind==='execution'))
   assert.equal(isIssueClosed(store,parent),false)
   assert.equal(JSON.stringify(realCaseRecords),raw,'raw historical evidence remains immutable')
   const other=fresh();other.ignoreSuggestion(child,'暂不提前，保留原后续检查安排')
   assert.equal(workbenchIssues(other).find(row=>row.id===parent).state,'已记录决定')
   assert.match(issueContext(parent,other).next,/保留原后续检查/)
   assert.equal(isIssueClosed(other,parent),false)
  })
  await t.test('legacy deep links map to parent health tab; task links and unrelated routes are preserved',()=>{
   for(const [childId,parentId] of [['maintenance','bearing-health'],['aux-maintenance','aux-health'],[child,parent]]){
    assert.equal(parentIssueId(childId),parentId)
    assert.deepEqual(maintenanceChildIds(parentId),[childId])
    const target=canonicalIssueRoute({params:{section:'maintenance',attentionId:childId},query:{from:'device',device:'main-engine-1'},hash:'#record'})
    assert.equal(target.path,'/situation/issue/'+parentId)
    assert.deepEqual(target.query,{from:'device',device:'main-engine-1',tab:'健康趋势观测',recommendation:childId})
    assert.equal(target.hash,'#record')
   }
   assert.equal(canonicalIssueRoute({params:{attentionId:parent},query:{}}),null)
   assert.equal(canonicalIssueRoute({params:{},query:{todo:child}}),null)
  })
  await t.test('historical maintenance decision belongs to its original tracking rather than a renamed event',()=>{
   const store=fresh()
   assert.equal(issueCatalog.some(item=>item.id==='maintenance-history'),false)
   assert.equal(store.openRealCase('bearing-health'),true)
   const history=storyTimeline(store,'bearing-health').find(item=>item.id==='maintenance-history')
   assert.equal(history.at,'2026-10-08 10:00')
   assert.match(history.text,/资料不足以支持提前处理/)
   assert.match(history.assessment,/原常规计划继续有效/)
   assert.equal(store.createTodo('bearing-health'),false)
   assert.equal(maintenanceRecommendations(store,'bearing-health')[0].id,'maintenance')
   assert.equal(maintenanceRecommendations(store,'aux-health').length,0)
   const route=canonicalIssueRoute({params:{attentionId:'maintenance-history'},query:{}})
   assert.equal(route.path,'/situation/issue/bearing-health')
   assert.equal(route.query.record,'maintenance-history')
   assert.equal(route.query.recommendation,undefined)
  })
 }finally{await server.close()}
})
