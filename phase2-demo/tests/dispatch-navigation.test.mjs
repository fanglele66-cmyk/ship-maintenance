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
test('device-origin dispatch returns to the retained device layer; other views do not redirect',()=>{
 assert.deepEqual(dispatchReturnLocation({path:'/situation/maintenance/maintenance',query:{}}),{path:'/situation'})
 assert.deepEqual(dispatchReturnLocation({path:'/event',query:{todo:'fault'}}),{path:'/event',query:{todo:'fault'}})
})
