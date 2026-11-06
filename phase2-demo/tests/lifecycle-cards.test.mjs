import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createServer} from 'vite'
import * as Vue from 'vue'
import {parse} from '@vue/compiler-sfc'
import {compile} from '@vue/compiler-dom'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {createLifecycleState,decide,currentTask,submitTask,people,timeText} from '../src/workflow/eventLifecycle.js'
import {reportCardTask} from '../src/workflow/lifecycleCardPresentation.js'
import {lifecycleWorkItems} from '../src/workflow/lifecycleWorkItems.js'
import {taskTitle} from '../src/workflow/taskLabels.js'

function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 const dispatch=action=>{state.role='captain';decide(state,event.id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()});return currentTask(event)}
 const first=dispatch('investigate');state.role='engineer'
 first.draft.records.forEach((record,i)=>{record.result=first.steps[i].options[0];record.note='已记录本轮允许检查范围。'})
 const report=submitTask(state,event.id,first.id),second=dispatch('repair')
 return {state,event,first,second,report}
}

test('report card task affiliation follows the recorded submission and does not guess the current task',()=>{
 const {state,event,first,second,report}=fixture(),before=JSON.stringify(state)
 assert.notEqual(event.currentTask,first.id)
 assert.deepEqual(reportCardTask(report,state.events),{id:first.id,title:taskTitle(first),path:'/tasks/'+first.id})
 for(const kind of ['闭环报告','上报岸基报告','观察报告']){
  assert.equal(reportCardTask({eventId:event.id,kind},state.events),null)
 }
 assert.equal(reportCardTask({...report,taskId:'missing',submissionSnapshot:{...report.submissionSnapshot,id:second.id}},state.events),null)
 const archived={...report,taskId:'archived-task',submissionSnapshot:{...report.submissionSnapshot,id:'archived-task'}}
 assert.deepEqual(reportCardTask(archived,state.events),{id:'archived-task',title:taskTitle(archived.submissionSnapshot),path:null})
 assert.equal(JSON.stringify(state),before)
})

test('observation report can link to its actual source task but initial system bases cannot invent a task',()=>{
 const {state,event,first,report}=fixture()
 const observation={id:'observation',tasks:[],reports:[],observationSource:{taskId:first.id,task:structuredClone(first)}}
 state.events[observation.id]=observation
 const observingReport={...report,eventId:observation.id}
 observation.reports.push(observingReport)
 assert.equal(reportCardTask(observingReport,state.events).path,'/tasks/'+first.id)
 const initial={id:'initial-observation',kind:'investigation',round:0,steps:[]}
 observation.observationSource={taskId:initial.id,task:initial}
 const initialReport={id:'initial-report',eventId:observation.id,taskId:initial.id}
 observation.reports.push(initialReport)
 assert.equal(reportCardTask(initialReport,state.events),null)
 assert.equal(event.currentTask,state.events[event.id].tasks.at(-1).id)
})

test('task cards retain the original dispatch time after a later resume changes sorting time',()=>{
 const {state,second}=fixture(),assignedAt=second.assignedAt
 second.resumedAt=new Date(Date.parse(assignedAt)+3600000).toISOString()
 const item=lifecycleWorkItems(state).assigned.find(item=>item.taskId===second.id)
 assert.equal(item.assignedAt,assignedAt)
 assert.equal(item.at,second.resumedAt)
})

test('active list cards render essential metadata and their nested event link navigates independently',async t=>{
 const oldWindow=globalThis.window,server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 let mounted
 try{
  const {default:List}=await server.ssrLoadModule('/src/views/LifecycleListView.vue')
  const {default:Todo}=await server.ssrLoadModule('/src/views/LifecycleTodoView.vue')
  const {default:Reports}=await server.ssrLoadModule('/src/views/LifecycleReportView.vue')
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  globalThis.window={addEventListener(){}}
  useSensorStore().configureSimulation({enabled:false})
  const store=useEventLifecycleStore(),router=createRouter({history:createMemoryHistory(),routes:[
   {path:'/issues',component:List},{path:'/event',name:'EventCenter',component:Todo},
   {path:'/reports/:reportId?',component:Reports},{path:'/situation/issue/:attentionId',component:{render:()=>null}},
   {path:'/tasks/:taskId',component:{render:()=>null}}
  ]})
  const render=component=>renderToString(Vue.createSSRApp(component).use(pinia).use(router))

  await t.test('event cards omit descriptions and name the captain responsible',async()=>{
   const state=createLifecycleState();store.state.events=state.events;store.state.role='captain'
   await router.push('/issues')
   const html=await render(List),card=html.match(/<article[^>]*data-event-id="real-alarm-0430"[^>]*>([\s\S]*?)<\/article>/)?.[1]
   assert.ok(card);assert.match(card,new RegExp(people.captain));assert.doesNotMatch(card,/card-summary|>轮机长<\/dd>/)
  })

  const data=fixture();data.second.scope='任务简介不应显示';data.report.summary='报告简介不应显示'
  store.state.events=data.state.events;store.state.role='engineer'
  await t.test('task cards show original dispatch time and a clean event link',async()=>{
   await router.push('/event')
   const html=await render(Todo)
   assert.match(html,/派发时间/);assert.ok(html.includes(timeText(data.second.assignedAt)))
   assert.ok(html.includes('href="/situation/issue/'+data.event.id+'"'))
   assert.doesNotMatch(html,/任务简介不应显示|work-summary/)
   const eventLink=html.match(/<div class="work-event"[^>]*>([\s\S]*?)<\/div>/)?.[1]
   assert.ok(eventLink);assert.doesNotMatch(eventLink,/待决策|处理中|已闭环/)
  })
  await t.test('report cards name the correct earlier task without showing summary',async()=>{
   await router.push('/reports')
   const html=await render(Reports)
   assert.match(html,/所属任务/);assert.ok(html.includes('href="/tasks/'+data.first.id+'"'))
   assert.ok(html.includes(taskTitle(data.first)))
   assert.doesNotMatch(html,/报告简介不应显示/)
  })
  await t.test('clicking the task event link stops bubbling and opens the event rather than the task',async()=>{
   await router.push('/event')
   const source=await readFile(new URL('../src/views/LifecycleTodoView.vue',import.meta.url),'utf8')
   const linkTemplate=parse(source).descriptor.template.content.match(/<div class="work-event">[\s\S]*?<\/div>/)?.[0]
   assert.ok(linkTemplate)
   const {code}=compile(linkTemplate,{mode:'function'})
   const render=new Function('Vue',code)(Vue),node=(tag='')=>({tag,children:[],props:{}})
   const renderer=Vue.createRenderer({createElement:node,createText:text=>({...node(),text}),createComment:node,
    insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(node,text){node.text=text},
    patchProp(node,key,old,value){node.props[key]=value},parentNode:node=>node.parent,nextSibling:()=>null})
   mounted=renderer.createApp({setup:()=>({item:store.workItems.pending.find(item=>item.taskId===data.second.id)}),render})
   mounted.config.warnHandler=()=>{};mounted.provide(Vue.ssrContextKey,{});mounted.use(pinia);mounted.use(router)
   const root=node();mounted.mount(root)
   const flatten=node=>[node,...node.children.flatMap(flatten)]
   const link=flatten(root).find(node=>node.tag==='a'&&node.props.href==='/situation/issue/'+data.event.id)
   assert.ok(link)
   let stopped=0
   const click={button:0,currentTarget:{getAttribute:()=>null},preventDefault(){},stopPropagation(){stopped++}}
   for(const handler of [link.props.onClick].flat())await handler(click)
   await Vue.nextTick()
   assert.ok(stopped>0);assert.equal(router.currentRoute.value.path,'/situation/issue/'+data.event.id)
  })
 }finally{mounted?.unmount();disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
