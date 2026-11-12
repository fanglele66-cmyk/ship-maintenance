import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {telemetryDirectory} from '../server/data-paths.mjs'

test('independent telemetry takes precedence, preserves legacy installs and honors explicit external storage',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ship-split-data-')),runtime=join(root,'.local-data'),prepared=join(root,'deployment-data/telemetry')
 try{
  await mkdir(runtime);await mkdir(prepared,{recursive:true})
  assert.equal(telemetryDirectory(root,runtime,{}),prepared)
  await writeFile(join(runtime,'manifest.json'),'{}')
  assert.equal(telemetryDirectory(root,runtime,{}),runtime)
  await writeFile(join(prepared,'manifest.json'),'{}')
  assert.equal(telemetryDirectory(root,runtime,{}),prepared)
  const external=join(root,'external-readonly'),otherRuntime=join(root,'writable-runtime')
  assert.equal(telemetryDirectory(root,runtime,{SHIP_TELEMETRY_DIR:external}),external,'explicit missing data must not silently fall back')
  assert.equal(telemetryDirectory(root,otherRuntime,{SHIP_DATA_DIR:otherRuntime}),prepared)
  await mkdir(otherRuntime);await writeFile(join(otherRuntime,'manifest.json'),'{}')
  assert.equal(telemetryDirectory(root,otherRuntime,{}),otherRuntime,'explicit legacy fixture remains isolated')
 }finally{await rm(root,{recursive:true,force:true})}
})
