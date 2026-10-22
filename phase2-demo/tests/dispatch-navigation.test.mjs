import test from 'node:test'
import assert from 'node:assert/strict'
import {dispatchReturnLocation,issueDirectoryLocation} from '../src/mock/dispatchNavigation.js'
test('new dispatch returns to the captain workbench, never automatically to tasks',()=>{
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/fault',query:{from:'workbench'}}),{path:'/situation'})
})
test('overview dispatch returns with all original filter conditions and resume context',()=>{
 const route={path:'/situation/issue/drift',query:{from:'issues',state:'待决策',device:'main-engine-1',type:'异动跟踪'}}
 assert.deepEqual(dispatchReturnLocation(route),{path:'/issues',query:{resume:'1',device:'main-engine-1',type:'异动跟踪',status:'待决策'}})
 assert.equal(route.query.from,'issues')
})
test('device-origin dispatch returns to situation; non-situation views retain context',()=>{
 assert.deepEqual(dispatchReturnLocation({path:'/situation/maintenance/maintenance',query:{}}),{path:'/situation'})
 assert.deepEqual(dispatchReturnLocation({path:'/event',query:{todo:'fault'}}),{path:'/event',query:{todo:'fault'}})
})
test('real matters use the same dispatch return as other situation matters',()=>{
 const scenario='real-alarm-0430'
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/'+scenario,query:{from:'workbench'}},scenario),{path:'/situation'})
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/'+scenario,query:{from:'issues',type:'报警事件'}},scenario),{path:'/issues',query:{resume:'1',device:'',type:'报警事件',status:''}})
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/fault',query:{}},'fault'),{path:'/situation'})
})

test('event directory return preserves independent event status, task progress and device scope',()=>{
 const query={from:'issues',state:'已完成',status:'持续跟踪',device:'aux-system',type:'异动跟踪',scope:'engines',todo:'aux-maintenance'}
 assert.deepEqual(issueDirectoryLocation(query,{resume:true}),{path:'/issues',query:{resume:'1',device:'aux-system',type:'异动跟踪',status:'处置中',scope:'engines'}})
 assert.equal(query.todo,'aux-maintenance','navigation does not mutate the retained task link')
 assert.deepEqual(dispatchReturnLocation({path:'/event',query:{todo:'aux-maintenance'}}),{path:'/event',query:{todo:'aux-maintenance'}})
})
