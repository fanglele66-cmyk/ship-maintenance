import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,h,nextTick,ssrContextKey} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {createLifecycleState,decide,currentTask,people,submitTask} from '../src/workflow/eventLifecycle.js'
import {generateTaskReport} from '../src/workflow/taskReportGeneration.js'
import {maintenancePlans,availableMaintenanceWindows} from '../src/workflow/maintenancePlans.js'
import {downloadReportMarkdown} from '../src/workflow/downloadReport.js'

const model={patch:{summary:'本轮逐项记录已整理。',analysis:{evidence:'依据执行人本轮原始记录。',interpretation:'现场事实与原因判断分别列出。',unverified:'未验证事项仍保留。',next:'交轮机长审阅并确认下一步。'}},model:'test-model',sources:[]}
function fixture(kind){
 const state=createLifecycleState(),id=kind==='maintenance'?'real-tracking-exhaust-baseline':'real-alarm-0430',event=state.events[id]
 const form={owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()}
 decide(state,id,{action:'investigate',...form})
 if(kind!=='investigation'){
  state.role='engineer'
  const task=currentTask(event)
  task.draft.records.forEach((r,i)=>{r.result=task.steps[i].options[0];r.note='本轮测试记录'})
  submitTask(state,id,task.id);state.role='captain'
  if(kind==='maintenance'){
   const plan=maintenancePlans(event)[1],window=availableMaintenanceWindows()[0]
   decide(state,id,{action:'maintenance',...form,deadline:window.end,maintenancePlanId:plan.id,window:window.id})
  }else decide(state,id,{action:'repair',...form})
 }
 state.role='engineer'
 const task=currentTask(event)
 task.draft.records.forEach((r,i)=>{r.result=task.steps[i].options[0];r.note='本轮测试记录'})
 return {state,id,task}
}
function mount(component,pinia,router){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null})
 app.config.warnHandler=()=>{}
 app.provide(ssrContextKey,{});app.use(pinia);app.use(router)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('task submissions open the assistant through generation, completion and retry',async t=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:View}=await server.ssrLoadModule('/src/views/LifecycleTaskView.vue')
  const {default:Report}=await server.ssrLoadModule('/src/components/LifecycleReport.vue')
  for(const kind of ['investigation','repair','maintenance'])await t.test(kind,async()=>{
   const pinia=createPinia();setActivePinia(pinia);useSensorStore().configureSimulation({enabled:false})
   const {state,id,task}=fixture(kind),store=useEventLifecycleStore()
   store.state.events=structuredClone(state.events);store.state.role=state.role
   const router=createRouter({history:createMemoryHistory(),routes:[{name:'LifecycleTask',path:'/tasks/:taskId',component:View}]})
   await router.push('/tasks/'+task.id)
   const mounted=mount(View,pinia,router)
   try{
    assert.equal(mounted.state.assistantOpen,false)
    await mounted.state.showSubmission()
    assert.equal(mounted.state.assistantOpen,true,'opens before the model request')
    mounted.state.assistantOpen=false
    let finish
    const pending=generateTaskReport(store.state,id,task.id,()=>new Promise(resolve=>finish=resolve))
    await nextTick()
    assert.equal(mounted.state.assistantOpen,true,'reporting status also restores the panel')
    const live=currentTask(store.state.events[id])
    assert.equal(live.conversations.engineer.at(-1).status,'streaming')
    assert.ok(live.conversations.engineer.at(-1).generatedReport,'right-side report card has streaming data')
    finish(model);await pending;await nextTick();mounted.state.submitted();await nextTick()
    assert.equal(mounted.state.assistantOpen,true)
    assert.equal(mounted.state.tab,'提交记录')
    const html=await renderToString(createSSRApp({render:()=>h(View)}).use(pinia).use(router))
    const toolbar=html.match(/<nav[^>]*aria-label="本轮报告操作"[^>]*>([\s\S]*?)<\/nav>/)?.[1]
    assert.ok(toolbar)
    const positions=['返回本轮执行记录','查看'+({investigation:'排查',repair:'维修',maintenance:'维保'}[kind])+'报告','下载 Markdown','通过对话补充报告'].map(label=>toolbar.indexOf(label))
    assert.ok(positions.every((position,i)=>position>=0&&(i===0||position>positions[i-1])))
    assert.equal((html.match(/下载 Markdown/g)||[]).length,1)
    const currentReport=store.state.events[id].reports.at(-1)
    const noDownload=await renderToString(createSSRApp({render:()=>h(Report,{report:currentReport,showDownload:false})}))
    assert.ok(!noDownload.includes('下载 Markdown'))
    const standalone=await renderToString(createSSRApp({render:()=>h(Report,{report:currentReport})}))
    assert.match(standalone,/下载 Markdown/)
    // Select an earlier submission: supplementation must target that exact report.
    const prior={...currentReport,id:currentReport.id+'-prior',submissionNumber:0}
    store.state.events[id].reports.unshift(prior)
    mounted.state.selectedReportId=prior.id
    await nextTick()
    assert.equal(mounted.state.report.id,prior.id)
    let supplemented
    mounted.state.assistant={supplementReport:id=>supplemented=id}
    await mounted.state.supplement()
    assert.equal(supplemented,prior.id)
   }finally{mounted.app.unmount();disposePinia(pinia)}
  })
  await t.test('failed generation and retry retain the visible assistant',async()=>{
   const pinia=createPinia();setActivePinia(pinia);useSensorStore().configureSimulation({enabled:false})
   const {state,id,task}=fixture('investigation'),store=useEventLifecycleStore()
   store.state.events=structuredClone(state.events);store.state.role=state.role
   const router=createRouter({history:createMemoryHistory(),routes:[{name:'LifecycleTask',path:'/tasks/:taskId',component:View}]})
   await router.push('/tasks/'+task.id)
   const mounted=mount(View,pinia,router)
   try{
    await assert.rejects(generateTaskReport(store.state,id,task.id,async()=>{throw Error('test connection failure')}),/test connection failure/)
    await nextTick()
    assert.equal(currentTask(store.state.events[id]).status,'report-error')
    assert.equal(mounted.state.assistantOpen,true)
    mounted.state.assistantOpen=false
    let finish
    const retry=generateTaskReport(store.state,id,task.id,()=>new Promise(resolve=>finish=resolve))
    await nextTick()
    assert.equal(mounted.state.assistantOpen,true)
    finish(model);await retry;await nextTick()
    assert.equal(mounted.state.assistantOpen,true)
    assert.equal(currentTask(store.state.events[id]).status,'submitted')
   }finally{mounted.app.unmount();disposePinia(pinia)}
  })
 }finally{await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})

test('the shared download uses the selected report content and a safe filename',async()=>{
 const previous={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,setTimeout:globalThis.setTimeout}
 let blob,clicked=false,revoked,scheduled
 const anchor={click(){clicked=true}}
 globalThis.document={createElement:tag=>{assert.equal(tag,'a');return anchor}}
 URL.createObjectURL=value=>{blob=value;return 'blob:test-report'}
 URL.revokeObjectURL=value=>revoked=value
 globalThis.setTimeout=callback=>{scheduled=callback;return 0}
 try{
  downloadReportMarkdown({number:'旧稿/01',title:'选中历史报告',markdown:'# 选中历史报告\n\n独有记录'})
  assert.equal(clicked,true);assert.equal(anchor.download,'旧稿-01.md')
  assert.match(await blob.text(),/独有记录/);assert.equal(blob.type,'text/markdown;charset=utf-8')
  scheduled();assert.equal(revoked,'blob:test-report')
 }finally{
  if(previous.document===undefined)delete globalThis.document;else globalThis.document=previous.document
  URL.createObjectURL=previous.create;URL.revokeObjectURL=previous.revoke;globalThis.setTimeout=previous.setTimeout
 }
})
