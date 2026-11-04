import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createAiHandler} from '../server/ai-api.mjs'

test('situation chat uses voyage readings without event decisions or repair retrieval',async()=>{
 let sent,result
 const situation={ship:'长航碧玉',readings:{speed:'9.8',rpm:'95.0',load:'70.1',sampledAt:'2026-11-04T02:00:00Z'},periods:[{status:'海上航行',time:'11/04 00:00 — 11/04 10:00'}],source:'AIS 航迹回放'}
 const handler=createAiHandler(process.cwd(),{
  configuration:{read:async()=>({source:'manual',baseUrl:'https://example.test',apiKey:'test-key',model:'test',protocol:'anthropic',maxTokens:1000,timeoutMs:5000,enabled:true,knowledgeEnabled:true})},
  knowledge:{search(){assert.fail('Voyage questions must not retrieve event repair material')}},
  fetcher:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:'主机转速95.0 rpm，负荷70.1%。'}]})}}
 })
 const input={mode:'situation',text:'当前主机转速与负荷是多少？',role:'captain',situation,event:{title:'不应绑定的事件',tasks:[],reports:[]}}
 const req=Readable.from([JSON.stringify(input)])
 Object.assign(req,{url:'/api/ai/chat',method:'POST',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 await handler(req,{setHeader(){},end(body){result=JSON.parse(body)}},()=>assert.fail())
 assert.equal(result.answer,'主机转速95.0 rpm，负荷70.1%。')
 const context=JSON.parse(sent.messages[0].content)
 assert.deepEqual(context.situation,situation)
 assert.equal(context.event,null)
 assert.equal(context.availableDecisions,undefined)
 assert.deepEqual(context.knowledge,[])
 assert.match(sent.system,/态势助手/)
 assert.doesNotMatch(sent.system,/所有事件在排查报告回交后|讨论流程时以 availableDecisions/)
})
