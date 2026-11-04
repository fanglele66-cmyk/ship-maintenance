import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'
import {currentResponsibility} from '../src/workflow/lifecyclePresentation.js'
import {reportMarkdown} from '../src/workflow/reportPresentation.js'
import {decide} from './helpers/confirmed-decision.mjs'
import {startObservation} from './helpers/observation-fixture.mjs'

test('responsibility stays concise across initial, execution, review and observation states',()=>{
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 const check=e=>{const text=currentResponsibility(e).detail;assert.ok(text.length<=55,text);assert.match(text,/；/);assert.doesNotMatch(text,/\n/);return text}
 for(const e of Object.values(state.events))check(e)
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:'按批准范围排查'})
 assert.match(check(event),/二缸|C2/)
 state.role='engineer';const task=currentTask(event);task.draft.records.forEach(r=>r.result='发现异常');task.draft.summary='现场记录异常，待审阅范围。';submitTask(state,event.id,task.id)
 assert.match(check(event),/排查记录异常/)
 state.role='captain';const observation=startObservation(state,event).event
 assert.match(check(observation),/观察中/);assert.match(check(event),/观察中/)
})

test('report display and download omit duplicated summary while retaining raw evidence and old versions',()=>{
 const report={number:'CBY-EVT-20260430-001-PC-01-02',markdown:'# 二缸报警 · 排查报告\n\n## 现场事实（执行人原始记录）\n\n原始记录不能改\n\n## AI分析与建议（不作为现场事实）\n\n### 现场记录摘要\n\n重复内容\n\n### AI分析（原因与措施判断）\n\n原因尚待核实\n\n### AI后续建议\n\n继续核对'}
 const before=structuredClone(report),text=reportMarkdown(report)
 assert.deepEqual(report,before);assert.match(text,/- 报告编号：CBY-EVT-20260430-001-PC-01-02/)
 assert.match(text,/原始记录不能改/);assert.match(text,/原因尚待核实/);assert.match(text,/### AI建议/)
 assert.doesNotMatch(text,/现场记录摘要|重复内容|不作为现场事实|AI后续建议/)
 assert.equal(reportMarkdown({...report,markdown:text}),text)
})
