import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {compactC2RepairPreparation,repairStepForDisplay} from '../src/workflow/repairPreparation.js'
import {createLifecycleState,decide,currentTask,submitTask,ensureTaskPlan,people} from '../src/workflow/eventLifecycle.js'
import {repairProcedureVersion} from '../src/workflow/repairPlanning.js'

const eventId='real-alarm-0430'
const operation=(label,guide,checks,recordHint)=>({label,guide,checks,recordHint,options:['已完成','未完成','不适用']})
function legacyStep(){
 const substeps=[
  operation('核对异常、批准范围与作业工单','对照排查报告确认 ICU 获批范围。',['核对具体异常与批准部位。','未确认异常不自动换件。','缺工艺或超范围暂停并回报。'],'记录工单与批准范围。'),
  operation('准备备件、耗材与检修工具','按获批范围备齐 ICU 备件、耗材与专用工具。',['核对适配图号、合格证明与包装。','工具已校验；厂家力矩与验收值不猜填。','新旧件分区，防污染并接液。'],'登记图号、领用和缺件。'),
  operation('落实停机隔离与零能量确认','取得许可并协调停机，由执行人与监护人确认。',['防意外启动；电源与介质隔离并挂牌。','燃油与伺服油分别卸压，现场确认余压及温度；安全未确认不得松动高压连接。','隔离不明停止拆卸并回报。'],'记录隔离点、读数及复核人。'),
 ]
 return {label:'作业准备与安全隔离',guide:'按顺序完成本项作业。',checks:[],recordHint:substeps.map(part=>part.recordHint).join(' '),options:['已完成','未完成','不适用'],substeps}
}
function repairState(){
 const state=createLifecycleState(),event=state.events[eventId],form={owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()}
 decide(state,eventId,{action:'investigate',...form});state.role='engineer'
 const task=currentTask(event)
 task.draft.records.forEach((record,index)=>{record.result='发现异常';record.note=index===0?'二缸 ICU 液压活塞回位不畅，原因尚待确认。':'燃油供给响应尚待复核。'})
 submitTask(state,eventId,task.id);state.role='captain'
 return {state,event,form}
}

test('C2 preparation combines scope and supplies, retains every requirement and isolates safety work',()=>{
 const original=legacyStep(),before=structuredClone(original)
 original.substeps[1].checks.push(original.substeps[0].checks[0])
 const merged=compactC2RepairPreparation({id:eventId},original)
 assert.equal(merged.substeps.length,2);assert.match(merged.substeps[0].label,/批准范围.*工单、备件与工具/)
 assert.equal(merged.substeps[1],original.substeps[2],'isolation remains an unchanged independent card')
 for(const part of before.substeps)for(const text of [part.guide,...part.checks,part.recordHint])assert.ok(JSON.stringify(merged).includes(text),text)
 assert.equal(merged.substeps[0].checks.filter(check=>check===before.substeps[0].checks[0]).length,1)
 assert.equal(original.substeps.length,3);assert.equal(original.substeps[0].label,before.substeps[0].label)
 assert.equal(compactC2RepairPreparation({id:eventId},merged),merged,'already compact cards remain unchanged')
 assert.equal(compactC2RepairPreparation({id:'observation-1',sourceEventId:eventId},original).substeps.length,2)
})

test('other events, modified templates and submitted repair snapshots retain their existing structure',()=>{
 const original=legacyStep()
 assert.equal(compactC2RepairPreparation({id:'real-warning-0523'},original),original)
 const custom=structuredClone(original);custom.substeps[1].label='检查临时供油设施'
 assert.equal(compactC2RepairPreparation({id:eventId},custom),custom)
 for(const task of [{kind:'repair',status:'submitted'},{kind:'maintenance',status:'assigned'},{kind:'repair',status:'reporting'}])assert.equal(repairStepForDisplay({event:{id:eventId},task,step:original}),original)
 const task={kind:'repair',status:'assigned',steps:[original],draft:{stepIndex:0,records:[{result:'未完成',note:'尚未完成现场隔离复核。'}]},records:[{note:'旧已提交记录'}]},snapshot=structuredClone(task)
 assert.equal(repairStepForDisplay({event:{id:eventId},task,step:original}).substeps.length,2)
 assert.deepEqual(task,snapshot,'display projection does not alter instructions, decisions or submitted feedback')
})

test('new and refreshed pending C2 repair plans dispatch two preparation substeps',()=>{
 const {state,event,form}=repairState(),plan=ensureTaskPlan(event)
 assert.equal(plan.steps[0].substeps.length,2)
 plan.steps[0]=legacyStep();plan.procedureVersion=3
 const refreshed=ensureTaskPlan(event)
 assert.equal(refreshed.procedureVersion,repairProcedureVersion);assert.equal(refreshed.steps[0].substeps.length,2)
 decide(state,eventId,{action:'repair',...form})
 const task=currentTask(event)
 assert.equal(task.steps[0].substeps.length,2);assert.match(JSON.stringify(task.steps[0]),/燃油、伺服油分别隔离卸压/)
 assert.equal(task.draft.records.length,4);assert.ok(task.draft.records.every(record=>!record.result&&!record.note))
})

test('assigned legacy preparation renders two cards without pagination and keeps the isolation reference',async()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 try{
  const {default:Steps}=await server.ssrLoadModule('/src/components/LifecycleTaskSteps.vue')
  const {default:Instructions}=await server.ssrLoadModule('/src/components/LifecycleStepInstructions.vue')
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  useSensorStore().configureSimulation({enabled:false})
  const {state,event,form}=repairState();decide(state,eventId,{action:'repair',...form});state.role='engineer'
  const task=currentTask(event);task.steps[0]=legacyStep();task.draft.records[0].note='原记录保留：尚待现场隔离复核。'
  const store=useEventLifecycleStore();store.state.events=state.events;store.state.role=state.role
  const snapshot=structuredClone(task)
  const html=await renderToString(createSSRApp({render:()=>h(Steps,{event,task})}).use(pinia))
  assert.match(html,/本步骤共 2 个子项/);assert.doesNotMatch(html,/aria-label="本步骤作业子项"/)
  assert.equal((html.match(/class="substep"/g)||[]).length,2)
  assert.match(html,/1\.2 落实停机隔离与零能量确认/);assert.match(html,/fuel-system-overview/)
  assert.match(html,/尚待现场隔离复核/);assert.deepEqual(task,snapshot)
  task.status='submitted'
  const archived=await renderToString(createSSRApp(Instructions,{event,task,step:task.steps[0],compact:true,paginate:true,number:1}))
  assert.match(archived,/本步骤共 3 项/);assert.match(archived,/aria-label="本步骤作业子项"/)
  assert.deepEqual(task.steps,snapshot.steps);assert.deepEqual(task.draft,snapshot.draft)
 }finally{disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
