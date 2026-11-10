import {openLocalData,sqlTime,toTime} from './local-data.mjs'
import {reportSensors} from '../src/workflow/manualAnomaly.js'
export function readEventEvidence(root,{deviceId,sensorIds=[],systems=[],start,end,allRelated=false},directory){
 const begin=Date.parse(start),finish=Math.min(Date.parse(end),Date.now())
 if(!Number.isFinite(begin)||!Number.isFinite(finish)||begin>=finish)throw Error('取数窗口结束时间须晚于开始时间。')
 const catalog=reportSensors(deviceId),selected=catalog.filter(s=>sensorIds.includes(s.id)),groups=new Set([...systems,...selected.map(s=>s.subsystem)])
 const points=allRelated?catalog.filter(s=>groups.has(s.subsystem)||sensorIds.includes(s.id)||['DC0001','DC0058'].includes(s.pointCode)):selected
 const stats=points.map(sensor=>({sensor,index:sensor.pointCode?Number(sensor.pointCode.slice(2))-1:-1,count:0,sum:0,min:Infinity,max:-Infinity,last:begin,maxGap:0,buckets:new Map()})),bucketMs=Math.max(12000,(finish-begin)/120)
 if(deviceId==='main-engine-1'){
  const data=openLocalData(root,directory)
  try{for(const row of data.db.prepare('SELECT timestamp,data FROM sensor_readings WHERE timestamp>=? AND timestamp<=? ORDER BY timestamp').iterate(sqlTime(begin),sqlTime(finish))){
   const timestamp=toTime(row.timestamp),values=JSON.parse(row.data)
   for(const s of stats){const value=values[s.index];if(!Number.isFinite(value))continue
    s.count++;s.sum+=value;s.min=Math.min(s.min,value);s.max=Math.max(s.max,value);s.maxGap=Math.max(s.maxGap,timestamp-s.last);s.last=timestamp;s.value=value;s.firstAt??=timestamp;s.firstValue??=value
    s.buckets.set(Math.floor((timestamp-begin)/bucketMs),{timestamp,value})
   }
  }}finally{data.close()}
 }
 return stats.map(s=>{
  const maxGap=Math.max(s.maxGap,finish-s.last),sensor=s.sensor
  return {channelId:sensor.id,pointCode:sensor.pointCode,name:sensor.nameCn,unit:sensor.unit,subsystem:sensor.subsystem,sourceKind:s.count?'local-database':'unavailable',sampleCount:s.count,start:new Date(begin).toISOString(),end:new Date(finish).toISOString(),firstAt:s.firstAt,lastAt:s.count?s.last:null,firstValue:s.firstValue??null,maximumGapSeconds:maxGap/1000,covered:s.count>0&&maxGap<=60000,min:s.count?s.min:null,max:s.count?s.max:null,mean:s.count?s.sum/s.count:null,value:s.value??null,trendData:[...s.buckets.values()]}
 })
}
