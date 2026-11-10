// One clock per persisted prototype workspace. Source evidence is never rebased.
export const lifecycleStorageKey='engine-room-captain-workflow-v1'
const seeds={
 'real-alarm-0430':{sourceAt:'2026-04-30 23:33:00',hours:1},
 'real-warning-0523':{sourceAt:'2026-05-23 21:28:40',hours:3},
}
export const sourceTime=value=>typeof value==='number'?value:Date.parse(String(value).replace(' ','T')+(/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)?'':'+08:00'))
const timelineFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})
export const timelineText=value=>timelineFormatter.format(value)

export function shiftTimelineText(text,timeline){
 if(typeof text!=='string'||!timeline)return text
 // A source-date context lets abbreviated ranges cross midnight correctly.
 let date=timeline.sourceAt.slice(0,10)
 const [,month,day]=timeline.sourceAt.slice(0,10).split('-')
 text=text.replaceAll(`${Number(month)}月${Number(day)}日`,'本次')
 return text.replace(/(?:\d{4}-\d{2}-\d{2}[ T])?\d{2}:\d{2}(?::\d{2})?/g,match=>{
  const full=/^\d{4}-/.test(match)
  if(full)date=match.slice(0,10)
  const shifted=timelineText(sourceTime(full?match:date+' '+match)+timeline.offsetMs)
  const seconds=/\d{2}:\d{2}:\d{2}$/.test(match)
  return full||shifted.slice(0,10)!==timelineText(sourceTime(timeline.sourceAt)+timeline.offsetMs).slice(0,10)?shifted.slice(0,seconds?19:16):shifted.slice(11,seconds?19:16)
 })
}
export function shiftTimelineContent(value,timeline){
 if(!timeline||value instanceof RegExp)return value
 if(Array.isArray(value))return value.map(item=>shiftTimelineContent(item,timeline))
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,shiftTimelineContent(item,timeline)]))
 return shiftTimelineText(value,timeline)
}
export function applyInitialTimeline(event,timeBase){
 const seed=seeds[event.id]
 if(!seed||!Number.isFinite(timeBase)||event.timeline)return event
 const occurredAt=timeBase-seed.hours*3600000
 const timeline={timeBase,sourceAt:seed.sourceAt,offsetMs:occurredAt-sourceTime(seed.sourceAt)}
 const sources=event.brief.sources
 event.brief=shiftTimelineContent(event.brief,timeline)
 event.brief.sources=sources
 event.brief.discovery.at=timelineText(occurredAt).slice(0,16)
 if(event.id==='real-alarm-0430')event.brief.facts[0].at=timelineText(occurredAt).slice(0,10)
 event.timeline=timeline
 event.createdAt=event.occurredAt=new Date(occurredAt).toISOString()
 event.phases[0].at=event.createdAt
 return event
}
export function lifecycleSnapshot(state){
 return JSON.stringify({version:1,timeBase:state.timeBase,events:state.events,notices:state.notices||[]})
}
export function loadLifecycleState(storage,createState,now=Date.now()){
 let saved
 try{saved=JSON.parse(storage.getItem(lifecycleStorageKey))}catch{}
 // Only new workspaces receive shifted cases. Existing submissions are immutable.
 const initial=saved?.version===1&&saved.events&&typeof saved.events==='object'&&!Array.isArray(saved.events)?saved:createState({timeBase:Math.floor(now/60000)*60000})
 initial.timeBase=Number.isFinite(initial.timeBase)?initial.timeBase:Math.floor(now/60000)*60000
 // Persist before the first action so reloads and other tabs share this clock.
 try{storage.setItem(lifecycleStorageKey,lifecycleSnapshot(initial))}catch{}
 return initial
}
