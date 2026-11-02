import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {createLifecycleState,decide,currentTask,submitTask,people,ensureTaskPlan} from '../src/workflow/eventLifecycle.js'

test('独立观察页、来源事件及闭环报告均可完整渲染',async()=>{
 const previousWindow=globalThis.window
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const pinia=createPinia();setActivePinia(pinia)
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {default:View}=await server.ssrLoadModule('/src/views/EventLifecycleView.vue')
  globalThis.window={addEventListener(){}}
  const state=createLifecycleState(),parent=state.events['real-alarm-0430']
  decide(state,parent.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:ensureTaskPlan(parent).scope})
  state.role='engineer';const task=currentTask(parent);task.draft.records.forEach(r=>r.result='未见异常');task.draft.summary='已完成本轮排查，继续观察原异常。';submitTask(state,parent.id)
  state.role='captain';decide(state,parent.id,{action:'observe',reason:'核对原异常是否持续。'})
  const child=state.events[parent.observationEventIds[0]]
  child.observationAdvice={[child.phases.at(-1).id]:{dismissed:true}}
  const store=useEventLifecycleStore();store.state.events=state.events;store.state.role='captain'
  const router=createRouter({history:createMemoryHistory(),routes:[{name:'EventLifecycle',path:'/situation/issue/:attentionId',component:View}]})
  async function render(id){await router.push('/situation/issue/'+id);const app=createSSRApp({render:()=>h(View)});app.use(pinia);app.use(router);return renderToString(app)}
  const parentHtml=await render(parent.id);assert.match(parentHtml,/效果观察已独立建档/);assert.match(parentHtml,new RegExp(child.title))
  const childHtml=await render(child.id);assert.match(childHtml,/关联原事件/);assert.match(childHtml,/效果观察/);assert.match(childHtml,/事件助手/);assert.match(childHtml,/>决策<\/button>/);assert.doesNotMatch(childHtml,/<select/)
  decide(store.state,child.id,{action:'close',reason:'核对本轮观察记录后确认结束。'})
  const closedHtml=await render(child.id);assert.match(closedHtml,/闭环归档/);assert.match(closedHtml,/关联原事件/)
 }finally{disposePinia(pinia);await server.close();if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow}
})
