// Imported only by the manual CLI and tests. Never registered with hourly jobs.
import {createHash} from 'node:crypto'
import {existsSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import {join} from 'node:path'
import {createManualAnomaly,reportSensors} from '../src/workflow/manualAnomaly.js'
import {people} from '../src/workflow/lifecyclePermissions.js'
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const numeric=value=>typeof value==='number'&&Number.isFinite(value)
export function buildTrackingEvents(bundle,{now=Date.now()}={}){
 if(bundle?.schemaVersion!=='ship2.health-tracking.v1'||!Array.isArray(bundle.candidates)||bundle.schedulerEnabled!==false)throw Error('异动跟踪产物格式不正确')
 if(!/^[a-f0-9]{64}$/.test(bundle.baselineSha256)||!/^[a-f0-9]{64}$/.test(bundle.resultSha256))throw Error('缺少基线或结果校验信息')
 const sensors=reportSensors('main-engine-1'),seen=new Set(),events=[]
 for(const candidate of bundle.candidates){
  const sensor=sensors.find(s=>s.pointCode===candidate.pointCode),start=Date.parse(candidate.start),end=Date.parse(candidate.end)
  if(!sensor||!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end>now+60000)throw Error('异动跟踪测点或窗口不正确')
  if(seen.has(candidate.pointCode)||!Array.isArray(candidate.series)||candidate.series.length<3||candidate.series.length>480)throw Error('异动跟踪测点重复或曲线不完整')
  seen.add(candidate.pointCode)
  if(candidate.unit!==sensor.unit||!['cruise','maneuver_high','midlow','low_speed'].includes(candidate.zone))throw Error('异动跟踪单位或运行工况不匹配')
  const latest=candidate.latest
  if(!latest||!['raw_value','baseline_median','z','ewma','cusum_7d_area','cusum_30d_area','health_score'].every(k=>numeric(latest[k]))||latest.health_score<0||latest.health_score>100)throw Error('异动跟踪指标不完整')
  let previous=-Infinity
  for(const point of candidate.series){if(!numeric(point.timestamp)||point.timestamp<start||point.timestamp>end||point.timestamp<=previous)throw Error('异动跟踪曲线时间不正确');previous=point.timestamp}
  if(latest.timestamp!==end||candidate.series.at(-1).timestamp!==end)throw Error('异动跟踪末值与窗口不一致')
  const direction=['上移','下移','波动'].includes(candidate.direction)?candidate.direction:'波动',at=new Date(now).toISOString()
  const summary=`${sensor.nameCn}相对固定健康基线${direction}；最近健康分${latest.health_score.toFixed(1)}，标准化残差${latest.z.toFixed(2)}，连续窗口偏离需现场核实。`
  const analysis={title:`${sensor.nameCn}相对健康基线${direction}跟踪`,summary,
   interpretation:`本轮覆盖${candidate.spanDays}天、${candidate.validWindows}个可比运行窗口。采用分转速区间固定中位数/MAD基线，结合残差、EWMA与7/30天累计偏离评估；评分分档表示跟踪优先级，不代表已确认设备故障。`,
   unverified:'核实测点安装及校验、现场与系统读数、可比工况及期间检修调整；未确认偏离原因和部件故障。',
   recommendation:'安排现场读数与同工况历史对照，确认趋势是否成立后，由轮机长决定继续观察或维保安排。',
   steps:[{label:'核实测点与现场读数',guide:`对照${sensor.nameCn}现场独立示值与系统记录，记录时刻、单位及传感器接线和校验情况。`,checks:['现场与系统示值是否一致','探头安装和校验记录是否正常'],recordHint:'回交现场读数、系统读数、时刻及测点状态。'},
    {label:'核实同工况偏离与调整记录',guide:'结合转速区间、燃油指令及相邻测点，核对偏离是否持续；查看期间维护、换件和设定调整记录。',checks:['同工况下偏离是否仍存在','期间维护或调整能否解释变化'],recordHint:'记录趋势是否成立及其证据；原因不明与趋势不成立分别说明。'}]}
  const fingerprint=hash([candidate.pointCode,candidate.zone,bundle.baselineSha256]).slice(0,20),requestId=hash([fingerprint,candidate.end]).slice(0,32)
  const trendData=candidate.series.map(p=>({timestamp:p.timestamp,value:numeric(p.raw_value)?p.raw_value:null}))
  const report={deviceId:'main-engine-1',sensorIds:[sensor.id],systems:[sensor.subsystem],start:candidate.start,end:candidate.end,description:summary,submitter:{role:'captain',name:people.captain},evidence:[{channelId:sensor.id,name:sensor.nameCn,unit:sensor.unit,sourceKind:'health-score-window',trendData}]}
  const event=createManualAnomaly({events:{},notices:[]},report,{anomaly:analysis,sources:[]},requestId,{at})
  event.id='detected-tracking-'+requestId;event.number=event.number.replace('-MR-','-TR-');event.type='异动跟踪';event.tracking=true
  event.brief.id=event.id;event.brief.discovery={kind:'health-tracking',label:'长期健康基线分析',at,text:summary}
  event.sensorScope={deviceId:report.deviceId,systems:report.systems,sensorIds:report.sensorIds}
  event.detectionReport={...event.manualReport,kind:'health-tracking',analysis,evidence:report.evidence,
   healthTracking:{pointCode:candidate.pointCode,unit:sensor.unit,zone:candidate.zone,validWindows:candidate.validWindows,spanDays:candidate.spanDays,latest,baselineSha256:bundle.baselineSha256,policy:bundle.policy}}
  delete event.manualReport;delete event.submitter
  event.trackingReport={fingerprint,baselineSha256:bundle.baselineSha256,resultSha256:bundle.resultSha256,policy:bundle.policy,candidate,health:bundle.health,generatedAt:at}
  event.skill='ship-health-score';event.generatedBy='fixed-baseline-analysis'
  event.conversations.captain=[{id:event.id+'-analysis',kind:'receipt',title:'异动跟踪分析已生成',text:summary+'\n\n'+analysis.recommendation,at}]
  events.push(event)
 }
 return events
}

export async function importTrackingEvents(repository,bundle,{directory,now=Date.now()}={}){
 const incoming=buildTrackingEvents(bundle,{now}),result={created:[],updated:[],unchanged:[],suppressed:[]},deleted=new Set()
 if(directory&&existsSync(join(directory,'accounts.sqlite'))){const db=new DatabaseSync(join(directory,'accounts.sqlite'),{readOnly:true});try{for(const row of db.prepare('SELECT id FROM deleted_events').all())deleted.add(row.id)}finally{db.close()}}
 for(const fresh of incoming){
  const matching=repository.list().filter(e=>e.trackingReport?.fingerprint===fresh.trackingReport.fingerprint)
  const old=matching.find(e=>e.phase!=='closed'&&!deleted.has(e.id))
  if(old){
   if(Date.parse(fresh.detectionReport.end)<=Date.parse(old.detectionReport.end)){result.unchanged.push(old.id);continue}
   await repository.save({...old,brief:{...fresh.brief,id:old.id,discovery:old.brief.discovery},detectionReport:fresh.detectionReport,trackingReport:fresh.trackingReport,unread:{...old.unread,captain:true}},{expected:old.serverRevision})
   result.updated.push(old.id)
  }else if(matching.some(e=>Date.parse(fresh.detectionReport.end)<=Math.max(Date.parse(e.detectionReport.end),Date.parse(e.closedAt)||0))){result.suppressed.push(fresh.id)}
  else{await repository.save(fresh);result.created.push(fresh.id)}
 }
 return result
}
