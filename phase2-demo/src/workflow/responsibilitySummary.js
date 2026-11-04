import {taskExecution} from './taskExecution.js'

const initial = {
 'real-alarm-0430':'二缸排温偏离并伴流量活塞报警；安排核查喷射控制、液压动作与燃油供给。',
 'real-warning-0523':'控制空气双通道压力下降；核对现场表计、供气压力与减压阀。',
 'real-tracking-exhaust-baseline':'一缸相对排温基线持续抬升；先核查测温链路，再对照燃烧与调整记录。',
 'real-health-c4-baseline':'四缸相对排温基线下移；补充独立测温与历史调整依据，确认后续安排。'
}
export function responsibilitySummary(event,state,task){
 if(state==='已闭环')return '本轮处置已确认闭环；保留报告与后续监测安排。'
 if(task?.waiting?.reviewRequested)return '执行条件发生变化；审阅反馈，确认恢复或接续安排。'
 if(task?.status==='waiting')return '本轮作业条件尚未具备；保留已完成记录，条件具备后确认恢复。'
 if(state==='观察中')return event.phase==='transferred'?'本轮已转入效果观察；按关联观察方案跟踪变化与复发。':'观察尚未到期；按确认方案采样，异常提前反馈、到期汇报。'
 if(['reporting','report-error'].includes(task?.status))return task.status==='report-error'?'现场记录已提交、报告生成失败；重试生成后交轮机长审阅。':'现场记录已提交；等待报告生成后审阅后续安排。'
 if(state==='待决策'){
  if(event.type==='效果观察')return '观察报告已回交，持续效果待确认；核对趋势与复发情况，决定继续观察、复查或闭环。'
  if(!task)return initial[event.sourceEventId||event.id]||'发现待核实的运行变化；核对依据并安排现场排查。'
  if(taskExecution(task).incomplete)return '本轮仍有未完成或待核实项目；审阅原因，确认补查或恢复条件。'
  if(task.kind!=='investigation')return '本轮作业结果已回交，持续效果待确认；核对复测记录并安排效果观察。'
  const abnormal=task.records?.some(r=>/发现异常|读数不一致|偏离仍存在/.test(r.result))
  return abnormal?'排查已记录异常；核对定位依据与处理范围，决定维修或继续核实。':'排查结果已回交，原因仍待核实；审阅依据，决定补查、观察或闭环。'
 }
 if(task?.purpose==='recheck')return '处理效果仍需复核；按批准范围复查原异常与同工况数据并提交结果。'
 if(task?.kind==='investigation')return '异常原因尚待现场核实；按本轮排查步骤记录发现并提交报告。'
 if(task?.kind==='maintenance')return '本轮维保已批准；按计划完成作业、复测与交接并提交报告。'
 return '本轮维修范围已批准；按任务实施处理、复测与交接并提交报告。'
}
