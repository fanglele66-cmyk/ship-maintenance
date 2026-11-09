import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {OTHER_STEP_ASSIST_CASES as cases,c4FollowupSteps} from '../src/workflow/stepAssistScenarios.js'
import {createLifecycleState,decide,currentTask,submitTask,ensureTaskPlan,decisionOptions,people} from '../src/workflow/eventLifecycle.js'
import {assistTaskStep,applyTaskStepNote} from '../src/workflow/taskStepAssistance.js'
import {assistTaskStep as serve} from '../server/step-assist.mjs'
import {isStepAssistScriptInput,matchStepAssistDemo} from '../src/workflow/stepAssistDemo.js'
import {taskAssistantOpening} from '../src/workflow/taskAssistantOpening.js'
import {taskAssistantIntro} from '../src/workflow/taskAssistantIntro.js'
import {maintenancePortCalls} from '../src/workflow/maintenancePlans.js'

const folders={'real-warning-0523':'控制空气步骤协作演示','real-tracking-exhaust-baseline':'一缸步骤协作演示','real-health-c4-baseline':'四缸步骤协作演示'}
const deadline=()=>new Date(Date.now()+86400000).toISOString()
const forbidden=()=>assert.fail('fixed conversations must not access model configuration, knowledge or provider')
const backend={configuration:{read:forbidden},knowledge:{search:forbidden},fetcher:forbidden,wait:async()=>{}}
function dispatch(state,id,action){
 state.role='captain';const event=state.events[id],form={action,owner:people.engineer,deadline:deadline()}
 if(action==='maintenance')Object.assign(form,{maintenancePlanId:'CBY-MP-BALANCE-01',window:maintenancePortCalls[0].id,deadline:maintenancePortCalls[0].end})
 decide(state,id,form);state.role='engineer';return currentTask(event)
}

for(const [id,folder] of Object.entries(folders))test(`${folder}: real dispatch → conversation → explicit adoption → both task reports`,async()=>{
 const state=createLifecycleState(),event=state.events[id],originalTasks=structuredClone(event.tasks),originalReports=structuredClone(event.reports)
 for(const kind of ['investigation',id==='real-tracking-exhaust-baseline'?'maintenance':'repair']){
  const task=dispatch(state,id,kind==='investigation'?'investigate':kind),intro=taskAssistantIntro(event,task)
  const selected=cases.filter(c=>c.eventId===id&&c.kind===kind)
  assert.equal(task.steps.length,new Set(selected.map(c=>c.stepIndex)).size)
  const ask=text=>assistTaskStep(state,id,task.id,task.draft.stepIndex||0,text,{},(body,emit)=>serve(body,{...backend,emit}))
  const opening=taskAssistantOpening(task)
  const first=await ask(opening.choices[0].prompt)
  assert.equal(first.response.kind,'question');assert.equal(task.draft.records[0].note,'')
  for(let index=0;index<task.steps.length;index++){
   task.draft.stepIndex=index
   const inputs=selected.filter(c=>c.stepIndex===index)
   assert.equal(task.steps[index].label,inputs[0].stepLabel)
   assert.ok(task.steps[index].options.includes(inputs[0].results[0]))
   for(const item of inputs){
    assert.ok(isStepAssistScriptInput({event,task,stepIndex:index,text:item.input}))
    const before=JSON.stringify(task.draft.records),message=await ask(item.input)
    assert.deepEqual(message.response,item.response,item.id)
    assert.equal(JSON.stringify(task.draft.records),before,'questions and drafts cannot write records')
    assert.equal(message.source,'scripted-demo');assert.deepEqual(message.usage,{inputTokens:0,outputTokens:0})
    assert.equal(message.progressLog.length,4)
    if(message.response.kind==='draft'){
     // Selecting a result after receiving the draft must not block adoption.
     task.draft.records[index].result=item.results[0]
     applyTaskStepNote(state,id,task.id,message.id)
     assert.equal(task.draft.records[index].note,item.response.note)
     assert.equal(task.draft.records[index].result,item.results[0])
    }
   }
  }
  const report=submitTask(state,id,task.id)
  assert.equal(report.taskId,task.id);assert.ok(report.markdown)
  assert.equal(task.status,'submitted');assert.deepEqual(taskAssistantIntro(event,task),intro)
  assert.equal(task.records.length,task.steps.length)
  if(kind!=='investigation'){
   assert.equal(task.goalStatus,'unresolved','partial tests must remain unfinished')
   assert.ok(decisionOptions(event).some(x=>x.value==='wait'));assert.ok(!decisionOptions(event).some(x=>x.value==='observe'))
  }
 }
 if(originalTasks.length){assert.deepEqual(event.tasks[0].records,originalTasks[0].records);assert.deepEqual(event.reports[0],originalReports[0])}
})

test('new scripts are exact, short, event-scoped, support jumping steps and protect intervening facts',()=>{
 const normalized=cases.map(c=>c.input.normalize('NFKC').replace(/\s/g,''))
 assert.equal(new Set(normalized).size,cases.length)
 assert.equal(new Set(cases.map(c=>`${c.eventId}:${c.kind}:${c.stepIndex}`)).size,20)
 for(const c of cases){
  const step={label:c.stepLabel},context={event:{id:c.eventId},task:{id:'task',kind:c.kind},step,stepIndex:c.stepIndex,record:{result:'',note:''},message:{text:c.input},history:[]}
  const history=c.requires.map(id=>({role:'user',stepIndex:c.stepIndex,text:cases.find(c=>c.id===id).input}))
  assert.equal(matchStepAssistDemo({context:{...context,history}}).kind,c.response.kind)
  assert.equal(matchStepAssistDemo({context:{...context,event:{id:'other-event'},history}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,stepIndex:c.stepIndex+1,history}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,message:{text:c.input+'另有新发现。'},history}}),null)
  if(c.requires.length)assert.equal(matchStepAssistDemo({context}).kind,'question')
  else assert.deepEqual(matchStepAssistDemo({context}),c.response,'each new step starts without previous step dialogue')
  assert.equal(matchStepAssistDemo({context:{...context,history:[...history,{role:'user',stepIndex:c.stepIndex,text:'更正，这步的处理和刚才说的不一样。'}]}}).kind,'question')
  assert.equal(matchStepAssistDemo({context:{...context,history,record:{result:'与脚本冲突'}}}).kind,'question')
  assert.ok(c.response.text.length<80)
  assert.doesNotMatch(c.input,/演示|练习|虚构|请只整理|我还没把/)
  const doc=readFileSync(new URL(`../docs/${folders[c.eventId]}/${c.kind==='investigation'?'排查':c.kind==='maintenance'?'维保':'维修'}演示脚本.md`,import.meta.url),'utf8')
  assert.ok(doc.includes(c.input),c.id);assert.ok(doc.includes(c.response.note||c.response.text),c.id)
 }
})

test('C4 initial follow-up gets a stable reviewed template without overwriting task history or edited plans',()=>{
 const event=createLifecycleState().events['real-health-c4-baseline'],history=JSON.stringify([event.tasks,event.reports])
 const draft=ensureTaskPlan(event)
 assert.equal(draft.status,'ready');assert.equal(draft.source,'preset');assert.deepEqual(draft.steps,c4FollowupSteps)
 assert.equal(JSON.stringify([event.tasks,event.reports]),history)
 assert.equal(ensureTaskPlan(event),draft)
 draft.status='ready';draft.steps[0].label='人员调整后的范围';draft.version++
 assert.equal(ensureTaskPlan(event).steps[0].label,'人员调整后的范围')
 const placeholder=createLifecycleState().events['real-health-c4-baseline'],p=ensureTaskPlan(placeholder)
 Object.assign(p,{status:'pending',source:'',version:0,steps:[]})
 assert.equal(ensureTaskPlan(placeholder).status,'ready')
 const future=structuredClone(event);future.tasks.push({...future.tasks[0],id:'next'});future.currentTask='next';future.pendingPlan=null
 assert.equal(ensureTaskPlan(future).status,'pending','later rounds must not reuse the second-round template')
})
