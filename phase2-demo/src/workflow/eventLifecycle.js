import {submissionCode,submissionNumber,submissionTitle,submissionSnapshot,refreshSubmissionLabels,reportTask,taskReports,reportContextVersion} from './reportSubmissions.js'
import {workflowCases, workflowIssues, composeRepair} from '../mock/fourStoryWorkflow.js'
import {eventBriefingFor} from '../mock/eventBriefings.js'
import {trackingProcessReference} from '../mock/trackingProcessReferences.js'
import {adviceDetails,reportAnalysis,reportAnalysisSummary,trackingAssessment} from './lifecycleAnalysis.js'
import {lifecycleDecisionOptions,dispatchAction,hasAbnormalFindings,confirmedTracking,taskName} from './lifecycleDecisions.js'
import {taskTitle,taskRoundLabel} from './taskLabels.js'
import {maintenancePlans,maintenanceSelection} from './maintenancePlans.js'
import {generatedAnalysis,validateGeneratedReport} from './generatedReport.js'
import {ensurePlanDraft,taskPlanKey} from './taskPlanning.js'
import {detailedRepairSteps,presetRecheckSteps,repairProcedureVersion} from './repairPlanning.js'
import {closureContent,closurePresentationVersion} from './closureReport.js'
import {groupRepairSteps,compactAssignedRepair} from './repairStepGroups.js'
import {hasObservation,observationStart,observationTaskFor,isVerificationObservation,isVerificationReview,observationPolicy} from './observationContext.js'
import {taskExecution,executionFacts,carryForwardSteps,taskRecordSummary} from './taskExecution.js'
import {createObservationEvent,migrateObservationEvents,observationTasks,observationChain,isObservationEvent} from './observationEvents.js'
import {shoreReportSnapshot} from './shoreReports.js'
import {applyInitialTimeline,shiftTimelineContent} from './demoTimeline.js'
import {taskRecommendation,eventSubject} from './contentRecommendations.js'
import {initialBriefText} from './initialBriefText.js'
import {eventTitle} from './eventTitle.js'
export {hasAbnormalFindings,taskName} from './lifecycleDecisions.js'

import {people,capabilities,actor,ownsTask,executors} from './lifecyclePermissions.js'
import {validateDecisionEvidence} from './lifecycleDecisions.js'
import {validateObservationPlan,observationPlanDraft,validateClosureDraft,closureDraft} from './decisionDrafts.js'
export {people} from './lifecyclePermissions.js'
export const eventNumbers = {'real-alarm-0430':'CBY-EVT-20260430-001','real-warning-0523':'CBY-EVT-20260523-001','real-tracking-exhaust-baseline':'CBY-EVT-20260812-001','real-health-c4-baseline':'CBY-EVT-20260812-002'}
export const stageNames = {reminder:'初始信息',investigation:'原因排查',decision:'决策中',repair:'维修执行',maintenance:'关联维保',review:'结果处置',closed:'闭环归档',transferred:'已转效果观察'}
export const timeText = value => !value?'—':Number.isNaN(new Date(value).getTime())?String(value):new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16)
const copy = value => JSON.parse(JSON.stringify(value))
const required = (ok,message) => {if(!ok)throw new Error(message)}
let serial=0
const uid = prefix => `${prefix}-${Date.now()}-${++serial}`
export function checkSteps(id){
 const tasks=workflowCases[id]?.stages.filter(s=>s.kind==='check').flatMap(s=>s.tasks)||[]
 return copy(tasks.length?tasks:(eventBriefingFor(id)?.tasks||[]).map(t=>({label:t.title,guide:t.detail,checks:[t.detail],options:['发现异常','未见异常','无法确认']})))
}
export function newEvent(item,{createdAt=new Date().toISOString()}={}){
 const brief=eventBriefingFor(item.id)
 return {id:item.id,title:eventTitle(item.title,item.type),type:item.id==='real-warning-0523'?'预警事件':item.type,device:item.device,createdAt,tracking:item.type==='异动跟踪',brief:copy(brief),status:'待决策',phase:'reminder',currentTask:null,participants:[],tasks:[],reports:[],decisions:[],shore:[],maintenance:null,
  number:eventNumbers[item.id],phases:[{id:'reminder',kind:'reminder',label:'初始信息',at:brief?.discovery.at}],conversations:{captain:[],engineer:[]},unread:{captain:true,engineer:false}}
}
function say(event,role,kind,text,extra={}){const message={id:uid('message'),kind,text,at:new Date().toISOString(),...extra};(event.conversations[role]||=[]).push(message);return message}
function notify(state,event,recipient,title,text){
 (state.notices||(state.notices=[])).push({id:uid('notice'),eventId:event.id,recipient,title,text,at:new Date().toISOString(),read:false})
}
function advice(event,role,analysis,recommendation,at){
 const message=say(event,role,'advice','',{analysis,recommendation,animate:!at,...(at?{at}: {})})
 message.detailsMarkdown=adviceDetails(event,message,role);message.basisVersion=event.timeline?8:7;message.basisLabel='思考过程'
 return message
}
function phase(event,kind,label,extra={}){const p={id:uid(kind),kind,label:label||stageNames[kind],at:new Date().toISOString(),...extra};event.phases.push(p);event.phase=kind;return p}
export function createLifecycleState({timeBase}={}){
 const events=Object.fromEntries(workflowIssues.filter(item=>!item.latent).map(item=>[item.id,newEvent(item,{createdAt:eventBriefingFor(item.id)?.discovery.at})]))
 for(const e of Object.values(events))applyInitialTimeline(e,timeBase)
 for(const e of Object.values(events))advice(e,'captain',initialBriefText(e.brief).phenomenon+taskRecommendation(e).next,'',e.timeline?new Date(Date.parse(e.createdAt)+5*60000).toISOString():e.brief.discovery.at)
 // Retain the complete earlier C4 investigation, including its handoff report.
 const e=events['real-health-c4-baseline'],prior=trackingProcessReference(e.id)
 if(prior){
  const at='2026-08-12T04:15:00.000Z',task={id:uid('investigation'),kind:'investigation',round:1,owner:people.engineer,deadline:'2026-08-12T16:00',scope:prior.records[0].text,assignedAt:at,steps:prior.feedback.map(r=>({label:r.label,guide:r.note,options:[r.result]})),records:copy(prior.feedback),summary:prior.summary,submittedAt:'2026-08-12T06:20:00.000Z',status:'submitted'}
  e.tasks.push(task);e.currentTask=task.id;e.participants.push(people.engineer)
  e.phases.push({id:task.id,kind:'investigation',label:'第1轮排查',at,taskId:task.id})
  say(e,'captain','user',`已派发排查给${task.owner}。${task.scope}`,{at});advice(e,'engineer',`本轮要求 ${timeText(task.deadline)} 前回交四缸同工况比较与独立测温记录。`,'',at)
  const report=makeReport(e,task);e.reports.push(report)
 task.goalStatus=taskExecution(task).incomplete?'unresolved':'completed'
 task.conversations||={captain:[],engineer:[]}
 task.conversations.engineer.push({id:uid('message'),kind:'user',title:'本轮反馈已提交',text:task.summary,at:task.submittedAt},{id:uid('message'),kind:'receipt',title:'反馈已收录，等待轮机长审阅',text:'本轮记录已提交，待轮机长审阅。',reportId:report.id,at:task.submittedAt})
  say(e,'engineer','receipt',`已回交${task.records.length}项检查结果，待轮机长审阅。`,{at:task.submittedAt,reportId:report.id,title:'排查报告已提交'})
  advice(e,'captain',taskRecommendation(e,task).reason+'；'+taskRecommendation(e,task).next,'',task.submittedAt)
  e.phases.push({id:uid('decision'),kind:'decision',label:'排查后决策',at:task.submittedAt,taskId:task.id,reportId:report.id});e.phase='decision';e.status='待决策'
 }
 return {version:1,role:'captain',...(Number.isFinite(timeBase)?{timeBase}:{}),events,notices:[]}
}
export function currentTask(event){return event.tasks.find(t=>t.id===event.currentTask)}
export function pendingDecision(event){if(currentTask(event)?.waiting?.reviewRequested)return true;return ['reminder','decision','review'].includes(event.phase)&&!event.phases.at(-1)?.observationWaiting&&currentTask(event)?.status!=='waiting'}
export function visibleEvents(state){return Object.values(state.events).filter(e=>state.role==='captain'||e.participants.includes(actor(state)))}
export function activeTask(event){const t=currentTask(event);return t?.status==='assigned'?t:null}
export function isProcessingEvent(event){return !['reminder','transferred','closed'].includes(event.phase)}
export const decisionOptions=lifecycleDecisionOptions
export function ensureTaskPlan(event){
 const action=dispatchAction(event);if(!action)return null
 const report=event.reports.at(-1),prior=currentTask(event)||event.observationSource?.task
 const steps=action==='investigate'?shiftTimelineContent(event.manualReport||event.detectionReport?copy((event.manualReport||event.detectionReport).analysis.steps):checkSteps(event.sourceEventId||event.id),event.timeline):action==='maintenance'?maintenancePlan(event):action==='repair'?proposedPlan(event):presetRecheckSteps(event)
 const scope=action==='recheck'?`依据${report?.title||'本轮报告'}，${isVerificationReview(event)?'核对已查范围、观察中变化是否持续、扩大、恢复或复发；本轮未实施维修，不预设故障原因':'复核实际维修措施、剩余事项、修后数据和原异常是否再现'}，提交现场复查结果。`:action==='investigate'?event.brief.dispatchReason:`依据${report?.title||'现场记录'}，处理本轮登记的异常：${prior?.records.filter(r=>/发现异常|读数不一致|偏离仍存在/.test(r.result)).map(r=>r.label).join('、')||'已批准部位'}。保留实际措施、隔离与复测记录。`
 const draft=ensurePlanDraft(event,{steps,scope,procedureVersion:repairProcedureVersion,rationale:report?`依据《${report.title}》：${report.summary}`:event.brief.conclusion})
 if(action==='maintenance'){
  const selected=maintenancePlans(event).find(p=>p.id===event.decisionDraft?.maintenancePlanId)||maintenancePlans(event)[0]
  if(selected&&draft.maintenancePlanId!==selected.id){Object.assign(draft,{maintenancePlanId:selected.id,steps:copy(selected.steps),scope:`异动已由现场核实，提前执行《${selected.title}》（${selected.id}），在所选靠港窗口内按计划完成保养、复测与汇报。`,rationale:`依据《${report?.title||'排查报告'}》：现场与系统相符、背景信息已记录；确认异动，不等同于确认部件损坏。`,status:'ready',source:'maintenance-plan'});draft.version++}
 }
 if(action==='repair'&&draft.source==='existing'&&draft.procedureVersion!==repairProcedureVersion){draft.steps=steps;draft.procedureVersion=repairProcedureVersion;draft.version++}
 if(['repair','maintenance'].includes(action)&&draft.steps.length>4){draft.steps=groupRepairSteps(draft.steps);draft.version++}
 if(action==='recheck'&&!draft.steps.length){draft.steps=steps;draft.scope=scope;draft.source='preset'}
 return draft
}
const planClean=text=>String(text||'').replaceAll('提交验收','提交维修报告').replaceAll('提交现场验收','提交维修报告').replaceAll('验收通过后','轮机长确认后').replaceAll('现场验收','结果核对')
export function maintenancePlan(event){
 return copy(maintenancePlans(event)[0]?.steps||[])
}
export function proposedPlan(event){
 const remaining=carryForwardSteps(event)
 if(remaining.length)return remaining
 const investigation=observationTasks(event).reverse().find(t=>t.kind==='investigation'&&t.status==='submitted')
 if(!investigation)return []
 const keys=[...new Set(investigation.records.filter(r=>r.result==='发现异常').map(r=>r.package).filter(Boolean))]
 const data=workflowCases[event.sourceEventId||event.id]
 let tasks=keys.length?composeRepair(data,keys).tasks:[]
 // Notes remain verbatim evidence; they never become an unverified replacement diagnosis.
 tasks=tasks.map(t=>({...t,guide:planClean(t.guide),checks:(t.checks||[]).map(planClean),recordHint:planClean(t.recordHint)}))
 return detailedRepairSteps(event,copy(tasks))
}
export function makeReport(event,task,reportId){
 const kind=task.kind==='investigation'?'排查报告':task.kind==='maintenance'?'维保作业报告':'维修报告'
 const id=reportId||uid('report'),number=submissionNumber(event,task,reportId),title=submissionTitle(event,task,number)
 const priorRows=[...(task.procedureHistory||[]),...(task.feedbackHistory||[])].map(h=>'### 历史阶段的原填写记录\n\n'+h.draft.records.filter(r=>r.result||r.note).map(r=>`- ${r.label} · ${r.result||'未选结果'}：${r.note||'未填备注'}`).join('\n')).join('\n\n')
 const generated=task.generatedReport,analysis=generated?.patch.summary||reportAnalysisSummary(event,task),analysisMarkdown=generated?generatedAnalysis(generated.patch):reportAnalysis(event,task)
 const markdown=`# ${title}\n\n- 报告编号：${submissionCode(event,task,number)}\n- 事件类型：${event.type}\n- 负责人：${task.owner}\n- 提交时间：${timeText(task.submittedAt)}\n\n## ${task.kind==='investigation'?'检查结果摘要':'处理结果与剩余事项'}\n\n${generated?.patch.summary||reportAnalysisSummary(event,task)}\n\n${executionFacts(task)}\n\n## AI分析与建议\n\n${analysisMarkdown}\n\n## 任务安排与批准范围\n\n- 派发时间：${timeText(task.assignedAt)}\n- 要求完成：${timeText(task.deadline)}\n\n${task.scope}${priorRows?'\n\n'+priorRows:''}\n\n${task.attachments?.length?'## 附件索引\n\n'+task.attachments.map(a=>'- '+a.name).join('\n'):'## 附件索引\n\n本轮未关联附件。'}`
 const maintenanceText=task.maintenance?`\n\n## 提前维保安排\n\n- 维保计划：${task.maintenance.plan.id} · ${task.maintenance.plan.title}\n- 计划版本：${task.maintenance.plan.revision}\n- 关联正式工单：${task.maintenance.plan.workOrder?.number||'未关联'} · ${task.maintenance.plan.workOrder?.status||'待核实'}\n- 工单状态独立管理，本次报告不自动确认正式工单完工。\n- 靠港时间：${task.maintenance.window.label}\n- 执行方式：按选定维保计划提前执行，实际措施见逐项记录。`:''
 return {id,title,kind,number:submissionCode(event,task,number),submissionNumber:number,submissionSnapshot:submissionSnapshot(task),analysisContextVersion:reportContextVersion,taskId:task.id,eventId:event.id,eventNumber:event.number,owner:task.owner,at:task.submittedAt,markdown:markdown.replace('- 事件类型：','- 事件编号：'+event.number+'\n- 事件类型：')+maintenanceText,analysis,analysisMarkdown,summary:generated?.patch.summary||task.summary,presentationVersion:6,...(generated?{generatedBy:generated.model,usage:generated.usage,sources:generated.sources,generatedAt:generated.at}:{})}
}
export function refreshLifecyclePresentation(state){
 for(const event of Object.values(state.events)){
  event.title=eventTitle(event.title,event.type)
  // Retire only unissued authorizations from the previous prototype; preserve history and actual tasks.
  if(event.dispatchAuthorization?.status==='pending'){
   const authorization=event.dispatchAuthorization
   event.retiredDispatchAuthorizations||=[]
   event.retiredDispatchAuthorizations.push({...copy(authorization),status:'retired',retiredReason:'恢复轮机长直接派发，原未派发方案作为草稿保留。'})
   event.decisionDraft={...copy(authorization.form),dispatcher:people.captain}
   event.pendingPlan=copy(authorization.plan)
   delete event.dispatchAuthorization
   event.unread.captain=true
  }
  for(const item of event.shore||[]){item.status='已上报岸基';item.delivery||={mode:'prototype',submittedAt:item.at}}
  event.number=eventNumbers[event.id]||event.number
  if(event.status==='待处置决策')event.status='待决策'
  if(event.id==='real-warning-0523'){event.type='预警事件';event.brief.discovery.kind='ai-warning';event.brief.discovery.label='AI预警 → 关联研判'}
  for(const task of event.tasks){compactAssignedRepair(task);if(task.status==='submitted')task.goalStatus=taskExecution(task).incomplete?'unresolved':'completed'}
  if(['repair','maintenance'].includes(event.pendingPlan?.action)&&event.pendingPlan.steps.length>4){event.pendingPlan.steps=groupRepairSteps(event.pendingPlan.steps);event.pendingPlan.version++}
  for(const task of event.tasks)if(hasObservation(task)&&task.status==='submitted'&&!task.observationEndedAt){const next=event.tasks.find(t=>Date.parse(t.assignedAt)>Date.parse(task.observationResumedAt||observationStart(task)));task.observationEndedAt=next?.assignedAt||event.closedAt||null}
  refreshSubmissionLabels(event)
  for(const report of event.reports){
   if(report.linkedSource)continue
   const task=reportTask(event,report)
   // Refresh only built-in presentation; preserve model output and human revisions.
   if(task?.status==='submitted'&&taskReports(event,task.id).length===1&&report.presentationVersion!==6&&!report.generatedBy&&!task.generatedReport&&!report.revisions?.length&&!report.original){
    const oldAnalysis=report.analysis;Object.assign(report,makeReport(event,task,report.id))
    for(const messages of Object.values(event.conversations))for(const message of messages)if(message.kind==='advice'&&message.analysis===oldAnalysis){message.analysis=report.analysis;if(event.tracking&&task.kind==='investigation')message.recommendation=trackingAssessment(event,task).next}
   }
  }
  for(const report of event.reports)if(report.kind==='闭环报告'&&!report.confirmedDraft&&report.presentationVersion!==closurePresentationVersion){const decision=event.decisions.findLast(d=>['close','false'].includes(d.action));Object.assign(report,makeClosureReport(event,decision?.action||'close',report.summary,report.at,report.id))}
  for(const role of ['captain','engineer'])for(const message of event.conversations[role])if(message.kind==='advice'&&message.basisVersion!==(event.timeline?8:7)){message.detailsMarkdown=adviceDetails(event,message,role);message.basisVersion=event.timeline?8:7;message.basisLabel='思考过程'}
 }
 migrateObservationEvents(state)
 // Apply the same rule to saved observations closed before chain closure existed.
 for(const event of Object.values(state.events))if(isObservationEvent(event)&&event.phase==='closed'&&!event.linkedClosure)closeObservationChain(state,event)
 return state
}
export function makeClosureReport(event,action,reason,at,id=uid('report')){
 return {id,kind:'闭环报告',title:event.title+' · 闭环报告',eventId:event.id,eventNumber:event.number,owner:people.captain,at,summary:reason,...closureContent(event,action,reason,at,people.captain)}
}

function closeObservationChain(state,source){
 const closure=source.decisions.findLast(d=>['close','false'].includes(d.action))
 const at=source.closedAt||closure?.at||source.phases.at(-1)?.at
 if(!at)return
 for(const event of observationChain(state,source.id)){
  if(event.phase==='closed')continue
  const reason=`关联效果观察「${source.title}」（${source.number}）已闭环，整条链路同步闭环。${source.closeReason||closure?.reason||''}`
  const sourcePhaseId=event.phases.at(-1)?.id
  for(const task of observationTasks(event)){
   if(hasObservation(task)&&!task.observationEndedAt)task.observationEndedAt=at
   if(['assigned','waiting','reporting','report-error'].includes(task.status)){
    // Closing the event does not turn unfinished work into completed work.
    task.status='terminated';task.goalStatus='terminated';task.terminatedAt=at;task.terminationReason=reason
    if(task.reportGeneration){task.reportGeneration.status='cancelled';task.reportGeneration.requestId=null}
    for(const messages of Object.values(task.conversations||{}))for(const message of messages)if(message.status==='streaming')Object.assign(message,{status:'interrupted',modelError:'关联链路已闭环，原填写记录已保留。'})
   }
  }
  event.linkedClosure={eventId:source.id,eventNumber:source.number,at}
  event.status='已闭环';event.closedAt=at;event.closeReason=reason;event.unread.captain=false
  const closed=phase(event,'closed','闭环归档',{at,linkedEventId:source.id})
  event.decisions.push({id:uid('decision'),action:'close',reason,at,owner:people.captain,taskId:event.currentTask,sourcePhaseId,resultPhaseId:closed.id,linkedEventId:source.id})
  event.reports.push(makeClosureReport(event,'close',reason,at))
  say(event,'captain','receipt',reason,{at,title:'关联链路已闭环',linkedEventId:source.id})
  if(event.participants.length){say(event,'engineer','receipt',reason,{at,title:'关联链路已闭环',linkedEventId:source.id});event.unread.engineer=true;notify(state,event,'engineer','关联链路已闭环',reason)}
 }
}

export function analyzeFindings(task){
 const abnormal=task.records.filter(r=>['发现异常','读数不一致','工况可比，偏离仍存在'].includes(r.result))
 const unknown=task.records.filter(r=>/无法确认|受限/.test(r.result))
 return `${abnormal.length?'现场反馈指出：'+abnormal.map(r=>r.label+(r.note?'（'+r.note+'）':'')).join('；')+'。':'本轮逐项核实记录已回交，原提醒是否成立及其解释以提交结论为准。'}${unknown.length?'尚待补充：'+unknown.map(r=>r.label).join('、')+'。':''} ${task.summary} 请由轮机长对照原提醒、已核实范围和剩余事项决定下一步。`
}
function settleTaskAnalysis(task,reason){
 if(!task||!['reporting','report-error'].includes(task.status))return
 task.status='submitted'
 if(task.reportGeneration){task.reportGeneration.status='cancelled';task.reportGeneration.requestId=null}
 for(const messages of Object.values(task.conversations||{}))for(const message of messages)if(message.status==='streaming')Object.assign(message,{status:'interrupted',modelError:reason+'；正式现场事实与已提交报告保留。'})
}
export function decide(state,id,form){
 required(state.role==='captain','只有轮机长可以做出处置决定并派发任务。')
 const e=state.events[id];required(e,'未找到事件。')
 required(decisionOptions(e).some(x=>x.value===form.action),'当前阶段不能执行此决定，请核对最新任务状态。')
 const at=new Date().toISOString(),action=form.action,sourcePhaseId=e.phases.at(-1)?.id
 // Dispatch uses the reviewed task plan. Observation uses its structured plan;
 // neither requires a second narrative or a model-generated decision prefill.
 form={...form,reason:form.reason?.trim()||''}
 if(!['investigate','repair','maintenance','recheck','observe'].includes(action)&&!(action==='shore'&&form.shoreIncludeHistory))required(form.reason,'请填写决定依据或本次安排。')
 validateDecisionEvidence(e,form)
 const observationPlan=action==='observe'?validateObservationPlan({...observationPlanDraft(e),...form.observationPlan,purpose:form.reason||form.observationPlan?.purpose||'依据已提交报告，核对相关变化是否持续、恢复或复发。'}):null
 if(observationPlan&&!form.reason)form.reason=`安排效果观察，计划 ${timeText(observationPlan.dueAt)} 汇报。`
 const closure= ['close','false'].includes(action)?validateClosureDraft({...closureDraft(e),conclusion:form.reason.trim(),...Object.fromEntries(Object.entries(form.closureDraft||{}).filter(([,v])=>typeof v==='string'&&v.trim()))}):null
 if(['investigate','repair','maintenance','recheck'].includes(action)){
  required(executors.some(p=>p.name===form.owner),'请选择允许范围内的任务负责人。')
  required(Number.isFinite(Date.parse(form.deadline))&&Date.parse(form.deadline)>Date.now(),'要求完成时间应晚于当前时间。')
  const selectedMaintenance=action==='maintenance'?maintenanceSelection(e,form):null
  if(selectedMaintenance){e.decisionDraft||={};e.decisionDraft.maintenancePlanId=selectedMaintenance.plan.id}
  const plan=ensureTaskPlan(e)
  required((plan?.key===taskPlanKey(e))&&plan.action===action&&plan.status==='ready'&&plan.steps.length,'待派任务尚未生成完成，请先查看任务草稿。')
  if(!form.reason)form.reason=`按已审阅方案派发${{investigate:'排查',repair:'维修',maintenance:'提前维保',recheck:'复查'}[action]}，执行人 ${form.owner}，要求 ${timeText(form.deadline)} 前完成。`
  for(const prior of observationTasks(e))if(prior.status==='submitted'&&hasObservation(prior)&&!prior.observationEndedAt)prior.observationEndedAt=at
  const kind=['investigate','recheck'].includes(action)?'investigation':action
  const round=e.tasks.filter(t=>t.kind===kind).length+1
  const task={id:uid(kind),kind,procedureVersion:repairProcedureVersion,purpose:action==='recheck'?'recheck':kind,round,owner:form.owner,deadline:form.deadline,scope:plan.scope,assignedAt:at,status:'assigned',steps:copy(plan.steps),plan:copy(plan),records:[],summary:'',attachments:[],sourceReportId:plan.sourceReportId}
  if(selectedMaintenance)task.maintenance=selectedMaintenance
  task.draft={records:task.steps.map(t=>({label:t.label,package:t.package,result:'',note:''})),summary:'',attachments:[]}
  task.assignedBy=actor(state)
  task.implementationBasis=form.evidence?.trim()||''
  task.number=`${e.number.replace('EVT','TSK')}-${String(e.tasks.length+1).padStart(2,'0')}`
  task.title=taskTitle(task)
  if(selectedMaintenance)task.title='提前维保 · '+selectedMaintenance.plan.title
  settleTaskAnalysis(currentTask(e),'已作出后续安排，停止旧轮次的 AI 生成')
  e.tasks.push(task);e.currentTask=task.id
  if(!e.participants.includes(task.owner))e.participants.push(task.owner)
  const p=phase(e,kind,taskRoundLabel(task),{taskId:task.id});p.id=task.id
  e.status=task.purpose==='recheck'?'复查中':kind==='investigation'?'排查中':kind==='repair'?'维修中':'维保执行中'
  if(kind==='maintenance')e.maintenance={number:selectedMaintenance.plan.id,window:selectedMaintenance.window.label,owner:form.owner,scope:task.scope,at,taskId:task.id,...copy(selectedMaintenance)}
  const ownerRole=Object.keys(people).find(role=>people[role]===task.owner)
  e.unread[ownerRole]=true;e.unread.captain=false
  notify(state,e,ownerRole,`收到新的${taskName(task)}任务`,`${actor(state)}已派发“${e.title}”，要求 ${timeText(task.deadline)} 前完成。`)
  say(e,'captain','user',`派发${taskName(task)} · ${task.owner} · 要求 ${timeText(task.deadline)} 前完成。\n${task.scope}`)
  advice(e,'captain',`${task.owner}已接收${taskName(task)}任务，要求 ${timeText(task.deadline)} 前回交。`,'')
  advice(e,ownerRole,kind==='investigation'?`记录${eventSubject(e).retest}，对应每项检查填写部位、时间与读数。`:`回交实际处理部位与${eventSubject(e).retest}，登记未完成项目。`,'')
 }else if(action==='wait'){
  const task=currentTask(e)
  required(['submitted','reporting','report-error'].includes(task?.status)&&taskExecution(task).incomplete,'只有存在未完成或受阻项目的任务可以等待条件。')
  settleTaskAnalysis(task,'当前任务转入等待条件')
  task.status='waiting';task.goalStatus='unresolved';task.waiting={reason:form.reason,at,resumeApproved:true};task.observationEndedAt=at
  e.status='等待执行条件';e.unread.captain=false
  say(e,'captain','user','保留原任务，等待条件：'+form.reason)
  task.conversations||={captain:[],engineer:[]}
  ;(task.conversations[Object.keys(people).find(role=>people[role]===task.owner)]||=[]).push({id:uid('message'),kind:'receipt',title:'等待执行条件',text:form.reason+' 已完成的步骤和阶段报告保留，条件具备后恢复原任务。',at})
 }else if(action==='resume'){
  const task=currentTask(e)
  required(task?.status==='waiting','当前任务不在等待条件状态。')
  if(form.deadline)required(Date.parse(form.deadline)>Date.now(),'调整的完成时限应晚于当前时间。')
  task.feedbackHistory||=[];task.feedbackHistory.push({at:task.submittedAt,observation:task.observation?copy(task.observation):null,reportId:e.reports.findLast(r=>r.taskId===task.id)?.id,draft:{records:copy(task.records),summary:task.summary}})
  task.draft={records:copy(task.records),summary:task.summarySource==='records'?'':task.summary,attachments:copy(task.attachments||[])}
  task.status='assigned';task.deadline=form.deadline||task.deadline;task.resumedAt=at;task.waiting={...task.waiting,resumedAt:at,resumeReason:form.reason,reviewRequested:null}
  delete task.generatedReport;delete task.reportGeneration;delete task.observation;delete task.observationEndedAt;delete task.observationStartedAt;delete task.observationMode
  e.phase=task.kind;e.phases.at(-1).resumeAt=at;e.status='任务执行中';e.unread.engineer=true;e.unread.captain=false
  say(e,'captain','user','条件已确认，恢复原任务：'+form.reason)
 }else if(action==='terminate'){
  const task=currentTask(e)
  required(task&&['waiting','submitted','reporting','report-error'].includes(task.status),'当前任务不能终止。')
  settleTaskAnalysis(task,'未执行部分已终止')
  task.status='terminated';task.goalStatus='terminated';task.terminatedAt=at;task.terminationReason=form.reason;task.observationEndedAt=at
  phase(e,'review','未执行部分已终止',{taskId:task.id,reportId:e.reports.findLast(r=>r.taskId===task.id)?.id});e.status='待后续决策'
  say(e,'captain','user','终止未执行部分：'+form.reason+'；事件仍保留，需单独作出后续决定。')
 }else if(action==='observe'){
  const task=currentTask(e);let work=e.phase==='decision'&&task?.purpose!=='recheck'?task:observationTaskFor(e)||task
  if(!work&&e.phase==='reminder'){work={id:'initial-'+e.id,kind:'investigation',round:0,owner:people.captain,status:'submitted',submittedAt:at,records:[],steps:[],summary:e.brief.conclusion};e.reports.push({id:uid('initial-basis'),taskId:work.id,eventId:e.id,title:e.title+' · 初始观察依据',kind:'初始信息',owner:people.captain,at,summary:e.brief.conclusion,markdown:e.brief.conclusion})}
  required(['submitted','reporting','report-error'].includes(work?.status)&&work.submittedAt,'请先正式回交本轮情况，再开始观察。')
  if(e.type!=='效果观察'){
   const child=createObservationEvent(state,e,work,{at,reason:form.reason,plan:observationPlan})
   say(e,'captain','user','创建效果观察事件：'+child.title,{observationEventId:child.id})
  }else{
  e.observationPlan=copy(observationPlan)
  if(!work.observationStartedAt){if(work.kind==='investigation')work.observationMode='verification';work.observationStartedAt=at}
  if(work.observationEndedAt){work.observationResumedAt=at;work.observationEndedAt=null}
  const interval=Date.parse(observationPlan.dueAt)-Date.parse(at),dueAt=observationPlan.dueAt
  phase(e,'review',isVerificationObservation(work)?'核实后继续观察':'效果观察',{taskId:task?.id,reportId:e.reports.findLast(r=>r.taskId===work.id)?.id,observationWaiting:true,observationIntervalMs:interval,observationDueAt:dueAt,observationTaskId:work.id,observationPlan:copy(observationPlan)})
  e.status='效果观察中';e.unread.captain=false
  say(e,'captain','user',(isVerificationObservation(work)?'核实后继续观察：':'进入效果观察：')+form.reason)
  advice(e,'captain',`${eventSubject(e).name}进入观察，计划 ${timeText(dueAt)} 回交采样与工况记录。`,'')
  }
 }else if(action==='shore'){
  const syncedReport={...shoreReportSnapshot(e,form,state,at),at,owner:actor(state)}
  const record={id:uid('shore'),at,owner:actor(state),reason:form.reason,reportId:syncedReport.id,syncedReport,status:'已上报岸基',delivery:{mode:'prototype',submittedAt:at},packet:copy({eventId:e.id,number:e.number,title:e.title,type:e.type,device:e.device,phase:e.phase,status:e.status,reports:[syncedReport],at})};e.shore.push(record)
  say(e,'captain','user','上报岸基：'+syncedReport.title+'。'+form.reason,{shoreId:record.id});advice(e,'captain',`《${syncedReport.title}》已提交。`,'')
 }else{
  for(const prior of observationTasks(e))if(prior.status==='submitted'&&hasObservation(prior)&&!prior.observationEndedAt)prior.observationEndedAt=at
  for(const prior of e.tasks){
   settleTaskAnalysis(prior,'事件已闭环')
   if(prior.status==='waiting'||prior.status==='assigned'||(prior.status==='submitted'&&taskExecution(prior).incomplete)){prior.status='terminated';prior.goalStatus='terminated';prior.terminatedAt=at;prior.terminationReason=form.remainingDisposition||form.reason}
  }
  e.status='已闭环';phase(e,'closed','闭环归档');e.closedAt=at;e.closeReason=form.reason;e.unread.captain=false
  say(e,'captain','user',`${action==='false'?'确认误报':'关闭闭环'}：${form.reason}`)
  advice(e,'captain',`${eventSubject(e).name}已闭环，处置记录已归档。`,'')
  const closureReport=makeClosureReport(e,action,form.reason,at);closureReport.confirmedDraft=closure;closureReport.markdown='# '+closureReport.title+'\n\n'+Object.entries({闭环结论:closure.conclusion,确认依据:closure.evidence,处置过程:closure.process,未验证边界:closure.boundary}).map(([label,text])=>'## '+label+'\n\n'+text).join('\n\n');closureReport.markdown+='\n\n## 关联原事件与完整处置记录\n\n'+makeClosureReport(e,action,form.reason,at).markdown.replace(/^# [^\n]+/, '');e.reports.push(closureReport)
  if(e.participants.length){advice(e,'engineer','轮机长已确认本事件闭环。',form.reason);e.unread.engineer=true;notify(state,e,'engineer','轮机长已确认闭环',e.title+'：'+form.reason)}
 }
 const reviewed=e.tasks.find(t=>t.id===e.phases.find(p=>p.id===sourcePhaseId)?.taskId)
 if(action!=='shore'&&reviewed?.status==='submitted'){reviewed.reviewedAt=at;reviewed.goalStatus=taskExecution(reviewed).incomplete?'unresolved':'completed'}
 e.decisions.push({id:uid('decision'),action,reason:form.reason,...(form.evidence?.trim()?{evidence:form.evidence.trim()}:{}),at,owner:actor(state),taskId:e.currentTask,sourcePhaseId,resultPhaseId:e.phases.at(-1)?.id})
 if(['close','false'].includes(action)&&isObservationEvent(e))closeObservationChain(state,e)
}
export function beginTaskReport(state,id,taskId,requestId){
 const event=state.events[id],task=event&&currentTask(event)
 required(ownsTask(state.role,task)&&task?.id===taskId&&['assigned','report-error'].includes(task.status),'本任务正在生成报告、已提交或不属于当前人员。')
 let report
 if(task.status==='assigned')report=submitTask(state,id,taskId)
 else report=event.reports.find(r=>r.id===task.reportGeneration?.factReportId)
 required(report,'未找到正式提交的现场事实。')
 task.status='reporting';task.reportGeneration={requestId,factReportId:report.id,status:'streaming',progress:{label:'现场事实已回交，正在生成 AI 分析'},patch:{summary:'',analysis:{}},error:''}
 return task
}
// Pure handoff reducer. The UI supplies a validated model result after streaming;
// historical fixtures can still be reconstructed without a network request.
export function submitTask(state,id,taskId,generation){
 required(capabilities[state.role]?.execute,'当前人员没有执行反馈权限。')
 const e=state.events[id];required(e,'未找到事件。');const task=currentTask(e)
 required(!taskId||task?.id===taskId,'本任务已结束或不是当前执行任务，请查看本任务记录。')
 if(generation){required(task?.status==='reporting'&&task.reportGeneration?.requestId===generation.requestId,'报告生成状态已变化，本次结果未写入。');validateGeneratedReport(generation.patch);task.generatedReport=copy({...generation,at:new Date().toISOString()})}
 required(ownsTask(state.role,task)&&(generation?task.status==='reporting':task.status==='assigned'),'本任务已提交或不属于当前人员。')
 if(!generation){
 const draft=task.draft
 required(draft.records.length===task.steps.length&&draft.records.every((r,i)=>task.steps[i].options.includes(r.result)),'请为每个步骤选择实际结果；备注可以不填。')
 task.records=copy(draft.records);task.summarySource=draft.summary?.trim()?'executor':'records';task.summary=draft.summary?.trim()||taskRecordSummary(draft.records);task.attachments=copy(draft.attachments);task.submittedAt=new Date().toISOString();task.status='submitted'
 }
 task.status='submitted'
 if(generation){
  task.reportGeneration.status='complete'
  const original=e.reports.find(r=>r.id===task.reportGeneration.factReportId)
  if(original){const enriched=makeReport(e,task,original.id);Object.assign(original,enriched,{submissionNumber:original.submissionNumber,submissionSnapshot:original.submissionSnapshot,aiGeneratedAt:new Date().toISOString()});return original}
 }
 const report=makeReport(e,task);e.reports.push(report)
 task.goalStatus=taskExecution(task).incomplete?'unresolved':'completed'
 task.conversations||={captain:[],engineer:[]}
 if(!generation)(task.conversations[state.role]||=[]).push({id:uid('message'),kind:'user',title:'本轮反馈已提交',text:task.summary,at:task.submittedAt})
 ;(task.conversations[state.role]||=[]).push({id:uid('message'),kind:'receipt',title:'反馈已收录，等待轮机长审阅',text:'本轮记录已提交，待轮机长审阅。',reportId:report.id,at:task.submittedAt})
 const needsDecision=task.kind==='investigation'&&!(task.purpose==='recheck'&&!hasAbnormalFindings(task))
 phase(e,needsDecision?'decision':'review',`${needsDecision?'排查后决策':'结果处置'} · 第${report.submissionNumber}次`,{taskId:task.id,reportId:report.id});e.status=needsDecision?'待决策':'待结果处置';e.unread.captain=true;e.unread.engineer=false
 notify(state,e,'captain',report.kind+'已回交，待您决策',`${task.owner}已提交“${e.title}”的${report.kind}。${report.summary}`)
 say(e,state.role,'receipt',`报告编号：${report.number}。`,{reportId:report.id,title:report.kind+'已提交'})
 advice(e,state.role,`本轮已回交${task.records.length}项结果，待轮机长审阅。`,'')
 say(e,'captain','receipt',`${task.owner}已提交${report.kind}，共${task.records.length}项结果。`,{reportId:report.id,title:'AI检修助手 · 执行结果回交'})
 const recommendation=taskRecommendation(e,task)
 advice(e,'captain',recommendation.reason+'；'+recommendation.next,'')
 return report
}
export function askAssistant(state,id,text,{skipUser=false}={}){
 const e=state.events[id],role=state.role;required(text.trim(),'请先输入问题。');if(!skipUser)say(e,role,'user',text.trim())
 const report=e.reports.at(-1),task=currentTask(e)
 let analysis=report?`${report.kind}中的已提交结论：${report.summary}`:e.brief.conclusion
 let recommendation=role==='captain'?(pendingDecision(e)?'请结合已有依据选择处置方式，并明确负责人、范围和完成时间。':'当前任务由'+task?.owner+'负责，要求完成时间为'+timeText(task?.deadline)+'，提交后将生成报告供您处置。'):(activeTask(e)?'请按当前步骤记录实际结果；如果原因还未确定，可以选“无法确认”并在结论中说明缺口。':'本轮已提交，等待轮机长安排后续任务。')
 if(/为什么|依据|原因/.test(text))recommendation='请重点核对：'+(report?.analysis||e.brief.boundary)+' 哪项现场检查还需要补充？'
 if(/维修|更换|修理/.test(text))recommendation=e.tracking?'本事件按异动跟踪处理。现场核实异动后，轮机长可选择维保计划及靠港时间安排提前维保。':'维修范围需由轮机长依据排查报告批准。请说明异常的具体部位、损伤或动作表现，以及对应检查记录。'
 advice(e,role,analysis,recommendation)
}

export function resumeOwnTask(state,eventId,taskId,{reason,unchanged=true}={}){
 const event=state.events[eventId],task=event?.tasks.find(t=>t.id===taskId)
 required(ownsTask(state.role,task)&&task.status==='waiting'&&event.currentTask===taskId,'只有原执行人可确认本任务的等待条件。')
 required(reason?.trim(),'请记录现场核对结果。')
 const at=new Date().toISOString()
 if(!unchanged){task.waiting.reviewRequested={at,reason,owner:actor(state)};event.unread.captain=true;return}
 required(task.waiting.resumeApproved,'原等待安排尚未授权条件具备后继续，请由轮机长确认。')
 task.feedbackHistory||=[];task.feedbackHistory.push({at:task.submittedAt,reportId:event.reports.findLast(r=>r.taskId===task.id)?.id,draft:{records:copy(task.records),summary:task.summary}})
 task.draft={records:copy(task.records),summary:task.summarySource==='records'?'':task.summary,attachments:copy(task.attachments||[])}
 task.status='assigned';task.resumedAt=at;task.waiting={...task.waiting,resumedAt:at,resumeReason:reason,confirmedBy:actor(state),reviewRequested:null}
 delete task.generatedReport;delete task.reportGeneration;delete task.observation
 event.phase=task.kind;event.status='任务执行中';event.unread.captain=false
}
