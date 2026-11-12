import test from 'node:test'
import assert from 'node:assert/strict'
import {reactive,watchEffect,nextTick,ref} from 'vue'
import {sendKnowledgeQuestion} from '../src/composables/knowledgeChat.js'
import {useAgentConversations} from '../src/composables/useAgentConversations.js'
import {answerKnowledge} from '../server/knowledge-chat.mjs'

test('knowledge response updates reactively during streaming and displays the final answer',async()=>{
 const session=reactive({messages:[]});let visible='',release
 const stop=watchEffect(()=>{visible=session.messages.at(-1)?.content||''})
 const pending=sendKnowledgeQuestion(session,'日常怎么预防？','主机',async(body,emit)=>{
  assert.equal(body.mode,'knowledge');assert.deepEqual(body.history,[])
  emit('text',{delta:'保持冷却水参数'});await new Promise(r=>release=r)
  return {answer:'按手册检查冷却水参数并记录趋势。',sources:[{id:'K1',title:'操作规程'}]}
 })
 await nextTick();assert.equal(visible,'保持冷却水参数');release();await pending;await nextTick()
 assert.equal(visible,'按手册检查冷却水参数并记录趋势。');assert.equal(session.messages[1].status,'complete');stop()
})
test('errors and empty responses are visible; switching/deleting a conversation cannot receive its late answer',async()=>{
 const sessions=useAgentConversations(ref('knowledge-isolated-test')),old=sessions.active.value
 let release;const pending=sendKnowledgeQuestion(old,'问题','主机',()=>new Promise(r=>release=r))
 sessions.newConversation();const current=sessions.active.value;sessions.remove(old.id)
 release({answer:'旧问题的回答'});await pending
 assert.equal(current.messages.length,0);assert.equal(sessions.conversations.value.length,1)
 const error=await sendKnowledgeQuestion(current,'重试','主机',async()=>{throw Error('连接中断')});assert.equal(error.status,'error');assert.match(error.error,/连接中断/)
 const empty=await sendKnowledgeQuestion(current,'再试','主机',async()=>({answer:''}));assert.equal(empty.status,'error')
})
test('delete active/last history, persist deletion and isolate accounts',async()=>{
 const storage=new Map(),previous=globalThis.localStorage
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}
 try{
  const user=ref('knowledge:chief-test'),s=useAgentConversations(user,()=>[],{persist:true})
  const old=s.active.value.id;s.active.value.messages.push({role:'user',content:'日常检查'});s.newConversation();const current=s.active.value.id
  s.remove(old);await nextTick();let saved=JSON.parse(storage.get('engine-room-agent:'+user.value));assert.ok(!saved.conversations.some(c=>c.id===old))
  s.remove(current);await nextTick();assert.equal(s.conversations.value.length,1);assert.notEqual(s.active.value.id,current);assert.equal(s.draft.value,'')
  user.value='knowledge:engineer-test';assert.equal(s.active.value.messages.length,0)
 }finally{globalThis.localStorage=previous}
})
test('knowledge backend retrieves real sources and does not need an event; blank model text fails clearly',async()=>{
 const config={source:'manual',enabled:true,apiKey:'test',model:'fixture',baseUrl:'https://example.test/v1',protocol:'openai',maxTokens:4096,timeoutMs:5000,knowledgeEnabled:true}
 let query='',payload,content='根据 [K1] 核对冷却水参数。';const frames=[]
 const options={configuration:{read:async()=>config},knowledge:{search:async q=>{query=q;return [{id:'K1',title:'操作规程',file:'concepts/操作规程.md',text:'检查冷却水温度。'}]}},emit:(kind,data)=>frames.push([kind,data]),fetcher:async(_url,request)=>{payload=JSON.parse(request.body);return new Response('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})}}
 const result=await answerKnowledge({text:'日常怎么预防？',scope:'主机',history:[{role:'user',text:'冷却系统'}]},options)
 assert.match(query,/冷却系统/);assert.match(result.answer,/冷却水/);assert.equal(result.sources[0].id,'K1');assert.ok(frames.some(([event])=>event==='text'));assert.match(JSON.stringify(payload),/不虚构参数/)
 content='';await assert.rejects(answerKnowledge({text:'问题'},options),/未返回|没有返回|文本|内容/)
})
