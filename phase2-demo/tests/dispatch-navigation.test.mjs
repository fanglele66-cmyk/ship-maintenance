import test from 'node:test'
import assert from 'node:assert/strict'
import {dispatchReturnLocation} from '../src/mock/dispatchNavigation.js'
test('new dispatch returns to the captain workbench, never automatically to tasks',()=>{
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/fault',query:{from:'workbench'}}),{path:'/situation'})
})
test('overview dispatch returns with all original filter conditions and resume context',()=>{
 const route={path:'/situation/issue/drift',query:{from:'issues',state:'待决策',device:'main-engine-1',type:'异动跟踪'}}
 assert.deepEqual(dispatchReturnLocation(route),{path:'/situation/issues',query:{resume:'1',state:'待决策',device:'main-engine-1',type:'异动跟踪'}})
 assert.equal(route.query.from,'issues')
})
test('device-origin dispatch returns to situation; non-situation views retain context',()=>{
 assert.deepEqual(dispatchReturnLocation({path:'/situation/maintenance/maintenance',query:{}}),{path:'/situation'})
 assert.deepEqual(dispatchReturnLocation({path:'/event',query:{todo:'fault'}}),{path:'/event',query:{todo:'fault'}})
})
test('real matters use the same dispatch return as other situation matters',()=>{
 const scenario='real-alarm-0430'
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/'+scenario,query:{from:'workbench'}},scenario),{path:'/situation'})
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/'+scenario,query:{from:'issues',type:'报警事件'}},scenario),{path:'/situation/issues',query:{resume:'1',state:'',device:'',type:'报警事件'}})
 assert.deepEqual(dispatchReturnLocation({path:'/situation/issue/fault',query:{}},'fault'),{path:'/situation'})
})
