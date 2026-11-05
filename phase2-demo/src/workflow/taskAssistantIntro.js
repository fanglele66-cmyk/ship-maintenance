const clean=(value,max=110)=>{
 const text=typeof value==='string'?value.replace(/\s+/g,' ').replace(/[。；;]+$/,'').trim():''
 return text.length>max?text.slice(0,max-1)+'…':text
}

// A short orientation from the dispatched task, never an inferred diagnosis.
export function taskAssistantIntro(event,task){
 if(!event||!task||!['investigation','repair','maintenance'].includes(task.kind))return []
 const title=clean(event.title,60)||'当前事件'
 const source=event.reports?.find(report=>report.id===task.sourceReportId)
 const plan=task.maintenance?.plan
 const kind=task.kind==='investigation'?(task.purpose==='recheck'?'复查':'排查'):task.kind==='maintenance'?'维保':'维修'
 let reason=`为核实“${title}”的现场表现与相关记录，安排了这项${kind}。`
 if(task.kind==='repair')reason=source?.title
  ?`这项维修承接《${clean(source.title,70)}》，处理范围以本轮已派发任务为准。`
  :`围绕“${title}”安排了这项维修，处理范围以本轮已派发任务为准。`
 if(task.kind==='maintenance')reason=plan?.title
  ?`结合“${title}”，按《${clean(plan.title,65)}》安排了本轮维保。`
  :`结合“${title}”安排了本轮维保，按本轮任务范围开展检查和保养。`
 const labels=[...new Set((task.steps||[]).flatMap(step=>step.substeps?.length?step.substeps:[step]).map(step=>clean(step.label,55)).filter(Boolean))]
 const substantive=labels.filter(label=>!/核对异常、批准|准备|隔离|标识连接|复装|恢复|汇总|整理作业记录|交接/.test(label))
 const focus=(substantive.length?substantive:labels).slice(0,2).join('、')||clean(task.scope)||'核对已派发步骤中的部位、记录与作业要求'
 const intro=[reason,`本轮重点是${focus}，具体范围和要求见任务步骤。`]
 const status={
  submitted:'本轮反馈已提交，可结合报告核对实际完成情况和仍待确认事项。',
  reporting:'现场反馈已回交，报告正在生成，当前可核对原始记录。',
  'report-error':'现场反馈已回交，报告分析尚未生成完成，可核对记录或重试。',
  waiting:'当前等待执行条件，未完成部分仍需按任务记录确认后再继续。',
  terminated:'本任务未执行部分已终止，可回看已提交记录与终止说明。',
 }[task.status]
 if(status)intro.push(status)
 return intro
}
