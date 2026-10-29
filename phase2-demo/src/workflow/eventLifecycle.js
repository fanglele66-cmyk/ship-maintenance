import {workflowCases, workflowIssues, composeRepair} from '../mock/fourStoryWorkflow.js'
import {eventBriefingFor} from '../mock/eventBriefings.js'
import {trackingProcessReference} from '../mock/trackingProcessReferences.js'
import {adviceDetails,reportAnalysis,reportAnalysisSummary} from './lifecycleAnalysis.js'
import {lifecycleDecisionOptions,dispatchAction,hasAbnormalFindings,taskName} from './lifecycleDecisions.js'
import {ensurePlanDraft,taskPlanKey} from './taskPlanning.js'
import {detailedRepairSteps,presetRecheckSteps,upgradeAssignedRepair,repairProcedureVersion} from './repairPlanning.js'
import {closureContent,closurePresentationVersion} from './closureReport.js'
import {groupRepairSteps,compactAssignedRepair} from './repairStepGroups.js'
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
export function newEvent(item){
 const brief=eventBriefingFor(item.id)
 return {id:item.id,title:item.title,type:item.type,device:item.device,tracking:item.type==='异动跟踪',brief:copy(brief),status:'待决策',phase:'reminder',currentTask:null,participants:[],tasks:[],reports:[],decisions:[],shore:[],maintenance:null,
  number:eventNumbers[item.id],phases:[{id:'reminder',kind:'reminder',label:'风险提醒',at:brief?.discovery.at}],conversations:{captain:[],engineer:[]},unread:{captain:true,engineer:false}}
}
function say(event,role,kind,text,extra={}){const message={id:uid('message'),kind,text,at:new Date().toISOString(),...extra};event.conversations[role].push(message);return message}
function notify(state,event,recipient,title,text){
 (state.notices||(state.notices=[])).push({id:uid('notice'),eventId:event.id,recipient,title,text,at:new Date().toISOString(),read:false})
}
function advice(event,role,analysis,recommendation,at){
 const message=say(event,role,'advice','',{analysis,recommendation,animate:!at,...(at?{at}: {})})
 message.detailsMarkdown=adviceDetails(event,message,role);message.basisVersion=2;message.basisLabel='分析过程与依据'
 return message
}
function phase(event,kind,label,extra={}){const p={id:uid(kind),kind,label:label||stageNames[kind],at:new Date().toISOString(),...extra};event.phases.push(p);event.phase=kind;return p}
export function createLifecycleState(){
 const events=Object.fromEntries(workflowIssues.filter(item=>!item.latent).map(item=>[item.id,newEvent(item)]))
 for(const e of Object.values(events))advice(e,'captain',e.brief.conclusion,'请核对提醒依据，指定排查负责人和完成时限；有明确依据时可登记误报。',e.brief.discovery.at)
 // Retain the complete earlier C4 investigation, including its handoff report.
 const e=events['real-health-c4-baseline'],prior=trackingProcessReference(e.id)
 if(prior){
  const at='2026-08-12T04:15:00.000Z',task={id:uid('investigation'),kind:'investigation',round:1,owner:people.engineer,deadline:'2026-08-12T16:00',scope:prior.records[0].text,assignedAt:at,steps:prior.feedback.map(r=>({label:r.label,guide:r.note,options:[r.result]})),records:copy(prior.feedback),summary:prior.summary,submittedAt:'2026-08-12T06:20:00.000Z',status:'submitted'}
  e.tasks.push(task);e.currentTask=task.id;e.participants.push(people.engineer)
  e.phases.push({id:task.id,kind:'investigation',label:'第1轮排查',at,taskId:task.id})
  say(e,'captain','user',`已派发排查给${task.owner}。${task.scope}`,{at});advice(e,'engineer',task.scope,'请提交已核实范围、现场发现和资料缺口。',at)
  const report=makeReport(e,task);e.reports.push(report)
  say(e,'engineer','receipt',prior.summary,{at:task.submittedAt,reportId:report.id,title:'排查报告已提交'})
  advice(e,'captain',prior.summary,'请补充排查独立测温与历史调整依据，或明确范围后关联维保单。',task.submittedAt)
  e.phases.push({id:uid('decision'),kind:'decision',label:'排查后决策',at:task.submittedAt,taskId:task.id,reportId:report.id});e.phase='decision';e.status='待处置决策'
 }
 return {version:1,role:'captain',events,notices:[]}
}
export function currentTask(event){return event.tasks.find(t=>t.id===event.currentTask)}
export function pendingDecision(event){return ['reminder','decision','review'].includes(event.phase)}
export function visibleEvents(state){return Object.values(state.events).filter(e=>state.role==='captain'||e.participants.includes(people.engineer))}
export function activeTask(event){const t=currentTask(event);return t?.status==='assigned'?t:null}
export const decisionOptions=lifecycleDecisionOptions
export function ensureTaskPlan(event){
 const action=dispatchAction(event);if(!action)return null
 const report=event.reports.at(-1),prior=currentTask(event)
 const steps=action==='investigate'?checkSteps(event.id):action==='maintenance'?maintenancePlan(event):action==='repair'?proposedPlan(event):presetRecheckSteps(event)
 const scope=action==='recheck'?`依据${report?.title||'本轮作业报告'}，复核实际维修措施、剩余事项、修后数据和原异常是否再现，提交现场复查结果。`:action==='investigate'?event.brief.dispatchReason:`依据${report?.title||'现场记录'}，处理本轮登记的异常：${prior?.records.filter(r=>/发现异常|读数不一致|偏离仍存在/.test(r.result)).map(r=>r.label).join('、')||'已批准部位'}。保留实际措施、隔离与复测记录。`
 const draft=ensurePlanDraft(event,{steps,scope,procedureVersion:repairProcedureVersion,rationale:report?`依据《${report.title}》：${report.summary}`:event.brief.conclusion})
 if(action==='repair'&&draft.source==='existing'&&draft.procedureVersion!==repairProcedureVersion){draft.steps=steps;draft.procedureVersion=repairProcedureVersion;draft.version++}
 if(['repair','maintenance'].includes(action)&&draft.steps.length>4){draft.steps=groupRepairSteps(draft.steps);draft.version++}
 if(action==='recheck'&&!draft.steps.length){draft.steps=steps;draft.scope=scope;draft.source='preset'}
 return draft
}
const planClean=text=>String(text||'').replaceAll('提交验收','提交维修报告').replaceAll('提交现场验收','提交维修报告').replaceAll('验收通过后','轮机长确认后').replaceAll('现场验收','结果核对')
export function maintenancePlan(event){
 const id=event.id.includes('c4')?'real-maintenance-c4-baseline':'real-maintenance-c1-baseline'
 return copy(workflowCases[id].stages.find(s=>s.kind==='work').tasks).map(t=>({...t,guide:planClean(t.guide),checks:(t.checks||[]).map(planClean),options:['已完成','未完成','不适用']}))
}
export function proposedPlan(event){
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
 const id=reportId||uid('report'),title=`${event.title} · 第${task.round}轮${task.purpose==='recheck'?'复查报告':kind}`
 const priorRows=[...(task.procedureHistory||[]),...(task.feedbackHistory||[])].map(h=>'### 步骤调整前的原填写记录\n\n'+h.draft.records.filter(r=>r.result||r.note).map(r=>`- ${r.label} · ${r.result||'未选结果'}：${r.note||'未填备注'}`).join('\n')).join('\n\n')
 const rows=task.records.map(r=>`### ${r.label}\n\n结果：${r.result}\n\n${r.note||'未填写备注。'}`).join('\n\n')
 const analysis=reportAnalysisSummary(event,task),analysisMarkdown=reportAnalysis(event,task)
 const markdown=`# ${title}\n\n- 事件类型：${event.type}\n- 负责人：${task.owner}\n- 提交时间：${timeText(task.submittedAt)}\n\n## ${task.kind==='investigation'?'原因判断与排查结论':'处理结果与剩余事项'}\n\n${task.summary}\n\n## AI分析\n\n${analysisMarkdown}\n\n## 任务安排与批准范围\n\n- 派发时间：${timeText(task.assignedAt)}\n- 要求完成：${timeText(task.deadline)}\n\n${task.scope}\n\n## ${task.kind==='investigation'?'现场排查记录':'实际作业记录'}\n\n${rows}${priorRows?'\n\n'+priorRows:''}\n\n${task.attachments?.length?'## 附件索引\n\n'+task.attachments.map(a=>'- '+a.name).join('\n'):'## 附件索引\n\n本轮未关联附件。'}`
 return {id,title,kind,taskId:task.id,eventId:event.id,eventNumber:event.number,owner:task.owner,at:task.submittedAt,markdown:markdown.replace('- 事件类型：','- 事件编号：'+event.number+'\n- 事件类型：'),analysis,analysisMarkdown,summary:task.summary,presentationVersion:3}
}
export function refreshLifecyclePresentation(state){
 for(const event of Object.values(state.events)){
  event.number=eventNumbers[event.id]||event.number
  upgradeAssignedRepair(event,()=>proposedPlan(event))
  for(const task of event.tasks)compactAssignedRepair(task)
  if(['repair','maintenance'].includes(event.pendingPlan?.action)&&event.pendingPlan.steps.length>4){event.pendingPlan.steps=groupRepairSteps(event.pendingPlan.steps);event.pendingPlan.version++}
  for(const task of event.tasks)if(task.kind!=='investigation'&&task.status==='submitted'&&!task.observationEndedAt){const next=event.tasks.find(t=>Date.parse(t.assignedAt)>Date.parse(task.submittedAt));task.observationEndedAt=next?.assignedAt||event.closedAt||null}
  for(const report of event.reports){const task=event.tasks.find(t=>t.id===report.taskId);if(task?.status==='submitted'&&report.presentationVersion!==3)Object.assign(report,makeReport(event,task,report.id))}
  for(const report of event.reports)if(report.kind==='闭环报告'&&report.presentationVersion!==closurePresentationVersion){const decision=event.decisions.findLast(d=>['close','false'].includes(d.action));Object.assign(report,makeClosureReport(event,decision?.action||'close',report.summary,report.at,report.id))}
  for(const role of ['captain','engineer'])for(const message of event.conversations[role])if(message.kind==='advice'&&message.basisVersion!==2){message.detailsMarkdown=adviceDetails(event,message,role);message.basisVersion=2;message.basisLabel='分析过程与依据'}
 }
 return state
}
export function makeClosureReport(event,action,reason,at,id=uid('report')){
 return {id,kind:'闭环报告',title:event.title+' · 闭环报告',eventId:event.id,eventNumber:event.number,owner:people.captain,at,summary:reason,...closureContent(event,action,reason,at,people.captain)}
}

export function analyzeFindings(task){
 const abnormal=task.records.filter(r=>['发现异常','读数不一致','工况可比，偏离仍存在'].includes(r.result))
 const unknown=task.records.filter(r=>/无法确认|受限/.test(r.result))
 return `${abnormal.length?'现场反馈指出：'+abnormal.map(r=>r.label+(r.note?'（'+r.note+'）':'')).join('；')+'。':'本轮未登记明确的异常部件。'}${unknown.length?'尚待补充：'+unknown.map(r=>r.label).join('、')+'。':''} ${task.summary} 请由轮机长根据报告决定继续排查、${task.kind==='maintenance'?'后续维保':'安排处理'}或确认不影响设备安全后闭环。`
}
export function decide(state,id,form){
 required(state.role==='captain','只有轮机长可以做出处置决定。')
 const e=state.events[id];required(e,'未找到事件。')
 required(decisionOptions(e).some(x=>x.value===form.action),'当前阶段不能执行此决定，请核对最新任务状态。')
 required(form.reason?.trim(),'请填写决定依据或本次安排。')
 const at=new Date().toISOString(),action=form.action
 if(['investigate','repair','maintenance','recheck'].includes(action)){
  required(form.owner===people.engineer,'请选择任务负责人。')
  required(Number.isFinite(Date.parse(form.deadline))&&Date.parse(form.deadline)>Date.now(),'要求完成时间应晚于当前时间。')
  if(action==='maintenance')required(form.order?.trim()&&form.window?.trim(),'请选择维保工单及计划窗口。')
  const plan=ensureTaskPlan(e)
  required(plan?.key===taskPlanKey(e)&&plan.status==='ready'&&plan.steps.length,'待派任务尚未生成完成，请先查看任务草稿。')
  const prior=currentTask(e);if(prior?.status==='submitted'&&prior.kind!=='investigation')prior.observationEndedAt=at
  const kind=['investigate','recheck'].includes(action)?'investigation':action
  const round=e.tasks.filter(t=>t.kind===kind).length+1
  const task={id:uid(kind),kind,procedureVersion:repairProcedureVersion,purpose:action==='recheck'?'recheck':kind,round,owner:form.owner,deadline:form.deadline,scope:form.reason.trim(),assignedAt:at,status:'assigned',steps:copy(plan.steps),plan:copy(plan),records:[],summary:'',attachments:[],sourceReportId:plan.sourceReportId}
  task.draft={records:task.steps.map(t=>({label:t.label,package:t.package,result:'',note:''})),summary:'',attachments:[]}
  e.tasks.push(task);e.currentTask=task.id
  if(!e.participants.includes(task.owner))e.participants.push(task.owner)
  const p=phase(e,kind,`第${round}轮${taskName(task)}`,{taskId:task.id});p.id=task.id
  e.status=task.purpose==='recheck'?'复查中':kind==='investigation'?'排查中':kind==='repair'?'维修中':'维保执行中'
  if(kind==='maintenance')e.maintenance={number:form.order,window:form.window,owner:form.owner,scope:task.scope,at,taskId:task.id}
  e.unread.engineer=true;e.unread.captain=false
  notify(state,e,'engineer',`收到新的${taskName(task)}任务`,`${people.captain}已派发“${e.title}”，要求 ${timeText(task.deadline)} 前完成。`)
  say(e,'captain','user',`派发${taskName(task)} · ${task.owner} · 要求 ${timeText(task.deadline)} 前完成。\n${task.scope}`)
  advice(e,'captain','任务已派发，当前等待执行人员提交报告。','可以在当前阶段查看排查/作业步骤及提交进度；报告回交后继续作出处置决定。')
  advice(e,'engineer',`轮机长已派发${taskName(task)}任务：${task.scope}`,kind==='investigation'?'先查看数据，再逐项核查；记录原因、依据及未确认项，提交排查报告。':'按已批准范围逐项执行，填写实际措施和复测结果，完成后提交报告给轮机长。')
 }else if(action==='shore'){
  const record={id:uid('shore'),at,reason:form.reason,reportId:e.reports.at(-1)?.id||null,status:'待岸基接收',packet:copy({eventId:e.id,number:e.number,title:e.title,type:e.type,device:e.device,phase:e.phase,status:e.status,brief:e.brief,tasks:e.tasks,reports:e.reports,decisions:e.decisions,at})};e.shore.push(record)
  say(e,'captain','user','提交岸基同步：'+form.reason);advice(e,'captain','已整理事件及关联报告，加入岸基同步记录。',e.phase==='closed'?'当前状态为待岸基接收，事件保持已闭环，闭环报告与处置记录已保留。':'当前状态为待岸基接收，可继续处理船上任务。')
 }else{
  const prior=currentTask(e);if(prior?.status==='submitted'&&prior.kind!=='investigation')prior.observationEndedAt=at
  e.status='已闭环';phase(e,'closed','闭环归档');e.closedAt=at;e.closeReason=form.reason;e.unread.captain=false
  say(e,'captain','user',`${action==='false'?'确认误报':'关闭闭环'}：${form.reason}`)
  advice(e,'captain','本事件已按本次决定归档，排查及作业报告保留。','后续如出现新的提醒，请依据新的运行窗口再行核查。')
  e.reports.push(makeClosureReport(e,action,form.reason,at))
  if(e.participants.length){advice(e,'engineer','轮机长已确认本事件闭环。',form.reason);e.unread.engineer=true;notify(state,e,'engineer','轮机长已确认闭环',e.title+'：'+form.reason)}
 }
 e.decisions.push({id:uid('decision'),action,reason:form.reason,at,owner:people.captain,taskId:e.currentTask})
}
export function submitTask(state,id){
 required(state.role==='engineer','请在大管轮视角提交执行反馈。')
 const e=state.events[id],task=currentTask(e)
 required(task?.status==='assigned'&&task.owner===people.engineer,'本任务已提交或不属于当前人员。')
 const draft=task.draft
 required(draft.records.length===task.steps.length&&draft.records.every((r,i)=>task.steps[i].options.includes(r.result)),'请为每个步骤选择实际结果；备注可以不填。')
 required(draft.summary?.trim(),task.kind==='investigation'?'请填写原因判断、排查结论及仍需核实的事项。':'请填写实际措施、复测结果及剩余事项。')
 task.records=copy(draft.records);task.summary=draft.summary.trim();task.attachments=copy(draft.attachments);task.submittedAt=new Date().toISOString();task.status='submitted'
 const report=makeReport(e,task);e.reports.push(report)
 const needsDecision=task.kind==='investigation'&&!(task.purpose==='recheck'&&!hasAbnormalFindings(task))
 phase(e,needsDecision?'decision':'review',needsDecision?'排查后决策':'结果处置',{taskId:task.id,reportId:report.id});e.status=needsDecision?'待处置决策':'待结果处置';e.unread.captain=true;e.unread.engineer=false
 notify(state,e,'captain',report.kind+'已回交，待您决策',`${task.owner}已提交“${e.title}”的${report.kind}。${report.summary}`)
 say(e,'engineer','receipt',report.summary,{reportId:report.id,title:report.kind+'已提交'})
 advice(e,'engineer',report.analysis,'本轮记录已形成'+report.kind+'并交轮机长处置。如发现遗漏，可在会话补充说明；新的排查或作业安排由轮机长派发。')
 say(e,'captain','receipt',`${task.owner}已提交${report.kind}。${report.summary}`,{reportId:report.id,title:'AI检修助手 · 执行结果回交'})
 advice(e,'captain',report.analysis,e.phase==='review'?'请结合处理后观察与复测记录决定闭环或派发复查，复查任务可在 Tab 中提前查看。':hasAbnormalFindings(task)?'本轮已登记异常，先审阅待派发维修任务，明确处理范围后派发维修。':'本轮未登记异常，AI 将根据已排除的问题与剩余线索预生成下一轮排查任务，请审阅后派发。')
 return report
}
export function askAssistant(state,id,text,{skipUser=false}={}){
 const e=state.events[id],role=state.role;required(text.trim(),'请先输入问题。');if(!skipUser)say(e,role,'user',text.trim())
 const report=e.reports.at(-1),task=currentTask(e)
 let analysis=report?`${report.kind}中的已提交结论：${report.summary}`:e.brief.conclusion
 let recommendation=role==='captain'?(pendingDecision(e)?'请结合已有依据选择处置方式，并明确负责人、范围和完成时间。':'当前任务由'+task?.owner+'负责，要求完成时间为'+timeText(task?.deadline)+'，提交后将生成报告供您处置。'):(activeTask(e)?'请按当前步骤记录实际结果；如果原因还未确定，可以选“无法确认”并在结论中说明缺口。':'本轮已提交，等待轮机长安排后续任务。')
 if(/为什么|依据|原因/.test(text))recommendation='请重点核对：'+(report?.analysis||e.brief.boundary)+' 哪项现场检查还需要补充？'
 if(/维修|更换|修理/.test(text))recommendation=e.tracking?'本事件按异动跟踪处理，轮机长可关联维保工单，并以已核实的原因确定维保范围。':'维修范围需由轮机长依据排查报告批准。请说明异常的具体部位、损伤或动作表现，以及对应检查记录。'
 advice(e,role,analysis,recommendation)
}
