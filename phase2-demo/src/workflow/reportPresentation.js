// Format submitted content without rewriting its original evidence or revisions.
export function reportMarkdown(report){
 let text=report.markdown||''
 text=text.replace(/^(#{1,6} [^\n]*)（不作为现场事实）$/gm,'$1')
  .replace(/^(#{1,6} )(?:AI后续建议|建议处置|后续建议)$/gm,'$1AI建议')
  .replace(/^(#{1,6} )(?:尚不能确认与未执行事项|尚不能确认与未执行项目|待核实事项)$/gm,'$1未执行与待核实事项')
  .replace(/^(#{1,6} )(?:AI分析[（(]原因与措施判断[）)]|原因解释与措施判断)$/gm,'$1原因与措施判断')
 text=text.replace(/^### (?:现场记录摘要|证据与范围核对)\s*\n[\s\S]*?(?=^#{1,3} |$(?![\s\S]))/gm,'')
 // Only format AI analysis, leaving original execution records untouched.
 text=text.replace(/(^### (?:原因与措施判断|未执行与待核实事项|AI建议)[ \t]*\n)([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/gm,(_,heading,body)=>heading+'\n'+operationalText(body.trim())+'\n\n')
 if(report.number&&!text.includes('- 报告编号：'))text=text.replace(/^(# [^\n]+\n)/,`$1\n- 报告编号：${report.number}\n`)
 return text
}
import {operationalText} from './operationalText.js'
