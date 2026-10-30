<template>
 <div v-if="event&&allowed" class="lc-workspace">
  <main class="lc-main" :class="{'lc-repair-execution':repairExecution}">
   <header class="lc-event-header"><div class="lc-title"><BackButton class="lc-back" label="返回列表" @click="router.push(route.query.from==='tasks'?{path:'/event',query:route.query.returnView?{view:route.query.returnView}:{}}:'/issues')"/><div><small>{{event.type}} · {{event.device}} <span class="lc-event-number">{{event.number}}</span></small><h1>{{event.title}}</h1></div></div><div class="lc-header-facts"><button v-if="captain&&event.phase==='closed'" type="button" class="lc-shore-button" @click="assistant?.openShore()">同步岸基</button><span v-if="task">负责人 <b>{{task.owner}}</b></span><span v-if="task">要求完成 <b>{{timeText(task.deadline)}}</b></span><span class="lc-status">{{event.status}}</span></div></header>
   <nav class="lc-stage-strip" aria-label="事件阶段"><button v-for="p in visiblePhases" :key="p.id" :class="{active:selected===p.id}" @click="choosePhase(p.id)"><span>{{p.kind==='reminder'&&event.tasks.length?'已派发 · ':''}}{{p.label}}</span><small v-if="p.taskId">{{event.tasks.find(t=>t.id===p.taskId)?.status==='assigned'?'执行中':'已提交'}}</small></button></nav>
   <nav v-if="tabs.length>1" class="lc-tabs" aria-label="阶段内容"><button v-for="t in tabs" :key="t" :class="{active:tab===t}" @click="tab=t">{{t}}</button></nav>
   <section class="lc-content" :class="{'lc-decision-content':['处置决策','效果观察'].includes(tab)}">
    <template v-if="tab==='风险提醒'"><EventDecisionBrief :brief="event.brief" :event-type="event.type" :show-decisions="captain"><template #before-decisions><h3>关键数据与含义</h3><div class="lc-fact-grid"><div v-for="f in event.brief.facts" :key="f.label"><small>{{f.label}}</small><b>{{f.value}} {{f.unit}}</b><p>{{f.meaning}}</p></div></div></template></EventDecisionBrief><template v-if="captain"><h3>建议排查范围</h3><ol><li v-for="t in event.brief.tasks" :key="t.title"><b>{{t.title}}</b>：{{t.detail}}</li></ol><section v-if="isCurrent&&captain" class="lc-decision"><h3>轮机长决策</h3><LifecycleActionForm :show-basis="false" :event="event" @submitted="afterSubmit"/></section><p v-else-if="event.tasks.length" class="lc-muted">提醒已派发，任务安排及后续报告可通过右上方阶段条查看。</p></template></template>
    <template v-else-if="tab==='处置决策'"><h2>AI分析</h2><dl class="lc-analysis-brief"><div v-for="item in decisionAnalysis" :key="item.label"><dt>{{item.label}}</dt><dd>{{item.text}}</dd></div></dl><section class="lc-decision" v-if="isCurrent&&captain"><LifecycleActionForm :event="event" @submitted="afterSubmit"/></section><p v-else class="lc-muted">{{isCurrent?'报告已提交，等待轮机长处置。':'本轮处置决定已记录，请从阶段条查看后续安排。'}}</p></template>
    <template v-else-if="tab==='效果观察'"><LifecycleEffectObservation v-if="observationTask" :event="event" :task="observationTask" :key="observationTask.id"/><LifecycleObservationAdvice v-if="isCurrent&&captain&&observationTask" :event="event" :task="observationTask" :phase-id="phase.id" :key="phase.id"/><section class="lc-decision" v-if="isCurrent&&captain"><LifecycleActionForm :event="event" @submitted="afterSubmit"/></section><p v-else class="lc-muted">{{isCurrent?'观察记录与作业报告已关联，等待轮机长处置。':'本轮观察与决定已留存，可通过阶段条回看后续安排。'}}</p></template>
    <LifecycleTaskPlan v-else-if="captain&&pendingTab&&tab===pendingTab" :event="event" @edit="assistant?.editTask()"/>
    <Phase2DataOverview v-else-if="tab==='数据观测'" :key="event.id" :scenario="event.id"/>
    <template v-else-if="['排查步骤','复查步骤','维修方案','维保安排','维修步骤','维保步骤'].includes(tab)"><div class="lc-task-summary"><strong>第{{task?.round}}轮{{taskName(task)}}任务</strong><p>{{task?.scope}}</p><small>派发于 {{timeText(task?.assignedAt)}} · {{task?.status==='assigned'?'等待执行人员提交':task?.status==='reporting'?'报告生成中':task?.status==='report-error'?'报告待生成':'已提交报告'}}</small></div><div v-if="task?.sourceReportId" class="lc-plan-source">方案依据：{{event.reports.find(r=>r.id===task.sourceReportId)?.title}}<p>{{event.reports.find(r=>r.id===task.sourceReportId)?.summary}}</p></div><div v-if="!captain&&isCurrent&&['assigned','reporting','report-error'].includes(task?.status)" class="lc-task-entry"><p>本次执行任务已独立建档，请进入任务页面填写本轮结果。</p><button class="lc-primary" @click="router.push('/tasks/'+task.id)">进入{{taskName(task)}}任务 →</button></div><template v-else><ol class="lc-step-list"><li v-for="(step,i) in task?.steps" :key="i"><span class="lc-step-number">{{i+1}}</span><div><h3>{{step.label}}</h3><LifecycleStepInstructions :step="step"/><p class="lc-muted" v-if="task?.status==='submitted'">结果：{{task.records[i]?.result}} {{task.records[i]?.note}}</p></div></li></ol><p v-if="task?.status==='assigned'" class="lc-muted">由 {{task.owner}} 执行并提交报告。轮机长可以查看步骤、安排和进度。</p></template></template>
    <LifecycleReport v-else-if="tab==='阶段报告'&&report" :report="report"/>
    <LifecycleEvidence v-else-if="tab==='证据资料'" :event="event"/>
    <template v-else-if="tab==='维保任务'"><h2>{{event.maintenance?.number}}</h2><dl class="lc-definition"><dt>负责人</dt><dd>{{event.maintenance?.owner}}</dd><dt>计划窗口</dt><dd>{{event.maintenance?.window}}</dd><dt>维保范围</dt><dd>{{event.maintenance?.scope}}</dd><dt>处理情况</dt><dd>{{maintenanceTask?.status==='submitted'?maintenanceTask.summary:'待执行人员提交维保作业报告'}}</dd></dl><LifecycleReport v-if="maintenanceReport" :report="maintenanceReport"/></template>
    <template v-else-if="tab==='闭环结果'"><h2>闭环归档</h2><p>{{event.closeReason}}</p><small>轮机长 {{people.captain}} · {{timeText(event.closedAt)}}</small><LifecycleReport v-if="closeReport" :report="closeReport"/></template>
   </section>
  </main>
  <LifecycleAssistant ref="assistant" :event="event" :historical="!isCurrent" @submitted="afterSubmit" @report="openReport" @plan="openPlan" @task="router.push('/tasks/'+$event)"/>
 </div>
 <main v-else class="lc-access"><h2>{{event?'此事件尚未分派给大管轮':'未找到该事件'}}</h2><p>当前身份仅展示本人参与的事件。可在右上角切换轮机长视角。</p><button @click="router.push('/event')">返回待办中心</button></main>
</template>
<script setup>
import {computed,ref,watch,onActivated} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {currentTask,people,timeText,taskName} from '../workflow/eventLifecycle'
import {taskPlanKey,planTabLabel} from '../workflow/taskPlanning'
import {dispatchAction} from '../workflow/lifecycleDecisions'
import Phase2DataOverview from '../components/Phase2DataOverview.vue'
import LifecycleActionForm from '../components/LifecycleActionForm.vue'
import LifecycleAssistant from '../components/LifecycleAssistant.vue'
import LifecycleReport from '../components/LifecycleReport.vue'
import LifecycleEvidence from '../components/LifecycleEvidence.vue'
import LifecycleEffectObservation from '../components/LifecycleEffectObservation.vue'
import LifecycleObservationAdvice from '../components/LifecycleObservationAdvice.vue'
import BackButton from '../components/BackButton.vue'
import LifecycleTaskPlan from '../components/LifecycleTaskPlan.vue'
import LifecycleStepInstructions from '../components/LifecycleStepInstructions.vue'
import EventDecisionBrief from '../components/EventDecisionBrief.vue'
import {decisionAnalysisItems} from '../workflow/lifecycleAnalysis'
const store=useEventLifecycleStore(),route=useRoute(),router=useRouter(),selected=ref(''),tab=ref(''),reportOverride=ref(null),assistant=ref(null)
// Keep the cached workspace bound to its last event while another route is
// active. Swapping its root during KeepAlive deactivation corrupts DOM anchors.
const eventId=ref(route.params.attentionId)
watch(()=>route.params.attentionId,id=>{if(store.state.events[id])eventId.value=id})
const event=computed(()=>store.state.events[eventId.value]),captain=computed(()=>store.state.role==='captain'),allowed=computed(()=>captain.value||event.value?.participants.includes(people.engineer))
const visiblePhases=computed(()=>allowed.value?event.value?.phases||[]:[])
const phase=computed(()=>visiblePhases.value.find(p=>p.id===selected.value)||visiblePhases.value.at(-1)),isCurrent=computed(()=>phase.value?.id===event.value?.phases.at(-1)?.id)
const task=computed(()=>event.value?.tasks.find(t=>t.id===phase.value?.taskId)||currentTask(event.value||{tasks:[]}))
const repairExecution=computed(()=>!captain.value&&isCurrent.value&&task.value?.status==='assigned'&&['repair','maintenance'].includes(task.value.kind)&&['维修步骤','维保步骤'].includes(tab.value))
const observationTask=computed(()=>task.value?.kind==='investigation'?[...(event.value?.tasks||[])].reverse().find(t=>t.kind!=='investigation'&&t.status==='submitted'&&Date.parse(t.submittedAt)<=Date.parse(task.value.submittedAt)):task.value)
const pendingTab=computed(()=>captain.value&&isCurrent.value&&event.value&&dispatchAction(event.value)?planTabLabel(dispatchAction(event.value)):'')
const report=computed(()=>event.value?.reports.find(r=>r.id===reportOverride.value)||event.value?.reports.find(r=>r.id===phase.value?.reportId)||event.value?.reports.find(r=>r.taskId===task.value?.id))
const decisionAnalysis=computed(()=>decisionAnalysisItems(event.value,task.value,report.value))
const maintenanceTask=computed(()=>event.value?.tasks.find(t=>t.id===event.value.maintenance?.taskId)),maintenanceReport=computed(()=>event.value?.reports.find(r=>r.taskId===maintenanceTask.value?.id)),closeReport=computed(()=>event.value?.reports.findLast(r=>r.kind==='闭环报告'))
const tabs=computed(()=>{
 const kind=phase.value?.kind,taskTab=task.value?.purpose==='recheck'?'复查步骤':task.value?.kind==='investigation'?'排查步骤':task.value?.kind==='maintenance'?(captain.value?'维保安排':'维保步骤'):(captain.value?'维修方案':'维修步骤')
 const core=kind==='reminder'?['风险提醒','数据观测','证据资料']:kind==='closed'?['闭环结果']:['decision','review'].includes(kind)?[...(kind==='review'?['效果观察']:captain.value?['处置决策']:[]),'阶段报告',taskTab]:[taskTab]
 if(event.value?.maintenance)core.push('维保任务')
 if(pendingTab.value)core.push(pendingTab.value)
 return core
})
function choosePhase(id){selected.value=visiblePhases.value.some(p=>p.id===id)?id:visiblePhases.value.at(-1)?.id||'';reportOverride.value=null;tab.value=tabs.value[0]}
function afterSubmit(action){if(action==='shore')return;if(event.value){choosePhase(event.value.phases.at(-1).id);if(route.name==='EventLifecycle')store.markRead(event.value.id)}}
function openReport(id){const p=event.value.phases.find(p=>p.reportId===id);if(p)choosePhase(p.id);reportOverride.value=id;tab.value=id===closeReport.value?.id?'闭环结果':'阶段报告'}
function openPlan(){choosePhase(event.value.phases.at(-1).id);if(pendingTab.value)tab.value=pendingTab.value}
watch(()=>event.value?taskPlanKey(event.value):'',()=>{if(event.value)void store.prepareTaskPlan(event.value.id).catch(()=>{})},{immediate:true})
watch(tabs,list=>{if(!list.includes(tab.value))tab.value=list[0]||''})
function restorePhase(){afterSubmit();if(route.query.phase&&event.value)choosePhase(route.query.phase);if(route.query.report&&event.value)openReport(route.query.report)}
watch(()=>[event.value?.id,store.state.role,route.query.phase,route.query.report],restorePhase,{immediate:true})
watch(()=>event.value?.phases.at(-1)?.id,(id,previous)=>{if(id&&(!selected.value||selected.value===previous))choosePhase(id)})
onActivated(restorePhase)
</script>

<style scoped>.lc-shore-button{border:1px solid #dac8a8;border-radius:4px;padding:6px 10px;color:#96723e;background:#fffaf2;font:inherit;font-size:12px;cursor:pointer}</style>

<style scoped>
.lc-repair-execution .lc-content{padding:12px 0 0}.lc-repair-execution .lc-task-summary{padding:10px 14px;font-size:13px}.lc-repair-execution .lc-task-summary p{margin:5px 0;line-height:1.65}.lc-repair-execution .lc-plan-source{margin-top:10px;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px}.lc-repair-execution .lc-plan-source>p{width:100%;margin:0;line-height:1.6}.lc-repair-execution .lc-stage-strip{margin:12px 0 8px}
</style>

<style scoped>
@media(min-width:1101px){.lc-repair-execution{padding:18px 18px 10px}.lc-repair-execution .lc-content{padding-top:8px}.lc-repair-execution .lc-stage-strip{margin:10px 0 6px}.lc-repair-execution .lc-task-summary{display:grid;grid-template-columns:1fr auto;gap:4px 16px}.lc-repair-execution .lc-task-summary>strong{grid-area:1/1}.lc-repair-execution .lc-task-summary>small{grid-area:1/2;align-self:center}.lc-repair-execution .lc-task-summary>p{grid-area:2/1/3/3;margin:0}}
</style>
