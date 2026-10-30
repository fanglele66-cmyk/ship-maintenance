import {isVerificationReview} from './observationContext.js'
export const isAbnormalResult=record=>/发现异常|读数不一致|偏离仍存在/.test(record.result||'')
export const hasAbnormalFindings=task=>(task?.records||[]).some(isAbnormalResult)
// Only an explicit conclusion about the trend can negate it; "原因未明" cannot.
export function trackingNotSupported(event,task){
 if(!event.tracking||task?.kind!=='investigation')return false
 const text=[task.summary,...(task.records||[]).flatMap(r=>[r.result,r.note])].filter(Boolean).join('；')
 return /(?:不认为|不支持|未支持|未发现|不存在|并非)[^。；！？\n]{0,20}(?:基线下移|基线抬升|相对下移|相对抬升)(?:成立)?(?:[。；，、\s]|$)/.test(text)||/(?:基线下移|基线抬升|相对下移|相对抬升)(?:判断|趋势)?(?:不成立|未获支持)/.test(text)
}
// Confirmation of a trend is distinct from a located component defect.
export function confirmedTracking(event,task){
 const rows=task?.records||[]
 const conclusion=[task?.summary,...rows.map(r=>r.note)].filter(Boolean).join('；')
 const uncertain=/(?:尚未确认|尚不能确认|无法确认)[^。；！？\n]{0,15}(?:基线下移|基线抬升|相对下移|相对抬升)(?:成立)?(?:[。；，、\s]|$)|(?:基线下移|基线抬升|相对下移|相对抬升)(?:是否成立)?(?:仍待核实|尚待确认|未得到证实)/.test(conclusion)
 return Boolean(event.tracking&&!trackingNotSupported(event,task)&&!uncertain&&task?.kind==='investigation'&&task.purpose!=='recheck'&&rows.length&&!rows.some(r=>/无法确认|受限|读数不一致|发现异常/.test(r.result))&&(
  rows.some(r=>/^现场[与和]系统一致$/.test(r.result))&&rows.some(r=>r.result==='信息已记录'||/偏离仍存在/.test(r.result))
  ||rows.some(r=>/偏离仍存在/.test(r.result))))
}
export function lifecycleDecisionOptions(event){
 const shore={value:'shore',label:'同步岸基'}
 if(event.phase==='closed')return [shore]
 if(event.phase==='reminder')return [{value:'investigate',label:'派发排查'},{value:'false',label:'确认误报'},shore]
 const task=event.tasks.find(t=>t.id===event.currentTask)
 if(['assigned','reporting','report-error'].includes(task?.status))return [shore]
 if(event.phase==='review')return [{value:'close',label:'闭环'},{value:'recheck',label:'派发复查'},...(isVerificationReview(event)?[{value:'repair',label:'派发维修'}]:[]),...(!event.phases?.at(-1)?.observationWaiting?[{value:'observe',label:'继续观察'}]:[]),shore]
 if(event.phase==='decision')return [...(confirmedTracking(event,task)?[{value:'maintenance',label:'提前维保'}]:hasAbnormalFindings(task)?[{value:'repair',label:'派发维修'}]:[{value:'investigate',label:'继续排查'}]),...(task?.status==='submitted'?[{value:'observe',label:'继续观察'},{value:'close',label:'闭环'}]:[]),shore]
 return [shore]
}
export const dispatchAction=event=>{
 const actions=lifecycleDecisionOptions(event).filter(o=>['investigate','repair','maintenance','recheck'].includes(o.value))
 return actions.find(o=>o.value===event.decisionDraft?.action)?.value||actions[0]?.value
}
// Initial advice is discoverable before a choice. Follow-up advice only belongs
// to an explicitly selected dispatch decision, never an automatically chosen branch.
export function suggestionAction(event){
 if(event.phase==='reminder')return !event.decisionDraft?.action||event.decisionDraft.action==='investigate'?'investigate':null
 const selected=event.decisionDraft?.action
 return ['investigate','repair','maintenance','recheck'].includes(selected)&&lifecycleDecisionOptions(event).some(o=>o.value===selected)?selected:null
}
export const taskName=task=>task?.purpose==='recheck'?'复查':task?.kind==='investigation'?'排查':task?.kind==='maintenance'?'维保':'维修'
