import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
test('captain decides origins before dispatch; assignment is unique, traceable and resettable',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
 const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
 const {workbenchIssues,activeWorkbenchIssues,captainDeviceSignal,captainAnalysis}=await server.ssrLoadModule('/src/mock/captainWorkbench.js')
 setActivePinia(createPinia());const store=usePhase2DemoStore()
 assert.deepEqual(store.visibleTodos.map(t=>t.id),['steering-heat'])
 let rows=workbenchIssues(store)
 assert.equal(rows.filter(i=>i.state==='待决策').length,6)
 assert.deepEqual(rows.filter(i=>i.deviceId==='main-engine-1').map(i=>i.type),['报警事件','预警事件','异动跟踪','异动跟踪','维保建议'])
 assert.equal(captainDeviceSignal(store,'main-engine-1'),'danger')
 assert.equal(captainDeviceSignal(store,'air-compressor'),'warning')
 assert.equal(store.registerDossierNote('fault','可能误报反馈：现场仪表与采集读数不一致，待核对'),true)
 assert.equal(store.todoCreated.fault,false)
 assert.equal(workbenchIssues(store).find(i=>i.id==='fault').state,'待决策')
 for(const id of ['fault','main-warning','air-delivery']){
 assert.equal(store.createTodo(id),true);assert.equal(store.createTodo(id),false)
 store.assignTask(id,{owner:'王海涛（二管轮）',type:'检测排查',scope:'核对现场指标与原分析依据，记录实际发现',due:'本班次'})
 assert.equal(workbenchIssues(store).find(i=>i.id===id).state,'已派发')
 assert.equal(store.visibleTodos.filter(t=>t.id===id).length,1)
 assert.equal(store.assignmentRecords[id].length,1)
 }
 assert.equal(store.ignoreSuggestion('maintenance','暂不提前，按周期计划执行'),true)
 assert.equal(workbenchIssues(store).find(i=>i.id==='maintenance').state,'已记录决定')
 assert.doesNotMatch(captainAnalysis(store),/优先了解主机冷却水报警并派发/)
 store.progress.fault=store.cases.fault.stages.findIndex(s=>s.kind==='observe')
 assert.equal(workbenchIssues(store).find(i=>i.id==='fault').state,'已派发','observation remains visible until closed')
 store.progress.fault=store.cases.fault.stages.findIndex(s=>s.kind==='closed')
 assert.equal(workbenchIssues(store).find(i=>i.id==='fault').state,'已派发','legacy final stage only archives observation, not the event')
 const canonical={...store,eventStatus:{fault:'closed'}}
 assert.equal(workbenchIssues(canonical).find(i=>i.id==='fault').state,'已闭环')
 assert.equal(activeWorkbenchIssues(canonical).some(i=>i.id==='fault'),false,'closed item is retained only in device lookup')
 assert.equal(activeWorkbenchIssues(store).some(i=>i.id==='maintenance'),false,'recorded ignore decision is not a pending item')
 for(const item of activeWorkbenchIssues(store).filter(i=>i.state==='待决策'))store.createTodo(item.id)
 assert.equal(activeWorkbenchIssues(store).filter(i=>i.state==='待决策').length,0,'all-dispatched empty state has no pending rows')
 assert.ok(activeWorkbenchIssues(store).filter(i=>i.state==='已派发').length>0)
 store.resetDemo();assert.equal(store.todoCreated.fault,false);assert.equal(store.todoCreated['main-warning'],false)
 assert.equal(workbenchIssues(store).filter(i=>i.state==='待决策').length,6)
 }finally{await server.close()}
})
