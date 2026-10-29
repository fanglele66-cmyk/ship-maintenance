import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,submitTask,currentTask,decisionOptions,visibleEvents,people,proposedPlan,refreshLifecyclePresentation,ensureTaskPlan} from '../src/workflow/eventLifecycle.js'
import {acceptTaskPlan} from '../src/workflow/taskPlanning.js'
import {adviceDetails} from '../src/workflow/lifecycleAnalysis.js'
import {navigationChronology} from '../src/workflow/navigationChronology.js'
import {syncLifecycleObservations} from '../src/workflow/lifecycleObservation.js'
const alarm='real-alarm-0430',warning='real-warning-0523',tracking='real-tracking-exhaust-baseline',c4='real-health-c4-baseline'
const deadline=()=>new Date(Date.now()+86400000).toISOString().slice(0,16)
function assign(state,id,action='investigate'){state.role='captain';const draft=ensureTaskPlan(state.events[id]);if(draft?.status==='pending')acceptTaskPlan(state.events[id],{key:draft.key,version:draft.version},{plan:{scope:'依据上一轮结果核对剩余疑点。',rationale:'已排除原检查方向，改用独立检查方法。',steps:[{label:'独立核对剩余疑点',guide:'结合上一轮记录进行独立测量与时序核对。',checks:['记录同刻读数并交叉核实。'],recordHint:'回交测量方法和实际发现。'}]}});decide(state,id,{action,owner:people.engineer,deadline:deadline(),reason:'检查已确认的异常部位并记录实际发现',order:'CBY-WO-2026-1028-01',window:'宁波靠港 08:00—14:00'})}
function finish(state,id,normal=false){state.role='engineer';const task=currentTask(state.events[id]);task.draft.records.forEach((r,i)=>r.result=task.steps[i].options.find(o=>(normal?/未见异常|现场与系统一致|工况变化可以解释|信息已记录/:/发现异常|读数不一致|偏离仍存在/).test(o))||task.steps[i].options[0]);task.draft.summary=task.kind==='investigation'?'减压阀密封垫破损，检查照片及阀组记录已保存。':'已更换获批密封垫，恢复供气后复测稳定；剩余事项已记录。';return submitTask(state,id)}
test('investigation report stops at captain gate and repair report stops at next gate',()=>{const s=createLifecycleState();assign(s,warning);const e=s.events[warning],first=currentTask(e);finish(s,warning);assert.equal(e.phase,'decision');assert.equal(e.tasks.length,1);assert.equal(first.status,'submitted');assert.match(e.reports.at(-1).markdown,/密封垫破损/);assert.throws(()=>decide(s,warning,{action:'repair'}),/轮机长/);assign(s,warning,'repair');assert.equal(e.phase,'repair');assert.equal(currentTask(e).sourceReportId,e.reports[0].id);assert.ok(proposedPlan(e).flatMap(t=>t.substeps||[t]).some(t=>/减压阀/.test(t.label)));finish(s,warning);assert.equal(e.phase,'review');assert.equal(e.reports.at(-1).kind,'维修报告');s.role='captain';decide(s,warning,{action:'close',reason:'复测稳定，设备安全不受影响，后续保持常规监测。'});assert.equal(e.phase,'closed');assert.equal(e.reports.at(-1).kind,'闭环报告');assert.equal(e.tasks.length,2)})
test('repeat investigation preserves earlier reports and does not duplicate submit',()=>{const s=createLifecycleState();assign(s,alarm);finish(s,alarm,true);const old=structuredClone(s.events[alarm].reports[0]);assert.throws(()=>submitTask(s,alarm),/已提交/);assign(s,alarm);assert.equal(currentTask(s.events[alarm]).round,2);assert.equal(currentTask(s.events[alarm]).draft.summary,'');assert.deepEqual(s.events[alarm].reports[0],old);assert.equal(s.events[alarm].conversations.captain.filter(m=>m.kind==='receipt').length,1)})
test('tracking uses findings-based decisions and retains historical C4 process',()=>{const s=createLifecycleState();assert.equal(s.events[c4].phase,'decision');assert.equal(s.events[c4].reports[0].kind,'排查报告');assert.ok(s.events[c4].conversations.captain.some(m=>m.text.includes('派发排查')));assign(s,tracking);finish(s,tracking);s.role='captain';assert.deepEqual(decisionOptions(s.events[tracking]).map(o=>o.value),['repair','shore']);assert.throws(()=>assign(s,tracking,'investigate'),/当前阶段/);assign(s,tracking,'repair');finish(s,tracking);assert.equal(s.events[tracking].reports.at(-1).kind,'维修报告')})
test('role scoped visibility, notices, optional notes and validation',()=>{const s=createLifecycleState();s.role='engineer';assert.deepEqual(visibleEvents(s).map(e=>e.id),[c4]);assert.throws(()=>submitTask(s,alarm),/已提交|不属于/);assign(s,alarm);assert.equal(s.events[alarm].unread.engineer,true);s.role='engineer';assert.equal(visibleEvents(s).length,2);assert.throws(()=>submitTask(s,alarm),/每个步骤/);finish(s,alarm);assert.equal(s.events[alarm].unread.captain,true);assert.equal(currentTask(s.events[alarm]).records[0].note,'');s.role='captain';assert.throws(()=>decide(s,alarm,{action:'repair',reason:'维修',owner:people.engineer,deadline:'2020-01-01'}),/完成时间/);assert.throws(()=>decide(s,alarm,{action:'repair',reason:''}),/依据/)})
test('shore is an audited pending handoff, not a silent closure',()=>{const s=createLifecycleState();assign(s,alarm);s.role='captain';decide(s,alarm,{action:'shore',reason:'请岸端提供 ICU 适配备件资料。'});assert.equal(s.events[alarm].phase,'investigation');assert.equal(s.events[alarm].shore[0].status,'待岸基接收');assert.throws(()=>assign(s,alarm),/当前阶段/)})
test('notifications route each handoff to the receiving role',()=>{const s=createLifecycleState();assign(s,alarm);assert.equal(s.notices.length,1);assert.equal(s.notices[0].recipient,'engineer');assert.equal(s.notices[0].eventId,alarm);finish(s,alarm);assert.equal(s.notices.length,2);assert.equal(s.notices[1].recipient,'captain');assert.match(s.notices[1].title,/排查报告/);const ids=s.notices.map(n=>n.id);assert.equal(new Set(ids).size,2)})
test('24h AIS chronology follows unequal state boundaries and contains operations only',()=>{const end=Date.now(),s={allSensors:[{id:'aux',deviceId:'aux-engine-1',unit:'rpm'}],getSimulationTrend:id=>[{value:id==='s-012'?94:id==='main-load'?70:id==='ship-speed'?10:750}]};const r=navigationChronology(s,end);assert.equal(r.end-r.start,86400000);assert.equal(r.periods.length,6);assert.ok(new Set(r.periods.map(p=>p.end-p.start)).size>1);for(let i=1;i<r.periods.length;i++)assert.equal(r.periods[i].start,r.periods[i-1].end);assert.ok(r.periods.some(p=>p.navigation==='锚泊'));assert.ok(r.periods.every(p=>p.position&&p.ais));assert.doesNotMatch(r.markdown,/待决策|风险|报警|预警|异动/)})
test('reports lead with conclusion and analysis, preserve submitted evidence at the bottom',()=>{
 const s=createLifecycleState();assign(s,warning);const report=finish(s,warning),text=report.markdown
 assert.ok(text.indexOf('## 原因判断与排查结论')<text.indexOf('## AI分析'))
 assert.ok(text.indexOf('## AI分析')<text.indexOf('## 现场排查记录'))
 assert.ok(text.indexOf('## 现场排查记录')<text.indexOf('## 附件索引'))
 assert.doesNotMatch(text,/AI报告摘要/);assert.match(report.analysisMarkdown,/减压阀密封缺陷/)
 const before=structuredClone(s.events[warning].tasks[0]),id=report.id
 report.presentationVersion=1;report.markdown='旧版内容'
 refreshLifecyclePresentation(s)
 assert.equal(report.id,id);assert.match(report.markdown,/## AI分析/);assert.deepEqual(s.events[warning].tasks[0],before)
})
test('expandable evidence is case-specific and historical advice cannot see future findings',()=>{
 const s=createLifecycleState(),e=s.events[alarm],initial=e.conversations.captain[0]
 assign(s,alarm);const task=currentTask(e);task.draft.records.forEach((r,i)=>r.result=task.steps[i].options[0]);task.draft.summary='本轮独有现场标记：活塞卡滞';s.role='engineer';submitTask(s,alarm)
 const oldDetails=adviceDetails(e,initial,'captain')
 assert.match(oldDetails,/23:27|SLOW DOWN/);assert.doesNotMatch(oldDetails,/本轮独有现场标记/)
 assert.match(e.conversations.engineer.at(-1).detailsMarkdown,/本轮独有现场标记/)
 assert.match(s.events[warning].conversations.captain[0].detailsMarkdown,/不能用两者之差代替减压阀前后压降/)
 assert.match(s.events[tracking].conversations.captain[0].detailsMarkdown,/月度相对偏差/)
 assert.match(s.events[c4].conversations.captain[0].detailsMarkdown,/绝对排温持续下降/)
})
test('event numbers survive migration and closure reports put findings before source records',()=>{
 const s=createLifecycleState();assert.equal(new Set(Object.values(s.events).map(e=>e.number)).size,4)
 const e=s.events[warning],number=e.number;assign(s,warning);finish(s,warning);assign(s,warning,'repair');finish(s,warning)
 s.role='captain';decide(s,warning,{action:'close',reason:'密封已更换，复测记录确认供气恢复，维持常规监测。'})
 const report=e.reports.at(-1);assert.equal(report.eventNumber,number);assert.match(report.markdown,new RegExp(number));assert.ok(report.markdown.indexOf('## 三、排查过程与原因判断')<report.markdown.indexOf('## 八、过程报告与附件索引'))
 delete e.number;refreshLifecyclePresentation(s);assert.equal(e.number,number)
})
test('two-hour observation preserves real samples and leaves absent channels empty after reload',()=>{
 const s=createLifecycleState();assign(s,warning);finish(s,warning);assign(s,warning,'repair');finish(s,warning)
 const task=currentTask(s.events[warning]),start=Date.parse(task.submittedAt),hour=3600000
 const sensors={recordedSensorChannels:ids=>ids.map((id,i)=>({channelId:id,unit:'MPa',sourceKind:'recorded',trendData:i?[]:[{timestamp:start+60000,value:0.64},{timestamp:start+hour,value:0.65}]}))}
 syncLifecycleObservations(s,sensors,start+hour);assert.equal(task.observation.records.length,0);assert.deepEqual(task.observation.pending.values,[0.65,null])
 const empty={recordedSensorChannels:ids=>ids.map(id=>({channelId:id,unit:'MPa',sourceKind:'recorded',trendData:[]}))}
 syncLifecycleObservations(s,empty,start+2*hour)
 assert.equal(task.observation.records.length,1);assert.deepEqual(task.observation.records[0].values,[0.65,null]);assert.equal(task.observation.records[0].covered,false)
 const snapshot=structuredClone(task.observation.records[0]);syncLifecycleObservations(s,empty,start+4*hour)
 assert.deepEqual(task.observation.records[0],snapshot);assert.deepEqual(task.observation.records[1].values,[null,null])
 task.observationEndedAt=new Date(start+4*hour).toISOString();const frozen=structuredClone(task.observation)
 syncLifecycleObservations(s,sensors,start+8*hour);assert.deepEqual(task.observation,frozen)
})
test('new work and closure finish previous observation without losing its history',()=>{
 const s=createLifecycleState();assign(s,alarm);finish(s,alarm);assign(s,alarm,'repair');finish(s,alarm)
 const previous=currentTask(s.events[alarm]);previous.observation={records:[{id:'saved-window',values:[421,419]}]}
 assign(s,alarm,'recheck');assert.ok(previous.observationEndedAt);assert.deepEqual(previous.observation.records,[{id:'saved-window',values:[421,419]}])
 finish(s,alarm);assign(s,alarm,'repair');finish(s,alarm)
 const current=currentTask(s.events[alarm]);s.role='captain';decide(s,alarm,{action:'close',reason:'按处理和复测记录确认闭环。'});assert.ok(current.observationEndedAt)
})
