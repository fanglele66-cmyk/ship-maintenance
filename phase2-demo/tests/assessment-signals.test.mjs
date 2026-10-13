import test from 'node:test'
import assert from 'node:assert/strict'
import {deviceSignal,todoBrief} from '../src/mock/captainAssessments.js'
const fixture=()=>{
 const tasks=[{id:'fault',stages:[{kind:'check'},{kind:'work'}]},{id:'aux',deviceId:'aux-engine-2',stages:[{kind:'check'}]}]
 const done=new Set()
 return {visibleTodos:tasks,taskPortfolio:tasks,done,isTaskHandled:id=>done.has(id),todoCreated:{drift:false,maintenance:false},ignoredSuggestions:{},progress:{fault:0,aux:0},logs:{fault:[],aux:[]}}
}
test('signal follows active tasks, then decisions, then green; static status is irrelevant',()=>{
 const s=fixture()
 assert.equal(deviceSignal(s,'main-engine-1'),'danger')
 assert.equal(deviceSignal(s,'aux-engine-2'),'danger')
 assert.equal(deviceSignal(s,'air-compressor'),'warning')
 s.done.add('fault');assert.equal(deviceSignal(s,'main-engine-1'),'warning')
 s.ignoredSuggestions.drift=true;s.ignoredSuggestions.maintenance=true
 assert.equal(deviceSignal(s,'main-engine-1'),'normal')
 s.done.delete('fault');assert.equal(deviceSignal(s,'main-engine-1'),'danger')
 s.done.add('aux');assert.equal(deviceSignal(s,'aux-engine-2'),'normal')
})
test('overview counts waiting, progressing and handled without double counting',()=>{
 const s=fixture()
 assert.match(todoBrief(s).overview,/2 项待跟进，0 项进度推进中，0 项已处理/)
 s.progress.fault=1
 assert.match(todoBrief(s).overview,/1 项待跟进，1 项进度推进中，0 项已处理/)
 s.done.add('fault')
 assert.match(todoBrief(s).overview,/1 项待跟进，0 项进度推进中，1 项已处理/)
 s.done.add('aux')
 assert.match(todoBrief(s).overview,/0 项待跟进，0 项进度推进中，2 项已处理/)
})
