import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRenderer,createSSRApp,ssrContextKey,nextTick} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createRouter,createMemoryHistory} from 'vue-router'

function mount(component,pinia,props={}){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{}
 app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('assigned task workspaces open actionable stages with data first and keep original stage indices',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:Task}=await server.ssrLoadModule('/src/views/TodoDetailPad.vue')
  const {default:Panel}=await server.ssrLoadModule('/src/components/AssistantWorkflowPanel.vue')
  for(const id of ['real-alarm-0430','real-warning-0523','real-tracking-exhaust-baseline','real-maintenance-c4-baseline']){
   for(const panelFirst of [false,true])await t.test(id+' / '+(panelFirst?'assistant first':'task first'),async()=>{
    const pinia=createPinia();setActivePinia(pinia);useSensorStore().configureSimulation({enabled:false})
    const store=usePhase2DemoStore(),mounted=[]
    try{
     store.ensureAssignmentDraft(id)
     store.updateAssignmentDraft(id,{due:'2026-10-29T18:00'})
     assert.equal(store.submitSharedAssignment(id).ok,true)
     assert.equal(store.progress[id],0,'dispatch alone must not execute a stage')
     store.selectTodo(id)
     if(panelFirst)mounted.push(mount(Panel,pinia,{taskId:id,audience:'assignee'}))
     const workspace=mount(Task,pinia);mounted.push(workspace)
     if(!panelFirst)mounted.push(mount(Panel,pinia,{taskId:id,audience:'assignee'}))
     await nextTick()
     assert.equal(store.progress[id],1,'simultaneous workspaces must not skip the first check')
     assert.equal(store.activeStage[id],1)
     assert.equal(store.currentStage.kind,'check')
     assert.equal(workspace.state.tabs[0],'数据观测')
     assert.equal(workspace.state.subtab,'数据观测')
     assert.ok(workspace.state.humanStages.every(stage=>!['intro','overview','event'].includes(stage.kind)))
     assert.equal(workspace.state.humanStages[0].index,1,'persisted indices are not renumbered')
     assert.equal(workspace.state.taskStageLabel,store.currentStage.label)
     assert.match(workspace.state.taskCompletion,/^0 \/ \d+ 阶段完成$/)
     assert.ok(workspace.state.tabs.includes(store.currentStage.label+'步骤'),'step-by-step checking stays available')
     assert.deepEqual([...store.unreadTaskIds],[id],'opening the view does not acknowledge the sidebar notice itself')
    }finally{for(const component of mounted)component.app.unmount();disposePinia(pinia)}
   })
  }
  await t.test('rendered task header contains assignment facts beside the title without a separate goal row',async()=>{
   const id='real-alarm-0430',pinia=createPinia();setActivePinia(pinia);useSensorStore().configureSimulation({enabled:false})
   try{
    const store=usePhase2DemoStore()
    store.ensureAssignmentDraft(id);store.updateAssignmentDraft(id,{due:'2026-10-29T18:00'});store.submitSharedAssignment(id);store.selectTodo(id)
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/event',component:Task}]})
    await router.push('/event')
    const app=createSSRApp(Task);app.use(pinia);app.use(router)
    const html=await renderToString(app),header=html.match(/<header[^>]*p2-task-header[^>]*>([\s\S]*?)<\/header>/)?.[1]
    assert.ok(header,'task title and facts share a rendered header')
    assert.match(header,/<h2[^>]*>二缸报警与喷射控制核实<\/h2>/)
    for(const text of ['负责人','要求完成','当前阶段','完成情况','李建国（大管轮）','2026-10-29 18:00','原因排查','0 / 2 阶段完成','未处理'])assert.ok(header.includes(text),text)
    assert.equal((html.match(/class="p2-task-summary"/g)||[]).length,1)
    assert.ok(!html.includes('p2-task-goal'),'no duplicate task-goal row below the header')
    assert.match(html,/<\/header>[\s\S]*aria-label="处理阶段"/,'stage rail remains after the header')
   }finally{disposePinia(pinia)}
  })
 }finally{await server.close()}
})
