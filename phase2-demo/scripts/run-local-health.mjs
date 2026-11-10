import {fileURLToPath} from 'node:url'
import {createHealthScheduler} from '../server/health-scheduler.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const scheduler=await createHealthScheduler(root)
try{await scheduler.tick();const status=await scheduler.status();console.log(JSON.stringify(status,null,2));if(!status.latest||status.job?.status==='failed')process.exitCode=1}finally{await scheduler.close()}
