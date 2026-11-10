// Prototype metadata requested by the product owner. These are simulated times,
// not timestamps extracted from source evidence. Use the first discovery instant.
export function initialInformationTimes(event){
 const report=event.manualReport||event.detectionReport
 if(report){const f=v=>new Date(v).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16),start=f(report.start),end=f(report.end);return {submittedAt:f(report.submittedAt),dataWindow:start+' — '+(start.slice(0,10)===end.slice(0,10)?end.slice(11):end),generatedAt:f(report.generatedAt)}}
 const raw=event.timeline?(event.occurredAt||event.createdAt):event.brief?.discovery?.at||event.createdAt||''
 const match=String(raw).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?((?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?/)
 const at=match?Date.parse(`${match[1]}T${match[2]}:${match[3]||'00'}${match[4]||'+08:00'}`):NaN
 if(!Number.isFinite(at))return {dataWindow:'未记录',generatedAt:'未记录'}
 const format=value=>new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16)
 const start=format(at-30*60000),end=format(at)
 return {dataWindow:`${start} — ${start.slice(0,10)===end.slice(0,10)?end.slice(11):end}`,generatedAt:format(at+5*60000)}
}
