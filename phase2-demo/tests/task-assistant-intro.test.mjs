import test from 'node:test'
import assert from 'node:assert/strict'
import {taskAssistantIntro} from '../src/workflow/taskAssistantIntro.js'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'

const event={title:'二缸报警与喷射控制核实',reports:[{id:'report-1',title:'第1轮排查报告',summary:'尚不能确认卡滞原因'}]}
test('task introductions explain the actual event, source report and selected work without inferring a fault',()=>{
 const investigation={kind:'investigation',status:'assigned',steps:[{label:'核查 C2 ICU 液压机构与反馈'},{label:'核查燃油供给与瞬态工况'}]}
 const text=taskAssistantIntro(event,investigation)
 assert.equal(text.length,2);assert.match(text[0],/二缸报警与喷射控制核实/)
 assert.match(text[1],/核查 C2 ICU 液压机构与反馈、核查燃油供给与瞬态工况/)
 assert.doesNotMatch(text.join(''),/已损坏|确认故障|原因已确认|已完成/)
 const repair={kind:'repair',status:'assigned',sourceReportId:'report-1',steps:[{label:'作业准备与安全隔离',substeps:[{label:'准备备件'},{label:'落实隔离'}]},{label:'实施维修',substeps:[{label:'处理二缸 ICU 控制与液压执行异常'}]}]}
 assert.match(taskAssistantIntro(event,repair)[0],/承接《第1轮排查报告》/)
 assert.match(taskAssistantIntro(event,repair)[1],/处理二缸 ICU/)
 assert.doesNotMatch(taskAssistantIntro(event,repair)[1],/准备备件/)
 const maintenance={kind:'maintenance',status:'assigned',maintenance:{plan:{title:'四缸测温与燃烧平衡专项维保'}},steps:[{label:'校验四缸排温测量链路'}]}
 const intro=taskAssistantIntro({...event,title:'四缸排温相对基线下移跟踪'},maintenance)
 assert.match(intro[0],/四缸排温相对基线下移跟踪/);assert.match(intro[0],/四缸测温与燃烧平衡专项维保/)
 assert.match(intro[1],/校验四缸排温测量链路/)
 assert.deepEqual(taskAssistantIntro(event,null),[])
})

test('submitted, waiting and interrupted tasks do not present completed work as still to be executed',()=>{
 const task={kind:'repair',steps:[{label:'实施已批准部位的修复'}]}
 for(const [status,phrase] of [['submitted','反馈已提交'],['reporting','报告正在生成'],['report-error','尚未生成完成'],['waiting','等待执行条件'],['terminated','未执行部分已终止']]){
  const intro=taskAssistantIntro(event,{...task,status})
  assert.equal(intro.length,3);assert.ok(intro[2].includes(phrase))
  assert.doesNotMatch(intro.join(''),/本轮已全部完成|仍待执行|原因已确认/)
 }
 assert.match(taskAssistantIntro(event,{kind:'investigation',purpose:'recheck',status:'assigned',steps:[]})[0],/这项复查/)
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
  assert.ok(intro);assert.match(intro,/二缸报警与喷射控制核实/)
  assert.doesNotMatch(intro,/<h\d|<strong|report-proposal/)
  assert.ok(html.indexOf('task-assistant-intro')<html.indexOf('aria-label="继续追问"'))
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
