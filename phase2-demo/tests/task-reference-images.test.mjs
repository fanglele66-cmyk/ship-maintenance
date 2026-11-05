import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {getTaskReferenceImages,taskReferenceImageCatalog} from '../src/workflow/taskReferenceImages.js'
import {taskPackages} from '../src/mock/realTaskContent.js'
import {compactRepair} from '../src/mock/compactRepair.js'
import {baselineMaintenanceWorkFor,baselineTaskSets} from '../src/mock/baselineTaskContent.js'
import {maintenancePlans} from '../src/workflow/maintenancePlans.js'
import {groupRepairSteps} from '../src/workflow/repairStepGroups.js'

const root=fileURLToPath(new URL('..',import.meta.url))
const ids=images=>images.map(item=>item.id)
const event={air:{id:'real-warning-0523'},icu:{id:'real-alarm-0430'},c1:{id:'real-tracking-exhaust-baseline',tracking:true},c4:{id:'real-health-c4-baseline',tracking:true}}
const refs=(family,label,extra={})=>getTaskReferenceImages({event:event[family],task:{kind:'investigation'},step:{label},...extra})

test('every visible reference has a real local asset, meaningful caption and provenance',()=>{
 assert.equal(new Set(taskReferenceImageCatalog.map(item=>item.id)).size,taskReferenceImageCatalog.length)
 for(const item of taskReferenceImageCatalog){
  for(const key of ['id','src','title','type','sourceLabel','sourceFile','focus','note'])assert.ok(item[key]?.trim(),`${item.id}: missing ${key}`)
  assert.ok(item.src.startsWith('/task-reference-images/')||item.src.startsWith('/wiki_rt-flex50/images/'))
  assert.ok(fs.existsSync(path.join(root,'public',item.src)),`${item.id}: missing public image`)
  assert.ok(fs.statSync(path.join(root,'public',item.src)).size>1000,`${item.id}: empty/corrupt image`)
  if(item.id.endsWith('history')){
   assert.match(item.type,/历史/)
   assert.match(item.note,/不是本轮|不代表本轮/)
   assert.match(item.note,/时间戳/)
   assert.ok(fs.existsSync(path.join(root,item.sourceFile)))
  }
  if(item.page){
   assert.ok(Number.isInteger(item.page)&&item.page>0)
   // Source PDFs live outside this Git repo; the packaged image and extraction
   // receipt remain verifiable in a standalone checkout/deployment.
   assert.ok(item.sourceFile.startsWith('doc/图纸以及图片/'))
   assert.match(item.sourceSha256,/^[a-f0-9]{64}$/)
   assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'public',item.src))).digest('hex'),item.imageSha256)
   assert.ok(item.figure?.trim())
   assert.equal(item.cropPoints.length,4)
  }
 }
})

test('control air repair examples show supply, location and actual historical component references',()=>{
 const work=compactRepair({realType:'warning',packages:taskPackages('warning')},['regulator','air'])
 const task={kind:'repair',steps:groupRepairSteps(work.tasks)}
 const flat=task.steps.flatMap(step=>step.substeps||[step])
 const results=flat.map(step=>({label:step.label,ids:ids(getTaskReferenceImages({event:event.air,task,step}))}))
 assert.ok(results.find(row=>/供气配置/.test(row.label)).ids.includes('air-system-overview'))
 assert.ok(results.find(row=>/减压阀密封/.test(row.label)).ids.includes('pressure-reducer-history'))
 assert.deepEqual(results.find(row=>/控制空气通路/.test(row.label)).ids,['control-air-measurement'])
 assert.ok(results.every(row=>row.ids.length<=2&&!row.ids.some(id=>id.startsWith('icu-'))))
 assert.ok(ids(refs('air','核对压力测点及时间对应')).includes('control-air-measurement'))
 // The four neighboring repair operations each get a different useful image;
 // investigation may retain two complementary views.
 const repairLabels=['标识连接并保存处理前状态','确认供气配置与隔离范围','处理减压阀密封与调压异常','处理控制空气通路问题']
 assert.deepEqual(repairLabels.map(label=>ids(refs('air',label,{task}))),[
  ['air-inlet-location'],['air-system-overview'],['pressure-reducer-history'],['control-air-measurement'],
 ])
 assert.equal(refs('air','核查控制空气供给及工况').length,2)
})

test('ICU investigation has identification references; approved repair gains historical dismantling context',()=>{
 const investigation=refs('icu','核查 C2 ICU 液压机构与反馈')
 assert.ok(ids(investigation).includes('icu-connections'))
 assert.ok(!ids(investigation).includes('icu-history'))
 const work=compactRepair({realType:'alarm',packages:taskPackages('alarm')},['icv','supply'])
 const task={kind:'repair',steps:work.tasks}
 const icuStep=work.tasks.find(step=>step.label.includes('ICU 控制'))
 assert.ok(ids(getTaskReferenceImages({event:event.icu,task,step:icuStep})).includes('icu-history'))
 const supplyStep=work.tasks.find(step=>step.label.includes('燃油供给'))
 assert.deepEqual(ids(getTaskReferenceImages({event:event.icu,task,step:supplyStep})),[],'supply overview already appeared in preparation')
 assert.ok(ids(refs('icu','按授权完成 ICU 修复或总成交接',{task})).includes('icu-removal'))
})

test('both C1/C4 plans illustrate measurement and combustion without substituting a valve position sensor',()=>{
 for(const family of ['c1','c4']){
  for(const plan of maintenancePlans(event[family])){
   const task={...plan,kind:'maintenance'}
   const measurement=plan.steps.find(step=>step.label.includes('测量链路'))
   assert.deepEqual(ids(getTaskReferenceImages({event:event[family],task,step:measurement})),['exhaust-temperature-points'])
   const combustion=plan.steps.find(step=>step.label.includes('燃烧与排气'))
   if(combustion)assert.deepEqual(ids(getTaskReferenceImages({event:event[family],task,step:combustion})),['injection-valve-section','exhaust-valve-connections'])
   assert.deepEqual(getTaskReferenceImages({event:event[family],task,step:plan.steps[0]}),[])
  }
  const oldWork=baselineMaintenanceWorkFor(family==='c1'?1:4)
  const task={kind:'maintenance'}
  const measures=oldWork.tasks.find(step=>step.label.includes('批准措施'))
  assert.ok(ids(getTaskReferenceImages({event:event[family],task,step:measures})).includes('exhaust-valve-section'))
 }
 assert.ok(ids(getTaskReferenceImages({event:event.c1,task:{kind:'investigation'},step:baselineTaskSets.tracking[0]})).includes('exhaust-temperature-points'))
 assert.ok(ids(getTaskReferenceImages({event:event.c4,task:{kind:'investigation'},step:baselineTaskSets.maintenance[0]})).includes('exhaust-temperature-points'))
})

test('reference selection respects event, operation and snapshot boundaries',()=>{
 assert.deepEqual(getTaskReferenceImages(),[])
 assert.deepEqual(getTaskReferenceImages({event:{id:'unrelated-device'},task:{kind:'repair'},step:{label:'处理减压阀密封与调压异常'}}),[])
 assert.deepEqual(refs('air','整理作业记录并交接效果观察'),[])
 assert.deepEqual(refs('c1','核对月度工况及调整履历'),[])
 assert.deepEqual(refs('air','核对工况及临时恢复解释'),[])
 assert.ok(!ids(refs('icu','处理二缸 ICU 控制与液压执行异常',{task:undefined})).includes('icu-history'))
 const task={kind:'repair',scope:'仅处理已定位的燃油供给问题',steps:[]}
 assert.deepEqual(ids(refs('icu','标识连接并保存处理前状态',{task})),['fuel-system-overview'])
 const part={label:'处理控制空气通路问题'},step={label:'实施维修',checks:['ICU'],substeps:[part,{label:'ICU 拆检'}]}
 const input={event:event.air,task:{kind:'repair'},step,part}
 const before=JSON.stringify(input)
 assert.ok(ids(getTaskReferenceImages(input)).every(id=>!id.startsWith('icu')))
 assert.equal(JSON.stringify(input),before)
 assert.deepEqual(getTaskReferenceImages({...input,part:undefined}),[])
 assert.ok(ids(getTaskReferenceImages({...input,event:{id:'observation-new',sourceEventId:event.air.id}})).includes('control-air-measurement'))
})

test('illustrations appear once across all main steps and their substeps, independent of viewing order',()=>{
 const a={label:'核查 C2 ICU 液压机构与反馈'},b={label:'核查燃油供给与瞬态工况'}
 const investigation={kind:'investigation',steps:[a,b]}
 assert.deepEqual(getTaskReferenceImages({event:event.icu,task:investigation,step:b}),[])
 assert.deepEqual(ids(getTaskReferenceImages({event:event.icu,task:investigation,step:a})),['icu-connections','fuel-system-overview'])
 const work={kind:'repair',scope:'ICU',steps:[{label:'准备',substeps:[{label:'确认作业范围与隔离标识',guide:'ICU'}]},{label:'实施',substeps:[{label:'标识连接并保存处理前状态',guide:'ICU'},{label:'处理二缸 ICU 控制与液压执行异常'}]},{label:'恢复系统并复测喷射响应'}]}
 const before=JSON.stringify(work),displayed=[]
 work.steps.forEach((step,stepIndex)=>(step.substeps||[undefined]).forEach((part,partIndex)=>displayed.push(...getTaskReferenceImages({event:event.icu,task:work,step,part,stepIndex,partIndex}))))
 assert.equal(new Set(displayed.map(image=>image.src)).size,displayed.length)
 assert.ok(displayed.some(image=>image.id==='icu-history'))
 assert.equal(JSON.stringify(work),before)
 // Cloned presentation objects use their stable positions, not object identity.
 const later=JSON.parse(JSON.stringify(work.steps[1]))
 assert.deepEqual(getTaskReferenceImages({event:event.icu,task:work,step:later,part:later.substeps[0],stepIndex:1,partIndex:0}),[])
})
