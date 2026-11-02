export const latestShoreReport=event=>event?.reports?.at(-1)||null
export function shoreReportSnapshot(event,form){
 const report=latestShoreReport(event)
 if(!report)throw Error('报告生成后才可同步岸基。')
 if(form.shoreReportId!==report.id||form.shoreBaseMarkdown!==report.markdown)throw Error('最近报告已更新，请重新打开同步窗口核对。')
 if(!form.shoreMarkdown?.trim())throw Error('同步报告内容不能为空。')
 return {...JSON.parse(JSON.stringify(report)),markdown:form.shoreMarkdown.trim(),originalMarkdown:report.markdown,edited:form.shoreMarkdown.trim()!==report.markdown.trim()}
}
