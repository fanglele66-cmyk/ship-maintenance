import {mainCylinderSensorBindings} from './sensors.js'

// Explicit physical bindings only. The safety channel is intentionally missing
// until a matching stream exists; exhaust-valve spring air is a different signal.
const bindings={
 'real-alarm-0430':['s-046',mainCylinderSensorBindings[1].exhaust],
 'real-warning-0523':['main-control-air-pressure','main-control-air-safety-pressure'],
 fault:['s-007','s-017'],maintenance:['s-018','s-019'],
 'aux-maintenance':['aux-2-exhaust','aux-2-water'],
}
export function repairObservationSource(sensorStore,id,config,start,end){
 const cylinder=id==='real-maintenance-c4-baseline'?4:id==='real-maintenance-c1-baseline'?1:null
 if(cylinder){
  const ids=[1,2,3,4,5,6].map(number=>mainCylinderSensorBindings[number].exhaust)
  const channels=sensorStore.recordedSensorChannels(ids,start,end)
  const peers=channels.map(channel=>new Map(channel.trendData.map(point=>[point.timestamp,point.value])))
  const times=[...new Set(channels.flatMap(channel=>channel.trendData.map(point=>point.timestamp)))].sort((a,b)=>a-b)
  return [{channelId:`cyl-${cylinder}-minus-peers`,name:config.names[0],unit:'°C',sourceKind:'prototype',
   trendData:times.map(timestamp=>{const values=peers.map(channel=>channel.get(timestamp));return {timestamp,value:values.every(Number.isFinite)?Number((values[cylinder-1]-(values.reduce((a,b)=>a+b,0)-values[cylinder-1])/5).toFixed(2)):null}})}]
 }
 const ids=bindings[id]||config.names.map(name=>sensorStore.allSensors.find(sensor=>sensor.nameCn===name&&sensor.unit===config.units[config.names.indexOf(name)])?.id||'unmapped:'+name)
 return sensorStore.recordedSensorChannels(ids,start,end).map((channel,index)=>{
  const unit=config.units[index],scale=channel.unit===unit?1:channel.unit==='bar'&&unit==='MPa'?0.1:null
  return {...channel,name:config.names[index],unit,trendData:channel.trendData.map(point=>({...point,value:scale!==null&&Number.isFinite(point.value)?Number((point.value*scale).toFixed(3)):null}))}
 })
}
