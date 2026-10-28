import test from 'node:test'
import assert from 'node:assert/strict'
import {workflowAdvice,presentWorkflowConversation,briefText,reconcileWorkflowAdvice} from '../src/message-flows/assistantPresentation.js'

function fixture(){
 const id='alarm'
 return {id,store:{cases:{[id]:{owner:'李建国（大管轮）',stages:[{kind:'intro',label:'任务概览'},{kind:'check',label:'原因排查',summary:'核实喷射控制及燃油供给。',tasks:[{label:'检查喷射指令与反馈'},{label:'核实供油压力'}]},{kind:'work',label:'对应处置',summary:'按已确认的异常部位实施获批措施。'}]}},todoCreated:{},progress:{},assignments:{},eventStatus:{},checkAssessments:{},completedTasks:{},trackingDispositions:{},isTaskHandled:()=>false,stageFeedbackForm:()=>({status:'pending'})},brief:{conclusion:'二缸排气温度与其余气缸分离。优先检查喷射控制。',captainDecision:'请安排人员核对喷射控制及燃油供给，并确认完成时限。',facts:[{label:'二缸排温',value:80.4,unit:'°C',at:'23:32:54'}],boundary:'维修对象以现场检验为依据。'}}
}
test('recommendations follow the role and submitted workflow state',()=>{
 const {id,store,brief}=fixture()
 const read=audience=>workflowAdvice(store,id,{audience,brief})
 assert.equal(read('captain').actionLabel,'安排核实任务')
 assert.equal(read('captain').analysis,'二缸排气温度与其余气缸分离。')
 assert.match(read('captain').basis[0].text,/80.4 °C/)
 store.todoCreated[id]=true;store.assignments[id]={owner:'李建国（大管轮）',due:'2026-10-28T18:00'}
 assert.equal(read('captain').actionLabel,'')
 assert.match(read('captain').recommendation,/18:00/)
 store.progress[id]=1
 assert.equal(read('assignee').actionLabel,'填写排查结果')
 store.progress[id]=2
 assert.equal(read('assignee').actionLabel,'填写作业反馈')
 store.stageFeedbackForm=()=>({status:'submitted'})
 assert.equal(read('assignee').actionLabel,'填写验收结果')
 store.isTaskHandled=()=>true
 assert.equal(read('captain').actionLabel,'确认观察结果')
 assert.equal(read('assignee').actionLabel,'')
 store.eventStatus[id]='closed'
 assert.equal(read('captain').actionLabel,'')
 assert.equal(read('assignee').actionLabel,'')
})
test('tracking decisions ask for arrangements and completed tasks cannot be dispatched again',()=>{
 const {id,store}=fixture();store.cases[id].trackingOnly=true
 store.trackingDispositions[id]={status:'review'}
 assert.equal(workflowAdvice(store,id).actionLabel,'确认后续安排')
 store.trackingDispositions[id].status='recommendation'
 assert.equal(workflowAdvice(store,id).actionLabel,'确认维保安排')
 delete store.trackingDispositions[id]
 store.completedTasks[id]={reason:'本轮核实已回交。'}
 assert.equal(workflowAdvice(store,id).actionLabel,'')
})
test('projection removes duplicated basics, retains attributed submissions and actual questions without mutating history',()=>{
 const messages=[
  {id:'source',eventProcess:true,eventBaseline:true,role:'assistant',kind:'scene',markdown:'原始测量资料'},
  {id:'record',eventProcess:true,role:'assistant',kind:'scene',returnedRecord:true,actor:'李建国（大管轮）',markdown:'现场检查发现连接松动'},
  {id:'summary',issueSummary:true,role:'assistant',kind:'scene',markdown:'重复概况'},
  {id:'question',role:'user',text:'连接松动的证据是什么？'},
  {id:'answer',role:'assistant',kind:'scene',markdown:'### 现场依据\n\n连接固定记录与检查照片。\n\n### 下一步\n\n核对维修后的复测记录。'},
 ]
 const original=JSON.stringify(messages),advice={id:'current',currentAdvice:true}
 const result=presentWorkflowConversation(messages,advice)
 assert.deepEqual(result.map(row=>row.id),['record','current','question','answer'])
 assert.equal(result[0].presentation,'receipt')
 assert.equal(result[0].actor,'李建国（大管轮）')
 assert.match(result[3].analysis,/连接固定记录/)
 assert.equal(result[3].recommendation,'核对维修后的复测记录。')
 assert.equal(result[3].detailsMarkdown,messages[4].markdown)
 assert.equal(JSON.stringify(messages),original)
})
test('task stage instructions become current advice while submitted forms and free chat remain',()=>{
 const messages=[{id:'task-dispatch:alarm:1',role:'assistant',markdown:'任务范围'},
  {role:'user',text:'进入原因排查'},
  {stageId:'check',kind:'scene',markdown:'排查准备'},
  {id:'form',kind:'feedbackRecord',status:'submitted'},
  {id:'ask',role:'user',text:'这里为什么要先核对指令？'}]
 const result=presentWorkflowConversation(messages,{id:'advice'})
 assert.deepEqual(result.map(row=>row.id),['form','ask','advice'])
})
test('an unpunctuated long form checklist stays brief in chat',()=>{
 const checklist='核查喷射控制阀指令与流量活塞反馈；'.repeat(30)
 assert.ok(briefText(checklist).length<=151)
 assert.ok(briefText(checklist).endsWith('…'))
})

test('submitted forms stay between immutable stage recommendations across remounts',()=>{
 const {id,store,brief}=fixture(),conversation={messages:[]}
 store.todoCreated[id]=true;store.progress[id]=1
 const rows=[{id:'task-dispatch:alarm:1',role:'assistant',markdown:'任务范围'}, {role:'user',text:'进入原因排查'}, {stageId:'check',kind:'scene',markdown:'排查准备'}]
 let advice=workflowAdvice(store,id,{audience:'assignee',brief})
 assert.equal(reconcileWorkflowAdvice(conversation,rows,advice),true)
 const initialAnalysis=advice.analysis
 rows.push({role:'user',text:'提交原因排查反馈：已发现连接松动',actor:'李建国（大管轮）'}, {kind:'feedbackRecord',title:'原因排查反馈已提交',task:'检查喷射控制',records:[{label:'连接',result:'发现异常',note:'插接件松动'}],actor:'李建国（大管轮）',submittedAt:'2026-10-28 14:01'}, {role:'user',text:'查看本轮反馈后的对应处置安排'}, {stageId:'work',kind:'scene',markdown:'维修准备'})
 store.progress[id]=2;store.checkAssessments[id]={message:'已定位到插接件连接松动。',records:rows[4].records}
 advice=workflowAdvice(store,id,{audience:'assignee',brief})
 assert.equal(reconcileWorkflowAdvice(conversation,rows,advice,{animate:true}),true)
 let projected=presentWorkflowConversation(rows,advice,conversation.adviceHistory)
 assert.deepEqual(projected.map(row=>row.presentation),['advice','receipt','advice'])
 assert.equal(projected[0].analysis,initialAnalysis)
 assert.equal(projected[0].actionLabel,'')
 assert.equal(projected[1].role,'user')
 assert.match(projected[1].title,/李建国/)
 assert.equal(projected[2].actionLabel,'填写作业反馈')
 assert.equal(projected[2].animate,true)
 store.checkAssessments[id].records[0].note='后续修改的草稿'
 assert.equal(conversation.adviceHistory[1].basis[0].text,'发现异常；插接件松动')
 // Reconciliation on a remount or a draft change does not generate another reply.
 assert.equal(reconcileWorkflowAdvice(conversation,rows,workflowAdvice(store,id,{audience:'assignee',brief}),{animate:true}),false)
 assert.equal(conversation.adviceHistory.length,2)
 rows.push({role:'user',text:'本次连接修复需要复测什么？',id:'question'}, {role:'assistant',kind:'scene',id:'answer',markdown:'### 检查依据\n\n指令与反馈记录。\n\n### 下一步\n\n复测二缸喷射响应。'})
 projected=presentWorkflowConversation(rows,advice,conversation.adviceHistory)
 assert.equal(projected.at(-2).id,'question')
 assert.equal(projected.at(-1).recommendation,'复测二缸喷射响应。')
 assert.equal(projected.filter(row=>row.currentAdvice).length,1)
})

test('the captain keeps dispatch history, quietly records work and receives a completed handoff',()=>{
 const {id,store,brief}=fixture(),conversation={},rows=[]
 const read=()=>workflowAdvice(store,id,{audience:'captain',brief})
 reconcileWorkflowAdvice(conversation,rows,read())
 const original=JSON.stringify(conversation.adviceHistory[0])
 store.todoCreated[id]=true;store.assignments[id]={owner:'李建国（大管轮）'};store.progress[id]=1
 rows.push({id:'assignment',eventProcess:true,role:'user',actor:'陈志远（轮机长）',text:'已安排李建国核实喷射控制。'})
 assert.equal(read().quiet,true)
 assert.equal(reconcileWorkflowAdvice(conversation,rows,read()),false)
 rows.push({id:'check',eventProcess:true,returnedRecord:true,actor:'李建国（大管轮）',role:'assistant',title:'现场回交 · 原因排查反馈',markdown:'确认插接件松动。'})
 store.progress[id]=2;store.checkAssessments[id]={message:'确认插接件松动。'}
 reconcileWorkflowAdvice(conversation,rows,read())
 assert.equal(conversation.adviceHistory.length,1)
 const middle=presentWorkflowConversation(rows,read(),conversation.adviceHistory)
 assert.equal(middle[0].actionLabel,'')
 assert.equal(middle[1].role,'user')
 assert.equal(middle[2].role,'assistant')
 assert.match(middle[2].title,/AI检修助手已记录/)
 rows.push({id:'acceptance',eventProcess:true,returnedRecord:true,role:'assistant',actor:'李建国（大管轮）',title:'现场回交 · 实际执行与验收记录',markdown:'连接复固，复测通过。'})
 store.isTaskHandled=()=>true
 assert.equal(read().quiet,false)
 reconcileWorkflowAdvice(conversation,rows,read(),{animate:true})
 const final=presentWorkflowConversation(rows,read(),conversation.adviceHistory)
 assert.equal(final[0].analysis,'二缸排气温度与其余气缸分离。')
 assert.equal(final.at(-2).id,'acceptance')
 assert.equal(final.at(-1).actionLabel,'确认观察结果')
 assert.equal(final.filter(row=>row.currentAdvice).length,1)
 assert.equal(JSON.stringify(conversation.adviceHistory[0]),original)
 assert.equal(reconcileWorkflowAdvice(conversation,rows,read()),false)
})

test('first return restores initial event advice before dispatch and a new round adds distinct advice',()=>{
 const {id,store,brief}=fixture(),conversation={}
 store.todoCreated[id]=true;store.progress[id]=2;store.isTaskHandled=()=>true
 const rows=[{id:'assignment',eventProcess:true,role:'user',actor:'陈志远（轮机长）',text:'派发现场核实'}, {id:'complete',eventProcess:true,role:'assistant',returnedRecord:true,title:'现场回交 · 验收',markdown:'现场验收通过'}]
 let advice=workflowAdvice(store,id,{audience:'captain',brief})
 reconcileWorkflowAdvice(conversation,rows,advice)
 const projected=presentWorkflowConversation(rows,advice,conversation.adviceHistory)
 assert.deepEqual(projected.map(row=>row.presentation),['advice','receipt','receipt','advice'])
 assert.match(projected[0].recommendation,/请安排人员/)
 assert.equal(projected[0].currentAdvice,false)
 const taskConversation={}
 store.isTaskHandled=()=>false;store.progress[id]=1
 advice=workflowAdvice(store,id,{audience:'assignee',brief})
 reconcileWorkflowAdvice(taskConversation,[],advice)
 store.workflowRounds={[id]:2};store.cases[id].stages[1].id='check-r2'
 const next=workflowAdvice(store,id,{audience:'assignee',brief})
 reconcileWorkflowAdvice(taskConversation,[{id:'return',role:'assistant',text:'已返回第二轮检查'}],next)
 assert.notEqual(advice.lifecycleKey,next.lifecycleKey)
 assert.equal(taskConversation.adviceHistory.length,2)
 assert.equal(taskConversation.adviceHistory[1].afterMessageId,'return')
})

test('saved submissions change the advice lifecycle while clock, observation and draft updates do not',()=>{
 const {id,store,brief}=fixture();store.todoCreated[id]=true;store.progress[id]=2
 let saved=false,at='2026-10-28 14:20'
 store.stageFeedbackForm=()=>({status:saved?'submitted':'pending',submittedAt:saved?at:undefined,values:{note:'草稿'}})
 const read=()=>workflowAdvice(store,id,{audience:'assignee',brief})
 const initial=read().lifecycleKey;saved=true
 const accepted=read().lifecycleKey
 assert.notEqual(initial,accepted)
 const conversation={};reconcileWorkflowAdvice(conversation,[],read())
 store.automaticObservations={[id]:{checkedAt:Date.now()}};store.eventUpdatedAt={[id]:'14:21'}
 assert.equal(read().lifecycleKey,accepted)
 assert.equal(reconcileWorkflowAdvice(conversation,[],read()),false)
 at='2026-10-28 14:25'
 assert.notEqual(read().lifecycleKey,accepted)
 assert.equal(reconcileWorkflowAdvice(conversation,[],read()),true)
})
