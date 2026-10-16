import { issueCatalog } from './captainWorkbench.js'
// Scenario assessments: conclusions change with task evidence and actual progress.
export function fleetAssessment(store){
 const coolingDone=store.isTaskHandled('fault'),driftDone=store.isTaskHandled('drift'),bearingDone=store.isTaskHandled('maintenance')
 const steeringPending=!store.isTaskHandled('steering-heat'),airPending=store.todoCreated['air-delivery']&&!store.isTaskHandled('air-delivery')
 const airConcern=!store.todoCreated['air-delivery']&&!store.ignoredSuggestions['air-delivery']
 const conclusion=coolingDone?'冷却系统本轮人工处置已提交，当前工作重心从排除异常转为验证处置效果；“已处理”尚不能代替连续运行稳定的结论。':'当前全船最需要优先核实的是主机冷却能力：出口温升与流量下降同时出现，比单一温度越限更支持冷却回路供流或换热受限的方向，但尚不能定位具体部件。'
 const basis=`${driftDone?'3号缸本轮人工处理已提交，需结合后续同工况复测评价恢复情况。':'3号缸排温相对差扩大属于局部变化，尚不能仅凭趋势定位具体部件。'}${bearingDone?'喷油器维护效果需有效监测验证。':'喷油器清洁与复校建议需审阅原事件证据与实施安排。'}${steeringPending?'舵机油温问题已有待办跟进。':'舵机本轮人工处理已提交。'}${airConcern?'空压机加载时间延长仍待人员决定是否检查。':airPending?'空压机已安排现场检查。':'空压机本次人员决定与记录已保留。'}各类信号的部位与时间尺度不同，当前没有足够证据将其归为同一故障；应分别核实，同时保留工况变化这一共同影响因素。`
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

export function todoBrief(store,scope=''){
 // The caller passes exactly the tasks visible after all list filters.
 const portfolio=typeof scope==='string'
  ?store.taskPortfolio.filter(t=>!scope||(store.assignments?.[t.id]?.owner||t.owner)===scope)
  :scope.portfolio ?? store.taskPortfolio
 const active=portfolio.filter(t=>!store.isTaskHandled(t.id))
 const stageFor=t=>t.stages[store.progress[t.id]] || {}
 const titleFor=t=>(t.id==='drift'&&store.progress[t.id]>=2?t.eventTitle:'') || t.initialTitle || t.eventTitle || t.device || '设备任务'
 const feedbackFor=t=>(store.logs[t.id] || []).filter(r=>r.kind==='feedbackRecord').at(-1)
 const executionFor=t=>(store.executionRecords?.[t.id] || []).at(-1)
 const ownerFor=t=>store.assignments?.[t.id]?.owner || t.owner
 const coordinationFor=t=>{
  const stage=stageFor(t),feedback=feedbackFor(t),execution=executionFor(t)
  if(!ownerFor(t))return '尚未登记负责人，请确认由谁接续本任务。'
  if(feedback?.task===stage.title && feedback.submissionMessage)return `本轮反馈已提交但尚未进入下一阶段：${feedback.submissionMessage}`
  if(execution?.stageId===stage.id && execution.values.completion==='partial')return '已提交未完成的执行记录，请核对现场条件与后续安排；不将记录提交视为作业完成。'
  return ''
 }
 const riskFor=t=>issueCatalog.find(i=>i.id===t.id)?.rank ?? ({报警事件:0,预警事件:1,异动跟踪:2,维保建议:3}[t.cardType] ?? 4)
 const stageWeight=t=>({work:0,check:1,overview:2,observe:3}[stageFor(t).kind] ?? 4)
 const ordered=[...active].sort((a,b)=>riskFor(a)-riskFor(b)||Number(!!coordinationFor(b))-Number(!!coordinationFor(a))||stageWeight(a)-stageWeight(b))
 const priority=ordered.slice(0,3).map(t=>{
  const stage=stageFor(t),feedback=feedbackFor(t),coordination=coordinationFor(t)
  const action=coordination || (stage.kind==='work'?'按已确认的处置安排补充实际执行与验收结果，不另建任务。':stage.kind==='observe'?'核对处理后的运行观测与验收条件，不把人工处理完成等同持续恢复。':feedback?.task===stage.title?'本轮已有现场反馈，请结合已提交结果补充剩余检查，不重复派单。':stage.kind==='check'?'按本轮检查要求核实现场情况并提交结果，未见异常或无法确认也应如实记录。':`先查看候选原因和现场条件，再接续${stage.action || '现场核实'}；尚未反馈不代表现场无法执行。`)
  const reason=riskFor(t)===0?'已有报警，建议优先核实运行影响。':riskFor(t)===1?'已有多指标预警，先核实现场证据。':coordination?'已有明确的人员确认事项需要接续。':stage.kind==='work'?'已进入处置环节，需要跟进实际执行。':'沿已派发任务补齐现场证据，不直接认定故障或换件。'
  return {id:t.id,title:titleFor(t),stage:stage.label||'待跟进',owner:ownerFor(t),action,reason}
 })
 const coordination=ordered.map(t=>({id:t.id,title:titleFor(t),text:coordinationFor(t)})).filter(r=>r.text)
 const recent=portfolio.flatMap(t=>{
  const feedback=feedbackFor(t),execution=executionFor(t),assignment=store.assignmentRecords?.[t.id]?.at(-1)
  const rows=[]
  if(feedback)rows.push({id:t.id,title:titleFor(t),text:feedback.title||'已提交现场反馈',at:feedback.submittedAt||feedback.at||'',detail:`当前处于${stageFor(t).label||'待跟进'}阶段；反馈提交不等于故障已确认。`})
  if(execution)rows.push({id:t.id,title:titleFor(t),text:execution.values.completion==='completed'?'已确认实际执行与验收记录':'已保留未完成的执行进展',at:execution.confirmedAt||'',detail:'处理后的持续效果仍由设备态势跟踪。'})
  if(assignment)rows.push({id:t.id,title:titleFor(t),text:`已指派${assignment.owner}`,at:assignment.at||'',detail:`安排：${assignment.scope||'沿本任务接续'}`})
  return rows
 }).sort((a,b)=>datedTime(b.at)-datedTime(a.at)).slice(0,3)
 const progressing=active.filter(t=>store.progress[t.id]>0||feedbackFor(t)||executionFor(t))
 const overview=`当前 ${active.length-progressing.length} 项待跟进，${progressing.length} 项进度推进中，${portfolio.length-active.length} 项已处理。`
 const fallback=portfolio.length?`暂无新的现场反馈或执行记录。${active[0]?`“${titleFor(active[0])}”${ownerFor(active[0])?`已指派${ownerFor(active[0])}`:'尚未登记负责人'}，当前处于${stageFor(active[0]).label||'待跟进'}阶段。`:'当前筛选范围内没有未完成任务；人工处理完成不代表设备已持续恢复。'}`:'当前筛选范围内没有待办，暂无可汇总的进展。'
 const plain=text=>String(text).replace(/[\r\n]+/g,' ').replace(/[\\`*_\[\]<>#]/g,'\\$&')
 const priorityText=priority.length?priority.map((r,i)=>`${i+1}. **${plain(r.title)}** · ${plain(r.stage)}${r.owner?` · ${plain(r.owner)}`:''}\n\n   ${plain(r.action)} ${plain(r.reason)}`).join('\n\n'):portfolio.length?'当前筛选范围内没有需要推进的未完成任务。':'当前筛选范围内没有待办。'
 const markdown=`### 优先推进\n\n${priorityText}${coordination.length?`\n\n### 需要你协调或确认\n\n${coordination.map(r=>`- **${plain(r.title)}**：${plain(r.text)}`).join('\n')}`:''}\n\n### 最近进展\n\n${recent.length?recent.map(r=>`- **${plain(r.title)}**：${plain(r.text)}${r.at?`（${plain(r.at)}）`:''}。${plain(r.detail)}`).join('\n'):plain(fallback)}`
 return {overview,priority,coordination,recent,markdown}
}

function datedTime(value){
 // Time-only legacy messages have no date: do not invent a cross-day ordering.
 if(!/^\d{4}[/-]/.test(value))return 0
 const time=Date.parse(value)
 return Number.isFinite(time)?time:0
}

// Resolve the lamp from current actionable items, never from a static device label.
export function deviceSignal(store, deviceId){
 const hasTodo=store.visibleTodos.some(task=>(task.deviceId||'main-engine-1')===deviceId&&!store.isTaskHandled(task.id))
 if(hasTodo)return 'danger'
 const hasAttention=deviceId==='main-engine-1'&&['drift','maintenance'].some(id=>!store.todoCreated[id]&&!store.ignoredSuggestions[id])
 const airAttention=deviceId==='air-compressor'&&!store.todoCreated['air-delivery']&&!store.ignoredSuggestions['air-delivery']
 return hasAttention||airAttention?'warning':'normal'
}
