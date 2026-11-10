import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'

export const HOUR=3600000
export const toTime=s=>Date.parse(s.replace(' ','T')+(s.match(/Z$|[+-]\d\d:\d\d$/)?'':'+08:00'))
export const sqlTime=t=>new Date(t+8*HOUR).toISOString().slice(0,19).replace('T',' ')
const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null

export function coverage(rows,start,end){
 const times=rows.map(r=>toTime(r.timestamp)),gaps=[]
 let previous=start
 for(const t of times){gaps.push(Math.max(0,t-previous));previous=t}
 gaps.push(Math.max(0,end-previous))
 const maximumGapSeconds=Math.round(Math.max(...gaps,0)/1000)
 return {rows:rows.length,start:sqlTime(start),end:sqlTime(end),first:rows[0]?.timestamp||null,last:rows.at(-1)?.timestamp||null,maximumGapSeconds,
  status:!rows.length?'insufficient':maximumGapSeconds>300?'partial':'sufficient'}
}

// Classifications describe observed motion only; zero speed never proves anchoring.
const validSpeed=v=>finite(v)!==null&&v>=0&&v<102.3
const stats=values=>{const a=values.filter(Number.isFinite);return a.length?{mean:mean(a),min:Math.min(...a),max:Math.max(...a),first:a[0],last:a.at(-1),count:a.length}:null}
const number=v=>v.toFixed(1)
const range=(s,unit)=>Math.abs(s.max-s.min)<.05?`${number(s.mean)} ${unit}`:`${number(s.min)}～${number(s.max)} ${unit}`
const transition=(s,unit)=>Math.abs(s.last-s.first)<.1?`${Math.abs(s.max-s.min)<.1?'维持':'起止'} ${number(s.last)} ${unit}`:`${number(s.first)} → ${number(s.last)} ${unit}`
export function chronology(rows,ais,start,end){
 const intervals=[],bucket=30*60000
 for(let at=start;at<end;at+=bucket){
  const until=Math.min(end,at+bucket),r=rows.filter(v=>v.at>=at&&v.at<until),a=ais.filter(v=>v.at>=at&&v.at<until&&validSpeed(v.sog))
  const rpm=mean(r.map(v=>finite(v.values[0])===null?null:Math.abs(v.values[0])).filter(v=>v!==null))
  const state=rpm===null?'unknown':rpm<5?'stopped':rpm<60?'maneuver':'running'
  const last=intervals.at(-1)
  if(last?.state===state){last.end=until;last.rows.push(...r);last.ais.push(...a)}
  else intervals.push({start:at,end:until,state,rows:r,ais:a})
 }
 const periods=intervals.map((p,i)=>{
  const rpm=stats(p.rows.map(r=>r.values[0])),rpmMagnitude=stats(p.rows.map(r=>Number.isFinite(r.values[0])?Math.abs(r.values[0]):null)),speed=stats(p.ais.map(a=>a.sog)),fuel=stats(p.rows.map(r=>r.values[57]))
  const status={unknown:'数据缺失',stopped:'主机停转',maneuver:'低速运行',running:'主机运行'}[p.state]
  const minutes=Math.round((p.end-p.start)/60000),duration=minutes>=60?`${Math.floor(minutes/60)} 小时${minutes%60?` ${minutes%60} 分钟`:''}`:`${minutes} 分钟`
  return {id:`database-${i}`,start:p.start,end:p.end,state:p.state,tone:p.state==='stopped'?'anchored':p.state==='maneuver'?'maneuver':'cruising',status,
   averageSpeed:speed?.mean??null,averageRpm:rpmMagnitude?.mean??null,fuelCommandAverage:fuel?.mean??null,
   primaryMetric:speed?{label:'平均航速',value:speed.mean,unit:'kn'}:{label:rpm?.min<0?'平均转速幅值':'平均转速',value:rpmMagnitude?.mean??null,unit:'rpm'},
   detail:rpm?`时段 ${duration} · ${p.state==='stopped'&&rpmMagnitude.max>=5?'以停转为主，含短时转动；':''}转速 ${range(rpm,'rpm')}`:'等待当前时段的运行记录。',
   operationLabel:speed?'航速变化':'转速变化',
   operation:speed?`${transition(speed,'kn')}${speed.max-speed.min>=.1?`；范围 ${range(speed,'kn')}`:''}`:rpm?`${transition(rpm,'rpm')}`:'等待采集数据',
   loadTrendLabel:'燃油指令',loadTrend:fuel?`${range(fuel,'%')}；平均 ${number(fuel.mean)}%`:'等待燃油指令测量',
   measurements:{rpm,rpmMagnitude,speed,fuelCommand:fuel}}
 })
 return {periods,source:'主机转速、燃油指令与 AIS 航速',start,end,markdown:periods.map(p=>`${sqlTime(p.start)}～${sqlTime(p.end)}：${p.status}。${p.detail}。${p.operationLabel}：${p.operation}。燃油指令：${p.loadTrend}`).join('\n')}
}

export function openLocalData(root,directory=process.env.SHIP_DATA_DIR||join(root,'.local-data')){
 const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'))
 const filename=resolve(directory,manifest.database)
 if(dirname(filename)!==resolve(directory))throw Error('Invalid dataset path')
 const db=new DatabaseSync(filename,{readOnly:true});db.exec('PRAGMA query_only=ON')
 const mapping=JSON.parse(readFileSync(join(root,'data/sensor-point-mapping.json'),'utf8')).pointList
 const read=db.prepare('SELECT timestamp,source_time,source_gap_seconds,data FROM sensor_readings WHERE timestamp>=? AND timestamp<=? ORDER BY timestamp')
 const latest=db.prepare('SELECT timestamp,source_time,data FROM sensor_readings WHERE timestamp<=? ORDER BY timestamp DESC LIMIT 1')
 const tracks=db.prepare('SELECT postime,sog,lat,lon FROM ais_track WHERE postime>=? AND postime<=? ORDER BY postime')
 const decode=r=>({...r,at:toTime(r.timestamp),values:JSON.parse(r.data)})
 const rows=(start,end)=>read.all(sqlTime(start),sqlTime(end)).map(decode)
 function snapshot(now=Date.now()){
  const start=now-24*HOUR,all=rows(start,now),last=latest.get(sqlTime(now)),track=tracks.all(sqlTime(start),sqlTime(now)).map(r=>({...r,at:toTime(r.postime)}))
  const fresh=last&&now-toTime(last.timestamp)<=5*60000,ais=track.at(-1),aisFresh=ais&&now-ais.at<=30*60000
  const values=fresh?JSON.parse(last.data):[],step=Math.max(1,Math.ceil(all.length/600)),sample=all.filter((_,i)=>i%step===0||i===all.length-1)
  return {now,source:manifest.mode,sampledAt:last?toTime(last.timestamp):null,sourceTime:last?.source_time||null,quality:coverage(all,start,now),fresh:Boolean(fresh),
   exhausted:now>toTime(manifest.tables.sensor_readings.end),availableUntil:manifest.tables.sensor_readings.end,
   points:mapping.map(p=>({...p,value:finite(values[Number(p.pointCode.slice(2))-1])})),
   speed:aisFresh&&validSpeed(ais.sog)?ais.sog:null,speedSampledAt:ais?.at||null,load:null,fuelCommand:finite(values[57]),
   trends:Object.fromEntries(mapping.map(p=>[p.pointCode,sample.map(r=>({timestamp:r.at,value:finite(r.values[Number(p.pointCode.slice(2))-1])}))])),
   clockPolicy:manifest.clockPolicy,cadenceSeconds:manifest.cadenceSeconds,
   sourceSeams:all.filter(r=>r.source_gap_seconds>60).map(r=>({at:r.at,sourceTime:r.source_time,gapSeconds:r.source_gap_seconds})),
   chronology:chronology(all,track,start,now)}
 }
 return {db,manifest,mapping,rows,snapshot,close:()=>db.close()}
}
