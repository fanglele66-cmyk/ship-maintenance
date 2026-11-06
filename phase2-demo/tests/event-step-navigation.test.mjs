import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {createLifecycleState,decide,currentTask,submitTask,people,ensureTaskPlan} from '../src/workflow/eventLifecycle.js'

const id='real-alarm-0430'
function steps(kind,prefix){
 const labels=kind==='investigation'?['核对当前信号与执行机构','核对供油与运行条件']:['作业准备与安全隔离','实施维修与过程记录','复装与分阶段试验','交接与效果观察']
 return labels.map((label,i)=>({label,guide:`${prefix}第${i+1}项专用说明`,checks:[`${prefix}第${i+1}项独立操作`],recordHint:`${prefix}第${i+1}项回交要求`,options:kind==='investigation'?['发现异常','未见异常','无法确认']:['已完成','未完成','不适用']}))
}
function assign(state,action='investigate'){
 const event=state.events[id];state.role='captain'
 decide(state,id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const task=currentTask(event)
 task.steps=steps(task.kind,task.kind==='investigation'?'排查':'维修')
 task.draft.records=task.steps.map(step=>({label:step.label,result:'',note:''}))
 return task
}
function submit(state,task,note='已提交的现场记录'){
 state.role='engineer'
 task.draft.records.forEach((record,i)=>{record.result=task.steps[i].options[0];record.note=`${note}第${i+1}项`})
 return submitTask(state,id,task.id)
}
function assigned(kind){
 const state=createLifecycleState();let task=assign(state)
 if(kind==='repair'){submit(state,task);task=assign(state,'repair')}
 return {state,event:state.events[id],task}
}
function panel(html){
 const start=html.search(/<section[^>]*role="tabpanel"/)
 assert.ok(start>=0,'a readable active step panel is present')
 let depth=0
 for(const match of html.slice(start).matchAll(/<\/?section\b[^>]*>/g)){
  depth+=match[0].startsWith('</')?-1:1
  if(!depth)return html.slice(start,start+match.index+match[0].length)
 }
 assert.fail('the active panel must have a closing section')
}
function assertSingleStep(html,prefix){
 assert.equal((html.match(/role="tabpanel"/g)||[]).length,1)
 const body=panel(html)
 assert.ok(body.includes(`${prefix}第1项专用说明`));assert.ok(body.includes(`${prefix}第1项独立操作`))
 assert.ok(!body.includes(`${prefix}第2项专用说明`));assert.ok(!body.includes(`${prefix}第2项独立操作`))
 assert.doesNotMatch(body,/<h[23]\b/,'the selected step does not repeat its tab as a large heading')
 return body
}

test('event task previews and records render one readable step with role-safe feedback and immutable history',async t=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 try{
  const {default:View}=await server.ssrLoadModule('/src/views/EventLifecycleView.vue')
  const {default:Plan}=await server.ssrLoadModule('/src/components/LifecycleTaskPlan.vue')
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  globalThis.window={addEventListener(){}}
  let externalCalls=0
  globalThis.fetch=async()=>{externalCalls++;throw Error('external model requests are disabled in this UI test')}
  useSensorStore().configureSimulation({enabled:false})
  const store=useEventLifecycleStore()
  store.prepareTaskPlan=async eventId=>store.state.events[eventId].pendingPlan
  const router=createRouter({history:createMemoryHistory(),routes:[{name:'EventLifecycle',path:'/situation/issue/:attentionId',component:View}]})
  async function render(data,role,tab,query={}){
   store.state.events=data.state.events;store.state.role=role
   await router.push({path:'/situation/issue/'+id,query})
   const selectedView={...View,setup(props,context){const result=View.setup(props,context);result.tab.value=tab;return result}}
   return renderToString(createSSRApp(selectedView).use(pinia).use(router))
  }

  for(const kind of ['investigation','repair'])await t.test(`${kind} AI suggestion shows one step without duplicated task heading, attention summary or feedback`,async()=>{
   const data=kind==='investigation'?{state:createLifecycleState()}:assigned('investigation')
   data.event=data.state.events[id]
   if(kind==='repair'){submit(data.state,data.task);data.event.decisionDraft={action:'repair'}}
   const plan=ensureTaskPlan(data.event)
   plan.steps=steps(kind,'建议');plan.rationale='不应重复显示的重点关注';plan.scope='任务范围保持原样'
   const snapshot=JSON.stringify(plan)
   const html=await render(data,'captain',kind==='investigation'?'AI排查建议':'AI维修建议')
   assertSingleStep(html,'建议')
   assert.doesNotMatch(html,/不应重复显示的重点关注|重点关注|record-feedback/)
   const standalone=await renderToString(createSSRApp(Plan,{event:data.event}).use(pinia))
   assert.doesNotMatch(standalone,/<h2\b/);assert.match(standalone,/通过对话修改任务/)
   assert.equal(JSON.stringify(plan),snapshot)
  })

  for(const kind of ['investigation','repair'])await t.test(`${kind} assigned previews hide private drafts from captain and preserve the executor entry`,async()=>{
   const data=assigned(kind),prefix=kind==='investigation'?'排查':'维修'
   data.task.draft.records[0]={label:data.task.steps[0].label,result:'无法确认',note:'只属于执行人的尚未提交草稿'}
   const before=JSON.stringify(data.task)
   const captain=await render(data,'captain',kind==='investigation'?'排查步骤':'维修方案')
   assertSingleStep(captain,prefix)
   assert.doesNotMatch(captain,/只属于执行人的尚未提交草稿|record-feedback|>无法确认<\/dd>/)
   const executor=await render(data,'engineer',prefix+'步骤')
   assertSingleStep(executor,prefix)
   assert.match(executor,new RegExp(`进入${prefix}任务 →`))
   assert.doesNotMatch(executor,/record-feedback/)
   assert.equal(JSON.stringify(data.task),before)
  })

  await t.test('submitted, generating, failed, waiting and terminated stages expose only submitted step feedback',async()=>{
   const data=assigned('repair');submit(data.state,data.task,'正式维修结果')
   data.task.draft.records[0].note='后来尚未提交的私有修改'
   for(const status of ['submitted','reporting','report-error','waiting','terminated']){
    data.task.status=status
    if(status==='waiting')data.task.waiting={reason:'等待补齐执行条件'}
    const html=await render(data,'captain','维修方案'),body=assertSingleStep(html,'维修')
    assert.match(body,/作业反馈/);assert.match(body,/已完成/);assert.match(body,/正式维修结果第1项/)
    assert.doesNotMatch(body,/正式维修结果第2项|后来尚未提交的私有修改/)
   }
  })

  await t.test('historical task phases use submission snapshots rather than later live steps and records',async()=>{
   const data=assigned('investigation'),oldReport=submit(data.state,data.task,'历史排查正式结果')
   data.task.steps[0].guide='后来变更的任务说明';data.task.records[0].note='后来变更的现场记录'
   assign(data.state,'repair')
   const frozen=JSON.stringify(oldReport.submissionSnapshot),live=JSON.stringify(data.task)
   const html=await render(data,'captain','排查步骤',{report:oldReport.id}),body=assertSingleStep(html,'排查')
   assert.match(body,/历史排查正式结果第1项/);assert.doesNotMatch(body,/后来变更的/)
   assert.equal(JSON.stringify(oldReport.submissionSnapshot),frozen);assert.equal(JSON.stringify(data.task),live)
  })

  await t.test('switching report versions within a historical task also switches its read-only step snapshot',async()=>{
   const data=assigned('investigation'),first=submit(data.state,data.task,'首次提交记录')
   const second=structuredClone(first);second.id=first.id+'-second';second.submissionNumber=2
   second.submissionSnapshot.records[0].note='第二次提交记录第1项';second.submissionSnapshot.steps[0].guide='新版排查第1项专用说明'
   data.event.reports.push(second)
   data.event.phases.push({...data.event.phases.at(-1),id:'second-submission-phase',reportId:second.id})
   data.task.records=structuredClone(second.submissionSnapshot.records);data.task.steps=structuredClone(second.submissionSnapshot.steps)
   assign(data.state,'repair')
   const frozen=JSON.stringify([first,second,data.task])
   for(const [report,expected,rejected] of [[first,'首次提交记录第1项','第二次提交记录第1项'],[second,'第二次提交记录第1项','首次提交记录第1项'],[first,'首次提交记录第1项','第二次提交记录第1项']]){
    const body=panel(await render(data,'captain','排查步骤',{report:report.id}))
    assert.ok(body.includes(expected),`${report.submissionNumber}: selected report facts are shown`)
    assert.ok(!body.includes(rejected),`${report.submissionNumber}: other submission facts stay hidden`)
   }
   assert.equal(JSON.stringify([first,second,data.task]),frozen)
  })
  assert.equal(externalCalls,0)
 }finally{disposePinia(pinia);await server.close();globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
