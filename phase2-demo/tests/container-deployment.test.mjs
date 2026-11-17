import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {configStore,resolveProvider} from '../server/ai-config.mjs'
import {trustedAppRequest} from '../server/request-origin.mjs'

const origin='https://ship.company.test'
const req=(address='172.30.86.2')=>({socket:{remoteAddress:address},headers:{host:'ship.company.test',origin,'x-engine-room-client':'local-ui'}})
test('container proxy must match exact configured IP, public Host and browser origin',()=>{
 assert.equal(trustedAppRequest(req(),origin,'172.30.86.2'),true)
 assert.equal(trustedAppRequest(req('::ffff:172.30.86.2'),origin,'172.30.86.2'),true)
 assert.equal(trustedAppRequest(req('172.30.86.3'),origin,'172.30.86.2'),false)
 assert.equal(trustedAppRequest(req(),'', '172.30.86.2'),false)
 assert.equal(trustedAppRequest(req(),origin,''),false)
 const forged=req('172.30.86.3');forged.headers['x-forwarded-for']='172.30.86.2'
 assert.equal(trustedAppRequest(forged,origin,'172.30.86.2'),false)
 for(const patch of [{host:'backend:5173'},{origin:'https://outside.test'},{'x-engine-room-client':undefined}]){
  const request=req();Object.assign(request.headers,patch)
  assert.equal(trustedAppRequest(request,origin,'172.30.86.2'),false)
 }
})

test('first server start seeds a portable model config once; restart preserves administrator changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ship-container-config-'))
 try{
  const seedFile=join(root,'seed.json'),directory=join(root,'persistent','ai')
  const seed={source:'manual',baseUrl:'https://model.test',model:'fixture',apiKey:'test-only-key',protocol:'openai'}
  await writeFile(seedFile,JSON.stringify(seed))
  const store=configStore(root,{directory,seedFile})
  const reads=await Promise.all([store.read(),store.read()])
  assert.ok(reads.every(c=>c.source==='manual'))
  assert.equal((await resolveProvider(reads[0])).apiKey,seed.apiKey)
  await store.write({model:'admin-selection'})
  await writeFile(seedFile,JSON.stringify({...seed,model:'new-image-default'}))
  const restarted=configStore(root,{directory,seedFile})
  assert.equal((await restarted.read()).model,'admin-selection')
  assert.equal(JSON.parse(await readFile(join(directory,'config.json'),'utf8')).model,'admin-selection')
 }finally{await rm(root,{recursive:true,force:true})}
})

test('missing or corrupt deployment model seed fails instead of falling back to desktop provider',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ship-container-missing-'))
 try{
  const directory=join(root,'runtime'),seedFile=join(root,'missing.json')
  await assert.rejects(configStore(root,{directory,seedFile}).read(),/初始配置/)
  await mkdir(directory,{recursive:true});await writeFile(join(directory,'config.json'),'{bad')
  await assert.rejects(configStore(root,{directory,seedFile}).read(),/配置文件/)
 }finally{await rm(root,{recursive:true,force:true})}
})
