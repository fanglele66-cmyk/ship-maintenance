import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createAuthService} from '../server/auth-api.mjs'

test('single account login, persisted admin deletion, role enforcement and logout revocation',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-auth-'))
 const passwords={chief:'chief-test',engineer1:'one-test',engineer2:'two-test',admin:'admin-test'}
 let auth=await createAuthService(directory,{directory,passwords}),cookie=''
 const server=createServer((req,res)=>auth.handler(req,res,()=>{res.writeHead(200);res.end(JSON.stringify({user:req.user}))}))
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const call=async(path,body,session=cookie,extra={})=>{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method:body?'POST':'GET',headers:{'x-engine-room-client':'local-ui',cookie:session,...extra},...(body?{body:JSON.stringify(body)}:{})})
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]}
 }
 try{
  assert.equal((await call('data/health')).status,401)
  assert.equal((await call('auth/login',{username:'chief',password:'wrong'})).status,401)
  const attempts=await Promise.all([call('auth/login',{username:'chief',password:passwords.chief}),call('auth/login',{username:'engineer1',password:passwords.engineer1})])
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);cookie=attempts.find(r=>r.status===200).cookie
  assert.equal((await call('events/delete',{ids:['manual-test']})).status,403)
  const old=cookie;await call('auth/logout',{});assert.equal((await call('data/health',null,old)).status,401)
  for(const username of ['engineer1','engineer2']){const result=await call('auth/login',{username,password:passwords[username]});cookie=result.cookie;assert.equal(result.data.user.username,username);assert.equal((await call('events/delete',{ids:['manual-test']})).status,403);await call('auth/logout',{})}
  cookie=(await call('auth/login',{username:'admin',password:passwords.admin})).cookie
  assert.equal((await call('events/delete',{ids:['manual-test']},cookie,{origin:'https://untrusted.example'})).status,403)
  assert.equal((await call('events/delete',{ids:['../invalid']})).status,400)
  assert.deepEqual((await call('events/delete',{ids:['manual-test','observation-test']})).data.deletedIds,['manual-test','observation-test'])
  auth.close();auth=await createAuthService(directory,{directory,passwords})
  assert.equal((await call('auth/me')).data.user.role,'admin')
  assert.deepEqual((await call('events/deleted')).data.deletedIds,['manual-test','observation-test'])
  await call('auth/logout',{})
  assert.equal((await call('events/delete',{ids:['manual-second']})).status,401)
 }finally{await new Promise(r=>server.close(r));auth.close();await rm(directory,{recursive:true,force:true})}
})
