import {resolveProvider} from './ai-config.mjs'
import {invokeModel} from './model.mjs'
import {skillInstruction,visibleText} from './skill-runtime.mjs'
import {fileURLToPath} from 'node:url'

export async function answerKnowledge(input,{root=fileURLToPath(new URL('../',import.meta.url)),configuration,knowledge,fetcher=fetch,emit=()=>{},signal}){
 const config=await configuration.read()
 if(!config.enabled)throw Error('真实模型已停用，请联系管理员检查后台配置。')
 if(!config.knowledgeEnabled)throw Error('知识库检索已停用，请联系管理员开启后重试。')
 const provider=await resolveProvider(config)
 const history=(Array.isArray(input.history)?input.history:[]).filter(m=>['user','assistant'].includes(m.role)&&typeof m.text==='string').slice(-8).map(m=>({role:m.role,text:m.text.slice(0,4000)}))
 const scope=typeof input.scope==='string'?input.scope.slice(0,300):'主机'
 emit('progress',{label:'正在检索知识库资料…'})
 const sources=await knowledge.search([scope,...history.filter(m=>m.role==='user').slice(-2).map(m=>m.text),input.text].join(' '))
 emit('meta',{sources})
 const instruction=await skillInstruction(root,'ship-knowledge-assistant')
 let shown=''
 const result=await invokeModel(provider,config,instruction,JSON.stringify({question:input.text,scope,history,knowledge:sources}),fetcher,{signal,onReasoning:delta=>emit('reasoning',{delta}),onDelta:(_delta,full)=>{const text=visibleText(full);emit('text',{delta:text.slice(shown.length)});shown=text},onActivity:()=>emit('progress',{label:'正在结合资料生成回答…'})})
 const answer=visibleText(result.text).trim()
 if(!answer)throw Error('模型未返回可显示的回答，请重试。')
 return {answer,sources,model:result.model,usage:result.usage,reasoning:result.reasoning}
}
