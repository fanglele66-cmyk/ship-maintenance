import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {normalizeContextPath,handleContextPath} from '../server/context-path.mjs'
import {createAuthService} from '../server/auth-api.mjs'

test('context path supports root and nested mounts while rejecting invalid configuration',()=>{
 for(const value of ['', '/', '  '])assert.equal(normalizeContextPath(value),'')
 for(const value of ['ship-smart-engine-room','/ship-smart-engine-room/'])assert.equal(normalizeContextPath(value),'/ship-smart-engine-room')
 assert.equal(normalizeContextPath('/apps/ship_2/'),'/apps/ship_2')
 for(const value of ['../ship','ship//room','ship?x=1','ship#x','https://ship.test','ship/%2f','ship\\room'])assert.throws(()=>normalizeContextPath(value),/SHIP_CONTEXT_PATH/)
})

test('prefix routing preserves queries, segment boundaries and already rewritten requests',()=>{
 const prefix='/ship-smart-engine-room'
 for(const [input,expected] of [
  [prefix+'/api/data/situation?name=%E4%B8%BB%E6%9C%BA&next=%2Ffoo','/api/data/situation?name=%E4%B8%BB%E6%9C%BA&next=%2Ffoo'],
  [prefix+'/assets/main.js','/assets/main.js'],
  ['/api/auth/me','/api/auth/me'],
  ['/healthz','/healthz'],
  [prefix+'-other/api/auth/me',prefix+'-other/api/auth/me'],
 ]){
  const req={url:input}
  assert.equal(handleContextPath(req,{},prefix),false)
  assert.equal(req.url,expected)
 }
 const req={url:prefix+'?view=tasks'},res={writeHead(code,headers){this.code=code;this.headers=headers},end(){this.ended=true}}
 assert.equal(handleContextPath(req,res,prefix),true)
 assert.equal(res.code,308);assert.equal(res.headers.Location,prefix+'/?view=tasks');assert.equal(res.ended,true)
 const nested={url:'/apps/ship/api/auth/me?x=1'}
 assert.equal(handleContextPath(nested,{},'/apps/ship'),false);assert.equal(nested.url,'/api/auth/me?x=1')
})

test('actual Node server serves prefixed HTML/assets/login/APIs/probes and preserves root proxy compatibility', {timeout:45000}, async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),directory=await mkdtemp(join(tmpdir(),'ship-context-path-'))
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening')
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 const origin=`http://127.0.0.1:${port}`,prefix='/ship-smart-engine-room'
 const password='context-path-fixture-only-2026!'
 const auth=await createAuthService(root,{directory,passwords:Object.fromEntries(['chief','engineer1','engineer2','admin'].map(user=>[user,password]))});auth.close()
 const ai=join(directory,'ai');await mkdir(ai);await writeFile(join(ai,'config.json'),JSON.stringify({enabled:false,knowledgeEnabled:false}))
 const child=spawn(process.execPath,['server/local-server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),SHIP_CONTEXT_PATH:'ship-smart-engine-room',SHIP_PUBLIC_ORIGIN:origin,SHIP_TRUSTED_PROXY_IPS:'',SHIP_DATA_DIR:directory,SHIP_AI_DIR:ai,SHIP_AI_SEED_FILE:'',SHIP_SCHEDULERS_ENABLED:'false',SHIP_REQUIRE_TELEMETRY:'false'},stdio:['ignore','pipe','pipe']})
 let log='';child.stdout.on('data',chunk=>{log=(log+chunk).slice(-4000)});child.stderr.on('data',chunk=>{log=(log+chunk).slice(-4000)})
 let spawnError;child.on('error',error=>{spawnError=error})
 t.after(async()=>{
  if(child.exitCode===null&&child.pid){const stopped=once(child,'exit');child.kill();await stopped}
  await rm(directory,{recursive:true,force:true})
 })
 let ready=false
 for(let i=0;i<100;i++){
  if(spawnError)throw spawnError
  if(child.exitCode!==null)throw Error('Isolated server exited: '+log)
  try{if((await fetch(origin+'/readyz')).ok){ready=true;break}}catch{}
  await delay(100)
 }
 assert.ok(ready,'Isolated server did not become ready: '+log)
 const redirect=await fetch(origin+prefix+'?view=tasks',{redirect:'manual'})
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),prefix+'/?view=tasks')
 const htmlResponse=await fetch(origin+prefix+'/'),html=await htmlResponse.text()
 assert.equal(htmlResponse.status,200);assert.match(htmlResponse.headers.get('content-type'),/text\/html/)
 assert.equal(html,await readFile(join(root,'dist/index.html'),'utf8'))
 const script=html.match(/<script[^>]+src="([^\"]+\.js)"/)[1]
 const asset=await fetch(new URL(script,origin+prefix+'/'))
 assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);assert.doesNotMatch((await asset.text()).slice(0,100),/<!DOCTYPE html>/i)
 for(const path of ['/healthz','/readyz',prefix+'/healthz',prefix+'/readyz']){
  assert.equal((await fetch(origin+path)).status,200)
  const head=await fetch(origin+path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'')
 }
 const headers={'x-engine-room-client':'local-ui','x-ship-session':'none',Origin:origin,'Content-Type':'application/json'}
 assert.equal((await fetch(origin+prefix+'/api/data/health',{headers})).status,401)
 const login=await fetch(origin+prefix+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({username:'chief',password})})
 assert.equal(login.status,200)
 const session=await login.json();assert.equal(session.user.username,'chief')
 headers['x-ship-session']=session.sessionToken
 for(const path of [prefix+'/api/auth/me?test=1','/api/auth/me']){
  const res=await fetch(origin+path,{headers});assert.equal(res.status,200);assert.equal((await res.json()).user.username,'chief')
 }
 const health=await fetch(origin+prefix+'/api/data/health',{headers});assert.equal(health.status,200);assert.match(health.headers.get('content-type'),/application\/json/)
 assert.equal((await fetch(origin+prefix+'/api/auth/me',{headers:{...headers,Origin:'https://outside.test'}})).status,403)
 const logout=await fetch(origin+prefix+'/api/auth/logout',{method:'POST',headers});assert.equal(logout.status,200)
 const me=await fetch(origin+'/api/auth/me',{headers});assert.equal((await me.json()).user,null)
})
