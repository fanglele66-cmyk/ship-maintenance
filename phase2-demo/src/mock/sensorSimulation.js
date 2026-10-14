// Engineering-style demo assumptions, NOT OEM operating limits or measured data.
// Slow-speed reference: https://www.man-es.com/marine/products/two-stroke-engines
import {cruiseMotion} from './cruiseMotion.js'
// Match like-for-like signals. Pressure uses fractional deviation because source
// unit labels need verification; no undocumented bar-to-MPa conversion is made.
export const cruiseMotionMapping={
 's-001':{channel:'DC0042'},'s-002':{channel:'DC0041',relative:true},
 's-004':{channel:'DC0008'},'s-005':{channel:'DC0010'},'s-046':{channel:'DC0009'},
 's-007':{channel:'DC0046'},'s-008':{channel:'DC0045'},
 's-009':{channel:'DC0028',relative:true},'s-010':{channel:'DC0029'},
 's-011':{channel:'DC0059',relative:true},'s-012':{channel:'DC0001'},
}
export const simulationDefaults = {enabled:true,intervalSeconds:30,strength:1}
export const navigationSimulationProfile={speed:9.8,amplitude:0.12,timeScale:4}
export const simulationProfiles = {
 'main-engine-1':{type:'慢速二冲程主机',operating:true,rpm:95},
 'aux-engine-1':{type:'辅机发电机组',operating:true,rpm:750},
 'aux-engine-2':{type:'辅机发电机组',operating:true,rpm:750},
 'aux-engine-3':{type:'辅机发电机组',operating:false,rpm:0},
}
// Base, amplitude, precision and alarm/reference range can be changed per point.
export const simulationOverrides = {
 's-001':{value:130,range:'120-150',amplitude:0.8}, // Heated residual fuel, compatible with viscosity reference.
 's-012':{value:95,range:'85-105',threshold:110,amplitude:0.9,precision:1},
 's-019':{range:'60-80',amplitude:0.3},
 's-016':{alarmDirection:'low'},'s-017':{alarmDirection:'low'},
}
export function buildSimulationSensors(existing){
 const main=existing.map(s=>({...s,...simulationOverrides[s.id],...(s.id==='s-012'?{value:simulationProfiles['main-engine-1'].rpm}:{})}))
 main.push({id:'ship-speed',nameCn:'航速',nameEn:'Ship speed',deviceId:'ship',device:'船舶',system:'航行系统',subsystem:'航行监测',unit:'kn',value:navigationSimulationProfile.speed,amplitude:navigationSimulationProfile.amplitude,timeScale:navigationSimulationProfile.timeScale,precision:1,status:'normal'})
 main.push({id:'main-load',nameCn:'主机负荷',nameEn:'Main engine load',deviceId:'main-engine-1',device:'主机',system:'主机系统',subsystem:'负荷监测',unit:'%',value:70,amplitude:1.2,precision:1,range:'0-100',status:'normal'})
 const points=[
  ['rpm','转速','Engine speed','转速监测','rpm',750,0.8,'740-760'],
  ['load','发电负荷','Generator load','发电系统','%',52,1.2,'0-85'],
  ['exhaust','排气温度','Exhaust gas temperature','排温系统','°C',365,2,'250-450'],
  ['water','冷却水出口温度','Cooling water outlet','冷却系统','°C',79,0.4,'70-85'],
  ['oil-temp','滑油温度','Lubricating oil temperature','滑油系统','°C',65,0.3,'55-75'],
  ['oil-press','滑油压力','Lubricating oil pressure','滑油系统','MPa',0.45,0.005,'0.3-0.6'],
 ]
 for(let n=1;n<=3;n++)for(const [key,nameCn,nameEn,subsystem,unit,base,amplitude,range] of points){
  const profile=simulationProfiles[`aux-engine-${n}`],standby=!profile.operating
  const value=standby?({rpm:0,load:0,exhaust:34,water:60,'oil-temp':40,'oil-press':0.04}[key]):(key==='rpm'?profile.rpm:base)+(key==='load'?(n===1?-4:4):key==='exhaust'?(n===1?-6:6):0)
  main.push({id:`aux-${n}-${key}`,nameCn:`${n}号辅机${nameCn}`,nameEn:`DG${n} ${nameEn}`,device:`${n}号辅机`,deviceId:`aux-engine-${n}`,system:'辅机系统',subsystem,unit,value,amplitude:standby?(key==='rpm'||key==='load'?0:amplitude*0.25):amplitude,precision:unit==='MPa'?3:1,range:standby?undefined:range,status:'normal',operating:!standby})
 }
 return main
}
const hash=text=>[...String(text)].reduce((sum,c)=>sum+c.charCodeAt(0),0)
const positiveMod=(value,size)=>((value%size)+size)%size
const randomAt=(seed,index)=>{let x=Math.imul(index^seed,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967295*2-1}
function irregularMotion(seed,seconds,period){
 const bucket=Math.floor(seconds/period),fraction=seconds/period-bucket
 return randomAt(seed,bucket)*(1-fraction)+randomAt(seed,bucket+1)*fraction
}
function historicalMotion(sensor,time){
 const mapping=cruiseMotionMapping[sensor.id]
 if(!mapping)return null
 const column=cruiseMotion.channels.indexOf(mapping.channel),size=cruiseMotion.frames.length
 // Reflect at the edges instead of jumping abruptly from the last sample to first.
 const step=positiveMod(Math.floor(time/(cruiseMotion.stepSeconds*1000)),2*(size-1))
 const index=step<size?step:2*(size-1)-step
 const scale=cruiseMotion.sourceP95Deviation[column]
 const amplitude=mapping.relative?Math.min(Math.abs(sensor.value)*.06,Math.abs(sensor.value)*scale/Math.abs(cruiseMotion.sourceCenters[column])):scale
 return cruiseMotion.frames[index][column]*amplitude
}
export function simulationValue(sensor,time,config=simulationDefaults){
 if(!config.enabled||!sensor.unit||sensor.amplitude===0)return sensor.value
 const seconds=time/1000/(sensor.timeScale||1),seed=hash(sensor.id),deviceSeed=hash(sensor.deviceId)
 // Unmapped points use bounded, nonperiodic multi-timescale movement, not sine waves.
 const load=.50*irregularMotion(deviceSeed,seconds,180)+.25*irregularMotion(deviceSeed+31,seconds,1100)
 const local=.15*irregularMotion(seed+71,seconds,65)+.10*randomAt(seed,Math.floor(seconds/30))
 const defaultAmplitude=({rpm:sensor.deviceId==='main-engine-1'?0.9:0.8,'°C':0.6,MPa:0.004,cSt:0.12,'mm/s':0.04,'%':0.4,'°':0.3,s:0.025}[sensor.unit])??Math.max(Math.abs(sensor.value)*0.007,0.015)
 const amplitude=sensor.amplitude??defaultAmplitude
 const motion=historicalMotion(sensor,time)??amplitude*(load+local)
 const value=sensor.value+Math.max(0,Math.min(3,Number(config.strength)||0))*motion
 const precision=sensor.precision??(sensor.unit==='MPa'?3:1)
 return Number(Math.max(sensor.unit==='°'? -35:0,value).toFixed(precision))
}
export function simulationSample(sensor,time,config=simulationDefaults){
 const value=simulationValue(sensor,time,config)
 const range=String(sensor.range||'').match(/^(-?[\d.]+)-(-?[\d.]+)$/)
 const outside=range&&(value<Number(range[1])||value>Number(range[2]))
 const alarm=sensor.threshold!=null&&(sensor.alarmDirection==='low'?value<sensor.threshold:value>sensor.threshold)
 return {...sensor,value,status:outside||alarm?'over':sensor.status==='warning'?'warning':'normal',sampledAt:time}
}
export function simulationTrend(sensor,start,end,config=simulationDefaults,maxPoints=900){
 const step=Math.max(config.intervalSeconds*1000,Math.ceil((end-start)/maxPoints/(config.intervalSeconds*1000))*config.intervalSeconds*1000)
 const points=[]
 for(let at=Math.ceil(start/step)*step;at<end;at+=step)points.push({timestamp:at,time:new Date(at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),value:simulationValue(sensor,at,config)})
 points.push({timestamp:end,time:new Date(end).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),value:simulationValue(sensor,end,config)})
 return points
}
