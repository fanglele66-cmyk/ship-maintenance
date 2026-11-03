import {observationChain} from './observationEvents.js'
const copy=value=>JSON.parse(JSON.stringify(value))
const text=value=>value??'未记录'
const time=value=>{if(!value)return '未记录';if(!String(value).includes('T'))return value;const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16):value}
export const latestShoreReport=event=>event?.reports?.at(-1)||null

// Only persisted event facts and formal submissions enter an outbound snapshot.
// Draft text, private conversations and previous shore packets never enter it.
export function shoreReportBasis(event,state={events:{[event.id]:event}}){
 const chain=observationChain(state,event.id).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)))
 const reports=chain.flatMap(e=>(e.reports||[]).filter(r=>!r.linkedSource).map(r=>{
  const task=e.tasks?.find(t=>t.reportGeneration?.factReportId===r.id)
  const analysisState=task?.status==='report-error'?'AI 分析生成失败，现场报告已提交，可在原报告重试':task?.status==='reporting'?'AI 分析生成中，现场报告已提交':r.generatedBy?'AI 分析已生成':''
  return {...copy(r),eventId:e.id,eventNumber:e.number,analysisState}
 }))
 const seen=new Set(),includedReports=reports.filter(r=>!seen.has(r.id)&&seen.add(r.id)).sort((a,b)=>String(a.at).localeCompare(String(b.at)))
 const events=chain.map(e=>({id:e.id,number:e.number,title:e.title,type:e.type,device:e.device,createdAt:e.createdAt,status:e.status,phase:e.phase,brief:copy(e.brief||{}),
  phases:(e.phases||[]).map(p=>({id:p.id,label:p.label,at:p.at,observationDueAt:p.observationDueAt,observationCompletedAt:p.observationCompletedAt})),
  decisions:(e.decisions||[]).filter(d=>d.action!=='shore').map(d=>({id:d.id,action:d.action,owner:d.owner,at:d.at,reason:d.reason})),
  tasks:(e.tasks||[]).map(t=>({id:t.id,title:t.title||'第'+(t.round||1)+'轮'+({investigation:'排查',repair:'维修',maintenance:'维保'}[t.kind]||'执行')+'任务',kind:t.kind,owner:t.owner,assignedBy:t.assignedBy,assignedAt:t.assignedAt,deadline:t.deadline,status:t.status,scope:t.scope,submittedAt:t.submittedAt,
   ...(t.submittedAt?{records:copy(t.records||[]),summary:t.summary}:{} )}))}))
 const sections=events.map(e=>`## ${e.number} · ${e.title}\n\n- 事件类型：${e.type}\n- 设备：${e.device}\n- 发现时间：${time(e.createdAt)}\n- 当前状态：${e.status}\n- 初始来源：${text(e.brief.discovery?.label)}\n\n### 初始信息\n\n${text(e.brief.conclusion)}\n\n${(e.brief.facts||[]).map(f=>'- '+text(f.label)+'：'+text(f.value)+(f.unit?' '+f.unit:'')).join('\n')}\n\n### 阶段记录\n\n${e.phases.map(p=>`- ${time(p.at)} · ${p.label}${p.observationDueAt?'；计划汇报 '+time(p.observationDueAt):''}${p.observationCompletedAt?'；观察回交 '+time(p.observationCompletedAt):''}`).join('\n')||'尚无阶段记录。'}\n\n### 处置决定\n\n${e.decisions.map(d=>`- ${time(d.at)} · ${text(d.owner)}：${text(d.reason)}`).join('\n')||'人员安排见下方派发记录；尚无额外处置决定。'}\n\n### 派发与正式回传\n\n${e.tasks.map(t=>`#### ${text(t.title)}\n\n执行人：${text(t.owner)}；派发：${time(t.assignedAt)}；要求完成：${time(t.deadline)}\n\n安排范围：${text(t.scope)}\n\n${t.submittedAt?'正式提交：'+time(t.submittedAt)+'\n\n'+(t.records||[]).map(r=>'- '+r.label+'：'+text(r.result)+(r.note?'；'+r.note:'')).join('\n')+'\n\n'+text(t.summary):'尚未正式提交反馈。'}`).join('\n\n')||'尚无人员任务。'}`)
 const index=includedReports.map((r,i)=>`${i+1}. ${r.title} · ${time(r.at)} · ${r.eventNumber}`).join('\n')||'尚无正式报告，已包含初始信息及当前安排。'
 const bodies=includedReports.map((r,i)=>`## 附录 ${i+1} · ${r.title}\n\n报告编号：${r.id}\n\n${r.analysisState?r.analysisState+'\n\n':''}${r.markdown||r.summary||'报告暂无正文。'}`).join('\n\n---\n\n')
 return {events,includedReports,markdown:`# ${event.title} · 上报岸基报告\n\n本记录汇集关联事件开始至本次保存时的已有资料。当前仅本地保存，尚未发送岸基；进行中的事件不因此认定闭环。\n\n## 报告索引\n\n${index}\n\n${sections.join('\n\n---\n\n')}\n\n${bodies}`}
}

export function shoreReportEntries(state){
 if(state.role!=='captain')return []
 return Object.values(state.events).flatMap(event=>(event.shore||[]).map(record=>({...record.syncedReport,id:record.id,kind:'上报岸基报告',eventId:event.id,eventNumber:event.number,at:record.at,owner:record.owner||'轮机长',status:record.status||'本地保存，未发送',title:record.syncedReport?.title||event.title+' · 上报岸基报告'}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)))
}

export function shoreReportSnapshot(event,form,state){
 if(form.shoreIncludeHistory){
  const basis=shoreReportBasis(event,state),value=copy(form.shoreSituation||{})
  const fields=Object.entries({补充情况:value.situation,已采取安排补充:value.actions,尚未确认事项:value.uncertainty,需岸基知悉或支持事项:value.support}).filter(([,v])=>v?.trim())
  return {id:'shore-report-'+crypto.randomUUID(),kind:'上报岸基报告',title:event.title+' · 上报岸基报告',eventId:event.id,eventNumber:event.number,summary:`覆盖 ${basis.events.length} 个关联事件、${basis.includedReports.length} 份正式报告。${value.situation||''}`,fields:value,...basis,markdown:basis.markdown+(fields.length?'\n\n## 本次人工补充\n\n'+fields.map(([label,value])=>'### '+label+'\n\n'+value.trim()).join('\n\n'):'')}
 }
 if(form.shoreSituation){
  const value=form.shoreSituation
  if(!value.situation?.trim())throw Error('请填写当前情况。')
  return {id:'shore-summary-'+crypto.randomUUID(),kind:'岸端情况摘要',title:event.title+' · 岸端情况摘要',eventId:event.id,summary:value.situation,fields:JSON.parse(JSON.stringify(value)),markdown:'# '+event.title+' · 岸端情况摘要\n\n'+Object.entries({当前情况:value.situation,已采取安排:value.actions,尚未确认事项:value.uncertainty,需岸端知悉或支持事项:value.support||'未填写'}).map(([label,text])=>'## '+label+'\n\n'+text).join('\n\n')}
 }
 const report=latestShoreReport(event)
 if(!report)throw Error('报告生成后才可同步岸基。')
 if(form.shoreReportId!==report.id||form.shoreBaseMarkdown!==report.markdown)throw Error('最近报告已更新，请重新打开同步窗口核对。')
 if(!form.shoreMarkdown?.trim())throw Error('同步报告内容不能为空。')
 return {...JSON.parse(JSON.stringify(report)),markdown:form.shoreMarkdown.trim(),originalMarkdown:report.markdown,edited:form.shoreMarkdown.trim()!==report.markdown.trim()}
}
