import {fileURLToPath} from 'node:url'
import {configStore,resolveProvider} from '../server/ai-config.mjs'
import {invokeModel} from '../server/model.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
try{
 const config=await configStore(root).read(),provider=await resolveProvider(config)
 const result=await invokeModel(provider,config,'请使用中文简短回答。','请只回复：连接成功。')
 console.log(JSON.stringify({provider:provider.name,model:result.model,answer:result.text,usage:result.usage},null,2))
}catch(error){console.error(error.message);process.exitCode=1}
