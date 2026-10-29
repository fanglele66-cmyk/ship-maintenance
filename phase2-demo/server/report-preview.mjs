// Decode only the known prose fields while JSON is arriving. This preview is never
// applicable: the complete response still has to pass parseReportPatch.
function partialObject(text){
 const source=text.replace(/^\s*```(?:json)?\s*/,'')
 let i=0
 const space=()=>{while(/\s/.test(source[i]||'')&&i<source.length)i++}
 function string(){
  i++;let value=''
  while(i<source.length){
   const c=source[i++]
   if(c==='"')return {value,complete:true}
   if(c!=='\\'){value+=c;continue}
   const escape=source[i++]
   if(escape==='u'){
    const hex=source.slice(i,i+4)
    if(!/^[\da-f]{4}$/i.test(hex))return {value,complete:false}
    value+=String.fromCharCode(parseInt(hex,16));i+=4
   }else{
    const decoded={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'}[escape]
    if(decoded===undefined)return {value,complete:false}
    value+=decoded
   }
  }
  return {value,complete:false}
 }
 function read(depth=0){
  space()
  if(source[i]==='"')return string()
  if(source[i]!=='{'||depth>2)return {complete:false}
  i++;const value=Object.create(null)
  while(i<source.length){
   space();if(source[i]==='}'){i++;return {value,complete:true}}
   if(source[i]!=='"')break
   const key=string();if(!key.complete)break
   space();if(source[i++]!==':')break
   const child=read(depth+1)
   if(child.value!==undefined)value[key.value]=child.value
   if(!child.complete)break
   space();if(source[i]===','){i++;continue}
   if(source[i]!=='}')break
  }
  return {value,complete:false}
 }
 return read().value
}
export function previewTaskPlan(text){
 const value=partialObject(text)
 return {scope:typeof value?.scope==='string'?value.scope:'',rationale:typeof value?.rationale==='string'?value.rationale:''}
}
export function previewReportPatch(text){
 const value=partialObject(text),patch={summary:'',analysis:{}}
 if(typeof value?.summary==='string')patch.summary=value.summary
 for(const key of ['evidence','interpretation','unverified','next'])if(typeof value?.analysis?.[key]==='string')patch.analysis[key]=value.analysis[key]
 return patch
}
