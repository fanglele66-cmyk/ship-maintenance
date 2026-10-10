import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useAgentConversations, demoConversations, historyConversations } from '../src/composables/useAgentConversations.js'
test('agent conversations are isolated, switchable and restored without losing drafts',()=>{
 const id=ref('test-device'), state=useAgentConversations(id,demoConversations)
 assert.equal(state.conversations.value.length,3)
 const first=state.active.value.id
 state.draft.value='未发送输入'
 state.newConversation()
 const second=state.active.value.id
 assert.equal(state.active.value.messages.length,0)
 state.active.value.messages.push({role:'user',text:'振动趋势如何？'})
 state.touch()
 assert.equal(state.active.value.title,'振动趋势如何？')
 state.select(first)
 assert.equal(state.draft.value,'未发送输入')
 state.select(second)
 assert.equal(useAgentConversations(ref('test-device'),demoConversations).active.value.id,second)
 id.value='test-ship'
 assert.equal(state.conversations.value.length,3)
 state.select(second)
 assert.notEqual(state.active.value.id,second)
 id.value='test-device'
 assert.equal(state.active.value.id,second)
 assert.equal(state.conversations.value.length,4)
})

test('untitled current conversation stays reachable when switching to history',()=>{
 const state=useAgentConversations(ref('test-return'),demoConversations)
 const original=state.active.value.id
 state.active.value.messages.push({role:'assistant',title:'主机每日健康回顾'})
 const old=state.conversations.value.find(item=>item.id!==original)
 state.select(old.id)
 const list=historyConversations(state.conversations.value)
 assert.equal(list.find(item=>item.id===original).title,'主机每日健康回顾')
 state.select(original)
 assert.equal(state.active.value.messages[0].title,'主机每日健康回顾')
 state.newConversation()
 assert.equal(historyConversations(state.conversations.value).length,3)
 state.draft.value='未发送的内容'
 assert.equal(historyConversations(state.conversations.value).length,4)
})
