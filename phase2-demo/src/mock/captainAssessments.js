import {deviceStoryAssessment} from './fourStoryWorkflow.js'
// Scenario assessments: conclusions change with task evidence and actual progress.
export function fleetAssessment(store){
 const report=deviceStoryAssessment(store,'main-engine-1')
 const context='结合二缸报警、控制空气低压，以及一缸基线抬升、四缸相对基线下移，按各自证据和事件进度跟进。维保建议保留在对应健康跟踪内。'
 return {conclusion:report.conclusion,basis:report.basis,recommendation:report.next,operationOverview:context,healthConclusion:report.conclusion,healthAnalysis:report.basis,suggestion:report.next,suggestionReason:context,suggestionText:report.next}
}

export function todoAssessment(store){
 const active=store.visibleTodos.filter(t=>!store.isTaskHandled(t.id)),done=store.visibleTodos.length-active.length
 if(!active.length)return `当前人工任务已处理${done?' '+done+' 项':''}，没有需要继续分派的执行环节。轮机长应把注意力转向处理效果是否持续稳定；已提交验收与运行恢复是两类证据，不宜仅凭任务完成结束全部跟进。`
 const fault=active.find(t=>t.id==='fault'),work=active.filter(t=>t.stages[store.progress[t.id]].kind==='work'),pending=active.filter(t=>!store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const priority=fault?'优先推进冷却系统任务：温升和流量下降相互印证，其运行影响应先于尚未确诊的局部趋势核实。':'当前重点是把已发现的主机趋势变成现场结论，先补足关键证据，再决定是否进入维修。'
 const coordination=work.length?`已有 ${work.length} 项进入作业阶段，人员安排应优先核对停机隔离、备件与验收条件，避免仅完成表单而遗漏实际作业约束。`:pending.length?`有 ${pending.length} 项尚待现场反馈，当前主要瓶颈是证据未齐；建议先查看优先任务的当前阶段和最新反馈，确认现场核实条件；已有任务沿原记录推进，避免重复派单。`:'各项已有现场反馈，建议轮机长优先审阅仍无法解释的现象，确认下一阶段的排查范围与负责人。'
 return `当前 ${active.length} 项任务推进中。${priority}${coordination}`
}

export function todoBrief(store,owner=''){
 const portfolio=(store.activeTaskPortfolio||store.taskPortfolio.filter(t=>!store.isTaskHandled(t.id))).filter(t=>!owner||(store.assignments[t.id]?.owner||t.owner)===owner)
 const active=portfolio.filter(t=>!store.isTaskHandled(t.id)),pending=active.filter(t=>!store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const progressing=active.filter(t=>store.progress[t.id]>0||store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const ordered=[...active].sort((a,b)=>['报警事件','预警事件','异动跟踪'].indexOf(a.cardType)-['报警事件','预警事件','异动跟踪'].indexOf(b.cardType))
 const priority=ordered[0],stage=priority?.stages[store.progress[priority.id]]
 const overview=`当前 ${active.length} 项处置中任务，其中 ${active.length-progressing.length} 项待首轮跟进，${progressing.length} 项已有执行进展。`
 const bottleneck=pending.length?`有 ${pending.length} 项尚待现场反馈，证据未齐是主要瓶颈。`:active.length?'现有任务已取得部分反馈，当前重点是补齐剩余执行与验收结果。':'当前没有未完成的已派发任务。'
 const suggestionText=priority?`优先推进“${priority.initialTitle}”的${stage.label}环节，按当前任务要求记录现场结果；证据不足时继续核实，原因明确后再决定对应处置，沿原任务接续。`:'已完成和已闭环记录保留在事件目录；新的处置安排由事件决策后派发。'
 const reason=priority?.realCaseId?priority.report.human:priority?.id==='fault'?'冷却系统温升与流量下降相互印证，且已有温度报警，对推进设备的运行影响需要优先核实；其他负责人按各自已派发任务继续处理。':priority?.id==='main-warning'?'润滑供油压力下降与过滤段压损增加需要及时现场核实；压差共享原始测量，成立后继续原因排查，不能凭预警直接换件。':priority?.id==='aux-health'?'本次任务补充长期健康趋势的现场信息，核实后回到原跟踪，不把趋势记录直接升级为拆机维修。':priority?'当前任务用于补齐已决定检查的现场证据，不能把派发检查直接等同于确认维修。':'派发任务与运行持续稳定是两类结果，人工处理完成后仍需结合事件中的后续观测判断。'
 return {overview,bottleneck,suggestionText,reason,priority:suggestionText,next:''}
}

// Resolve the lamp from current actionable items, never from a static device label.
export function deviceSignal(store, deviceId){
 const hasTodo=store.visibleTodos.some(task=>(task.deviceId||'main-engine-1')===deviceId&&!store.isTaskHandled(task.id))
 if(hasTodo)return 'danger'
 const hasAttention=deviceId==='main-engine-1'&&['drift','maintenance'].some(id=>!store.todoCreated[id]&&!store.ignoredSuggestions[id])
 const airAttention=deviceId==='air-compressor'&&!store.todoCreated['air-delivery']&&!store.ignoredSuggestions['air-delivery']
 return hasAttention||airAttention?'warning':'normal'
}
