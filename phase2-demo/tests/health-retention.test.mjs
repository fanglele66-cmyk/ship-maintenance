import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHealthScheduler} from '../server/health-scheduler.mjs'
import {pruneHealthOutputs} from '../server/health-retention.mjs'
import {HOUR,toTime,sqlTime} from '../server/local-data.mjs'

test('retention keeps six complete archives and six skill results, preserving unrelated and incomplete files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-retention-')),history=join(dir,'health-history'),outputs=join(dir,'workspace/result/engine-health/outputs')
 await mkdir(outputs,{recursive:true});await mkdir(history)
 try{
  for(let i=0;i<9;i++){
   const archive=join(history,`${498410+i}-123456789abc`);await mkdir(archive)
   await writeFile(join(archive,'report.json'),JSON.stringify({completedAt:sqlTime(toTime('2026-11-10 06:00:00')+i*HOUR)}))
   await writeFile(join(archive,'report.md'),'report');await writeFile(join(archive,'skill-result.json'),'{}')
   await writeFile(join(outputs,`engine-health-20261110_${String(i).padStart(2,'0')}0000__result.json`),'{}')
  }
  await mkdir(join(history,'run-123-1234abcd-0'));await writeFile(join(outputs,'keep-me.txt'),'retain')
  const result=await pruneHealthOutputs(dir)
  assert.equal(result.archives,6);assert.equal(result.skillResults,6);assert.equal(result.removed.length,6)
  assert.equal((await readdir(history)).length,7);assert.equal(await readFile(join(outputs,'keep-me.txt'),'utf8'),'retain')
  assert((await readdir(history)).includes('498418-123456789abc'))
  assert(!(await readdir(history)).includes('498410-123456789abc'))
 }finally{await rm(dir,{recursive:true,force:true})}
})

test('hourly publishing rolls over old bundles and keeps the current report available',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ship-rollover-'));await writeFile(join(dir,'manifest.json'),'{}')
 let now=toTime('2026-11-10 12:21:00')
 const facts={result:{devices:{main:{context:'## 当前状态\n主机运行',analysis_conclusion:'运行中'}},analysis_window:{}},coverage:{start:'start',end:'end',status:'sufficient'}}
 const scheduler=await createHealthScheduler(dir,{directory:dir,clock:()=>now,analyze:async()=>facts,enhance:async()=>null})
 try{
  for(let i=0;i<9;i++){await scheduler.tick();now+=HOUR}
  const list=await readdir(join(dir,'health-history')),latest=JSON.parse(await readFile(join(dir,'health-latest.json'),'utf8'))
  assert.equal(list.length,6);assert(list.some(name=>name.endsWith('-8')));assert(list.every(name=>Number(name.split('-').at(-1))>=3))
  const archived=JSON.parse(await readFile(join(latest.archivePath,'report.json'),'utf8'));assert.equal(archived.jobId,latest.jobId)
  assert.equal(latest.schedulerStartedAt,'2026-11-10 12:21:00');assert.equal(latest.scheduledAt,'2026-11-10 20:21:00')
 }finally{await scheduler.close();await rm(dir,{recursive:true,force:true})}
})
