import test from 'node:test'
import assert from 'node:assert/strict'
import {sortIssues,filterIssueRows,issueBatch,captainDeviceSignal} from '../src/mock/captainWorkbench.js'
const rows=[
{id:'main-drift',deviceId:'main-engine-1',rank:2,type:'异动跟踪',state:'待决策'},
{id:'air-warning',deviceId:'air-compressor',rank:1,type:'预警事件',state:'待决策'},
{id:'main-warning',deviceId:'main-engine-1',rank:1,type:'预警事件',state:'待决策'},
{id:'steering-alarm',deviceId:'steering-gear',rank:0,type:'报警事件',state:'已派发'},
{id:'main-alarm',deviceId:'main-engine-1',rank:0,type:'报警事件',state:'待决策'},
{id:'main-maintenance',deviceId:'main-engine-1',rank:3,type:'维保建议',state:'待决策'},
{id:'air-drift',deviceId:'air-compressor',rank:2,type:'异动跟踪',state:'待决策'}]
test('type precedes device influence; overview dispatch groups precede type',()=>{
assert.deepEqual(sortIssues(rows).map(i=>i.id),['main-alarm','steering-alarm','main-warning','air-warning','main-drift','air-drift','main-maintenance'])
assert.equal(sortIssues(rows,{stateFirst:true}).at(-1).id,'steering-alarm')
assert.equal(rows[0].id,'main-drift','source order is not mutated')
})
test('overview filters intersect and exclude archived or ignored records',()=>{
const all=[...rows,{id:'closed',deviceId:'main-engine-1',rank:0,state:'已闭环'}, {id:'ignored',deviceId:'main-engine-1',rank:2,state:'已记录决定'}]
assert.equal(filterIssueRows(all).length,7)
assert.deepEqual(filterIssueRows(all,{device:'air-compressor',type:'预警事件',state:'待决策'}).map(i=>i.id),['air-warning'])
assert.equal(filterIssueRows(all,{device:'air-compressor',state:'已派发'}).length,0)
})
test('batch boundaries show ten, twenty, then remaining rows without duplication',()=>{
const many=Array.from({length:25},(_,id)=>({id}))
assert.equal(issueBatch(many).length,10);assert.equal(issueBatch(many,2).length,20);assert.equal(issueBatch(many,3).length,25)
assert.equal(new Set(issueBatch(many,3).map(i=>i.id)).size,25)
})
test('dispatch does not turn low-severity issues red; closure removes the signal',()=>{
const store={todoCreated:{'aux-health':true},ignoredSuggestions:{},assignments:{},cases:{},progress:{},eventStatus:{}}
assert.equal(captainDeviceSignal(store,'aux-engine-2'),'warning')
assert.equal(captainDeviceSignal(store,'main-engine-1'),'danger')
store.eventStatus['aux-health']='closed';assert.equal(captainDeviceSignal(store,'aux-engine-2'),'normal')
assert.equal(captainDeviceSignal(store,'boiler'),'normal')
})
