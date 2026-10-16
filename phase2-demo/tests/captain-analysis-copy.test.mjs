import test from 'node:test'
import assert from 'node:assert/strict'
import {captainAnalysis,issueCatalog} from '../src/mock/captainWorkbench.js'
const fixture=()=>({todoCreated:{},ignoredSuggestions:{},assignments:{},cases:{},progress:{},eventStatus:{}})
test('initial engine analysis uses the approved two-section copy',()=>{
 const text=captainAnalysis(fixture(),['main-engine-1'])
 assert.ok(text.startsWith(`### 当前重点\n\n主机冷却系统需优先核实：冷却水出口温度越限，同时流量下降。润滑供油也出现油压下降、滤器压差上升，需要分别核实，目前不能归为同一故障。\n\n### 需要你决定\n\n优先评估是否安排冷却系统排查，随后核实润滑供油状态。`))
 const maintenance=issueCatalog.find(i=>i.id==='maintenance')
 if(!maintenance.title.includes('轴承')){assert.doesNotMatch(text,/轴承振动/);assert.ok(text.includes(maintenance.title))}
})
test('dispatch changes the recommendation but does not erase unresolved risk',()=>{
 const s=fixture();s.todoCreated.fault=true;s.todoCreated['main-warning']=true
 const text=captainAnalysis(s,['main-engine-1'])
 assert.match(text,/主机冷却系统已有处理任务/)
 assert.doesNotMatch(text,/优先评估是否安排冷却系统排查/)
 s.isTaskHandled=()=>true
 assert.match(captainAnalysis(s,['main-engine-1']),/仍需结合处理后观测/)
})
test('scope and closure exclude irrelevant claims without declaring the ship healthy',()=>{
 const s=fixture();s.todoCreated.fault=true;s.todoCreated['main-warning']=true;s.eventStatus.fault='closed';s.eventStatus['main-warning']='closed';s.ignoredSuggestions.drift=true;s.ignoredSuggestions.maintenance=true
 for(const item of issueCatalog.filter(i=>i.deviceId==='main-engine-1'&&!['fault','main-warning'].includes(i.id)))s.ignoredSuggestions[item.id]=true
 const text=captainAnalysis(s,['main-engine-1'])
 assert.match(text,/当前没有未闭环事项/)
 assert.doesNotMatch(text,/出口温度越限|全船正常/)
 assert.doesNotMatch(captainAnalysis(fixture(),['aux-engine-1']),/主机冷却|3号缸/)
})
