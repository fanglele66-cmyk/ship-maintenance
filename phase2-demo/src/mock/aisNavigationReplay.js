// Built-in voyage replay. Production must supply timestamped AIS and engine
// records through this adapter; these samples are not a live AIS connection.
const profiles=[
 {minutes:235,state:'海上航行',tone:'cruise',navigation:'机动航行',sog:[9.6,10.1],averageSpeed:9.8,cog:185,rpm:[94,96],load:[69,71],aux:1,detail:'主机转速94—96 rpm，辅机供电。',operation:'推进保持巡航',loadTrend:'巡航负荷保持稳定'},
 {minutes:85,state:'减速进锚地',tone:'maneuver',navigation:'机动航行',sog:[3.2,8.4],averageSpeed:5.6,cog:210,rpm:[45,82],load:[24,57],aux:1,detail:'主机转速由82降至45 rpm。',operation:'减速进入锚地',loadTrend:'由巡航负荷逐步降低'},
 {minutes:310,state:'锚泊待命',tone:'anchored',navigation:'锚泊',sog:[0,0.3],averageSpeed:0.2,cog:null,rpm:[0,0],load:[0,0],aux:1,detail:'主机转速为0，辅机维持供电。',operation:'锚泊，船位小幅摆动',loadTrend:'主机停车，无推进负荷'},
 {minutes:50,state:'起锚与低速操纵',tone:'maneuver',navigation:'机动航行',sog:[0.5,4.8],averageSpeed:2.4,cog:165,rpm:[30,61],load:[12,38],aux:1,detail:'主机转速30—61 rpm。',operation:'起锚，低速调整航向',loadTrend:'低负荷，随操纵调整'},
 {minutes:135,state:'出锚地加速',tone:'accelerating',navigation:'机动航行',sog:[4.8,9.5],averageSpeed:7.2,cog:178,rpm:[61,93],load:[38,68],aux:1,detail:'主机转速61—93 rpm。',operation:'驶离锚地，逐步加速',loadTrend:'由低负荷逐步增加'},
 {minutes:625,state:'海上航行',tone:'cruise',navigation:'机动航行',sog:[9.6,10.2],averageSpeed:9.8,cog:185,rpm:[93,96],load:[69,71],aux:1,detail:'以巡航为主，期间有减速与重新启动记录。',operation:'航行中按指令调整推进',loadTrend:'巡航为主，期间有启停波动'},
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
