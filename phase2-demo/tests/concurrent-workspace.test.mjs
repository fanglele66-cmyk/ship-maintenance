import test from 'node:test'
import assert from 'node:assert/strict'
import {createBackendWorkflowSync} from '../src/workflow/backendWorkflowSync.js'
import {mergeWorkflowEvent} from '../src/workflow/mergeWorkflowEvent.js'
import {demoWorkspace,mergeDemoWorkspace} from '../src/workflow/workspaceCache.js'
const copy=v=>structuredClone(v)
const event=()=>({id:'manual-test',backendManaged:true,serverRevision:1,conversations:{captain:[],engineer:[]},tasks:[{id:'task-1',draft:{records:[{note:''}]}}],unread:{captain:true,engineer:true}})

test('concurrent chief conversation and engineer note both persist after revision conflict',async()=>{
 let saved=event(),conflicts=0
 const request=async(path,body)=>{
  if(path==='workflow/events')return {events:[copy(saved)]}
  if(body.revision!==saved.serverRevision){conflicts++;throw Object.assign(Error('事件已更新'),{status:409})}
  saved={...copy(body.event),serverRevision:saved.serverRevision+1};return {event:copy(saved)}
 }
 const chief={events:{}},engineer={events:{}},a=createBackendWorkflowSync(chief,request),b=createBackendWorkflowSync(engineer,request)
 await Promise.all([a.pull(),b.pull()])
 chief.events[saved.id].conversations.captain.push({id:'message-chief',text:'核对现场表计。'})
 engineer.events[saved.id].tasks[0].draft.records[0].note='现场0.89 MPa，与系统一致。'
 engineer.events[saved.id].unread.engineer=false
 await Promise.all([a.flush(),b.flush()]);await a.refresh()
 assert.equal(conflicts,1)
 assert.equal(saved.conversations.captain[0].text,'核对现场表计。')
 assert.equal(chief.events[saved.id].tasks[0].draft.records[0].note,'现场0.89 MPa，与系统一致。')
 assert.equal(saved.unread.engineer,false)
 a.close();b.close()
})

test('edits made while save is pending remain dirty and are saved next',async()=>{
 let saved=event(),release,entered
 const started=new Promise(resolve=>entered=resolve)
 let delay=true
 const state={events:{}},sync=createBackendWorkflowSync(state,async(path,body)=>{
  if(path==='workflow/events')return {events:[copy(saved)]}
  if(delay){delay=false;entered();await new Promise(resolve=>release=resolve)}
  saved={...copy(body.event),serverRevision:saved.serverRevision+1};return {event:copy(saved)}
 })
 await sync.pull();state.events[saved.id].unread.captain=false
 const pending=sync.flush();await started
 state.events[saved.id].conversations.captain.push({id:'in-flight',text:'继续核实。'});release();await pending;await sync.flush()
 assert.equal(saved.conversations.captain[0].text,'继续核实。');sync.close()
})

test('conflicting edits to the same field are not silently overwritten',()=>{
 const base=event(),local=copy(base),remote=copy(base)
 local.tasks[0].draft.records[0].note='0.89 MPa';remote.tasks[0].draft.records[0].note='0.80 MPa'
 assert.throws(()=>mergeWorkflowEvent(base,local,remote),/同一内容/)
 assert.equal(local.tasks[0].draft.records[0].note,'0.89 MPa')
})

test('different account caches neither expose nor replace backend events and conversations',()=>{
 const own=event(),foreign={...event(),id:'foreign'}
 const state={events:{[own.id]:own},notices:[{eventId:own.id}]}
 const incoming={events:{[foreign.id]:foreign,[own.id]:{...own,conversations:{}},demo:{id:'demo'}},notices:[{eventId:foreign.id},{eventId:'demo'}]}
 const demo=demoWorkspace(incoming);assert.deepEqual(Object.keys(demo.events),['demo'])
 const merged=mergeDemoWorkspace(state,incoming)
 assert.equal(merged.events[own.id],own);assert(!merged.events.foreign);assert.equal(merged.notices.length,2)
})
