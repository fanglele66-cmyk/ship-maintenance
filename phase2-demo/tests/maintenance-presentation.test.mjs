import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {routerKey,routeLocationKey} from 'vue-router'

test('maintenance decisions, linked orders and processing records have one dedicated event tab',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const pinia=createPinia();setActivePinia(pinia)
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useEventWorkOrderStore}=await server.ssrLoadModule('/src/stores/eventWorkOrderStore.js')
  const {plannedWindows}=await server.ssrLoadModule('/src/mock/plannedWindows.js')
  const {workflowFollowup}=await server.ssrLoadModule('/src/message-flows/workflowFollowup.js')
  const {default:Detail}=await server.ssrLoadModule('/src/components/CaptainIssueDetail.vue')
  const store=usePhase2DemoStore(),orders=useEventWorkOrderStore(),id='real-health-c4-baseline',child='real-maintenance-c4-baseline'
  const draft=store.ensureTrackingDecision(id)
  assert.equal(store.ensureTrackingDecision(id),draft)
  assert.equal(plannedWindows.length,3)
  assert.ok(plannedWindows.every(window=>Date.parse(window.start)<Date.parse(window.end)))
  assert.equal(store.decideTracking(id,'maintenance',{reason:'端子与独立校验尚需专项检查',scope:'四缸测温连接检查与独立校验'}).ok,true)
  assert.equal(workflowFollowup(store,id).title,'确认维保前再核对')
  assert.equal(store.confirmTrackingMaintenance(id,{owner:'赵明（三管轮）',due:plannedWindows[1].label,scope:'四缸测温连接检查与独立校验',conditions:plannedWindows[1].conditions}).ok,true)
  assert.equal(workflowFollowup(store,id).title,'维保安排已确认')
  await orders.load(child)
  assert.equal(orders.state(child).linked,null,'candidate order is not automatically confirmed')
  assert.equal(orders.confirm(child),true)
  assert.equal(orders.state(child).linked.id,'CBY-WO-202610-018')
  assert.equal(orders.state(child).linked.jobCardNo,'CBY-JOB-202610-018')
  const render=async tab=>{const app=createSSRApp(Detail,{scenario:id});app.use(pinia);app.provide(routerKey,{push(){}});app.provide(routeLocationKey,{query:{tab},path:'/situation/issue/'+id});return renderToString(app)}
  for(const tab of ['研判分析','健康趋势观测','健康趋势分析']){
   const analysis=await render(tab)
   assert.doesNotMatch(analysis,/本跟踪的阶段建议|跟踪与处理记录/)
   assert.doesNotMatch(analysis,/role="tab"[^>]*>健康趋势/)
   assert.match(analysis,/长期健康趋势/)
   assert.match(analysis,/aria-selected="true"[^>]*>研判分析/)
  }
  let maintenance=await render('维保任务')
  assert.match(maintenance,/CBY-WO-202610-018/)
  assert.match(maintenance,/维修作业单号/)
  assert.match(maintenance,/赵明（?三管轮/)
  assert.doesNotMatch(maintenance,/本跟踪的阶段建议/)
  store.executionRecords[child]=[{round:1,executor:'赵明（三管轮）',values:{executedAt:'2026-10-27T09:00',measures:'紧固四缸测温端子并独立校验',acceptance:'端子连接与校验通过'}}]
  maintenance=await render('维保任务')
  assert.match(maintenance,/紧固四缸测温端子并独立校验/)
  assert.match(maintenance,/端子连接与校验通过/)
 }finally{disposePinia(pinia);await server.close()}
})
