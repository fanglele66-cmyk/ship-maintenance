import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {eventTitle} from '../src/workflow/eventTitle.js'
import {normalizeAnomalyAnalysis} from '../src/workflow/manualAnomaly.js'
import {createEventRepository} from '../server/event-repository.mjs'

test('alarm and warning names omit pending verification without changing uncertainty evidence',()=>{
 for(const type of ['报警事件','预警事件'])for(const title of ['主机扫气温度异常待核实','主机扫气温度异常（待核实）','主机扫气温度异常 · 待核查'])assert.equal(eventTitle(title,type),'主机扫气温度异常')
 assert.equal(eventTitle('基线偏离待核实','异动跟踪'),'基线偏离待核实')
 const analysis=normalizeAnomalyAnalysis({title:'主机扫气温度异常待核实',summary:'异常原因待核实。',interpretation:'仅有现场描述。',unverified:'现场读数待核实。',recommendation:'核对本步温度。',steps:[{label:'核对温度',guide:'对照现场温度计。',checks:['记录示值'],recordHint:'记录示值'}]})
 assert.equal(analysis.title,'主机扫气温度异常');assert.equal(analysis.summary,'异常原因待核实。');assert.equal(analysis.unverified,'现场读数待核实。')
})

test('legacy event titles upgrade in SQLite and JSON once, preserving identity and all execution content',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'event-title-'));let repository=await createEventRepository(directory)
 t.after(async()=>{await repository.close();await rm(directory,{recursive:true,force:true})})
 const event={id:'manual-title-test',number:'CBY-KEEP',type:'报警事件',title:'主机扫气温度异常待核实',tasks:[{id:'task-keep',draft:{note:'现场原因待核实'}}],reports:[{id:'report-keep',markdown:'原始报告待核实'}],conversations:{captain:[{id:'message-keep',text:'原因待核实，先确认现场'}]},manualReport:{analysis:{title:'历史分析名称待核实',unverified:'测点待核实'}},participants:[]}
 // Insert a pre-upgrade record, as an already-running user's workspace would contain.
 repository.db.prepare('INSERT INTO events VALUES(?,?,?,?)').run(event.id,7,JSON.stringify(event),Date.now())
 await repository.close();repository=await createEventRepository(directory)
 const saved=repository.get(event.id),file=JSON.parse(await readFile(join(directory,'events',event.id,'event.json'),'utf8'))
 assert.equal(saved.title,'主机扫气温度异常');assert.equal(saved.serverRevision,8);assert.deepEqual(file,saved)
 for(const key of ['id','number','tasks','reports','conversations','manualReport'])assert.deepEqual(saved[key],event[key],key)
 await repository.close();repository=await createEventRepository(directory);assert.equal(repository.get(event.id).serverRevision,8)
 const warning=await repository.save({...event,id:'detected-title-test',type:'预警事件',title:'燃油压力偏低待核查'});assert.equal(warning.title,'燃油压力偏低')
})
