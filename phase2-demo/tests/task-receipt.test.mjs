import test from 'node:test'
import assert from 'node:assert/strict'
import {taskReceipt} from '../src/message-flows/taskReceipt.js'
import {resolveMessageFlow} from '../src/message-flows/resolveMessageFlow.js'
import {r02InitialMessage} from '../src/mock/r02Stories.js'
test('task receipt is an execution snapshot and supports incomplete outcomes',()=>{
 const store={todoCreated:{},attentionFeedback:{}}
 const initial=structuredClone(r02InitialMessage(store,'drift'))
 store.todoCreated.drift=true;store.attentionFeedback.drift={reading:432}
 assert.deepEqual(r02InitialMessage(store,'drift'),initial)
 assert.equal(initial.type,'taskReceipt');assert.equal(initial.requiresAction,true)
 assert.equal(r02InitialMessage(store,'cyl4-watch').requiresAction,false)
 assert.throws(()=>taskReceipt({...initial,executionStatus:'partial',dataLimit:''}),/limitation/)
 const partial=taskReceipt({...initial,executionStatus:'partial',dataLimit:'负荷数据缺失，未更新缸间比较'})
 const failed=taskReceipt({...initial,executionStatus:'failed',conclusion:'本次分析未完成',dataLimit:'数据源不可用，保留上次结论'})
 assert.equal(partial.executionStatus,'partial');assert.equal(failed.executionStatus,'failed')
 assert.equal(resolveMessageFlow({version:1,messages:[{id:'receipt',type:'taskReceipt',content:partial}]},{})[0].runId,initial.runId)
 assert.throws(()=>taskReceipt({...initial,runId:''}),/runId/)
})
