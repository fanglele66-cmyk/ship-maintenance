// Associate an occurrence with its recorded navigation interval, never with
// the time a task was dispatched or a historical event was opened.
export function occurrenceTime(event){
 const raw=event.occurredAt||event.createdAt||event.brief?.discovery?.at
 if(typeof raw==='number')return raw
 if(!raw)return NaN
 const match=String(raw).match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
 if(!match)return NaN
 if(/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw))return Date.parse(raw)
 return Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]||'00'}+08:00`)
}
export function navigationStages(periods,events){
 const ordered=[...periods].sort((a,b)=>a.start-b.start)
 return ordered.map((period,index)=>{
  const incidents=events.filter(event=>{
   const at=occurrenceTime(event)
   return at>=period.start&&(at<period.end||index===ordered.length-1&&at===period.end)
  }).map(event=>({id:event.id,title:event.title,type:event.type,severity:event.type==='报警事件'?'alarm':'warning',at:occurrenceTime(event)})).sort((a,b)=>a.at-b.at)
  return {...period,incidents,severity:incidents.some(e=>e.severity==='alarm')?'alarm':incidents.length?'warning':null}
 })
}
