import {DatabaseSync} from 'node:sqlite'
import {createReadStream,constants} from 'node:fs'
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises'
import {join,resolve,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {parseArgs} from 'node:util'
import {validateAccountSeed} from '../server/account-seed.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const {values}=parseArgs({options:{'source-dir':{type:'string'},'telemetry-dir':{type:'string'},help:{type:'boolean'}}})
if(values.help){console.log('node scripts/export-deployment-data.mjs [--source-dir .local-data] [--telemetry-dir deployment-data/telemetry]');process.exit(0)}
const source=resolve(values['source-dir']||process.env.SHIP_DATA_DIR||join(root,'.local-data'))
const target=resolve(values['telemetry-dir']||join(root,'deployment-data/telemetry'))
if(target===source)throw Error('Telemetry export directory must differ from runtime directory')
const manifestBytes=await readFile(join(source,'manifest.json'))
const manifest=JSON.parse(manifestBytes.toString('utf8')),name=manifest.database
if(typeof name!=='string'||name!==basename(name)||/[\\/]/.test(name)||!name.endsWith('.db'))throw Error('Invalid database filename')
const database=join(source,name),destination=join(target,name)
const size=async path=>{try{return (await stat(path)).size}catch(error){if(error.code==='ENOENT')return 0;throw error}}
if(await size(database+'-wal'))throw Error('Database has pending WAL writes; stop its writer and checkpoint before export')
const sha256=async path=>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')}
const accountsDb=new DatabaseSync(join(source,'accounts.sqlite'),{readOnly:true})
let seed
try{seed={version:1,accounts:accountsDb.prepare('SELECT username,role,name,label,salt,hash FROM accounts ORDER BY username').all()};validateAccountSeed(seed)}finally{accountsDb.close()}
// Export only password verifiers, never plaintext passwords, sessions or lockouts.
const seedBytes=JSON.stringify(seed,null,2)+'\n'
async function writeUnchangedOrNew(path,bytes){
 try{await writeFile(path,bytes,{flag:'wx'})}catch(error){
  if(error.code!=='EEXIST')throw error
  if(!Buffer.from(bytes).equals(await readFile(path)))throw Error('Existing export differs; choose a new destination or review it before replacing: '+path)
 }
}
await mkdir(target,{recursive:true});await mkdir(join(root,'data'),{recursive:true})
const sourceHash=await sha256(database)
try{await copyFile(database,destination,constants.COPYFILE_EXCL)}catch(error){if(error.code!=='EEXIST')throw error}
const copiedHash=await sha256(destination)
if(copiedHash!==sourceHash||await sha256(database)!==sourceHash)throw Error('Database copy checksum mismatch or source changed during export')
const db=new DatabaseSync(destination,{readOnly:true})
let count,start,end
try{
 if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Exported database integrity check failed')
 const spans=db.prepare('SELECT count(*) AS count,min(timestamp) AS start,max(timestamp) AS end FROM sensor_readings').get()
 count=spans.count;start=spans.start;end=spans.end
}finally{db.close()}
await writeUnchangedOrNew(join(target,'manifest.json'),manifestBytes)
await writeUnchangedOrNew(join(root,'data/accounts-seed.json'),seedBytes)
const receipt={version:1,database:name,bytes:await size(destination),sha256:copiedHash,manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),sensorReadings:{count,start,end},accounts:{count:seed.accounts.length,file:'data/accounts-seed.json',containsPlaintextPasswords:false,containsSessions:false}}
await writeUnchangedOrNew(join(target,'receipt.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify({telemetryDirectory:target,...receipt}))
