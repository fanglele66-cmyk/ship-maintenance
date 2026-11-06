import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createLifecycleState,decide,currentTask,submitTask,people,ensureTaskPlan} from '../src/workflow/eventLifecycle.js'
import {taskEditContract,applyTaskEditOperations,verifyTaskEdit} from '../src/workflow/taskEdits.js'
import {acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {createAiHandler} from '../server/ai-api.mjs'

const labels=['作业准备与安全隔离','实施维修与过程记录','复装与分阶段试验','交接与效果观察']
const makePlan=()=>({action:'repair',scope:'二缸批准的维修范围',rationale:'按本轮现场记录处理。',steps:labels.map((label,i)=>({label,guide:`按批准范围实施第${i+1}项。`,checks:['保留本轮现场记录。'],recordHint:'记录实际操作和未完成内容。',options:['已完成','未完成','不适用'],substeps:[{label:`原子项${i+1}`,checks:['保持原始子项及顺序。']}]}))})

test('displayed work phase names target the original step without changing retained work cards',()=>{
 for(const [name,index] of [['作业准备',0],['实施维修',1],['复装试验',2],['效果观察',3],['复装实验',2]]){
  const before=makePlan(),snapshot=structuredClone(before),text=`去掉${name}`,contract=taskEditContract(before,text)
  assert.equal(contract.mode,'selection');assert.deepEqual(contract.remove,[index])
  const result=applyTaskEditOperations(before,contract,[{type:'remove',step:index+1}],'repair')
  assert.deepEqual(result.plan.steps,before.steps.filter((_,i)=>i!==index))
  // The frontend's immutable expected plan contains no action; verification
  // receives that separately and must resolve the same displayed short name.
  const {action,...expected}=before
  assert.deepEqual(verifyTaskEdit(expected,text,result,action).plan,result.plan)
  assert.deepEqual(before,snapshot)
 }
})

test('prefix and suffix step numbers accept oral trial spelling and whitespace',()=>{
 for(const text of ['去掉步骤三 复装实验','去掉步骤3复装试验','去掉第三步复装实验','去掉第 3 步 复装试验','去掉步骤 第三','删除任务三','请帮我去掉“复装实验”']){
  const before=makePlan(),contract=taskEditContract(before,text)
  assert.deepEqual(contract.remove,[2],text);assert.deepEqual(contract.kept,[0,1,3],text)
 }
 const before=makePlan()
 assert.deepEqual(taskEditContract(before,'去掉步骤一和三').remove,[0,2])
 assert.deepEqual(taskEditContract(before,'仅保留步骤一及四').kept,[0,3])
 assert.deepEqual(taskEditContract(before,'保留前两项').protected,[0,1])
 assert.deepEqual(taskEditContract(before,'修改步骤三的回交要求').updateTargets,[2])
 assert.deepEqual(taskEditContract(before,'修改复装试验的回交要求').updateTargets,[2])
})

test('ambiguous short names, contradictory numbers, unknown steps and negations cannot delete work',()=>{
 const ambiguous=makePlan();ambiguous.steps[1].short='复装试验'
 assert.throws(()=>taskEditContract(ambiguous,'去掉复装实验'),/对应多项/)
 assert.deepEqual(taskEditContract(ambiguous,'去掉步骤三复装实验').remove,[2])
 for(const text of ['去掉步骤二 复装实验','去掉步骤五','去掉步骤十三','去掉复装','不要去掉复装试验','如果正常去掉复装试验','去掉步骤三中的第一个子项']){
  const before=makePlan(),snapshot=structuredClone(before)
  assert.throws(()=>taskEditContract(before,text),undefined,text);assert.deepEqual(before,snapshot)
 }
})

test('custom two-character short names and maintenance phase labels use the displayed contract',()=>{
 const before=makePlan();before.steps[0].short='备料'
 assert.deepEqual(taskEditContract(before,'去掉备料').remove,[0])
 const maintenance={...makePlan(),action:'maintenance'}
 assert.deepEqual(taskEditContract(maintenance,'去掉实施维保').remove,[1])
 assert.deepEqual(taskEditContract(before,'删除“复装与分阶段试验”').remove,[2])
})

test('repair plan chat deletion passes API and frontend verification with original source snapshots',async()=>{
 const state=createLifecycleState(),id='real-alarm-0430',event=state.events[id]
 decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer';const investigation=currentTask(event)
 investigation.draft.records.forEach((record,i)=>{record.result=i===0?'发现异常':'未见异常';record.note='现场检查已回交。'})
 submitTask(state,id,investigation.id);state.role='captain'
 event.decisionDraft={action:'repair'}
 const draft=ensureTaskPlan(event),original=makePlan()
 Object.assign(draft,{...original,status:'ready'})
 const before=structuredClone({scope:draft.scope,rationale:draft.rationale,steps:draft.steps})
 const text='去掉步骤三 复装实验',expected={key:draft.key,version:draft.version,editText:text,plan:before}
 const config={source:'manual',baseUrl:'https://example.test',apiKey:'private',model:'test',protocol:'anthropic',maxTokens:2000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 let modelCalls=0,requestData
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async(_url,options)=>{
  modelCalls++;requestData=JSON.parse(JSON.parse(options.body).messages[0].content)
  return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({operations:[{type:'remove',step:3}]})}],usage:{input_tokens:10,output_tokens:8}})}
 }})
 const body={mode:'plan',planMode:'edit',role:'captain',actor:people.captain,text,event,plan:draft}
 const req=Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]),{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 let output,code
 await handler(req,{set statusCode(value){code=value},setHeader(){},end(value){output=JSON.parse(value)}},()=>assert.fail())
 assert.equal(code,200,output?.error);assert.equal(modelCalls,1);assert.deepEqual(requestData.editConstraints.remove,[2])
 acceptTaskPlan(event,expected,output)
 assert.deepEqual(draft.steps,[before.steps[0],before.steps[1],before.steps[3]])
 assert.deepEqual(draft.editHistory.at(-1).before,before)
 assert.equal(draft.version,expected.version+1)
})
