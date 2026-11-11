<template>
 <div v-if="event&&allowed" class="lc-workspace task-workspace" :class="{'assistant-hidden':!assistantOpen}">
  <main class="lc-main task-main">
   <header class="task-detail-head"><div class="task-heading"><BackButton label="返回我的任务" @click="back"/><div><small>{{taskName(task)}}任务 · {{taskNumber(event,task)}}</small><h1>{{taskTitle(task)}}</h1></div></div><div class="task-header-actions"><button v-if="!assistantOpen" type="button" class="task-assistant-open" @click="assistantOpen=true">任务助手 ↗</button><span class="task-state" :class="{done:task.status==='submitted'}">{{task.status==='submitted'?(task.goalStatus==='completed'?'已完成':'反馈已提交'):task.status==='waiting'?'等待条件':task.status==='terminated'?'已终止':['reporting','report-error'].includes(task.status)?(task.goalStatus==='completed'?'已完成 · AI 分析待补充':'事实已回交 · 存在未完成项'):executable?'待我执行':'执行中'}}</span></div></header>
   <dl class="task-basics"><div class="task-event-info"><dt>关联事件</dt><dd><button @click="router.push({path:'/situation/issue/'+event.id,query:{from:'tasks'}})">{{event.title}} <span aria-hidden="true">↗</span></button><small>{{event.type}} · {{event.number}}</small></dd></div><div><dt>执行人</dt><dd>{{task.owner}}</dd></div><div><dt>派发人</dt><dd>{{task.assignedBy||people.captain}}</dd></div><div><dt>派发时间</dt><dd>{{timeText(task.assignedAt)}}</dd></div><div><dt>要求完成</dt><dd>{{timeText(task.deadline)}}</dd></div></dl>
   <section v-if="task.status==='waiting'||task.status==='terminated'" class="task-scope"><h2>{{task.status==='waiting'?'等待执行条件':'未执行部分已终止'}}</h2><p>{{task.status==='waiting'?task.waiting.reason:task.terminationReason}}<br/>{{task.status==='waiting'?'原执行人确认条件后继续；范围变化需轮机长确认。':'事件闭环由轮机长另行确认。'}}</p></section><form v-if="task.status==='waiting'&&own" class="task-resume" @submit.prevent="resume"><label>现场核对结果<textarea v-model="resumeReason" required rows="2"/></label><label><input type="checkbox" v-model="unchanged"/>原批准条件已满足，范围与执行人不变</label><button type="submit" class="lc-primary">{{unchanged?'确认条件并继续原任务':'条件有变，回交轮机长'}}</button><p v-if="resumeError" role="alert">{{resumeError}}</p><p v-if="task.waiting?.reviewRequested">条件变化已回交，等待轮机长核对。</p></form><div v-if="['submitted','reporting','report-error','waiting','terminated'].includes(task.status)" class="task-submitted"><div class="task-submitted-status" role="status"><strong>本次任务已提交</strong><span>{{timeText(task.submittedAt)}}</span></div><div class="task-report-actions"><nav class="lc-tabs task-report-tabs" role="tablist" aria-label="本轮报告操作" @keydown="moveReportTab"><button id="task-records-tab" type="button" role="tab" aria-controls="task-records-panel" :aria-selected="tab!=='提交记录'" :tabindex="tab!=='提交记录'?0:-1" :class="{active:tab!=='提交记录'}" @click="tab='任务步骤'">本轮执行记录</button><button id="task-report-tab" type="button" role="tab" aria-controls="task-report-panel" :disabled="!report" :aria-selected="tab==='提交记录'" :tabindex="tab==='提交记录'?0:-1" :class="{active:tab==='提交记录'}" @click="openReport(report?.id)">{{taskName(task)}}报告</button></nav><div class="task-report-actions-right"><button type="button" :disabled="!report" @click="downloadReportMarkdown(report)">下载</button><button v-if="canSupplement" type="button" class="task-supplement" @click="supplement"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12v9H9l-4 3v-3H4z"/><path d="M7 7h6M7 10h4"/></svg>通过对话补充报告</button></div></div></div>
   <section v-if="task.maintenance" class="task-scope"><h2>提前维保安排</h2><p>{{task.maintenance.plan.id}} · {{task.maintenance.plan.title}}<br/>正式工单：{{task.maintenance.plan.workOrder?.number||'未关联'}} · {{task.maintenance.plan.workOrder?.status||'待核实'}}<br/>{{task.maintenance.window.label}}<br/>本次回交不自动确认正式工单完工。</p></section>
   <TaskReportGeneration v-if="task.status==='report-error'" :event="event" :task="task" @submitting="showSubmission" @submitted="submitted"/>
   <section class="task-detail-content" :id="tab==='提交记录'?'task-report-panel':'task-records-panel'" :role="submittedView?'tabpanel':undefined" :aria-labelledby="submittedView?(tab==='提交记录'?'task-report-tab':'task-records-tab'):undefined">
    <template v-if="tab!=='提交记录'">
     <LifecycleTaskSteps v-if="executable" :event="event" :task="task" :key="task.id" @assist="assistStep" @submitting="showSubmission" @submitted="submitted"/>
     <template v-else><p v-if="!own&&task.status==='assigned'" class="lc-muted">本轮结果尚未提交。<span v-if="task.draft?.updatedAt"> 最近记录更新：{{timeText(task.draft.updatedAt)}}。</span></p><LifecycleTaskRecords :event="event" :task="task" :records="records" :key="task.id"/></template>
    </template>
    <template v-else><nav v-if="taskReports.length>1" class="report-submissions" aria-label="任务报告提交记录"><button v-for="item in taskReports" :key="item.id" :aria-pressed="report?.id===item.id" @click="selectedReportId=item.id">第{{item.submissionNumber}}次提交{{item.submissionNumber>1?'（恢复后）':''}} · {{timeText(item.at)}}</button></nav><LifecycleReport v-if="report" :report="report" :show-download="false"/></template>
   </section>
  </main>
  <LifecycleAssistant v-show="assistantOpen" @collapse="assistantOpen=false" ref="assistant" :event="event" :task-id="task.id" :active-step-index="task.draft?.stepIndex||0" :key="task.id" @submitted="submitted" @report="openReport"/>
 </div>
 <main v-else class="lc-access"><h2>{{task?'当前身份无权查看此任务':'未找到该任务'}}</h2><p>执行人只能查看分派给本人的任务。</p><button @click="back">返回我的任务</button></main>
</template>
<script setup>
import {visibleTaskRecords,ownsTask} from '../workflow/lifecyclePermissions.js'
import {computed,ref,watch,nextTick} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {people,timeText,taskName} from '../workflow/eventLifecycle'
import {findTask,canViewTask,canExecuteTask,taskTitle,taskNumber} from '../workflow/lifecycleWorkItems'
import {supplementaryReports} from '../workflow/reportRevisions'
import {downloadReportMarkdown} from '../workflow/downloadReport.js'
import BackButton from '../components/BackButton.vue'
import LifecycleTaskSteps from '../components/LifecycleTaskSteps.vue'
import LifecycleTaskRecords from '../components/LifecycleTaskRecords.vue'
import TaskReportGeneration from '../components/TaskReportGeneration.vue'
import LifecycleReport from '../components/LifecycleReport.vue'
import LifecycleAssistant from '../components/LifecycleAssistant.vue'
const store=useEventLifecycleStore(),route=useRoute(),router=useRouter(),taskId=ref(route.params.taskId),tab=ref('执行步骤'),assistant=ref(null),assistantOpen=ref(true)
// Keep the cached task stable while another route is active.
watch(()=>route.params.taskId,id=>{if(typeof id==='string')taskId.value=id})
const entry=computed(()=>findTask(store.state,taskId.value)),event=computed(()=>entry.value?.event),task=computed(()=>entry.value?.task)
const allowed=computed(()=>canViewTask(store.state.role,task.value)),executable=computed(()=>event.value&&canExecuteTask(store.state,event.value,task.value))
const submittedView=computed(()=>['submitted','reporting','report-error','waiting','terminated'].includes(task.value?.status))
const records=computed(()=>task.value?visibleTaskRecords(task.value,store.state.role):[])
const own=computed(()=>ownsTask(store.state.role,task.value)),resumeReason=ref(''),unchanged=ref(true),resumeError=ref('')
function resume(){try{store.resumeTask(event.value.id,task.value.id,{reason:resumeReason.value,unchanged:unchanged.value});resumeError.value=''}catch(e){resumeError.value=e.message}}
const selectedReportId=ref(null),taskReports=computed(()=>event.value?.reports.filter(r=>r.taskId===task.value?.id)||[]),latestReport=computed(()=>taskReports.value.at(-1))
const report=computed(()=>taskReports.value.find(r=>r.id===selectedReportId.value)||latestReport.value)
async function assistStep(index){assistantOpen.value=true;await nextTick();assistant.value?.assistStep(index)}
async function supplement(){assistantOpen.value=true;await nextTick();assistant.value?.supplementReport(report.value.id)}
async function moveReportTab(event){
 if(!report.value||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
 event.preventDefault();tab.value=event.key==='Home'?'任务步骤':event.key==='End'?'提交记录':tab.value==='提交记录'?'任务步骤':'提交记录'
 const list=event.currentTarget;await nextTick();list.querySelector('[aria-selected="true"]')?.focus()
}
function openReport(id){selectedReportId.value=id;tab.value='提交记录'}
const canSupplement=computed(()=>report.value&&supplementaryReports(event.value,store.state.role).some(r=>r.id===report.value.id))
watch([()=>task.value?.id,()=>store.state.role],()=>{assistantOpen.value=true;tab.value='任务步骤';selectedReportId.value=null;if(event.value&&allowed.value&&route.name==='LifecycleTask')store.acknowledge(event.value.id)},{immediate:true})
async function showSubmission(){assistantOpen.value=true;await nextTick();assistant.value?.revealReport()}
watch([()=>task.value?.status,()=>task.value?.reportGeneration?.requestId],()=>{if(['reporting','report-error'].includes(task.value?.status))void showSubmission()},{immediate:true})
function submitted(){assistantOpen.value=true;openReport(latestReport.value?.id)}
function back(){router.push({path:'/event',query:route.query.returnView&&route.query.returnView!=='pending'?{view:route.query.returnView}:{}})}
</script>
<style scoped>
.task-header-actions{display:flex;align-items:center;gap:12px;flex:none}.task-header-actions .task-assistant-open{margin:0;font-size:12px;white-space:nowrap}@media(max-width:760px){.task-header-actions{flex-direction:column;align-items:flex-end;gap:8px}}
.report-submissions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.report-submissions button{border:1px solid #e2e4dd;background:#fff;padding:8px 12px;border-radius:6px;color:#637583;cursor:pointer;font-size:12px}.report-submissions button[aria-pressed=true]{background:#f4f0e7;border-color:#bca878;color:#806638}
.task-submitted-status{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;width:100%}
.task-report-actions{display:flex;align-items:center;gap:12px;width:100%;min-width:0;overflow-x:auto;padding:2px 0 4px}.task-report-actions-right{display:flex;align-items:center;gap:10px;flex:none}.task-report-actions-right{margin-left:auto}.task-report-actions button{white-space:nowrap}.task-report-actions button:disabled{opacity:.45;cursor:default}.task-report-tabs{gap:22px;border-bottom:0;align-self:stretch}.task-report-tabs button{margin:0;min-height:40px;padding:10px 0}.task-report-actions{border-bottom:1px solid #e5eaf0;padding-bottom:0}.task-report-actions-right{padding-bottom:6px}
.task-submitted .task-report-actions-right button{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin:0;min-height:34px;padding:6px 12px;border:1px solid #dedfd5;border-radius:7px;background:linear-gradient(#fff,#fafaf7);color:#876c3e;box-shadow:0 1px 2px #25302606;transition:background .15s,border-color .15s}
.task-submitted .task-report-actions-right button:hover{background:#f7f6ef;border-color:#c3b58e}
.task-submitted .task-report-actions .task-supplement{color:#536d68}
.task-supplement svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linejoin:round}
.task-report-actions button:focus-visible{outline:2px solid #9b8559;outline-offset:3px}
.task-main{padding:24px!important}.task-detail-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}.task-heading{display:flex;align-items:center;gap:14px;min-width:0}.task-heading small{font-size:12px;color:#8a98a8}.task-heading h1{font-size:22px;line-height:1.5;margin:6px 0 0;color:#2c4055;font-weight:600}.task-state{padding:6px 11px;background:#f5f0e5;color:#9b773c;border-radius:6px;font-size:12px;white-space:nowrap}.task-state.done{background:#edf4ef;color:#5e816b}.task-basics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px 24px;padding:18px 0;border-top:1px solid #e8ecef;border-bottom:1px solid #e8ecef;margin:0 0 20px;font-size:13px}.task-basics>div{min-width:0}.task-basics dt{font-size:12px;color:#91a0af;margin-bottom:6px}.task-basics dd{margin:0;color:#526b83;line-height:1.7}.task-event-info{grid-column:1/-1;display:flex;gap:20px;align-items:baseline}.task-event-info dd{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 20px}.task-event-info button{border:0;background:none;padding:0;color:#687d93;font:inherit;text-align:left;cursor:pointer}.task-event-info button:hover{color:#997840}.task-event-info small{color:#96a0ac;font-size:11px}.task-scope{border-left:3px solid #c6ad80;background:#faf9f5;padding:14px 18px;margin:0 0 18px}.task-scope h2{font-size:14px;margin:0 0 6px;font-weight:600}.task-scope p{font-size:13px;line-height:1.8;color:#62788e;margin:0}.task-detail-content h2{font-size:18px}.task-detail-content h3{font-size:15px;color:#3c526b}.task-detail-content{padding-top:16px}.task-detail-content :deep(.lc-task-wizard){margin-top:0}.task-detail-content :deep(.lc-step-editor){min-height:360px}.task-detail-content :deep(.lc-repair-wizard .lc-step-editor){min-height:0}.task-submitted{display:flex;align-items:center;flex-wrap:wrap;gap:10px 20px;padding:10px 0;font-size:12px;color:#84958a}.task-submitted strong{color:#5b8066;font-weight:500}.task-submitted .task-report-actions-right button{border:0;background:none;color:#9a783c;font:inherit;cursor:pointer;margin-left:auto}.task-progress{display:flex;justify-content:space-between;gap:16px;font-size:13px;margin-bottom:12px}.task-progress span{color:#8495a8}.task-record{padding:10px 12px;background:#f6f8fa;color:#6b8196;font-size:13px;line-height:1.7}.task-record strong{font-weight:500}.task-record span{display:block;margin-top:5px;white-space:pre-wrap}.task-basis-copy,.task-source-report p{font-size:14px;color:#62788e;line-height:1.8}.task-source-report{padding:10px 18px;background:#f8f9fb;border-radius:8px;margin:20px 0}.task-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.task-facts>div{padding:16px;background:#f7f9fb;border-radius:8px}.task-facts small{display:block;font-size:12px;color:#8a9aab}.task-facts strong{display:block;margin:8px 0;color:#435c75;font-size:16px}.task-facts p{margin:0;color:#8596a8;font-size:12px;line-height:1.8}
@media(min-width:1101px){.task-main{padding:18px 22px!important}.task-detail-head{margin-bottom:14px}.task-basics{padding:12px 0;gap:10px 24px;margin-bottom:14px}.task-basics dt{margin-bottom:3px}.task-scope{padding:10px 14px;margin-bottom:12px}.task-scope h2{margin-bottom:3px}.task-scope p{line-height:1.65}.task-detail-content{padding-top:10px}.task-detail-content :deep(.lc-stepper){padding-bottom:12px}.task-detail-content :deep(.lc-step-editor){padding-top:12px;gap:14px}.task-detail-content :deep(.lc-step-instructions aside){padding:8px 12px}.task-detail-content :deep(.lc-step-editor footer){padding-top:10px}.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-note textarea){height:84px;min-height:106px}}
@media(min-width:1101px) and (max-height:950px){.task-main{padding:14px 20px!important}.task-detail-head{margin-bottom:10px}.task-heading h1{font-size:20px}.task-basics{grid-template-columns:2fr 1fr 1fr 1.2fr 1.2fr;gap:16px;padding:10px 0;margin-bottom:10px}.task-event-info{grid-column:auto;display:block}.task-event-info dd{display:block}.task-event-info small{display:block;font-size:10px}.task-scope{padding:8px 12px;margin-bottom:8px}.task-main>.lc-tabs button{padding-top:10px;padding-bottom:10px}.task-detail-content :deep(.lc-operation-compact h4){flex-basis:140px}.task-detail-content :deep(.lc-step-editor){gap:10px 20px}.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-editor){display:grid;grid-template-columns:minmax(240px,.8fr) minmax(0,1.2fr);min-height:0}.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-instructions),.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-editor>h3),.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-review),.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-review~.lc-step-note),.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-editor footer),.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-error){grid-column:1/-1}.task-detail-content :deep(.lc-task-wizard:not(.lc-repair-wizard) .lc-step-note textarea){height:106px}}
@media(min-width:1101px) and (max-height:950px){.task-scope{display:flex;align-items:baseline;gap:12px}.task-scope h2{flex:none;margin:0}.task-detail-content :deep(.lc-stepper){padding-bottom:8px}.task-detail-content :deep(.lc-operation-compact>section){padding-top:4px;padding-bottom:4px}}
@media(max-width:1100px){.task-main{padding:18px!important}.task-basics{grid-template-columns:repeat(2,minmax(0,1fr))}.task-heading h1{font-size:19px}}@media(max-width:760px){.task-detail-head{align-items:flex-start;gap:12px}.task-heading{align-items:flex-start;gap:10px}.task-heading h1{font-size:17px}.task-heading small{font-size:10px}.task-state{padding:4px 7px;font-size:11px}.task-event-info{display:block}.task-basics{gap:14px}.task-facts{grid-template-columns:1fr}.task-detail-content :deep(.lc-step-editor){min-height:0}.task-progress{flex-wrap:wrap}}
</style>

<style scoped>
@media(min-width:1101px){
 .task-main:has(.lc-task-wizard){padding:14px 20px!important}
 .task-main:has(.lc-task-wizard) .task-detail-head{margin-bottom:8px}
 .task-main:has(.lc-task-wizard) .task-heading h1{font-size:20px;margin:4px 0 0}
 .task-main:has(.lc-task-wizard) .task-basics{grid-template-columns:2fr 1fr 1fr 1.2fr 1.2fr;gap:12px;padding:9px 0;margin-bottom:8px}
 .task-main:has(.lc-task-wizard) .task-event-info{grid-column:auto;display:block}
 .task-main:has(.lc-task-wizard) .task-event-info dd,.task-main:has(.lc-task-wizard) .task-event-info small{display:block}
 .task-main:has(.lc-task-wizard) .task-event-info small{font-size:10px}
 .task-main:has(.lc-task-wizard) .task-detail-content{padding-top:3px}
 .task-main:has(.lc-task-wizard) :deep(.lc-stepper){padding-bottom:7px}
 .task-main:has(.lc-task-wizard) :deep(.lc-stepper button){min-height:36px}
 .task-main:has(.lc-task-wizard) :deep(.lc-step-editor){padding-top:7px}
}
</style>

<style scoped>
/* Keep feedback and navigation below the full work text without overlap. */
@media(min-width:1101px){
 .task-main:has(.lc-task-wizard){display:flex;flex-direction:column;min-height:0;overflow:hidden}
 .task-main:has(.lc-task-wizard)>.task-detail-head,.task-main:has(.lc-task-wizard)>.task-basics,.task-main:has(.lc-task-wizard)>.task-scope{flex:none}
 .task-main:has(.lc-task-wizard)>.task-detail-content{display:flex;flex-direction:column;flex:1;min-height:0}
 .task-main :deep(.lc-task-wizard){display:flex;flex-direction:column;flex:1;min-height:0}
 .task-main :deep(.lc-stepper){flex:none}
 .task-main :deep(.lc-task-wizard .lc-step-editor){display:flex!important;flex:0 1 auto;min-height:0;overflow:hidden}
 .task-main :deep(.lc-step-instructions){flex:0 1 auto;min-height:0;overflow:auto;padding-right:5px}
 .task-main :deep(.lc-task-feedback),.task-main :deep(.lc-step-editor>footer),.task-main :deep(.lc-final-supplement){flex:none}
}
</style>
