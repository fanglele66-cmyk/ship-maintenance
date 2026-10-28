<template>
 <div v-if="event&&allowed" class="lc-workspace">
  <main class="lc-main">
   <header class="lc-event-header"><div class="lc-title"><button class="lc-back" @click="router.push(route.query.from==='tasks'?'/event':'/issues')" aria-label="返回列表">←</button><div><small>{{event.type}} · {{event.device}}</small><h1>{{event.title}}</h1></div></div><div class="lc-header-facts"><span v-if="task">负责人 <b>{{task.owner}}</b></span><span v-if="task">要求完成 <b>{{timeText(task.deadline)}}</b></span><span class="lc-status">{{event.status}}</span></div></header>
   <nav class="lc-stage-strip" aria-label="事件阶段"><button v-for="p in event.phases" :key="p.id" :class="{active:selected===p.id}" @click="choosePhase(p.id)"><span>{{p.kind==='reminder'&&event.tasks.length?'已派发 · ':''}}{{p.label}}</span><small v-if="p.taskId">{{event.tasks.find(t=>t.id===p.taskId)?.status==='assigned'?'执行中':'已提交'}}</small></button></nav>
   <nav class="lc-tabs" aria-label="阶段内容"><button v-for="t in tabs" :key="t" :class="{active:tab===t}" @click="tab=t">{{t}}</button></nav>
   <section class="lc-content">
    <template v-if="tab==='风险提醒'"><span class="lc-eyebrow">{{event.brief.discovery.label}} · {{event.brief.discovery.at}}</span><h2>{{event.brief.title}}</h2><p>{{event.brief.discovery.text}}</p><div class="lc-fact-grid"><div v-for="f in event.brief.facts" :key="f.label"><small>{{f.label}}</small><b>{{f.value}} {{f.unit}}</b><p>{{f.meaning}}</p></div></div><h3>AI核实建议</h3><p>{{event.brief.conclusion}}</p><h3>建议排查范围</h3><ol><li v-for="t in event.brief.tasks" :key="t.title"><b>{{t.title}}</b>：{{t.detail}}</li></ol><section v-if="isCurrent&&captain" class="lc-decision"><h3>轮机长决策</h3><LifecycleActionForm :event="event" @submitted="afterSubmit"/></section><p v-else-if="event.tasks.length" class="lc-muted">提醒已派发，任务安排及后续报告可通过右上方阶段条查看。</p></template>
    <template v-else-if="tab==='处置决策'"><h2>{{phase.kind==='review'?'作业结果回交':'排查结果回交'}}</h2><div class="lc-review-summary"><small>{{report?.kind}} · {{report?.owner}} · {{timeText(report?.at)}}</small><p>{{report?.summary}}</p><button v-if="report" @click="tab='阶段报告'">查看完整 Markdown 报告</button></div><h3>AI对提交结果的分析</h3><p>{{report?.analysis}}</p><section class="lc-decision" v-if="isCurrent&&captain"><h3>本轮后续处置</h3><LifecycleActionForm :event="event" @submitted="afterSubmit"/></section><p v-else class="lc-muted">{{isCurrent?'报告已提交，等待轮机长处置。':'本轮处置决定已记录，请从阶段条查看后续安排。'}}</p></template>
    <Phase2DataOverview v-else-if="tab==='数据观测'" :key="event.id" :scenario="event.id"/>
    <template v-else-if="tab==='排查步骤'||tab==='维修方案'||tab==='维保安排'"><div class="lc-task-summary"><strong>第{{task?.round}}轮{{task?.kind==='investigation'?'排查任务':task?.kind==='maintenance'?'维保任务':'维修任务'}}</strong><p>{{task?.scope}}</p><small>派发于 {{timeText(task?.assignedAt)}} · {{task?.status==='assigned'?'等待执行人员提交':'已提交报告'}}</small></div><div v-if="task?.sourceReportId" class="lc-plan-source">方案依据：{{event.reports.find(r=>r.id===task.sourceReportId)?.title}}<p>{{event.reports.find(r=>r.id===task.sourceReportId)?.summary}}</p></div><ol class="lc-step-list"><li v-for="(step,i) in task?.steps" :key="i"><span class="lc-step-number">{{i+1}}</span><div><h3>{{step.label}}</h3><p>{{step.guide}}</p><ul><li v-for="check in step.checks" :key="check">{{check}}</li></ul><p class="lc-muted" v-if="task?.status==='submitted'">结果：{{task.records[i]?.result}} {{task.records[i]?.note}}</p></div></li></ol><section v-if="!captain&&isCurrent&&task?.status==='assigned'" class="lc-decision"><LifecycleActionForm :event="event" @submitted="afterSubmit"/></section><p v-else-if="task?.status==='assigned'" class="lc-muted">由 {{task.owner}} 执行并提交报告。轮机长可以查看步骤、安排和进度。</p></template>
    <LifecycleReport v-else-if="tab==='阶段报告'&&report" :report="report"/>
    <template v-else-if="tab==='证据资料'"><section v-for="s in event.brief.sources" :key="s.id" class="lc-source"><h3>{{s.title}}</h3><small>{{s.date}} · {{s.kind}}</small><p>{{s.summary}}</p><dl v-for="r in s.records" :key="r.label"><dt>{{r.label}}</dt><dd>{{r.value}}</dd></dl></section></template>
    <template v-else-if="tab==='维保任务'"><h2>{{event.maintenance?.number}}</h2><dl class="lc-definition"><dt>负责人</dt><dd>{{event.maintenance?.owner}}</dd><dt>计划窗口</dt><dd>{{event.maintenance?.window}}</dd><dt>维保范围</dt><dd>{{event.maintenance?.scope}}</dd><dt>处理情况</dt><dd>{{maintenanceTask?.status==='submitted'?maintenanceTask.summary:'待执行人员提交维保作业报告'}}</dd></dl><LifecycleReport v-if="maintenanceReport" :report="maintenanceReport"/></template>
    <template v-else-if="tab==='闭环结果'"><h2>闭环归档</h2><p>{{event.closeReason}}</p><small>轮机长 {{people.captain}} · {{timeText(event.closedAt)}}</small><LifecycleReport v-if="closeReport" :report="closeReport"/></template>
    <template v-else-if="tab==='处置记录'"><ol class="lc-records"><li v-for="p in event.phases" :key="p.id"><b>{{p.label}}</b><time>{{timeText(p.at)}}</time><button @click="choosePhase(p.id)">回看阶段</button></li></ol><section v-for="d in event.decisions" :key="d.id"><h3>{{decisionLabels[d.action]}} · {{timeText(d.at)}}</h3><p>{{d.reason}}</p></section><section v-if="event.shore.length"><h3>岸端同步记录</h3><p v-for="s in event.shore" :key="s.id">{{timeText(s.at)}} · {{s.status}} · {{s.reason}}</p></section></template>
   </section>
  </main>
  <LifecycleAssistant :event="event" @submitted="afterSubmit" @report="openReport"/>
 </div>
 <main v-else class="lc-access"><h2>{{event?'此事件尚未分派给大管轮':'未找到该事件'}}</h2><p>当前身份仅展示本人参与的事件。可在右上角切换轮机长视角。</p><button @click="router.push('/event')">返回待办中心</button></main>
</template>
<script setup>
import {computed,ref,watch,onActivated} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {currentTask,people,timeText} from '../workflow/eventLifecycle'
import Phase2DataOverview from '../components/Phase2DataOverview.vue'
import LifecycleActionForm from '../components/LifecycleActionForm.vue'
import LifecycleAssistant from '../components/LifecycleAssistant.vue'
import LifecycleReport from '../components/LifecycleReport.vue'
const store=useEventLifecycleStore(),route=useRoute(),router=useRouter(),selected=ref(''),tab=ref(''),reportOverride=ref(null)
// Keep the cached workspace bound to its last event while another route is
// active. Swapping its root during KeepAlive deactivation corrupts DOM anchors.
const eventId=ref(route.params.attentionId)
watch(()=>route.params.attentionId,id=>{if(store.state.events[id])eventId.value=id})
const event=computed(()=>store.state.events[eventId.value]),captain=computed(()=>store.state.role==='captain'),allowed=computed(()=>captain.value||event.value?.participants.includes(people.engineer))
const phase=computed(()=>event.value?.phases.find(p=>p.id===selected.value)||event.value?.phases.at(-1)),isCurrent=computed(()=>phase.value?.id===event.value?.phases.at(-1)?.id)
const task=computed(()=>event.value?.tasks.find(t=>t.id===phase.value?.taskId)||currentTask(event.value||{tasks:[]}))
const report=computed(()=>event.value?.reports.find(r=>r.id===reportOverride.value)||event.value?.reports.find(r=>r.id===phase.value?.reportId)||event.value?.reports.find(r=>r.taskId===task.value?.id))
const maintenanceTask=computed(()=>event.value?.tasks.find(t=>t.id===event.value.maintenance?.taskId)),maintenanceReport=computed(()=>event.value?.reports.find(r=>r.taskId===maintenanceTask.value?.id)),closeReport=computed(()=>event.value?.reports.findLast(r=>r.kind==='闭环报告'))
const tabs=computed(()=>{const kind=phase.value?.kind;const core=kind==='reminder'?['风险提醒','数据观测','证据资料']:kind==='closed'?['闭环结果','处置记录']:['decision','review'].includes(kind)?['处置决策','阶段报告','数据观测',task.value?.kind==='investigation'?'排查步骤':task.value?.kind==='maintenance'?'维保安排':'维修方案','处置记录']:['数据观测',kind==='investigation'?'排查步骤':kind==='maintenance'?'维保安排':'维修方案','处置记录'];if(event.value?.maintenance)core.push('维保任务');return core})
const decisionLabels={investigate:'派发排查',repair:'派发维修',maintenance:'关联维保',shore:'同步岸端',close:'关闭闭环',false:'确认误报'}
function choosePhase(id){selected.value=id;reportOverride.value=null;tab.value=captain.value&&['investigation','repair','maintenance'].includes(phase.value.kind)?tabs.value[1]:tabs.value[0]}
function afterSubmit(){if(event.value){choosePhase(event.value.phases.at(-1).id);if(route.name==='EventLifecycle')store.markRead(event.value.id)}}
function openReport(id){const p=event.value.phases.find(p=>p.reportId===id);if(p)choosePhase(p.id);reportOverride.value=id;tab.value=id===closeReport.value?.id?'闭环结果':'阶段报告'}
watch(()=>[event.value?.id,store.state.role],()=>{afterSubmit();if(route.query.report)openReport(route.query.report)},{immediate:true})
watch(()=>event.value?.phases.at(-1)?.id,(id,previous)=>{if(id&&(!selected.value||selected.value===previous))choosePhase(id)})
onActivated(()=>{afterSubmit();if(route.query.report)openReport(route.query.report)})
</script>
