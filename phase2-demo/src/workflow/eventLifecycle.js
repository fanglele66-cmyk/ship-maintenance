import {submissionNumber,submissionTitle,submissionSnapshot,refreshSubmissionLabels,reportTask,taskReports,reportContextVersion} from './reportSubmissions.js'
import {workflowCases, workflowIssues, composeRepair} from '../mock/fourStoryWorkflow.js'
import {eventBriefingFor} from '../mock/eventBriefings.js'
import {trackingProcessReference} from '../mock/trackingProcessReferences.js'
import {adviceDetails,reportAnalysis,reportAnalysisSummary,trackingAssessment} from './lifecycleAnalysis.js'
import {lifecycleDecisionOptions,dispatchAction,hasAbnormalFindings,confirmedTracking,taskName} from './lifecycleDecisions.js'
import {maintenancePlans,maintenanceSelection} from './maintenancePlans.js'
import {generatedAnalysis,validateGeneratedReport} from './generatedReport.js'
import {ensurePlanDraft,taskPlanKey} from './taskPlanning.js'
import {detailedRepairSteps,presetRecheckSteps,repairProcedureVersion} from './repairPlanning.js'
import {closureContent,closurePresentationVersion} from './closureReport.js'
import {groupRepairSteps,compactAssignedRepair} from './repairStepGroups.js'
import {hasObservation,observationStart,observationTaskFor,isVerificationObservation,isVerificationReview,observationPolicy} from './observationContext.js'
import {taskExecution,executionFacts,carryForwardSteps} from './taskExecution.js'
export {hasAbnormalFindings,taskName} from './lifecycleDecisions.js'

export const people = {captain:'陈志远（轮机长）',engineer:'李建国（大管轮）'}
export const eventNumbers = {'real-alarm-0430':'CBY-EVT-20260430-001','real-warning-0523':'CBY-EVT-20260523-001','real-tracking-exhaust-baseline':'CBY-EVT-20260812-001','real-health-c4-baseline':'CBY-EVT-20260812-002'}
export const stageNames = {reminder:'风险提醒',investigation:'原因排查',decision:'处置决策',repair:'维修执行',maintenance:'关联维保',review:'结果处置',closed:'闭环归档'}
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
 return {id:item.id,title:item.title,type:item.id==='real-warning-0523'?'预警事件':item.type,device:item.device,createdAt,tracking:item.type==='异动跟踪',brief:copy(brief),status:'待决策',phase:'reminder',currentTask:null,participants:[],tasks:[],reports:[],decisions:[],shore:[],maintenance:null,
  number:eventNumbers[item.id],phases:[{id:'reminder',kind:'reminder',label:'风险提醒',at:brief?.discovery.at}],conversations:{captain:[],engineer:[]},unread:{captain:true,engineer:false}}
}
function say(event,role,kind,text,extra={}){const message={id:uid('message'),kind,text,at:new Date().toISOString(),...extra};event.conversations[role].push(message);return message}
function notify(state,event,recipient,title,text){
 (state.notices||(state.notices=[])).push({id:uid('notice'),eventId:event.id,recipient,title,text,at:new Date().toISOString(),read:false})
}
function advice(event,role,analysis,recommendation,at){
 const message=say(event,role,'advice','',{analysis,recommendation,animate:!at,...(at?{at}: {})})
 message.detailsMarkdown=adviceDetails(event,message,role);message.basisVersion=3;message.basisLabel='分析过程与依据'
 return message
}
function phase(event,kind,label,extra={}){const p={id:uid(kind),kind,label:label||stageNames[kind],at:new Date().toISOString(),...extra};event.phases.push(p);event.phase=kind;return p}
export function createLifecycleState(){
 const events=Object.fromEntries(workflowIssues.filter(item=>!item.latent).map(item=>[item.id,newEvent(item,{createdAt:eventBriefingFor(item.id)?.discovery.at})]))
 for(const e of Object.values(events))advice(e,'captain',e.brief.conclusion,'请核对提醒依据，指定排查负责人和完成时限；有明确依据时可登记误报。',e.brief.discovery.at)
 // Retain the complete earlier C4 investigation, including its handoff report.
 const e=events['real-health-c4-baseline'],prior=trackingProcessReference(e.id)
 if(prior){
  const at='2026-08-12T04:15:00.000Z',task={id:uid('investigation'),kind:'investigation',round:1,owner:people.engineer,deadline:'2026-08-12T16:00',scope:prior.records[0].text,assignedAt:at,steps:prior.feedback.map(r=>({label:r.label,guide:r.note,options:[r.result]})),records:copy(prior.feedback),summary:prior.summary,submittedAt:'2026-08-12T06:20:00.000Z',status:'submitted'}
  e.tasks.push(task);e.currentTask=task.id;e.participants.push(people.engineer)
  e.phases.push({id:task.id,kind:'investigation',label:'第1轮排查',at,taskId:task.id})
  say(e,'captain','user',`已派发排查给${task.owner}。${task.scope}`,{at});advice(e,'engineer',task.scope,'请提交已核实范围、现场发现和资料缺口。',at)
  const report=makeReport(e,task);e.reports.push(report)
 task.goalStatus=taskExecution(task).incomplete?'unresolved':'awaiting-review'
 task.conversations||={captain:[],engineer:[]}
 task.conversations.engineer.push({id:uid('message'),kind:'user',title:'本轮反馈已提交',text:task.summary,at:task.submittedAt},{id:uid('message'),kind:'receipt',title:'反馈已收录，等待轮机长审阅',text:'本次逐项记录及汇总结论已归入关联事件。可继续补充本任务报告；提交不代表事件闭环或效果验证通过。',reportId:report.id,at:task.submittedAt})
  say(e,'engineer','receipt',prior.summary,{at:task.submittedAt,reportId:report.id,title:'排查报告已提交'})
  advice(e,'captain',prior.summary,'请补充排查独立测温与历史调整依据，或明确范围后关联维保单。',task.submittedAt)
  e.phases.push({id:uid('decision'),kind:'decision',label:'排查后决策',at:task.submittedAt,taskId:task.id,reportId:report.id});e.phase='decision';e.status='待处置决策'
 }
 return {version:1,role:'captain',events,notices:[]}
}
export function currentTask(event){return event.tasks.find(t=>t.id===event.currentTask)}
export function pendingDecision(event){return ['reminder','decision','review'].includes(event.phase)&&!event.phases.at(-1)?.observationWaiting&&currentTask(event)?.status!=='waiting'}
export function visibleEvents(state){return Object.values(state.events).filter(e=>state.role==='captain'||e.participants.includes(people.engineer))}
export function activeTask(event){const t=currentTask(event);return t?.status==='assigned'?t:null}
export const decisionOptions=lifecycleDecisionOptions
export function ensureTaskPlan(event){
 const action=dispatchAction(event);if(!action)return null
 const report=event.reports.at(-1),prior=currentTask(event)
 const steps=action==='investigate'?checkSteps(event.id):action==='maintenance'?maintenancePlan(event):action==='repair'?proposedPlan(event):presetRecheckSteps(event)
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
 const investigation=[...event.tasks].reverse().find(t=>t.kind==='investigation'&&t.status==='submitted')
 if(!investigation)return []
 const keys=[...new Set(investigation.records.filter(r=>r.result==='发现异常').map(r=>r.package).filter(Boolean))]
 const data=workflowCases[event.id]
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
 const markdown=`# ${title}\n\n- 事件类型：${event.type}\n- 负责人：${task.owner}\n- 提交时间：${timeText(task.submittedAt)}\n\n## ${task.kind==='investigation'?'检查结果摘要':'处理结果与剩余事项'}\n\n${generated?.patch.summary||task.summary}\n\n${executionFacts(task)}\n\n## AI分析与建议（不作为现场事实）\n\n${analysisMarkdown}\n\n## 任务安排与批准范围\n\n- 派发时间：${timeText(task.assignedAt)}\n- 要求完成：${timeText(task.deadline)}\n\n${task.scope}${priorRows?'\n\n'+priorRows:''}\n\n${task.attachments?.length?'## 附件索引\n\n'+task.attachments.map(a=>'- '+a.name).join('\n'):'## 附件索引\n\n本轮未关联附件。'}`
 const maintenanceText=task.maintenance?`\n\n## 提前维保安排\n\n- 维保计划：${task.maintenance.plan.id} · ${task.maintenance.plan.title}\n- 计划版本：${task.maintenance.plan.revision}\n- 关联正式工单：${task.maintenance.plan.workOrder?.number||'未关联'} · ${task.maintenance.plan.workOrder?.status||'待核实'}\n- 工单状态独立管理，本次报告不自动确认正式工单完工。\n- 靠港时间：${task.maintenance.window.label}\n- 执行方式：按选定维保计划提前执行，实际措施见逐项记录。`:''
 return {id,title,kind,submissionNumber:number,submissionSnapshot:submissionSnapshot(task),analysisContextVersion:reportContextVersion,taskId:task.id,eventId:event.id,eventNumber:event.number,owner:task.owner,at:task.submittedAt,markdown:markdown.replace('- 事件类型：','- 事件编号：'+event.number+'\n- 事件类型：')+maintenanceText+(generated?'\n\n## 执行人原始汇总\n\n'+task.summary:''),analysis,analysisMarkdown,summary:generated?.patch.summary||task.summary,presentationVersion:5,...(generated?{generatedBy:generated.model,usage:generated.usage,sources:generated.sources,generatedAt:generated.at}:{})}
}
export function refreshLifecyclePresentation(state){
 for(const event of Object.values(state.events)){
  event.number=eventNumbers[event.id]||event.number
  if(event.id==='real-warning-0523'){event.type='预警事件';event.brief.discovery.kind='ai-warning';event.brief.discovery.label='AI预警 → 关联研判'}
  for(const task of event.tasks)compactAssignedRepair(task)
  if(['repair','maintenance'].includes(event.pendingPlan?.action)&&event.pendingPlan.steps.length>4){event.pendingPlan.steps=groupRepairSteps(event.pendingPlan.steps);event.pendingPlan.version++}
  for(const task of event.tasks)if(hasObservation(task)&&task.status==='submitted'&&!task.observationEndedAt){const next=event.tasks.find(t=>Date.parse(t.assignedAt)>Date.parse(task.observationResumedAt||observationStart(task)));task.observationEndedAt=next?.assignedAt||event.closedAt||null}
  refreshSubmissionLabels(event)
  for(const report of event.reports){
   const task=reportTask(event,report)
   // Refresh only built-in presentation; preserve model output and human revisions.
   if(task?.status==='submitted'&&taskReports(event,task.id).length===1&&report.presentationVersion!==5&&!report.generatedBy&&!task.generatedReport&&!report.revisions?.length&&!report.original){
    const oldAnalysis=report.analysis;Object.assign(report,makeReport(event,task,report.id))
    for(const messages of Object.values(event.conversations))for(const message of messages)if(message.kind==='advice'&&message.analysis===oldAnalysis){message.analysis=report.analysis;if(event.tracking&&task.kind==='investigation')message.recommendation=trackingAssessment(event,task).next}
   }
  }
  for(const report of event.reports)if(report.kind==='闭环报告'&&report.presentationVersion!==closurePresentationVersion){const decision=event.decisions.findLast(d=>['close','false'].includes(d.action));Object.assign(report,makeClosureReport(event,decision?.action||'close',report.summary,report.at,report.id))}
  for(const role of ['captain','engineer'])for(const message of event.conversations[role])if(message.kind==='advice'&&message.basisVersion!==3){message.detailsMarkdown=adviceDetails(event,message,role);message.basisVersion=3;message.basisLabel='分析过程与依据'}
 }
 return state
}
export function makeClosureReport(event,action,reason,at,id=uid('report')){
 return {id,kind:'闭环报告',title:event.title+' · 闭环报告',eventId:event.id,eventNumber:event.number,owner:people.captain,at,summary:reason,...closureContent(event,action,reason,at,people.captain)}
}

export function analyzeFindings(task){
 const abnormal=task.records.filter(r=>['发现异常','读数不一致','工况可比，偏离仍存在'].includes(r.result))
 const unknown=task.records.filter(r=>/无法确认|受限/.test(r.result))
 return `${abnormal.length?'现场反馈指出：'+abnormal.map(r=>r.label+(r.note?'（'+r.note+'）':'')).join('；')+'。':'本轮逐项核实记录已回交，原提醒是否成立及其解释以提交结论为准。'}${unknown.length?'尚待补充：'+unknown.map(r=>r.label).join('、')+'。':''} ${task.summary} 请由轮机长对照原提醒、已核实范围和剩余事项决定下一步。`
}
export function decide(state,id,form){
 required(state.role==='captain','只有轮机长可以做出处置决定。')
 const e=state.events[id];required(e,'未找到事件。')
 required(decisionOptions(e).some(x=>x.value===form.action),'当前阶段不能执行此决定，请核对最新任务状态。')
 required(form.reason?.trim(),'请填写决定依据或本次安排。')
 const at=new Date().toISOString(),action=form.action,sourcePhaseId=e.phases.at(-1)?.id
 if(['investigate','repair','maintenance','recheck'].includes(action)){
  required(form.owner===people.engineer,'请选择任务负责人。')
  required(Number.isFinite(Date.parse(form.deadline))&&Date.parse(form.deadline)>Date.now(),'要求完成时间应晚于当前时间。')
  const selectedMaintenance=action==='maintenance'?maintenanceSelection(e,form):null
  if(selectedMaintenance){e.decisionDraft||={};e.decisionDraft.maintenancePlanId=selectedMaintenance.plan.id}
  const plan=ensureTaskPlan(e)
  required(plan?.key===taskPlanKey(e)&&plan.status==='ready'&&plan.steps.length,'待派任务尚未生成完成，请先查看任务草稿。')
  for(const prior of e.tasks)if(prior.status==='submitted'&&hasObservation(prior)&&!prior.observationEndedAt)prior.observationEndedAt=at
  const kind=['investigate','recheck'].includes(action)?'investigation':action
  const round=e.tasks.filter(t=>t.kind===kind).length+1
  const task={id:uid(kind),kind,procedureVersion:repairProcedureVersion,purpose:action==='recheck'?'recheck':kind,round,owner:form.owner,deadline:form.deadline,scope:form.reason.trim(),assignedAt:at,status:'assigned',steps:copy(plan.steps),plan:copy(plan),records:[],summary:'',attachments:[],sourceReportId:plan.sourceReportId}
  if(selectedMaintenance)task.maintenance=selectedMaintenance
  task.draft={records:task.steps.map(t=>({label:t.label,package:t.package,result:'',note:''})),summary:'',attachments:[]}
  task.assignedBy=people.captain
  task.number=`${e.number.replace('EVT','TSK')}-${String(e.tasks.length+1).padStart(2,'0')}`
  task.title=`第${round}轮${taskName(task)}任务 · ${task.steps[0].short||task.steps[0].label}`
  if(selectedMaintenance)task.title='提前维保 · '+selectedMaintenance.plan.title
  e.tasks.push(task);e.currentTask=task.id
  if(!e.participants.includes(task.owner))e.participants.push(task.owner)
  const p=phase(e,kind,`第${round}轮${taskName(task)}`,{taskId:task.id});p.id=task.id
  e.status=task.purpose==='recheck'?'复查中':kind==='investigation'?'排查中':kind==='repair'?'维修中':'维保执行中'
  if(kind==='maintenance')e.maintenance={number:selectedMaintenance.plan.id,window:selectedMaintenance.window.label,owner:form.owner,scope:task.scope,at,taskId:task.id,...copy(selectedMaintenance)}
  e.unread.engineer=true;e.unread.captain=false
  notify(state,e,'engineer',`收到新的${taskName(task)}任务`,`${people.captain}已派发“${e.title}”，要求 ${timeText(task.deadline)} 前完成。`)
  say(e,'captain','user',`派发${taskName(task)} · ${task.owner} · 要求 ${timeText(task.deadline)} 前完成。\n${task.scope}`)
  advice(e,'captain','任务已派发，当前等待执行人员提交报告。','可以在当前阶段查看排查/作业步骤及提交进度；报告回交后继续作出处置决定。')
  advice(e,'engineer',`轮机长已派发${taskName(task)}任务：${task.scope}`,kind==='investigation'?'先查看数据，再逐项核查；记录原因、依据及未确认项，提交排查报告。':'按已批准范围逐项执行，填写实际措施和复测结果，完成后提交报告给轮机长。')
 }else if(action==='wait'){
  const task=currentTask(e)
  required(task?.status==='submitted'&&taskExecution(task).incomplete,'只有存在未完成或受阻项目的任务可以等待条件。')
  task.status='waiting';task.goalStatus='unresolved';task.waiting={reason:form.reason,at};task.observationEndedAt=at
  e.status='等待执行条件';e.unread.captain=false
  say(e,'captain','user','保留原任务，等待条件：'+form.reason)
  task.conversations||={captain:[],engineer:[]}
  task.conversations.engineer.push({id:uid('message'),kind:'receipt',title:'等待执行条件',text:form.reason+' 已完成的步骤和阶段报告保留，条件具备后恢复原任务。',at})
 }else if(action==='resume'){
  const task=currentTask(e)
  required(task?.status==='waiting','当前任务不在等待条件状态。')
  required(Number.isFinite(Date.parse(form.deadline))&&Date.parse(form.deadline)>Date.now(),'请设置恢复执行后的完成时限。')
  task.feedbackHistory||=[];task.feedbackHistory.push({at:task.submittedAt,observation:task.observation?copy(task.observation):null,reportId:e.reports.findLast(r=>r.taskId===task.id)?.id,draft:{records:copy(task.records),summary:task.summary}})
  task.draft={records:copy(task.records),summary:task.summary,attachments:copy(task.attachments||[])}
  task.status='assigned';task.deadline=form.deadline;task.resumedAt=at;task.waiting={...task.waiting,resumedAt:at,resumeReason:form.reason}
  delete task.generatedReport;delete task.reportGeneration;delete task.observation;delete task.observationEndedAt;delete task.observationStartedAt;delete task.observationMode
  phase(e,task.kind,'恢复原任务',{taskId:task.id});e.status='任务执行中';e.unread.engineer=true;e.unread.captain=false
  say(e,'captain','user','条件已确认，恢复原任务：'+form.reason)
 }else if(action==='terminate'){
  const task=currentTask(e)
  required(task&&['waiting','submitted'].includes(task.status),'当前任务不能终止。')
  task.status='terminated';task.goalStatus='terminated';task.terminatedAt=at;task.terminationReason=form.reason;task.observationEndedAt=at
  phase(e,'review','未执行部分已终止',{taskId:task.id,reportId:e.reports.findLast(r=>r.taskId===task.id)?.id});e.status='待后续决策'
  say(e,'captain','user','终止未执行部分：'+form.reason+'；事件仍保留，需单独作出后续决定。')
 }else if(action==='observe'){
  const task=currentTask(e),work=e.phase==='decision'&&task?.purpose!=='recheck'?task:observationTaskFor(e)||task
  required(work?.status==='submitted'&&work.submittedAt,'尚无已提交的现场核实或作业报告，不能开始观察。')
  if(work.kind==='investigation'&&!work.observationStartedAt){work.observationMode='verification';work.observationStartedAt=at}
  if(work.observationEndedAt){work.observationResumedAt=at;work.observationEndedAt=null}
  const interval=observationPolicy(e).intervalMs,start=Date.parse(observationStart(work)),elapsed=Math.max(0,Date.parse(at)-start),dueAt=new Date(start+(Math.floor(elapsed/interval)+1)*interval).toISOString()
  phase(e,'review',isVerificationObservation(work)?'核实后继续观察':'效果观察',{taskId:task.id,reportId:e.reports.findLast(r=>r.taskId===task.id)?.id,observationWaiting:true,observationIntervalMs:interval,observationDueAt:dueAt,observationTaskId:work.id})
  e.status='效果观察中';e.unread.captain=false
  say(e,'captain','user',(isVerificationObservation(work)?'核实后继续观察：':'进入效果观察：')+form.reason)
  advice(e,'captain',`本轮由系统继续观察，下一次汇总时间为 ${timeText(dueAt)}。`,'观察期间没有新的人员执行任务；本阶段结束后再提醒您审阅结果。')
 }else if(action==='shore'){
  const record={id:uid('shore'),at,reason:form.reason,reportId:e.reports.at(-1)?.id||null,status:'待岸基接收',packet:copy({eventId:e.id,number:e.number,title:e.title,type:e.type,device:e.device,phase:e.phase,status:e.status,brief:e.brief,tasks:e.tasks,reports:e.reports,decisions:e.decisions,at})};e.shore.push(record)
  say(e,'captain','user','提交岸基同步：'+form.reason);advice(e,'captain','已整理事件及关联报告，加入岸基同步记录。',e.phase==='closed'?'当前状态为待岸基接收，事件保持已闭环，闭环报告与处置记录已保留。':'当前状态为待岸基接收，可继续处理船上任务。')
 }else{
  for(const prior of e.tasks)if(prior.status==='submitted'&&hasObservation(prior)&&!prior.observationEndedAt)prior.observationEndedAt=at
  e.status='已闭环';phase(e,'closed','闭环归档');e.closedAt=at;e.closeReason=form.reason;e.unread.captain=false
  say(e,'captain','user',`${action==='false'?'确认误报':'关闭闭环'}：${form.reason}`)
  advice(e,'captain','本事件已按本次决定归档，排查及作业报告保留。','后续如出现新的提醒，请依据新的运行窗口再行核查。')
  e.reports.push(makeClosureReport(e,action,form.reason,at))
  if(e.participants.length){advice(e,'engineer','轮机长已确认本事件闭环。',form.reason);e.unread.engineer=true;notify(state,e,'engineer','轮机长已确认闭环',e.title+'：'+form.reason)}
 }
 const reviewed=e.tasks.find(t=>t.id===e.phases.find(p=>p.id===sourcePhaseId)?.taskId)
 if(action!=='shore'&&reviewed?.status==='submitted'){reviewed.reviewedAt=at;reviewed.goalStatus=taskExecution(reviewed).incomplete?'unresolved':'completed'}
 e.decisions.push({id:uid('decision'),action,reason:form.reason,at,owner:people.captain,taskId:e.currentTask,sourcePhaseId,resultPhaseId:e.phases.at(-1)?.id})
}
export function beginTaskReport(state,id,taskId,requestId){
 required(state.role==='engineer','请在大管轮视角提交执行反馈。')
 const event=state.events[id],task=event&&currentTask(event)
 required(task?.id===taskId&&task.owner===people.engineer&&['assigned','report-error'].includes(task.status),'本任务正在生成报告、已提交或不属于当前人员。')
 if(task.status==='assigned'){
  const draft=task.draft
  required(draft.records.length===task.steps.length&&draft.records.every((r,i)=>task.steps[i].options.includes(r.result)),'请为每个步骤选择实际结果；备注可以不填。')
  required(draft.summary?.trim(),'请填写本轮结论及仍需核实的事项。')
  task.records=copy(draft.records);task.summary=draft.summary.trim();task.attachments=copy(draft.attachments);task.submittedAt=new Date().toISOString()
  task.conversations||={captain:[],engineer:[]}
  task.conversations.engineer.push({id:uid('message'),kind:'user',title:'本轮反馈已提交',text:task.summary,at:task.submittedAt})
 }
 task.status='reporting';task.reportGeneration={requestId,status:'streaming',progress:{label:'正在整理本次反馈'},patch:{summary:'',analysis:{}},error:''}
 event.status='报告生成中'
 return task
}
// Pure handoff reducer. The UI supplies a validated model result after streaming;
// historical fixtures can still be reconstructed without a network request.
export function submitTask(state,id,taskId,generation){
 required(state.role==='engineer','请在大管轮视角提交执行反馈。')
 const e=state.events[id];required(e,'未找到事件。');const task=currentTask(e)
 required(!taskId||task?.id===taskId,'本任务已结束或不是当前执行任务，请查看本任务记录。')
 if(generation){required(task?.status==='reporting'&&task.reportGeneration?.requestId===generation.requestId,'报告生成状态已变化，本次结果未写入。');validateGeneratedReport(generation.patch);task.generatedReport=copy({...generation,at:new Date().toISOString()})}
 required(task?.owner===people.engineer&&(generation?task.status==='reporting':task.status==='assigned'),'本任务已提交或不属于当前人员。')
 if(!generation){
 const draft=task.draft
 required(draft.records.length===task.steps.length&&draft.records.every((r,i)=>task.steps[i].options.includes(r.result)),'请为每个步骤选择实际结果；备注可以不填。')
 required(draft.summary?.trim(),task.kind==='investigation'?'请填写原因判断、排查结论及仍需核实的事项。':'请填写实际措施、复测结果及剩余事项。')
 task.records=copy(draft.records);task.summary=draft.summary.trim();task.attachments=copy(draft.attachments);task.submittedAt=new Date().toISOString();task.status='submitted'
 }
 task.status='submitted'
 if(generation)task.reportGeneration.status='complete'
 const report=makeReport(e,task);e.reports.push(report)
 task.goalStatus=taskExecution(task).incomplete?'unresolved':'awaiting-review'
 task.conversations||={captain:[],engineer:[]}
 if(!generation)task.conversations.engineer.push({id:uid('message'),kind:'user',title:'本轮反馈已提交',text:task.summary,at:task.submittedAt})
 task.conversations.engineer.push({id:uid('message'),kind:'receipt',title:'反馈已收录，等待轮机长审阅',text:'本次逐项记录及汇总结论已归入关联事件。可继续补充本任务报告；提交不代表事件闭环或效果验证通过。',reportId:report.id,at:task.submittedAt})
 const needsDecision=task.kind==='investigation'&&!(task.purpose==='recheck'&&!hasAbnormalFindings(task))
 phase(e,needsDecision?'decision':'review',`${needsDecision?'排查后决策':'结果处置'} · 第${report.submissionNumber}次`,{taskId:task.id,reportId:report.id});e.status=needsDecision?'待处置决策':'待结果处置';e.unread.captain=true;e.unread.engineer=false
 notify(state,e,'captain',report.kind+'已回交，待您决策',`${task.owner}已提交“${e.title}”的${report.kind}。${report.summary}`)
 say(e,'engineer','receipt',report.summary,{reportId:report.id,title:report.kind+'已提交'})
 advice(e,'engineer',report.analysis,'本轮记录已形成'+report.kind+'并交轮机长处置。如发现遗漏，可在会话补充说明；新的排查或作业安排由轮机长派发。')
 say(e,'captain','receipt',`${task.owner}已提交${report.kind}。${report.summary}`,{reportId:report.id,title:'AI检修助手 · 执行结果回交'})
 advice(e,'captain',report.analysis,e.phase==='review'?'请结合本轮作业反馈与复测记录决定下一步；选择派发复查后可审阅 AI 复查建议，确认派工才创建任务。':trackingAssessment(e,task)?.next||(hasAbnormalFindings(task)?'本轮记录了具体异常表现，请核对定位与处理依据。选择派发维修后审阅 AI 维修建议，明确范围再派工。':'本轮检查尚未定位原因，可选择继续排查、继续观察或说明结束依据后闭环；选定继续排查后，AI 再据剩余线索整理建议。'))
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
