// Shared by the local model adapter and the browser; retain UTF-8 and SSE boundaries.
export async function* readEventStream(response){
 if(!response.body)throw Error('流式连接未返回内容。')
 const reader=response.body.getReader(),decoder=new TextDecoder()
 let buffer='',event='message',data=[]
 try{
  while(true){
   const {value,done}=await reader.read()
   buffer+=done?decoder.decode():decoder.decode(value,{stream:true})
   let match
   while((match=/\r\n|\r|\n/.exec(buffer))){
    if(!done&&match[0]==='\r'&&match.index===buffer.length-1)break
    const line=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length)
    if(!line){if(data.length)yield {event,data:data.join('\n')};event='message';data=[];continue}
    if(line.startsWith(':'))continue
    const colon=line.indexOf(':'),field=colon<0?line:line.slice(0,colon),content=colon<0?'':line.slice(colon+1).replace(/^ /,'')
    if(field==='event')event=content
    if(field==='data')data.push(content)
   }
   if(buffer.length>300000||data.reduce((n,line)=>n+line.length,0)>300000)throw Error('流式内容超出限制。')
   if(done)break
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
