import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {deviceIssueStates,deviceIssueState} from '../src/mock/deviceIssueContext.js'
test('all issue types share exactly the three confirmed device states',()=>{
 assert.deepEqual(deviceIssueStates,['待决策','已派发','已结束'])
 assert.equal(deviceIssueState({state:'已闭环'}),'已结束')
 assert.equal(deviceIssueState({state:'已记录决定'}),'已结束')
 assert.equal(deviceIssueState({state:'已派发'}),'已派发')
})
test('dispatch, observation, true event closure and ignored advice remain distinct',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
 const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
 const {deviceIssueRows}=await server.ssrLoadModule('/src/mock/deviceIssueContext.js')
 setActivePinia(createPinia());const store=usePhase2DemoStore()
 assert.equal(deviceIssueRows(store,'main-engine-1','报警事件','待决策')[0].id,'fault')
 assert.deepEqual(deviceIssueRows(store,'main-engine-1','','待决策').map(item=>item.id),['fault','main-warning','drift','maintenance'])
 assert.deepEqual(deviceIssueRows(store,'air-compressor','','待决策').map(item=>item.id),['air-delivery'])
 store.createTodo('fault');store.progress.fault=store.observationIndex('fault')
 assert.equal(deviceIssueRows(store,'main-engine-1','报警事件','已派发').length,1)
 assert.equal(deviceIssueRows(store,'main-engine-1','报警事件','已结束').length,0)
 const canonical={...store,eventStatus:{fault:'closed'}}
 assert.equal(deviceIssueRows(canonical,'main-engine-1','报警事件','已结束').length,1)
 store.ignoreSuggestion('maintenance','本次暂不提前，原周期保留')
 const ended=deviceIssueRows(store,'main-engine-1','维保建议','已结束')
 assert.equal(ended[0].decisionReason,'本次暂不提前，原周期保留')
 assert.equal(store.todoCreated.maintenance,false)
 }finally{await server.close()}
})
