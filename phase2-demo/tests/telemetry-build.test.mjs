import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {fileURLToPath} from 'node:url'
import {verifyTelemetry} from '../scripts/check-telemetry.mjs'

const run=promisify(execFile),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const script=fileURLToPath(new URL('../scripts/check-telemetry.mjs',import.meta.url))
async function seal(directory){
 const database=await readFile(join(directory,'test.db')),manifest=await readFile(join(directory,'manifest.json'))
 await writeFile(join(directory,'receipt.json'),JSON.stringify({database:'test.db',bytes:database.length,sha256:sha(database),manifestSha256:sha(manifest)}))
}
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'ship-telemetry-check-'))
 t.after(async()=>{
  assert.equal(dirname(directory),resolve(tmpdir()))
  await rm(directory,{recursive:true,force:true,maxRetries:3})
 })
 const db=new DatabaseSync(join(directory,'test.db'))
 try{
  db.exec(`CREATE TABLE sensor_readings(timestamp TEXT,source_time TEXT,source_gap_seconds REAL,data TEXT);
   INSERT INTO sensor_readings VALUES ('2026-11-16 00:00:00','2026-11-16 00:00:00',0,'[1,2,3]');
   CREATE TABLE ais_track(postime TEXT,sog REAL,lat REAL,lon REAL);`)
 }finally{db.close()}
 await writeFile(join(directory,'manifest.json'),JSON.stringify({database:'test.db'}))
 await seal(directory)
 return directory
}

test('complete telemetry passes checks without modifying the database; CLI uses the explicit build directory',async t=>{
 const directory=await fixture(t),before=sha(await readFile(join(directory,'test.db')))
 const result=await verifyTelemetry(directory)
 assert.equal(result.status,'verified');assert.equal(result.sqlite,'ok')
 const {stdout}=await run(process.execPath,[script,'--directory',directory],{windowsHide:true,env:{...process.env,SHIP_TELEMETRY_DIR:join(directory,'wrong-runtime-directory')}})
 assert.equal(JSON.parse(stdout).sha256,before)
 assert.equal(sha(await readFile(join(directory,'test.db'))),before)
})

test('LFS pointers fail before SQLite with a download instruction and nonzero CLI exit',async t=>{
 const directory=await fixture(t)
 await writeFile(join(directory,'test.db'),'version https://git-lfs.github.com/spec/v1\noid sha256:'+'a'.repeat(64)+'\nsize 976711680\n')
 await assert.rejects(verifyTelemetry(directory),/Git LFS pointer.*GitLFSPull/)
 await assert.rejects(run(process.execPath,[script,'--directory',directory],{windowsHide:true}),error=>error.code===1&&/Git LFS pointer/.test(error.stderr))
})

test('truncated or changed data and changed manifest cannot enter the image',async t=>{
 const directory=await fixture(t),path=join(directory,'test.db'),bytes=await readFile(path)
 await writeFile(path,bytes.subarray(0,128))
 await assert.rejects(verifyTelemetry(directory),/Dataset incomplete/)
 const changed=Buffer.from(bytes);changed[changed.length-1]^=1
 await writeFile(path,changed)
 await assert.rejects(verifyTelemetry(directory),/Dataset checksum mismatch/)
 await writeFile(path,bytes)
 await writeFile(join(directory,'manifest.json'),JSON.stringify({database:'test.db',changed:true}))
 await assert.rejects(verifyTelemetry(directory),/Manifest checksum mismatch/)
})

test('wrong schema is rejected even when the receipt matches the SQLite file',async t=>{
 const directory=await fixture(t),db=new DatabaseSync(join(directory,'test.db'))
 try{db.exec('ALTER TABLE sensor_readings RENAME COLUMN source_gap_seconds TO missing_column')}finally{db.close()}
 await seal(directory)
 await assert.rejects(verifyTelemetry(directory),/source_gap_seconds/)
})

test('invalid SQLite pages are rejected even with a valid header and matching receipt',async t=>{
 const directory=await fixture(t),bytes=Buffer.alloc(512)
 Buffer.from('SQLite format 3\0').copy(bytes)
 await writeFile(join(directory,'test.db'),bytes);await seal(directory)
 await assert.rejects(verifyTelemetry(directory),/database|malformed|integrity/i)
})

test('missing and non-SQLite files fail; manifest cannot escape the data directory',async t=>{
 const directory=await fixture(t)
 await writeFile(join(directory,'test.db'),'an error page instead of telemetry')
 await assert.rejects(verifyTelemetry(directory),/not a SQLite database/)
 await rm(join(directory,'test.db'))
 await assert.rejects(verifyTelemetry(directory),/ENOENT/)
 await writeFile(join(directory,'receipt.json'),JSON.stringify({database:'../outside.db'}))
 await writeFile(join(directory,'manifest.json'),JSON.stringify({database:'../outside.db'}))
 await assert.rejects(verifyTelemetry(directory),/Invalid database filename/)
})
