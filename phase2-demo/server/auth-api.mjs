import {DatabaseSync} from 'node:sqlite'
import {trustedAppRequest} from './request-origin.mjs'
import {identities,readAccountSeed} from './account-seed.mjs'
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'

const digest=token=>createHash('sha256').update(token).digest('hex')
const safeUser=row=>({username:row.username,name:row.name,role:row.role,roleLabel:row.label,workflowRole:row.role==='admin'?'captain':row.role})
const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>16384)throw Error('请求过大')}return JSON.parse(text||'{}')}
export async function createAuthService(root,{directory=process.env.SHIP_DATA_DIR||join(root,'.local-data'),clock=Date.now,passwords={}}={}){
 await mkdir(directory,{recursive:true})
 const db=new DatabaseSync(join(directory,'accounts.sqlite'))
 db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY,role TEXT,name TEXT,label TEXT,salt TEXT,hash TEXT);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,username TEXT,expires INTEGER);
 CREATE TABLE IF NOT EXISTS deleted_events(id TEXT PRIMARY KEY,deleted_by TEXT,deleted_at TEXT);
 CREATE TABLE IF NOT EXISTS login_attempts(username TEXT PRIMARY KEY,failures INTEGER,locked_until INTEGER);`)
 const missing=identities.filter(([username])=>!db.prepare('SELECT 1 FROM accounts WHERE username=?').get(username)),created=[]
 try{
  const seed=missing.some(([username])=>!passwords[username])?await readAccountSeed(root):new Map()
  db.exec('BEGIN IMMEDIATE')
  try{
   for(const [username,role,name,label] of missing){
    const password=passwords[username],salt=password?randomBytes(16).toString('hex'):seed.get(username).salt
    const row=password?{username,role,name,label,salt,hash:scryptSync(password,salt,64).toString('hex')}:seed.get(username)
    const inserted=db.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,?,?,?)').run(row.username,row.role,row.name,row.label,row.salt,row.hash)
    if(password&&inserted.changes)created.push({username,name,role:label,password})
   }
   db.exec('COMMIT')
  }catch(error){db.exec('ROLLBACK');throw error}
  if(created.length)await writeFile(join(directory,'accounts-initial.json'),JSON.stringify(created,null,2),'utf8')
 }catch(error){db.close();throw error}
 const deleted=()=>db.prepare('SELECT id FROM deleted_events ORDER BY deleted_at').all().map(r=>r.id)
 // Explicit tab credentials take precedence, including the unauthenticated sentinel.
 // Cookies remain supported for existing clients; new UI sessions never share cookies.
 const tabSession=req=>req.headers['x-ship-session']!==undefined
 const tokenFor=req=>{if(tabSession(req)){const token=req.headers['x-ship-session'];return typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token)?digest(token):''}const match=(req.headers.cookie||'').match(/(?:^|;\s*)ship_session=([A-Za-z0-9_-]+)/);return match?digest(match[1]):''}
 const cookie=(res,token,age)=>res.setHeader('Set-Cookie',`ship_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`)
 async function handler(req,res,next){
  const path=(req.url||'').split('?')[0]
  if(!path.startsWith('/api/'))return next()
  if(!trustedAppRequest(req))return send(res,403,{error:'请求来源不在允许范围内。'})
  db.prepare('DELETE FROM sessions WHERE expires<=?').run(clock())
  const user=db.prepare('SELECT accounts.* FROM sessions JOIN accounts USING(username) WHERE token=?').get(tokenFor(req))
  if(path==='/api/auth/me'&&req.method==='GET')return send(res,200,{user:user?safeUser(user):null,deletedIds:user?deleted():[]})
  if(path==='/api/auth/login'&&req.method==='POST'){
   let input;try{input=await body(req)}catch{return send(res,400,{error:'登录信息格式错误。'})}
   const username=String(input.username||'').slice(0,100),password=String(input.password||'')
   const attempt=db.prepare('SELECT * FROM login_attempts WHERE username=?').get(username)
   if(attempt?.locked_until>clock())return send(res,429,{error:'密码错误次数较多，请在 5 分钟后重试。'})
   const account=db.prepare('SELECT * FROM accounts WHERE username=?').get(username)
   const valid=account&&timingSafeEqual(scryptSync(password,account.salt,64),Buffer.from(account.hash,'hex'))
   if(!valid){const failures=(attempt?.locked_until>0?0:attempt?.failures||0)+1;db.prepare('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)').run(username,failures,failures>=5?clock()+300000:0);return send(res,401,{error:'账号或密码不正确。'})}
   const token=randomBytes(32).toString('base64url')
   db.prepare('DELETE FROM login_attempts WHERE username=?').run(username)
   db.exec('BEGIN IMMEDIATE')
   try{
    // A login only replaces this client's old session, never another user's session.
    db.prepare('DELETE FROM sessions WHERE token=?').run(tokenFor(req))
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),username,clock()+8*3600000);db.exec('COMMIT')
   }catch(e){db.exec('ROLLBACK');throw e}
   if(!tabSession(req))cookie(res,token,28800)
   return send(res,200,{user:safeUser(account),sessionToken:token,deletedIds:deleted()})
  }
  if(!user)return send(res,401,{error:'请先登录。'})
  req.user=safeUser(user)
  if(path==='/api/auth/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(tokenFor(req));if(!tabSession(req))cookie(res,'',0);return send(res,200,{ok:true})}
  if(path==='/api/events/deleted'&&req.method==='GET')return send(res,200,{deletedIds:deleted()})
  if(path==='/api/events/delete'&&req.method==='POST'){
   if(user.role!=='admin')return send(res,403,{error:'只有超级管理员可以删除事件。'})
   let input;try{input=await body(req)}catch{return send(res,400,{error:'删除请求格式错误。'})}
   if(!Array.isArray(input.ids)||!input.ids.length||input.ids.length>100||input.ids.some(id=>typeof id!=='string'||!/^[\w-]{1,240}$/.test(id)))return send(res,400,{error:'事件编号无效。'})
   db.exec('BEGIN IMMEDIATE')
   try{for(const id of input.ids)db.prepare('INSERT OR IGNORE INTO deleted_events VALUES(?,?,?)').run(id,user.username,new Date(clock()).toISOString());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
   return send(res,200,{deletedIds:deleted()})
  }
  return next()
 }
 return {handler,close:()=>db.close()}
}
export function localAuthPlugin(){return {name:'local-account-auth',async configureServer(server){if(server.config.server.middlewareMode)return;const auth=await createAuthService(server.config.root);server.middlewares.use((req,res,next)=>{auth.handler(req,res,next).catch(()=>send(res,500,{error:'账号服务暂时不可用。'}))});server.httpServer?.once('close',auth.close)}}}
