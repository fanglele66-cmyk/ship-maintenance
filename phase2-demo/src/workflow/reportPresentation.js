// Format submitted content without rewriting its original evidence or revisions.
export function reportMarkdown(report){
 let text=report.markdown||''
 text=text.replace(/（不作为现场事实）/g,'').replace(/AI后续建议/g,'AI建议')
 text=text.replace(/^### 现场记录摘要\s*\n[\s\S]*?(?=^#{1,3} |$(?![\s\S]))/gm,'')
 if(report.number&&!text.includes('- 报告编号：'))text=text.replace(/^(# [^\n]+\n)/,`$1\n- 报告编号：${report.number}\n`)
 return text
}
