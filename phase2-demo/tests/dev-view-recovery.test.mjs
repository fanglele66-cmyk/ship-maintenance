import test from 'node:test'
import assert from 'node:assert/strict'
import { installDevViewRecovery } from '../src/utils/devViewRecovery.js'

test('rebuilds once after a Vue HMR batch, ignores CSS and releases old listeners', () => {
  const listeners=new Map()
  const hot={
    on(event,listener){listeners.set(event,listener)},
    off(event,listener){if(listeners.get(event)===listener)listeners.delete(event)}
  }
  let rebuilds=0
  const stop=installDevViewRecovery(hot,()=>{rebuilds++})
  assert.deepEqual([...listeners.keys()],['vite:afterUpdate'])
  const notify=updates=>listeners.get('vite:afterUpdate')?.({updates})
  notify([{type:'css-update',path:'/src/styles/conversation.css'}])
  notify([{type:'js-update',path:'/src/mock/data.js'}])
  assert.equal(rebuilds,0)
  notify([
    {type:'js-update',path:'/src/views/TodoCenterView.vue'},
    {type:'js-update',path:'/src/components/messages/InquiryMessage.vue'}
  ])
  assert.equal(rebuilds,1)
  notify([{type:'js-update',path:'/src/entry.js',acceptedPath:'/src/App.vue?vue&type=script'}])
  assert.equal(rebuilds,2)
  stop()
  notify([{type:'js-update',path:'/src/App.vue'}])
  assert.equal(rebuilds,2)
  assert.equal(listeners.size,0)
})

test('production has no HMR recovery or callbacks', () => {
  const stop=installDevViewRecovery(undefined,()=>assert.fail('must not rebuild'))
  assert.doesNotThrow(stop)
})
