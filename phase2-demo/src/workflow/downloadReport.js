import {reportMarkdown} from './reportPresentation.js'

// Shared by standalone reports and the task's single action row.
export function downloadReportMarkdown(report){
 if(!report)return
 const url=URL.createObjectURL(new Blob([reportMarkdown(report)],{type:'text/markdown;charset=utf-8'}))
 const anchor=document.createElement('a')
 anchor.href=url
 anchor.download=(report.number||report.title||'任务报告').replace(/[\\/:*?"<>|]/g,'-')+'.md'
 anchor.click()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
