import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,h,nextTick,ssrContextKey} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {createLifecycleState,decide,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'

function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430'],form={owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()}
 for(const action of ['investigate','repair']){
  state.role='captain';decide(state,event.id,{action,...form});state.role='engineer'
  const task=currentTask(event)
  task.draft.records.forEach((record,i)=>{record.result=task.steps[i].options[0];record.note='已完成本轮允许范围，具体原因仍待核实。'})
  submitTask(state,event.id,task.id)
 }
 const task=currentTask(event),latest=event.reports.at(-1)
 latest.submissionNumber=2;latest.markdown='# 最新维修报告\n\n本轮第二次提交内容。'
 const prior={...structuredClone(latest),id:latest.id+'-prior',submissionNumber:1,markdown:'# 首次维修报告\n\n本轮首次提交的独有内容。'}
 event.reports.splice(-1,0,prior)
 return {state,event,task,prior,latest}
}
function mount(component,pinia,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{};app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('report controls avoid duplicate metadata and supplementation keeps the selected target without a task composer badge',async t=>{
 const oldWindow=globalThis.window
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 let mounted
 try{
  const {default:Report}=await server.ssrLoadModule('/src/components/LifecycleReport.vue')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  const {default:EventView}=await server.ssrLoadModule('/src/views/EventLifecycleView.vue')
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  globalThis.window={addEventListener(){}}
  useSensorStore().configureSimulation({enabled:false})
  const data=fixture(),store=useEventLifecycleStore()
  store.state.events=data.state.events;store.state.role='engineer'
  const event=store.state.events[data.event.id],task=currentTask(event),prior=event.reports.find(report=>report.id===data.prior.id),latest=event.reports.at(-1)

  await t.test('shared report omits the repeated kind and time bar while preserving revision history',async()=>{
   const report={...prior,updatedAt:'2026-11-06T09:00:00.000Z',revisions:[{id:'revision',at:'2026-11-06T08:00:00.000Z',text:'补充剩余试验范围。',before:{markdown:'# 修订前的原稿\n\n原有事实保留。'}}]}
   const embedded=await renderToString(createSSRApp({render:()=>h(Report,{report,showDownload:false})}))
   assert.doesNotMatch(embedded,/<header|>下载(?: Markdown)?<|维修报告 · /)
   assert.match(embedded,/首次提交的独有内容/);assert.match(embedded,/已更新 1 次/);assert.match(embedded,/修订前的原稿/)
   const standalone=await renderToString(createSSRApp({render:()=>h(Report,{report})}))
   const header=standalone.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1]
   assert.match(header,/>下载<\/button>/);assert.doesNotMatch(header,/维修报告|2026|Markdown/)
  })

  await t.test('event stage selectors and a single download share a toolbar and retain the selected historical report',async()=>{
   const router=createRouter({history:createMemoryHistory(),routes:[{name:'EventLifecycle',path:'/situation/issue/:attentionId',component:EventView}]})
   await router.push({path:'/situation/issue/'+event.id,query:{report:prior.id}})
   const html=await renderToString(createSSRApp(EventView).use(pinia).use(router))
   const toolbar=html.match(/<div[^>]*class="stage-report-toolbar"[^>]*>([\s\S]*?)<\/div>/)?.[1]
   assert.ok(toolbar);assert.match(toolbar,/<nav[^>]*aria-label="本轮提交版本"/)
   assert.match(toolbar,/aria-pressed="true"[^>]*>维修报告 · 第1次提交/)
   assert.match(toolbar,/aria-pressed="false"[^>]*>维修报告 · 第2次提交/)
   assert.match(toolbar,/<\/nav>\s*<button[^>]*class="download-btn"[^>]*>下载<\/button>/)
   assert.equal((html.match(/>下载<\/button>/g)||[]).length,1)
   assert.match(html,/本轮首次提交的独有内容/);assert.doesNotMatch(html,/本轮第二次提交内容|下载 Markdown/)
   const content=html.match(/<section class="lc-report"[^>]*>([\s\S]*?)<\/section>/)?.[1]
   assert.ok(content);assert.doesNotMatch(content,/<header/)
  })

  await t.test('external supplementation focuses and highlights the input without changing text or the chosen historical target',async()=>{
   mounted=mount(Assistant,pinia,{event,taskId:task.id})
   const state=mounted.state,focusCalls=[],sent=[]
   state.inputEl={scrollIntoView:options=>focusCalls.push(['scroll',options]),focus:options=>focusCalls.push(['focus',options])}
   state.input='人工尚未发送的补充'
   store.ask=async(...args)=>sent.push(args)
   state.supplementReport(prior.id);await nextTick();await nextTick()
   assert.equal(state.mode,'report');assert.equal(state.targetReport,prior.id);assert.equal(state.input,'人工尚未发送的补充')
   assert.equal(state.composerHighlight,true);assert.ok(focusCalls.some(([action])=>action==='focus'));assert.equal(sent.length,0)
   state.supplementReport('not-an-editable-report');assert.equal(state.targetReport,prior.id)
   await state.ask(state.input)
   assert.deepEqual(sent[0],[event.id,'人工尚未发送的补充',{mode:'report',reportId:prior.id,taskId:task.id,phaseId:undefined}])
   assert.equal(latest.id,data.latest.id)
  })

  await t.test('task composer drops only its supplement badge, retaining multiple-report target selection and the event entry',async()=>{
   const render=(taskId,mode='chat')=>renderToString(createSSRApp({...Assistant,setup(props,context){const state=Assistant.setup(props,context);state.mode.value=mode;state.targetReport.value=prior.id;return state}},{event,taskId}).use(pinia))
   for(const mode of ['chat','report']){
    const html=await render(task.id,mode),composer=html.match(/<form[^>]*class="lc-composer"[^>]*>([\s\S]*?)<\/form>/)?.[1]
    assert.ok(composer);assert.doesNotMatch(composer,/>补充报告<\/button>/)
    if(mode==='report')assert.match(composer,/aria-label="要补充的报告"/)
    else assert.doesNotMatch(composer,/lc-chat-mode/)
   }
   assert.match(await render(''),/>补充报告<\/button>/,'the event assistant still has an entry when no external task toolbar is present')
  })
 }finally{mounted?.app.unmount();disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
