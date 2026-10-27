import {eventDirectoryRows} from './eventDirectory.js'
import {situationDeviceIds} from './situationScope.js'

const list = rows => rows.join('\n')
const rank = type => ({'报警事件':0,'预警事件':1,'异动跟踪':2}[type] ?? 3)
const sentence = text => String(text || '').replace(/[。；\s]+$/u, '')

function latestFinding(store,row){
  const disposition=store.trackingDispositions?.[row.id]
  if(disposition?.observationResult?.findings)return disposition.observationResult.findings
  const ids=[...new Set([row.taskId,...(row.taskIds || []),row.id].filter(Boolean))]
  const assessment=ids.map(id=>store.checkAssessments?.[id]).find(Boolean)
  const executedId=ids.find(id=>store.executionRecords?.[id]?.length)
  const execution=executedId&&store.executionRecords[executedId].at(-1)
  if(execution&&(!assessment||(execution.round||1)>=(assessment.round||1))){
    const result=store.observationRecords?.[executedId]?.length?store.getObservationResult?.(executedId):null
    const state=execution.values.verification==='resolved'?`现场验收已通过，当前${row.processingState}`:execution.values.verification==='unresolved'?'现场验收仍有异常，沿原任务复查':'执行记录已提交，验收结论待确认'
    return [state,execution.values.acceptance,result?.title].filter(Boolean).join('；')
  }
  if(assessment?.message)return assessment.message
  if(disposition?.reason)return disposition.reason
  return row.summary
}

export function captainSituationBrief(store,{deviceIds=situationDeviceIds,readings=[],hours}={}){
  const rows=eventDirectoryRows(store).filter(row=>deviceIds.includes(row.deviceId)&&row.eventState!=='已闭环').map(row=>({...row,finding:latestFinding(store,row)}))
  const risks=rows.filter(row=>['报警事件','预警事件'].includes(row.type))
  const changes=rows.filter(row=>row.type==='异动跟踪')
  const decisions=rows.filter(row=>row.eventState==='待决策'||row.processingState==='待轮机长确认')
  const firstDecisions=decisions.filter(row=>row.eventState==='待决策'),returned=decisions.length-firstDecisions.length
  const rpm=readings.find(item=>item.id==='s-012'),load=readings.find(item=>item.id==='main-load')
  const operation=[rpm?`主机转速 ${rpm.min}–${rpm.max} rpm`:'',load?`负荷 ${load.min}–${load.max}%`:''].filter(Boolean).join('，')
  const overview=`${operation?`${hours?`最近 ${hours} 小时，`:''}${operation}。`:''}当前跟进 ${rows.length} 项未闭环事件，${firstDecisions.length} 项待决策${returned?`、${returned} 项核实回交待确认`:''}。`
  const riskText=risks.length?list(risks.map(row=>`- **${row.title}**（${row.processingState}）：${sentence(row.finding)}。`)):'当前没有未闭环的报警或预警事件。'
  const changeText=changes.length?list(changes.map(row=>`- **${row.title}**（${row.processingState}）：${sentence(row.finding)}。`)):'当前没有需要持续跟进的设备异动。'
  const decisionText=decisions.length?list(decisions.map(row=>`- **${row.title}**：${row.processingState==='待轮机长确认'?'审阅已回交的核实结果，决定继续观察、安排专项维保或结束本次跟踪':row.type==='报警事件'?'确认当前运行限制、排查范围和责任人':row.type==='预警事件'?'明确现场核实范围、责任人和反馈时限':'确认变化的解释缺口，决定是否追加现场核查'}。`)):'当前无待决策事项，沿已有安排跟进风险变化与处理效果。'
  const observing=rows.filter(row=>row.processingState==='效果观察'||row.processingState==='专项观察中')
  const activeTasks=(store.activeTaskPortfolio || store.visibleTodos || []).filter(task=>deviceIds.includes(task.deviceId)&&!store.isTaskHandled?.(task.id))
  const focus=risks.find(row=>decisions.includes(row))||decisions[0]||risks[0]
  const coordination=[focus?`优先关注“${focus.title}”${decisions.includes(focus)?'的处置决定':'的风险控制与处理进展'}。`:'按现有事件安排持续跟进。',observing.length?`${observing.length} 项处于观察阶段，轮机长需结合后续结果判断是否结束跟进。`:'',activeTasks.length?`${activeTasks.length} 项已建任务的推进阻碍、验收和时限在待办中统筹。`:''].filter(Boolean).join('')
  const markdown=`${overview}\n\n### 运行风险\n\n${riskText}\n\n### 设备变化\n\n${changeText}\n\n### 待决策事项\n\n${decisionText}\n\n${coordination}`
  return {rows,decisions,risks,changes,overview,riskText,changeText,decisionText,coordination,markdown}
}

function deadlineTime(value){
  const parts=String(value || '').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/)
  if(!parts)return null
  const [,year,month,day,hour='0',minute='00']=parts
  const pad=part=>part.padStart(2,'0')
  const local=`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}`
  // Dispatch datetime-local fields describe China local time, regardless of
  // the timezone of the browser or runtime viewing the task portfolio.
  const time=Date.parse(local+'+08:00')
  return Number.isFinite(time)&&new Date(time+8*3600000).toISOString().slice(0,16)===local?time:null
}

export function captainTaskBrief(store,{owner='',query='',taskIds,now=Date.now()}={}){
  const portfolio=store.activeTaskPortfolio || store.taskPortfolio || store.visibleTodos || []
  const tasks=portfolio.filter(task=>!store.isTaskHandled?.(task.id)&&(!taskIds||taskIds.includes(task.id))).map(task=>{
    const id=task.id,assignment=store.assignments?.[id] || {},stage=task.stages?.[store.progress?.[id] ?? 0] || {}
    const dispatched=Boolean(assignment.at || store.assignmentRecords?.[id]?.length)
    const assignedOwner=assignment.owner || task.owner || ''
    const due=assignment.due || '',deadline=deadlineTime(due),overdue=dispatched&&deadline!==null&&deadline<now
    const round=store.workflowRounds?.[id] || stage.round || 1
    const currentAssessment=store.checkAssessments?.[id]
    const assessment=currentAssessment&&(!currentAssessment.stageId||currentAssessment.stageId===stage.id)?currentAssessment:null
    const execution=(store.executionRecords?.[id] || []).findLast(record=>record.stageId===stage.id || !record.stageId&&(record.round||1)===round)
    const review=Boolean(assessment?.advance===false)
    const missing=(assessment?.unknown || []).length
    const workSteps=store.workStepRecords?.[id+':'+stage.id]?.records || []
    const unfinished=workSteps.filter(record=>record.result==='未完成').length
    const awaitingAcceptance=stage.kind==='work'&&execution?.values?.verification!=='resolved'
    const blockers=[!dispatched?'派发信息尚待确认':'',overdue?'已超过已定时限':'',unfinished?`${unfinished} 项维修步骤尚未完成`:'',missing?`${missing} 项检查仍未确认`:review?(assessment.title || '现场反馈待审阅'):''].filter(Boolean)
    const action=!dispatched?'确认负责人、任务范围与时限':review?'审阅已提交反馈，明确补查或本轮结束的依据':awaitingAcceptance?'核对实际措施及验收结果，明确剩余工作':stage.kind==='tracking-observation'?'按已定观察指标和判断条件收集增量资料，到期回交':round>1?'核对前轮未解决项与本轮新增发现，接续原因排查':'跟进本阶段现场结果与反馈'
    return {id,title:task.initialTitle || task.title,device:task.device,type:task.cardType,stage:stage.label || '当前阶段',round,
      owner:assignedOwner,dispatched,due,deadline,overdue,review,awaitingAcceptance,blockers,action,executionProgress:execution?'现场验收已提交':workSteps.length?`已提交 ${workSteps.filter(record=>record.result==='已完成').length}/${workSteps.length} 项作业完成结果，待提交验收`:assessment?'本轮检查反馈已提交，待确认后续安排':stage.kind==='work'?'排查反馈已提交，维修作业进行中':`当前${stage.label||'准备'}阶段，本轮反馈尚未提交`}
  }).filter(task=>(!owner||task.owner===owner)&&(!query||`${task.title}${task.device}${task.type}`.includes(query.trim())))
    .sort((a,b)=>rank(a.type)-rank(b.type)||Number(b.overdue)-Number(a.overdue)||(a.deadline??Infinity)-(b.deadline??Infinity))
  const dispatched=tasks.filter(task=>task.dispatched).length,review=tasks.filter(task=>task.review).length,acceptance=tasks.filter(task=>task.awaitingAcceptance).length
  const overview=tasks.length?`当前 ${tasks.length} 项执行任务，${dispatched} 项已派发${tasks.length-dispatched?`、${tasks.length-dispatched} 项待确认派发`:''}；${review} 项现场反馈待审阅，${acceptance} 项处于作业与验收环节。`:'当前没有符合筛选条件的未完成任务。'
  const priorityText=tasks.length?list(tasks.map((task,index)=>`- **${index+1}. ${task.title}**：${task.stage}${task.round>1?` · 第${task.round}轮`:''}。${task.action}。`)):'新的执行任务由事件处置决定后建立。'
  const blockers=tasks.filter(task=>task.blockers.length||task.awaitingAcceptance)
  const blockerText=blockers.length?list(blockers.map(task=>`- **${task.title}**：${[...task.blockers,...(task.awaitingAcceptance?['待提交本轮实际措施与现场验收']:[])].join('；')}。`)):'当前没有已记录的推进阻碍，按各任务要求接续现场反馈。'
  const assignmentText=tasks.length?list(tasks.map(task=>`- **${task.title}**：${task.dispatched?task.owner||'负责人未明确':`负责人待确认${task.owner?`（建议${task.owner}）`:''}`}；${task.dispatched?'安排时限':'拟定时限'}：${task.due||'尚未明确'}${task.overdue?'（已超时）':''}。`)):'已完成任务的责任人与验收记录保留在来源事件。'
  const progressText=tasks.length?list(tasks.map(task=>`- **${task.title}**：${task.executionProgress}。`)):'暂无执行中的任务，已提交结果可在事件中回查。'
  return {tasks,overview,priorityText,blockerText,assignmentText,progressText,markdown:`${overview}\n\n### 执行优先级\n\n${priorityText}\n\n### 任务执行与提交进度\n\n${progressText}\n\n### 负责人和时限\n\n${assignmentText}`}
}
