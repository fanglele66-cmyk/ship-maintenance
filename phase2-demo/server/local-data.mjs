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
export function chronology(rows,ais,start,end){
 const intervals=[],bucket=30*60000
 for(let at=start;at<end;at+=bucket){
  const until=Math.min(end,at+bucket),r=rows.filter(v=>v.at>=at&&v.at<until),a=ais.filter(v=>v.at>=at&&v.at<until)
  const rpm=mean(r.map(v=>finite(v.values[0])).filter(v=>v!==null)),speed=mean(a.map(v=>finite(v.sog)).filter(v=>v!==null))
  const state=rpm===null?'unknown':rpm<5?'stopped':rpm<60?'maneuver':'running'
  const last=intervals.at(-1)
  if(last?.state===state){last.end=until;last.rpms.push(...r.map(v=>v.values[0]).filter(Number.isFinite));last.speeds.push(...a.map(v=>v.sog).filter(Number.isFinite))}
  else intervals.push({start:at,end:until,state,rpms:r.map(v=>v.values[0]).filter(Number.isFinite),speeds:a.map(v=>v.sog).filter(Number.isFinite)})
 }
 const periods=intervals.map((p,i)=>{
  const rpm=mean(p.rpms),speed=mean(p.speeds),status={unknown:'数据缺失',stopped:'主机停转',maneuver:'低速运行',running:'主机运行'}[p.state]
  return {id:`database-${i}`,start:p.start,end:p.end,state:p.state,tone:p.state==='stopped'?'anchored':'cruising',status,averageSpeed:speed,
   detail:rpm===null?'此时段未采集到主机数据。':`主机平均转速 ${rpm.toFixed(1)} rpm；${speed===null?'此时段无可用 AIS 航速。':`平均航速 ${speed.toFixed(1)} kn。`}`,
   operation:p.state==='stopped'?'转速接近零；停泊状态需结合航行记录确认':p.state==='unknown'?'等待采集数据':'依据实测转速归类，未推断操纵意图',loadTrend:'未采集功率负荷；燃油指令不等同负荷'}
 })
 return {periods,source:'历史数据库副本（时间平移回放）',start,end,markdown:periods.map(p=>`${sqlTime(p.start)}～${sqlTime(p.end)}：${p.status}。${p.detail}`).join('\n')}
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
   speed:aisFresh?finite(ais.sog):null,speedSampledAt:ais?.at||null,load:null,
   trends:Object.fromEntries(mapping.map(p=>[p.pointCode,sample.map(r=>({timestamp:r.at,value:finite(r.values[Number(p.pointCode.slice(2))-1])}))])),
   clockPolicy:manifest.clockPolicy,cadenceSeconds:manifest.cadenceSeconds,
   sourceSeams:all.filter(r=>r.source_gap_seconds>60).map(r=>({at:r.at,sourceTime:r.source_time,gapSeconds:r.source_gap_seconds})),
   chronology:chronology(all,track,start,now)}
 }
 return {db,manifest,mapping,rows,snapshot,close:()=>db.close()}
}
