import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createLifecycleState,ensureTaskPlan,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'
import {normalizeTaskPlan,acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {taskEditContract,selectTaskSteps,applyTaskEditOperations,verifyTaskEdit} from '../src/workflow/taskEdits.js'
import {createAiHandler} from '../server/ai-api.mjs'
const id='real-alarm-0430',request='删除第二项排查任务，仅保留第一项即可'
function fixture(){const state=createLifecycleState(),event=state.events[id],draft=ensureTaskPlan(event);return {state,event,draft,before:structuredClone({scope:draft.scope,rationale:draft.rationale,steps:draft.steps})}}

for(const text of [request,'删除第2项，仅保留第1项','删除第二项排查任务仅保留第一项即可','删除第二项','只保留第一项','删除“核查燃油供给与瞬态工况”'])test(`explicit selection preserves exactly the retained task: ${text}`,()=>{
 const {before}=fixture(),contract=taskEditContract(before,text),result=applyTaskEditOperations(before,contract,[{type:'remove',step:2}],'investigate')
 assert.equal(contract.mode,'selection');assert.equal(result.plan.steps.length,1);assert.deepEqual(result.plan.steps[0],before.steps[0]);assert.equal(result.source,'model');assert.doesNotMatch(result.plan.scope,/燃油供给/)
 assert.deepEqual(verifyTaskEdit(before,text,result,'investigate').plan,result.plan)
})

test('numbered task references do not mean a desired number of generated tasks',()=>{
 const {before}=fixture(),result=selectTaskSteps(before,taskEditContract(before,'仅保留第二项'))
 assert.equal(result.plan.steps.length,1);assert.deepEqual(result.plan.steps[0],before.steps[1])
 const four={...before,steps:[...before.steps,...structuredClone(before.steps)]}
 assert.equal(selectTaskSteps(four,taskEditContract(four,'只保留前两项')).plan.steps.length,2)
})

test('contradictory, unknown and conditional deletion never mutates the current draft',()=>{
 for(const text of ['删除第一项，仅保留第一项','删除第五项','不要删除第二项','如果检查正常就删除第二项','删除全部任务','删除第一项中的第二个检查点']){
  const {before}=fixture(),copy=structuredClone(before);assert.throws(()=>taskEditContract(before,text));assert.deepEqual(before,copy)
 }
})

test('partial edits preserve the other task and original package metadata',()=>{
 const {before}=fixture(),text='修改第一项的回交要求，补充记录独立测量时刻。其他不变。',contract=taskEditContract(before,text)
 const result=applyTaskEditOperations(before,contract,[{type:'update',step:1,changes:{recordHint:'记录独立测量的方法、时刻和同刻对比结果。'}}],'investigate')
 assert.deepEqual(result.plan.steps[1],before.steps[1]);assert.equal(result.plan.steps[0].package,before.steps[0].package);assert.deepEqual(result.plan.steps[0].checks,before.steps[0].checks)
 assert.throws(()=>applyTaskEditOperations(before,contract,[{type:'update',step:2,changes:{guide:'擅自改动另一项检查要求。'}}],'investigate'),/未获指示/)
 assert.throws(()=>applyTaskEditOperations(before,contract,[{type:'update',step:1,changes:{label:'擅自修改标题'}}],'investigate'),/之外的任务字段/)
 assert.throws(()=>applyTaskEditOperations(before,contract,[{type:'remove',step:2}],'investigate'),/未获指示/)
 assert.throws(()=>applyTaskEditOperations(before,contract,[{type:'insert',after:1,step:before.steps[0]}],'investigate'),/没有新增/)
})

test('an explicitly added task leaves original tasks unchanged and is bounded by four',()=>{
 const {before}=fixture(),text='新增一项独立测温步骤',contract=taskEditContract(before,text),step={label:'独立测温对照',guide:'对照独立读数与系统读数。',checks:['记录同刻读数。'],recordHint:'回交时刻、方法和读数。'}
 const result=applyTaskEditOperations(before,contract,[{type:'insert',after:2,step}],'investigate');assert.equal(result.plan.steps.length,3);assert.deepEqual(result.plan.steps.slice(0,2),before.steps)
 assert.throws(()=>applyTaskEditOperations(before,contract,[{type:'update',step:1,changes:{guide:'擅自用改写替代新增。'}}],'investigate'))
 const four={...before,steps:[...before.steps,...structuredClone(before.steps)]};assert.throws(()=>taskEditContract(four,'新增一项独立测温步骤'),/1—4/)
})

test('negative insertion instructions cannot authorize added tasks',()=>{
 const {before}=fixture()
 for(const phrase of ['不新增任务','不要新增任务','无需新增步骤','不需要增加一项任务','禁止添加任务']){
  const contract=taskEditContract(before,`只修改第一项的回交要求，增加独立测量记录。其他内容不变，${phrase}。`)
  assert.equal(contract.canInsert,false,phrase)
  const result=applyTaskEditOperations(before,contract,[{type:'update',step:1,changes:{recordHint:'记录独立测量的方法与时刻。'}}],'investigate')
  assert.equal(result.plan.steps.length,2);assert.deepEqual(result.plan.steps[1],before.steps[1])
 }
})

test('keeping one task while editing its field requires removing only the other tasks',()=>{
 const {before}=fixture(),contract=taskEditContract(before,'仅保留第一项，修改第一项的回交要求，增加独立测量记录。')
 const result=applyTaskEditOperations(before,contract,[{type:'remove',step:2},{type:'update',step:1,changes:{recordHint:'记录独立测量的方法与时刻。'}}],'investigate')
 assert.equal(result.plan.steps.length,1);assert.equal(result.plan.steps[0].label,before.steps[0].label)
})

test('a model expanding the retained item into four cannot be accepted or reported as updated',()=>{
 const {event,draft,before}=fixture(),expected={key:draft.key,version:draft.version,editText:request,plan:before},snapshot=structuredClone(draft)
 const result=applyTaskEditOperations(before,taskEditContract(before,request),[{type:'remove',step:2}],'investigate');result.plan.steps=Array.from({length:4},()=>structuredClone(before.steps[0]))
 assert.throws(()=>acceptTaskPlan(event,expected,result),/约束/);assert.deepEqual(draft,snapshot)
})

test('successful selective edits retain history and dispatch exactly one original task',()=>{
 const {state,event,draft,before}=fixture(),result=applyTaskEditOperations(before,taskEditContract(before,request),[{type:'remove',step:2}],'investigate')
 acceptTaskPlan(event,{key:draft.key,version:draft.version,editText:request,plan:before},result)
 assert.equal(draft.steps.length,1);assert.deepEqual(draft.editHistory[0].before,before);assert.equal(draft.source,'model')
 decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:draft.scope})
 assert.deepEqual(currentTask(event).steps,[before.steps[0]]);assert.equal(currentTask(event).draft.records.length,1)
})

test('investigation and recheck accept one through four steps and reject five',()=>{
 const {before}=fixture(),base=normalizeTaskPlan(before,'investigate')
 for(const action of ['investigate','recheck'])for(const n of [1,2,3,4,5]){
  const plan={...base,steps:Array.from({length:n},()=>base.steps[0])}
  if(n<=4)assert.equal(normalizeTaskPlan(plan,action).steps.length,n);else assert.throws(()=>normalizeTaskPlan(plan,action),/1—4/)
 }
})

function httpRequest(body){const req=Readable.from([Buffer.from(JSON.stringify(body))]);return Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})}
test('explicit deletion calls the model and returns real provider usage; invalid roles never call it',async()=>{
 const {event,draft}=fixture();let modelCalls=0,configCalls=0
 const config={source:'manual',baseUrl:'https://example.test',apiKey:'private',model:'demo',protocol:'anthropic',maxTokens:2000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>{configCalls++;return config}},fetcher:async()=>{modelCalls++;return {ok:true,json:async()=>({model:'demo',content:[{type:'text',text:JSON.stringify({operations:[{type:'remove',step:2}]})}],usage:{input_tokens:123,output_tokens:16}})}}})
 for(const role of ['captain','engineer']){
  let output,code
  await handler(httpRequest({mode:'plan',planMode:'edit',role,text:request,event,plan:draft}),{set statusCode(v){code=v},setHeader(){},end(text){output=JSON.parse(text)}},()=>assert.fail())
  if(role==='captain'){assert.equal(code,200);assert.deepEqual(output.plan.steps,[draft.steps[0]]);assert.equal(output.source,'model');assert.deepEqual(output.usage,{inputTokens:123,outputTokens:16})}else assert.equal(code,400)
 }
 assert.equal(modelCalls,1);assert.equal(configCalls,1)
})

test('model failure or extra changes cannot fall back to a local deletion',async()=>{
 const {event,draft,before}=fixture(),config={source:'manual',baseUrl:'https://example.test',apiKey:'private',model:'demo',protocol:'anthropic',maxTokens:2000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 for(const bad of ['error',[{type:'remove',step:2},{type:'update',step:1,changes:{label:'擅自重写保留项'}}]]){
  const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async()=>{if(bad==='error')throw Error('模型不可用');return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({operations:bad})}]})}}})
  let output;await handler(httpRequest({mode:'plan',planMode:'edit',role:'captain',text:request,event,plan:draft}),{setHeader(){},end(text){output=JSON.parse(text)}},()=>assert.fail())
  assert.ok(output.error);assert.equal(output.plan,undefined);assert.deepEqual(draft.steps,before.steps)
 }
})

test('model edits use a patch contract and cannot use whole-plan generation defaults',async()=>{
 const {event,draft}=fixture();let prompt
 const config={source:'manual',baseUrl:'https://example.test',apiKey:'private',model:'demo',protocol:'anthropic',maxTokens:2000,timeoutMs:5000,enabled:true,knowledgeEnabled:false}
 const handler=createAiHandler(process.cwd(),{configuration:{read:async()=>config},fetcher:async(url,options)=>{prompt=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({operations:[{type:'update',step:1,changes:{recordHint:'新增独立测量时刻与方法记录。'}}]})}]})}}})
 let output;await handler(httpRequest({mode:'plan',planMode:'edit',role:'captain',text:'修改第一项的回交要求，补充独立测量时刻。',event,plan:draft}),{setHeader(){},end(text){output=JSON.parse(text)}},()=>assert.fail())
 assert.equal(output.plan.steps.length,2);assert.deepEqual(output.plan.steps[1],draft.steps[1]);assert.match(prompt.system,/只修改现有/);assert.doesNotMatch(prompt.system,/3—6|8—10/)
})
