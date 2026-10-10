import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveMessageFlow, messageType } from '../src/message-flows/resolveMessageFlow.js'
import { deviceMessageSources, deviceConversationRecords } from '../src/message-flows/deviceSources.js'
const config = JSON.parse(readFileSync(new URL('../src/message-flows/device-overview.json', import.meta.url)))
function storeFixture() {
  return {
    monitorStep: {drift:0,stable:0}, todoCreated: {drift:false,maintenance:false},
    progress: {drift:0,maintenance:0,fault:0}, observationRecords: {fault:[],drift:[],maintenance:[]},
    cases: {drift:{stages:[{summary:'检查阶段'},{summary:'处置阶段'},{summary:'排查阶段'}]},fault:{stages:[{summary:'冷却系统当前状态'}]},maintenance:{stages:[{label:'检查'}]}},
    isTaskHandled: () => false, getObservationResult: () => ({title:'效果观察',text:'效果已记录',type:'continue'})
  }
}
test('configuration preserves order, IDs and explicit expansion; source state is not mutated',()=>{
  const store=storeFixture(), sources=deviceMessageSources(store)
  const before=JSON.stringify(sources), messages=resolveMessageFlow(config,sources)
  assert.deepEqual(messages.map(x=>x.type),['dailyBrief','notice','report'])
  assert.deepEqual(messages.map(x=>x.expanded),[false,false,true])
  assert.equal(messages[0].paragraphs.length,3)
  assert.equal(JSON.stringify(sources),before)
  const reversed=resolveMessageFlow({...config,messages:[...config.messages].reverse()},sources)
  assert.equal(reversed[0].id,'device-plan-links')
})
test('state changes select evidence, linked task and handled observation actions',()=>{
  const store=storeFixture()
  assert.match(deviceMessageSources(store).driftNotice.title,/持续关注/)
  store.monitorStep.drift=1
  assert.match(deviceMessageSources(store).driftNotice.title,/新证据/)
  store.todoCreated.drift=true
  assert.deepEqual(deviceMessageSources(store).driftNotice.actions.map(a=>a.id),['item:drift','todo:drift'])
  store.isTaskHandled=id=>id==='drift'
  assert.equal(deviceMessageSources(store).driftNotice.title,'效果观察')
  assert.match(deviceMessageSources(store).driftNotice.actions[0].label,/效果观察/)
})
test('invalid configuration is rejected, legacy messages and dialogue merge remain supported',()=>{
  const sources=deviceMessageSources(storeFixture())
  for (const override of [{type:'invalid'},{source:'missing'},{expanded:'yes'}]) {
    assert.throws(()=>resolveMessageFlow({...config,messages:[{...config.messages[0],...override}]},sources))
  }
  assert.throws(()=>resolveMessageFlow({...config,messages:[config.messages[0],config.messages[0]]},sources))
  assert.equal(messageType({kind:'scene',demoLabel:'每日效果回顾'}),'dailyBrief')
  assert.equal(messageType({kind:'recordDraft'}),'feedbackRecord')
  const reply={role:'assistant',text:'普通回答'}, user={role:'user',text:'补充现场发现'}
  assert.deepEqual(deviceConversationRecords([{role:'assistant',title:'主机每日健康回顾'},{role:'user',text:'查看设备'},user,reply]),[user,reply])
})
