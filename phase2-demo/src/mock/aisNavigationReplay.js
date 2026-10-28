// Built-in voyage replay. Production must supply timestamped AIS and engine
// records through this adapter; these samples are not a live AIS connection.
const profiles=[
 {minutes:235,state:'海上稳态航行',tone:'cruise',navigation:'机动航行',sog:[9.6,10.1],cog:185,rpm:[94,96],load:[69,71],aux:2,detail:'主机保持巡航负荷，1、2号辅机并联供电。'},
 {minutes:85,state:'减速进锚地',tone:'maneuver',navigation:'机动航行',sog:[3.2,8.4],cog:210,rpm:[45,82],load:[24,57],aux:2,detail:'主机按操纵指令降速，辅机供电配置保持不变。'},
 {minutes:310,state:'锚泊待命',tone:'anchored',navigation:'锚泊',sog:[0,0.3],cog:null,rpm:[0,0],load:[0,0],aux:1,detail:'主机停车待命，2号辅机供电，1号辅机转备用。'},
 {minutes:50,state:'起锚与低速操纵',tone:'maneuver',navigation:'机动航行',sog:[0.5,4.8],cog:165,rpm:[30,61],load:[12,38],aux:2,detail:'主机启动并低速操纵，1号辅机投入并联。'},
 {minutes:135,state:'出锚地加速',tone:'accelerating',navigation:'机动航行',sog:[4.8,9.5],cog:178,rpm:[61,93],load:[38,68],aux:2,detail:'主机逐步增加负荷，转入海上航行工况。'},
 {minutes:625,state:'海上稳态航行',tone:'cruise',navigation:'机动航行',sog:[9.6,10.2],cog:185,rpm:[93,96],load:[69,71],aux:2,detail:'主机维持巡航，1、2号辅机持续运行。'},
]
export function aisNavigationReplay(end){
 let at=end-86400000,lat=31.35,lon=123.30
 return profiles.map((p,index)=>{
  const start=at;at+=p.minutes*60000
  const distance=p.navigation==='锚泊'?0:(p.sog[0]+p.sog[1])/2*p.minutes/60,angle=(p.cog||0)*Math.PI/180
  lat+=distance*Math.cos(angle)/60;lon+=distance*Math.sin(angle)/(60*Math.cos(lat*Math.PI/180))
  return {...p,id:`ais-leg-${index}`,start,end:at,latitude:Number(lat.toFixed(4)),longitude:Number(lon.toFixed(4)),receivedAt:at,source:'built-in-voyage-replay'}
 })
}
