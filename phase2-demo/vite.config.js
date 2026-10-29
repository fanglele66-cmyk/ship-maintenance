import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {localAiPlugin} from './server/ai-api.mjs'
import {resolve,join} from 'node:path'
import {existsSync,readdirSync,copyFileSync,mkdirSync} from 'node:fs'
const buildId=Date.now().toString(36)
export default defineConfig({
 plugins:[vue(),localAiPlugin(),{
 name:'ship-release',
 transformIndexHtml(html){return html.replaceAll('__SHIP_BUILD_ID__',buildId)},
 generateBundle(){this.emitFile({type:'asset',fileName:'build-version.json',source:JSON.stringify({version:buildId})})},
 writeBundle(options){const retained=resolve('.openai/retained-assets');if(!existsSync(retained))return;const target=join(options.dir,'assets');mkdirSync(target,{recursive:true});for(const name of readdirSync(retained)){if(/^[\w.-]+\.(js|css)$/.test(name)&&!existsSync(join(target,name)))copyFileSync(join(retained,name),join(target,name))}}
 }],
 resolve:{alias:{'@':resolve(__dirname,'src')}},
 server:{host:'127.0.0.1',port:5173,allowedHosts:['localhost','127.0.0.1'],fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.local-ai/**','**/server/**','**/wiki_rt-flex50/**']}},
 build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules')&&/[/\\](echarts|zrender)[/\\]/.test(id))return 'charts'}}}},
 base:'./'
})
