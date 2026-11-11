import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {knowledgeReferences} from '../src/workflow/knowledgeReferences.js'
import {createKnowledge} from '../server/knowledge.mjs'

const docs=JSON.parse(await readFile('src/mock/wikiKnowledge.json','utf8'))
test('references deduplicate documents, cap visible links at three, and resolve into indexed knowledge',()=>{
 const inputs=docs.slice(0,4).flatMap((d,i)=>[{id:'K'+(i*2+1),file:d.sourcePath},{id:'K'+(i*2+2),file:d.sourcePath.replace('wiki_rt-flex50/','').replaceAll('/','\\')}])
 const links=knowledgeReferences(inputs,docs)
 assert.equal(links.length,3);assert.deepEqual(links[0].citations,['K1','K2'])
 for(const link of links){assert.equal(link.href,'/#/knowledge?doc='+link.id);assert.equal(link.title,docs.find(d=>d.id===link.id).title);assert.equal(link.text,undefined);assert.equal(link.file,undefined)}
 assert.deepEqual(knowledgeReferences([{id:'K1',file:'log.md',title:'log'}],docs),[])
})
test('temperature retrieval returns located operating limits and sensor-mapping conditions, not ingestion logs',async()=>{
 const kb=createKnowledge('wiki_rt-flex50'),sources=await kb.search('扫气温度一般的正常范围是多少'),text=sources.map(s=>s.text).join('\n')
 assert.match(sources[0].file,/扫气温度正常范围与测点辨识/);assert.match(text,/25–60/);assert.match(text,/TE4031A/);assert.match(text,/TE4081/);assert.match(text,/DC0022–DC0027/)
 assert(sources.every(s=>!/(?:^|\/)(?:index|log)\.md$/.test(s.file)));assert(sources.every(s=>!s.text.startsWith('---')))
 const pressure=await kb.search('控制空气压力正常范围')
 assert.match(pressure[0].file,/控制空气系统/);assert(!pressure.some(s=>/扫气温度正常范围与测点辨识/.test(s.file)))
 for(const s of sources){const lines=(await readFile('wiki_rt-flex50/'+s.file,'utf8')).split(/\r?\n/);assert.equal(lines.slice(s.startLine-1,s.endLine).join('\n'),s.text)}
})
test('all six new knowledge pages have working crosslinks, source copies and images',async()=>{
 const titles=['长航碧玉主机运行参数纸质说明书','本地厂家说明书与图纸目录','持续运行参数与版本对照','主机报警与保护设定速查','扫气温度正常范围与测点辨识','厂家图纸辅助排查与测点核对']
 for(const title of titles){const d=docs.find(d=>d.title===title);assert(d,title);const md=await readFile(d.sourcePath,'utf8');assert.equal(await readFile('public/'+d.sourcePath,'utf8'),md)
  for(const [,target] of md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g))assert(docs.some(x=>x.title===target),target)
  for(const [,src] of d.chapterHTML.matchAll(/<img src="([^"]+)"/g))await access('public'+decodeURIComponent(src))
  assert(!d.chapterHTML.includes('原资料缺少图文件'));assert(!d.chapterHTML.includes('[[已缺失'))
 }
 const table=docs.find(d=>d.title==='主机报警与保护设定速查').chapterHTML
 assert.match(table,/PT2001A/);assert.match(table,/L 3.5 bar，0 s/);assert.match(table,/LL 2.8 bar，10 s/);assert.match(table,/H 70 ℃，60 s/)
})
