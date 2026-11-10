import {readdir,readFile,stat,rm,realpath} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
const archiveName=/^(?:\d+-[a-f0-9]{12}|run-\d+-[a-f0-9]{8}-\d+)$/
const skillName=/^engine-health-\d{8}_\d{6}__result\.json$/
const entries=async path=>{try{return await readdir(path,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return [];throw e}}

// Only complete, recognized reports in these two explicit output directories are eligible.
// Unknown files, pending archives, symlinks and paths outside the directory are preserved.
export async function pruneHealthOutputs(directory,keep=6,{abandonedIds=[]}={}){
 if(!Number.isInteger(keep)||keep<1)throw Error('At least one health report must be retained')
 const abandoned=new Set(abandonedIds)
 const history=resolve(directory,'health-history'),outputs=resolve(directory,'workspace/result/engine-health/outputs'),removed=[]
 const archives=[]
 for(const entry of await entries(history)){
  if(!entry.isDirectory()||entry.isSymbolicLink()||!archiveName.test(entry.name))continue
  const file=join(history,entry.name)
  if(dirname(file)!==history||(await realpath(file)).toLowerCase()!==file.toLowerCase())continue
  try{
   const report=JSON.parse(await readFile(join(file,'report.json'),'utf8'))
   await stat(join(file,'report.md'));await stat(join(file,'skill-result.json'))
   const time=Date.parse(String(report.completedAt).replace(' ','T')+'+08:00')
   if(Number.isFinite(time))archives.push({file,time,mtime:(await stat(join(file,'report.json'))).mtimeMs})
  }catch(e){
   if(e.code==='ENOENT'&&abandoned.has(entry.name)){await rm(file,{recursive:true});removed.push(file)}
   else if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e
  }
 }
 archives.sort((a,b)=>b.time-a.time||b.mtime-a.mtime||b.file.localeCompare(a.file))
 for(const {file} of archives.slice(keep)){await rm(file,{recursive:true});removed.push(file)}
 const skillFiles=(await entries(outputs)).filter(e=>e.isFile()&&!e.isSymbolicLink()&&skillName.test(e.name)).map(e=>e.name).sort().reverse()
 for(const name of skillFiles.slice(keep)){
  const file=join(outputs,name)
  if(dirname(file)!==outputs)throw Error('Invalid health output path')
  await rm(file);removed.push(file)
 }
 return {keep,archives:Math.min(archives.length,keep),skillResults:Math.min(skillFiles.length,keep),removed}
}
