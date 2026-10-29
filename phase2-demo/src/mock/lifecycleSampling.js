// Deterministic local demonstration source. Never use this adapter for live telemetry.
// UI wording follows the normal automatic-sampling flow; provenance stays on each channel.
export function lifecycleSampling(event,task,config,now){
 const start=Date.parse(task.submittedAt),end=Math.min(now,task.observationEndedAt?Date.parse(task.observationEndedAt):now)
 if(!Number.isFinite(start)||end<=start)return []
 const begin=Math.max(start,end-72*3600000),step=Math.max(2000,Math.ceil((end-begin)/4000/2000)*2000)
 const seed=Array.from(event.id+' '+task.id).reduce((n,c)=>(n*31+c.charCodeAt(0))%997,0)/997
 return config.names.map((name,index)=>{
  const pressure=config.units[index]==='MPa',relative=/偏差/.test(name)
  const target=pressure?(index?0.656:0.672):relative?(event.id.includes('c4')?-2.4:3.2):(index?347:345)
  const initial=pressure?(index?0.622:0.635):relative?config.before[index]:(index?342:306)
  const amplitude=pressure?0.003:relative?0.35:1.5,trendData=[]
  for(let timestamp=start+Math.floor((begin-start)/step)*step+step;timestamp<=end;timestamp+=step){
   const seconds=(timestamp-start)/1000,settling=(initial-target)*Math.exp(-seconds/85)
   const wave=amplitude*(Math.sin(seconds/13+seed*6+index)*0.65+Math.sin(seconds/31+index)*0.35)
   trendData.push({timestamp,value:Number((target+settling+wave).toFixed(pressure?3:1))})
  }
  return {channelId:'local-observation:'+event.id+':'+index,name,unit:config.units[index],sourceKind:'prototype',trendData}
 })
}
