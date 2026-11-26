import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {createLifecycleState, currentTask, decide, people, submitTask} from '../src/workflow/eventLifecycle.js'
import {getWorkflowService, createWorkflowService, workflowHandler} from '../server/workflow-service.mjs'
import {STEP_PHOTO_GRACE_MS} from '../src/workflow/stepPhotoFile.js'
import {assistTaskStep} from '../src/workflow/taskStepAssistance.js'
import {reportPhotoEntries,submittedStepRecords,editableStepRecords} from '../src/workflow/stepPhotoEvidence.js'

test('step photo originals survive draft, submission and service restart, scoped to the task and event',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-step-photos-'))
 let service=await getWorkflowService(directory,{directory})
 const state=createLifecycleState(), event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer'
 const task=currentTask(event)
 event.backendManaged=true
 const saved=await service.repository.save(event)
 Object.assign(event,{serverRevision:saved.serverRevision,title:saved.title})
 const handler=await workflowHandler(directory)
 const http=createServer((req,res)=>{
  const workflowRole=req.headers['test-role']
  if(workflowRole)req.user={workflowRole}
  handler(req,res,()=>{res.writeHead(404);res.end()})
 })
 t.after(async()=>{await new Promise(done=>http.close(done));await service.close();await rm(directory,{recursive:true,force:true})})
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve))
 const url='http://127.0.0.1:'+http.address().port+'/api/workflow/step-photos'
 const bytes=await readFile(new URL('../docs/二缸步骤协作演示/images/c2-icu-demo-generated.png',import.meta.url))
 const upload=(role,index,body=bytes)=>fetch(url+'?'+new URLSearchParams({eventId:event.id,taskId:task.id,stepIndex:index}),{
  method:'POST',headers:{'test-role':role,'Content-Type':'image/png'},body})
 assert.equal((await upload('secondEngineer',0)).status,403)
 assert.equal((await upload('engineer',30)).status,403)
 assert.equal((await upload('engineer',0,Buffer.from('invalid PNG'))).status,400)
 const response=await upload('engineer',0)
 assert.equal(response.status,201)
 const photo={...await response.json(),name:'现场原图.png'}
 const unattached=await (await upload('engineer',1)).json()
 assert.notEqual(unattached.id,photo.id)
 assert.equal(photo.size,bytes.length)
 assert.equal((await (await upload('engineer',0)).json()).id,photo.id)
 const get=role=>fetch(url+'?id='+photo.id,{headers:role?{'test-role':role}:{}})
 assert.equal((await get()).status,401)
 assert.equal((await get('captain')).status,404)
 assert.deepEqual(Buffer.from(await (await get('engineer')).arrayBuffer()),bytes)
 task.draft.records[0].result='发现异常'
 task.draft.records[0].note='已拍照留存'
 task.draft.records[0].photos=[photo]
 task.draft.records[1].result='未见异常'
 const draft=await service.save(event,saved.serverRevision,{workflowRole:'engineer'})
 event.serverRevision=draft.serverRevision
 assert.deepEqual(draft.tasks.at(-1).draft.records[0].photos,[photo])
 const report=submitTask(state,event.id,task.id)
 await service.save(event,draft.serverRevision,{workflowRole:'engineer'})
 assert.deepEqual(report.submissionSnapshot.records[0].photos.map(p=>p.id),[photo.id])
 assert.equal((await upload('engineer',0)).status,403)
 assert.deepEqual(Buffer.from(await (await get('captain')).arrayBuffer()),bytes)
 // A later submission may replace live records; the previous report still owns its evidence.
 const nextVersion=service.repository.get(event.id)
 delete nextVersion.tasks.at(-1).records[0].photos
 delete nextVersion.tasks.at(-1).draft.records[0].photos
 await service.save(nextVersion,nextVersion.serverRevision,{workflowRole:'captain'})
 assert.deepEqual(Buffer.from(await (await get('captain')).arrayBuffer()),bytes)
 await service.close()
 service=await createWorkflowService(directory,{directory,clock:()=>Date.now()+STEP_PHOTO_GRACE_MS+1000})
 assert.throws(()=>service.photos.download(unattached.id,{workflowRole:'engineer'}),/照片不存在/)
 assert.deepEqual(service.photos.download(photo.id,{workflowRole:'captain'}).bytes,bytes)
 assert.deepEqual(service.repository.get(event.id).reports.at(-1).submissionSnapshot.records[0].photos,report.submissionSnapshot.records[0].photos)
})

test('accepted chat photos are attached before a model failure; duplicates retain both sources and later sends stay out of past reports',async()=>{
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer'
 const task=currentTask(event),original={id:'step1-1',contentHash:'first',storage:'browser',name:'部件原图.png',mimeType:'image/png',size:2554493}
 const modelImage={name:'上传副本.png',mimeType:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT8AAAAASUVORK5CYII='}
 task.draft.records[0].photos=[original]
 await assert.rejects(assistTaskStep(state,event.id,task.id,0,'部件已拍照',{originalPhotos:[original],images:[modelImage]},async()=>{throw Error('模型离线')}),/模型离线/)
 const sent=task.conversations.engineer.find(m=>m.kind==='user'&&m.originalPhotos)
 assert.deepEqual(sent.originalPhotos,[original]);assert.equal(sent.images,undefined)
 assert.equal(task.draft.records[0].note,'')
 task.draft.records[0].result='发现异常';task.draft.records[1].result='未见异常'
 const old={...modelImage,name:'既有对话照片.png'}
 task.conversations.engineer.push({kind:'user',stepIndex:0,images:[old],at:sent.at})
 task.conversations.engineer.push({kind:'user',stepIndex:1,originalPhotos:[{...original,id:'step2-1'}],at:sent.at})
 const report=submitTask(state,event.id,task.id),records=report.submissionSnapshot.records
 assert.deepEqual(records[0].photos.map(p=>p.sources),[['form','chat'],['chat']])
 assert.equal(records[0].photos[0].sourceTimes.chat,sent.at)
 assert.deepEqual(records[1].photos[0].sources,['chat'])
 const entries=reportPhotoEntries(records)
 assert.equal(entries.length,2);assert.deepEqual(entries[0].uses.map(site=>site.index),[0,1])
 assert.deepEqual(editableStepRecords(records)[0].photos,[original])
 task.conversations.engineer.push({kind:'user',stepIndex:0,originalPhotos:[{...original,id:'future',contentHash:'future'}],at:new Date(Date.parse(report.at)+1000).toISOString()})
 assert.equal(submittedStepRecords(task,records,report.at)[0].photos.length,2)
 assert.match(report.markdown,/部件原图.png（步骤备注、助手对话）/)
})

test('opening an old ship report restores already-sent chat images as of its submission date',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'ship-historical-photos-'))
 const service=await createWorkflowService(directory,{directory})
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true})})
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer'
 const task=currentTask(event)
 task.draft.records[0].result='发现异常';task.draft.records[1].result='未见异常'
 const report=submitTask(state,event.id,task.id)
 delete report.submissionSnapshot.photoSourcesRecorded
 task.conversations.engineer.push(...[-1,1].map(offset=>({
  kind:'user',stepIndex:0,at:new Date(Date.parse(report.at)+offset*1000).toISOString(),
  images:[{name:offset+'.png',mimeType:'image/png',dataUrl:'data:image/png;base64,'+(offset===1?'AAAA':'AAAB')}]
 })))
 await service.repository.save(event)
 const loaded=service.repository.get(event.id).reports.find(r=>r.id===report.id)
 assert.deepEqual(loaded.submissionSnapshot.records[0].photos.map(p=>[p.name,p.sources]),[['-1.png',['chat']]])
 assert.equal(loaded.at,report.at)
})
