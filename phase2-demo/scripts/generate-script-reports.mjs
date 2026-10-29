import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,submitTask,currentTask,people} from '../src/workflow/eventLifecycle.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),docs=path.join(root,'docs')
const script=await readFile(path.join(docs,'四事件交互演示脚本.md'),'utf8')
const sections=script.split(/(?=^## 事件[一二三四]：)/m).slice(1).map(s=>s.split('## 交付范围说明')[0])
const ids=['real-alarm-0430','real-warning-0523','real-tracking-exhaust-baseline','real-health-c4-baseline']
function part(section,heading){const start=section.indexOf('### '+heading);assert.ok(start>=0,heading);return section.slice(start).split('\n### ')[0]}
const quote=section=>section.split('\n').filter(line=>line.startsWith('> ')).map(line=>line.slice(2).trim()).join('\n')
const rows=section=>section.split('\n').filter(line=>line.startsWith('|')&&!line.startsWith('|---')).slice(1).map(line=>line.split('|').slice(1,-1).map(cell=>cell.trim()))
const state=createLifecycleState(),deadline=new Date(Date.now()+86400000*2).toISOString().slice(0,16)
function assign(id,action,scope){state.role='captain';decide(state,id,{action,owner:people.engineer,deadline,reason:scope,order:id.includes('c4')?'CBY-WO-2026-1028-04':'CBY-WO-2026-1028-01',window:'V261029 · 宁波靠港，10月29日 08:00—14:00 停机窗口'})}
function submit(id,section){
 const task=currentTask(state.events[id]),inputs=rows(section)
 assert.equal(inputs.length,task.steps.length,id+'逐项填写数量')
 task.draft.records.forEach((record,i)=>{const [label,result,note]=inputs[i];assert.equal(label,record.label,id+'检查项');assert.ok(task.steps[i].options.includes(result),result);record.result=result;record.note=note})
 task.draft.summary=quote(section);assert.ok(task.draft.summary)
 state.role='engineer';return submitTask(state,id)
}
const combined=['# 四事件报告填写案例','','配合[四事件操作脚本](./四事件交互演示脚本.md)使用。以下成稿由脚本中的逐项选择、备注及结论，通过页面同一套报告生成逻辑整理。事件编号固定；负责人、时间与任务安排在页面中按本次操作记录。完整报告可在[报告成稿目录](./四事件报告成稿/README.md)逐份查看。','']
const index=['# 四事件报告成稿','','以下文件按操作脚本完整填写后生成，内容与页面生成报告一致。原始逐项记录置于报告末尾。','','| 事件编号 | 事件 | 报告 |','|---|---|---|']
let count=0
for(let i=0;i<ids.length;i++){
 const id=ids[i],section=sections[i],event=state.events[id]
 assign(id,'investigate',quote(part(section,i===3?'轮机长继续排查':'轮机长派发排查')))
 submit(id,part(section,i===3?'大管轮第二轮排查':'大管轮排查'))
 assign(id,i<2?'repair':'maintenance',quote(part(section,i<2?'轮机长派发维修':'轮机长关联维保单')))
 submit(id,part(section,i<2?'大管轮维修报告':'大管轮维保报告'))
 state.role='captain';decide(state,id,{action:'close',reason:quote(part(section,'轮机长结果处置'))})
 combined.push(section.split('\n')[0],'')
 const directory=`${i+1}-${event.title}`;await mkdir(path.join(docs,'四事件报告成稿',directory),{recursive:true})
 for(let j=0;j<event.reports.length;j++){
  const report=event.reports[j],filename=`${j+1}-${report.title.split(' · ').at(-1)}.md`
  await writeFile(path.join(docs,'四事件报告成稿',directory,filename),report.markdown+'\n','utf8')
  index.push(`| ${event.number} | ${event.title} | [${report.title.split(' · ').at(-1)}](./${directory}/${filename}) |`)
  combined.push(report.markdown.replace(/^(#{1,3}) /gm,'$1## '),'','---','');count++
 }
}
await writeFile(path.join(docs,'四事件报告填写案例.md'),combined.join('\n'),'utf8')
await writeFile(path.join(docs,'四事件报告成稿','README.md'),index.join('\n')+'\n','utf8')
console.log(`已按脚本生成 ${ids.length} 个事件、${count} 份报告；逐项标签和选项校验通过。`)
