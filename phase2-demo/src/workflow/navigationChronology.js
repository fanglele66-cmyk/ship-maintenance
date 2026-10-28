import {aisNavigationReplay} from '../mock/aisNavigationReplay.js'
// Boundaries follow recorded state transitions, not equal-duration buckets.
export function navigationChronology(sensorStore,end){
 const format=v=>new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'})
 const periods=aisNavigationReplay(end).map(p=>({...p,time:format(p.start)+' — '+format(p.end),status:p.state,detail:p.detail+` 主机 ${p.rpm[0]}–${p.rpm[1]} rpm，负荷 ${p.load[0]}–${p.load[1]}%。`,ais:`${p.navigation} · 航速 ${p.sog[0].toFixed(1)}–${p.sog[1].toFixed(1)} kn · ${p.cog===null?'锚泊，无稳定航向':'航向 '+p.cog+'°'}`,position:`${p.latitude.toFixed(4)}°N / ${p.longitude.toFixed(4)}°E`}))
 const start=end-86400000
 return {start,end,label:format(start)+' — '+format(end),source:'AIS 航迹回放',periods,markdown:`# 长航碧玉 · 24小时工况态势报告\n\n统计时间：${format(start)} — ${format(end)}\n\n数据来源：内置 AIS 与机舱运行记录回放，尚未连接实船 AIS 服务。\n\n${periods.map(p=>'## '+p.time+' · '+p.status+'\n\n'+p.detail+'\n\nAIS：'+p.ais+'\n\n时段末位置：'+p.position).join('\n\n')}`}
}
