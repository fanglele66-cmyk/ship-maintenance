import test from 'node:test'
import assert from 'node:assert/strict'
import {auth,pruneDeletedEvents} from '../src/services/auth.js'
import {createLifecycleState,refreshLifecyclePresentation} from '../src/workflow/eventLifecycle.js'
import {loadLifecycleState,lifecycleSnapshot} from '../src/workflow/demoTimeline.js'
import {healthModelFacts,validateHealthLanguage} from '../server/health-scheduler.mjs'

test('deleted seeds stay removed without resetting remaining manual events on reload',()=>{
 const state=createLifecycleState(),id='real-alarm-0430'
 state.events['manual-kept']={...structuredClone(state.events[id]),id:'manual-kept'}
 state.events['observation-deleted']={...structuredClone(state.events[id]),id:'observation-deleted',parentEventId:id}
 auth.deletedIds=[id];pruneDeletedEvents(state)
 assert(!state.events[id]);assert(!state.events['observation-deleted']);assert(state.events['manual-kept'])
 let json=lifecycleSnapshot(state)
 const loaded=loadLifecycleState({getItem:()=>json,setItem:(key,value)=>json=value},()=>{throw Error('Must not regenerate seeds')})
 refreshLifecyclePresentation(loaded);pruneDeletedEvents(loaded)
 assert(!loaded.events[id]);assert(loaded.events['manual-kept'])
 // Even a new browser workspace respects server tombstones.
 const fresh=createLifecycleState();pruneDeletedEvents(fresh);assert(!fresh.events[id])
 auth.deletedIds=[]
})

test('model context omits zero-event scaffolding and source provenance',()=>{
 const facts={result:{devices:{main:{device_name:'主机',event_count:0,status:'stopped',context:'当前转速 0 RPM。'}},overview:{warning_count:0}},coverage:{start:'start',end:'end',rows:1800,maximumGapSeconds:12,sourceSeams:['hidden'],sourceStart:'hidden'},units:{压力:'MPa'}}
 const model=healthModelFacts(facts),text=JSON.stringify(model)
 assert(!/event_count|warning_count|sourceSeams|sourceStart/.test(text))
 assert.equal(model.window.rows,1800);assert.equal(model.devices.main.context,'当前转速 0 RPM。')
 assert.doesNotThrow(()=>validateHealthLanguage({conclusion:'主机停机，转速 0 RPM。',next:'继续记录当前工况。',detail:'## 运行信息'}))
 for(const text of ['回放数据连续','数据局限','无报警','具备下次起动条件'])assert.throws(()=>validateHealthLanguage({conclusion:text}))
})
