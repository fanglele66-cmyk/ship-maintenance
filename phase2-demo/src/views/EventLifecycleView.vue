<template>
 <div v-if="event&&allowed" class="lc-workspace">
  <main class="lc-main" :class="{'lc-repair-execution':repairExecution}">
   <header class="lc-event-header"><div class="lc-title"><BackButton class="lc-back" label="返回列表" @click="router.push(route.query.from==='tasks'?{path:'/event',query:route.query.returnView?{view:route.query.returnView}:{}}:'/issues')"/><div><small>{{event.type}} · {{event.device}} <span class="lc-event-number">{{event.number}}</span></small><h1>{{event.title}}</h1></div></div><div class="lc-header-facts"><button v-if="captain" type="button" class="lc-shore-button" @click="decisionDialog?.open('shore')">上报岸基</button><span class="lc-status">{{eventState(event)}}</span></div></header>
   <section class="lc-current-summary" aria-label="事件当前情况"><div><small>当前责任</small><strong>{{responsibility.owner}}</strong><p class="responsibility-line">{{responsibility.detail}}</p><small v-if="responsibility.deadline">当前任务期限 {{timeText(responsibility.deadline)}}</small></div><button v-if="captain&&canDecide" class="lc-primary" @click="decisionDialog?.open()">填写决策</button></section>
   <dl v-if="event.type==='效果观察'" class="lc-observation-origin" aria-label="观察关联信息"><div><dt>关联事件</dt><dd><RouterLink :to="'/situation/issue/'+event.parentEventId">{{observationOrigin.parent?.title||event.parentEventId}} ↗</RouterLink><small>{{observationOrigin.parent?.number}}</small></dd></div><div><dt>关联任务</dt><dd><RouterLink v-if="observationOrigin.task&&event.sourceTaskId&&!event.sourceTaskId.startsWith('initial-')" :to="'/tasks/'+event.sourceTaskId">{{taskTitle(observationOrigin.task)}} ↗</RouterLink><span v-if="event.sourceTaskId?.startsWith('initial-')">初始事件依据（无人员任务）</span><small>{{observationOrigin.task?.number}}</small></dd></div><div><dt>来源报告</dt><dd><button @click="openReport(event.sourceReportId)">{{observationOrigin.report?.title||'查看来源报告'}} ↗</button><small>观察建立于 {{timeText(event.createdAt)}}</small></dd></div></dl>
   <nav class="lc-stage-strip" aria-label="事件阶段"><button v-for="p in visiblePhases" :key="p.id" :class="{active:selected===p.id}" @click="choosePhase(p.id)"><span>{{p.kind==='reminder'&&event.tasks.length?'已派发 · ':''}}{{p.label}}</span><small v-if="p.taskId">{{p.reportId?'已提交':event.tasks.find(t=>t.id===p.taskId)?.status==='waiting'?'等待条件':event.tasks.find(t=>t.id===p.taskId)?.status==='assigned'?'执行中':'已提交'}}</small></button></nav>
   <nav v-if="tabs.length>1" class="lc-tabs" aria-label="阶段内容"><button v-for="t in tabs" :key="t" :class="{active:tab===t}" @click="tab=t">{{t}}</button></nav>
   <section class="lc-content" :class="{'lc-decision-content':['AI分析','效果观察'].includes(tab)}">
    <LifecycleShoreReports v-if="tab==='上报岸基报告'&&captain" :records="event.shore" :selected-id="shoreOverride" @edit="decisionDialog?.open('shore',$event)"/>
    <section v-else-if="tab==='关联观察'" class="lc-observation-links"><h2>效果观察已独立建档</h2><p>本轮执行记录与报告保留，设备效果由关联观察事件继续核对。</p><button v-for="id in event.observationEventIds" :key="id" @click="router.push('/situation/issue/'+id)">{{store.state.events[id]?.title}} · {{eventState(store.state.events[id])}} ↗</button></section>
    <template v-else-if="tab==='初始信息'"><LifecycleInitialInformation :event="event"/></template>
    <template v-else-if="tab==='AI分析'"><section v-if="task?.status==='waiting'" class="lc-task-summary"><strong>等待执行条件</strong><p>{{task.waiting.reason}}。原任务、已完成记录和阶段报告保留；条件具备后选择恢复原任务。</p></section><dl class="lc-analysis-brief"><div v-for="item in decisionAnalysis" :key="item.label"><dt>{{item.label}}</dt><dd>{{item.text}}</dd></div></dl><section class="lc-decision lc-review-decision" v-if="isCurrent&&captain"><LifecycleDecisionBasis :event="event" :show-source="false"/></section><p v-else class="lc-muted">{{isCurrent?'报告已提交，等待轮机长处置。':'本轮处置决定已记录，请从阶段条查看后续安排。'}}</p></template>
    <template v-else-if="tab==='效果观察'"><details v-if="phase.observationPlan||event.observationPlan" class="lc-saved-plan" open><summary>本轮已确认的观察方案</summary><dl><template v-for="field in [{key:'purpose',label:'观察目的'},{key:'signals',label:'关注信号'},{key:'conditions',label:'可比工况'},{key:'limits',label:'覆盖限制'},{key:'trigger',label:'提前介入情况'}]" :key="field.key"><dt>{{field.label}}</dt><dd>{{(phase.observationPlan||event.observationPlan)[field.key]}}</dd></template><dt>计划汇报</dt><dd>{{timeText((phase.observationPlan||event.observationPlan).dueAt)}}</dd></dl></details><LifecycleEffectObservation v-if="observationTask" :event="event" :task="observationTask" :key="observationTask.id"/><LifecycleObservationAdvice v-if="isCurrent&&captain&&observationTask" :event="event" :task="observationTask" :phase-id="phase.id" :key="phase.id"/><section class="lc-decision lc-review-decision" v-if="isCurrent&&captain"><LifecycleDecisionBasis :event="event" :show-source="false"/></section></template>
    <LifecycleTaskPlan v-else-if="captain&&pendingTab&&tab===pendingTab" :event="event" @edit="assistant?.editTask()"/>
    <template v-else-if="tab==='数据观测'"><ManualAnomalyEvidence v-if="event.manualReport" :report="event.manualReport" detailed/><Phase2DataOverview v-else :key="event.id" :scenario="event.id" :timeline="event.timeline"/><EventCauseCandidates v-if="!event.manualReport" :event-id="event.id" :timeline="event.timeline"/></template>
    <template v-else-if="['排查步骤','复查步骤','维修方案','维保安排','维修步骤','维保步骤'].includes(tab)"><div class="lc-task-summary lc-task-metadata"><strong>第{{task?.round}}轮{{taskName(task)}}任务{{task?.purpose==='recheck'?'（复查）':''}}</strong><small>执行人 {{task?.owner}} · 要求完成 {{timeText(task?.deadline)}} · 派发于 {{timeText(task?.assignedAt)}} · {{task?.status==='assigned'?'等待执行人员提交':task?.status==='reporting'?'报告生成中':task?.status==='report-error'?'报告待生成':'已提交报告'}}</small></div><div v-if="!captain&&task?.owner===actor(store.state)&&isCurrent&&['assigned','reporting','report-error'].includes(task?.status)" class="lc-task-entry"><p>本次执行任务已独立建档，请进入任务页面填写本轮结果。</p><button class="lc-primary" @click="router.push('/tasks/'+task.id)">进入{{taskName(task)}}任务 →</button></div><LifecycleTaskRecords v-if="task" :key="phase.id+':'+task.id" :event="event" :task="task" :records="task.records||[]" :show-feedback="showTaskFeedback"/></template>
    <section v-else-if="tab==='阶段报告'"><div class="stage-report-toolbar"><nav class="report-submissions" aria-label="本轮提交版本"><button v-for="r in roundReports" :key="r.id" type="button" @click="reportOverride=r.id" :aria-pressed="report?.id===r.id">{{r.kind}} · {{r.submissionNumber?'第'+r.submissionNumber+'次提交':timeText(r.at)}}</button></nav><button v-if="report" type="button" class="download-btn" @click="downloadReportMarkdown(report)">下载</button></div><LifecycleReport v-if="report" :report="report" :show-download="false"/></section>
    <template v-else-if="tab==='维保任务'"><h2>{{event.maintenance?.number}}</h2><dl class="lc-definition"><dt>负责人</dt><dd>{{event.maintenance?.owner}}</dd><dt>计划窗口</dt><dd>{{event.maintenance?.window?.label||event.maintenance?.window}}</dd><dt>关联正式工单</dt><dd>{{event.maintenance?.plan?.workOrder?.number||'未关联'}} · {{event.maintenance?.plan?.workOrder?.status||'待核实'}}（完工状态独立确认）</dd><dt>维保范围</dt><dd>{{event.maintenance?.scope}}</dd><dt>处理情况</dt><dd>{{maintenanceTask?.status==='submitted'?maintenanceTask.summary:'待执行人员提交维保作业报告'}}</dd></dl><LifecycleReport v-if="maintenanceReport" :report="maintenanceReport"/></template>
    <template v-else-if="tab==='闭环结果'"><h2>闭环归档</h2><p>{{event.closeReason}}</p><small>轮机长 {{people.captain}} · {{timeText(event.closedAt)}}</small><LifecycleReport v-if="closeReport" :report="closeReport"/></template>
   </section>
  </main>
  <LifecycleDecisionDialog ref="decisionDialog" :event="event" @submitted="afterSubmit" @plan="openPlan"/><div v-if="toast" class="lc-action-toast" role="status">{{toast}}</div>
  <LifecycleAssistant @shore-report="openShoreReport($event)" ref="assistant" :event="event" :historical="!isCurrent" :phase-id="phase?.id" :pending-plan-view="!!pendingTab&&tab===pendingTab" @submitted="afterSubmit" @report="openReport" @plan="openPlan" @task="router.push('/tasks/'+$event)"/>
 </div>
 <main v-else class="lc-access"><h2>{{event?'当前身份尚未参与此事件':'未找到该事件'}}</h2><p>当前身份仅展示本人参与的事件。可在左下角切换轮机长视角。</p><button @click="router.push('/event')">返回任务列表</button></main>
</template>
<script setup>
import ManualAnomalyEvidence from '../components/ManualAnomalyEvidence.vue'
import LifecycleInitialInformation from '../components/LifecycleInitialInformation.vue'
import LifecycleShoreReports from '../components/LifecycleShoreReports.vue'
import {eventState,currentResponsibility,eventRounds} from '../workflow/lifecyclePresentation.js'
import {actor} from '../workflow/lifecyclePermissions.js'
import {taskExecution} from '../workflow/taskExecution.js'
import {computed,ref,watch,onActivated} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {currentTask,people,timeText,taskName,decisionOptions} from '../workflow/eventLifecycle'
import {taskPlanKey,planTabLabel} from '../workflow/taskPlanning'
import {suggestionAction} from '../workflow/lifecycleDecisions'
import Phase2DataOverview from '../components/Phase2DataOverview.vue'
import EventCauseCandidates from '../components/EventCauseCandidates.vue'
import {taskTitle} from '../workflow/lifecycleWorkItems'
import LifecycleDecisionBasis from '../components/LifecycleDecisionBasis.vue'
import LifecycleDecisionDialog from '../components/LifecycleDecisionDialog.vue'
import LifecycleAssistant from '../components/LifecycleAssistant.vue'
import {reportTask} from '../workflow/reportSubmissions'
import LifecycleReport from '../components/LifecycleReport.vue'
import {downloadReportMarkdown} from '../workflow/downloadReport.js'
import LifecycleEffectObservation from '../components/LifecycleEffectObservation.vue'
import LifecycleObservationAdvice from '../components/LifecycleObservationAdvice.vue'
import BackButton from '../components/BackButton.vue'
import LifecycleTaskPlan from '../components/LifecycleTaskPlan.vue'
import LifecycleTaskRecords from '../components/LifecycleTaskRecords.vue'
import EventDecisionBrief from '../components/EventDecisionBrief.vue'
import {decisionAnalysisItems} from '../workflow/lifecycleAnalysis'
import {observationTaskFor} from '../workflow/observationContext'
const store=useEventLifecycleStore(),route=useRoute(),router=useRouter(),selected=ref(''),tab=ref(''),reportOverride=ref(null),assistant=ref(null),decisionDialog=ref(null),toast=ref('')
// Keep the cached workspace bound to its last event while another route is
// active. Swapping its root during KeepAlive deactivation corrupts DOM anchors.
const eventId=ref(route.params.attentionId),shoreOverride=ref('')
watch(()=>route.params.attentionId,id=>{if(store.state.events[id])eventId.value=id})
const event=computed(()=>store.state.events[eventId.value]),captain=computed(()=>store.state.role==='captain'),allowed=computed(()=>captain.value||event.value?.participants.includes(actor(store.state)))
const responsibility=computed(()=>currentResponsibility(event.value))
const canDecide=computed(()=>event.value&&decisionOptions(event.value).some(option=>option.value!=='shore'))
const visiblePhases=computed(()=>allowed.value?eventRounds(event.value)||[]:[])
const phase=computed(()=>visiblePhases.value.find(p=>p.id===selected.value)||visiblePhases.value.at(-1)),isCurrent=computed(()=>phase.value?.latestTransitionId===event.value?.phases.at(-1)?.id)
const selectedTaskReport=computed(()=>event.value?.reports.find(r=>r.id===reportOverride.value&&r.taskId===phase.value?.taskId))
const task=computed(()=>{const historical=selectedTaskReport.value||(!isCurrent.value&&event.value?.reports.find(r=>r.id===phase.value?.reportId));return historical?reportTask(event.value,historical):event.value?.tasks.find(t=>t.id===phase.value?.taskId)||currentTask(event.value||{tasks:[]})||event.value?.observationSource?.task})
const showTaskFeedback=computed(()=>!!task.value&&(!!selectedTaskReport.value||(!isCurrent.value&&!!phase.value?.reportId)||['submitted','reporting','report-error','waiting','terminated'].includes(task.value.status)))
const repairExecution=computed(()=>!captain.value&&isCurrent.value&&task.value?.status==='assigned'&&['repair','maintenance'].includes(task.value.kind)&&['维修步骤','维保步骤'].includes(tab.value))
const observationTask=computed(()=>observationTaskFor(event.value,phase.value))
const observationOrigin=computed(()=>({parent:store.state.events[event.value?.parentEventId],task:store.state.events[event.value?.parentEventId]?.tasks.find(t=>t.id===event.value.sourceTaskId)||event.value?.observationSource?.task,report:event.value?.reports.find(r=>r.id===event.value.sourceReportId)}))
const pendingTab=computed(()=>captain.value&&isCurrent.value&&event.value&&suggestionAction(event.value)?planTabLabel(suggestionAction(event.value)):'')
const report=computed(()=>event.value?.reports.find(r=>r.id===reportOverride.value)||event.value?.reports.find(r=>r.id===phase.value?.reportId)||event.value?.reports.findLast(r=>r.taskId===task.value?.id))
const roundReports=computed(()=>event.value?.reports.filter(r=>r.taskId===task.value?.id||r.id===phase.value?.observationReportId)||[])
const decisionAnalysis=computed(()=>decisionAnalysisItems(event.value,task.value,report.value))
const maintenanceTask=computed(()=>event.value?.tasks.find(t=>t.id===event.value.maintenance?.taskId)),maintenanceReport=computed(()=>event.value?.reports.findLast(r=>r.taskId===maintenanceTask.value?.id)),closeReport=computed(()=>event.value?.reports.findLast(r=>r.kind==='闭环报告'))
const tabs=computed(()=>{
 const kind=phase.value?.kind,taskTab=task.value?.purpose==='recheck'?'复查步骤':task.value?.kind==='investigation'?'排查步骤':task.value?.kind==='maintenance'?(captain.value?'维保安排':'维保步骤'):(captain.value?'维修方案':'维修步骤')
 const core=kind==='reminder'?['初始信息','数据观测']:kind==='transferred'?['关联观察','阶段报告']:kind==='closed'?['闭环结果']:['decision','review'].includes(kind)?[...(kind==='review'&&event.value.type==='效果观察'&&!taskExecution(task.value).incomplete&&task.value?.status!=='terminated'?['效果观察']:captain.value?['AI分析']:[]),'阶段报告',taskTab]:[taskTab]
 if(event.value?.maintenance)core.push('维保任务')
 if(pendingTab.value)core.push(pendingTab.value)
 if(captain.value&&event.value?.shore?.length)core.push('上报岸基报告')
 return core
})
function choosePhase(id){selected.value=visiblePhases.value.find(p=>p.id===id||p.aliases.includes(id))?.id||visiblePhases.value.at(-1)?.id||'';reportOverride.value=null;tab.value=tabs.value[0]}
function afterSubmit(action){if(action==='shore'){openShoreReport(event.value.shore.at(-1)?.id);toast.value='已上报岸基，可在本事件的“上报岸基报告”页签查看';setTimeout(()=>toast.value='',4000);return}if(action==='observe'&&event.value?.phase==='transferred'){router.push('/situation/issue/'+event.value.observationEventIds.at(-1));return;}if(event.value){choosePhase(event.value.phases.at(-1).id);if(route.name==='EventLifecycle')store.markRead(event.value.id)}}
function openShoreReport(id){if(!captain.value||!event.value?.shore?.some(r=>r.id===id))return;shoreOverride.value=id;tab.value='上报岸基报告'}
function openReport(id){const p=event.value.phases.find(p=>p.reportId===id);if(p)choosePhase(p.id);reportOverride.value=id;tab.value=id===closeReport.value?.id?'闭环结果':'阶段报告'}
function openPlan(action){if(typeof action==='string'&&['investigate','repair','maintenance','recheck'].includes(action)){event.value.decisionDraft||={};event.value.decisionDraft.action=action}choosePhase(event.value.phases.at(-1).id);if(pendingTab.value)tab.value=pendingTab.value}
watch(()=>[pendingTab.value,event.value?taskPlanKey(event.value):''],()=>{if(pendingTab.value)void store.prepareTaskPlan(event.value.id).catch(()=>{})},{immediate:true})
watch(tabs,list=>{if(!list.includes(tab.value))tab.value=list[0]||''})
function restorePhase(){afterSubmit();if(route.query.phase&&event.value)choosePhase(route.query.phase);if(route.query.report&&event.value)openReport(route.query.report);if(route.query.shore&&event.value)openShoreReport(route.query.shore)}
watch(()=>[event.value?.id,store.state.role,route.query.phase,route.query.report,route.query.shore],restorePhase,{immediate:true})
watch(()=>event.value?.phases.at(-1)?.id,(id,previous)=>{if(id&&(!selected.value||selected.value===previous))choosePhase(id)})
onActivated(restorePhase)
</script>

<style scoped>.lc-shore-button{border:1px solid #dac8a8;border-radius:4px;padding:6px 10px;color:#96723e;background:#fffaf2;font:inherit;font-size:12px;cursor:pointer}</style>

<style scoped>
.stage-report-toolbar{display:flex;align-items:center;gap:12px;min-width:0}.stage-report-toolbar .report-submissions{display:flex;flex:1;min-width:0;gap:8px;overflow-x:auto}.stage-report-toolbar button{flex:none;white-space:nowrap}.stage-report-toolbar .download-btn{margin-left:auto}
.lc-task-metadata{padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px 24px;flex-wrap:wrap}.lc-task-metadata>strong{flex:none}.lc-task-metadata>small{margin-left:auto;text-align:right;line-height:1.8}@media(max-width:760px){.lc-task-metadata>small{flex-basis:100%}}
.lc-main>.lc-content{padding:12px 0}.lc-repair-execution .lc-content{padding:12px 0 0}.lc-repair-execution .lc-task-summary{padding:10px 14px;font-size:13px}.lc-repair-execution .lc-task-summary p{margin:5px 0;line-height:1.65}.lc-repair-execution .lc-stage-strip{margin:12px 0 8px}
</style>

<style scoped>
@media(min-width:1101px){.lc-repair-execution{padding:18px 18px 10px}.lc-repair-execution .lc-content{padding-top:8px}.lc-repair-execution .lc-stage-strip{margin:10px 0 6px}}
</style>

<style scoped>
.lc-observation-origin{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin:20px 0 0;padding:15px 0;border-block:1px solid #e8ecef;font-size:13px}.lc-observation-origin dt{font-size:12px;color:#8b99a8;margin-bottom:6px}.lc-observation-origin dd{margin:0}.lc-observation-origin button,.lc-observation-origin a{border:0;background:none;text-align:left;padding:0;color:#627c91;font-size:13px}.lc-observation-origin small{display:block;color:#95a0ad;margin-top:5px;font-size:11px}.lc-review-decision :deep(.lc-decision-basis){margin:0 0 14px}.lc-review-decision :deep(.lc-decision-basis h3){font-size:14px!important}.lc-decision-actions{display:flex;gap:10px;flex-wrap:wrap}.lc-decision-actions button{font-size:13px}@media(max-width:800px){.lc-observation-origin{grid-template-columns:1fr;gap:12px}}
</style>
