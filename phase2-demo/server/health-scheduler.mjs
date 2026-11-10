import {DatabaseSync} from 'node:sqlite'
import {mkdir,readFile,writeFile,rename,cp} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createHash} from 'node:crypto'
import {configStore,resolveProvider} from './ai-config.mjs'
import {invokeModel} from './model.mjs'
import {HOUR,sqlTime} from './local-data.mjs'
const execute=promisify(execFile)
const jsonRead=async file=>{try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
export async function atomicWrite(file,value){await writeFile(file+'.tmp',value,'utf8');await rename(file+'.tmp',file)}

export function healthModelFacts(facts){
 const devices=Object.fromEntries(Object.entries(facts.result.devices).map(([id,d])=>[id,Object.fromEntries(['device_name','status','health_status','health_score','operating_condition','analysis_highlights','context'].filter(key=>d[key]!==undefined).map(key=>[key,d[key]]))]))
 return {devices,window:{start:facts.coverage.start,end:facts.coverage.end,rows:facts.coverage.rows,maximumGapSeconds:facts.coverage.maximumGapSeconds},units:facts.units}
}
export function validateHealthLanguage(report){
 const text=[report.conclusion,report.next,report.detail].join('\n')
 if(/回放|复刻|源数据拼接|原始连续片段|数据局限|本地.{0,6}未导入|无(?:异常与)?告警|无报警|没有告警|无异常部件|具备.{0,6}起动条件|随时起动|保证.{0,4}安全/.test(text))throw Error('研判包含技术叙述或无证据的安全结论')
}

export async function createHealthScheduler(root,{directory=process.env.SHIP_DATA_DIR||join(root,'.local-data'),clock=Date.now,analyze,enhance}={}){
 directory=resolve(directory)
 await mkdir(directory,{recursive:true})
 const jobs=new DatabaseSync(join(directory,'jobs.sqlite'))
 jobs.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS health_jobs (id TEXT PRIMARY KEY,status TEXT,attempts INTEGER,lease_until INTEGER,updated_at INTEGER,error TEXT)')
 const reportPath=join(directory,'health-latest.json')
 const inputs=['data/sensor-point-mapping.json','data/ship-profile.json','.claude/skills/ship-engine-health/scripts/run_local_health.py','.claude/skills/ship-engine-health/scripts/run_engine_health.py','.claude/skills/ship-engine-health/references/local-report.md']
 const content=await Promise.all(inputs.map(async name=>{try{return await readFile(join(root,name),'utf8')}catch(e){if(e.code==='ENOENT'&&analyze)return '';throw e}}))
 const dataset=await jsonRead(join(directory,'manifest.json'))
 const revision=createHash('sha256').update(content.join('\n')+JSON.stringify(dataset)).digest('hex').slice(0,12)
 let busy=false,timer=null,pending=null,closed=false
 const claim=now=>{
  const id=`${Math.floor(now/HOUR)}:${revision}`
  jobs.exec('BEGIN IMMEDIATE')
  try{
   if(jobs.prepare("SELECT id FROM health_jobs WHERE status='running' AND lease_until>? LIMIT 1").get(now)){jobs.exec('COMMIT');return null}
   const old=jobs.prepare('SELECT * FROM health_jobs WHERE id=?').get(id)
   if(old&&(old.status==='complete'||old.lease_until>now||old.attempts>=3)){jobs.exec('COMMIT');return null}
   jobs.prepare('INSERT INTO health_jobs VALUES (?, ?, 1, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET status=excluded.status,attempts=health_jobs.attempts+1,lease_until=excluded.lease_until,updated_at=excluded.updated_at,error=NULL').run(id,'running',now+10*60000,now)
   jobs.exec('COMMIT');return id
  }catch(e){jobs.exec('ROLLBACK');throw e}
 }
 const runSkill=analyze||(async(now)=>{
  const {stdout}=await execute(process.env.SHIP_PYTHON||'python',[join(root,'.claude/skills/ship-engine-health/scripts/run_local_health.py'),'--data-dir',directory,'--cutoff',sqlTime(now)],
   {cwd:root,windowsHide:true,timeout:180000,maxBuffer:8*1024*1024,env:{...process.env,PYTHONIOENCODING:'utf-8'}})
  return JSON.parse(stdout)
 })
 const enrich=enhance||(async facts=>{
  const config=await configStore(root).read()
  if(!config.enabled)return null
  const provider=await resolveProvider(config)
  const instruction=await readFile(join(root,'.claude/skills/ship-engine-health/references/local-report.md'),'utf8')
  const response=await invokeModel(provider,{...config,maxTokens:8192},instruction,JSON.stringify(facts))
  const parsed=JSON.parse(response.text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))
  for(const key of ['conclusion','next','detail'])if(typeof parsed[key]!=='string'||!parsed[key].trim())throw Error('健康研判正文不完整')
  validateHealthLanguage(parsed)
  return {...parsed,model:response.model,usage:response.usage}
 })
 async function publish(report){
  await atomicWrite(join(directory,'health-latest.md'),`# 主机设备健康研判\n\n更新时间：${report.completedAt}\n\n数据窗口：${report.dataCutoff}\n\n${report.detail}\n`)
  await atomicWrite(reportPath,JSON.stringify(report,null,2))
 }
 async function work(){
  if(busy||closed)return
  busy=true
  let id
  try{
   const now=clock(),manifest=await jsonRead(join(directory,'manifest.json'))
   if(!manifest)return
   id=claim(now);if(!id)return
   const facts=await runSkill(now),device=Object.values(facts.result.devices)[0]
   const quality=facts.coverage.status
   const report={jobId:id,revision,completedAt:sqlTime(clock()),window:facts.result.analysis_window,coverage:facts.coverage,
    dataCutoff:`${facts.coverage.start} ～ ${facts.coverage.end}`,
    conclusion:device?.analysis_conclusion||'可用数据不足，暂不能研判主机健康状态。',
    next:device?.recommendations?.join('；')||'检查数据覆盖后重新分析。',detail:device?.context||facts.result.context,
    healthStatus:quality==='sufficient'?device?.health_status:'unknown',modelStatus:'pending',resultPath:facts.resultPath}
   await publish(report)
   try{
    const model=await enrich(healthModelFacts(facts))
    if(model){report.conclusion=model.conclusion;report.next=model.next;report.detail=model.detail;report.model=model.model;report.usage=model.usage;report.modelStatus='complete'}
    else report.modelStatus='disabled'
   }catch{report.modelStatus='failed';report.modelError='模型研判未完成，本次显示 Skill 计算结果；下个小时重试。'}
   report.completedAt=sqlTime(clock())
   const archive=join(directory,'health-history',id.replace(':','-'))
   report.archivePath=archive
   await mkdir(archive,{recursive:true})
   await atomicWrite(join(archive,'report.json'),JSON.stringify(report,null,2))
   await atomicWrite(join(archive,'report.md'),`# 主机设备健康研判\n\n更新时间：${report.completedAt}\n\n数据窗口：${report.dataCutoff}\n\n${report.detail}\n`)
   await atomicWrite(join(archive,'skill-result.json'),JSON.stringify(facts,null,2))
   if(!analyze)await cp(join(directory,'workspace/input/sensor-raw-data'),join(archive,'sensor-raw-data'),{recursive:true})
   await publish(report)
   jobs.prepare('UPDATE health_jobs SET status=?,lease_until=0,updated_at=? WHERE id=?').run('complete',clock(),id)
  }catch(e){
   if(id)jobs.prepare('UPDATE health_jobs SET status=?,lease_until=?,updated_at=?,error=? WHERE id=?').run('failed',clock()+5*60000,clock(),String(e.message).slice(0,500),id)
   console.error('Hourly health analysis failed:',e.message)
  }finally{busy=false}
 }
 return {
  tick(){return pending||(pending=work().finally(()=>{pending=null}))},
  start(){if(!timer){void this.tick();timer=setInterval(()=>void this.tick(),30000);timer.unref?.()}},
  async status(){const latest=await jsonRead(reportPath),job=jobs.prepare('SELECT id,status,attempts,updated_at FROM health_jobs ORDER BY updated_at DESC LIMIT 1').get();return {latest,job:job||null,stale:!latest||latest.revision!==revision||clock()-Date.parse(latest.completedAt.replace(' ','T')+'+08:00')>75*60000,nextRunAt:(Math.floor(clock()/HOUR)+1)*HOUR}},
  async close(){closed=true;if(timer)clearInterval(timer);await pending;jobs.close()},
 }
}
