import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createAiHandler} from '../server/ai-api.mjs'
test('备注整理只使用输入事实，保留数值与未完成项，不检索或修改任务',async()=>{
 let sent,response,status,searches=0
 const configuration={read:async()=>({source:'manual',baseUrl:'https://example.test',apiKey:'test',model:'test',protocol:'anthropic',enabled:true,knowledgeEnabled:true,maxTokens:1000,timeoutMs:5000})}
 const handler=createAiHandler(process.cwd(),{configuration,knowledge:{search:async()=>{searches++;return []}},fetcher:async(_,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{type:'text',text:'已核对阀前压力 0.66 MPa；尚未拆检密封垫。'}],usage:{input_tokens:10,output_tokens:20}})}}})
 const request={mode:'note',text:'嗯阀前是0.66 MPa，密封垫还没拆开查。',noteContext:'空气减压阀',event:{title:'不作为整理事实'},history:[{role:'user',content:'旧发现不得带入'}]}
 const before=structuredClone(request),req=Readable.from([JSON.stringify(request)]);Object.assign(req,{method:'POST',url:'/api/ai/chat',socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:5173','x-engine-room-client':'local-ui'}})
 await handler(req,{set statusCode(v){status=v},setHeader(){},end(v){response=JSON.parse(v)}},()=>assert.fail())
 assert.equal(status,200);assert.equal(searches,0);assert.match(sent.system,/保留所有部件、数字、时间、单位、否定和不确定/);assert.match(sent.system,/不改变检查结果/)
 const data=JSON.parse(sent.messages.at(-1).content);assert.equal(data.event,null);assert.deepEqual(data.history,[]);assert.equal(data.question,request.text);assert.match(response.answer,/尚未拆检/);assert.deepEqual(request,before)
})
