// Scenario assessments: conclusions change with task evidence and actual progress.
export function fleetAssessment(store){
 const coolingDone=store.isTaskHandled('fault'),driftDone=store.isTaskHandled('drift'),bearingDone=store.isTaskHandled('maintenance')
 const steeringPending=!store.isTaskHandled('steering-heat'),airPending=store.todoCreated['air-delivery']&&!store.isTaskHandled('air-delivery')
 const airConcern=!store.todoCreated['air-delivery']&&!store.ignoredSuggestions['air-delivery']
 const conclusion=coolingDone?'冷却系统本轮人工处置已提交，当前工作重心从排除异常转为验证处置效果；“已处理”尚不能代替连续运行稳定的结论。':'当前全船最需要优先核实的是主机冷却能力：出口温升与流量下降同时出现，比单一温度越限更支持冷却回路供流或换热受限的方向，但尚不能定位具体部件。'
 const basis=`${driftDone?'3号缸本轮人工处理已提交，需结合后续同工况复测评价恢复情况。':'3号缸排温相对差扩大属于局部变化，尚不能仅凭趋势定位具体部件。'}${bearingDone?'轴承检查已完成，仍需结合运行记录验证效果。':'轴承振动缓升需要结合周期和靠港窗口评估。'}${steeringPending?'舵机油温问题已有待办跟进。':'舵机本轮人工处理已提交。'}${airConcern?'空压机加载时间延长仍待人员决定是否检查。':airPending?'空压机已安排现场检查。':'空压机本次人员决定与记录已保留。'}各类信号的部位与时间尺度不同，当前没有足够证据将其归为同一故障；应分别核实，同时保留工况变化这一共同影响因素。`
 const recommendation=coolingDone?'建议先进入主机概览，查看处理后温度与流量的持续效果，再了解仍需人员决定的局部变化。':'建议先查看主机运行情况，了解冷却系统当前进展与仍待决定的关注建议；再分别决定下一步安排。'
 const healthConclusion=coolingDone?'全船运行总体保持平稳，已处理设备仍需结合持续运行验证恢复情况。':'全船运行总体保持平稳，但局部设备出现健康偏离，当前应重点关注主机。'
 const otherHealth=`${steeringPending?'舵机油温问题已有待办跟进；':'舵机本轮处理已提交；'}${airConcern?'空压机加载时间连续延长，当前仍需人员决定是否安排核实。':airPending?'空压机已建立检查待办，等待现场结果。':'空压机本次人员决定已保留，继续结合运行记录评估。'}`
 const healthAnalysis=coolingDone?'主机本轮人工处置已提交，当前应区分任务完成与设备持续稳定；仍待决策的异动和其他设备的未完成任务，需要分别跟进。现有材料尚不足以将各设备变化归为共同故障。':`结合近期趋势与现有反馈，主机的多项运行指标出现变化，值得优先核实其对持续运行的影响。${otherHealth}目前这些变化尚未表现出明确的同步关联，暂不支持全船性共同故障的判断。工况稳定也不等于设备健康，仍需结合现场结果进一步确认。`
 const suggestion=coolingDone?'优先查看主机处理后的运行情况，再跟进其余设备的未完成任务。':'优先查看主机运行情况，再跟进舵机待办和空压机异动。'
 const suggestionReason=coolingDone?'本轮处置完成后，需要先了解主机的恢复是否持续；其余设备沿已有待办跟进，根据现场反馈决定是否调整安排。':'主机直接关系推进能力，且已有不同指标的变化相互印证，因此优先了解其变化程度与当前进展；其余设备沿已有待办继续跟进，了解现场反馈后再决定是否调整检修安排。'
 return {conclusion,basis,recommendation,operationOverview:'当前船舶航行中，主机转速约450 rpm，近期可比运行片段中转速保持稳定。',healthConclusion,healthAnalysis,suggestion,suggestionReason,suggestionText:coolingDone?'先查看主机处理后的运行情况，确认恢复是否持续，再跟进其余设备的未完成任务，根据现场反馈决定是否调整检修安排。':'优先查看主机运行情况，了解其变化程度与当前进展，因为主机直接关系推进能力，且已有不同指标的变化相互印证；随后查看舵机待办的现场反馈，并了解空压机的异动依据，再分别决定下一步安排。'}

}
export function todoAssessment(store){
 const active=store.visibleTodos.filter(t=>!store.isTaskHandled(t.id)),done=store.visibleTodos.length-active.length
 if(!active.length)return `当前人工任务已处理${done?' '+done+' 项':''}，没有需要继续分派的执行环节。轮机长应把注意力转向处理效果是否持续稳定；已提交验收与运行恢复是两类证据，不宜仅凭任务完成结束全部跟进。`
 const fault=active.find(t=>t.id==='fault'),work=active.filter(t=>t.stages[store.progress[t.id]].kind==='work'),pending=active.filter(t=>!store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const priority=fault?'优先推进冷却系统任务：温升和流量下降相互印证，其运行影响应先于尚未确诊的局部趋势核实。':'当前重点是把已发现的主机趋势变成现场结论，先补足关键证据，再决定是否进入维修。'
 const coordination=work.length?`已有 ${work.length} 项进入作业阶段，人员安排应优先核对停机隔离、备件与验收条件，避免仅完成表单而遗漏实际作业约束。`:pending.length?`有 ${pending.length} 项尚待现场反馈，当前主要瓶颈是证据未齐；建议先查看优先任务的当前阶段和最新反馈，确认当班核实条件；已有任务沿原记录推进，避免重复派单。`:'各项已有现场反馈，建议轮机长优先审阅仍无法解释的现象，确认下一阶段的排查范围与负责人。'
 return `当前 ${active.length} 项任务推进中。${priority}${coordination}`
}

export function todoBrief(store,owner=''){
 const portfolio=store.taskPortfolio.filter(t=>!owner||(store.assignments[t.id]?.owner||t.owner)===owner)
 const active=portfolio.filter(t=>!store.isTaskHandled(t.id)),pending=active.filter(t=>!store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const progressing=active.filter(t=>store.progress[t.id]>0||store.logs[t.id].some(r=>r.kind==='feedbackRecord'))
 const ordered=[...active].sort((a,b)=>['fault','main-warning','steering-heat','drift','air-delivery','maintenance'].indexOf(a.id)-['fault','main-warning','steering-heat','drift','air-delivery','maintenance'].indexOf(b.id))
 const priority=ordered[0],stage=priority?.stages[store.progress[priority.id]]
 const overview=`当前 ${active.length-progressing.length} 项待跟进，${progressing.length} 项进度推进中，${portfolio.length-active.length} 项已处理。`
 const bottleneck=pending.length?`有 ${pending.length} 项尚待现场反馈，证据未齐是主要瓶颈。`:active.length?'现有任务已取得部分反馈，当前重点是补齐剩余执行与验收结果。':'当前没有未完成的已派发任务。'
 const suggestionText=priority?`优先推进“${priority.initialTitle}”的${stage.label}环节，按当前任务要求记录现场结果；证据不足时继续核实，原因明确后再决定对应处置，沿原任务接续。`:'查看已处理任务的执行与验收记录；新的处置安排由态势中心的事项决定后派发。'
 const reason=priority?.id==='fault'?'冷却系统温升与流量下降相互印证，且已有温度报警，对推进设备的运行影响需要优先核实；其他负责人按各自已派发任务继续处理。':priority?.id==='main-warning'?'润滑供油预警由多个指标联动形成，先核对现场读数一致性，再定位异常原因，不能仅凭预警直接换件。':priority?.id==='steering-heat'?'舵机油温已有报警，涉及操舵设备的持续运行；先核对实际油温、操舵负荷与散热情况，再按现场结果处理。':priority?'当前任务用于补齐已决定检查的现场证据，不能把派发检查直接等同于确认维修。':'派发任务与运行持续稳定是两类结果，人工处理完成后仍需结合设备动态中的后续观测判断。'
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
