import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {createEventRepository} from '../server/event-repository.mjs'
import {buildTrackingEvents,importTrackingEvents} from '../server/health-tracking.mjs'
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},'data-dir':{type:'string'},publish:{type:'boolean',default:false},help:{type:'boolean'}}})
if(values.help){console.log('node scripts/import-health-tracking.mjs --input tracking-candidates.json --output preview-directory [--publish --data-dir .local-data]');process.exit(0)}
if(!values.input||!values.output)throw Error('必须指定 --input 和 --output。默认只导出预览；--publish 才会写入事件中心。')
const root=fileURLToPath(new URL('../',import.meta.url)),bundle=JSON.parse(await readFile(resolve(values.input),'utf8')),output=resolve(values.output),data=resolve(values['data-dir']||join(root,'.local-data'))
buildTrackingEvents(bundle) // Validate before creating any output or repository.
if(!values.publish&&(output===data||data.startsWith(output+'/')||data.startsWith(output+'\\')))throw Error('预览目录不能覆盖正式数据根目录')
await mkdir(output,{recursive:true})
const repository=await createEventRepository(values.publish?data:join(output,'preview'))
try{const receipt={...(await importTrackingEvents(repository,bundle,{directory:values.publish?data:undefined})),published:values.publish,schedulerEnabled:false,at:new Date().toISOString()};await writeFile(join(output,'tracking-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt))}finally{await repository.close()}
