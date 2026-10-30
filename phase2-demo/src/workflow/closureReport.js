import {taskName} from './lifecycleDecisions.js'

export const closurePresentationVersion=4
const noValue=value=>value===undefined||value===null||value===''?'未记录':String(value)
const date=value=>!value?'未记录':!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)||Number.isNaN(Date.parse(value))?String(value):new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,19)
const taskTitle=task=>`第${task.round}轮${taskName(task)}`
const rows=records=>(records||[]).map((r,i)=>`**${i+1}. ${r.label}**\n\n- 实际结果：${noValue(r.result)}\n- 现场记录：${r.note||'未填写具体过程或读数。'}`).join('\n\n')

function taskSection(event,task){
 const report=event.reports.findLast(r=>r.taskId===task.id)
 const revisions=(report?.revisions||[]).map((r,i)=>`- 第${i+1}次补充（${date(r.at)}）：${r.text}`).join('\n')
 const earlier=[...(task.procedureHistory||[]),...(task.feedbackHistory||[])].map(h=>`#### 步骤调整前已填写记录\n\n${rows(h.draft.records.filter(r=>r.result||r.note))||'无已填写记录。'}`).join('\n\n')
 return `### ${taskTitle(task)}\n\n- 负责人：${task.owner}\n- 派发时间：${date(task.assignedAt)}\n- 要求完成：${date(task.deadline)}\n- 提交时间：${date(task.submittedAt)}\n- 批准范围：${task.scope}\n\n#### 实际${task.kind==='investigation'?'核查':'作业'}过程\n\n${rows(task.records)||'未提交逐项现场记录。'}\n\n${earlier?earlier+'\n\n':''}#### ${task.kind==='investigation'?'原因判断与未确认项':'实际措施、用料与剩余事项'}\n\n${report?.summary||task.summary||'未提交结论。'}${report?.analysisMarkdown?'\n\n#### 报告中的分析与证据边界\n\n'+report.analysisMarkdown:''}${revisions?'\n\n#### 执行人补充记录\n\n'+revisions:''}\n\n附件：${task.attachments?.map(a=>a.name).join('、')||'未关联附件。'}`
}

function observationSection(task,closedAt){
 const observation=task.observation
 if(!observation)return `### ${taskTitle(task)}后的观察\n\n未保存自动观察数据；效果以现场已提交的复测和复查记录为依据。`
 const windows=[...(observation.records||[]),...(observation.pending?[observation.pending]:[])].filter(w=>Date.parse(w.windowEnd)<=Date.parse(closedAt))
 const content=windows.map(w=>{
  const channels=(w.channels||[]).map(c=>`- ${c.name}：有效采样 ${c.sampleCount||0} 条；范围 ${noValue(c.min)}—${noValue(c.max)} ${c.unit||''}；均值 ${typeof c.mean==='number'?c.mean.toFixed(2):'未记录'} ${c.unit||''}；末值 ${noValue(c.value)} ${c.unit||''}；${c.covered?'采样间隔满足配置要求':'存在缺测或采样间隔不足'}。`).join('\n')
  return `#### ${date(w.windowStart)} — ${date(w.windowEnd)}\n\n${w.complete?'已结束的观察窗口':'闭环前保存的部分观察窗口'}；共 ${w.sampleCount||0} 条有效采样。\n\n${channels||'未记录有效通道读数。'}`
 }).join('\n\n')
 return `### ${taskTitle(task)}后的观察\n\n- 开始：${date(task.submittedAt)}\n- 截止：${date(task.observationEndedAt||closedAt)}\n\n${content||'截至闭环时尚无已保存的有效观察窗口。'}\n\n采样变化用于与现场复测交叉核对；是否工况可比、原报警是否再现，以本次作业、复查及轮机长确认记录为准。未记录的验证项目保留为未确认。`
}

export function closureContent(event,action,reason,at,captain){
 const tasks=event.tasks.filter(t=>t.status==='submitted'&&Date.parse(t.submittedAt)<=Date.parse(at))
 const investigations=tasks.filter(t=>t.kind==='investigation'&&t.purpose!=='recheck'),work=tasks.filter(t=>t.kind!=='investigation'),rechecks=tasks.filter(t=>t.purpose==='recheck')
 const reports=event.reports.filter(r=>r.kind!=='闭环报告'&&Date.parse(r.at)<=Date.parse(at))
 const facts=(event.brief.facts||[]).map(f=>`- **${f.label}**：${f.value} ${f.unit||''}（${date(f.at)}）。${f.meaning||''}`).join('\n')
 const sources=(event.brief.sources||[]).map(s=>`- ${s.title} · ${s.date||'时段未记录'}：${s.summary||''}`).join('\n')
 const timeline=[...event.decisions.filter(d=>Date.parse(d.at)<=Date.parse(at)).map(d=>({at:d.at,text:`${({investigate:'派发排查',repair:'派发维修',maintenance:'安排维保',recheck:'派发复查',observe:'进入效果观察',shore:'同步岸基',close:'确认闭环',false:'确认误报'})[d.action]||d.action} · ${d.owner}：${d.reason}`})),...tasks.map(t=>({at:t.submittedAt,text:`${t.owner}提交${taskTitle(t)}报告。`}))]
 if(!timeline.some(t=>t.at===at&&/确认闭环|确认误报/.test(t.text)))timeline.push({at,text:`${captain}${action==='false'?'确认误报':'确认闭环'}：${reason}`})
 timeline.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
 const analysisMarkdown=`### 原因、措施与效果的对应关系\n\n${investigations.length?'原因判断以各轮排查报告及执行人补充为据，逐项核查结果与未确认项见下文。':'未提交现场排查报告，原因核实以轮机长说明为限。'}${work.length?'实际维修仅采用已提交作业记录，计划中的步骤不视为已完成。':'未提交维修或维保作业报告，不记为已维修。'}\n\n${rechecks.length?'复查结果、未完成项和观察数据一并保留。':'尚无独立复查报告，效果证据范围以实际保存的复测与观察为限。'}`
 const markdown=`# ${event.title} · 闭环报告

## 一、事件基础信息

- 事件编号：${event.number}
- 事件类型：${event.type}
- 设备：${event.device}
- 发现时间：${event.brief.discovery?.at||'未记录'}
- 来源：${event.brief.discovery?.label||'未记录'}
- 确认人：${captain}
- 闭环时间：${date(at)}
- 处置方式：${action==='false'?'确认误报':'关闭闭环'}
- 执行人员：${[...new Set(tasks.map(t=>t.owner))].join('、')||'未派发现场任务'}

## 二、原始异常与触发依据

${event.brief.discovery?.text||event.brief.conclusion}

${facts}

原始资料：

${sources||'未关联来源索引。'}

## 三、排查过程与原因判断

${investigations.map(t=>taskSection(event,t)).join('\n\n')||'本事件未提交现场排查报告；不补写检查过程或部件故障原因。'}

## 四、维修措施、备件与作业记录

${work.map(t=>taskSection(event,t)).join('\n\n')||'本事件未提交维修或维保作业报告。'}
${event.maintenance?'\n维保计划：'+event.maintenance.number+'；计划窗口：'+event.maintenance.window+'；负责人：'+event.maintenance.owner+'。\n':''}
## 五、维修后的效果观察与复查反馈

${work.map(t=>observationSection(t,at)).join('\n\n')||'未发生维修后观察。'}

${rechecks.map(t=>taskSection(event,t)).join('\n\n')||'未提交独立复查报告。'}

## 六、闭环决定与后续安排

${reason}

${analysisMarkdown}

## 七、完整处置时间线

${timeline.map(t=>`- ${date(t.at)} · ${t.text}`).join('\n')}

## 八、过程报告与附件索引

${reports.map(r=>`- ${r.title} · ${date(r.at)}${r.updatedAt?' · 最后补充 '+date(r.updatedAt):''}`).join('\n')||'无已提交的过程报告。'}

${tasks.flatMap(t=>(t.attachments||[]).map(a=>`- ${taskTitle(t)}：${a.name}`)).join('\n')||'未关联现场附件。'}
`
 return {markdown,analysisMarkdown,presentationVersion:closurePresentationVersion}
}
