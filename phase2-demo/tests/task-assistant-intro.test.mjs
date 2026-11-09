import test from 'node:test'
import assert from 'node:assert/strict'
import {taskAssistantIntro} from '../src/workflow/taskAssistantIntro.js'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'

const event={title:'二缸报警与喷射控制核实',reports:[{id:'report-1',title:'第1轮排查报告',summary:'尚不能确认卡滞原因'}]}
test('task introductions explain note assistance in short conversational language',()=>{
 for(const [kind,label] of [['investigation','排查'],['repair','维修'],['maintenance','维保']]){
  const text=taskAssistantIntro(event,{kind,status:'assigned',steps:[]})
  assert.equal(text.length,2);assert.match(text[0],/我是任务助手/);assert.ok(text[0].includes(label+'备注'))
  assert.match(text[1],/追问.*核对后由你采用/)
  assert.ok(text.join('').length<110)
  assert.doesNotMatch(text.join(''),/已损坏|确认故障|原因已确认|已完成/)
 }
 assert.deepEqual(taskAssistantIntro(event,null),[])
})

test('the introduction stays unchanged across submission, report generation and other task states',()=>{
 for(const kind of ['investigation','repair','maintenance']){
  const task={kind,steps:[]},initial=taskAssistantIntro(event,{...task,status:'assigned'})
  for(const status of ['submitted','reporting','report-error','waiting','terminated']){
   assert.deepEqual(taskAssistantIntro(event,{...task,status}),initial)
  }
 }
 assert.match(taskAssistantIntro(event,{kind:'investigation',purpose:'recheck',status:'assigned',steps:[]})[0],/复查备注/)
})

test('the introductory AI bubble stays before the conversation as messages arrive',async()=>{
 const priorWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const pinia=createPinia();setActivePinia(pinia)
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  useSensorStore().configureSimulation({enabled:false})
  const state=createLifecycleState(),id='real-alarm-0430'
  decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
  const task=currentTask(state.events[id]);task.conversations={engineer:[],captain:[]}
  const store=useEventLifecycleStore();store.state.events=state.events;store.state.role='engineer'
  const render=()=>renderToString(createSSRApp({render:()=>h(Assistant,{event:store.state.events[id],taskId:task.id})}).use(pinia))
  const html=await render()
  const intro=html.match(/<article class="lc-message task-assistant-intro"[^>]*>([\s\S]*?)<\/article>/)?.[1]
  assert.ok(intro);assert.match(intro,/我是任务助手/)
  assert.doesNotMatch(intro,/<h\d|<strong|report-proposal/)
  assert.ok(html.indexOf('task-assistant-intro')<html.indexOf('class="assistant-question"'))
  assert.equal((intro.match(/<p/g)||[]).length,2)
  task.conversations.engineer.push({id:'later-user',kind:'user',text:'这里是用户刚补充的情况。',at:new Date().toISOString()},{id:'later-assistant',kind:'step-assist',source:'scripted-demo',stepIndex:0,status:'complete',response:{kind:'question',text:'请确认实际检查范围。'},at:new Date().toISOString()})
  const populated=await render()
  assert.ok(populated.indexOf('task-assistant-intro')<populated.indexOf('data-message-id="later-user"'))
  assert.ok(populated.indexOf('data-message-id="later-user"')<populated.indexOf('data-message-id="later-assistant"'))
  assert.equal((populated.match(/task-assistant-intro/g)||[]).length,1)
  assert.doesNotMatch(populated,/演示 ·|step-assist-label/)
  assert.equal(task.conversations.engineer.at(-1).source,'scripted-demo','presentation does not remove internal provenance')
 }finally{disposePinia(pinia);await server.close();if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow}
})
