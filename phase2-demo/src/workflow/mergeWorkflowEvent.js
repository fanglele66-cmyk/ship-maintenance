const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const keyed=value=>Array.isArray(value)&&value.every(item=>object(item)&&typeof item.id==='string')&&new Set(value.map(item=>item.id)).size===value.length
// Rebase independent edits (for example chief messages and engineer notes).
// A conflicting edit to the same field must remain visible rather than overwrite it.
function merge(base,local,remote){
 if(equal(local,base))return remote
 if(equal(remote,base)||equal(local,remote))return local
 if(object(base)&&object(local)&&object(remote)){
  const result={}
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   const value=merge(base[key],local[key],remote[key]);if(value!==undefined)result[key]=value
  }
  return result
 }
 if(keyed(base)&&keyed(local)&&keyed(remote)){
  const maps=[base,local,remote].map(list=>new Map(list.map(item=>[item.id,item])))
  return [...new Set([...remote.map(item=>item.id),...local.map(item=>item.id),...base.map(item=>item.id)])].map(id=>merge(...maps.map(map=>map.get(id)))).filter(item=>item!==undefined)
 }
 throw Error('其他会话也修改了同一内容，请保留当前输入并核对服务器记录。')
}
export function mergeWorkflowEvent(base,local,remote){
 return merge({...base,serverRevision:remote.serverRevision},{...local,serverRevision:remote.serverRevision},remote)
}
