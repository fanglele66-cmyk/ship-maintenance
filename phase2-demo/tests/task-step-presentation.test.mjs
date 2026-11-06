import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {taskStepLabel} from '../src/workflow/taskStepPresentation.js'
import {maintenancePlans} from '../src/workflow/maintenancePlans.js'
import {createLifecycleState,people} from '../src/workflow/eventLifecycle.js'

const labels=['作业准备与安全隔离','实施维修与过程记录','复装与分阶段试验','交接与效果观察']
const steps=()=>labels.map(label=>({label,guide:`本项要求：${label}。`,checks:['按批准范围核对现场情况。'],recordHint:'登记本轮实际发现和未执行范围。',options:['已完成','未完成','不适用']}))

test('work phase labels are concise presentation values and preserve original persisted instructions',()=>{
 const original=steps(),snapshot=structuredClone(original)
 assert.deepEqual(original.map((step,index)=>taskStepLabel(step,'repair',index)),['作业准备','实施维修','复装试验','效果观察'])
 assert.deepEqual(original.map((step,index)=>taskStepLabel(step,'maintenance',index)),['作业准备','实施维保','复装试验','效果观察'])
 assert.deepEqual(original,snapshot)
 assert.equal(taskStepLabel({...original[0],short:'旧版准备与安全隔离'},'repair',0),'作业准备')
 for(const kind of ['investigation','investigate','recheck'])assert.equal(taskStepLabel(original[0],kind,0),labels[0])
 assert.equal(taskStepLabel({label:'人工增加的独立读数比对'},'repair',2),'读数比对','index alone must not turn a custom comparison into a restoration trial')
 assert.equal(taskStepLabel({label:'人工增加的独立读数比对',short:'读数比对'},'repair',2),'读数比对')
 assert.equal(taskStepLabel(undefined,'repair',2),'作业3')
})

test('custom work steps always have two-to-four-character navigation labels without mutating the source',()=>{
 const cases=[
  {step:{label:labels[0],short:'核准'},expected:'核准'},
  {step:{label:'人工增加的独立读数比对',short:'旧版完整而冗长的步骤名'},expected:'读数比对'},
  {step:{label:'检查油管接口是否存在泄漏'},expected:'泄漏检查'},
  {step:{label:'修复本次已经定位的接口泄漏'},expected:'泄漏处理'},
  {step:{label:'后续复核现场记录及未完成项'},expected:'后续复核'},
  {step:{label:'恢复本次批准的辅助供气系统'},expected:'系统恢复'},
  {step:{label:'按批准范围检修对应阀件'},expected:'部件检修'},
  {step:{label:'检修已确认故障的阀件'},expected:'部件检修'},
  {step:{label:'与厂家共同商定本项特别事项',short:'?'},expected:'作业3'},
  {step:{label:'',short:'过长的旧自定义简称'},expected:'作业3'},
  {step:{label:'特殊事项',short:' '},expected:'特殊事项'},
 ]
 for(const kind of ['repair','maintenance'])for(const {step,expected} of cases){
  const snapshot=structuredClone(step),display=taskStepLabel(step,kind,2)
  assert.equal(display,expected);assert.ok([...display].length>=2&&[...display].length<=4);assert.deepEqual(step,snapshot)
 }
 for(const kind of ['repair','maintenance'])for(const index of [-1,0,8,9,98,99,1000,NaN])for(const label of [undefined,'', '无法归类的长名称', '🛠️🛠️🛠️', 'x'.repeat(500)]){
  const step={label},snapshot=structuredClone(step),display=taskStepLabel(step,kind,index)
  assert.ok([...display].length>=2&&[...display].length<=4);assert.deepEqual(step,snapshot)
 }
})

test('existing maintenance plans retain their actual calibration, maintenance and retest meaning',()=>{
 for(const id of ['real-tracking-exhaust-baseline','real-health-c4-baseline']){
  const plans=maintenancePlans({id,tracking:true}),snapshot=structuredClone(plans)
  assert.deepEqual(plans[0].steps.map((step,index)=>taskStepLabel(step,'maintenance',index)),['作业准备','测温校验','复测汇报'])
  assert.deepEqual(plans[1].steps.map((step,index)=>taskStepLabel(step,'maintenance',index)),['作业准备','测温校验','专项维保','复测汇报'])
  assert.deepEqual(plans,snapshot)
 }
})

test('editing and read-only step views use short tabs without duplicate large headings or snapshot writes',async()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 try{
  const {default:Editor}=await server.ssrLoadModule('/src/components/LifecycleTaskSteps.vue')
  const {default:Records}=await server.ssrLoadModule('/src/components/LifecycleTaskRecords.vue')
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  useSensorStore().configureSimulation({enabled:false})
  const event=createLifecycleState().events['real-alarm-0430'],task={id:'presentation-task',kind:'repair',status:'assigned',owner:people.engineer,steps:steps(),draft:{stepIndex:0,records:steps().map(step=>({label:step.label,result:'',note:''})),summary:'',attachments:[]},records:steps().map(step=>({label:step.label,result:'已完成',note:'正式记录保留'}))}
  event.tasks.push(task);event.currentTask=task.id
  const store=useEventLifecycleStore();store.state.events={[event.id]:event};store.state.role='engineer'
  const snapshot=structuredClone(task)
  const render=(Component,extra={})=>renderToString(createSSRApp({render:()=>h(Component,{event,task,records:task.records,...extra})}).use(pinia))
  for(const Component of [Editor,Records]){
   const html=await render(Component)
   for(const label of ['作业准备','实施维修','复装试验','效果观察'])assert.ok(html.includes('</span>'+label+'</button>'),label)
   assert.doesNotMatch(html,/<h3\b|record-step-heading/)
   assert.match(html,/本项要求：作业准备与安全隔离/,'full requirements are still visible')
   assert.match(html,/title="作业准备与安全隔离"/,'the full phase title remains available on the tab')
  }
  assert.deepEqual(task,snapshot)
  const hidden=await render(Records,{showFeedback:false})
  assert.match(hidden,/aria-label="任务步骤"/);assert.doesNotMatch(hidden,/record-feedback|正式记录保留|class="[^"]*complete/)
  const visible=await render(Records)
  assert.match(visible,/aria-label="执行记录步骤"/);assert.match(visible,/正式记录保留|class="active complete"/)
  for(const action of ['investigate','recheck']){
   const plan={action,steps:[{label:'核对本轮测点',guide:'核对独立读数。',checks:['记录本次读数。'],recordHint:'专属回交要求：保留独立读数、时间和缺测范围。',options:['发现异常','未见异常','无法确认']}]}
   const html=await render(Records,{task:plan,showFeedback:false})
   assert.match(html,/专属回交要求：保留独立读数、时间和缺测范围/);assert.doesNotMatch(html,/record-feedback|<h3\b/)
  }
  const plan={action:'repair',steps:steps()}
  const siblings=await renderToString(createSSRApp({render:()=>h('div',[h(Records,{event,task:plan,showFeedback:false}),h(Records,{event,task:plan,showFeedback:false})])}))
  const panelIds=[...siblings.matchAll(/id="(task-record-panel-[^"]+)"/g)].map(match=>match[1])
  assert.equal(panelIds.length,2);assert.equal(new Set(panelIds).size,2,'id-free plans get separate accessible panels')
  assert.deepEqual(task,snapshot)
 }finally{disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
