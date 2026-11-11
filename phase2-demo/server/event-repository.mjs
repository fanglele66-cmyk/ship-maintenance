import {DatabaseSync} from 'node:sqlite'
import {mkdir,writeFile,rename} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {people} from '../src/workflow/lifecyclePermissions.js'
import {eventTitle} from '../src/workflow/eventTitle.js'
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const copy=value=>JSON.parse(JSON.stringify(value))
export const canSeeEvent=(event,user)=>user?.workflowRole==='captain'||event.participants?.includes(people[user?.workflowRole])
export function validateEventUpdate(old,event,user){
 if(!old||!canSeeEvent(old,user))throw Error('没有该事件的访问权限。')
 for(const key of ['id','number','createdAt','manualReport','detectionReport','trackingReport','sensorScope','responsible','parentEventId','sourceEventId'])if(!same(old[key],event[key]))throw Error('不能修改事件身份与原始证据。')
 if(user.workflowRole==='captain')return
 const role=user.workflowRole,owner=people[role]
 const priorCurrent=old.tasks.find(t=>t.id===old.currentTask),current=event.tasks.find(t=>t.id===old.currentTask)
 const ownResume=priorCurrent?.owner===owner&&priorCurrent.status==='waiting'&&priorCurrent.waiting?.resumeApproved===true&&current?.status==='assigned'&&typeof current.waiting?.resumeReason==='string'&&current.waiting.resumeReason.trim()
 const allowed=new Set(['tasks','reports','conversations','unread','status','phase','phases','currentTask','pendingPlan'])
 for(const key of new Set([...Object.keys(old),...Object.keys(event)]))if(!allowed.has(key)&&!same(old[key],event[key]))throw Error('轮机员不能修改事件决策。')
 if(old.currentTask!==event.currentTask||old.tasks.length!==event.tasks.length)throw Error('轮机员不能派发任务。')
 for(const task of event.tasks){
  const prior=old.tasks.find(t=>t.id===task.id)
  if(!prior)throw Error('不能创建任务。')
  if(prior.owner!==owner){if(!same(prior,task))throw Error('不能修改其他人的任务。');continue}
  for(const key of ['id','owner','kind','steps','scope','assignedAt','purpose','sourceReportId'])if(!same(prior[key],task[key]))throw Error('不能修改已派任务范围。')
  if(!same(prior.waiting?.resumeApproved,task.waiting?.resumeApproved))throw Error('不能修改轮机长的恢复授权。')
  const transitions={assigned:['reporting','report-error','submitted'],reporting:['submitted','report-error'],'report-error':['reporting','submitted']}
  if(task.status!==prior.status&&!transitions[prior.status]?.includes(task.status)&&!(ownResume&&task.id===old.currentTask))throw Error('不能改变任务处置。')
 }
 if(event.reports.some(r=>r.owner!==owner&&!old.reports.some(p=>same(p,r)))||old.reports.some(r=>r.owner!==owner&&!event.reports.some(p=>same(p,r))))throw Error('不能修改他人报告。')
 for(const key of Object.keys(old.conversations||{}))if(key!==role&&!same(old.conversations[key],event.conversations?.[key])){const before=old.conversations[key]||[],after=event.conversations?.[key]||[],own=event.tasks.find(t=>t.id===event.currentTask&&t.owner===owner);if(!own||!['reporting','report-error','submitted'].includes(own.status)||!same(before,after.slice(0,before.length))||after.slice(before.length).some(m=>!['receipt','advice'].includes(m.kind)))throw Error('不能修改他人会话。')}
 if(!same(old.pendingPlan,event.pendingPlan))throw Error('轮机员不能修改待派方案。')
 if(!same(old.phases,event.phases)||old.phase!==event.phase){
  if(ownResume&&same(old.phases,event.phases)&&event.phase===current.kind)return
  const task=event.tasks.find(t=>t.id===event.currentTask)
  if(!task||task.owner!==owner||!['reporting','report-error','submitted'].includes(task.status)||!['decision','review'].includes(event.phase)||!event.reports.some(r=>r.taskId===task.id))throw Error('只能回交本人任务，不能决策或闭环。')
  if(event.phases.some(p=>p.observationWaiting&&!old.phases.some(o=>same(o,p))))throw Error('轮机员不能安排效果观察。')
 }
}
export async function createEventRepository(directory){
 directory=resolve(directory);await mkdir(join(directory,'events'),{recursive:true})
 const db=new DatabaseSync(join(directory,'workflow.sqlite'))
 db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,json TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,event_id TEXT);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,json TEXT NOT NULL);`)
 const get=id=>{const row=db.prepare('SELECT revision,json FROM events WHERE id=?').get(id);return row?{...JSON.parse(row.json),serverRevision:row.revision}:null}
 const list=()=>db.prepare('SELECT id FROM events ORDER BY updated DESC').all().map(row=>get(row.id))
 const pending=new Map()
 function folder(id){if(!/^[\w-]{1,240}$/.test(id))throw Error('事件编号无效。');return join(directory,'events',id)}
 async function exportEvent(event){
  const dir=folder(event.id);await mkdir(dir,{recursive:true})
  const files={'event.json':event,'evidence.json':{scope:event.sensorScope||{},sensors:event.manualReport?.evidence||event.detectionReport?.evidence||[]},'analysis.json':event.manualReport?.analysis||event.detectionReport||event.brief,'tasks.json':event.tasks,'reports.json':event.reports,'conversations.json':{event:event.conversations,tasks:event.tasks.map(t=>({id:t.id,conversations:t.conversations}))}}
  for(const [name,value] of Object.entries(files)){const path=join(dir,name);await writeFile(path+'.tmp',JSON.stringify(value,null,2),'utf8');await rename(path+'.tmp',path)}
 }
 function save(event,{expected,user}={}){
  const operation=(pending.get(event.id)||Promise.resolve()).catch(()=>{}).then(async()=>{
   folder(event.id);const old=get(event.id)
   if(expected!==undefined&&old?.serverRevision!==expected){const e=Error('事件已更新，请刷新后重试。');e.status=409;throw e}
   if(user)validateEventUpdate(old,event,user)
   const revision=(old?.serverRevision||0)+1,value=copy({...event,title:eventTitle(event.title,event.type),backendManaged:true});delete value.serverRevision
   db.prepare('INSERT INTO events VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,json=excluded.json,updated=excluded.updated').run(value.id,revision,JSON.stringify(value),Date.now())
   const result={...value,serverRevision:revision};await exportEvent(result);return result
  });pending.set(event.id,operation);return operation.finally(()=>{if(pending.get(event.id)===operation)pending.delete(event.id)})
 }
 // One-time title-only upgrade for existing events. Keep evidence, notes and
 // conversations intact, and export the same revision to the event folder.
 for(const event of list())if(eventTitle(event.title,event.type)!==event.title)await save({...event,title:eventTitle(event.title,event.type)},{expected:event.serverRevision})
 return {db,get,list,save,folder,async close(){await Promise.allSettled([...pending.values()]);db.close()}}
}
