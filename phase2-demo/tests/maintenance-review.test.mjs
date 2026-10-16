import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {ref} from 'vue'
import {dispatchReturnLocation} from '../src/mock/dispatchNavigation.js'
import {issueDetailPath,maintenanceReturnLocation} from '../src/utils/maintenanceNavigation.js'
import {useAgentConversations,migrateAgentConversations} from '../src/composables/useAgentConversations.js'
test('maintenance navigation keeps originating scope and unrelated issues',()=>{
 assert.equal(issueDetailPath('maintenance'),'/situation/maintenance/injector-3-cleaning')
 assert.equal(issueDetailPath('drift'),'/situation/issue/drift')
 const restored=maintenanceReturnLocation({from:'history',category:'recommendation',scroll:'212'})
 assert.deepEqual(dispatchReturnLocation({path:'/situation/maintenance/injector-3-cleaning',query:{from:'history',category:'recommendation',scroll:'212'}}),restored)
 assert.equal(restored.query.restoreTab,'history');assert.equal(restored.query.category,'recommendation');assert.equal(restored.query.scroll,'212')
 assert.equal(maintenanceReturnLocation({from:'issues',scope:'engines',type:'维保建议'}).query.scope,'engines')
})
test('legacy advice sessions retain distinct histories and drafts under one agent',()=>{
 const a=useAgentConversations(ref('test-issue-maintenance')),b=useAgentConversations(ref('test-advice-maintenance'))
 a.active.value.messages.push({id:'old-issue',role:'user',text:'先前事项讨论'});a.draft.value='事项草稿'
 b.active.value.messages.push({id:'old-advice',role:'user',text:'先前维保讨论'});b.draft.value='建议草稿'
 const aId=a.active.value.id,bId=b.active.value.id
 migrateAgentConversations('test-unified-maintenance',['test-issue-maintenance','test-advice-maintenance'])
 const unified=useAgentConversations(ref('test-unified-maintenance'))
 assert.equal(unified.conversations.value.length,2);unified.select(aId);assert.equal(unified.draft.value,'事项草稿');unified.select(bId);assert.equal(unified.draft.value,'建议草稿')
 migrateAgentConversations('test-unified-maintenance',['test-issue-maintenance','test-advice-maintenance']);assert.equal(unified.conversations.value.length,2)
})
test('review references actual records and never invents execution from phase index',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
 const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js'),{useMaintenanceAdviceStore}=await server.ssrLoadModule('/src/stores/maintenanceAdviceStore.js'),{maintenanceReview}=await server.ssrLoadModule('/src/mock/maintenanceReview.js')
 setActivePinia(createPinia());const core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore()
 let review=maintenanceReview(core,advice);assert.equal(review.execution,undefined);assert.equal(review.checked,false);assert.match(review.limitation,/排温偏差本身不能/)
 core.progress.drift=4;review=maintenanceReview(core,advice);assert.equal(review.execution,undefined);assert.equal(review.checked,false);assert.equal(review.observationReady,false)
 core.assignmentRecords.drift=[{owner:'大管轮',assignedBy:'轮机长',scope:'核实',due:'本班次',at:'2026/10/14 10:00'}]
 advice.decide('defer','作业条件不具备')
 review=maintenanceReview(core,advice);assert.equal(review.decisions.length,2);assert.equal(review.status,'暂不采纳')
 core.executionRecords.drift=[{source:'人员确认',values:{completion:'partial',measures:'实际复装',executedAt:'2026-10-14T09:00',acceptance:'待验收'}}]
 review=maintenanceReview(core,advice);assert.match(review.conclusion,/实际复装/);assert.equal(review.observationReady,false)
 }finally{await server.close()}
})
test('injector example uses extracted channel anchors, confirmed evidence and one original event',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js'),{useMaintenanceAdviceStore}=await server.ssrLoadModule('/src/stores/maintenanceAdviceStore.js'),{maintenanceReview}=await server.ssrLoadModule('/src/mock/maintenanceReview.js'),{maintenancePointBasis}=await server.ssrLoadModule('/src/mock/maintenanceExample.js')
  setActivePinia(createPinia());const core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore()
  core.progress.drift=4;assert.equal(advice.sufficient,false,'phase index is not evidence');assert.equal(advice.decide('execute'),false)
  core.progress.drift=0;advice.enableExample();const review=maintenanceReview(core,advice),count=core.visibleTodos.length
  assert.equal(maintenancePointBasis.third,361.8);assert.equal(maintenancePointBasis.second,357.025)
  assert.deepEqual(review.series[0].values,[361.8,371.8]);assert.equal(review.checked,true)
  assert.equal(review.plan.dueHours,null);assert.equal(review.plan.window,null);assert.equal(review.execution,undefined);assert.equal(review.observations.length,0)
  assert.equal(core.todoCreated.maintenance,false);advice.enableExample();assert.equal(core.logs.drift.filter(m=>m.id==='injector-demo-evidence').length,1)
  assert.equal(advice.decide('execute'),true);assert.equal(core.visibleTodos.length,count);assert.equal((core.executionRecords.drift||[]).length,0);assert.equal(core.progress.drift,4)
  assert.equal(JSON.stringify(review).includes('轴承'),false);assert.equal(JSON.stringify(review).includes('约48小时'),false)
 }finally{await server.close()}
})
test('new injector advice owns separate conversations from the bearing example',()=>{
 const bearing=useAgentConversations(ref('maintenance-advice:maintenance')),injector=useAgentConversations(ref('maintenance-advice:injector-3-cleaning'))
 bearing.active.value.messages.push({id:'bearing-only',role:'user',text:'旧轴承记录'});bearing.draft.value='旧案例草稿'
 assert.notEqual(bearing.active.value.id,injector.active.value.id);assert.equal(injector.active.value.messages.some(m=>m.id==='bearing-only'),false);assert.equal(injector.draft.value,'')
})
