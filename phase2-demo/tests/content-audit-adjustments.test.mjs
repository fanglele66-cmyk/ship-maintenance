import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {knowledgeDocs,DOC_TYPE_STATS} from '../src/mock/knowledge.js'
import {maintenancePortCalls,availableMaintenanceWindows} from '../src/workflow/maintenancePlans.js'
import {createLifecycleState} from '../src/workflow/eventLifecycle.js'
import {taskRecommendation} from '../src/workflow/contentRecommendations.js'
import {generatedAnalysis} from '../src/workflow/generatedReport.js'
import {reportMarkdown} from '../src/workflow/reportPresentation.js'
import {finishObservation} from '../src/workflow/observationReports.js'

test('all imported knowledge pages retain their source bytes, unique bodies and valid local links',async()=>{
 assert.equal(knowledgeDocs.length,61)
 assert.equal(DOC_TYPE_STATS['全部类型'],61)
 assert.equal(new Set(knowledgeDocs.map(d=>d.chapterHTML)).size,61)
 const ids=new Set(knowledgeDocs.map(d=>d.id)),images=new Set()
 for(const doc of knowledgeDocs){
  const original=await readFile(new URL('../'+doc.sourcePath,import.meta.url)),published=await readFile(new URL('../public/'+doc.sourcePath,import.meta.url))
  assert.equal(createHash('sha256').update(original).digest('hex'),doc.sha256,doc.title)
  assert.deepEqual(published,original,doc.title)
  assert.equal(doc.device,'主机');assert.equal(doc.sourceKind,'wiki-source')
  for(const [,id] of doc.chapterHTML.matchAll(/href="\/#\/knowledge\?doc=([^"]+)"/g))assert.ok(ids.has(id),doc.title+' → '+id)
  for(const [,url] of doc.chapterHTML.matchAll(/<img src="([^"]+)"/g)){images.add(url);await access(new URL('../public'+decodeURI(url),import.meta.url))}
 }
 assert.equal(images.size,190)
})

test('formal maintenance windows are available in January and February 2027',()=>{
 assert.equal(maintenancePortCalls.length,2)
 assert.ok(maintenancePortCalls[0].start.startsWith('2027-01-'))
 assert.ok(maintenancePortCalls[1].start.startsWith('2027-02-'))
 assert.equal(availableMaintenanceWindows(Date.parse('2026-11-04T00:00:00+08:00')).length,2)
 assert.equal(availableMaintenanceWindows(Date.parse('2027-03-01T00:00:00+08:00')).length,0)
})

test('initial and C4 follow-up advice select a specific action without decision menus',()=>{
 const state=createLifecycleState(),c4=state.events['real-health-c4-baseline']
 for(const event of Object.values(state.events)){
  for(const message of event.conversations.captain.filter(m=>m.kind==='advice'))assert.doesNotMatch(message.analysis+message.recommendation,/也可|可选择|或闭环|或明确范围/)
 }
 const advice=taskRecommendation(c4,c4.tasks.at(-1))
 assert.match(advice.next,/四缸独立测温/);assert.match(advice.next,/5—6月/)
 const unknown={kind:'investigation',records:[{label:'反馈检查',result:'发现异常',note:''}],summary:'检查发现异常'}
 assert.match(taskRecommendation(state.events['real-alarm-0430'],unknown).next,/补齐异常部位与检查读数/)
 assert.doesNotMatch(taskRecommendation(state.events['real-alarm-0430'],unknown).next,/换装|换件|维修/)
 unknown.records[0].note='结果异常，需要现场核查'
 assert.match(taskRecommendation(state.events['real-alarm-0430'],unknown).next,/补齐异常部位与检查读数/)
 unknown.records[0].note='二缸 ICU 液压活塞动作卡滞，插接件检查未见异常'
 assert.match(taskRecommendation(state.events['real-alarm-0430'],unknown).next,/二缸ICU卡滞部位/)
})

test('generated and legacy report presentations share headings and retain raw facts unchanged',()=>{
 const patch={summary:'两项检查已回交',analysis:{evidence:'重复的现场记录',interpretation:'动作与反馈不对应',unverified:'未执行项目：无。',next:'复测流量活塞反馈'}}
 const markdown=generatedAnalysis(patch)
 assert.match(markdown,/### AI分析（原因与措施判断）/);assert.match(markdown,/### 未执行与待核实事项/);assert.match(markdown,/### AI建议/)
 assert.doesNotMatch(markdown,/重复的现场记录|现场记录摘要/)
 const report={markdown:'# 排查报告\n\n## 现场事实（执行人原始记录）\n\n独立表计0.61 MPa，12:01记录。\n\n### 证据与范围核对\n\n重复的现场记录\n\n### 建议处置\n\n复测流量活塞反馈'}
 const before=JSON.stringify(report),display=reportMarkdown(report)
 assert.equal(JSON.stringify(report),before);assert.match(display,/独立表计0.61 MPa，12:01记录/);assert.doesNotMatch(display,/重复的现场记录/);assert.match(display,/### AI建议/)
})

test('observation handoff gives recorded values without calling ineligible conditions comparable',()=>{
 const event=createLifecycleState().events['real-alarm-0430'],at='2026-11-04T01:00:00.000Z',end='2026-11-04T03:00:00.000Z'
 const channels=[{name:'二缸排温',value:300,unit:'℃',covered:true,sampleCount:12,lastAt:end},{name:'其余五缸均温',value:400,unit:'℃',covered:true,sampleCount:12,lastAt:end}]
 const task={id:'work',kind:'repair',status:'submitted',submittedAt:at,observationStartedAt:at,records:[{label:'处理',result:'已完成'}],summary:'记录已回交',observation:{checkedAt:end,currentSourceAvailable:true,records:[{windowStart:at,windowEnd:end,channels,sampleCount:24,covered:true,complete:true}],conditions:{eligible:false,reason:'本轮缺少运行负荷记录。'}}}
 event.tasks.push(task);event.currentTask=task.id
 const phase={id:'review-test',at,observationTaskId:task.id,observationWaiting:true,observationDueAt:end};event.phases.push(phase)
 finishObservation(event,phase,Date.parse(end))
 const report=event.reports.at(-1)
 assert.match(report.summary,/1个观察窗口/);assert.match(report.summary,/二缸排温 300 ℃/);assert.match(report.summary,/缺少适用工况证据/)
 assert.doesNotMatch(report.summary,/可比工况仍|推荐闭环/);assert.match(report.responsibility,/补齐适用工况/);assert.ok(report.responsibility.length<=55)
 assert.equal(task.records[0].result,'已完成');assert.equal(event.status,'待决策')
})
