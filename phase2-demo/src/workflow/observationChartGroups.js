const families=[['scavenge',22,27,'各缸扫气温度'],['exhaust',8,13,'各缸排气温度'],['piston',31,36,'各缸活塞冷却油温'],['coolant',46,51,'各缸冷却水温']]
export function observationChartGroups(points,readings=[]){
 const metadata=new Map(points.map(p=>[p.id,p]))
 const channels=readings.length?readings.map(r=>({...metadata.get(r.channelId),...r,id:r.channelId,name:r.name||metadata.get(r.channelId)?.nameCn})):points.map(p=>({...p,name:p.nameCn,trendData:[]}))
 const groups=new Map()
 for(const channel of channels){
  const code=channel.pointCode,number=Number(code?.slice(2)),family=families.find(([,min,max])=>number>=min&&number<=max)
  const operating=['DC0001','DC0058'].includes(code)
  const key=operating?'operating':family?.[0]||`${channel.subsystem||'关联测点'}-${channel.unit||''}`
  if(!groups.has(key))groups.set(key,{id:key,title:operating?'转速与燃油指令':family?.[3]||`${channel.subsystem||'关联测点'}${channel.unit?'（'+channel.unit+'）':''}`,channels:[]})
  groups.get(key).channels.push(channel)
 }
 return [...groups.values()].sort((a,b)=>{const rank=g=>families.some(f=>f[0]===g.id)?0:g.id==='operating'?1:2;return rank(a)-rank(b)})
}
export function observationChartOption(group,start,end){
 const units=[...new Set(group.channels.map(c=>c.unit||''))]
 const from=Date.parse(start),to=Date.parse(end)
 const time=value=>new Date(value).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit'})
 return {animation:false,color:['#387db2','#d78b35','#369c8b','#986eb0','#ce677b','#84933d'],
  legend:{type:'scroll',top:4,left:12,right:12,textStyle:{color:'#60778a',fontSize:12}},
  tooltip:{trigger:'axis',confine:true,renderMode:'richText',formatter:items=>{
   const at=items[0]?.value?.[0];return [Number.isFinite(at)?new Date(at).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}):'',...items.map(item=>`${item.seriesName}：${item.value[1]??'缺测'} ${group.channels[item.seriesIndex]?.unit||''}`)].join('\n')
  }},
  grid:{left:18,right:20,top:70,bottom:65,containLabel:true},
  xAxis:{type:'time',min:Number.isFinite(from)?from:undefined,max:Number.isFinite(to)?to:undefined,axisLabel:{formatter:time,color:'#8091a2',hideOverlap:true},splitNumber:6,axisLine:{lineStyle:{color:'#dce4eb'}},splitLine:{show:true,lineStyle:{color:'#eef2f5',type:'dashed'}}},
  yAxis:units.map((unit,i)=>({type:'value',scale:true,position:i?'right':'left',name:group.id==='operating'?`${group.channels.find(c=>c.unit===unit)?.name} / ${unit}`:unit,nameTextStyle:{color:'#60778a'},axisLabel:{color:'#8091a2'},splitLine:{show:!i,lineStyle:{color:'#e8edf2',type:'dashed'}}})),
  dataZoom:[{type:'inside',zoomOnMouseWheel:false,moveOnMouseWheel:false,filterMode:'none'},{type:'slider',bottom:8,height:22,left:65,right:65,filterMode:'none',showDetail:false,borderColor:'#e1e7ef',fillerColor:'rgba(56,125,178,.10)'}],
  series:group.channels.map(channel=>({name:channel.name,type:'line',yAxisIndex:units.indexOf(channel.unit||''),showSymbol:(channel.trendData?.length||0)<3,symbolSize:6,connectNulls:false,lineStyle:{width:2},data:(channel.trendData||[]).filter(p=>Number.isFinite(p.timestamp)&&(!Number.isFinite(from)||p.timestamp>=from)&&(!Number.isFinite(to)||p.timestamp<=to)).map(p=>[p.timestamp,Number.isFinite(p.value)?p.value:null]).sort((a,b)=>a[0]-b[0])}))}
}
