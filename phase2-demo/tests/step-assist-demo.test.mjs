import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {matchStepAssistDemo,isStepAssistScriptInput,STEP_ASSIST_DEMO_CASES} from '../src/workflow/stepAssistDemo.js'

const docs={
 investigation:readFileSync(new URL('../docs/二缸步骤协作演示/排查演示脚本.md',import.meta.url),'utf8'),
 repair:readFileSync(new URL('../docs/二缸步骤协作演示/维修演示脚本.md',import.meta.url),'utf8'),
}
const cases=STEP_ASSIST_DEMO_CASES,byId=id=>cases.find(item=>item.id===id)
const user=(text,stepIndex)=>({role:'user',text,stepIndex,scope:'current-step'})
function contextFor(item,{history=true}={}){
 return {event:{id:'real-alarm-0430'},task:{id:'c2-task',kind:item.kind,steps:Array.from({length:item.stepIndex+1},(_,i)=>({label:i===item.stepIndex?item.stepLabel:'另一主步骤'}))},stepIndex:item.stepIndex,step:{label:item.stepLabel},record:{result:'',note:''},message:{text:item.input},history:history?item.requires.map(id=>user(byId(id).input,item.stepIndex)):[]}
}
const replyFor=item=>matchStepAssistDemo({context:contextFor(item)})
const recognition=context=>isStepAssistScriptInput({event:context.event,task:context.task,stepIndex:context.stepIndex,text:context.message.text})
const expectedKinds=['question','draft','draft','draft','draft','question','draft','question','draft','draft','draft','draft','draft','draft']

test('all 14 conversational inputs and concise responses stay synchronized with the checked-in scripts',()=>{
 assert.equal(cases.length,14)
 for(const [i,item] of cases.entries()){
  const response=replyFor(item)
  assert.ok(docs[item.kind].includes(item.input),'document contains full canonical input: '+item.id)
  assert.equal(response.kind,expectedKinds[i],item.id)
  assert.ok(response.text.length<80);assert.equal(response.text.includes('\n'),false)
  assert.deepEqual(Object.keys(response).sort(),response.kind==='question'?['kind','text']:['kind','note','text'])
  assert.doesNotMatch(item.input,/说清楚|说清这次|请只整理|不要补填|不补造|演示|练习|虚构|DEMO-|AI 生成|人员甲|人员乙/,item.id)
  if(response.kind==='draft'){
   assert.doesNotMatch(response.note,/演示|练习|虚构|AI 生成|图片来源|历史图|DEMO-|人员甲|人员乙/)
   assert.ok(response.note.length>=120&&response.note.length<=250,item.id)
   assert.doesNotMatch(response.note,/\n|##|第[一二三四1-4]步|待补清单|已收到/)
  }
 }
})

test('recognition scopes whole sentences to C2 kind, step and label without examining history or selected results',()=>{
 for(const item of cases){
  const context=contextFor(item),input={event:context.event,task:context.task,stepIndex:item.stepIndex,text:item.input}
  assert.equal(recognition(context),true,item.id)
  assert.equal(isStepAssistScriptInput({...input,task:{...context.task,status:'submitted',owner:'other-person',draft:{stepIndex:99,records:[{result:'different'}]}}}),true,'UI/store retain permission and active-step validation')
  assert.equal(isStepAssistScriptInput({...input,event:{id:'other-event'}}),false)
  assert.equal(isStepAssistScriptInput({...input,event:{id:'replayed-event',sourceEventId:'real-alarm-0430'}}),true)
  assert.equal(isStepAssistScriptInput({...input,task:{...context.task,kind:'maintenance'}}),false)
  assert.equal(isStepAssistScriptInput({...input,stepIndex:9}),false)
  assert.equal(isStepAssistScriptInput({...input,stepIndex:String(item.stepIndex)}),false)
  assert.equal(isStepAssistScriptInput({...input,task:{...context.task,steps:[]}}),false)
  assert.equal(isStepAssistScriptInput({...input,task:{...context.task,steps:context.task.steps.map(step=>({...step,label:'别的任务'}))}}),false)
 }
 assert.equal(isStepAssistScriptInput(),false);assert.equal(matchStepAssistDemo(),null)
})

test('missing same-step facts cause a fixed question with no draft rather than a model fallback',()=>{
 for(const item of cases.filter(item=>item.requires.length)){
  const context=contextFor(item)
  for(const history of [
   [],
   context.history.map(message=>({...message,role:'assistant'})),
   context.history.map(message=>({...message,stepIndex:item.stepIndex+1,scope:'other-step'})),
   context.history.map(message=>({...message,eventId:'other-event'})),
   context.history.map(message=>({...message,taskId:'other-task'})),
  ]){
   const result=matchStepAssistDemo({context:{...context,history}})
   assert.equal(result.kind,'question',item.id);assert.equal(result.note,undefined)
   assert.ok(result.text.length<80);assert.equal(recognition({...context,history}),true)
  }
 }
 const result=matchStepAssistDemo({context:contextFor(byId('preparationAnswer'),{history:false})})
 assert.match(result.text,/范围.*备件.*隔离/)
 assert.doesNotMatch(result.text,/16:00|已完成|李建国/)
})

test('each main step can start independently without previous completion or optional exchanges',()=>{
 for(const id of ['investigationStart','supply','preparationStart','repairStart','trial','handover']){
  const item=byId(id),context=contextFor(item,{history:false})
  assert.deepEqual(matchStepAssistDemo({context}),item.response,id)
  const unrelated=cases.filter(other=>other.kind===item.kind&&other.stepIndex!==item.stepIndex).map(other=>({...user(other.input,other.stepIndex),scope:'other-step'}))
  assert.deepEqual(matchStepAssistDemo({context:{...context,history:unrelated}}),item.response,id)
 }
})

test('supplying missing prerequisites after an answer completes the draft without asking for already-known details',()=>{
 for(const [startId,answerId] of [['investigationStart','investigationAnswer'],['preparationStart','preparationAnswer'],['repairStart','repairAnswer']]){
  const start=byId(startId),answer=byId(answerId)
  assert.equal(matchStepAssistDemo({context:contextFor(answer,{history:false})}).kind,'question')
  const context=contextFor(start,{history:false})
  context.history=[user(answer.input,start.stepIndex),{role:'assistant',stepIndex:start.stepIndex,text:'请补充本步的实际检查范围。'},user('明白了',start.stepIndex)]
  assert.deepEqual(matchStepAssistDemo({context}),answer.response,startId)
  const result=start.kind==='investigation'?'未见异常':'未完成'
  assert.equal(matchStepAssistDemo({context:{...context,record:{result,note:''}}}).kind,'question','a completed fact set cannot override conflicting human result')
  assert.equal(matchStepAssistDemo({context:{...context,history:[...context.history,user('更正，实际执行情况还有变化。',start.stepIndex)]}}).kind,'question')
 }
})

test('known optional exchanges, repeated inputs and short acknowledgments do not invalidate available facts',()=>{
 for(const item of cases.filter(item=>item.requires.length)){
  const context=contextFor(item),history=context.history.flatMap(message=>[message,user('好的，谢谢。',item.stepIndex),{...message}])
  const optional=cases.filter(other=>other.kind===item.kind&&other.stepIndex===item.stepIndex&&other.id!==item.id&&other.requires.length)
  history.push(...optional.map(other=>user(other.input,item.stepIndex)),user('收到',item.stepIndex),user(item.input,item.stepIndex))
  const response=matchStepAssistDemo({context:{...context,history}})
  assert.equal(response.kind,'draft',item.id)
  assert.ok(response.note.length>100,item.id)
  // A user can provide related details in a different order; facts are not a wizard.
  assert.deepEqual(matchStepAssistDemo({context:{...context,history:[...context.history].reverse()}}),item.response,item.id)
 }
 const trial=byId('trial'),clarification=byId('trialClarify'),context=contextFor(trial)
 context.history=[user(trial.input,trial.stepIndex),user(clarification.input,trial.stepIndex)]
 assert.deepEqual(matchStepAssistDemo({context}),clarification.response,'repeating the earlier complete input retains the later unperformed-trial clarification')
})

test('later non-script corrections stay protected and trigger a short check instead of an old draft',()=>{
 for(const item of cases){
  const context=contextFor(item)
  for(const correction of ['更正：实际尚未检查。','旧件后来已经送出了。','谢谢，另外发现接口损伤。']){
   const history=[...context.history,user(correction,item.stepIndex),user(item.input,item.stepIndex)]
   const reply=matchStepAssistDemo({context:{...context,history}})
   assert.equal(reply.kind,'question',item.id);assert.equal(reply.note,undefined)
   assert.match(reply.text,/新的补充/);assert.equal(recognition(context),true)
  }
 }
})

test('changed complete inputs and extra facts still use the real fallback',()=>{
 for(const item of cases){
  const context=contextFor(item)
  for(const text of ['其他现场情况：'+item.input,item.input+'另外发现接口损伤。']){
   assert.equal(matchStepAssistDemo({context:{...context,message:{text}}}),null,item.id)
   assert.equal(recognition({...context,message:{text}}),false,item.id)
  }
 }
 const item=byId('investigationAnswer'),context=contextFor(item)
 for(const text of [item.input.replace('三次','两次'),item.input.replace('15:10','15:11'),'二缸 ICU 回位不畅，帮我整理一下']){
  assert.equal(matchStepAssistDemo({context:{...context,message:{text}}}),null)
  assert.equal(recognition({...context,message:{text}}),false)
 }
})

test('published aliases preserve facts and support mixed old and new history without rewriting identities',()=>{
 for(const item of cases){
  const context=contextFor(item)
  assert.equal(item.aliases.length,1)
  for(const text of item.aliases){
   const mixed={...context,message:{text},history:item.requires.map(id=>user(byId(id).aliases[0],item.stepIndex))}
   assert.equal(recognition(mixed),true,item.id)
   assert.deepEqual(matchStepAssistDemo({context:mixed}),item.response,item.id)
  }
  for(const original of [item.input,...item.aliases]){
   const changed=original.replaceAll('WO-C2','DEMO-WO-C2').replaceAll('OLD-C2','DEMO-OLD-C2').replaceAll('SPARE-C2','DEMO-SPARE-C2').replaceAll('李建国','人员甲').replaceAll('陈志远','人员乙')
   if(changed===original)continue
   assert.equal(matchStepAssistDemo({context:{...context,message:{text:changed}}}),null,'different identifiers or people: '+item.id)
  }
 }
})

test('punctuation and narrowly known presentation wrappers match without discarding added facts',()=>{
 const suffix='这张是 AI 生成的演示图，只练习上传，不是现场照片，不能拿它认定卡滞或损伤。'
 const format=text=>'  '+text.replaceAll('，',',').replaceAll('；',';').replaceAll('：',':').replaceAll('。','.').replaceAll('—','–').replaceAll('“','"').replaceAll('”','"').replaceAll(' ','\n  ')+'  '
 for(const item of cases){
  const context=contextFor(item)
  for(const text of [format(item.input),'【虚构演示】'+item.input,'【虚构演示】'+item.aliases[0]+suffix]){
   const adapted={...context,message:{text},history:context.history.map(message=>({...message,text:format(message.text)}))}
   assert.equal(recognition(adapted),true,item.id)
   assert.deepEqual(matchStepAssistDemo({context:adapted}),item.response,item.id)
   assert.equal(matchStepAssistDemo({context:{...adapted,message:{text:text+'另发现接口损伤。'}}}),null)
  }
 }
})

test('conflicting selected results cause fixed questions and neither recognition nor matching mutates a record',()=>{
 for(const item of cases.filter(item=>item.response.kind==='draft')){
  const context=contextFor(item),before=structuredClone(context)
  const response=matchStepAssistDemo({context});assert.deepEqual(context,before)
  response.note='changed copy';assert.notEqual(matchStepAssistDemo({context}).note,response.note)
  const result=item.kind==='repair'?(item.stepIndex===2?'已完成':'未完成'):(item.stepIndex===0?'未见异常':'发现异常')
  const conflict={...context,record:{result,note:'人工填写记录'}}
  assert.equal(recognition(conflict),true)
  const reply=matchStepAssistDemo({context:conflict})
  assert.equal(reply.kind,'question');assert.equal(reply.note,undefined);assert.match(reply.text,/当前选择.*不一致/)
  assert.deepEqual(conflict.record,{result,note:'人工填写记录'})
 }
})

test('scripted drafts retain actual coverage and uncertainty without claiming an uploaded reference proves work',()=>{
 const note=id=>replyFor(byId(id)).note
 assert.match(note('investigationRevise'),/原因未确认/);assert.match(note('investigationRevise'),/不能归因为积碳或磨损/)
 assert.match(note('supply'),/未拆检全部/);assert.match(note('supply'),/未覆盖高负荷/);assert.match(note('supply'),/不能据此确认 ICU 根因/)
 assert.match(note('preparationAnswer'),/尚未拆换/);assert.match(note('preparationAnswer'),/签认附件未上传/);assert.match(note('preparationAnswer'),/李建国执行、陈志远监护复核/)
 assert.match(note('repairRevise'),/OLD-C2-01/);assert.match(note('repairRevise'),/尚未送检/);assert.match(note('repairRevise'),/各1套/);assert.match(note('repairRevise'),/作业照片待补/)
 assert.match(note('trialClarify'),/后续试验未实施/);assert.match(note('trialClarify'),/本步仍未完成/)
 assert.match(note('handover'),/时限待轮机长确认/);assert.match(note('handover'),/效果观察尚未开始/);assert.match(note('handover'),/长期修复效果未经证明/)
 for(const item of cases){
  const context=contextFor(item)
  assert.deepEqual(matchStepAssistDemo({context,images:[{name:'reference.png'}]}),matchStepAssistDemo({context,images:[]}))
 }
})

test('the immutable catalog exposes canonical, aliases and fact prerequisites for integration tooling',()=>{
 assert.ok(Object.isFrozen(cases))
 for(const item of cases){
  assert.ok(Object.isFrozen(item));assert.ok(Object.isFrozen(item.aliases));assert.ok(Object.isFrozen(item.response));assert.ok(Object.isFrozen(item.requires))
  assert.ok(item.requires.every(id=>byId(id)?.kind===item.kind&&byId(id)?.stepIndex===item.stepIndex))
  assert.equal(item.aliases.some(alias=>alias===item.input),false,'the old sentence is a distinct supported wording')
 }
})
