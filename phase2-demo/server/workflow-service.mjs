import {existsSync} from 'node:fs'
import {mkdir,readFile,writeFile,rm,lstat,realpath} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createEventRepository,canSeeEvent} from './event-repository.mjs'
import {readEventEvidence} from './event-evidence.mjs'
import {analyzeManualAnomaly} from './manual-anomaly.mjs'
import {createManualAnomaly,validateAnomalyReport} from '../src/workflow/manualAnomaly.js'
import {people} from '../src/workflow/lifecyclePermissions.js'
import {localPointIds} from '../src/workflow/localSensorData.js'
import {configStore,resolveProvider} from './ai-config.mjs'
import {createKnowledge} from './knowledge.mjs'
import {invokeModel} from './model.mjs'
import {skillInstruction,hiddenContext} from './skill-runtime.mjs'
import {sqlTime,HOUR} from './local-data.mjs'
const execute=promisify(execFile),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),copy=value=>JSON.parse(JSON.stringify(value))
const services=new Map()
export function getWorkflowService(root,options){const key=resolve(root);if(!services.has(key))services.set(key,createWorkflowService(key,options));return services.get(key)}
export async function runDetection(root,directory,start,end,output){
 await mkdir(output,{recursive:true})
 const {stdout}=await execute(process.env.SHIP_PYTHON||'python',[join(root,'.claude/skills/ship-anomaly-detection/scripts/run_local_detection.py'),'--data-dir',directory,'--start',sqlTime(start),'--end',sqlTime(end),'--output',output],{cwd:root,timeout:180000,maxBuffer:24*1024*1024,windowsHide:true,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',TEMP:directory,TMP:directory}})
 return JSON.parse(stdout)
}
export async function createWorkflowService(root,{directory=process.env.SHIP_DATA_DIR||join(root,'.local-data'),clock=Date.now,detect=runDetection,analyze=analyzeManualAnomaly,observationModel,configuration:configurationOverride,knowledge:knowledgeOverride,evidenceReader=readEventEvidence,fetcher=fetch}={}){
 directory=resolve(directory);const repository=await createEventRepository(directory),db=repository.db
 const configuration=configurationOverride||configStore(root),knowledge=knowledgeOverride||createKnowledge(join(root,'wiki_rt-flex50'))
 db.exec('CREATE TABLE IF NOT EXISTS workflow_locks(name TEXT PRIMARY KEY,pid INTEGER,until_at INTEGER)')
 const deleted=()=>{if(!existsSync(join(directory,'accounts.sqlite')))return new Set();let accounts;try{accounts=new DatabaseSync(join(directory,'accounts.sqlite'),{readOnly:true});return new Set(accounts.prepare('SELECT id FROM deleted_events').all().map(r=>r.id))}finally{accounts?.close()}}
 const unavailable=(event,removed=deleted())=>removed.has(event.id)||removed.has(event.parentEventId)||removed.has(event.sourceEventId)
 const visible=user=>repository.list().filter(e=>!unavailable(e)&&canSeeEvent(e,user))
 function lock(name,now){
  db.exec('BEGIN IMMEDIATE');try{const current=db.prepare('SELECT * FROM workflow_locks WHERE name=?').get(name);let alive=current&&current.until_at>now
   if(alive)try{process.kill(current.pid,0)}catch(e){if(e.code==='ESRCH')alive=false}
   if(alive){db.exec('COMMIT');return false}db.prepare('INSERT OR REPLACE INTO workflow_locks VALUES(?,?,?)').run(name,process.pid,now+10*60000);db.exec('COMMIT');return true
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 const unlock=name=>db.prepare('DELETE FROM workflow_locks WHERE name=? AND pid=?').run(name,process.pid)
 const inFlight=new Map()
 async function manual(input,{user,emit=()=>{},signal}={}){
  const requestId=input.requestId;if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||''))throw Error('上报编号无效。')
  const report=validateAnomalyReport(input.report,user.workflowRole,clock()),fingerprint=hash(report),key='manual-'+requestId
  const old=db.prepare('SELECT * FROM requests WHERE id=?').get(key)
  if(old&&old.fingerprint!==fingerprint)throw Error('该上报编号已用于不同内容，请重新上报。')
  if(old?.event_id){const event=repository.get(old.event_id);if(!event||unavailable(event))throw Error('该事件已删除。');return {event,anomaly:event.manualReport.analysis,answer:event.brief.conclusion}}
  if(inFlight.has(key))return inFlight.get(key)
  if(!lock(key,clock()))throw Error('该上报正在分析，请稍后重试。')
  db.prepare('INSERT OR IGNORE INTO requests VALUES(?,?,NULL)').run(key,fingerprint)
  const promise=(async()=>{try{
   report.submittedAt=new Date(clock()).toISOString()
   emit('progress',{label:'正在读取上报时段的设备数据'})
   report.evidence=evidenceReader(root,report,directory)
   const folder=repository.folder(key);await mkdir(folder,{recursive:true});await writeFile(join(folder,'request.json'),JSON.stringify(report,null,2),'utf8')
   let detection={devices:[],rows:0}
   if(report.deviceId==='main-engine-1'){emit('progress',{label:'正在运行异常检测 Skill'});detection=await detect(root,directory,Date.parse(report.start),Date.parse(report.end),join(folder,'detection'))}
   const result=await analyze({...input,role:user.workflowRole,report,detection},{root,configuration,knowledge,fetcher,emit,signal})
   const state={events:{},notices:[]},event=createManualAnomaly(state,report,result,requestId,{at:new Date(clock()).toISOString()})
   event.sensorScope={deviceId:report.deviceId,systems:report.systems,sensorIds:report.sensorIds};event.manualReport.evidence=report.evidence
   event.skill='ship-manual-anomaly-analysis';event.backendManaged=true
   const saved=await repository.save(event);db.prepare('UPDATE requests SET event_id=? WHERE id=?').run(saved.id,key)
   return {...result,event:saved}
  }finally{unlock(key);inFlight.delete(key)}})();inFlight.set(key,promise);return promise
 }
 async function save(event,expected,user){
  if(unavailable(event))throw Error('该事件已删除。')
  for(const phase of event.phases||[])if(phase.observationWaiting&&!(Date.parse(phase.observationDueAt)>Date.parse(phase.at)))throw Error('观察结束时间须晚于开始时间。')
  const old=repository.get(event.id)
  if(!old){
   const parent=repository.get(event.parentEventId)
   if(user.workflowRole!=='captain'||!parent||unavailable(parent)||event.type!=='效果观察'||!parent.observationEventIds?.includes(event.id))throw Error('只能保存已建立的关联观察事件。')
   event={...event,sensorScope:copy(parent.sensorScope),deviceId:parent.deviceId,responsible:people.captain}
   return repository.save(event)
  }
  return repository.save(event,{expected,user})
 }
 async function authorize(input,user){
  if(!input.event?.id)return
  const event=repository.get(input.event.id)
  if(!event){if(/^(manual-|detected-)/.test(input.event.id))throw Error('事件不存在，请重新载入。');return}
  if(unavailable(event)||!canSeeEvent(event,user))throw Error('没有该事件的访问权限。')
  // Model context must refer to the persisted identity/plan; operator draft records may be in-flight.
  input.event.number=event.number;input.event.title=event.title;input.event.brief=event.brief;input.event.manualReport=event.manualReport;input.event.detectionReport=event.detectionReport
  if(input.mode==='step-assist'){
   const requested=input.task?.id||input.taskId,task=event.tasks.find(t=>t.id===requested)
   if(!task||task.status!=='assigned'||event.currentTask!==task.id||task.owner!==people[user.workflowRole])throw Error('只能协助本人当前正在执行的任务。')
   input.clarificationRounds=(task.conversations?.[user.workflowRole]||[]).filter(m=>m.kind==='step-assist'&&m.stepIndex===input.stepIndex&&m.response?.kind==='question'&&m.status==='complete').length
   input.event={...event,tasks:[task]};input.task=task
  }
 }
 const startedAt=clock(),session=`detect-${startedAt}-${randomUUID().slice(0,8)}`
 let timer,busy=false,closing=false,pending=null
 const runRecord=(id,status,value)=>db.prepare('INSERT OR REPLACE INTO runs VALUES(?,?,?)').run(id,status,JSON.stringify(value))
 async function periodic(now){
  const slot=Math.max(0,Math.floor((now-startedAt)/HOUR)),id=`${session}-${slot}`,prior=db.prepare('SELECT * FROM runs WHERE id=?').get(id)
  if(prior&&(prior.status==='complete'||JSON.parse(prior.json).retryAt>now))return
  const dir=join(directory,'detection-history',id);await mkdir(dir,{recursive:true});runRecord(id,'running',{startedAt:now})
  try{
   const result=await detect(root,directory,now-6*HOUR,now,dir),eventIds=[]
   for(const signal of result.devices.flatMap(d=>d.events).filter(e=>e.confirmed)){
    const fingerprint=hash([signal.equipment_id,signal.channel,signal.event_type,[...signal.sensors].sort()]).slice(0,20)
    const matching=repository.list().filter(e=>e.detectionReport?.fingerprint===fingerprint)
    const related=matching.find(e=>e.phase!=='closed'&&!unavailable(e))
    if(!related&&matching.some(e=>Date.parse(signal.time_end+'+08:00')<=Date.parse(e.closedAt||e.detectionReport.checkedAt)))continue
    if(related){related.detectionReport.latest=signal;related.detectionReport.checkedAt=new Date(now).toISOString();await repository.save(related,{expected:related.serverRevision});eventIds.push(related.id);continue}
    const mapping=JSON.parse(await readFile(join(root,'data/sensor-point-mapping.json'),'utf8')).pointList
    const ids=(signal.details?.sourcePoints||[]).map(p=>mapping.find(m=>m.pointDataId===p.pointDataId)).filter(Boolean).map(p=>localPointIds[p.pointCode])
    if(!ids.length)continue
    const report=validateAnomalyReport({deviceId:'main-engine-1',sensorIds:ids,start:new Date(now-6*HOUR).toISOString(),end:new Date(now).toISOString(),description:`周期检测信号：${signal.event_type}；${signal.sensors.join('、')}。需核对工况及现场状态。`},'captain',now)
    report.evidence=evidenceReader(root,report,directory)
    const analyzed=await analyze({report,role:'captain',detection:{devices:[{events:[signal]}]},skillName:'ship-anomaly-detection'},{root,configuration,knowledge,fetcher,emit:()=>{}})
    const state={events:{},notices:[]},event=createManualAnomaly(state,report,analyzed,`${fingerprint}-${now}`,{at:new Date(now).toISOString()})
    event.id=`detected-${fingerprint}-${now}`;event.number=event.number.replace('-MR-','-AI-');event.brief.id=event.id
    event.type=/iqr|trend|gradual/.test(signal.channel+' '+signal.event_type)?'异动跟踪':'预警事件';event.tracking=event.type==='异动跟踪'
    event.brief.discovery={kind:'periodic-detection',label:'周期异常检测',at:new Date(now).toISOString(),text:analyzed.anomaly.summary}
    event.sensorScope={deviceId:report.deviceId,systems:report.systems,sensorIds:ids};event.detectionReport={...report,kind:'periodic',submittedAt:new Date(now).toISOString(),generatedAt:new Date(clock()).toISOString(),fingerprint,latest:signal,checkedAt:new Date(now).toISOString(),analysis:analyzed.anomaly,evidence:report.evidence};delete event.manualReport;delete event.submitter
    event.skill='ship-anomaly-detection';await repository.save(event);eventIds.push(event.id)
   }
   const receipt={id,startedAt:now,completedAt:clock(),eventIds,rows:result.rows,skill:'ship-anomaly-detection'}
   await writeFile(join(dir,'receipt.json'),JSON.stringify(receipt,null,2));runRecord(id,'complete',receipt)
   const complete=db.prepare("SELECT id,json FROM runs WHERE status='complete' AND id LIKE 'detect-%'").all().sort((a,b)=>JSON.parse(b.json).completedAt-JSON.parse(a.json).completedAt)
   for(const old of complete.slice(6)){const target=resolve(directory,'detection-history',old.id);if(dirname(target)!==resolve(directory,'detection-history')||!/^detect-\d+-[a-f0-9-]+$/.test(old.id))continue;if(existsSync(target)){if((await lstat(target)).isSymbolicLink()||(await realpath(target)).toLowerCase()!==target.toLowerCase())continue;await rm(target,{recursive:true,force:true})}db.prepare('DELETE FROM runs WHERE id=?').run(old.id)}
  }catch(error){runRecord(id,'error',{startedAt:now,error:error.message,retryAt:now+5*60000});console.error('Periodic detection:',error.message)}
 }
 async function observe(event,phase,now){
  const id='observe-'+hash([event.id,phase.id,phase.at,phase.observationDueAt]).slice(0,32),prior=db.prepare('SELECT * FROM runs WHERE id=?').get(id)
  if(prior&&(prior.status==='complete'||JSON.parse(prior.json).retryAt>now))return
  runRecord(id,'running',{startedAt:now})
  try{
   const evidence=evidenceReader(root,{...event.sensorScope,start:phase.at,end:phase.observationDueAt,allRelated:true},directory)
   const instruction=await skillInstruction(root,'ship-effect-observation'),context={event:{id:event.id,title:event.title,reports:event.reports.filter(r=>r.kind!=='观察报告').slice(-2)},plan:phase.observationPlan||event.observationPlan,start:phase.at,end:phase.observationDueAt,sensors:evidence.map(({trendData,...s})=>s)}
   let value,model
   if(observationModel){value=await observationModel(context);model='test'}else{const config=await configuration.read();if(!config.enabled)throw Error('模型已停用，观察报告等待重试。');const provider=await resolveProvider(config);const result=await invokeModel(provider,{...config,maxTokens:8192},instruction,hiddenContext(context),fetcher,{});value=JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));model=result.model}
   if(['summary','analysis','next'].some(k=>typeof value[k]!=='string'||!value[k].trim()||value[k].length>10000))throw Error('观察报告格式不完整。')
   const current=repository.get(event.id),currentPhase=current?.phases.find(p=>p.id===phase.id)
   if(!current||unavailable(current)||current.phase==='closed'||!currentPhase?.observationWaiting||currentPhase.observationDueAt!==phase.observationDueAt){runRecord(id,'cancelled',{at:now});return}
   const reportId='observation-report-'+phase.id,at=new Date(now).toISOString()
   const report={id:reportId,eventId:event.id,eventNumber:event.number,title:event.title+' · 观察报告',kind:'观察报告',owner:'系统观察',at,summary:value.summary,model,skill:'ship-effect-observation',observationSnapshot:{plan:context.plan,windowStart:phase.at,windowEnd:phase.observationDueAt,sensors:evidence},markdown:`# ${event.title} · 观察报告\n\n## 本轮结论\n${value.summary}\n\n## 观察窗口\n${phase.at} — ${phase.observationDueAt}\n\n## 研判依据\n${value.analysis}\n\n## 传感器记录\n${evidence.map(s=>`- ${s.name}：${s.sampleCount} 个有效采样；均值 ${s.mean===null?'未取得':s.mean.toFixed(2)} ${s.unit}；范围 ${s.min??'—'}～${s.max??'—'} ${s.unit}；${s.covered?'窗口覆盖完整':'覆盖不足，待核实'}。`).join('\n')}\n\n## 后续建议\n${value.next}`}
   if(!current.reports.some(r=>r.id===reportId))current.reports.push(report)
   delete currentPhase.observationError
   Object.assign(currentPhase,{observationWaiting:false,observationReview:true,observationReportId:reportId,reportId,observationCompletedAt:at});current.status='待决策';current.unread.captain=true
   const task=current.observationSource?.task||current.tasks.find(t=>t.id===phase.observationTaskId)
   if(task)task.observation={checkedAt:at,source:'设备时序数据库',records:[{id,windowStart:phase.at,windowEnd:phase.observationDueAt,sampleCount:Math.max(0,...evidence.map(s=>s.sampleCount)),covered:evidence.length>0&&evidence.every(s=>s.covered),channels:evidence,summary:value.summary}],conditions:{met:evidence.find(s=>s.pointCode==='DC0001')?.mean>5,reason:'结合本窗口转速及各测点核对工况。'}}
   ;(current.conversations.captain||=[]).push({id:id+'-notice',kind:'receipt',title:'效果观察报告已生成',text:value.summary,reportId,at})
   await repository.save(current,{expected:current.serverRevision});runRecord(id,'complete',{completedAt:now,eventId:event.id,reportId})
  }catch(error){runRecord(id,'error',{startedAt:now,error:error.message,retryAt:now+5*60000});console.error('Observation report:',error.message);const latest=repository.get(event.id),waiting=latest?.phases.find(p=>p.id===phase.id);if(waiting?.observationWaiting&&!unavailable(latest)){waiting.observationError=true;await repository.save(latest,{expected:latest.serverRevision}).catch(()=>{})}}
 }
 async function tick(){
  if(busy||closing||!lock('background',clock()))return
  busy=true
  const heartbeat=setInterval(()=>db.prepare('UPDATE workflow_locks SET until_at=? WHERE name=? AND pid=?').run(clock()+10*60000,'background',process.pid),60000);heartbeat.unref?.()
  pending=(async()=>{try{const now=clock();for(const event of repository.list())if(!unavailable(event)&&event.phase!=='closed')for(const phase of event.phases)if(phase.observationWaiting&&Date.parse(phase.observationDueAt)<=now)await observe(event,phase,now);await periodic(now)}finally{clearInterval(heartbeat);busy=false;unlock('background')}})()
  return pending
 }
 return {repository,manual,save,visible,authorize,tick,startedAt,async status(){return {startedAt,nextAt:startedAt+(Math.floor((clock()-startedAt)/HOUR)+1)*HOUR,runs:db.prepare('SELECT * FROM runs ORDER BY rowid DESC LIMIT 12').all().map(r=>({id:r.id,status:r.status,...JSON.parse(r.json)}))}},start(){if(!timer){void tick();timer=setInterval(()=>void tick(),15000);timer.unref?.()}},async close(){if(closing)return;closing=true;clearInterval(timer);await pending;await Promise.allSettled([...inFlight.values()]);await repository.close()}}
}

export async function workflowHandler(root){
 const service=await getWorkflowService(root)
 return async(req,res,next)=>{
  const path=req.url.split('?')[0];if(!['/api/workflow/events','/api/workflow/save','/api/workflow/status'].includes(path))return next()
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  if(!req.user)return send(401,{error:'请先登录。'})
  try{
   if(path==='/api/workflow/events'&&req.method==='GET')return send(200,{events:service.visible(req.user)})
   if(path==='/api/workflow/status'&&req.method==='GET')return send(200,await service.status())
   if(path==='/api/workflow/save'&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12*1024*1024)throw Error('事件记录过大。')}const body=JSON.parse(raw);return send(200,{event:await service.save(body.event,body.revision,req.user)})}
   return send(405,{error:'不支持的请求方法。'})
  }catch(error){return send(error.status||400,{error:error.message})}
 }
}
export function localWorkflowPlugin(){return {name:'ship-workflow',async configureServer(server){if(server.config.server.middlewareMode)return;const service=await getWorkflowService(server.config.root);service.start();const handler=await workflowHandler(server.config.root);server.middlewares.use((req,res,next)=>void handler(req,res,next));server.httpServer?.once('close',()=>void service.close())}}}
