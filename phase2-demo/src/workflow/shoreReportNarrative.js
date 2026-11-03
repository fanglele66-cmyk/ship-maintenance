// Compose one event account from immutable facts; source reports stay in the
// separate index instead of being pasted as repeated documents in the body.
const text=value=>String(value??'').trim()
const unique=values=>[...new Set(values.map(text).filter(Boolean))]
const sentence=value=>{const s=text(value).replace(/\n+/g,'；');return s?(s.match(/[。！？；]$/)?s:s+'。'):''}
const time=value=>!value?'未记录':String(value).includes('T')&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16):String(value)
const timestamp=value=>Date.parse(String(value||'').replace(' ','T')+(/(?:Z|[+-]\d\d:?\d\d)$/.test(value||'')?'':'+08:00'))||0
const cleanBody=markdown=>text(markdown).split('\n').filter(line=>line.trim()&&!/^\s*(?:#|---)/.test(line)).join('\n')
const kind=task=>task?.purpose==='recheck'?'复查':({investigation:'排查',repair:'维修',maintenance:'维保'}[task?.kind]||'现场工作')
function analysisOf(report){
 if(report?.analysis&&typeof report.analysis==='object')return report.analysis
 const sections=String(report?.analysisMarkdown||'').split(/(?:^|\n)### /).filter(Boolean).map(section=>{const [label,...lines]=section.split('\n');return {label,body:lines.filter(Boolean).join(' ')}})
 const find=pattern=>sections.filter(s=>pattern.test(s.label)).map(s=>s.body).join(' ')
 return {interpretation:find(/原因|解释|判断/),unverified:find(/待核实|未确认|不能确认|剩余/),next:find(/建议|后续/)}
}

export function composeShoreNarrative({events=[],includedReports=[],fields={},eventId,title,at}){
 const ordered=[...events].sort((a,b)=>timestamp(a.createdAt)-timestamp(b.createdAt)),root=ordered.find(e=>e.type!=='效果观察')||ordered[0]
 if(!root)return ''
 const reports=[...includedReports].sort((a,b)=>timestamp(a.at)-timestamp(b.at)),selected=ordered.find(e=>e.id===eventId)
 const current=selected?.phase==='transferred'?ordered.at(-1):selected||ordered.at(-1)
 const latest=reports.at(-1),tasks=ordered.flatMap(e=>e.tasks||[]),process=[]
 for(const task of tasks){
  process.push({at:task.assignedAt,body:`${time(task.assignedAt)}，安排${task.owner||'执行人员'}开展${kind(task)}${task.scope?'，范围为'+task.scope.replace(/[。；]$/,''):''}。`})
 }
 for(const report of reports){
  const task=report.submissionSnapshot||tasks.find(t=>t.id===report.taskId)
  if(task&&report.taskId){
   const records=task.records||[],facts=unique(records.map(r=>sentence(r.label+'：'+(r.result||'未记录')+(r.note?'；'+r.note:'')))).join('')
   const original=task.summary||report.summary,analysis=analysisOf(report)
   process.push({at:report.at,body:`${time(report.at)}，${report.owner||task.owner||'执行人员'}回交${kind(task)}结果${report.submissionNumber>1?'（恢复后第'+report.submissionNumber+'次提交）':''}。${facts}\n\n${original?'执行结论：'+sentence(original):''}${report.id!==latest?.id&&analysis?.interpretation?'\n\n当时分析认为：'+sentence(analysis.interpretation):''}${report.analysisState?'\n\n'+sentence(report.analysisState):''}`})
  }else if(report.kind==='观察报告'){
   const snapshot=report.observationSnapshot,obs=snapshot?.observation
   const windows=[...(obs?.records||[]),...(obs?.pending?[obs.pending]:[])]
   const data=unique(windows.map(w=>`${time(w.windowStart)}—${time(w.windowEnd)}，有效采样 ${w.sampleCount||0} 条，${w.covered?'覆盖达到要求':'覆盖不足'}${w.description||w.summary?'；'+(w.description||w.summary):''}`)).map(sentence).join('')
   process.push({at:report.at,body:`${time(report.at)}，系统完成本轮效果观察汇报。${sentence(report.summary||cleanBody(report.markdown))}${data?'\n\n'+data:''}${obs?.conditions?.reason?'\n\n可比工况：'+sentence(obs.conditions.reason):''}`})
  }else if(report.kind==='闭环报告'){
   process.push({at:report.at,body:`${time(report.at)}，${report.owner||'轮机长'}作出闭环决定。${sentence(report.summary||cleanBody(report.markdown))}`})
  }else{
   process.push({at:report.at,body:`${time(report.at)}，形成阶段记录。${sentence(report.summary||cleanBody(report.markdown))}`})
  }
 }
 for(const event of ordered){
  for(const decision of event.decisions||[]){
   if(['shore','investigate','repair','maintenance','recheck'].includes(decision.action)||(['close','false'].includes(decision.action)&&reports.some(r=>r.kind==='闭环报告'&&r.eventId===event.id)))continue
   if(decision.reason)process.push({at:decision.at,body:`${time(decision.at)}，${decision.owner||'轮机长'}安排：${sentence(decision.reason)}`})
  }
  // A confirmed observing period is meaningful even before a report is due.
  const phase=event.phases?.at(-1)
  if(event.type==='效果观察'&&phase?.observationDueAt&&!phase.observationCompletedAt)process.push({at:phase.at,body:`${time(phase.at)}起进入效果观察，计划于 ${time(phase.observationDueAt)} 汇报；当前观察仍在进行。`})
 }
 const currentAnalysis=analysisOf(latest),outstanding=[]
 if(currentAnalysis.unverified)outstanding.push(currentAnalysis.unverified)
 const latestByTask=new Map(reports.filter(r=>r.taskId).map(r=>[r.taskId,r]))
 for(const report of latestByTask.values())for(const record of report.submissionSnapshot?.records||[]){
  if(record.executionStatus==='未完成'||/未完成|无法确认|受限/.test(record.result||''))outstanding.push(`${record.label}：${record.result}${record.note?'；'+record.note:''}`)
 }
 if(latest?.kind==='观察报告'&&latest.observationSnapshot?.observation?.conditions?.reason)outstanding.push(latest.observationSnapshot.observation.conditions.reason)
 if(fields.uncertainty)outstanding.push(fields.uncertainty)
 const pendingTasks=tasks.filter(t=>['assigned','waiting'].includes(t.status))
 const next=unique([fields.support,...pendingTasks.map(t=>`${t.owner}继续${kind(t)}，要求 ${time(t.deadline)} 前完成${t.status==='waiting'?'；当前等待实施条件':''}`),currentAnalysis.next])
 if(fields.actions)process.push({at:at||ordered.at(-1)?.createdAt,body:'本次补充已采取安排：'+sentence(fields.actions)})
 const summary=unique([fields.situation,latest?.summary]).map(sentence).join('')
 const facts=unique((root.brief?.facts||[]).map(f=>`${f.label} ${f.value??'未记录'}${f.unit?' '+f.unit:''}`)).join('；')
 return `# ${(title||root.title).replace(/ · (?:上报岸基报告|效果观察)$/,'')} · 事件处置情况报告\n\n事件编号：${root.number}　设备：${root.device}${at?'　上报时间：'+time(at):''}\n\n## 当前情况\n\n截至本次上报，${current.title}处于“${current.status}”。${summary}\n\n## 事件发现\n\n${time(root.createdAt)}，${root.brief?.discovery?.label||'系统发现异常线索'}。${sentence(root.brief?.conclusion)}${facts?'\n\n发现时关键数据：'+sentence(facts):''}\n\n## 排查与处置经过\n\n${unique(process.sort((a,b)=>timestamp(a.at)-timestamp(b.at)).map(p=>p.body)).join('\n\n')||'尚未安排人员开展现场工作，当前依据初始信息等待轮机长决策。'}\n\n## 当前判断与待解决事项\n\n${unique([currentAnalysis.interpretation?'当前分析认为：'+currentAnalysis.interpretation:'',...outstanding]).map(sentence).join('\n\n')||'尚无进一步的正式核实结论，后续判断以现场回传及有效观测为依据。'}\n\n## 后续安排\n\n${next.map(sentence).join('\n\n')||(current.phase==='closed'?'本事件已由轮机长确认闭环，保留处置过程和证据，供岸基查阅。':'由轮机长结合当前资料确认后续安排，并向岸基同步进展。')}`
}
