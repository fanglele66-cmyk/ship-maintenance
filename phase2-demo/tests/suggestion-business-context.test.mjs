import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,currentTask,decisionOptions,refreshLifecyclePresentation,makeReport} from '../src/workflow/eventLifecycle.js'
import {suggestionAction,confirmedTracking,trackingNotSupported} from '../src/workflow/lifecycleDecisions.js'
import {trackingAssessment,reportAnalysis,decisionAnalysisItems,decisionBasis} from '../src/workflow/lifecycleAnalysis.js'
import {planTabLabel} from '../src/workflow/taskPlanning.js'

const c4='real-health-c4-baseline'
function fixture(){const state=createLifecycleState(),event=state.events[c4],task=currentTask(event);return {state,event,task}}

test('initial advice remains available; later suggestions require a selected dispatch action',()=>{
 const {state,event}=fixture(),initial=state.events['real-alarm-0430'],count=event.tasks.length
 assert.equal(suggestionAction(initial),'investigate')
 initial.decisionDraft={action:'false'};assert.equal(suggestionAction(initial),null)
 assert.equal(suggestionAction(event),null)
 event.decisionDraft={action:'investigate'};assert.equal(suggestionAction(event),'investigate')
 for(const action of ['observe','close','shore','repair','']){event.decisionDraft={action};assert.equal(suggestionAction(event),null)}
 assert.equal(event.tasks.length,count)
 // Reload retains a non-dispatch choice, never creating a next task or advice tab.
 event.decisionDraft={action:'observe'}
 const restored=refreshLifecyclePresentation(JSON.parse(JSON.stringify(state)))
 assert.equal(suggestionAction(restored.events[c4]),null)
 assert.equal(restored.events[c4].tasks.length,count)
 event.phase='review';event.decisionDraft={};assert.equal(suggestionAction(event),null)
 event.decisionDraft.action='recheck';assert.equal(suggestionAction(event),'recheck')
 assert.equal(planTabLabel('investigate'),'AI排查建议');assert.equal(planTabLabel('repair'),'AI维修建议')
 assert.equal(planTabLabel('recheck'),'AI复查建议');assert.equal(planTabLabel('maintenance'),'AI维保建议')
})

test('explicit rejection of C4 downshift is distinct from a component defect or an unexplained trend',()=>{
 const {event,task}=fixture()
 task.records=[{label:'测点核对',result:'现场与系统一致',note:''},{label:'背景核实',result:'信息已记录',note:''}]
 task.summary='本轮不认为四缸基线下移；原相对变化由参照缸均值与负荷差异解释。'
 assert.equal(trackingNotSupported(event,task),true);assert.equal(confirmedTracking(event,task),false)
 assert.ok(!decisionOptions(event).some(o=>o.value==='maintenance'))
 const report=makeReport(event,task)
 assert.match(report.analysisMarkdown,/不支持“四缸相对排温基线下移”/)
 assert.doesNotMatch(report.analysisMarkdown,/未登记明确的异常部件|未见异常部件/)
 assert.match(decisionAnalysisItems(event,task,report)[0].text,/不支持/)
 event.reports=[report];assert.match(decisionBasis(event,'close').reason,/参照缸均值/)
 task.summary='四缸基线下移原因未明，需继续核实。'
 assert.equal(trackingNotSupported(event,task),false);assert.equal(confirmedTracking(event,task),true)
 task.summary='尚未确认四缸基线下移，缺少可比工况。'
 assert.equal(trackingNotSupported(event,task),false);assert.equal(confirmedTracking(event,task),false)
 assert.match(trackingAssessment(event,task).scope,/仍需/)
 task.summary='现场记录已回交。';task.records[1].note='核对同工况后，四缸基线下移判断不成立。'
 assert.equal(trackingNotSupported(event,task),true)
})

test('seed tracking analysis discusses baseline evidence; refresh never overwrites model reports or revisions',()=>{
 const {state,event,task}=fixture(),report=event.reports[0]
 assert.match(reportAnalysis(event,task),/四缸相对排温基线下移/)
 report.analysisMarkdown='旧的通用分析';report.presentationVersion=3
 refreshLifecyclePresentation(state)
 assert.equal(report.presentationVersion,5);assert.match(report.analysisMarkdown,/四缸/)
 for(const protectedFields of [{generatedBy:'DeepSeek'},{revisions:[{text:'人工核对的补充'}]},{original:{summary:'旧版本'}}]){
  Object.assign(report,{analysisMarkdown:'须保留的报告内容',presentationVersion:3,...protectedFields})
  refreshLifecyclePresentation(state);assert.equal(report.analysisMarkdown,'须保留的报告内容')
  for(const key of Object.keys(protectedFields))delete report[key]
 }
})
