import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,people,ensureTaskPlan,currentTask,submitTask,pendingDecision} from '../src/workflow/eventLifecycle.js'
import {shoreReportBasis,shoreReportEntries,shoreReportPresentation,createShoreReportDraft} from '../src/workflow/shoreReports.js'
import {createObservationEvent} from '../src/workflow/observationEvents.js'
import {decisionStage,processingWorkItems,workbenchDetails} from '../src/workflow/workbenchDetails.js'
const id='real-alarm-0430',future=()=>new Date(Date.now()+3600000).toISOString()
function assign(s){const e=s.events[id];s.role='captain';e.decisionDraft={action:'investigate'};ensureTaskPlan(e).status='ready';decide(s,id,{action:'investigate',owner:people.engineer,deadline:future()});return currentTask(e)}
function submit(s,t){s.role='engineer';t.draft.records.forEach((r,i)=>{r.result=t.steps[i].options[0];r.note='正式现场事实';r.executionStatus='已完成'});t.draft.summary='完成本轮排查';submitTask(s,id,t.id);s.role='captain'}
const shore={action:'shore',shoreIncludeHistory:true,shoreSituation:{situation:'',actions:'',uncertainty:'',support:''}}

test('Edited outbound text is retained exactly with frozen sources and without changing shipboard work',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);submit(s,t)
 const draft=createShoreReportDraft(e,s),original=JSON.stringify(e.reports),phase=e.phase
 const body='# 人工核对后的报告\n\n## 当前情况\n\n已核对现场回传，请岸基协助复核。\n\n## 后续安排\n\n持续跟踪压力。'
 e.reports[0].markdown+='\n后来的 AI 更新'
 const updatedReports=JSON.stringify(e.reports)
 decide(s,id,{...shore,shoreDraftReport:draft,shoreMarkdown:body})
 const sent=e.shore.at(-1).syncedReport
 assert.equal(sent.markdown,body);assert.equal(sent.originalMarkdown,draft.markdown);assert.equal(sent.edited,true)
 assert.equal(shoreReportEntries(s)[0].markdown,body);assert.equal(e.phase,phase);assert.equal(JSON.stringify(e.reports),updatedReports)
 assert.doesNotMatch(JSON.stringify(sent.includedReports),/后来的 AI 更新/);assert.notEqual(original,updatedReports)
})

test('Revising a submitted shore report creates a new version and preserves the original',()=>{
 const s=createLifecycleState(),e=s.events[id];decide(s,id,shore)
 const first=e.shore[0],frozen=JSON.stringify(first),draft=createShoreReportDraft(e,s,first.id)
 const body=draft.markdown+'\n\n人工补充：已联系岸基技术人员。'
 decide(s,id,{...shore,shoreDraftReport:draft,shoreMarkdown:body})
 assert.equal(e.shore.length,2);assert.equal(JSON.stringify(first),frozen)
 assert.equal(e.shore[1].syncedReport.sourceShoreId,first.id)
 assert.notEqual(e.shore[1].reportId,first.reportId)
 assert.equal(shoreReportPresentation(e.shore[1]).markdown,body)
 assert.equal(JSON.parse(JSON.stringify(s)).events[id].shore[1].syncedReport.markdown,body)
})

test('Empty, unrelated and unauthorized edits cannot create an outbound record',()=>{
 const s=createLifecycleState(),e=s.events[id],draft=createShoreReportDraft(e,s)
 assert.throws(()=>decide(s,id,{...shore,shoreDraftReport:draft,shoreMarkdown:'  '}),/不能为空/)
 assert.throws(()=>decide(s,id,{...shore,shoreDraftReport:{...draft,eventId:'other'},shoreMarkdown:'正文'}),/不属于当前事件/)
 assert.throws(()=>createShoreReportDraft(e,s,'missing'),/未找到/)
 s.role='engineer';assert.throws(()=>decide(s,id,{...shore,shoreDraftReport:draft,shoreMarkdown:'正文'}),/只有轮机长/)
 assert.equal(e.shore.length,0);assert.equal(e.decisions.length,0)
})

test('Initial shore report has event basis, permits blank additions, and preserves pending decision',()=>{
 const s=createLifecycleState(),e=s.events[id],before=e.phase;decide(s,id,shore)
 assert.equal(e.phase,before);assert.equal(pendingDecision(e),true);assert.equal(e.reports.length,0)
 const r=e.shore[0];assert.equal(r.status,'已上报岸基');assert.equal(r.delivery.mode,'prototype');assert.match(r.syncedReport.markdown,new RegExp(e.title));assert.equal(r.syncedReport.includedReports.length,0)
 assert.equal(shoreReportEntries(s)[0].id,r.id);s.role='engineer';assert.deepEqual(shoreReportEntries(s),[])
})
test('Shore snapshot includes related initial facts, task reports, observation and closure, excludes unrelated events and drafts',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);t.draft.summary='未提交秘密';t.draft.records[0].note='草稿秘密';
 let basis=shoreReportBasis(e,s);assert.doesNotMatch(JSON.stringify(basis),/未提交秘密|草稿秘密/);assert.equal(basis.events[0].tasks.length,1)
 submit(s,t);const obs=createObservationEvent(s,e,t,{reason:'观察已交报告'})
 obs.reports.push({id:'obs-report',eventId:obs.id,title:'观察结果',kind:'观察报告',at:future(),markdown:'观察正文',summary:'观察结果'})
 obs.reports.push({id:'closed-report',eventId:obs.id,title:'闭环记录',kind:'闭环报告',at:future(),markdown:'闭环正文'})
 t.draft.summary='交付后的私有草稿';t.draft.records[0].note='新草稿秘密'
 decide(s,obs.id,shore);const record=obs.shore[0],saved=JSON.stringify(record)
 assert.equal(record.syncedReport.events.length,2);assert.equal(record.syncedReport.includedReports.length,3)
 assert.match(record.syncedReport.markdown,/正式现场事实/);assert.match(record.syncedReport.markdown,/观察结果/);assert.equal(record.syncedReport.includedReports[1].markdown,'观察正文');assert.match(record.syncedReport.markdown,/闭环正文/)
 assert.doesNotMatch(saved,/新草稿秘密|交付后的私有草稿|四缸排温/)
 e.reports[0].markdown='新的 AI 内容';obs.reports.push({id:'later-report',markdown:'后来报告'});t.records[0].note='后来修订'
 assert.equal(JSON.stringify(record),saved)
 assert.equal(shoreReportBasis(obs,s).includedReports.length,4)
})
test('Shore basis retains formal report while AI generation is failed or still running',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);submit(s,t)
 t.status='report-error';t.reportGeneration={factReportId:e.reports[0].id,status:'error'}
 for(const status of ['report-error','reporting']){
  t.status=status;const basis=shoreReportBasis(e,s)
  assert.match(basis.markdown,/正式现场事实/);assert.doesNotMatch(basis.markdown,/AI 分析生成/)
  assert.match(basis.includedReports[0].analysisState,/AI 分析生成/)
 }
})
test('Workbench progresses from initial decision through private draft counts to post-investigation decision',()=>{
 const s=createLifecycleState(),e=s.events[id];assert.equal(decisionStage(e),'初始信息决策')
 const t=assign(s);t.draft.records[0].result=t.steps[0].options[0];t.draft.records[0].note='秘密备注';t.draft.updatedAt=new Date().toISOString()
 const items=processingWorkItems([e]);assert.equal(items.length,1);assert.equal(items[0].taskId,t.id)
 const details=workbenchDetails(e,items[0]).join(' ');assert.match(details,/李建国/);assert.match(details,/1 \/ .*项已填写 · 尚未提交/);assert.doesNotMatch(details,/秘密备注/)
 submit(s,t);assert.equal(processingWorkItems([e]).length,0);assert.equal(decisionStage(e),'排查后决策')
 assert.match(workbenchDetails(e,{kind:'decision'}).join(' '),/已回交排查报告/)
 t.kind='repair';assert.equal(decisionStage(e),'维修后决策')
})
test('Ongoing observation appears in processing, then moves to observation decision when returned',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);submit(s,t);const obs=createObservationEvent(s,e,t,{reason:'继续观察'})
 assert.deepEqual(processingWorkItems([e,obs]).map(i=>i.eventId),[obs.id]);assert.equal(decisionStage(obs),'效果观察中')
 assert.match(workbenchDetails(obs,{kind:'observation'}).join(' '),/系统持续观测.*计划汇报/)
 Object.assign(obs.phases.at(-1),{observationWaiting:false,observationReview:true});assert.equal(processingWorkItems([e,obs]).length,0);assert.equal(decisionStage(obs),'效果观察后决策')
})


test('Shore report integrates formal facts and additions into one account without pasting source documents',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);submit(s,t)
 const report=e.reports[0];report.markdown+="\n\n独立报告内部导航，不应拼入上报正文";report.analysisMarkdown='### AI分析（原因与措施判断）\n\n需核对活塞动作与反馈是否一致。\n\n### 尚不能确认与未执行事项\n\n液压读数尚未复核。\n\n### AI后续建议\n\n取得复核读数后再安排。'
 decide(s,id,{...shore,shoreSituation:{situation:'主机保持监测',actions:'已通知值班人员',uncertainty:'待核实执行压力',support:'请岸基提供同型机记录'}})
 const r=e.shore[0].syncedReport,body=r.markdown
 assert.equal(body.match(/^# /gm).length,1)
 assert.doesNotMatch(body,/附录|独立报告内部导航|本次人工补充|尚未发送|本地保存/)
 for(const phrase of ['正式现场事实','完成本轮排查','主机保持监测','已通知值班人员','待核实执行压力','请岸基提供同型机记录','液压读数尚未复核','取得复核读数后再安排'])assert.ok(body.includes(phrase),phrase)
 assert.match(r.includedReports[0].markdown,/独立报告内部导航/)
 assert.ok(body.indexOf('安排'+people.engineer)<body.indexOf('回交排查结果'))
})

test('Old full packets gain an integrated view using only their frozen facts',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);submit(s,t);decide(s,id,shore)
 const record=e.shore[0];delete record.syncedReport.presentationVersion;record.syncedReport.markdown='旧拼接正文';const original=JSON.stringify(record)
 e.brief.conclusion='后来的事件判断';e.reports[0].summary='后来的报告结论';t.records[0].note='后来的现场修改'
 const shown=shoreReportPresentation(record)
 assert.match(shown.markdown,/正式现场事实/);assert.doesNotMatch(shown.markdown,/后来的|旧拼接正文/)
 assert.equal(JSON.stringify(record),original)
 assert.equal(shoreReportEntries(s)[0].markdown,shown.markdown)
})

test('Resolved findings remain in the history, not in the current unresolved section',async()=>{
 const {composeShoreNarrative}=await import('../src/workflow/shoreReportNarrative.js')
 const event={id:'e',number:'E1',title:'压力复核',device:'主机',type:'预警事件',createdAt:'2026-11-03T00:00:00Z',status:'待决策',phase:'decision',brief:{conclusion:'压力偏低'},tasks:[]}
 const record={label:'读取压力',result:'未完成',note:'现场条件暂不具备',executionStatus:'未完成'}
 const first={id:'r1',taskId:'t',kind:'排查报告',at:'2026-11-03T01:00:00Z',submissionSnapshot:{kind:'investigation',records:[record],summary:'待条件具备'},summary:'待条件具备'}
 const second={...first,id:'r2',at:'2026-11-03T02:00:00Z',submissionNumber:2,submissionSnapshot:{kind:'investigation',records:[{...record,result:'未见异常',note:'已完成表计核实',executionStatus:'已完成'}],summary:'完成复核'},summary:'完成复核'}
 const body=composeShoreNarrative({events:[event],includedReports:[second,first],eventId:'e'})
 assert.match(body,/现场条件暂不具备/);assert.match(body,/已完成表计核实/)
 assert.doesNotMatch(body.split('## 当前判断与待解决事项')[1],/现场条件暂不具备|读取压力：未完成/)
})
