// Execution completeness is independent of whether a root cause is known.
function blocked(text,kind){
 // An investigation does not include unassigned repair work. Saying it has not
 // been repaired is not an incomplete investigation or a condition to resume it.
 const source=kind==='investigation'?String(text||'').replace(/(?:尚未|暂未|未)(?:实施|进行|执行)(?:维修|维保|换件)/g,''):text||''
 return /(?:不具备|不满足)[^。；\n]{0,16}(?:条件|窗口)|条件(?:尚未|仍未|未)具备|无法实施|暂未实施|尚未实施|暂未执行|尚未执行|条件受限|条件不足|缺少备件|备件未到|等待备件|待备件|等待停机|因[^。；\n]{0,20}(?:未能|未执行)/.test(source)
}
export function taskExecution(task){
 const records=task?.records||[],outstanding=[]
 records.forEach((record,index)=>{
  if(record.result!=='不适用'&&(/未完成|无法确认|受限/.test(record.result||'')||blocked(record.note,task.kind)||record.subrecords?.some(r=>/未完成|受限/.test(r.result))))outstanding.push({index,label:record.label,result:record.result,reason:record.note||'尚未提供未执行原因或恢复条件，请核实。',step:task.steps?.[index]})
 })
 const summaryBlocked=blocked(task?.summary,task?.kind)
 return {completed:records.filter((r,i)=>r.result&&r.result!=='不适用'&&!outstanding.some(o=>o.index===i)),notApplicable:records.filter(r=>r.result==='不适用'),outstanding,summaryBlocked,incomplete:outstanding.length>0||summaryBlocked}
}
export function executionFacts(task){
 const result=taskExecution(task)
 const list=task.records.map(r=>`- ${r.label}：${r.result||'未记录'}${r.note?'；'+r.note:'；未提供详细过程记录。'}`).join('\n')
 const remaining=result.outstanding.map(r=>`- ${r.label}：${r.result}；${r.reason}`).join('\n')
 return `## 现场事实（执行人原始记录）\n\n${list}\n\n### 执行人汇总\n\n${task.summary}${result.notApplicable.length?'\n\n### 本轮无需执行项目\n\n'+result.notApplicable.map(r=>'- '+r.label+'：不适用，本项无需执行。'+(r.note||'')).join('\n'):''}\n\n## 未执行与待核实事项\n\n${remaining||'逐项结果未登记需补做的未执行项目；不适用项无需执行，原因是否明确以本轮证据为准。'}${result.summaryBlocked?'\n\n汇总中记录实施条件受限：'+task.summary+'\n请核对具体受阻项目与恢复条件，不据此认定任务全部完成。':''}`
}
export function carryForwardSteps(event){
 const previous=event.tasks.findLast(t=>['repair','maintenance'].includes(t.kind))
 if(!previous||previous.status!=='submitted')return []
 const result=taskExecution(previous)
 const steps=result.outstanding.map(r=>({...JSON.parse(JSON.stringify(r.step||{label:r.label,guide:r.reason,checks:[r.reason]})),carryFromTaskId:previous.id,guide:`上轮${r.result}：${r.reason} 核对实施条件及批准范围后继续本项。`,recordHint:'说明条件是否具备、实际完成内容及仍未执行的原因。',options:['已完成','未完成','不适用']}))
 if(result.summaryBlocked&&!steps.length)steps.push({label:'核对上轮受阻项目并完成剩余作业',guide:previous.summary,checks:['核对上轮汇总中受阻的具体项目、备件和停机条件；未具备条件不得实施。','在批准范围内补做未执行项目，保留已完成项记录。'],recordHint:'逐项记录补做结果和仍受限的原因。',options:['已完成','未完成','不适用'],carryFromTaskId:previous.id})
 return steps
}
