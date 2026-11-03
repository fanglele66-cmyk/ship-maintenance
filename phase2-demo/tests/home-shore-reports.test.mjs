import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,people,ensureTaskPlan,currentTask,submitTask,pendingDecision} from '../src/workflow/eventLifecycle.js'
import {shoreReportBasis,shoreReportEntries} from '../src/workflow/shoreReports.js'
import {createObservationEvent} from '../src/workflow/observationEvents.js'
import {decisionStage,processingWorkItems,workbenchDetails} from '../src/workflow/workbenchDetails.js'
const id='real-alarm-0430',future=()=>new Date(Date.now()+3600000).toISOString()
function assign(s){const e=s.events[id];s.role='captain';e.decisionDraft={action:'investigate'};ensureTaskPlan(e).status='ready';decide(s,id,{action:'investigate',owner:people.engineer,deadline:future()});return currentTask(e)}
function submit(s,t){s.role='engineer';t.draft.records.forEach((r,i)=>{r.result=t.steps[i].options[0];r.note='正式现场事实';r.executionStatus='已完成'});t.draft.summary='完成本轮排查';submitTask(s,id,t.id);s.role='captain'}
const shore={action:'shore',shoreIncludeHistory:true,shoreSituation:{situation:'',actions:'',uncertainty:'',support:''}}

test('Initial shore report has event basis, permits blank additions, and preserves pending decision',()=>{
 const s=createLifecycleState(),e=s.events[id],before=e.phase;decide(s,id,shore)
 assert.equal(e.phase,before);assert.equal(pendingDecision(e),true);assert.equal(e.reports.length,0)
 const r=e.shore[0];assert.equal(r.status,'本地保存，未发送');assert.match(r.syncedReport.markdown,new RegExp(e.title));assert.equal(r.syncedReport.includedReports.length,0)
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
 assert.match(record.syncedReport.markdown,/正式现场事实/);assert.match(record.syncedReport.markdown,/观察正文/);assert.match(record.syncedReport.markdown,/闭环正文/)
 assert.doesNotMatch(saved,/新草稿秘密|交付后的私有草稿|四缸排温/)
 e.reports[0].markdown='新的 AI 内容';obs.reports.push({id:'later-report',markdown:'后来报告'});t.records[0].note='后来修订'
 assert.equal(JSON.stringify(record),saved)
 assert.equal(shoreReportBasis(obs,s).includedReports.length,4)
})
test('Shore basis retains formal report while AI generation is failed or still running',()=>{
 const s=createLifecycleState(),e=s.events[id],t=assign(s);submit(s,t)
 t.status='report-error';t.reportGeneration={factReportId:e.reports[0].id,status:'error'}
 assert.match(shoreReportBasis(e,s).markdown,/AI 分析生成失败，现场报告已提交/)
 t.status='reporting';assert.match(shoreReportBasis(e,s).markdown,/AI 分析生成中，现场报告已提交/)
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
