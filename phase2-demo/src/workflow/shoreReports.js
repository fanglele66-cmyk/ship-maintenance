import {observationChain} from './observationEvents.js'
import {composeShoreNarrative} from './shoreReportNarrative.js'
const copy=value=>JSON.parse(JSON.stringify(value))
export const latestShoreReport=event=>event?.reports?.at(-1)||null

// Only persisted event facts and formal submissions enter an outbound snapshot.
// Draft text, private conversations and previous shore packets never enter it.
export function shoreReportBasis(event,state={events:{[event.id]:event}},fields={}){
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
  tasks:(e.tasks||[]).map(t=>({id:t.id,title:t.title||'第'+(t.round||1)+'轮'+({investigation:'排查',repair:'维修',maintenance:'维保'}[t.kind]||'执行')+'任务',kind:t.kind,purpose:t.purpose,round:t.round,owner:t.owner,assignedBy:t.assignedBy,assignedAt:t.assignedAt,deadline:t.deadline,status:t.status,scope:t.scope,submittedAt:t.submittedAt,
   ...(t.submittedAt?{records:copy(t.records||[]),summary:t.summary,summarySource:t.summarySource}:{} )}))}))
 return {events,includedReports,markdown:composeShoreNarrative({events,includedReports,fields,eventId:event.id,title:event.title})}
}

export function shoreReportEntries(state){
 if(state.role!=='captain')return []
 return Object.values(state.events).flatMap(event=>(event.shore||[]).map(record=>({...shoreReportPresentation(record),id:record.id,kind:'上报岸基报告',eventId:event.id,eventNumber:event.number,at:record.at,owner:record.owner||'轮机长',status:'已上报岸基',title:record.syncedReport?.title||event.title+' · 上报岸基报告'}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)))
}

// Upgrade only the presentation of older frozen packets, never read current event facts.
export function shoreReportPresentation(record){
 const report=record.syncedReport||{}
 if(report.presentationVersion===3||report.edited||!report.events?.length)return report
 return {...report,markdown:composeShoreNarrative({...report,at:record.at})}
}

// Editing starts from a frozen report so later AI updates cannot replace the
// text being reviewed. Revising a sent report creates another outbound version.
export function createShoreReportDraft(event,state,sourceId=''){
 if(sourceId){
  const source=event.shore.find(record=>record.id===sourceId)
  if(!source)throw Error('未找到要修改的上报报告。')
  return {...copy(shoreReportPresentation(source)),eventId:event.id,sourceShoreId:source.id}
 }
 return shoreReportSnapshot(event,{shoreIncludeHistory:true,shoreSituation:{}},state)
}

export function shoreReportSnapshot(event,form,state,at){
 if(form.shoreDraftReport){
  const draft=form.shoreDraftReport,markdown=String(form.shoreMarkdown??'').trim()
  if(draft.eventId!==event.id)throw Error('报告不属于当前事件，请重新打开上报窗口。')
  if(!markdown)throw Error('上报报告内容不能为空。')
  if(draft.sourceShoreId&&!event.shore.some(r=>r.id===draft.sourceShoreId))throw Error('原上报版本不存在，请重新打开上报窗口。')
  return {...copy(draft),id:'shore-report-'+crypto.randomUUID(),markdown,originalMarkdown:draft.markdown,edited:markdown!==draft.markdown.trim(),presentationVersion:3,summary:markdown.replace(/^#+.*$/gm,'').trim().replace(/\s+/g,' ').slice(0,180)}
 }
 if(form.shoreIncludeHistory){
  const value=copy(form.shoreSituation||{}),basis=shoreReportBasis(event,state,value)
  return {id:'shore-report-'+crypto.randomUUID(),kind:'上报岸基报告',title:event.title+' · 上报岸基报告',eventId:event.id,eventNumber:event.number,summary:`覆盖 ${basis.events.length} 个关联事件、${basis.includedReports.length} 份正式报告。${value.situation||''}`,fields:value,...basis,presentationVersion:3,markdown:composeShoreNarrative({...basis,fields:value,eventId:event.id,title:event.title,at})}
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
