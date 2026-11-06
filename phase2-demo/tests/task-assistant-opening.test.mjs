import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'
import {assistTaskStep as collaborate} from '../src/workflow/taskStepAssistance.js'
import {assistTaskStep as reply} from '../server/step-assist.mjs'
import {taskAssistantOpening} from '../src/workflow/taskAssistantOpening.js'
import {STEP_ASSIST_DEMO_CASES} from '../src/workflow/stepAssistDemo.js'

function fixture(kind){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 const dispatch=action=>{state.role='captain';decide(state,event.id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()});state.role='engineer';return currentTask(event)}
 let task=dispatch('investigate')
 if(kind==='repair'){
  task.draft.records.forEach((record,i)=>{record.result=i?'未见异常':'发现异常';record.note=i?'供给已查范围未见异常。':'二缸 ICU 动作回位不畅，原因未确认。'})
  submitTask(state,event.id,task.id);task=dispatch('repair')
 }
 return {state,event,task}
}
for(const kind of ['investigation','repair'])test(`${kind}: opening choices introduce the existing conversation without supplying completed work`,async()=>{
 for(const choiceIndex of [0,1]){
  const {state,event,task}=fixture(kind),opening=taskAssistantOpening(task),before=JSON.stringify(task.draft.records),waits=[],progress=[]
  const request=(body,onProgress)=>reply(body,{configuration:{read:()=>assert.fail('opening and script must not invoke external provider')},fetcher:()=>assert.fail('no external requests'),wait:async ms=>{waits.push(ms)},emit:(event,data)=>{progress.push(data);onProgress(event,data)}})
  const ask=text=>collaborate(state,event.id,task.id,0,text,{},request,{})
  const first=await ask(opening.choices[choiceIndex].prompt)
  assert.equal(first.response.kind,'question');assert.ok(first.response.text.length<90)
  assert.equal(JSON.stringify(task.draft.records),before);assert.ok(waits.reduce((a,b)=>a+b,0)>=1500);assert.ok(progress.length>=3)
  for(const name of kind==='repair'?['preparationStart','preparationAnswer']:['investigationStart','investigationAnswer']){
   const item=STEP_ASSIST_DEMO_CASES.find(item=>item.id===name),message=await ask(item.input)
   assert.equal(message.source,'scripted-demo');assert.equal(message.response.kind,item.response.kind)
   assert.equal(message.response.note,item.response.note)
  }
  assert.equal(JSON.stringify(task.draft.records),before,'the opening and drafts do not fill results or adopt notes')
 }
})
