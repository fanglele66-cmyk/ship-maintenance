import {observationParents} from './issueRelationships.js'
import history from './realObservationHistory.json' with {type:'json'}

export const taskObservationRanges=[1,6,24]
const gapThresholdMs=history.source.gapMetadataThresholdSeconds*1000
export const normalizeObservationHours=value=>taskObservationRanges.includes(Number(value))?Number(value):24
export const observationTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}[ T]/.test(value)?Date.parse(value.replace(' ','T')+( /Z$|[+-]\d{2}:\d{2}$/.test(value)?'':'+08:00')):NaN
export const formatObservationTime=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(value)

// The longer window is loaded only by the task observation pane. Initial event
// evidence and the workflow's post-treatment observations remain separate.
export function taskObservationData(id){
 const sourceId=observationParents[id]||(id==='real-maintenance-c1-baseline'?'real-tracking-exhaust-baseline':id)
 const entry=history.cases[sourceId],window=entry&&history.windows[entry.windowId]
 if(!window)return null
 return {end:observationTime(window.requestedEnd),dataRole:sourceId!==id?'baseline-source-history':entry.dataRole,coverage:window.coverage,
  sensors:entry.channelIds.map((channelId,index)=>{
   const channel=history.channels[channelId],values=window.columns[channelId]
   return {id:id+'-'+index,channelId,name:channel.nameCn,nameCn:channel.nameCn,nameEn:channel.nameEn,unit:channel.unit,
    value:values.findLast(value=>Number.isFinite(value)),normalRange:channelId+' · '+window.coverage.lastSampleAt,
    trendData:window.times.map((time,i)=>({time,value:values[i]}))}
  })}
}

export function taskObservationWindow(sensors,end,hours){
 const duration=normalizeObservationHours(hours),start=end-duration*3600000
 const series=sensors.map(sensor=>{
  const points=sensor.trendData.map(point=>[observationTime(point.time),Number.isFinite(point.value)?point.value:null]).filter(([time])=>Number.isFinite(time)&&time>=start&&time<=end)
  const data=[]
  for(const point of points){
   const previous=data.at(-1)
   // A missing interval is a break, never a fabricated value or interpolated run.
   if(previous&&point[0]-previous[0]>gapThresholdMs)data.push([previous[0]+1,null])
   data.push(point)
  }
  return {...sensor,points,data,count:points.filter(([,value])=>value!==null).length}
 })
 return {start,end,hours:duration,series}
}
