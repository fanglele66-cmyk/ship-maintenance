import {createReadStream} from 'node:fs'
import {readFile,stat,open} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {DatabaseSync} from 'node:sqlite'
import assert from 'node:assert/strict'
import {telemetryDirectory} from '../server/data-paths.mjs'

export async function verifyTelemetry(directory){
 const receipt=JSON.parse(await readFile(join(directory,'receipt.json'),'utf8'))
 const manifestBytes=await readFile(join(directory,'manifest.json'))
 const manifest=JSON.parse(manifestBytes)
 assert.equal(manifest.database,receipt.database,'Manifest/database receipt mismatch')
 assert.ok(typeof receipt.database==='string'&&!/[\\/]/.test(receipt.database)&&receipt.database.endsWith('.db'),'Invalid database filename')
 const database=resolve(directory,receipt.database)
 assert.equal(dirname(database),resolve(directory),'Database must remain inside the dataset directory')
 const file=await open(database,'r'),header=Buffer.alloc(128)
 let bytesRead
 try{({bytesRead}=await file.read(header,0,header.length,0))}finally{await file.close()}
 if(header.subarray(0,bytesRead).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')){
  throw Error('Telemetry database is a Git LFS pointer, not SQLite. Download LFS data during Jenkins checkout (GitLFSPull), or run git lfs pull before docker build.')
 }
 assert.ok(bytesRead>=16&&header.subarray(0,16).equals(Buffer.from('SQLite format 3\0')),'Telemetry file is not a SQLite database; replace it with the complete LFS dataset')
 assert.equal((await stat(database)).size,receipt.bytes,'Dataset incomplete: run git lfs pull')
 const hash=createHash('sha256')
 for await(const chunk of createReadStream(database))hash.update(chunk)
 assert.equal(hash.digest('hex'),receipt.sha256,'Dataset checksum mismatch')
 assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),receipt.manifestSha256,'Manifest checksum mismatch')
 const db=new DatabaseSync(database,{readOnly:true})
 try{
  db.exec('PRAGMA query_only=ON')
  const check=db.prepare('PRAGMA quick_check').all()
  assert.ok(check.length===1&&check[0].quick_check==='ok','SQLite integrity check failed')
  // Check the columns actually read by openLocalData before publishing an image.
  db.prepare('SELECT timestamp,source_time,source_gap_seconds,data FROM sensor_readings LIMIT 0').all()
  db.prepare('SELECT postime,sog,lat,lon FROM ais_track LIMIT 0').all()
 }finally{db.close()}
 return {status:'verified',database:receipt.database,bytes:receipt.bytes,sha256:receipt.sha256,sqlite:'ok'}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {values}=parseArgs({options:{directory:{type:'string'}}})
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
  const directory=values.directory?resolve(values.directory):telemetryDirectory(root)
  console.log(JSON.stringify(await verifyTelemetry(directory)))
 }catch(error){console.error('[telemetry] '+error.message);process.exitCode=1}
}
