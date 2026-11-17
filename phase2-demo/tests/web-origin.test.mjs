import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {join,dirname,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {trustedAppRequest} from '../server/request-origin.mjs'
import {createAuthService} from '../server/auth-api.mjs'
import {handleContextPath} from '../server/context-path.mjs'

const publicOrigin='https://dev.zhongshu.tech',prefix='/ship-smart-engine-room'
const request=(headers={},ip='172.18.0.1')=>({socket:{remoteAddress:ip},headers:{host:'backend:5173','x-engine-room-client':'local-ui','x-ship-session':'none','sec-fetch-site':'same-origin',referer:publicOrigin+prefix+'/',...headers}})
const allowed=(req,origin=publicOrigin)=>trustedAppRequest(req,origin,'172.30.86.2','web')

test('deployed browser GET and POST work through changing proxy IPs and internal upstream Host',()=>{
 for(const ip of ['172.18.0.1','10.42.1.19','::ffff:10.42.2.8','2001:db8::1']){
  assert.equal(allowed(request({},ip)),true)
  assert.equal(allowed(request({origin:publicOrigin},ip)),true)
 }
 const direct=request({host:'dev.zhongshu.tech'});delete direct.headers.referer
 assert.equal(allowed(direct),true)
 const originOnly=request({origin:publicOrigin});delete originOnly.headers.referer
 assert.equal(allowed(originOnly),true)
 assert.equal(allowed(request({host:'edge-internal:8080',origin:publicOrigin})),true)
})

test('web mode rejects foreign/null/malformed origins and cannot be bypassed with forwarded headers',()=>{
 for(const headers of [
  {origin:'https://outside.test'}, {origin:'null'}, {origin:''}, {origin:'http://dev.zhongshu.tech'},
  {referer:'https://dev.zhongshu.tech.attacker.test/ship-smart-engine-room/'},
  {origin:publicOrigin,referer:'https://outside.test/'}, {referer:'not a URL'},
  {referer:'https://user:password@dev.zhongshu.tech/'},
  {'sec-fetch-site':'cross-site'}, {'x-engine-room-client':undefined},
 ])assert.equal(allowed(request(headers)),false,JSON.stringify(headers))
 const forged=request({'x-forwarded-host':'dev.zhongshu.tech','x-forwarded-proto':'https'})
 delete forged.headers.referer
 assert.equal(allowed(forged),false)
})

test('web mode requires a valid fixed public origin and unknown modes fail closed',()=>{
 for(const origin of ['',publicOrigin+prefix,publicOrigin+'?x=1','not a URL','ftp://dev.zhongshu.tech','https://user@dev.zhongshu.tech'])assert.equal(allowed(request(),origin),false)
 assert.equal(trustedAppRequest(request(),publicOrigin,'','unknown'),false)
 const req=request({host:'dev.zhongshu.tech',origin:publicOrigin},'172.18.0.1')
 assert.equal(trustedAppRequest(req,publicOrigin,'172.30.86.2','local'),false)
 assert.equal(trustedAppRequest(req,publicOrigin,'172.18.0.1','local'),true)
})

test('prefixed HTTP auth in web mode supports login and retains password, session and role checks',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-web-auth-'))
 const previous=Object.fromEntries(['SHIP_REQUEST_MODE','SHIP_PUBLIC_ORIGIN','SHIP_TRUSTED_PROXY_IPS'].map(key=>[key,process.env[key]]))
 process.env.SHIP_REQUEST_MODE='web';process.env.SHIP_PUBLIC_ORIGIN=publicOrigin;process.env.SHIP_TRUSTED_PROXY_IPS='192.0.2.99'
 let auth,server
 t.after(async()=>{
  if(server?.listening)await new Promise(resolve=>server.close(resolve))
  auth?.close()
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}
  assert.equal(dirname(directory),resolve(tmpdir()))
  await rm(directory,{recursive:true,force:true,maxRetries:3})
 })
 const passwords={chief:'chief-fixture',engineer1:'engineer-fixture',engineer2:'engineer2-fixture',admin:'admin-fixture'}
 auth=await createAuthService(directory,{directory,passwords})
 server=createServer((req,res)=>{
  if(handleContextPath(req,res,prefix))return
  auth.handler(req,res,()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({user:req.user}))}).catch(error=>{res.writeHead(500);res.end(JSON.stringify({error:error.message}))})
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const call=async(path,{body,token='none',headers={}}={})=>{
  const res=await fetch(`http://127.0.0.1:${server.address().port}${prefix}/api/${path}`,{method:body?'POST':'GET',headers:{'x-engine-room-client':'local-ui','x-ship-session':token,referer:publicOrigin+prefix+'/','Content-Type':'application/json',...(body?{origin:publicOrigin}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})})
  return {status:res.status,data:await res.json()}
 }
 const anonymous=await call('auth/me');assert.equal(anonymous.status,200);assert.equal(anonymous.data.user,null)
 assert.equal((await call('data/health')).status,401)
 assert.equal((await call('auth/login',{body:{username:'chief',password:'wrong'}})).status,401)
 const sessions={}
 for(const username of ['chief','engineer1','engineer2','admin']){
  const result=await call('auth/login',{body:{username,password:passwords[username]}})
  assert.equal(result.status,200);assert.equal(result.data.user.username,username);sessions[username]=result.data.sessionToken
 }
 assert.equal((await call('auth/me',{token:sessions.chief})).data.user.username,'chief')
 assert.equal((await call('data/health',{token:sessions.engineer1})).data.user.username,'engineer1')
 for(const username of ['chief','engineer1','engineer2'])assert.equal((await call('events/delete',{body:{ids:['fixture-only-event']},token:sessions[username]})).status,403)
 assert.equal((await call('events/delete',{body:{ids:['fixture-only-event']},token:sessions.admin})).status,200)
 assert.equal((await call('auth/login',{body:{username:'chief',password:passwords.chief},headers:{origin:'https://outside.test'}})).status,403)
 assert.equal((await call('auth/me',{headers:{referer:'https://outside.test/'}})).status,403)
 assert.equal((await call('auth/logout',{body:{},token:sessions.chief})).status,200)
 assert.equal((await call('auth/me',{token:sessions.chief})).data.user,null)
 assert.equal((await call('data/health',{token:sessions.chief})).status,401)
 assert.equal((await call('auth/me',{token:sessions.engineer1})).data.user.username,'engineer1')
})
