export const latestShoreReport=event=>event?.reports?.at(-1)||null
export function shoreReportSnapshot(event,form){
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
