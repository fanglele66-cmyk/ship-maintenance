// Published replies are snapshots. Only interactive inquiry state keeps its live reference.
export function appendMessages(existing, incoming) {
  const ids=new Set(existing.map(message=>message.id).filter(Boolean))
  for(const message of [...incoming].sort((a,b)=>(a.order||0)-(b.order||0))) {
    if(!message.id || ids.has(message.id))continue
    existing.push(message.type==='inquiry'?message:JSON.parse(JSON.stringify(message)))
    ids.add(message.id)
  }
  return existing
}
