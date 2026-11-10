import test from 'node:test'
import assert from 'node:assert/strict'
import {seedDecisionForm} from '../src/workflow/decisionFormDefaults.js'
import {validateObservationPlan} from '../src/workflow/decisionDrafts.js'
import {createLifecycleState,decide,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'
import {currentDecisionPrompt,workbenchDetails} from '../src/workflow/workbenchDetails.js'
import {validateAnomalyReport,reportSensors,reportSensorsForSystems} from '../src/workflow/manualAnomaly.js'

test('observation proposals contain context and retain per-choice edits without confirming a task',()=>{
 const state=createLifecycleState(),event=state.events['real-warning-0523'],before=JSON.stringify(event)
 const now=Date.now(),draft={action:'observe',reason:'',evidence:'',deadline:'',observationPlan:{signals:'',conditions:''}}
 seedDecisionForm(event,draft,'observe',now)
 for(const key of ['purpose','signals','conditions','limits','trigger','dueAt'])assert.ok(draft.observationPlan[key],key)
 assert.match(draft.observationPlan.purpose,/控制空气/)
 assert.match(draft.observationPlan.signals,/压力/)
 const confirmed=validateObservationPlan(draft.observationPlan,now)
 assert.ok(Date.parse(confirmed.dueAt)>now&&Date.parse(confirmed.dueAt)-now<=2*3600000)
 draft.observationPlan.signals='只观察本轮已确认通路';draft.observationPlan.limits=''
 seedDecisionForm(event,draft,'observe',now+60000)
 assert.equal(draft.observationPlan.limits,'','an intentional blank is not replaced')
 seedDecisionForm(event,draft,'close',now)
 assert.ok(draft.reason&&draft.closureDraft.evidence)
 draft.reason='自定义闭环依据'
 seedDecisionForm(event,draft,'observe',now)
 assert.equal(draft.observationPlan.signals,'只观察本轮已确认通路')
 assert.equal(draft.observationPlan.limits,'')
 seedDecisionForm(event,draft,'close',now)
 assert.equal(draft.reason,'自定义闭环依据')
 assert.equal(JSON.stringify(event),before,'drafting is inert')
})

test('opening dispatch fields keeps existing user text and derives only a proposed deadline',()=>{
 const event=createLifecycleState().events['real-alarm-0430'],draft={action:'repair',evidence:'人工限定：仅检查线束',deadline:''}
 seedDecisionForm(event,draft,'repair')
 assert.equal(draft.evidence,'人工限定：仅检查线束')
 assert.match(draft.deadline,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
 assert.equal(event.tasks.length,0)
})

test('confirmed observation preserves the editable purpose and manual report sensor names',()=>{
 const state=createLifecycleState(),event=state.events['real-warning-0523'],deadline=new Date(Date.now()+3600000).toISOString()
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline})
 const task=currentTask(event);state.role='engineer'
 task.draft.records.forEach((r,i)=>{r.result=task.steps[i].options.find(v=>/未见异常|现场与系统一致|工况可比/.test(v))||task.steps[i].options[0];r.note='测试记录：已完成核对，仍需观察'})
 submitTask(state,event.id,task.id);state.role='captain'
 const draft={};seedDecisionForm(event,draft,'observe');draft.observationPlan.purpose='只跟踪本轮控制空气进口'
 decide(state,event.id,{action:'observe',observationPlan:draft.observationPlan})
 const child=state.events[event.observationEventIds.at(-1)]
 assert.equal(child.phases[0].observationPlan.purpose,'只跟踪本轮控制空气进口')
 const manual={...event,manualReport:{sensors:[{name:'人工事件冷却水测点'}]}}
 const manualDraft={};seedDecisionForm(manual,manualDraft,'observe')
 assert.match(manualDraft.observationPlan.signals,/人工事件冷却水测点/)
})

test('system selection restricts user-chosen sensors and retains ownership validation',()=>{
 const form={deviceId:'main-engine-1',selectionMode:'selected',systems:['冷却系统'],sensorIds:['local-DC0044','main-cyl-1-coolant'],start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'主机冷却水温度波动，需核对现场读数。'}
 const report=validateAnomalyReport(form,'engineer')
 assert.deepEqual(report.sensorIds,form.sensorIds)
 assert.ok(report.sensors.every(s=>s.subsystem==='冷却系统'))
 assert.deepEqual(validateAnomalyReport(report,'engineer').sensorIds,report.sensorIds)
 assert.throws(()=>validateAnomalyReport({...form,sensorIds:[]},'engineer'),/传感器/)
 assert.throws(()=>validateAnomalyReport({...form,systems:[]},'engineer'),/系统/)
 assert.throws(()=>validateAnomalyReport({...form,systems:['蒸汽系统']},'engineer'),/系统/)
 assert.throws(()=>validateAnomalyReport({...form,sensorIds:['s-001']},'engineer'),/所选系统/)
 assert.throws(()=>validateAnomalyReport({...form,end:form.start},'engineer'),/时间段/)
 assert.throws(()=>validateAnomalyReport({...form,description:''},'engineer'),/描述/)
})

test('workbench states the actual available next decision and keeps submitted context',()=>{
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 assert.equal(currentDecisionPrompt(event),'当前需决定：是否安排本轮现场核实/排查')
 assert.doesNotMatch(workbenchDetails(event,{kind:'decision'}).join(' '),/轮机长审阅并安排下一步/)
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+3600000).toISOString()})
 const task=currentTask(event);state.role='engineer';task.draft.records.forEach(r=>{r.result='发现异常';r.note='测试：已确认连接异常'})
 submitTask(state,event.id,task.id)
 const text=workbenchDetails(event,{kind:'decision'}).join(' ')
 assert.match(text,/当前需决定：安排维修、转入效果观察、闭环归档/)
 assert.match(text,/已回交排查报告/)
 assert.doesNotMatch(text,/提前安排维保/)
 task.status='waiting'
 assert.equal(currentDecisionPrompt(event),'当前需决定：恢复原任务、终止未执行部分')
})


test('only normalized legacy automatic reports remain readable without expanding their ids',()=>{
 const form={deviceId:'main-engine-1',selectionMode:'selected',systems:['冷却系统'],sensorIds:['local-DC0044'],start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'测试：核对所选系统内明确选中的测点。'}
 const report=validateAnomalyReport(form,'engineer')
 const saved={...report,selectionMode:'system'}
 assert.deepEqual(validateAnomalyReport(saved,'engineer').sensorIds,['local-DC0044'],'reading an existing automatic report must not add newly registered sensors')
 assert.throws(()=>validateAnomalyReport({...form,selectionMode:'system',systems:[],sensorIds:[]},'engineer'),/明确选择/)
 assert.throws(()=>validateAnomalyReport({...form,selectionMode:'system'},'engineer'),/明确选择/)
 assert.throws(()=>validateAnomalyReport({...saved,sensors:[]},'engineer'),/明确选择/)
 assert.throws(()=>validateAnomalyReport({...saved,sensors:[{id:'s-008'}]},'engineer'),/明确选择/)
})
