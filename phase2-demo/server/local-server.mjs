import {getWorkflowService,workflowHandler} from './workflow-service.mjs'
import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createAuthService} from './auth-api.mjs'
import {createDataService} from './data-api.mjs'
import {createAiHandler} from './ai-api.mjs'
import {configStore,resolveProvider} from './ai-config.mjs'
import {openLocalData} from './local-data.mjs'
import {normalizeContextPath,handleContextPath} from './context-path.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'dist')
const contextPath=normalizeContextPath(process.env.SHIP_CONTEXT_PATH||'')
// Fail before accepting traffic when the deployment bundle is incomplete.
if(process.env.SHIP_REQUIRE_TELEMETRY==='true'){
 const check=openLocalData(root);check.close()
 const config=await configStore(root).read()
 if(config.enabled)await resolveProvider(config)
}
const auth=await createAuthService(root)
const data=await createDataService(root),ai=createAiHandler(root),workflow=await getWorkflowService(root),events=await workflowHandler(root)
if(process.env.SHIP_SCHEDULERS_ENABLED!=='false')workflow.start()
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'}
async function staticFile(req,res){
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
  if(pathname.startsWith('/api/')){res.writeHead(404);return res.end()}
  let file=resolve(dist,'.'+pathname)
  if(!file.startsWith(dist+sep)&&file!==dist){res.writeHead(403);return res.end()}
  try{if(!(await stat(file)).isFile())file=resolve(dist,'index.html')}catch{file=resolve(dist,'index.html')}
  const bytes=await readFile(file);res.setHeader('Content-Type',(types[extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(req.method==='HEAD'?undefined:bytes)
 }catch{res.writeHead(503);res.end('Build the frontend with npm run build first.')}
}
let stopping=false
const server=createServer((req,res)=>{
 if(handleContextPath(req,res,contextPath))return
 if(['/healthz','/readyz'].includes((req.url||'').split('?')[0])&&['GET','HEAD'].includes(req.method)){
  res.writeHead(stopping?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'})
  return res.end(req.method==='HEAD'?undefined:JSON.stringify({status:stopping?'stopping':'ok'}))
 }
 Promise.resolve(auth.handler(req,res,()=>data.handler(req,res,()=>events(req,res,()=>ai(req,res,()=>void staticFile(req,res)))))).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end()})
})
const host=process.env.HOST||'127.0.0.1'
server.listen(Number(process.env.PORT)||5173,host,()=>console.log(JSON.stringify({level:'info',event:'server_started',host,port:server.address().port,contextPath,requestMode:process.env.SHIP_REQUEST_MODE||'local',publicOrigin:process.env.SHIP_PUBLIC_ORIGIN||'',schedulers:process.env.SHIP_SCHEDULERS_ENABLED!=='false'})))
async function shutdown(){
 if(stopping)return;stopping=true
 const deadline=setTimeout(()=>process.exit(1),Math.max(1000,Number(process.env.SHIP_SHUTDOWN_TIMEOUT_MS)||30000));deadline.unref()
 await new Promise(resolve=>server.close(resolve))
 await data.close();await workflow.close();auth.close();clearTimeout(deadline)
}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown)
