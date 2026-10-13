import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {resolve,join} from 'node:path'
import {existsSync,readdirSync,copyFileSync,mkdirSync} from 'node:fs'
const buildId=Date.now().toString(36)
export default defineConfig({
 plugins:[vue(),{
 name:'ship-release',
 transformIndexHtml(html){return html.replaceAll('__SHIP_BUILD_ID__',buildId)},
 generateBundle(){this.emitFile({type:'asset',fileName:'build-version.json',source:JSON.stringify({version:buildId})})},
 writeBundle(options){const retained=resolve('.openai/retained-assets');if(!existsSync(retained))return;const target=join(options.dir,'assets');mkdirSync(target,{recursive:true});for(const name of readdirSync(retained)){if(/^[\w.-]+\.(js|css)$/.test(name)&&!existsSync(join(target,name)))copyFileSync(join(retained,name),join(target,name))}}
 }],
 resolve:{alias:{'@':resolve(__dirname,'src')}},
 server:{host:'0.0.0.0',port:5173,allowedHosts:true},
 build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules')&&/[/\\](echarts|zrender)[/\\]/.test(id))return 'charts'}}}},
 base:'./'
})
