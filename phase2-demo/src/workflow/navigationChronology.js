import {aisNavigationReplay} from '../mock/aisNavigationReplay.js'
// Boundaries follow recorded state transitions, not equal-duration buckets.
export function navigationChronology(sensorStore,end,{timeBase=end}={}){
 const format=v=>new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'})
 const replay=aisNavigationReplay(timeBase)
 replay.at(-1).end=Math.max(end,replay.at(-1).start)
 const periods=replay.filter(p=>p.end>end-86400000&&p.start<=end).map(p=>({...p,start:Math.max(p.start,end-86400000)})).map(p=>({...p,time:format(p.start)+' — '+format(p.end),status:p.state,ais:`${p.navigation} · 平均航速 ${p.averageSpeed.toFixed(1)} kn · ${p.operation} · 负荷变化：${p.loadTrend}`,position:`${p.latitude.toFixed(4)}°N / ${p.longitude.toFixed(4)}°E`}))
 const start=end-86400000
 return {start,end,label:format(start)+' — '+format(end),source:'AIS 航迹回放',periods,markdown:`# 长航碧玉 · 24小时工况态势报告\n\n统计时间：${format(start)} — ${format(end)}\n\n数据来源：内置 AIS 与机舱运行记录回放，尚未连接实船 AIS 服务。\n\n${periods.map(p=>'## '+p.time+' · '+p.status+'\n\n'+p.detail+'\n\nAIS：'+p.ais+'\n\n时段末位置：'+p.position).join('\n\n')}`}
}
