import {taskExecution} from './taskExecution.js'
import {confirmedTracking,trackingNotSupported,isAbnormalResult} from './lifecycleDecisions.js'

const subjects={
 'real-alarm-0430':{name:'二缸喷射异常',check:'核对二缸喷射指令、流量活塞反馈与液压动作',retest:'二缸喷射反馈、接口密封及同工况排温'},
 'real-warning-0523':{name:'控制空气低压',check:'同步复核两个进口测点的现场表计、供气压力与用气操作',retest:'减压阀前后压力、进口压力及泄漏情况'},
 'real-tracking-exhaust-baseline':{name:'一缸相对排温抬升',check:'核对一缸排温探头、接线及校验记录',retest:'一缸独立测温与六缸同工况排温'},
 'real-health-c4-baseline':{name:'四缸相对排温下移',check:'补充四缸独立测温及5—6月运行调整记录',retest:'四缸独立测温与六缸同工况排温'}
}
export const eventSubject=event=>subjects[event.sourceEventId||event.id]||{name:event.title||'本轮异常',check:'补齐本轮尚缺的现场记录',retest:'原异常对应测点的同工况读数'}
export const shortSentence=value=>String(value||'').split(/[。！？\n]/).find(s=>s.trim())?.trim()||''
const names=rows=>rows.slice(0,2).map(r=>r.label).join('、')+(rows.length>2?`等${rows.length}项`:'')

// Rank the next action from this submission. Missing optional notes carry no penalty.
export function preferredTaskAction(event,task,execution=taskExecution(task)){
 if(!['submitted','reporting','report-error'].includes(task?.status))return null
 const rows=task.records||[]
 if(execution.incomplete||!execution.completed.length||rows.some(r=>!r.result))return null
 if(Array.isArray(task.steps)&&task.steps.length!==rows.length)return null
 if(task.kind==='repair'&&execution.completed.every(r=>r.result==='已完成'))return 'observe'
 if(task.kind==='investigation'&&rows.some(isAbnormalResult)&&!confirmedTracking(event,task)&&!trackingNotSupported(event,task))return 'repair'
 return null
}

// Text selection only. Available decisions and workflow transitions stay unchanged.
export function taskRecommendation(event,task){
 const subject=eventSubject(event),execution=taskExecution(task),rows=task?.records||[]
 if(!task&&event.manualReport)return {reason:event.title+'待核实',next:event.manualReport.analysis.recommendation}
 if(!task)return {reason:subject.name+'待核实',next:subject.check+'。'}
 if(execution.incomplete)return {reason:(names(execution.outstanding.slice(0,1))||subject.name+'作业')+'尚未完成',shortNext:execution.summaryBlocked?'先落实缺少的作业条件。':'先补做未完成项目并回交结果。',next:execution.summaryBlocked?'先落实记录中尚缺的作业条件，再完成剩余项目。':'先补做'+(names(execution.outstanding)||'本轮未完成项目')+'并回交结果。'}
 const preferred=preferredTaskAction(event,task,execution)
 if(preferred==='observe')return {reason:'本轮适用维修项均已完成',shortNext:'建议转入效果观察。',next:'建议轮机长转入效果观察，在可比工况下跟踪'+subject.retest+'，验证维修效果。'}
 if(task.kind==='repair'&&!execution.completed.length)return {reason:'本轮未记录实际完成的维修项',next:'请轮机长核对本轮适用范围和原异常的处置依据。'}
 if(task.kind!=='investigation')return {reason:subject.name+'处理记录已回交',shortNext:'核对复测结果并安排效果观察。',next:'核对'+subject.retest+'，安排效果观察。'}
 if(trackingNotSupported(event,task))return {reason:'本轮核实不支持'+subject.name,next:'审阅同工况比较与测温依据，确认原提醒的核实结论。'}
 if(confirmedTracking(event,task))return {reason:subject.name+'已核实',next:'选择对应测量链路维保计划，在靠港停机窗口执行校验与保养。'}
 const abnormal=rows.filter(isAbnormalResult)
 if(abnormal.length){
  const detail=abnormal.map(r=>r.note||'').join('；')
  const id=event.sourceEventId||event.id
  let scope=''
  if(id==='real-alarm-0430'&&/ICU|液压活塞/.test(detail)&&/卡滞|卡阻/.test(detail))scope='核定二缸ICU卡滞部位的处理范围并复测反馈。'
  if(id==='real-warning-0523'&&/减压阀|密封/.test(detail)&&/损坏|破损|泄漏|老化/.test(detail))scope='核定减压阀密封处理范围并复测阀前后压力。'
  const reason=subject.name+'排查记录异常'
  if(preferred==='repair')return {reason,shortNext:'建议派发维修。',next:'建议轮机长派发维修。'+(scope||'围绕“'+names(abnormal)+'”核定作业范围，并回交处理和复测结果。')}
  return {reason,next:scope||'先补齐异常部位与检查读数。'}
 }
 if(task.purpose==='recheck')return {reason:'本轮复查未登记原异常再现',next:'对照'+subject.retest+'，核实本轮验证结果。'}
 return {reason:subject.name+'原因仍待核实',next:subject.check+'，解释原变化。'}
}
