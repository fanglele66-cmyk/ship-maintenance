const copy=value=>JSON.parse(JSON.stringify(value))
const signature=event=>{const value={...event};delete value.serverRevision;return JSON.stringify(value)}
export function createBackendWorkflowSync(state,request,{onError=()=>{}}={}){
 const acknowledged=new Map();let ready=false,merging=false,saving=null,timer,closed=false
 async function pull(){
  const result=await request('workflow/events')
  merging=true
  try{
   const ids=new Set(result.events.map(e=>e.id))
   for(const event of Object.values(state.events))if(event.backendManaged&&!ids.has(event.id)){delete state.events[event.id];acknowledged.delete(event.id)}
   for(const event of result.events){const local=state.events[event.id];if(!ready||!local||event.serverRevision>(local.serverRevision||0)&&signature(local)===acknowledged.get(event.id)){state.events[event.id]=event;acknowledged.set(event.id,signature(event))}}
   ready=true;onError('')
  }finally{merging=false}
 }
 async function flush(){
  if(closed)return
  if(saving){await saving;return flush()}
  if(!ready)await pull()
  saving=(async()=>{
   // Parents are saved first so new observation events have an approved relationship.
   const list=Object.values(state.events).filter(e=>e.backendManaged).sort((a,b)=>Number(!!a.parentEventId)-Number(!!b.parentEventId))
   for(const event of list){
    const sent=signature(event);if(sent===acknowledged.get(event.id))continue
    const result=await request('workflow/save',{event:copy(event),revision:event.serverRevision})
    acknowledged.set(event.id,sent);event.serverRevision=result.event.serverRevision
   }
   onError('')
  })()
  try{await saving}catch(error){onError('记录尚未同步：'+error.message);throw error}finally{saving=null}
 }
 function schedule(){if(merging||!ready||closed)return;clearTimeout(timer);timer=setTimeout(()=>void flush().catch(()=>{}),600)}
 async function refresh(){try{await flush();await pull()}catch(error){onError('记录尚未同步：'+error.message)}}
 function accept(event){merging=true;try{state.events[event.id]=event;acknowledged.set(event.id,signature(event))}finally{merging=false}}
 return {pull,flush,schedule,refresh,accept,get ready(){return ready},close(){closed=true;clearTimeout(timer)}}
}
