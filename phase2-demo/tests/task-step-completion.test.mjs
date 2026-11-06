import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,h,ssrContextKey} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {isTaskStepComplete} from '../src/workflow/taskStepCompletion.js'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'

test('required completion accepts only an allowed result and never requires or changes the optional note',()=>{
 const step={options:['发现异常','未见异常','无法确认']}
 for(const record of [undefined,{}, {note:'只填写备注'}, {result:''}, {result:'通过'}, {result:['发现异常']}])assert.equal(isTaskStepComplete(step,record),false)
 assert.equal(isTaskStepComplete(undefined,{result:'发现异常'}),false)
 assert.equal(isTaskStepComplete({options:[' ']},{result:' '}),false)
 for(const result of ['发现异常','未见异常'])for(const note of [undefined,'','已有人工记录']){
  const record={result,note},original=structuredClone(record)
  assert.equal(isTaskStepComplete(step,record),true);assert.deepEqual(record,original)
 }
 const work={options:['已完成','未完成','不适用']}
 for(const result of work.options)assert.equal(isTaskStepComplete(work,{result}),true,'completion means filled in, not successful work')
})

test('unknown or restricted results require an explicit valid execution status',()=>{
 const step={options:['无法确认','现场条件受限']}
 for(const result of step.options){
  for(const executionStatus of [undefined,'','不适用','待执行'])assert.equal(isTaskStepComplete(step,{result,executionStatus,note:'备注不能替代必填决定。'}),false)
  for(const executionStatus of ['已完成','未完成'])assert.equal(isTaskStepComplete(step,{result,executionStatus,note:''}),true)
 }
 assert.equal(isTaskStepComplete(step,{result:'已完成',executionStatus:'已完成'}),false)
})

function mount(component,pinia,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{};app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('step cards and next/submit use the same required-field rule, including the active card',async()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 let mounted
 try{
  const {default:Steps}=await server.ssrLoadModule('/src/components/LifecycleTaskSteps.vue')
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  useSensorStore().configureSimulation({enabled:false})
  const fixture=createLifecycleState(),id='real-alarm-0430'
  decide(fixture,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
  const store=useEventLifecycleStore();store.state.events=fixture.events;store.state.role='engineer'
  const event=store.state.events[id],task=currentTask(event),submitted=[]
  store.submit=async(...args)=>{submitted.push(args)}
  mounted=mount(Steps,pinia,{event,task})
  const state=mounted.state,render=async()=>{
   const html=await renderToString(createSSRApp({render:()=>h(Steps,{event,task})}).use(pinia))
   return html.match(/<nav[^>]*aria-label="执行步骤"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||''
  }
  task.draft.records[0].result='无法确认'
  assert.doesNotMatch(await render(),/class="[^"]*complete/)
  await state.next();assert.equal(state.index,0);assert.match(state.error,/实际执行情况/);assert.equal(submitted.length,0)
  task.draft.records[0].executionStatus='未完成'
  assert.match(await render(),/class="active complete"[^>]*aria-current="step"/)
  await state.next();assert.equal(task.draft.stepIndex,1)
  task.draft.records[1].result='未见异常';task.draft.records[0].result='不属于本步骤的结果'
  await state.next();assert.equal(task.draft.stepIndex,0);assert.match(state.error,/补齐/);assert.equal(submitted.length,0)
  await state.next();assert.equal(task.draft.stepIndex,0);assert.match(state.error,/实际结果/)
  task.draft.records[0].result='无法确认'
  assert.equal((await render()).match(/class="[^"]*complete[^"]*"/g)?.length,2,'active and inactive complete cards receive the same state')
  task.draft.records[0].note='';task.draft.records[1].note=''
  await state.next();await state.next()
  assert.deepEqual(submitted,[[id,task.id]],'empty optional notes do not prevent submission')
  task.draft.records[0].executionStatus=''
  const incomplete=await render()
  assert.equal(incomplete.match(/class="[^"]*complete[^"]*"/g)?.length,1,'clearing a required choice removes the complete state')
 }finally{mounted?.app.unmount();disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
