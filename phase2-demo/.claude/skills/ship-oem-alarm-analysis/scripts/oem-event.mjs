import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {parseArgs} from 'node:util'
import {createEventRepository} from '../../../../server/event-repository.mjs'
import {readEventEvidence} from '../../../../server/event-evidence.mjs'
import {loadDeviceTypeTemplate, readShipConfig} from '../../../../server/ship-config-api.mjs'
import {createManualAnomaly, createReportCatalog, validateAnomalyReport} from '../../../../src/workflow/manualAnomaly.js'
import {localPointIds} from '../../../../src/workflow/localSensorData.js'

const appRoot=fileURLToPath(new URL('../../../../',import.meta.url))
const readJson=async file=>JSON.parse(await readFile(file,'utf8'))
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const physicalBindings={left_main_engine:'main-engine-1'}

export async function prepareAlarm(trigger,directory){
  const profile=await readJson(join(appRoot,'data/ship-profile.json'))
  if(trigger.alarm_type!=='oem_alarm'||trigger.ship_id!==profile.shipId||typeof trigger.ser_no!=='string'||!trigger.ser_no.trim())throw Error('OEM 船舶、流水号或报警类型无效。')
  const equipment=profile.devices[trigger.equipment_id],deviceId=physicalBindings[trigger.equipment_id]
  if(!equipment?.deviceDataId||!deviceId)throw Error('该硬件设备尚未绑定到船端实例。')
  const mapping=await readJson(join(appRoot,'data/sensor-point-mapping.json'))
  const matches=mapping.pointList.filter(p=>p.shipId===profile.shipId&&p.deviceDataId===equipment.deviceDataId&&p.pointDataId===trigger.pointDataId)
  if(matches.length!==1)throw Error('报警点不能唯一匹配到本船设备。')
  const template=loadDeviceTypeTemplate(appRoot),config=await readShipConfig(directory,template)
  const device=config.devices.find(d=>d.id===deviceId),code=matches[0].pointCode
  const point=template.deviceTypes.find(t=>t.deviceTypeId===device?.deviceTypeId)?.points.find(p=>p.pointCode===code)
  const configured=device?.points.find(p=>p.pointCode===code)
  if(point?.pointKind!=='alarm'||!point.alarmStateSpec||!configured)throw Error('设备实例未配置该硬件报警点。')
  const spec=point.alarmStateSpec
  const {previous_state:previous,current_state:current}=trigger.alarm_state_transition||{}
  if(![previous,current].every(v=>v===spec.normalValue||v===spec.activeValue))throw Error('报警状态不符合点位模板。')
  const timestamp=trigger.trigger_time
  if(typeof timestamp!=='string'||!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)?$/.test(timestamp))throw Error('缺少有效的硬件触发时间。')
  const milliseconds=Date.parse(timestamp.replace(' ','T')+(/Z$|[+-]\d\d:\d\d$/.test(timestamp)?'':'+08:00'))
  if(!Number.isFinite(milliseconds)||milliseconds>Date.now()+60000)throw Error('硬件触发时间无效或晚于当前时间。')
  const at=new Date(milliseconds).toISOString()
  const rising=previous===spec.normalValue&&current===spec.activeValue
  const identity=[profile.shipId,trigger.ser_no]
  const alarm={shipId:profile.shipId,serNo:trigger.ser_no,equipmentId:trigger.equipment_id,deviceDataId:equipment.deviceDataId,pointDataId:trigger.pointDataId,pointCode:code,triggerTime:at,previous,current}
  const key='oem-'+digest(rising?identity:[...identity,at,previous,current]).slice(0,32)
  const reason=!rising?'非首次激活跳变':(!device.enabled||!device.alarms.oem.enabled||!configured.enabled)?'设备、OEM 研判或点位已停用':''
  const base={key,alarm,rawTrigger:trigger,reason,device:device.name,pointName:configured.instanceName||point.defaultName}
  if(reason)return {...base,outcome:'record-only'}
  const pointCatalog=createReportCatalog(config.devices,template)
  const report=validateAnomalyReport({deviceId,sensorIds:[localPointIds[code]],start:new Date(milliseconds-10*60000).toISOString(),end:at,description:`${base.device}「${base.pointName}」硬件报警由 ${previous} 跳变为 ${current}。`},'captain',Date.now(),pointCatalog)
  delete report.submitter
  report.evidence=readEventEvidence(appRoot,report,directory,pointCatalog)
  return {...base,outcome:'review',reviewId:digest({alarm,report}),report}
}

function evaluate(preparation,review){
  if(preparation.outcome==='record-only')return {outcome:'record-only',reason:preparation.reason}
  if(!review||review.reviewId!==preparation.reviewId)throw Error('需要与本次报警及采样证据匹配的研判结果。')
  if(review.outcome==='record-only'&&typeof review.reason==='string'&&review.reason.trim())return {outcome:'record-only',reason:review.reason.trim()}
  if(review.outcome!=='event')throw Error('研判必须给出事件建议或仅记录的具体理由。')
  const at=new Date().toISOString(),{alarm,report,key}=preparation
  const event=createManualAnomaly({events:{}},{...report,submitter:{role:'captain'}},{anomaly:review.analysis},key.slice(4),{at})
  event.id=key;event.brief.id=key;event.number=event.number.replace('-MR-','-OEM-')
  event.device=report.device;event.occurredAt=alarm.triggerTime
  event.brief.discovery={kind:'ship-alarm',label:'OEM 硬件报警',at:alarm.triggerTime,text:report.description}
  event.brief.facts=[{label:preparation.pointName,value:`${alarm.previous} → ${alarm.current}`,unit:'',at:alarm.triggerTime,meaning:'硬件报警状态跳变'}]
  event.skill='ship-oem-alarm-analysis'
  event.sensorScope={deviceId:report.deviceId,systems:report.systems,sensorIds:report.sensorIds}
  event.detectionReport={...report,kind:'oem',submittedAt:alarm.triggerTime,generatedAt:at,analysis:event.manualReport.analysis,alarm}
  delete event.detectionReport.submitter
  delete event.manualReport
  delete event.submitter
  return {outcome:'event',event}
}

export async function publishAlarm(preparation,review,directory){
  const repository=await createEventRepository(directory),{db}=repository
  try {
    db.exec('CREATE TABLE IF NOT EXISTS oem_alarm_receipts(id TEXT PRIMARY KEY, alarm TEXT NOT NULL, raw_trigger TEXT NOT NULL, receipt TEXT NOT NULL)')
    db.exec('BEGIN IMMEDIATE')
    try {
      const {key,alarm}=preparation
      const saved=db.prepare('SELECT * FROM oem_alarm_receipts WHERE id=?').get(key)
      if(saved){
        if(saved.alarm!==JSON.stringify(alarm))throw Error('同一报警流水号已对应其他触发证据。')
        db.exec('COMMIT')
        return {...JSON.parse(saved.receipt),replayed:true}
      }
      if(repository.get(key))throw Error('该事件编号已有记录且没有匹配的 OEM 回执。')
      const {outcome,reason,event}=evaluate(preparation,review)
      if(event)await repository.save(event)
      const receipt={outcome,...(event?{eventId:key}:{reason}),at:new Date().toISOString()}
      db.prepare('INSERT INTO oem_alarm_receipts VALUES(?,?,?,?)').run(key,JSON.stringify(alarm),JSON.stringify(preparation.rawTrigger),JSON.stringify(receipt))
      db.exec('COMMIT')
      return receipt
    } catch(error){db.exec('ROLLBACK');throw error}
  } finally {await repository.close()}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try {
    const {values}=parseArgs({options:{trigger:{type:'string'},review:{type:'string'},'data-dir':{type:'string'},publish:{type:'boolean'}}})
    if(!values.trigger||!values['data-dir'])throw Error('请指定 --trigger 与 --data-dir；正式写入另加 --publish。')
    const directory=resolve(values['data-dir']),prepared=await prepareAlarm(await readJson(values.trigger),directory)
    const review=values.review?await readJson(values.review):undefined
    const result=values.publish?await publishAlarm(prepared,review,directory):review?evaluate(prepared,review):prepared
    console.log(JSON.stringify(result,null,2))
  } catch(error){console.error(error.message);process.exitCode=1}
}
