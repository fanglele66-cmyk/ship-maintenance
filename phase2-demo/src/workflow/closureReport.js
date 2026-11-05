import {observationTasks} from './observationEvents.js'
import {taskRoundLabel as taskTitle} from './taskLabels.js'
import {observationStart,isVerificationObservation} from './observationContext.js'

export const closurePresentationVersion=6
const noValue=value=>value===undefined||value===null||value===''?'未记录':String(value)
const date=value=>!value?'未记录':!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)||Number.isNaN(Date.parse(value))?String(value):new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,19)
const rows=records=>(records||[]).map((r,i)=>`**${i+1}. ${r.label}**\n\n- 实际结果：${noValue(r.result)}\n- 现场记录：${r.note||'未填写具体过程或读数。'}`).join('\n\n')

function taskSection(event,task){
 const report=event.reports.findLast(r=>r.taskId===task.id),remaining=(task.records||[]).filter(r=>/未完成|无法确认|受限/.test(r.result))
 return `### ${taskTitle(task)}\n\n- 负责人：${task.owner}\n- 提交时间：${date(task.submittedAt)}\n- 批准范围：${task.scope}\n- 执行状态：${task.status==='terminated'?'未执行部分已终止：'+task.terminationReason:task.status==='waiting'?'等待条件：'+task.waiting.reason:task.goalStatus==='unresolved'?'仍有未执行或待核实项目':'反馈已提交'}\n\n${report?.summary||task.summary||'未提交结论。'}${remaining.length?'\n\n剩余项目：'+remaining.map(r=>r.label+'（'+r.result+'）').join('、')+'。':''}\n\n记录索引：${report?.number||report?.id||task.number||task.id}${report?.revisions?.length?'；含'+report.revisions.length+'次补充记录':''}。`
}

function observationSection(task,closedAt){
 const observation=task.observation
 if(!observation)return `### ${taskTitle(task)}后的观察\n\n未保存自动观察数据；效果以现场已提交的复测和复查记录为依据。`
 const windows=[...(task.observationHistory||[]).flatMap(h=>h.records.map(w=>({...w,priorCycle:true}))),...(observation.records||[]),...(observation.pending?[observation.pending]:[])].filter(w=>Date.parse(w.windowEnd)<=Date.parse(closedAt))
 const latest=windows.at(-1)
 const content=latest?`已保存${windows.length}个观察窗口，其中${windows.filter(w=>w.covered).length}个覆盖达到要求。\n\n最近窗口：${date(latest.windowStart)} — ${date(latest.windowEnd)}\n\n${(latest.channels||[]).map(c=>`- ${c.name}：末值 ${noValue(c.value)} ${c.unit||''}；范围 ${noValue(c.min)}—${noValue(c.max)} ${c.unit||''}；${c.covered?'覆盖达到要求':'存在缺测'}。`).join('\n')}`:''

 return `### ${taskTitle(task)}后的观察\n\n- 观察类型：${isVerificationObservation(task)?'核实后继续观察，本轮暂未处置':'处理后效果观察'}\n- 开始：${date(observationStart(task))}\n- 截止：${date(task.observationEndedAt||closedAt)}\n- 观察周期：${observation.policy?.label||'以本轮配置为准'}\n- 工况核验：${observation.conditions?.reason||'未保存运行工况核验记录'}\n\n${content||'截至闭环时尚无已保存的有效观察窗口。'}`
}

export function closureContent(event,action,reason,at,captain){
 const tasks=observationTasks(event).filter(t=>t.submittedAt&&Date.parse(t.submittedAt)<=Date.parse(at))
 const investigations=tasks.filter(t=>t.kind==='investigation'&&t.purpose!=='recheck'),work=tasks.filter(t=>t.kind!=='investigation'),rechecks=tasks.filter(t=>t.purpose==='recheck')
 const reports=event.reports.filter(r=>r.kind!=='闭环报告'&&Date.parse(r.at)<=Date.parse(at))
 const facts=(event.brief.facts||[]).map(f=>`- **${f.label}**：${f.value} ${f.unit||''}（${date(f.at)}）。${f.meaning||''}`).join('\n')
 const sources=(event.brief.sources||[]).map(s=>`- ${s.title} · ${s.date||'时段未记录'}：${s.summary||''}`).join('\n')
 const timeline=[...event.decisions.filter(d=>Date.parse(d.at)<=Date.parse(at)).map(d=>({at:d.at,text:`${({investigate:'派发排查',repair:'派发维修',maintenance:'安排维保',recheck:'派发复查',observe:'进入效果观察',shore:'同步岸基',close:'确认闭环',false:'确认误报',wait:'等待执行条件',resume:'恢复原任务',terminate:'终止未执行部分'})[d.action]||d.action} · ${d.owner}：${d.reason}`})),...tasks.map(t=>({at:t.submittedAt,text:`${t.owner}提交${taskTitle(t)}报告。`}))]
 if(!timeline.some(t=>t.at===at&&/确认闭环|确认误报/.test(t.text)))timeline.push({at,text:`${captain}${action==='false'?'确认误报':'确认闭环'}：${reason}`})
 timeline.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
 const remaining=tasks.flatMap(t=>(t.records||[]).filter(r=>/未完成|无法确认|受限/.test(r.result)).map(r=>taskTitle(t)+'：'+r.label+'（'+r.result+'）'))
 const analysisMarkdown=`### 剩余限制\n\n${remaining.length?remaining.map(r=>'- '+r).join('\n'):'未登记未执行项目。'}${!work.length?'\n\n本事件未实施维修或维保。':''}${!rechecks.length?'\n\n未提交独立复查报告。':''}`

 const markdown=`# ${event.title} · 闭环报告

## 一、事件基础信息

- 事件编号：${event.number}
- 事件类型：${event.type}${event.parentEventId?'\n- 关联原事件：'+event.parentEventId+'；来源作业与报告沿用原事件记录。':''}
- 设备：${event.device}
- 发现时间：${event.brief.discovery?.at||'未记录'}
- 来源：${event.brief.discovery?.label||'未记录'}
- 确认人：${captain}
- 闭环时间：${date(at)}
- 处置方式：${action==='false'?'确认误报':'关闭闭环'}
- 闭环依据：${event.linkedClosure?'关联效果观察 '+event.linkedClosure.eventNumber+' 已闭环，沿关联链路同步归档。':'轮机长确认本事件闭环。'}
- 执行人员：${[...new Set(tasks.map(t=>t.owner))].join('、')||'未派发现场任务'}

## 二、原始异常与触发依据

${event.brief.discovery?.text||event.brief.conclusion}

${facts}

原始资料：

${sources||'未关联来源索引。'}

## 三、排查过程与原因判断

${investigations.map(t=>taskSection(event,t)).join('\n\n')||'无现场排查报告。'}

## 四、维修措施、备件与作业记录

${work.map(t=>taskSection(event,t)).join('\n\n')||'无维修或维保作业报告。'}
${event.maintenance?'\n维保计划：'+event.maintenance.number+'；计划窗口：'+(event.maintenance.window?.label||event.maintenance.window)+'；负责人：'+event.maintenance.owner+'。正式工单：'+(event.maintenance.plan?.workOrder?.number||'未关联')+'；正式工单完工状态独立管理。\n':''}
## 五、${tasks.some(isVerificationObservation)?'持续观察':'维修后的效果观察'}与复查反馈

${tasks.filter(t=>t.kind!=='investigation'||isVerificationObservation(t)).map(t=>observationSection(t,at)).join('\n\n')||'未发生持续观察。'}

${rechecks.map(t=>taskSection(event,t)).join('\n\n')||'未提交独立复查报告。'}

## 六、闭环决定与后续安排

${reason}

${event.linkedClosure?event.tasks.filter(t=>t.status==='terminated').map(t=>`- ${taskTitle(t)}：随关联链路闭环终止，原填写记录保留；未执行内容不记为已完成。`).join('\n'):''}

${analysisMarkdown}

## 七、处置时间线

${timeline.map(t=>`- ${date(t.at)} · ${t.text}`).join('\n')}

## 八、过程报告与附件索引

完整逐项记录、历轮分析及补充版本保存在以下过程报告中：

${reports.map(r=>`- ${r.title} · ${date(r.at)} · 编号 ${r.number||r.id}${r.updatedAt?' · 最后补充 '+date(r.updatedAt):''}`).join('\n')||'无已提交的过程报告。'}

${tasks.flatMap(t=>(t.attachments||[]).map(a=>`- ${taskTitle(t)}：${a.name}`)).join('\n')||'未关联现场附件。'}
`
 return {markdown,analysisMarkdown,presentationVersion:closurePresentationVersion}
}
