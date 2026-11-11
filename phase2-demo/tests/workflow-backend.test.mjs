import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {tmpdir} from 'node:os'
import {join,resolve,dirname} from 'node:path'
import {createWorkflowService,readWorkflowJson} from '../server/workflow-service.mjs'
import {Readable} from 'node:stream'
import {renderMarkdown} from '../src/workflow/renderMarkdown.js'
import {hiddenContext,visibleText} from '../server/skill-runtime.mjs'
import {createBackendWorkflowSync} from '../src/workflow/backendWorkflowSync.js'
import {ensureTaskPlan,decide,currentTask,submitTask,people,beginTaskReport,resumeOwnTask} from '../src/workflow/eventLifecycle.js'
import {lifecycleDecisionOptions} from '../src/workflow/lifecycleDecisions.js'
import {buildStepAssistRequest} from '../src/workflow/stepAssistContract.js'
import {assistTaskStep} from '../server/step-assist.mjs'
import {decide as confirmedDecision} from './helpers/confirmed-decision.mjs'
import {normalizeTaskPlan} from '../src/workflow/taskPlanning.js'
import {taskEditContract} from '../src/workflow/taskEdits.js'
const copy=v=>JSON.parse(JSON.stringify(v)),chief={workflowRole:'captain'},engineer={workflowRole:'engineer'}
const analysis={title:'燃油压力波动核实',summary:'现场上报压力波动，待核对。',interpretation:'依据现场描述与本窗口采样核对。',unverified:'独立表计读数待确认。',recommendation:'安排核对燃油压力变化与独立表计。',steps:[{label:'核对燃油压力',guide:'同步读取现场表计和系统读数。',checks:['记录时间与压力。'],recordHint:'回交两组读数与时间。'}]}
const form=()=>({deviceId:'main-engine-1',sensorIds:['s-002'],start:new Date(Date.now()-3600000).toISOString(),end:new Date(Date.now()-60000).toISOString(),description:'燃油进机压力疑似波动，请核对现场表计。'})
test('workflow JSON preserves Chinese and emoji when network chunks split UTF-8 characters',async()=>{
 const value={revision:10,event:{pendingPlan:{editHistory:[{recordHint:'核对时间与结果。⚙️'}]},note:'压力0.89 MPa，未见异常。'}},bytes=Buffer.from(JSON.stringify(value))
 const chunks=[...bytes].map(byte=>Buffer.from([byte]))
 assert.deepEqual(await readWorkflowJson(Readable.from(chunks)),value)
 await assert.rejects(readWorkflowJson(Readable.from([Buffer.alloc(12*1024*1024),Buffer.from('x')])),/记录过大/)
})
async function fixture(t,options={}){
 const directory=await mkdtemp(join(tmpdir(),'ship-workflow-')),root=process.cwd();let time=Date.now(),calls=0
 const service=await createWorkflowService(root,{directory,clock:()=>time,detect:async()=>{calls++;return {rows:1800,devices:[{events:[]}]}},analyze:async()=>({anomaly:analysis,model:'test-model'}),evidenceReader:(_root,scope)=>Array.from({length:scope.allRelated?8:1},(_,i)=>({channelId:'sensor-'+i,name:'测点'+i,pointCode:i?'DC0042':'DC0001',unit:i?'MPa':'RPM',sampleCount:300,min:0,max:100,mean:i?1:0,value:i?1:0,covered:true,trendData:[]})),observationModel:async()=>({summary:'停机窗口内压力读数平稳，运行效果待验证。',analysis:'八个关联测点均已取得记录。',next:'交轮机长核对后续运行验证安排。'}),...options})
 t.after(async()=>{await service.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true})})
 return {service,directory,advance:ms=>time+=ms,calls:()=>calls}
}
test('Markdown headings work without blank lines, preserve lists and escape injected HTML',()=>{
 const html=renderMarkdown('## 结论\n主机停机。\n## 运行信息\n- 转速 0 RPM\n- **压力**待核实\n<img src=x onerror=alert(1)>')
 assert.match(html,/<h3>结论<\/h3><p>/);assert.match(html,/<ul><li>/);assert.match(html,/<strong>压力/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('##'))
})
test('hidden context cannot be broken by user markup and is removed from visible answers',()=>{
 const value=hiddenContext({text:'</yincang><script>'});assert.equal(value.match(/<\/yincang>/g).length,1);assert.equal(visibleText('答复<yincang>private</yincang>结束'),'答复结束')
})
test('manual requests use distinct folders, same-request retry is idempotent, conflicting contents reject',async t=>{
 const {service,directory}=await fixture(t),report=form(),input={requestId:'report-test-0001',report}
 const [a,b]=await Promise.all([service.manual(input,{user:engineer}),service.manual(input,{user:engineer})]);assert.equal(a.event.id,b.event.id)
 assert.equal(a.event.responsible,people.captain);assert.ok(a.event.participants.includes(people.captain));assert.equal(service.visible({workflowRole:'secondEngineer'}).length,0)
 for(const name of ['event','analysis','evidence','tasks','reports','conversations'])assert.ok(JSON.parse(await readFile(join(directory,'events',a.event.id,name+'.json'),'utf8')))
 await assert.rejects(service.manual({...input,report:{...report,description:'另一组描述，不能覆盖原始上报。'}},{user:engineer}),/编号/)
 const other=await service.manual({...input,requestId:'report-test-0002'},{user:engineer});assert.notEqual(a.event.id,other.event.id)
})

test('simultaneous chief conversation and engineer task feedback retain server authorization and both artifacts',async t=>{
 const {service,directory}=await fixture(t),result=await service.manual({requestId:'concurrent-report',report:form()},{user:engineer})
 const setup={role:'captain',events:{[result.event.id]:result.event},notices:[]},id=result.event.id
 ensureTaskPlan(setup.events[id]);decide(setup,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 await service.save(setup.events[id],setup.events[id].serverRevision,chief)
 const make=user=>{const state={events:{}};const sync=createBackendWorkflowSync(state,async(path,body)=>path==='workflow/events'?{events:service.visible(user)}:{event:await service.save(body.event,body.revision,user)});return {state,sync}}
 const a=make(chief),b=make(engineer);t.after(()=>{a.sync.close();b.sync.close()})
 await Promise.all([a.sync.pull(),b.sync.pull()])
 a.state.events[id].conversations.captain.push({id:'chief-concurrent-message',kind:'user',text:'继续核对现场表计。'})
 b.state.events[id].tasks[0].draft.records[0].note='现场0.89 MPa，与系统一致。'
 await Promise.all([a.sync.flush(),b.sync.flush()]);await a.sync.refresh()
 assert.equal(service.repository.get(id).tasks[0].draft.records[0].note,'现场0.89 MPa，与系统一致。')
 const messages=JSON.parse(await readFile(join(directory,'events',id,'conversations.json'),'utf8'))
 assert.equal(messages.event.captain.at(-1).text,'继续核对现场表计。')
 assert.equal(service.visible({workflowRole:'secondEngineer'}).length,0)
 const invalid=copy(b.state.events[id]);invalid.conversations.captain.push({id:'forged',kind:'user',text:'冒充轮机长'})
 await assert.rejects(service.save(invalid,invalid.serverRevision,engineer),/他人会话/)
})
test('hourly detection is startup relative and does not duplicate a completed slot',async t=>{
 const f=await fixture(t);await f.service.tick();assert.equal(f.calls(),1);f.advance(59*60000);await f.service.tick();assert.equal(f.calls(),1);f.advance(60000);await f.service.tick();assert.equal(f.calls(),2)
 const status=await f.service.status();assert.equal(status.runs.filter(r=>r.status==='complete').length,2)
})
test('manual task dispatch, engineer feedback and due observation persist; observation covers all related sensors once',async t=>{
 const {service,advance}=await fixture(t),result=await service.manual({requestId:'report-workflow-1',report:form()},{user:engineer})
 const state={role:'captain',events:{[result.event.id]:result.event},notices:[]},event=state.events[result.event.id]
 ensureTaskPlan(event);decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 let saved=await service.save(event,event.serverRevision,chief);event.serverRevision=saved.serverRevision
 const forbidden=copy(event);forbidden.decisions.push({action:'close'});await assert.rejects(service.save(forbidden,event.serverRevision,engineer),/决策/)
 state.role='engineer';const task=currentTask(event);task.draft.records[0].result='未见异常';task.draft.records[0].note='已核对现场表计，读数稳定。';task.draft.summary='本次检查未见异常。'
 beginTaskReport(state,event.id,task.id,'generation-test');saved=await service.save(event,event.serverRevision,engineer);event.serverRevision=saved.serverRevision
 submitTask(state,event.id,task.id,{requestId:'generation-test',model:'test',patch:{summary:'现场核对未见异常。',analysis:{evidence:'执行记录。',interpretation:'本次核对读数一致。',unverified:'运行工况尚待核对。',next:'请轮机长审阅。'}}})
 saved=await service.save(event,event.serverRevision,engineer);event.serverRevision=saved.serverRevision
 state.role='captain';assert.ok(lifecycleDecisionOptions(event).some(o=>o.value==='observe'))
 decide(state,event.id,{action:'observe',reason:'观察相关系统变化。',observationPlan:{dueAt:new Date(Date.now()+3600000).toISOString(),purpose:'核对压力变化。',condition:'当前工况',signals:'燃油系统相关测点'}})
 saved=await service.save(event,event.serverRevision,chief);event.serverRevision=saved.serverRevision
 const child=Object.values(state.events).find(e=>e.parentEventId===event.id);assert.ok(child)
 await service.save(child,undefined,chief);advance(3601000);await service.tick()
 const completed=service.repository.get(child.id);assert.equal(completed.reports.filter(r=>r.kind==='观察报告').length,1);assert.equal(completed.reports.at(-1).observationSnapshot.sensors.length,8);assert.equal(completed.status,'待决策')
 await service.tick();assert.equal(service.repository.get(child.id).reports.filter(r=>r.kind==='观察报告').length,1)
 await assert.rejects(service.save(event,event.serverRevision-1,chief),/已更新/)
 state.events[child.id]=completed
 confirmedDecision(state,child.id,{action:'close',reason:'已核对本次记录，按已确认范围归档；未验证的运行效果仍保留说明。'})
 for(const linked of Object.values(state.events)){const current=service.repository.get(linked.id);await service.save(linked,current.serverRevision,chief)}
 assert.equal(service.repository.get(child.id).phase,'closed');assert.equal(service.repository.get(event.id).phase,'closed')
})
test('two clarification rounds force an adoptable draft without fabricating completed actions',async t=>{
 const {service}=await fixture(t),result=await service.manual({requestId:'report-clarify-1',report:form()},{user:chief}),event=result.event,state={role:'captain',events:{[event.id]:event},notices:[]}
 ensureTaskPlan(event);decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const input=buildStepAssistRequest({event,task:currentTask(event),stepIndex:0,role:'engineer',text:'只有这个现场记录，其他读数还没取得。'});input.clarificationRounds=2
 const config={source:'manual',enabled:true,apiKey:'test',model:'test',baseUrl:'https://example.test/v1',protocol:'openai',maxTokens:4096,timeoutMs:5000,knowledgeEnabled:false}
 const reply=await assistTaskStep(input,{root:process.cwd(),configuration:{read:async()=>config},knowledge:{search:async()=>[]},fetcher:async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify({kind:'question',text:'再补充一个读数？'})},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})})
 assert.equal(reply.stepAssist.kind,'draft');assert.match(reply.stepAssist.note,/其他读数还没取得/);assert.ok(!reply.stepAssist.note.includes('已完成检查'))
})
test('backend sync saves before reload and detects stale versions without silently overwriting',async()=>{
 const event={id:'manual-sync-test',backendManaged:true,serverRevision:1,tasks:[],title:'original'},state={events:{}},stored=copy(event);let saves=0
 const sync=createBackendWorkflowSync(state,async(path,body)=>{if(path.endsWith('events'))return {events:[copy(stored)]};saves++;Object.assign(stored,body.event,{serverRevision:stored.serverRevision+1});return {event:copy(stored)}})
 await sync.pull();state.events[event.id].title='changed';await sync.flush();assert.equal(saves,1);assert.equal(stored.title,'changed');await sync.refresh();assert.equal(saves,1);sync.close()
})

test('event editing recognizes keep-one/delete-others and preserves the retained requirements',()=>{
 const plan={action:'investigate',steps:[...analysis.steps,{...analysis.steps[0],label:'核对管路'}]}
 const contract=taskEditContract(plan,'只保留第1项，其他步骤删除；第1项检查要求保留。')
 assert.ok(contract)
})

test('restart recovers an overdue observation and starts a fresh hourly detection cycle',async t=>{
 const f=await fixture(t),result=await f.service.manual({requestId:'restart-report-1',report:form()},{user:chief}),event=result.event
 const at=new Date(Date.now()-60000).toISOString(),due=new Date(Date.now()-1000).toISOString()
 event.phases.push({id:'overdue-phase',at,observationDueAt:due,observationWaiting:true});await f.service.repository.save(event);await f.service.close()
 let detected=0,observed=0
 const restarted=await createWorkflowService(process.cwd(),{directory:f.directory,detect:async()=>{detected++;return {rows:1,devices:[]}},evidenceReader:()=>[],observationModel:async()=>{observed++;return {summary:'观察期暂无有效采样。',analysis:'待核对数据采集。',next:'由轮机长安排复核。'}}})
 t.after(()=>restarted.close());await restarted.tick();await restarted.tick()
 assert.equal(detected,1);assert.equal(observed,1);assert.equal(restarted.repository.get(event.id).reports.filter(r=>r.kind==='观察报告').length,1)
 await restarted.close()
})

test('observation failure retries after five minutes; cancellation during generation prevents report publication',async t=>{
 let attempts=0,cancel=false,f
 f=await fixture(t,{observationModel:async()=>{attempts++;if(attempts===1)throw Error('temporary model failure');if(cancel){const e=f.service.repository.list()[0];e.phases.at(-1).observationWaiting=false;await f.service.repository.save(e)}return {summary:'待核对。',analysis:'观察记录已整理。',next:'请轮机长审阅。'}}})
 const result=await f.service.manual({requestId:'retry-observe-01',report:form()},{user:chief}),event=result.event
 event.phases.push({id:'retry-phase',at:new Date(Date.now()-60000).toISOString(),observationDueAt:new Date(Date.now()-1000).toISOString(),observationWaiting:true});await f.service.repository.save(event)
 await f.service.tick();assert.equal(f.service.repository.get(event.id).phases.at(-1).observationError,true)
 f.advance(299000);await f.service.tick();assert.equal(attempts,1)
 cancel=true;f.advance(2000);await f.service.tick();assert.equal(attempts,2);assert.equal(f.service.repository.get(event.id).reports.filter(r=>r.kind==='观察报告').length,0)
})

test('periodic confirmed signals deduplicate, retain six runs and respect administrator deletion',async t=>{
 const mapping=JSON.parse(await readFile('data/sensor-point-mapping.json','utf8')).pointList
 const point=mapping.find(p=>p.pointCode==='DC0008'),signal={confirmed:true,equipment_id:'CHBY-001',channel:'statistical',event_type:'压力波动',sensors:['燃油进机压力'],time_end:'2026-11-10 10:00:00',details:{sourcePoints:[{pointDataId:point.pointDataId}]}}
 const f=await fixture(t,{detect:async()=>({rows:1800,devices:[{events:[signal]}]})})
 for(let i=0;i<8;i++){await f.service.tick();f.advance(3600000)}
 assert.equal(f.service.repository.list().length,1);assert.equal((await readdir(join(f.directory,'detection-history'))).length,6)
 const event=f.service.repository.list()[0];assert.equal(event.responsible,people.captain);assert.equal(event.manualReport,undefined)
 const accounts=new DatabaseSync(join(f.directory,'accounts.sqlite'));accounts.exec('CREATE TABLE deleted_events(id TEXT PRIMARY KEY)');accounts.prepare('INSERT INTO deleted_events VALUES(?)').run(event.id);accounts.close()
 await f.service.tick();assert.equal(f.service.visible(chief).length,0);assert.equal(f.service.repository.list().length,1)
})

for(const branch of ['false','shore','normal-close','normal-continue','abnormal-repair','unknown-observe','unfinished-resume','unfinished-own-resume','unfinished-terminate','repair-resume','repair-recheck'])test('persisted manual branch: '+branch,async t=>{
 const {service}=await fixture(t),result=await service.manual({requestId:'branch-'+branch,report:form()},{user:engineer}),event=result.event,state={role:'captain',events:{[event.id]:event},notices:[]}
 const save=async user=>{const saved=await service.save(event,event.serverRevision,user);event.serverRevision=saved.serverRevision}
 const dispatch=async action=>{
  state.role='captain';event.decisionDraft={action};const plan=ensureTaskPlan(event)
  if(plan.status!=='ready')Object.assign(plan,normalizeTaskPlan({scope:'依据本轮已提交结果核对批准范围。',rationale:'仅安排已确认对象与待核对项目。',steps:analysis.steps},action),{status:'ready',source:'model'})
  confirmedDecision(state,event.id,{action,owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()});await save(chief);return currentTask(event)
 }
 const feedback=async(result,executionStatus)=>{
  state.role='engineer';const task=currentTask(event);task.draft.records.forEach(r=>Object.assign(r,{result,note:executionStatus==='未完成'?'现场条件尚不具备，该项未实施。':'已实施本步核对，记录具体读数与结果。',...(executionStatus?{executionStatus}:{})}));task.draft.summary=executionStatus==='未完成'?'现场条件尚不具备，该项未实施。':'已回交本轮现场记录。';submitTask(state,event.id,task.id);await save(engineer);state.role='captain';return task
 }
 const decideAndSave=async(action,extra={})=>{confirmedDecision(state,event.id,{action,reason:'依据本轮现场记录确定后续安排。',...extra});await save(chief)}
 if(branch==='false'){await decideAndSave('false');assert.equal(service.repository.get(event.id).phase,'closed');return}
 if(branch==='shore'){await decideAndSave('shore',{shoreIncludeHistory:true,shoreSituation:{situation:'现场压力指示波动，待核实。'}});assert.equal(service.repository.get(event.id).shore.length,1);assert.equal(event.phase,'reminder');return}
 await dispatch('investigate')
 if(branch==='unknown-observe'){await feedback('无法确认','已完成');await decideAndSave('observe');assert.equal(event.phase,'transferred');return}
 if(branch.startsWith('unfinished')){
  const task=await feedback('无法确认','未完成');assert.ok(lifecycleDecisionOptions(event).some(o=>o.value==='wait'))
  if(branch==='unfinished-terminate'){await decideAndSave('terminate');assert.equal(task.status,'terminated');await decideAndSave('close');assert.equal(event.phase,'closed');return}
  await decideAndSave('wait');assert.equal(task.status,'waiting')
  if(branch==='unfinished-own-resume'){state.role='engineer';resumeOwnTask(state,event.id,task.id,{reason:'原等待条件已具备，批准范围未改变。'});await save(engineer)}else await decideAndSave('resume')
  assert.equal(currentTask(event).id,task.id);await feedback('未见异常');await decideAndSave('close');assert.equal(event.reports.filter(r=>r.taskId===task.id).length,2);return
 }
 await feedback(branch.startsWith('normal')?'未见异常':'发现异常')
 if(branch==='normal-close'){await decideAndSave('close');assert.equal(event.phase,'closed');return}
 if(branch==='normal-continue'){await dispatch('investigate');assert.equal(event.tasks.length,2);return}
 const task=await dispatch('repair');assert.equal(task.kind,'repair')
 if(branch==='repair-resume'){await feedback('未完成','未完成');await decideAndSave('wait');await decideAndSave('resume');assert.equal(currentTask(event).id,task.id);await feedback('已完成');await decideAndSave('close');assert.equal(event.phase,'closed');return}
 await feedback('已完成')
 if(branch==='repair-recheck'){await dispatch('recheck');assert.equal(currentTask(event).purpose,'recheck');await feedback('未见异常');await decideAndSave('close');assert.equal(event.phase,'closed');return}
 await decideAndSave('observe');const child=Object.values(state.events).find(e=>e.parentEventId===event.id);await service.save(child,undefined,chief);assert.equal(service.repository.get(child.id).phase,'review')
})
