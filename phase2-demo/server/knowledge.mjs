import {readdir,readFile,stat} from 'node:fs/promises'
import {join,relative} from 'node:path'

export function createKnowledge(root){
 let cache=[],loaded=0,documentCount=0
 async function load(){
  if(Date.now()-loaded<10000)return cache
  const chunks=[];let count=0
  async function walk(dir){
   for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.isSymbolicLink())continue
    const path=join(dir,entry.name)
    if(entry.isDirectory()){if(entry.name!=='images')await walk(path);continue}
    if(!/\.md$/i.test(entry.name)||(await stat(path)).size>2_000_000)continue
    const lines=(await readFile(path,'utf8')).split(/\r?\n/),file=relative(root,path).replaceAll('\\','/'),title=entry.name.replace(/\.md$/i,'')
    count++;let start=0,buffer=[]
    function flush(){if(buffer.length){chunks.push({file,title,startLine:start+1,endLine:start+buffer.length,text:buffer.join('\n')});buffer=[]}}
    for(let i=0;i<lines.length;i++){
     if(buffer.join('\n').length>1400||(/^#{1,3} /.test(lines[i])&&buffer.length>6))flush()
     if(!buffer.length)start=i
     buffer.push(lines[i])
    }
    flush()
   }
  }
  try{await walk(root)}catch(error){if(error.code!=='ENOENT')throw error}
  cache=chunks;documentCount=count;loaded=Date.now();return cache
 }
 function terms(text){
  const normalized=text.toLowerCase(),words=normalized.match(/[a-z][a-z0-9-]{1,}|\d+(?:\.\d+)?/g)||[]
  for(const phrase of normalized.match(/[\u4e00-\u9fff]+/g)||[])for(let i=0;i<phrase.length-1;i++)words.push(phrase.slice(i,i+2))
  return [...new Set(words)].filter(w=>!['什么','怎么','如何','请问','一下','补充','报告','我们','这个','可以','进行','以及','是否'].includes(w))
 }
 return {
  async status(){await load();return {documents:documentCount,chunks:cache.length,directory:'wiki_rt-flex50',imagesIndexed:false}},
  async search(query,limit=5){
   const all=await load(),tokens=terms(query)
   if(!tokens.length)return []
   const weights=new Map(tokens.map(token=>[token,Math.log(1+all.length/(1+all.filter(x=>(x.title+' '+x.text).toLowerCase().includes(token)).length))]))
   const ranked=all.map(c=>{const body=c.text.toLowerCase(),title=c.title.toLowerCase();let score=0
    for(const token of tokens){const weight=weights.get(token);if(body.includes(token))score+=weight;if(title.includes(token))score+=weight*3}
    return {...c,score}
   }).filter(c=>c.score>1).sort((a,b)=>b.score-a.score)
   const picked=[],perFile=new Map()
   for(const chunk of ranked){if((perFile.get(chunk.file)||0)>=2)continue;perFile.set(chunk.file,(perFile.get(chunk.file)||0)+1);picked.push({...chunk,id:'K'+(picked.length+1)});if(picked.length===limit)break}
   return picked
  }
 }
}
