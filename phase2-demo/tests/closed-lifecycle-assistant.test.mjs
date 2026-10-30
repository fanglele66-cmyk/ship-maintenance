import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createLifecycleState,decide,submitTask,currentTask,ensureTaskPlan,people} from '../src/workflow/eventLifecycle.js'

const id='real-alarm-0430'
function closedFixture(){
 const state=createLifecycleState(),event=state.events[id]
 for(const action of ['investigate','repair']){
  state.role='captain'
  decide(state,id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:ensureTaskPlan(event).scope})
  state.role='engineer'
  const task=currentTask(event)
  task.draft.records.forEach(r=>r.result=action==='investigate'?'发现异常':'已完成')
  task.draft.summary=action==='investigate'?'确认液压活塞卡滞。':'已完成获批处理及复测。'
  submitTask(state,id)
 }
 state.role='captain';decide(state,id,{action:'close',reason:'复测与观察平稳，人工确认闭环。'})
 return state
}

test('closed events offer a separate shore handoff without reopening stage forms',async t=>{
 const previousWindow=globalThis.window
 globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  const {default:ActionForm}=await server.ssrLoadModule('/src/components/LifecycleActionForm.vue')
  async function render(state,component=Assistant,extra={}){
   const pinia=createPinia();setActivePinia(pinia)
   try{
    const store=useEventLifecycleStore();store.state.events=structuredClone(state.events);store.state.role=state.role
    const app=createSSRApp({render:()=>h(component,{event:store.state.events[id],...extra})});app.use(pinia)
    return await renderToString(app)
   }finally{disposePinia(pinia)}
  }
  await t.test('active stages retain their form entry',async()=>{
   const html=await render(createLifecycleState())
   assert.doesNotMatch(html,/填写本阶段表单/);assert.match(html,/填写处置决定/)
  })
  await t.test('closed captain and assigned engineer have no stage form',async()=>{
   const state=closedFixture()
   for(const role of ['captain','engineer']){
    state.role=role;const html=await render(state)
    assert.doesNotMatch(html,/填写本阶段表单|填写处置决定|填写作业反馈|lc-assistant-form/)
    assert.match(html,/回顾本次处理过程/)
   }
  })
  await t.test('shore submission preserves closure and never prompts further shipboard handling',async()=>{
   const state=closedFixture(),event=state.events[id],before=structuredClone({phase:event.phase,status:event.status,tasks:event.tasks,reports:event.reports})
   decide(state,id,{action:'shore',reason:'同步事件全过程及闭环报告。'})
   assert.deepEqual({phase:event.phase,status:event.status,tasks:event.tasks,reports:event.reports},before)
   assert.equal(event.shore.at(-1).packet.phase,'closed')
   assert.match(event.conversations.captain.at(-1).recommendation,/保持已闭环/)
   assert.doesNotMatch(event.conversations.captain.at(-1).recommendation,/继续处理船上任务/)
   const html=await render(state)
   assert.doesNotMatch(html,/填写本阶段表单|填写处置决定|lc-assistant-form/)
  })
  await t.test('the explicit closed shore form has no decision selector or dispatch basis',async()=>{
   const html=await render(closedFixture(),ActionForm,{shoreOnly:true})
   assert.match(html,/岸基同步表单|提交岸基同步/)
   assert.match(html,/同步内容与岸基支持需求/)
   assert.doesNotMatch(html,/本次处置|本轮决策依据|派发依据|<select/)
  })
 }finally{await server.close();if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow}
})
