import {readFile,readdir,stat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import assert from 'node:assert/strict'

const dist=resolve('dist')
const html=await readFile(join(dist,'index.html'),'utf8')
assert.match(html,/<script[^>]+src="\.\/assets\//,'Entry JS must use the relative build base')
assert.doesNotMatch(html,/(?:src|href)="\/(?!\/)/,'HTML contains a root-relative resource')
for(const name of ['.local-ai','.local-data','.git','server']){
 let exists=true
 try{await stat(join(dist,name))}catch(error){if(error.code==='ENOENT')exists=false;else throw error}
 assert.equal(exists,false,`Private/runtime directory leaked into dist: ${name}`)
}
const assets=await readdir(join(dist,'assets'))
assert.ok(assets.some(name=>name.endsWith('.js')))
assert.ok(assets.some(name=>name.endsWith('.css')))
const release=JSON.parse(await readFile(join(dist,'build-version.json'),'utf8'))
assert.ok(release.version)
console.log(JSON.stringify({deploymentBuild:'passed',base:'./',release:release.version,assets:assets.length}))
