import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('event directory retains every lifecycle while execution remains a separate dimension',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try {
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {eventDirectoryRows,filterEventDirectory,eventDirectoryDeviceOptions,eventStatusOptions}=await server.ssrLoadModule('/src/mock/eventDirectory.js')
  const {workbenchIssues}=await server.ssrLoadModule('/src/mock/captainWorkbench.js')
  const fresh=()=>{setActivePinia(createPinia());return usePhase2DemoStore()}
  const rowFor=(store,id)=>eventDirectoryRows(store).find(row=>row.id===id)
  const dispatch=(store,id)=>{assert.equal(store.createTodo(id),true);assert.equal(store.assignTask(id,store.defaultAssignment(id)),true)}
  const finishTracking=(store,id)=>{
   dispatch(store,id);store.selectTodo(id);store.advanceTodo(id)
   const feedback=store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:'同刻读数与工况已记录，保留来源限制'}))
   store.advanceTodo(id,feedback)
   assert.equal(store.decideCheck(id,'finish-tracking','本轮核实结束，继续原健康趋势观测'),true)
  }

  await t.test('initial pending events and historical closed records coexist without maintenance children',()=>{
   const store=fresh(),rows=eventDirectoryRows(store)
   assert.deepEqual(eventStatusOptions.map(item=>item.value),['','待决策','处置中','已闭环'])
   assert.equal(rows.filter(row=>row.executionProgress==='待决策').length,4)
   assert.ok(rows.some(row=>row.history&&row.eventState==='已闭环'))
   assert.deepEqual([...new Set(rows.map(row=>row.type))].sort(),['报警事件','异动跟踪','预警事件'].sort())
   assert.equal(rows.some(row=>['maintenance','aux-maintenance','real-maintenance-0523','maintenance-history'].includes(row.id)),false)
   for(const row of rows.filter(row=>!row.history)){
    assert.equal(row.taskId,null);assert.equal(row.stage,'');assert.equal(row.taskOwner,'')
    assert.equal(workbenchIssues(store).find(item=>item.id===row.id).stage,undefined,'uncreated tasks do not give events a task stage')
   }
   const history=rows.find(row=>row.history)
   assert.equal(history.executionProgress,'无人工任务')
   assert.equal(history.completedTaskCount,0)
   assert.equal(store.taskPortfolio.length,0)
  })

  await t.test('default assignment suggestions are pending dispatch until an explicit assignment is recorded',()=>{
   const store=fresh(),id='real-alarm-0430'
   assert.equal(store.createTodo(id),true)
   assert.equal(rowFor(store,id).executionProgress,'待派发')
   assert.equal(rowFor(store,id).taskOwner,'')
   assert.equal(store.assignTask(id,store.defaultAssignment(id)),true)
   assert.equal(rowFor(store,id).executionProgress,'已派发')
   assert.equal(rowFor(store,id).taskOwner,store.assignments[id].owner)
   store.selectTodo(id);store.advanceTodo(id)
   assert.equal(rowFor(store,id).executionProgress,'进行中')
   assert.equal(rowFor(store,id).eventState,'处置中')
   assert.equal(store.taskPortfolio.length,1,'the task portfolio is not changed by listing events')
   assert.equal(store.activeTaskPortfolio.length,1)
  })

  await t.test('completed hands-on task remains an open event until observation closure is confirmed',()=>{
   const store=fresh(),id='real-alarm-0430';dispatch(store,id)
   // Persisted observation state represents work already completed, not event closure.
   store.progress[id]=store.observationIndex(id);store.eventStatus[id]='observing'
   let row=rowFor(store,id)
   assert.equal(row.executionProgress,'已完成');assert.equal(row.eventState,'处置中');assert.equal(row.processingState,'效果观察')
   assert.equal(row.taskId,id);assert.match(row.continuation,/闭环仍待确认/)
   assert.equal(row.actionTaskId,null);assert.equal(store.activeTaskPortfolio.length,0)
   assert.ok(filterEventDirectory(eventDirectoryRows(store),{status:'处置中'}).some(row=>row.id===id))
   store.eventStatus[id]='closed'
   row=rowFor(store,id)
   assert.equal(row.executionProgress,'已完成');assert.equal(row.eventState,'已闭环')
   assert.ok(filterEventDirectory(eventDirectoryRows(store),{status:'已闭环'}).some(row=>row.id===id))
  })

  await t.test('finishing tracking verification completes its task while the event remains visible and tracking',()=>{
   const store=fresh(),id='real-tracking-0816';finishTracking(store,id)
   const row=rowFor(store,id)
   assert.equal(store.eventStatus[id],'closed','the child workflow receipt alone does not determine event closure')
   assert.equal(row.executionProgress,'已完成');assert.equal(row.eventState,'处置中');assert.equal(row.processingState,'持续跟踪')
   assert.equal(row.completedTaskCount,1);assert.match(row.continuation,/健康趋势观测继续/)
   assert.equal(filterEventDirectory(eventDirectoryRows(store),{status:'处置中'})[0].id,id)
   assert.equal(store.taskPortfolio[0].id,id,'completed tasks stay in the task portfolio')
   assert.equal(store.activeTaskPortfolio.length,0,'completed human verification is absent from Todos')
  })

  await t.test('maintenance assessment executes under one parent event and keeps the child task link',()=>{
   const store=fresh(),child='real-maintenance-0523',parent='real-health-0523'
   dispatch(store,child)
   let rows=eventDirectoryRows(store),row=rows.find(row=>row.id===parent)
   assert.equal(row.taskId,child);assert.deepEqual(row.taskIds,[child]);assert.equal(row.executionProgress,'已派发')
   assert.equal(rows.some(row=>row.id===child),false)
   store.selectTodo(child);store.advanceTodo(child)
   store.advanceTodo(child,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'条件暂不具备':'暂无提前处理必要',note:'记录当前依据与条件，不推定设备恢复'})))
   assert.equal(store.decideCheck(child,'end-maintenance','保留原后续检查安排'),true)
   row=rowFor(store,parent)
   assert.equal(row.executionProgress,'已完成');assert.equal(row.eventState,'处置中');assert.equal(row.processingState,'持续跟踪')
   assert.equal(row.taskId,child);assert.equal(eventDirectoryRows(store).length,rows.length)
  })

  await t.test('a later maintenance recommendation takes precedence over an earlier completed verification',()=>{
   const store=fresh();store.unlockedRecommendations['aux-health']=true
   finishTracking(store,'aux-health');store.advanceHealthTrack('aux2-health');store.advanceHealthTrack('aux2-health')
   let row=rowFor(store,'aux-health')
   assert.equal(row.executionProgress,'待决策');assert.equal(row.completedTaskCount,1)
   assert.match(row.progressNote,/新增建议等待决定/)
   dispatch(store,'aux-maintenance')
   row=rowFor(store,'aux-health')
   assert.equal(row.executionProgress,'已派发');assert.equal(row.taskId,'aux-maintenance')
   assert.deepEqual(row.taskIds,['aux-health','aux-maintenance']);assert.equal(row.completedTaskCount,1)
   assert.equal(eventDirectoryRows(store).filter(row=>row.id==='aux-health').length,1)
   assert.equal(store.taskPortfolio.length,2,'both dispatched tasks remain available')
   assert.deepEqual(store.activeTaskPortfolio.map(item=>item.id),['aux-maintenance'])
  })

  await t.test('a false alarm decision closes an event without inventing a completed execution task',()=>{
   const store=fresh(),id='real-alarm-0430'
   assert.equal(store.confirmFalseAlarm(id,'独立现场核对支持误报，保留原报警及确认依据'),true)
   const row=rowFor(store,id)
   assert.equal(row.eventState,'已闭环');assert.equal(row.executionProgress,'无人工任务')
   assert.equal(row.taskId,null);assert.equal(row.completedTaskCount,0)
   assert.equal(store.taskPortfolio.length,0)
   assert.equal(filterEventDirectory(eventDirectoryRows(store),{status:'已闭环',state:'无人工任务'}).some(row=>row.id===id),true)
  })

  await t.test('device, type, execution and event status filters compose, including aggregate auxiliary devices',()=>{
   const store=fresh();store.unlockedRecommendations['aux-health']=true
   finishTracking(store,'aux-health')
   const rows=eventDirectoryRows(store)
   assert.deepEqual(filterEventDirectory(rows,{device:'aux-system',type:'异动跟踪',status:'处置中'}).map(row=>row.id),['aux-health'])
   assert.equal(filterEventDirectory(rows,{device:'main-engine-1',status:'处置中'}).length,0)
   assert.equal(filterEventDirectory(rows,{device:'aux-engine-3',status:'已闭环'}).length,0)
   assert.equal(filterEventDirectory(rows).length,rows.length)
   assert.ok(eventDirectoryDeviceOptions(rows).some(option=>option.value==='aux-system'))
  })
 } finally {await server.close()}
})
