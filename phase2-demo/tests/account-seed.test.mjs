import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {scryptSync} from 'node:crypto'
import {createServer} from 'node:http'
import {DatabaseSync} from 'node:sqlite'
import {identities,validateAccountSeed} from '../server/account-seed.mjs'
import {createAuthService} from '../server/auth-api.mjs'

const password='test-only-fixed-password'
const seed=()=>({version:1,accounts:identities.map(([username,role,name,label],i)=>{const salt=(i+1).toString(16).padStart(32,'0');return {username,role,name,label,salt,hash:scryptSync(password,salt,64).toString('hex')}})})

test('fresh server retains all four seeded passwords across restart and never exports plaintext',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ship-fixed-users-'))
 await mkdir(join(root,'data'));await writeFile(join(root,'data/accounts-seed.json'),JSON.stringify(seed()))
 let auth=await createAuthService(root)
 const server=createServer((req,res)=>void auth.handler(req,res,()=>res.end('{}')))
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const login=async(username,value=password)=>{
  const r=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`,{method:'POST',headers:{'x-engine-room-client':'local-ui','x-ship-session':'none'},body:JSON.stringify({username,password:value})})
  return {status:r.status,body:await r.json()}
 }
 try{
  for(let round=0;round<2;round++){
   for(const [username,role] of identities){const result=await login(username);assert.equal(result.status,200);assert.equal(result.body.user.role,role)}
   auth.close();auth=await createAuthService(root)
  }
  await assert.rejects(readFile(join(root,'.local-data/accounts-initial.json')),e=>e.code==='ENOENT')
  auth.close()
  const db=new DatabaseSync(join(root,'.local-data/accounts.sqlite'))
  const row=db.prepare('SELECT salt FROM accounts WHERE username=?').get('chief')
  db.prepare('UPDATE accounts SET hash=? WHERE username=?').run(scryptSync('changed-after-deploy',row.salt,64).toString('hex'),'chief');db.close()
  // A changed local password must not be reset by a release or seed update.
  auth=await createAuthService(root)
  assert.equal((await login('chief')).status,401)
  assert.equal((await login('chief','changed-after-deploy')).status,200)
  await rm(join(root,'data/accounts-seed.json'))
  auth.close();auth=await createAuthService(root)
  assert.equal((await login('chief','changed-after-deploy')).status,200)
 }finally{await new Promise(r=>server.close(r));auth.close();await rm(root,{recursive:true,force:true})}
})

test('missing or invalid seed fails before any account is silently randomized',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ship-missing-seed-'))
 try{
  await assert.rejects(createAuthService(root),/accounts-seed/)
  await mkdir(join(root,'data'));const invalid=seed();invalid.accounts[3].hash='invalid'
  await writeFile(join(root,'data/accounts-seed.json'),JSON.stringify(invalid))
  await assert.rejects(createAuthService(root),/无效/)
  const db=new DatabaseSync(join(root,'.local-data/accounts.sqlite'),{readOnly:true})
  assert.equal(db.prepare('SELECT count(*) AS n FROM accounts').get().n,0);db.close()
  const plaintext=seed();plaintext.accounts[0].password='must-not-export'
  assert.throws(()=>validateAccountSeed(plaintext),/无效/)
 }finally{await rm(root,{recursive:true,force:true})}
})

test('committed seed contains only the four existing identity verifiers',async()=>{
 const value=JSON.parse(await readFile(new URL('../data/accounts-seed.json',import.meta.url),'utf8'))
 assert.equal(validateAccountSeed(value).size,4)
 assert.equal(Object.keys(value).join(','),'version,accounts')
})
