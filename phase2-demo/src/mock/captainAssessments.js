// Scenario assessments: conclusions change with task evidence and actual progress.
export function fleetAssessment(store){
 const coolingDone=store.isTaskHandled('fault'),driftDone=store.isTaskHandled('drift'),bearingDone=store.isTaskHandled('maintenance')
 const coolingFeedback=store.logs.fault.some(row=>row.kind==='feedbackRecord')
 const conclusion=coolingDone?'冷却系统本轮人工处置已提交，当前工作重心从排除异常转为验证处置效果；“已处理”尚不能代替连续运行稳定的结论。':'当前全船最需要优先核实的是主机冷却能力：出口温升与流量下降同时出现，比单一温度越限更支持冷却回路供流或换热受限的方向，但尚不能定位具体部件。'
 const basis='3号缸排温相对差扩大属于局部变化，轴承振动缓升则需要结合周期和靠港窗口评估。辅机油压下降伴滤器压差升高、舵机油温超限也已有独立事件，仍需各自现场核实。各类信号的部位与时间尺度不同，当前没有足够证据将其归为同一故障；应分别核实，同时保留工况变化这一共同影响因素。'
 const recommendation=coolingDone?'建议先进入主机概览，查看处理后温度与流量的持续效果，再了解仍需人员决定的局部变化。':'建议先查看主机运行情况，了解冷却系统当前进展与仍待决定的关注建议；再分别决定下一步安排。'
 return {conclusion,basis,recommendation}
}
export function todoAssessment(store){
 const active=store.visibleTodos.filter(t=>!store.isTaskHandled(t.id)),done=store.visibleTodos.length-active.length
 if(!active.length)return `当前人工任务已处理${done?' '+done+' 项':''}，没有需要继续分派的执行环节。轮机长应把注意力转向处理效果是否持续稳定；已提交验收与运行恢复是两类证据，不宜仅凭任务完成结束全部跟进。`
 const fault=active.find(t=>t.id==='fault'),work=active.filter(t=>t.stages[store.progress[t.id]].kind==='work'),pending=active.filter(t=>!store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const priority=fault?'优先推进冷却系统任务：温升和流量下降相互印证，其运行影响应先于尚未确诊的局部趋势核实。':'当前重点是把已发现的主机趋势变成现场结论，先补足关键证据，再决定是否进入维修。'
 const coordination=work.length?`已有 ${work.length} 项进入作业阶段，人员安排应优先核对停机隔离、备件与验收条件，避免仅完成表单而遗漏实际作业约束。`:pending.length?`有 ${pending.length} 项尚待现场反馈，当前主要瓶颈是证据未齐；建议先查看优先任务的当前阶段和最新反馈，确认当班核实条件；已有任务沿原记录推进，避免重复派单。`:'各项已有现场反馈，建议轮机长优先审阅仍无法解释的现象，确认下一阶段的排查范围与负责人。'
 return `当前 ${active.length} 项任务推进中。${priority}${coordination}`
}

export function todoBrief(store){
 const active=store.taskPortfolio.filter(t=>!store.isTaskHandled(t.id))
 const pending=active.filter(t=>!store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const working=active.filter(t=>t.stages[store.progress[t.id]].kind==='work')
 const cooling=active.some(t=>t.id==='fault')
 if(!active.length)return {overview:'当前没有待推进任务。',priority:'关注已处理事项的运行恢复情况。',reason:'人工处置完成与持续运行稳定是两类结果，仍需结合后续观测判断。',bottleneck:'当前没有等待执行的人工环节。',next:'建议查看设备态势中的处理效果，确认是否仍有需跟进的变化。'}
 return {
 overview:`当前 ${active.length} 项任务推进中。`,
 priority:cooling?'优先查看冷却系统任务的当前进展。':working.length?'优先查看已进入维修或保养的任务进展。':'优先查看尚待现场反馈的检查任务。',
 reason:cooling?'温升和流量下降相互印证，当前应优先了解其运行影响与排查进展，再评估局部趋势事项。':working.length?'任务已进入实际作业，需先了解执行条件和未完成环节，再判断是否需要协调。':'现有趋势尚需现场证据支持，先了解核实结果比直接追加维修更有价值。',
 bottleneck:pending.length?`有 ${pending.length} 项尚待现场反馈，证据未齐是主要瓶颈。${working.length?'另有 '+working.length+' 项处于维修环节，需单独核对作业条件。':''}`:working.length?`有 ${working.length} 项处于维修或保养阶段，当前重点是实际执行与验收结果。`:'各项已有现场反馈，当前重点是明确剩余排查结论。',
 next:pending.length?'建议先查看优先任务的当前阶段和最新反馈，确认当班核实条件；已有任务沿原记录推进，避免重复派单。':working.length?'建议先查看当前作业记录，了解尚缺哪些执行或验收信息，再决定是否协调。':'建议先查看最新反馈及未解释的现象，再决定下一步排查安排。'
 }
}
