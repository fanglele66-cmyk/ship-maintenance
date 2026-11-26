import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {createStepQuestionLedger,enforceStepFollowUpPolicy} from '../server/step-assist.mjs'
import {buildStepAssistRequest,prepareStepAssistInput,stepFollowUpState,crewFacingStepText} from '../src/workflow/stepAssistContract.js'
import {assistTaskStep,applyTaskStepNote} from '../src/workflow/taskStepAssistance.js'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'

const question={kind:'question',text:'请确认现场情况。',question:'是否已核对反馈线束？',choices:[{id:'a',label:'已在许可范围内核对'},{id:'b',label:'尚未核对'}],allowOther:false,followUpRound:8,maxFollowUpRounds:10}
const context=(stepIndex=0)=>({event:{id:'event-1'},task:{id:'task-1'},stepIndex,followUpState:stepFollowUpState(),record:{},message:{text:'现场已停机。'},history:[]})
function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer'
 return {state,event,task:currentTask(event)}
}

test('three delivered questions per step across simultaneous snapshots, replays and fresh sessions',()=>{
 const db=new DatabaseSync(':memory:')
 try{
  const tab1=createStepQuestionLedger(db),tab2=createStepQuestionLedger(db)
  const a=context(),b=context()
  tab1.refresh(a);tab2.refresh(b)
  const first=tab1.finish('request-a',a,question,false)
  assert.deepEqual([first.followUpRound,first.maxFollowUpRounds,first.allowOther],[1,3,true])
  assert.equal(tab2.finish('request-b',b,question,false).followUpRound,2)
  assert.deepEqual(tab2.finish('request-a',context(),question,false),first)
  assert.equal(tab2.finish('request-c',context(),question,false).followUpRound,3)
  const resumed=createStepQuestionLedger(db),fresh=context()
  resumed.refresh(fresh);assert.deepEqual(fresh.followUpState,stepFollowUpState(3))
  assert.equal(resumed.finish('request-d',context(),question,false).kind,'draft')
  assert.equal(resumed.finish('repeat-opening',context(),question,true).kind,'draft')
  assert.equal(resumed.finish('request-e',context(1),question,false).followUpRound,1)
 }finally{db.close()}
})

test('a long conversation keeps prior rounds after reload while the next task has its own budget',()=>{
 const {event,task}=fixture()
 task.conversations={engineer:[
  ...Array.from({length:3},()=>({kind:'step-assist',stepIndex:0,status:'complete',response:question})),
  ...Array.from({length:120},()=>({kind:'step-assist',stepIndex:1,status:'complete',response:{kind:'answer',text:'说明'}}))
 ]}
 const restored=JSON.parse(JSON.stringify(event))
 const build=(e)=>prepareStepAssistInput(buildStepAssistRequest({event:e,task:currentTask(e),role:'engineer',stepIndex:0,text:'想了解操作依据。',history:[]})).context
 assert.equal(build(restored).followUpState.used,3)
 assert.equal(build(fixture().event).followUpState.used,0)
})

test('adopting a partial observation stays optional, and a plain reply preserves the previous note proposal',async()=>{
 const {state,event,task}=fixture()
 const ask=(stepAssist)=>assistTaskStep(state,event.id,task.id,0,'继续',{},async()=>({stepAssist}),{})
 const prior=await ask({...question,note:'现场已停机，隔离情况待核对。'})
 assert.equal(task.draft.records[0].note,'')
 await ask({kind:'answer',text:'请参考本机作业卡。'})
 assert.equal(prior.supersededAt,undefined)
 applyTaskStepNote(state,event.id,task.id,prior.id)
 assert.equal(task.draft.records[0].note,prior.response.note)
 assert.equal(task.draft.records[0].result,'')
})

test('a capped consultation keeps the answer separate from task evidence',()=>{
 const ctx=context()
 ctx.followUpState=stepFollowUpState(3)
 ctx.history=[
  {scope:'other-step',role:'user',text:'已经更换部件。'},
  {scope:'current-step',role:'assistant',responseKind:'draft',text:'建议\n已更换三套零件。'},
  {scope:'current-step',role:'user',text:'这些零件应该怎么更换，是否已经坏了？'},
  {scope:'current-step',role:'user',text:'已发照片：检查位置.jpg'},
 ]
 ctx.message.text='现场已停机。怎么选配件？'
 const reply=enforceStepFollowUpPolicy({kind:'answer',text:'按本机作业卡核对型号。'},ctx)
 assert.equal(reply.text,'按本机作业卡核对型号。')
 assert.match(reply.note,/现场已停机/)
 assert.doesNotMatch(reply.note,/怎么|是否|更换|型号|已发照片|\.jpg/)
 const plain=enforceStepFollowUpPolicy({kind:'answer',text:'按本机作业卡。',note:'已更换部件。'},{...context(),message:{text:'怎么选配件？'}})
 assert.equal(plain.note,undefined)
})

test('a consultation after adoption preserves the saved wording and does not repeat photos or earlier facts',()=>{
 const ctx=context(),saved='船员已确认主机停机。'
 ctx.record={note:saved,result:'发现异常',photoNames:['机舱.jpg']}
 ctx.followUpState=stepFollowUpState(3)
 ctx.history=[
  {scope:'current-step',role:'user',text:'主机已经停机了。'},
  {scope:'current-step',role:'assistant',responseKind:'receipt',text:'本步骤备注已记录。'},
 ]
 ctx.message.text='如何查询备件型号？'
 const reply=enforceStepFollowUpPolicy({kind:'draft',text:'核对批准的备件清单。',note:'备注：已确认停机并且已附照片。'},ctx)
 assert.equal(reply.note,saved)
 ctx.message.text='刚刚实测压力为 3 bar。'
 const supplemented=enforceStepFollowUpPolicy({kind:'answer',text:'已收到。'},ctx)
 assert.match(supplemented.note,/3 bar/)
 assert.doesNotMatch(supplemented.note,/主机已经停机了|照片|发现异常/)
})

test('internal round messages stay private while equipment limits, test cycles and paragraphs remain visible',()=>{
 const field='排温超过上限。已完成三轮试车。\n复测上限为 380 °C，结果待确认。'
 assert.equal(crewFacingStepText(field),field)
 const ctx=context()
 ctx.followUpState=stepFollowUpState(3)
 const response=enforceStepFollowUpPolicy({kind:'answer',text:'本步骤已达 3 轮追问上限。'+field+'\n已停止继续追问。'},ctx)
 assert.equal(response.text,field)
 const mixed=enforceStepFollowUpPolicy({kind:'question',text:'请按本机备件清单核对型号。你能再补充一次吗？'},ctx)
 assert.equal(mixed.text,'请按本机备件清单核对型号。')
 assert.equal(mixed.kind,'draft')
 assert.doesNotMatch(mixed.text,/上限|停止追问|再补充/)
})
