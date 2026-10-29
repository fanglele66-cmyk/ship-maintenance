import {makeReport,people} from './eventLifecycle.js'
const fields=['evidence','interpretation','unverified','next']
const copy=value=>JSON.parse(JSON.stringify(value))
const prose=value=>String(value).replace(/^#{1,6}\s*/gm,'').trim()
export function supplementaryReports(event,role){
 if(role!=='engineer'||event.phase==='closed')return []
 return event.reports.filter(r=>r.owner===people.engineer&&['排查报告','维修报告','维保作业报告'].includes(r.kind)&&event.tasks.some(t=>t.id===r.taskId&&t.status==='submitted'))
}
export function revisionAnalysis(patch){
 const labels=['证据与范围核对','原因解释与措施判断','待核实事项','建议处置']
 return fields.map((key,i)=>`### ${labels[i]}\n\n${prose(patch.analysis[key])}`).join('\n\n')
}
export function applyReportSupplement(state,eventId,proposal){
 const event=state.events[eventId],report=event&&supplementaryReports(event,state.role).find(r=>r.id===proposal.reportId)
 if(!report)throw Error('当前身份不能补充这份报告，或事件已经闭环。')
 if(proposal.applied)throw Error('该补充已经写入报告。')
 if(report.markdown!==proposal.baseMarkdown)throw Error('报告已有更新，请重新生成修订稿，避免覆盖他人补充。')
 const patch=proposal.patch
 if(typeof patch?.summary!=='string'||!patch.summary.trim()||fields.some(k=>typeof patch.analysis?.[k]!=='string'||!patch.analysis[k].trim()))throw Error('修订内容不完整，原报告未修改。')
 const task=event.tasks.find(t=>t.id===report.taskId),at=new Date().toISOString(),before=copy({summary:report.summary,analysis:report.analysis,analysisMarkdown:report.analysisMarkdown,markdown:report.markdown,updatedAt:report.updatedAt||null})
 const revision={id:proposal.id,at,actor:people.engineer,text:proposal.text,model:proposal.model,sources:proposal.sources||[],before}
 const revisions=[...(report.revisions||[]),revision]
 const updated=makeReport(event,{...task,summary:prose(patch.summary)},report.id)
 const analysisMarkdown=revisionAnalysis(patch)
 updated.markdown=updated.markdown.replace(updated.analysisMarkdown,analysisMarkdown)+'\n\n## 提交后补充记录\n\n'+revisions.map((r,i)=>`### 第 ${i+1} 次补充 · ${r.actor}\n\n${r.at}\n\n${prose(r.text)}\n\n${r.sources.length?'参考资料：'+r.sources.map(s=>'['+s.id+'] '+s.title+'（'+s.file+' L'+s.startLine+'—'+s.endLine+'）').join('；'):'未关联知识库资料。'}`).join('\n\n')
 Object.assign(report,updated,{analysisMarkdown,analysis:prose(patch.summary),revisions,updatedAt:at,original:report.original||before})
 proposal.applied=true
 event.unread.captain=true
 event.conversations.captain.push({id:'supplement-'+proposal.id,kind:'receipt',title:'报告补充已提交',text:`${people.engineer}补充了《${report.title}》，请复核更新后的结论与依据。`,reportId:report.id,at})
 ;(state.notices||=[]).push({id:'notice-'+proposal.id,eventId,recipient:'captain',title:'报告已补充',text:report.title,at,read:false})
 return report
}
