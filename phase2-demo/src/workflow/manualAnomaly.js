import {mockSensors} from '../mock/sensors.js'
import {people} from './lifecyclePermissions.js'
import {normalizeTaskPlan} from './taskPlanning.js'

export const reportDevices=[...new Map(mockSensors.map(s=>[s.deviceId,{id:s.deviceId,name:s.device}])).values()]
export const reportSensors=deviceId=>mockSensors.filter(s=>s.deviceId===deviceId)
const copy=value=>JSON.parse(JSON.stringify(value))
const instant=value=>Date.parse(/T\d{2}:\d{2}$/.test(String(value))?value+':00+08:00':value)
export function validateAnomalyReport(form,role,now=Date.now()){
 if(!people[role])throw Error('当前身份不能上报异常。')
 const device=reportDevices.find(d=>d.id===form?.deviceId)
 if(!device)throw Error('请选择设备。')
 const ids=[...new Set(form.sensorIds||[])],catalog=reportSensors(device.id)
 if(!ids.length||ids.length>20||ids.some(id=>!catalog.some(s=>s.id===id)))throw Error('请选择该设备的 1—20 个传感器。')
 const start=instant(form.start),end=instant(form.end)
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw Error('请选择完整时间段，结束时间须晚于开始时间。')
 if(end>now+60000)throw Error('异常时间不能晚于当前时间。')
 const description=typeof form.description==='string'?form.description.trim():''
 if(description.length<5||description.length>3000)throw Error('请填写 5—3000 字的异常描述。')
 const sensors=ids.map(id=>{const s=catalog.find(s=>s.id===id);return {id,name:s.nameCn,unit:s.unit,subsystem:s.subsystem}})
 return {deviceId:device.id,device:device.name,systems:[...new Set(sensors.map(s=>s.subsystem))],sensorIds:ids,sensors,start:new Date(start).toISOString(),end:new Date(end).toISOString(),description,submitter:{role,name:people[role]}}
}
export function normalizeAnomalyAnalysis(value){
 const text=(key,max)=>{if(typeof value?.[key]!=='string'||!value[key].trim()||value[key].length>max)throw Error('AI 分析结果不完整，请重试。');return value[key].trim()}
 const result={title:text('title',80),summary:text('summary',200),interpretation:text('interpretation',1200),unverified:text('unverified',800),recommendation:text('recommendation',300)}
 result.steps=normalizeTaskPlan({scope:result.recommendation,rationale:result.interpretation,steps:value.steps},'investigate').steps
 return result
}
export function reportEvidence(report,channels=[]){
 return report.sensors.map(s=>({channelId:s.id,name:s.name,unit:s.unit,sourceKind:'prototype',trendData:(channels.find(c=>c.channelId===s.id)?.trendData||[]).filter(p=>Number.isFinite(p.timestamp)&&p.timestamp>=Date.parse(report.start)&&p.timestamp<=Date.parse(report.end)&&Number.isFinite(p.value)).slice(-64)}))
}
export function createManualAnomaly(state,report,result,requestId,{at=new Date().toISOString()}={}){
 if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw Error('上报编号无效，请重新打开表单。')
 const id='manual-'+requestId
 if(state.events[id])return state.events[id]
 const validated=validateAnomalyReport(report,report.submitter?.role),analysis=normalizeAnomalyAnalysis(result.anomaly),evidence=reportEvidence(validated,report.evidence)
 const manualReport={...validated,submittedAt:report.submittedAt||at,generatedAt:at,evidence,analysis,model:result.model,sources:result.sources||[],usage:result.usage}
 const number='CBY-EVT-'+new Date(at).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}).replaceAll('-','')+'-MR-'+requestId.slice(0,8).toUpperCase()
 const brief={id,discovery:{kind:'manual-report',label:'人工异常上报',at:manualReport.submittedAt,text:validated.description},conclusion:analysis.summary,boundary:analysis.interpretation,dispatchReason:analysis.recommendation,captainDecision:analysis.recommendation,facts:[],sources:[],tasks:analysis.steps.map(s=>({title:s.label,detail:s.guide}))}
 const event={id,number,title:analysis.title,type:'报警事件',device:validated.device,deviceId:validated.deviceId,createdAt:at,occurredAt:validated.start,tracking:false,manualReport,submitter:validated.submitter,brief,status:'待决策',phase:'reminder',currentTask:null,participants:[validated.submitter.name],tasks:[],reports:[],decisions:[],shore:[],maintenance:null,phases:[{id:'reminder',kind:'reminder',label:'初始信息',at}],conversations:Object.fromEntries(Object.keys(people).map(role=>[role,[]])),unread:{captain:true}}
 event.conversations.captain.push({id:id+'-analysis',kind:'model',status:'complete',text:analysis.summary+'\n\n'+analysis.recommendation,at,model:result.model,sources:result.sources||[]})
 state.events[id]=copy(event)
 state.notices||=[];state.notices.push({id:id+'-notice',eventId:id,recipient:'captain',title:'收到异常上报',text:validated.submitter.name+'提交：'+analysis.title,at,read:false})
 return state.events[id]
}
