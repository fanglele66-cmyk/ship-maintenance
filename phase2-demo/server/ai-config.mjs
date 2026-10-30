import {readFile,mkdir,writeFile,rename} from 'node:fs/promises'
import {join} from 'node:path'
import {homedir} from 'node:os'

// 原 GLM（众数个人用，glm-5.3-flash）配置暂时停用，保留以便恢复：
// const defaultProviderId='34515a36-dd04-47f2-a976-cdbc98f0f19a'
const defaultProviderId='0a032ef9-8898-4498-94d5-8071c3545ddd' // CC Switch: DeepSeek
// DeepSeek /models reports a maximum of 393216 output tokens (384K).
export const maxOutputTokens=393216
export const defaults={enabled:true,source:'cc-switch',providerId:defaultProviderId,model:'',baseUrl:'',protocol:'anthropic',maxTokens:maxOutputTokens,timeoutMs:180000,taskMaxTokens:maxOutputTokens,taskTimeoutMs:180000,knowledgeEnabled:true}
export function configStore(root){
 const directory=join(root,'.local-ai'),file=join(directory,'config.json')
 return {
  async read(){try{return {...defaults,...JSON.parse(await readFile(file,'utf8'))}}catch(e){if(e.code==='ENOENT')return {...defaults};throw Error('本地模型配置文件无法读取。')}},
  async write(input){
   const current=await this.read(),next={...current}
   for(const k of Object.keys(defaults))if(Object.hasOwn(input,k))next[k]=input[k]
   if(input.apiKey?.trim())next.apiKey=input.apiKey.trim()
   if(!['cc-switch','manual'].includes(next.source)||!['anthropic','openai'].includes(next.protocol))throw Error('不支持的模型配置。')
   if(typeof next.enabled!=='boolean'||typeof next.knowledgeEnabled!=='boolean')throw Error('开关配置无效。')
   for(const key of ['model','baseUrl','providerId'])if(typeof next[key]!=='string'||next[key].length>500)throw Error('模型配置字段无效。')
   next.maxTokens=Number(next.maxTokens);next.timeoutMs=Number(next.timeoutMs)
   if(!Number.isInteger(next.maxTokens)||next.maxTokens<512||next.maxTokens>maxOutputTokens||!Number.isInteger(next.timeoutMs)||next.timeoutMs<5000||next.timeoutMs>180000)throw Error('输出上限或超时配置超出范围。')
   next.taskMaxTokens=Number(next.taskMaxTokens);next.taskTimeoutMs=Number(next.taskTimeoutMs)
   if(!Number.isInteger(next.taskMaxTokens)||next.taskMaxTokens<512||next.taskMaxTokens>maxOutputTokens||!Number.isInteger(next.taskTimeoutMs)||next.taskTimeoutMs<5000||next.taskTimeoutMs>180000)throw Error('任务输出上限或超时配置超出范围。')
   if(next.baseUrl){const url=new URL(next.baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('接口地址格式不正确。')}
   if(next.source==='manual'&&(!next.model||!next.baseUrl||!next.apiKey))throw Error('手动配置需要接口地址、模型和密钥。')
   await mkdir(directory,{recursive:true});await writeFile(file+'.tmp',JSON.stringify(next,null,2),'utf8');await rename(file+'.tmp',file);return next
  }
 }
}
export async function providers(){
 const {DatabaseSync}=await import('node:sqlite')
 const db=new DatabaseSync(process.env.CC_SWITCH_DB||join(homedir(),'.cc-switch','cc-switch.db'),{readOnly:true})
 try{return db.prepare("SELECT id,name,settings_config,meta FROM providers WHERE app_type='claude'").all().map(row=>{
  const env=JSON.parse(row.settings_config).env||{},meta=JSON.parse(row.meta||'{}')
  return {id:row.id,name:row.name,baseUrl:env.ANTHROPIC_BASE_URL||'',model:env.ANTHROPIC_MODEL||env.ANTHROPIC_DEFAULT_SONNET_MODEL||'',apiKey:env.ANTHROPIC_AUTH_TOKEN||env.ANTHROPIC_API_KEY||'',protocol:meta.apiFormat==='openai'?'openai':'anthropic'}
 })}finally{db.close()}
}
export async function resolveProvider(config){
 if(config.source==='manual')return {...config,name:'手动配置'}
 let list;try{list=await providers()}catch{throw Error('无法读取 CC Switch，请检查当前电脑的配置。')}
 const selected=list.find(p=>p.id===config.providerId)
 if(!selected)throw Error('CC Switch 中找不到所选供应商。')
 const provider={...selected,model:config.model||selected.model,baseUrl:config.baseUrl||selected.baseUrl}
 if(!provider.apiKey||!provider.baseUrl||!provider.model)throw Error('供应商缺少接口地址、模型或密钥。')
 return provider
}
export const publicProvider=({apiKey,...rest})=>({...rest,hasApiKey:Boolean(apiKey)})
