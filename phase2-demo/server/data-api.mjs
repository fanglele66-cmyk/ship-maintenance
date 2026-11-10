import {openLocalData} from './local-data.mjs'
import {createHealthScheduler} from './health-scheduler.mjs'

export async function createDataService(root){
 let data=null,cache=null,at=0
 const scheduler=await createHealthScheduler(root)
 scheduler.start()
 return {
  handler:async(req,res,next)=>{
   const url=new URL(req.url,'http://localhost')
   if(!url.pathname.startsWith('/api/data/'))return next()
   res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store')
   if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'GET required'}))}
   // Same-origin, loopback-only data service. Do not expose copied ship data to arbitrary websites.
   const ip=req.socket.remoteAddress
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)||req.headers['x-engine-room-client']!=='local-ui'||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.statusCode=403;return res.end(JSON.stringify({error:'仅支持本机应用访问'}))}
   try{
    if(url.pathname==='/api/data/health')return res.end(JSON.stringify(await scheduler.status()))
    if(url.pathname!=='/api/data/situation'){res.statusCode=404;return res.end('{}')}
    data ||= openLocalData(root)
    if(!cache||Date.now()-at>10000){cache=data.snapshot();at=Date.now()}
    res.end(JSON.stringify(cache))
   }catch{res.statusCode=503;res.end(JSON.stringify({error:'本地数据尚未准备完成或不可读取，请先运行 data:prepare。'}))}
  },
  async close(){await scheduler.close();data?.close()},
 }
}
export function localDataPlugin(){return {name:'engine-room-local-data',apply:'serve',async configureServer(server){const service=await createDataService(server.config.root);server.middlewares.use((req,res,next)=>void service.handler(req,res,next));server.httpServer?.once('close',()=>void service.close())}}}
