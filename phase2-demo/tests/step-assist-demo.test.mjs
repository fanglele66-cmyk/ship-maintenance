import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {matchStepAssistDemo,STEP_ASSIST_DEMO_CASES} from '../src/workflow/stepAssistDemo.js'

const investigation=readFileSync(new URL('../docs/二缸步骤协作演示/排查演示脚本.md',import.meta.url),'utf8')
const repair=readFileSync(new URL('../docs/二缸步骤协作演示/维修演示脚本.md',import.meta.url),'utf8')
const quotes=text=>text.split(/\r?\n/).filter(line=>line.startsWith('> ')).map(line=>line.slice(2).trim())
const iq=quotes(investigation),rq=quotes(repair)
const line=(items,prefix)=>{const text=items.find(text=>text.startsWith(prefix));assert.ok(text,'script line missing: '+prefix);return text}
const investigationStart=line(iq,'二缸这边'),investigationAnswer=line(iq,'做过动作检查'),investigationRevise=line(iq,'再强调一下：'),supply=line(iq,'15:25')
const preparationStart=line(rq,'工单 WO'),preparationAnswer=line(rq,'执行人为'),repairStart=line(rq,'16:20'),repairAnswer=line(rq,'这次按获批工单'),repairRevise=line(rq,'把“更换后正常”'),trial=line(rq,'17:10'),trialClarify=line(rq,'后续试验'),handover=line(rq,'18:00')
const labels={investigation:[...investigation.matchAll(/^## 第 \d 步：(.+)$/gm)].map(match=>match[1].trim()),repair:[...repair.matchAll(/^## 第 \d 步：(.+)$/gm)].map(match=>match[1].trim())}
// Select only words that the scripts explicitly ask the user to send, excluding
// the illustrated assistant question and the example expected note.
const cases=[
 {id:'investigation-start',kind:'investigation',step:0,text:investigationStart,reply:'question'},
 {id:'investigation-answer',kind:'investigation',step:0,text:investigationAnswer,reply:'draft',requires:[investigationStart]},
 {id:'investigation-revise',kind:'investigation',step:0,text:investigationRevise,reply:'draft',requires:[investigationStart,investigationAnswer]},
 {id:'supply',kind:'investigation',step:1,text:supply,reply:'draft'},
 {id:'supply-clarify',kind:'investigation',step:1,text:investigation.match(/“(材料未提供，不补造数值，备注保留资料缺口)”/)[1],reply:'draft',requires:[supply]},
 {id:'preparation-start',kind:'repair',step:0,text:preparationStart,reply:'question'},
 {id:'preparation-answer',kind:'repair',step:0,text:preparationAnswer,reply:'draft',requires:[preparationStart]},
 {id:'repair-start',kind:'repair',step:1,text:repairStart,reply:'question'},
 {id:'repair-answer',kind:'repair',step:1,text:repairAnswer,reply:'draft',requires:[repairStart]},
 {id:'repair-revise',kind:'repair',step:1,text:repairRevise,reply:'draft',requires:[repairStart,repairAnswer]},
 {id:'trial',kind:'repair',step:2,text:trial,reply:'draft'},
 {id:'trial-clarify',kind:'repair',step:2,text:trialClarify,reply:'draft',requires:[trial]},
 {id:'handover',kind:'repair',step:3,text:handover,reply:'draft'},
 {id:'handover-clarify',kind:'repair',step:3,text:repair.match(/“(尚未确认，写待轮机长安排，不编截止时间)”/)[1],reply:'draft',requires:[handover]},
]
const user=(text,step)=>({role:'user',text,stepIndex:step,scope:'current-step'})
function contextFor(item){return {event:{id:'real-alarm-0430'},task:{id:'demo-task',kind:item.kind},stepIndex:item.step,step:{label:labels[item.kind][item.step]},record:{result:'',note:''},message:{text:item.text},history:(item.requires||[]).map(text=>user(text,item.step))}}
const replyFor=item=>matchStepAssistDemo({context:contextFor(item),images:[]})

test('every sendable line in the checked-in work scripts has a short exact response',()=>{
 assert.equal(cases.length,14)
 for(const item of cases){
  assert.ok(item.text,item.id);const response=replyFor(item)
  assert.equal(response?.kind,item.reply,item.id);assert.ok(response.text.length<80,item.id);assert.equal(response.text.includes('\n'),false)
  assert.deepEqual(Object.keys(response).sort(),item.reply==='question'?['kind','text']:['kind','note','text'])
  if(item.reply==='draft'){
   assert.doesNotMatch(response.note,/演示|练习|虚构|AI 生成|图片来源|历史图|DEMO-|人员甲|人员乙/,item.id)
   assert.ok(response.note.length>=120&&response.note.length<=250,`${item.id}: ${response.note.length} chars`)
   assert.doesNotMatch(response.note,/\n|##|第[一二三四1-4]步|待补清单|已收到/,item.id)
  }
 }
})

test('follow-up answers and revisions require the ordered preceding user lines in this step',()=>{
 for(const item of cases.filter(item=>item.requires)){
  const context=contextFor(item)
  assert.equal(matchStepAssistDemo({context:{...context,history:[]}}),null,item.id+' needs previous user input')
  assert.equal(matchStepAssistDemo({context:{...context,history:context.history.map(message=>({...message,role:'assistant'}))}}),null,item.id+' assistant cannot supply facts')
  assert.equal(matchStepAssistDemo({context:{...context,history:context.history.map(message=>({...message,stepIndex:item.step+1,scope:'other-step'}))}}),null,item.id+' cannot use another step')
  assert.equal(matchStepAssistDemo({context:{...context,history:[...context.history,user('更正：实际尚未检查，请保留这个新事实。',item.step)]}}),null,item.id+' must not overwrite a later correction')
  assert.equal(matchStepAssistDemo({context:{...context,history:context.history.map(message=>({...message,eventId:'unrelated-event'}))}}),null,item.id+' cannot use another event')
  if(item.requires.length>1)assert.equal(matchStepAssistDemo({context:{...context,history:[...context.history].reverse()}}),null,item.id+' needs the correct order')
  assert.equal(matchStepAssistDemo({context:{...context,history:[user('另一主步骤的事实',item.step+1),...context.history,{role:'assistant',stepIndex:item.step,text:'请核对草稿。'}]}})?.kind,item.reply)
 }
})

test('only the named C2 event, task kind and step can match',()=>{
 for(const item of cases){
  const context=contextFor(item)
  assert.equal(matchStepAssistDemo({context:{...context,event:{id:'real-warning-0523'}}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,task:{...context.task,kind:'maintenance'}}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,stepIndex:9}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,stepIndex:String(item.step)}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,step:{label:'核查另一部件'}}}),null)
  assert.equal(matchStepAssistDemo({context:{...context,event:{id:'replayed-demo',sourceEventId:'real-alarm-0430'}}})?.kind,item.reply)
 }
 assert.equal(matchStepAssistDemo(),null);assert.equal(matchStepAssistDemo({context:{}}),null)
})

test('consecutive retries stay scripted while an intervening new fact still falls back',()=>{
 for(const item of cases.filter(item=>item.requires)){
  const context=contextFor(item),repeated=context.history.flatMap(message=>[message,{...message}])
  const history=[...repeated,user(item.text,item.step),user(item.text,item.step)]
  assert.equal(matchStepAssistDemo({context:{...context,history}})?.kind,item.reply,item.id)
  const amended=[...repeated,user('更正：与前述不同，实际情况需要重新核实。',item.step),user(item.text,item.step)]
  assert.equal(matchStepAssistDemo({context:{...context,history:amended}}),null,item.id)
 }
})

test('common whitespace and punctuation differences match without fuzzy fact matching',()=>{
 for(const item of cases){
  const context=contextFor(item),format=text=>'  '+text.replaceAll('，',',').replaceAll('；',';').replaceAll('：',':').replaceAll('。','.').replaceAll('—','–').replaceAll('“','"').replaceAll('”','"').replaceAll('【','[').replaceAll('】',']').replaceAll(' ','\n  ')+'  '
  assert.equal(matchStepAssistDemo({context:{...context,message:{text:format(item.text)},history:context.history.map(message=>({...message,text:format(message.text)}))}})?.kind,item.reply,item.id)
  assert.equal(matchStepAssistDemo({context:{...context,message:{text:'其他现场情况：'+item.text}}}),null,item.id+' prefix is not a match')
  assert.equal(matchStepAssistDemo({context:{...context,message:{text:item.text+' 另外新增真实损伤，请一起写入。'}}}),null,item.id+' suffix is not a match')
 }
 const answer=cases.find(item=>item.id==='investigation-answer'),context=contextFor(answer)
 const nonUserQuotes=[...iq,...rq].filter(text=>!cases.some(item=>item.text===text))
 for(const text of [answer.text.replace('三次','两次'),answer.text.replace('15:10','15:11'),'二缸 ICU 回位不畅，帮我整理一下',...nonUserQuotes])assert.equal(matchStepAssistDemo({context:{...context,message:{text}}}),null)
})

test('the scripted notes retain key limits and do not claim an absent photo was received',()=>{
 const byId=id=>replyFor(cases.find(item=>item.id===id))
 assert.match(byId('investigation-revise').note,/原因未确认/);assert.match(byId('investigation-revise').note,/不能归因为积碳或磨损/);assert.doesNotMatch(byId('investigation-revise').note,/照片已保存|已取得现场证据/)
 assert.match(byId('supply').note,/未拆检全部/);assert.match(byId('supply').note,/未覆盖高负荷/);assert.match(byId('supply').note,/不能据此确认 ICU 根因/)
 assert.match(byId('preparation-answer').note,/尚未拆换/);assert.match(byId('preparation-answer').note,/签认附件未上传/)
 assert.match(byId('repair-revise').note,/OLD-C2-01/);assert.match(byId('repair-revise').note,/尚未送检/);assert.match(byId('repair-revise').note,/各1套/);assert.match(byId('repair-revise').note,/作业照片待补/)
 assert.match(byId('trial-clarify').note,/后续试验未实施/);assert.match(byId('trial-clarify').note,/本步仍未完成/)
 assert.match(byId('handover').note,/时限待轮机长确认/);assert.match(byId('handover').note,/效果观察尚未开始/);assert.match(byId('handover').note,/长期修复效果未经证明/)
 for(const item of cases){const context=contextFor(item);assert.deepEqual(matchStepAssistDemo({context,images:[{name:'sample.png'}]}),matchStepAssistDemo({context,images:[]}))}
})

test('conflicting human results fall back to the model and matching never mutates records',()=>{
 const item=cases.find(item=>item.id==='trial'),context=contextFor(item),before=structuredClone(context)
 const response=matchStepAssistDemo({context});assert.deepEqual(context,before);assert.equal(context.record.result,'')
 response.note='mutated returned copy';assert.notEqual(matchStepAssistDemo({context}).note,response.note)
 assert.equal(matchStepAssistDemo({context:{...context,record:{result:'已完成',note:'人工补录'}}}),null)
 assert.equal(matchStepAssistDemo({context:{...context,record:{result:'未完成',note:''}}})?.kind,'draft')
})

test('acceptance tooling can reuse an immutable catalog with exact inputs and prerequisites',()=>{
 assert.equal(STEP_ASSIST_DEMO_CASES.length,cases.length);assert.ok(Object.isFrozen(STEP_ASSIST_DEMO_CASES))
 for(const entry of STEP_ASSIST_DEMO_CASES){
  assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.response));assert.ok(Object.isFrozen(entry.requires))
  const script=cases.find(item=>item.text===entry.input&&item.kind===entry.kind&&item.step===entry.stepIndex)
  assert.ok(script,entry.id);assert.deepEqual(replyFor(script),entry.response)
  assert.deepEqual(entry.requires.map(id=>STEP_ASSIST_DEMO_CASES.find(item=>item.id===id)?.input),script.requires||[])
 }
})

test('only known presentation wrappers on exact current inputs are compatible, never changed facts or old identities',()=>{
 const suffix='这张是 AI 生成的演示图，只练习上传，不是现场照片，不能拿它认定卡滞或损伤。'
 for(const item of cases){
  const context=contextFor(item)
  const text='【虚构演示】'+item.text
  assert.deepEqual(matchStepAssistDemo({context:{...context,message:{text},history:context.history.map(message=>({...message,text:'【虚构演示】'+message.text}))}}),replyFor(item),item.id)
  assert.equal(matchStepAssistDemo({context:{...context,message:{text:text+'另发现接口损伤。'}}}),null,item.id)
  assert.equal(matchStepAssistDemo({context:{...context,message:{text:item.text+suffix+'另发现接口损伤。'}}}),null,item.id)
 }
 const start=cases[0],context=contextFor(start)
 assert.deepEqual(matchStepAssistDemo({context:{...context,message:{text:'【虚构演示】'+start.text+suffix}}}),replyFor(start))
 for(const item of cases.filter(item=>/WO-C2|OLD-C2|SPARE-C2|李建国|陈志远/.test(item.text))){
  const context=contextFor(item),text=item.text.replaceAll('WO-C2','DEMO-WO-C2').replaceAll('OLD-C2','DEMO-OLD-C2').replaceAll('SPARE-C2','DEMO-SPARE-C2').replaceAll('李建国','演示人员甲').replaceAll('陈志远','演示人员乙')
  assert.equal(matchStepAssistDemo({context:{...context,message:{text}}}),null,'old identifiers and names must not be rewritten: '+item.id)
 }
 for(const entry of STEP_ASSIST_DEMO_CASES){
  assert.doesNotMatch(entry.input,/演示|练习|虚构|DEMO-|AI 生成|历史照片|人员甲|人员乙/,entry.id)
  assert.doesNotMatch(entry.response.text,/演示|练习|虚构|图片不作/,entry.id)
 }
})
