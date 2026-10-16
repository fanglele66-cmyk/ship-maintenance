import test from 'node:test'
import assert from 'node:assert/strict'
import {todoBrief} from '../src/mock/captainAssessments.js'

function fixture(){
 const tasks=[
  {id:'new-alarm',initialTitle:'辅机温度报警',device:'辅机',owner:'王海涛',cardType:'报警事件',stages:[{id:'check',kind:'check',label:'排查',title:'核实温度'}]},
  {id:'new-drift',initialTitle:'主机状态检查',device:'主机',owner:'李建国',cardType:'异动跟踪',stages:[{id:'check',kind:'check',label:'检查',title:'核实排温'}]}
 ]
 return {taskPortfolio:tasks,progress:{'new-alarm':0,'new-drift':0},logs:{'new-alarm':[],'new-drift':[]},assignments:{},assignmentRecords:{},executionRecords:{},isTaskHandled:()=>false}
}
test('brief uses exactly the visible portfolio including empty filter results',()=>{
 const s=fixture(),r=todoBrief(s,{portfolio:[s.taskPortfolio[1]]})
 assert.deepEqual(r.priority.map(t=>t.id),['new-drift'])
 assert.doesNotMatch(r.markdown,/辅机温度报警/)
 assert.match(todoBrief(s,{portfolio:[]}).markdown,/当前筛选范围内没有待办/)
})
test('unreported task is not a bottleneck and ordinary chat does not change the summary',()=>{
 const s=fixture(),before=todoBrief(s).markdown
 assert.equal(todoBrief(s).coordination.length,0)
 assert.doesNotMatch(before,/### 需要你协调或确认/)
 s.logs['new-alarm'].push({role:'user',text:'看看当前情况',at:'10:00'})
 assert.equal(todoBrief(s).markdown,before)
})
test('unknown alarm IDs rank by business type, not a fixed scenario ID order',()=>{
 const s=fixture();s.taskPortfolio.reverse()
 assert.equal(todoBrief(s).priority[0].id,'new-alarm')
})
test('current unresolved feedback is surfaced but historical feedback is not a new blocker',()=>{
 const s=fixture()
 s.logs['new-drift'].push({kind:'feedbackRecord',title:'检查反馈已提交',task:'核实排温',submittedAt:'2026/10/14 10:00',submissionMessage:'尚需补充测量结果'})
 assert.equal(todoBrief(s).coordination.length,1)
 assert.match(todoBrief(s).markdown,/尚需补充测量结果/)
 s.taskPortfolio[1].stages.push({id:'work',kind:'work',label:'维修',title:'按方案维修'})
 s.progress['new-drift']=1
 assert.equal(todoBrief(s).coordination.length,0)
})
test('only actual incomplete execution or missing owner asks for coordination',()=>{
 const s=fixture();s.taskPortfolio[0].owner=''
 s.executionRecords['new-drift']=[{stageId:'check',confirmedAt:'2026/10/14 11:00',values:{completion:'partial'}}]
 assert.equal(todoBrief(s).coordination.length,2)
 assert.match(todoBrief(s).markdown,/尚未登记负责人/)
 assert.match(todoBrief(s).markdown,/未完成的执行记录/)
})
test('recent progress uses recorded dates and respects filters, not fabricated updates',()=>{
 const s=fixture()
 s.assignmentRecords['new-alarm']=[{owner:'王海涛',scope:'核实读数',at:'2026/10/14 09:00'}]
 s.logs['new-drift'].push({kind:'feedbackRecord',title:'检查反馈已提交',task:'核实排温',submittedAt:'2026/10/14 10:00'})
 assert.equal(todoBrief(s).recent[0].id,'new-drift')
 assert.deepEqual(todoBrief(s,{portfolio:[s.taskPortfolio[0]]}).recent.map(r=>r.id),['new-alarm'])
})
