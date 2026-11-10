import {getWorkflowService,workflowHandler} from './workflow-service.mjs'
import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createAuthService} from './auth-api.mjs'
import {createDataService} from './data-api.mjs'
import {createAiHandler} from './ai-api.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'dist')
const auth=await createAuthService(root)
const data=await createDataService(root),ai=createAiHandler(root),workflow=await getWorkflowService(root),events=await workflowHandler(root)
workflow.start()
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
const server=createServer((req,res)=>{Promise.resolve(auth.handler(req,res,()=>data.handler(req,res,()=>events(req,res,()=>ai(req,res,()=>void staticFile(req,res)))))).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end()})})
server.listen(Number(process.env.PORT)||5173,'127.0.0.1',()=>console.log(`Ship local backend: http://127.0.0.1:${server.address().port} (hourly health scheduler active)`))
async function shutdown(){server.close();await data.close();await workflow.close();auth.close()}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown)
