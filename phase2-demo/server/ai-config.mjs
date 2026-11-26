import {readFile,mkdir,writeFile,rename,link,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {randomUUID} from 'node:crypto'

const defaultProviderId='0a032ef9-8898-4498-94d5-8071c3545ddd' // CC Switch: DeepSeek
// DeepSeek /models reports a maximum of 393216 output tokens (384K).
export const maxOutputTokens=393216
export const defaults={enabled:true,source:'cc-switch',providerId:defaultProviderId,model:'',baseUrl:'',protocol:'anthropic',maxTokens:maxOutputTokens,timeoutMs:180000,taskMaxTokens:maxOutputTokens,taskTimeoutMs:180000,knowledgeEnabled:true}
const pendingWrites=new Map()

function modelEndpoint(baseUrl){
 const url=new URL(baseUrl)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('接口地址格式不正确。')
 return url
}

async function readProjectProvider(file){
 const project=JSON.parse(await readFile(file,'utf8'))
 if(!project.model?.trim()||!['anthropic','openai'].includes(project.protocol))throw Error('项目模型配置无效。')
 const url=modelEndpoint(project.baseUrl)
 const outputTokenLimit=project.maxTokens??8192
 if(!Number.isInteger(outputTokenLimit)||outputTokenLimit<512||outputTokenLimit>maxOutputTokens)throw Error('项目模型输出上限无效。')
 let apiKey=process.env.SHIP_GLM_API_KEY?.trim()||project.apiKey?.trim()
 if(!apiKey){
  if(typeof project.providerId!=='string'||!project.providerId.trim())throw Error('项目模型缺少 CC Switch 供应商。')
  const [profile]=await providers(project.providerId)
  if(!profile||profile.id!==project.providerId||new URL(profile.baseUrl).origin!==url.origin)throw Error('项目模型凭据不可用。')
  apiKey=profile.apiKey
 }
 if(!apiKey)throw Error('项目模型缺少凭据。')
 return {source:'manual',providerId:project.providerId,name:project.name,model:project.model,baseUrl:project.baseUrl,protocol:project.protocol,apiKey,outputTokenLimit}
}

export function configStore(root,{directory=process.env.SHIP_AI_DIR||join(root,'.local-ai'),seedFile=process.env.SHIP_AI_SEED_FILE,projectFile=join(root,'server','ai-project.json')}={}){
 const file=join(directory,'config.json')
 async function readPersistent(initialize=true){
   try{return {...defaults,...JSON.parse(await readFile(file,'utf8'))}}
   catch(e){
    if(e.code!=='ENOENT')throw Error('本地模型配置文件无法读取。')
    if(!seedFile)return {...defaults}
    let seed
    try{seed=JSON.parse(await readFile(seedFile,'utf8'))}catch{throw Error('服务器模型初始配置无法读取。')}
    if(!initialize)return {...defaults,...seed}
    await mkdir(directory,{recursive:true})
    // Publish complete contents without replacing a concurrently created config.
    const temporaryFile=file+'.'+randomUUID()+'.tmp'
    try{
     await writeFile(temporaryFile,JSON.stringify(seed,null,2),{encoding:'utf8',mode:0o600})
     await link(temporaryFile,file)
    }catch(error){if(error.code!=='EEXIST')throw Error('服务器模型初始配置无法读取。')}
    finally{await rm(temporaryFile,{force:true})}
    return {...defaults,...JSON.parse(await readFile(file,'utf8'))}
   }
 }
 async function writePersistent(input){
   const next={...await readPersistent()}
   for(const k of Object.keys(defaults))if(Object.hasOwn(input,k))next[k]=input[k]
   if(input.apiKey?.trim())next.apiKey=input.apiKey.trim()
   if(!['cc-switch','manual'].includes(next.source)||!['anthropic','openai'].includes(next.protocol))throw Error('不支持的模型配置。')
   if(typeof next.enabled!=='boolean'||typeof next.knowledgeEnabled!=='boolean')throw Error('开关配置无效。')
   for(const key of ['model','baseUrl','providerId'])if(typeof next[key]!=='string'||next[key].length>500)throw Error('模型配置字段无效。')
   next.maxTokens=Number(next.maxTokens);next.timeoutMs=Number(next.timeoutMs)
   if(!Number.isInteger(next.maxTokens)||next.maxTokens<512||next.maxTokens>maxOutputTokens||!Number.isInteger(next.timeoutMs)||next.timeoutMs<5000||next.timeoutMs>180000)throw Error('输出上限或超时配置超出范围。')
   next.taskMaxTokens=Number(next.taskMaxTokens);next.taskTimeoutMs=Number(next.taskTimeoutMs)
   if(!Number.isInteger(next.taskMaxTokens)||next.taskMaxTokens<512||next.taskMaxTokens>maxOutputTokens||!Number.isInteger(next.taskTimeoutMs)||next.taskTimeoutMs<5000||next.taskTimeoutMs>180000)throw Error('任务输出上限或超时配置超出范围。')
   if(next.baseUrl)modelEndpoint(next.baseUrl)
   if(next.source==='manual'&&(!next.model||!next.baseUrl||!next.apiKey))throw Error('手动配置需要接口地址、模型和密钥。')
   const temporaryFile=file+'.'+randomUUID()+'.tmp'
   await mkdir(directory,{recursive:true})
   try{
    await writeFile(temporaryFile,JSON.stringify(next,null,2),{encoding:'utf8',mode:0o600})
    await rename(temporaryFile,file)
   }finally{await rm(temporaryFile,{force:true})}
   return next
 }
 return {
  async read(){
   const project=await readProjectProvider(projectFile).catch(()=>null)
   if(!project)return readPersistent()
   // Preserve administrator switches and request limits even with a project model.
   // A new volume only needs its fallback seed copied when it is actually used.
   const current=await readPersistent(false).catch(()=>defaults)
   return {...current,...project,async loadFallback(){
    const backup=await readPersistent()
    if(!backup.enabled)throw Error('模型已停用。')
    return resolveProvider(backup)
   }}
  },
  async write(input){
   const previous=pendingWrites.get(file)||Promise.resolve()
   const writing=previous.catch(()=>{}).then(()=>writePersistent(input))
   pendingWrites.set(file,writing)
   try{return await writing}finally{if(pendingWrites.get(file)===writing)pendingWrites.delete(file)}
  }
 }
}
export async function providers(id){
 const {DatabaseSync}=await import('node:sqlite')
 const db=new DatabaseSync(process.env.CC_SWITCH_DB||join(homedir(),'.cc-switch','cc-switch.db'),{readOnly:true})
 try{
  const query="SELECT id,name,settings_config,meta FROM providers WHERE app_type='claude'"
  const rows=id?db.prepare(query+' AND id=?').all(id):db.prepare(query).all()
  return rows.map(row=>{
   const env=JSON.parse(row.settings_config).env||{},meta=JSON.parse(row.meta||'{}')
   return {id:row.id,name:row.name,baseUrl:env.ANTHROPIC_BASE_URL||'',model:env.ANTHROPIC_MODEL||env.ANTHROPIC_DEFAULT_SONNET_MODEL||'',apiKey:env.ANTHROPIC_AUTH_TOKEN||env.ANTHROPIC_API_KEY||'',protocol:meta.apiFormat==='openai'?'openai':'anthropic'}
  })
 }finally{db.close()}
}
export async function resolveProvider(config){
 if(config.source==='manual'){
  if(!config.apiKey?.trim()||!config.model?.trim()||!config.baseUrl?.trim())throw Error('手动配置需要接口地址、模型和密钥。')
  if(!['anthropic','openai'].includes(config.protocol))throw Error('不支持的模型协议。')
  modelEndpoint(config.baseUrl)
  return {...config,name:config.name||'手动配置'}
 }
 let list;try{list=await providers(config.providerId)}catch{throw Error('无法读取 CC Switch，请检查当前电脑的配置。')}
 const selected=list.find(p=>p.id===config.providerId)
 if(!selected)throw Error('CC Switch 中找不到所选供应商。')
 const provider={...selected,model:config.model||selected.model,baseUrl:config.baseUrl||selected.baseUrl}
 if(!provider.apiKey||!provider.baseUrl||!provider.model)throw Error('供应商缺少接口地址、模型或密钥。')
 return provider
}
export const publicProvider=({apiKey,loadFallback,...rest})=>({...rest,hasApiKey:Boolean(apiKey)})
