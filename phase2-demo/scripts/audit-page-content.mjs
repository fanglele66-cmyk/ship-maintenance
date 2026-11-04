import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,relative,dirname,extname} from 'node:path'
import {createHash} from 'node:crypto'
import {knowledgeDocs} from '../src/mock/knowledge.js'
import {inspectionReports,inspectionReportDetails} from '../src/mock/inspection.js'
const root=resolve('.'),out=resolve('docs/审查附件-20261104')
await mkdir(out,{recursive:true})
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat()}
const files=(await Promise.all(['src','server'].map(d=>walk(resolve(d))))).flat().filter(p=>['.vue','.js','.mjs','.json'].includes(extname(p))&&!/ai-config\.(?:local\.)?json$/.test(p))
const texts=new Map(await Promise.all(files.map(async p=>[p,await readFile(p,'utf8')]))),edges=new Map()
for(const [p,s] of texts){const deps=[];for(const m of s.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)){const spec=m[1];if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;const base=spec.startsWith('@/')?resolve('src',spec.slice(2)):resolve(dirname(p),spec);const target=[base,...['.vue','.js','.mjs','.json'].map(x=>base+x),resolve(base,'index.js')].find(f=>texts.has(f));if(target)deps.push(target)}edges.set(p,deps)}
const seen=new Set();function visit(p){if(seen.has(p))return;seen.add(p);for(const child of edges.get(p)||[])visit(child)}
for(const p of ['src/main.js','src/router/routes.js','server/ai-api.mjs'])visit(resolve(p))
const clean=s=>s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'')
const patterns={选项堆叠:/若|可选择|也可|或者|可继续|否则/g,演示措辞:/演示|示例|模拟|原型|占位/g,泛化措辞:/结合.{0,16}判断|以.{0,15}为准|按.{0,12}执行|后续安排|仍需核实|相关.{0,8}情况/g}
const csv=rows=>'\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')
const inventory=[]
for(const [p,s] of texts){const body=clean(s),counts=Object.fromEntries(Object.entries(patterns).map(([k,re])=>[k,[...body.matchAll(re)].length]));inventory.push({file:relative(root,p).replaceAll('\\','/'),lines:s.split('\n').length,reachable:seen.has(p),chineseLines:body.split('\n').filter(l=>/[\u4e00-\u9fff]/.test(l)).length,sha256:createHash('sha256').update(s).digest('hex'),...counts})}
inventory.sort((a,b)=>a.file.localeCompare(b.file));await writeFile(resolve(out,'内容来源清单.csv'),csv([Object.keys(inventory[0]),...inventory.map(Object.values)]))
const ksource=texts.get(resolve('src/mock/knowledge.js'))
const knowledge=knowledgeDocs.map(d=>{const line=ksource.split('\n').findIndex(l=>l.includes("doc('"+d.id+"'"));const call=ksource.split('\n')[line]||'';return {id:d.id,title:d.title,device:d.device,type:d.docType,sourceLine:line+1,source: /,\s*''\s*,/.test(call)?'通用生成模板':'复用静态章节',bodyHash:createHash('sha256').update(d.chapterHTML).digest('hex'),hasPrimarySourceMetadata:Boolean(d.sourcePath||d.sourceUrl)}})
await writeFile(resolve(out,'知识文档核查.csv'),csv([Object.keys(knowledge[0]),...knowledge.map(Object.values)]))
const inspections=inspectionReports.map(r=>{const d=inspectionReportDetails[r.id],items=d.systems.flatMap(s=>s.items);return {id:r.id,title:r.title,summary:r.summary,statsTotal:d.stats.slice(0,3).reduce((n,s)=>n+Number(s.value),0),actualRows:items.length,totalsMatch:d.stats.slice(0,3).reduce((n,s)=>n+Number(s.value),0)===items.length,health:d.stats[3].value,source:'src/mock/inspection.js'}})
await writeFile(resolve(out,'巡检报告核查.csv'),csv([Object.keys(inspections[0]),...inspections.map(Object.values)]))
const summary={date:'2026-11-04',sourceFiles:inventory.length,chineseFiles:inventory.filter(i=>i.chineseLines).length,reachableFiles:inventory.filter(i=>i.reachable).length,unreachableFiles:inventory.filter(i=>!i.reachable).map(i=>i.file),knowledgeDocs:knowledge.length,generatedKnowledgeDocs:knowledge.filter(d=>d.source==='通用生成模板').length,sharedKnowledgeBodies:knowledge.length-new Set(knowledge.map(d=>d.bodyHash)).size,inspectionReports:inspections.length,inspectionCountMismatch:inspections.filter(d=>!d.totalsMatch).length,notes:['依赖图按静态导入与字面量动态导入构建；可达不等于默认页面可见。','关键词次数仅用于检索，不等同于人工确认的问题数。','JSON 数据已纳入文件盘点；本轮未重新计算全部原始采样。']}
await writeFile(resolve(out,'审查统计.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2))
