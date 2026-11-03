// Associate an occurrence with its recorded navigation interval, never with
// the time a task was dispatched or a historical event was opened.
import {eventState} from './lifecyclePresentation.js'
export function occurrenceTime(event){
 const raw=event.occurredAt||event.createdAt||event.brief?.discovery?.at
 if(typeof raw==='number')return raw
 if(!raw)return NaN
 const match=String(raw).match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
 if(!match)return NaN
 if(/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw))return Date.parse(raw)
 return Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]||'00'}+08:00`)
}
export function navigationStages(periods,events,{captain=true}={}){
 const ordered=[...periods].sort((a,b)=>a.start-b.start)
 return ordered.map((period,index)=>{
  const incidents=(captain?events:[]).filter(event=>{
   if(event.parentEventId||event.type==='效果观察')return false
   const at=occurrenceTime(event)
   return at>=period.start&&(at<period.end||index===ordered.length-1&&at===period.end)
  }).map(event=>{
   let current=event;const visited=new Set()
   while(current.phase==='transferred'&&!visited.has(current.id)){
    visited.add(current.id)
    const child=events.find(e=>e.id===current.observationEventIds?.at(-1))
    if(!child)break
    current=child
   }
   return {id:event.id,title:event.title,device:event.device||'设备',type:event.type,severity:event.type==='报警事件'?'alarm':'warning',at:occurrenceTime(event),state:eventState(current)}
  }).sort((a,b)=>a.at-b.at)
  const concerns=[...new Set(incidents.map(e=>e.device))].map(device=>{
   const items=incidents.filter(e=>e.device===device),active=items.filter(e=>e.state!=='已闭环')
   const counts=key=>[...new Set(items.map(e=>e[key]))].map(label=>({label,count:items.filter(e=>e[key]===label).length}))
   return {device,types:counts('type'),states:counts('state'),severity:active.some(e=>e.severity==='alarm')?'alarm':active.length?'warning':'resolved'}
  })
  return {...period,incidents,concerns,severity:concerns.some(e=>e.severity==='alarm')?'alarm':concerns.some(e=>e.severity==='warning')?'warning':null}
 })
}
