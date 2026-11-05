import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'
import {assistTaskStep,applyTaskStepNote} from '../src/workflow/taskStepAssistance.js'
import {prepareStepAssistInput} from '../src/workflow/stepAssistContract.js'

const id='real-alarm-0430'
const response=stepAssist=>({stepAssist,model:'test-model',usage:{inputTokens:12,outputTokens:15},sources:[]})
const question=response({kind:'question',text:'液压动作是否已实际检查？'})
const draft=note=>response({kind:'draft',text:'已整理为待核对的备注草稿。',note})
function fixture(kind='investigation'){
 const state=createLifecycleState(),event=state.events[id],form={owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()}
 decide(state,id,{action:'investigate',...form})
 if(kind==='repair'){
  state.role='engineer';const check=currentTask(event)
  check.draft.records.forEach((record,i)=>{record.result=check.steps[i].options[0];record.note='测试记录：插接件已核查，液压动作尚待确认。'})
  submitTask(state,id,check.id);state.role='captain';decide(state,id,{action:'repair',...form})
 }
 state.role='engineer'
 const task=currentTask(event);task.draft.stepIndex=0
 return {state,event,task,pending:{}}
}
const ask=(f,request=async()=>question,text='本步骤现场检查尚未完成。',stepIndex=f.task.draft.stepIndex||0)=>assistTaskStep(f.state,f.event.id,f.task.id,stepIndex,text,{},request,f.pending)
const apply=(f,message)=>applyTaskStepNote(f.state,f.event.id,f.task.id,message.id,f.pending)
const records=f=>JSON.stringify({records:f.task.draft.records,submittedRecords:f.task.records,status:f.task.status,summary:f.task.summary,phase:f.event.phase,currentTask:f.event.currentTask,reports:f.event.reports,decisions:f.event.decisions})

test('only the current owned C2 investigation or repair task can start step collaboration',async()=>{
 for(const kind of ['investigation','repair']){
  const f=fixture(kind),message=await ask(f)
  assert.equal(message.response.kind,'question');assert.equal(message.status,'complete')
 }
 const mapped=fixture();delete mapped.state.events[id];mapped.event.sourceEventId=id;mapped.event.id='c2-observation-mapped';mapped.state.events[mapped.event.id]=mapped.event
 assert.equal((await ask(mapped)).status,'complete')
 for(const change of [f=>f.state.role='captain',f=>f.state.role='secondEngineer',f=>f.event.sourceEventId='real-warning-0523',f=>f.task.kind='maintenance',f=>f.task.status='submitted',f=>f.task.status='waiting',f=>f.event.currentTask='another-task',f=>f.event.phase='closed']){
  const f=fixture();change(f);const before=records(f);let called=false
  await assert.rejects(ask(f,async()=>{called=true;return question}),/当前任务或身份/)
  assert.equal(called,false);assert.equal(records(f),before)
 }
 const wrongStep=fixture();await assert.rejects(ask(wrongStep,async()=>question,'测试',1),/对应步骤/)
 await assert.rejects(ask(wrongStep,async()=>question,'测试',-1),/当前协助步骤/)
})

test('the selected record and whole current task conversation are sent with step scope; questions change no records',async()=>{
 const f=fixture(),record=f.task.draft.records[0]
 record.note='本步骤人工原文';f.task.draft.records[1].note='第二步私人记录不得发送'
 f.task.conversations={engineer:[
  {id:'same-user',kind:'user',stepAssistance:true,stepIndex:0,text:'已看过插接件外观'},
  {id:'same-question',kind:'step-assist',stepIndex:0,status:'complete',response:{kind:'question',text:'是否已核对接线？'}},
  {id:'other-step',kind:'user',stepAssistance:true,stepIndex:1,text:'其他步骤对话可作上下文'},
  {id:'ordinary-chat',kind:'user',text:'普通任务会话也作上下文'},
  {id:'failed',kind:'step-assist',stepIndex:0,status:'interrupted',response:{kind:'draft',text:'失败回答',note:'不应发送'}},
  {id:'streaming',kind:'step-assist',stepIndex:0,status:'streaming',response:null}
 ]}
 const before=records(f);let payload
 const message=await ask(f,async(body,progress)=>{payload=body;progress('progress',{label:'正在核对本步资料'});return question})
 const prepared=prepareStepAssistInput(payload)
 assert.equal(prepared.context.record.note,'本步骤人工原文');assert.equal(prepared.context.stepIndex,0)
 assert.equal(prepared.context.history.length,4)
 assert.deepEqual(payload.history.map(m=>[m.eventId,m.taskId,m.stepIndex]),[[id,f.task.id,0],[id,f.task.id,0],[id,f.task.id,1],[id,f.task.id,null]])
 assert.deepEqual(prepared.context.history.map(m=>m.scope),['current-step','current-step','other-step','task'])
 assert.doesNotMatch(JSON.stringify(payload),/第二步私人记录|不应发送/)
 assert.equal(records(f),before);assert.equal(message.response.kind,'question')
 assert.throws(()=>apply(f,message),/可采用/)
 assert.deepEqual(f.pending,{})
})

test('adopting a draft changes only its note, without choosing a result, advancing or submitting',async()=>{
 for(const kind of ['investigation','repair']){
  const f=fixture(kind);f.task.draft.records[0].note='原始待整理记录'
  const before=records(f),originalRecords=structuredClone(f.task.draft.records),originalSummary=f.task.draft.summary
  const message=await ask(f,async()=>draft('按现场原文整理；未检查部分仍待确认。'))
  assert.equal(records(f),before,'receiving a draft is read-only for execution facts')
  const result=apply(f,message)
  originalRecords[0].note=message.response.note
  assert.deepEqual(f.task.draft.records,originalRecords)
  assert.equal(f.task.draft.records[0].result,'');assert.equal(f.task.draft.stepIndex,0)
  assert.equal(f.task.status,'assigned');assert.equal(f.task.draft.summary,originalSummary)
  assert.equal(f.event.currentTask,f.task.id);assert.equal(result.stepIndex,0);assert.equal(result.nextStep.index,1)
  assert.equal(f.task.conversations.engineer.filter(m=>m.response?.kind==='receipt').length,1)
  assert.ok(message.appliedAt);assert.equal(message.appliedAt,f.task.draft.updatedAt)
  assert.throws(()=>apply(f,message),/已经采用/)
  assert.equal(f.task.conversations.engineer.filter(m=>m.response?.kind==='receipt').length,1)
 }
 const last=fixture();last.task.draft.stepIndex=last.task.steps.length-1
 const message=await ask(last,async()=>draft('本步骤已记录，原因仍待核实。'))
 const priorReports=JSON.stringify(last.event.reports),result=apply(last,message)
 assert.equal(result.nextStep,null);assert.equal(last.task.status,'assigned');assert.equal(JSON.stringify(last.event.reports),priorReports)
 assert.match(last.task.conversations.engineer.at(-1).response.text,/确认后点击左侧/)
})

test('old-step cards, manual note or result edits, and changed step requirements cannot overwrite current work',async()=>{
 const across=fixture(),message=await ask(across,async()=>draft('第一步草稿'))
 across.task.draft.stepIndex=1
 assert.throws(()=>apply(across,message),/回到左侧第 1 步/);assert.equal(across.task.draft.records[1].note,'')
 across.task.draft.stepIndex=0;apply(across,message)
 for(const change of [f=>f.task.draft.records[0].note='人工修改后的新备注',f=>f.task.draft.records[0].result=f.task.steps[0].options[0],f=>f.task.draft.records[0].executionStatus='未完成',f=>f.task.steps[0].guide+=' 新增作业范围']){
  const f=fixture(),old=await ask(f,async()=>draft('旧上下文生成的草稿'));change(f)
  const before=records(f);assert.throws(()=>apply(f,old),/已被修改/);assert.equal(records(f),before);assert.equal(old.appliedAt,undefined)
 }
})

test('the newest completed response supersedes unadopted drafts, while a failed retry preserves a usable draft',async()=>{
 const f=fixture(),first=await ask(f,async()=>draft('第一版草稿')),second=await ask(f,async()=>draft('第二版草稿'),'补充新的现场事实。')
 assert.ok(first.supersededAt);assert.throws(()=>apply(f,first),/更新的协助/)
 await assert.rejects(ask(f,async()=>{throw Error('连接中断')}),/连接中断/)
 assert.equal(second.supersededAt,undefined)
 apply(f,second);assert.equal(f.task.draft.records[0].note,'第二版草稿')
 const more=await ask(f,async()=>draft('第三版草稿'),'补充并重新整理。')
 assert.equal(second.supersededAt,undefined,'adopted facts remain associated with the adopted card')
 apply(f,more);assert.equal(f.task.draft.records[0].note,'第三版草稿')
 const separate=fixture(),firstStep=await ask(separate,async()=>draft('第一步保留草稿'))
 separate.task.draft.stepIndex=1;const secondStep=await ask(separate,async()=>draft('第二步独立草稿'))
 assert.equal(firstStep.supersededAt,undefined,'a different step cannot supersede this draft')
 separate.task.draft.stepIndex=0;await ask(separate,async()=>draft('第一步更新草稿'))
 assert.ok(firstStep.supersededAt);assert.equal(secondStep.supersededAt,undefined)
})

test('provider and schema failures preserve facts and clear pending; invalid uploads add no conversation',async()=>{
 for(const request of [async()=>{throw Error('测试网络错误')},async()=>({stepAssist:{kind:'draft',text:'错误操作',note:'草稿',result:'未见异常'}})]){
  const f=fixture();f.task.draft.records[0].note='人工原始记录';const before=records(f)
  await assert.rejects(ask(f,request))
  assert.equal(records(f),before);assert.deepEqual(f.pending,{})
  const message=f.task.conversations.engineer.at(-1)
  assert.equal(message.status,'interrupted');assert.equal(message.response,null);assert.ok(message.modelError)
  assert.throws(()=>apply(f,message),/可采用/)
 }
 const f=fixture(),before=records(f),length=f.task.conversations?.engineer?.length||0
 await assert.rejects(assistTaskStep(f.state,id,f.task.id,0,'现场照片',{images:[{name:'不支持.svg',mimeType:'image/svg+xml',dataUrl:'data:image/svg+xml;base64,AA=='}]},()=>assert.fail(),f.pending),/PNG/)
 assert.equal(records(f),before);assert.equal(f.task.conversations.engineer.length,length)
})

test('pending work cannot be duplicated or applied and late replies cannot revive a changed task',async()=>{
 const f=fixture(),old=await ask(f,async()=>draft('已有草稿'));let finish
 const request=ask(f,()=>new Promise(resolve=>finish=resolve),'新增现场信息。')
 assert.equal(f.pending[`${id}:engineer:${f.task.id}`],true)
 await assert.rejects(ask(f),/上一条消息/);assert.throws(()=>apply(f,old),/等待本次协助/)
 f.task.status='submitted';const before=records(f);finish(draft('迟到草稿'))
 await assert.rejects(request,/范围或状态已变化/)
 assert.equal(records(f),before);assert.deepEqual(f.pending,{})
 assert.equal(f.task.conversations.engineer.at(-1).status,'interrupted')
 assert.equal(f.task.conversations.engineer.at(-1).response,null)
 const switching=fixture();let complete
 const inFlight=ask(switching,()=>new Promise(resolve=>complete=resolve));switching.task.draft.stepIndex=1;complete(draft('原步骤草稿'))
 const originalStepReply=await inFlight
 assert.equal(switching.task.draft.stepIndex,1);assert.equal(originalStepReply.stepIndex,0)
 assert.throws(()=>apply(switching,originalStepReply),/回到左侧第 1 步/)
})

test('storage budget rejection keeps existing conversation and execution records intact',async()=>{
 const f=fixture();f.task.conversations={engineer:[{id:'existing',kind:'user',text:'保留已有对话'}]}
 f.state.events['real-warning-0523'].conversations.engineer.push({id:'large-existing',kind:'user',text:'x'.repeat(4*1024*1024)})
 const before=records(f),conversation=JSON.stringify(f.task.conversations)
 await assert.rejects(ask(f,()=>assert.fail('the model must not be called')),/图片较大/)
 assert.equal(records(f),before);assert.equal(JSON.stringify(f.task.conversations),conversation);assert.deepEqual(f.pending,{})
})
