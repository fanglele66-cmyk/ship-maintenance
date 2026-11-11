import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createRenderer,nextTick,reactive,ssrContextKey} from 'vue'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createLifecycleState,decide,ensureTaskPlan,people,currentTask} from '../src/workflow/eventLifecycle.js'

function mount(component,pinia,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{};app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState,props:vm.$.props}
}
const copy=value=>JSON.parse(JSON.stringify(value))

test('backend snapshots preserve the current assistant draft and do not manufacture new task edits',async t=>{
 const priorWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia(),mounted=[]
 setActivePinia(pinia)
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  const {default:Steps}=await server.ssrLoadModule('/src/components/LifecycleTaskSteps.vue')
  const initial=createLifecycleState(),id='real-alarm-0430',event=initial.events[id]
  ensureTaskPlan(event);decide(initial,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
  const store=useEventLifecycleStore();store.state.events=initial.events;store.state.role='engineer'
  const task=currentTask(store.state.events[id]);task.draft.updatedAt='2026-01-01T00:00:00.000Z'
  const assistant=mount(Assistant,pinia,{event:store.state.events[id],taskId:task.id,activeStepIndex:0}),steps=mount(Steps,pinia,{event:store.state.events[id],task})
  mounted.push(assistant,steps)
  const state=assistant.state
  await t.test('repeated server snapshots retain text, attachments, edit choice and dismissed opening',async()=>{
   state.customQuestion();await nextTick()
   state.input='尚未发送的现场读数';state.images=[{name:'现场.png',dataUrl:'data:image/png;base64,test'}];state.attachments=[{name:'记录.txt',text:'现场待核对'}];state.editingMessageId='draft-to-revise'
   for(let i=0;i<3;i++){
    const replacement={...copy(assistant.props.event),serverRevision:10+i}
    replacement.conversations.captain.push({id:'other-session-'+i,kind:'user',text:'其他账号的新消息'})
    assistant.props.event=reactive(replacement);await nextTick()
    assert.equal(state.input,'尚未发送的现场读数');assert.equal(state.images[0]?.name,'现场.png');assert.equal(state.attachments[0]?.text,'现场待核对');assert.equal(state.editingMessageId,'draft-to-revise');assert.equal(state.decisionQuestion,null)
   }
  })
  await t.test('unchanged records from the server do not update the draft timestamp; typing still does',async()=>{
   const before=steps.props.task.draft.updatedAt
   steps.props.task=reactive(copy(steps.props.task));await nextTick()
   assert.equal(steps.props.task.draft.updatedAt,before)
   steps.props.task.draft.records[0].note='现场读数0.89 MPa';await nextTick()
   assert.notEqual(steps.props.task.draft.updatedAt,before)
  })
  await t.test('a genuinely different event still clears the old composer context',async()=>{
   assistant.props.event={...copy(assistant.props.event),id:'another-event'};await nextTick()
   assert.equal(state.input,'');assert.deepEqual(state.images,[]);assert.deepEqual(state.attachments,[])
  })
 }finally{for(const entry of mounted)entry.app.unmount();disposePinia(pinia);globalThis.window=priorWindow;await server.close()}
})
