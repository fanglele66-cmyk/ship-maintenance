<template>
<article v-if="issue" ref="rootRef" class="captain-detail">
  <BackButton :label="route.query.from==='issues'?'返回事件目录':route.query.from==='workbench'?'返回船舶态势':route.query.from==='device'?'返回'+issue.device+'相关事项':'返回'+issue.device+'概览'" @click="$emit('back',issue.deviceId)"/>
  <header>
    <div><span class="issue-type">{{issue.type}} · {{issue.device}}</span><h2>{{issue.title}}</h2></div>
    <span>{{issue.state==='已闭环'?'已结束':issue.state}}</span>
  </header>
  <nav role="tablist">
    <button v-for="tab in tabs" :key="tab" role="tab" :aria-selected="active===tab" :class="{active:active===tab}" @click="goTab(tab)">{{tab}}</button>
  </nav>
  <main>
    <!-- 事项概览：结论与建议先行，关键依据摘要，推理可展开，快链与下一步 -->
    <template v-if="active==='事项概览'">
      <MarkdownContent :content="dossier.overviewMarkdown"/>
      <div class="quick-links" aria-label="页签快链">
        <button type="button" @click="goTab('研判分析')">查看研判分析</button>
        <button type="button" @click="goTab('证据资料')">查看证据资料</button>
      </div>
      <button v-if="issue.type==='异动跟踪'" type="button" class="tracking-entry" @click="goTab('健康趋势观测')"><span><strong>健康趋势观测</strong><small>持续变化、现场核实与阶段性维保建议</small></span><span aria-hidden="true">查看跟踪 →</span></button>
      <section v-if="issue.history||store.eventStatus[issue.id]==='closed'" class="dossier-block"><h3>已记录的结果</h3><p>{{store.completedTasks[issue.id]?.reason||store.executionRecords[issue.id]?.at(-1)?.values.acceptance||issue.reason}}</p><p>{{issue.outcome||'来源资料、实际措施与本次确认保留，可在设备动态回查。'}}</p></section>
      <section v-else-if="!issue.isTrackingContainer" class="next-step">
        <TaskAssignment :scenario="issue.id" :allow-ignore="issue.type!=='报警事件'" :action-title="issue.type==='报警事件'?'安排报警排查':issue.type==='预警事件'?'安排预警现场核实':'评估并安排检查'"/>
        <button v-if="store.todoCreated[issue.id]" class="p2-primary" @click="openTask">查看处理任务</button>
        <template v-else-if="issue.type==='报警事件'">
          <button class="p2-link-button" @click="falseAlarmOpen=!falseAlarmOpen">反馈误报</button>
          <button v-if="falseAlarmOpen&&!feedback&&store.cases[issue.id]?.realCaseId" class="p2-secondary" @click="falseAlarmReason=decisionPreset(store.cases[issue.id],'false-alarm')">填写误报核实依据</button>
          <InquiryMessage v-if="falseAlarmOpen||feedback" :message="falseAlarmInquiry" @submit-inquiry="reportFalseAlarm"/>
        </template>
      </section>
    </template>
    <HealthTrendObservation v-else-if="active==='健康趋势观测'" :scenario="issue.id" />
    <!-- 研判分析：观察事实、推断、候选解释与未确认问题分层 -->
    <template v-else-if="active==='研判分析'">
      <MarkdownContent :content="dossier.analysisMarkdown"/>
      <div class="quick-links" aria-label="返回概览">
        <button type="button" @click="goTab('事项概览')">返回事项概览</button>
      </div>
    </template>
    <!-- 证据资料：数据快照、观测节点趋势、证据链、计划来源、人员反馈与决定 -->
    <template v-else>
      <MarkdownContent :content="dossier.evidenceMarkdown"/>
      <section class="dossier-block">
        <h3>发生时数据快照</h3>
        <table v-if="dossier.snapshots?.length" class="candidate-table">
          <thead><tr><th>测点/项目</th><th>数值</th><th>参考口径</th><th>说明</th><th>来源</th></tr></thead>
          <tbody>
            <tr v-for="snap in dossier.snapshots" :key="snap.name+snap.value">
              <th scope="row">{{snap.name}}</th>
              <td>{{snap.value}}</td>
              <td>{{snap.reference}}</td>
              <td>{{snap.meaning}}</td>
              <td>{{snap.source}}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="block-empty">暂无数据快照。</p>
      </section>
      <section class="dossier-block">
        <h3>已有观测节点</h3>
        <template v-if="dossier.series?.length">
          <div v-for="series in dossier.series" :key="series.name" class="series-block">
            <header><b>{{series.name}}</b><span v-if="series.unit">（{{series.unit}}）</span><small>{{series.scope}}</small></header>
            <ObservationTrend :series="series"/>
          </div>
          <p class="limit-note">节点折线仅连接已有观测记录，节点口径见各图说明；未补时间点。</p>
        </template>
        <p v-else class="block-empty">该事项暂无连续观测节点记录，仅保留上方数据快照；不拼凑连续趋势。</p>
      </section>
      <section class="dossier-block">
        <h3>关联证据与判断范围</h3>
        <ul class="evidence-list">
          <li v-for="text in issue.evidence" :key="text">{{text}}</li>
        </ul>
        <p class="limit-note">{{issue.limit}}</p>
      </section>
      <section v-if="dossier.plan?.length" class="dossier-block">
        <h3>计划与安排来源</h3>
        <table class="candidate-table">
          <thead><tr><th>项目</th><th>内容</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="row in dossier.plan" :key="row.label">
              <th scope="row">{{row.label}}</th>
              <td>{{row.value}}</td>
              <td>{{row.status}}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <SituationTimeline v-if="dossier.timeline?.length" :entries="dossier.timeline" expanded/>
      <section class="dossier-block">
        <h3>人员补充与已有决定</h3>
        <p v-if="issue.history">{{issue.at}} · {{issue.actor}}：{{issue.reason}}</p>
        <div v-for="recordId in recordIds" :key="recordId" class="task-provenance-record">
          <h4 v-if="recordId!==issue.id">跟踪内维保评估 · {{store.cases[recordId]?.initialTitle}}</h4>
          <p v-if="store.completedTasks[recordId]">本轮任务已结束：{{store.completedTasks[recordId].reason}}</p>
          <p v-else-if="store.todoCreated[recordId]">轮机长已派发给 {{store.assignments[recordId]?.owner}}，当前处于{{store.cases[recordId]?.stages[store.progress[recordId]]?.label}}阶段。</p>
          <p v-else-if="store.ignoredSuggestions[recordId]">本次不采纳：{{store.ignoredSuggestions[recordId].reason}}</p>
          <p v-else-if="!issue.history">尚未派发处理任务。</p>
          <p v-for="record in store.assignmentRecords[recordId]||[]" :key="'assign'+record.at">{{record.at}} · {{record.assignedBy}}指定{{record.owner}}：{{record.scope}}</p>
          <p v-for="record in store.dossierNotes[recordId]||[]" :key="record.id">{{record.at}} · {{record.text}}</p>
          <template v-for="(entry,index) in store.stageHistory[recordId]||[]" :key="index"><p><b>{{entry.at}} · {{entry.title}}</b></p><p v-for="record in entry.records||[]" :key="record.label">{{record.label}}：{{record.result}}；{{record.note||'未附备注'}}</p></template>
        </div>
      </section>
    </template>
  </main>
</article>
<div v-else class="p2-empty">未找到该事项，请返回态势中心。</div>
</template>
<script setup>
import {decisionPreset} from '@/mock/realScenarioPresets'
import SituationTimeline from './SituationTimeline.vue'
import {computed,nextTick,ref,watch} from 'vue'
import ObservationTrend from './ObservationTrend.vue'
import {useRoute,useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {workbenchIssues} from '@/mock/captainWorkbench'
import {storyDossier} from '@/mock/fourStoryWorkflow'
import MarkdownContent from './MarkdownContent.vue'
import HealthTrendObservation from './HealthTrendObservation.vue'
import InquiryMessage from './messages/InquiryMessage.vue'
import assignmentTemplate from '@/message-flows/task-assignment.json'
import BackButton from './BackButton.vue'
import TaskAssignment from './TaskAssignment.vue'
const props=defineProps({scenario:String}),store=usePhase2DemoStore(),router=useRouter(),route=useRoute()
watch(()=>props.scenario,id=>store.openRealCase(id),{immediate:true})
const tabs=computed(()=>['事项概览',...(issue.value?.type==='异动跟踪'?['健康趋势观测']:[]),'研判分析','证据资料']),active=ref('事项概览'),falseAlarmOpen=ref(false),falseAlarmReason=ref(''),feedback=ref(false)
const rootRef=ref(null),overviewScroll=ref(0)
const issue=computed(()=>workbenchIssues(store).find(item=>item.id===props.scenario))
const recordIds=computed(()=>[...new Set([...(issue.value?.isTrackingContainer?[]:[props.scenario]),...(issue.value?.maintenanceRecommendations||[]).map(item=>item.id)])])
watch(()=>[props.scenario,store.eventStatus[props.scenario]],()=>{if(store.eventStatus[props.scenario]==='pending'){falseAlarmOpen.value=false;falseAlarmReason.value='';feedback.value=false;active.value=tabs.value[0]}})
watch(()=>[props.scenario,route.query.tab],()=>{active.value=tabs.value.includes(route.query.tab)?route.query.tab:tabs.value[0]},{immediate:true})
const dossier=computed(()=>storyDossier(store,props.scenario))
const openQuestions=computed(()=>{
  const items=(dossier.value.comparisons||[]).map(row=>row.missing).filter(Boolean)
  return [...new Set(items)]
})
function goTab(tab){
  if(active.value==='事项概览'&&tab!=='事项概览')overviewScroll.value=rootRef.value?.scrollTop||0
  active.value=tab
  if(tab==='事项概览')nextTick(()=>{if(rootRef.value)rootRef.value.scrollTop=overviewScroll.value})
}
function openTask(){const id=issue.value.taskId||issue.value.id;store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
const falseAlarmInquiry=computed(()=>({...assignmentTemplate.falseAlarm,text:'确认误报依据',hint:'记录现场核对与判断依据。本次处置将结束，原报警和快照仍保留。',id:'false-alarm-'+props.scenario,status:feedback.value?'submitted':'pending',values:{reason:falseAlarmReason.value},submitLabel:'确认误报并留档',receiptText:'本次误报决定及依据已保存，原始报警仍可回查。'}))
function reportFalseAlarm(payload){const reason=payload.values.reason;if(!store.confirmFalseAlarm(issue.value.id,reason))return;falseAlarmReason.value=reason;feedback.value=true;falseAlarmOpen.value=false}
async function showSection(section){if(section==='decision'){active.value=issue.value?.isTrackingContainer?'健康趋势观测':'事项概览';await nextTick();rootRef.value?.querySelector('.task-assignment')?.scrollIntoView({block:'start',behavior:'smooth'})}else if(tabs.value.includes(section)){goTab(section);await nextTick();if(rootRef.value)rootRef.value.scrollTop=0}}
defineExpose({showSection})
defineEmits(['back'])
</script>
<style scoped>
.captain-detail{width:100%;min-width:0;height:100%;overflow:auto;scrollbar-gutter:stable;background:white;padding:24px;box-sizing:border-box;color:#445870;font-size:var(--wb-body,14px);line-height:1.8}
.captain-detail header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:20px 0}
.captain-detail h2{color:#202020;font-size:22px;margin:5px 0}
.issue-type{color:#7a8595;font-size:13px}
.captain-detail nav{display:flex;gap:26px;flex-wrap:wrap;border-bottom:1px solid #e4eaf1}
.captain-detail nav button{border:0;background:none;padding:10px 0;color:#68788e;font:inherit;cursor:pointer}
.captain-detail nav .active{color:#936821;border-bottom:2px solid #b49359}
.captain-detail main{width:100%;min-width:0;max-width:none}.captain-detail main>*{min-width:0;box-sizing:border-box}.captain-detail p,.captain-detail li,.captain-detail td,.captain-detail th{overflow-wrap:break-word;word-break:normal}
.captain-detail h3{font-size:15px;color:#30445d;margin:20px 0 6px}
.captain-detail :deep(.markdown-content){max-width:68em;font-size:15px;line-height:1.9}
.captain-detail p{margin:6px 0}
.captain-detail textarea{display:block;box-sizing:border-box;width:100%;min-height:90px;border:1px solid #dce3ec;padding:12px;font:inherit;margin:8px 0}
.captain-detail form{margin:12px 0}
.captain-detail header>div{min-width:0}.captain-detail header>span{flex-shrink:0;white-space:nowrap}.captain-detail h2{overflow-wrap:break-word}
.dossier-lead{background:#faf8f3;border:1px solid #eee4d2;border-radius:8px;padding:14px 18px;margin-top:14px}
.lead-conclusion{font-weight:600;color:#33415a;margin:4px 0 10px}
.lead-recommendation{color:#4c5f78}
.dossier-block{margin-top:18px}
.snapshot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px;margin:10px 0}
.snapshot-card{border:1px solid #e4eaf1;border-radius:8px;padding:12px 14px;background:#fbfcfe;display:flex;flex-direction:column;gap:4px}
.snapshot-card small{color:#7a8595;font-size:12px}
.snapshot-card strong{font-size:18px;color:#24354c;font-variant-numeric:tabular-nums}
.snapshot-card p{margin:0;font-size:12px;color:#68788e}
.snapshot-card span{font-size:12px;color:#4c5f78}
.snapshot-card em{font-style:normal;font-size:11px;color:#8a94a5}
.limit-note{font-size:12px;color:#8a7a5c;background:#faf8f3;border-radius:6px;padding:8px 12px;margin:8px 0 0}
.reasoning{margin:14px 0 4px;border:1px solid #e4eaf1;border-radius:8px;background:#fff}
.reasoning summary{cursor:pointer;padding:10px 14px;color:#8b682d;font-size:13px}
.reason-step{padding:10px 16px;border-top:1px solid #edf0f5}
.reason-step b{display:block;color:#30445d;font-size:13px;margin-bottom:4px}
.reason-step p{margin:4px 0;font-size:13px;color:#54677f}
.reason-step p span{display:inline-block;background:#f1ede2;color:#8b682d;border-radius:4px;padding:1px 7px;font-size:11px;margin-right:8px}
.quick-links{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.quick-links button{border:1px solid #d8c4a2;background:#fff;color:#8b682d;border-radius:7px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}
.quick-links button:hover{background:#faf5eb}
.next-step{margin-top:8px}
.tracking-entry{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #e5ddcc;background:#faf8f3;color:#8b682d;padding:17px 18px;border-radius:8px;text-align:left;cursor:pointer;font:inherit;margin:18px 0}.tracking-entry strong,.tracking-entry small{display:block}.tracking-entry small{font-size:12px;color:#7e8895;margin-top:3px}.tracking-entry>span:last-child{white-space:nowrap;font-size:13px}.tracking-entry:focus-visible{outline:2px solid #a78a59;outline-offset:2px}
.candidate-table{table-layout:fixed;width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
.candidate-table th,.candidate-table td{border:1px solid #e4eaf1;padding:9px 11px;text-align:left;vertical-align:top;line-height:1.6}
.candidate-table thead th{background:#f6f4ee;color:#5c6b80;font-size:12px}
.candidate-table tbody th{color:#33415a;font-weight:600;background:#fbfcfe;width:auto}
.open-questions{margin:8px 0;padding-left:20px}
.open-questions li{margin:5px 0}
.block-empty{font-size:13px;color:#8593a5;background:#f7f9fc;border:1px dashed #d9e3ef;border-radius:6px;padding:10px 14px}
.series-block{border:0;border-bottom:1px solid #e4eaf1;border-radius:0;padding:12px 0;margin:10px 0;background:#fff}
.series-block header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin:0 0 6px}
.series-block header b{color:#30445d;font-size:13px}
.series-block header span{color:#68788e;font-size:12px}
.series-block header small{margin-left:auto;color:#8a94a5;font-size:11px}
.evidence-list{margin:8px 0;padding-left:20px}
.evidence-list li{margin:5px 0}

@media(max-width:1200px){.captain-detail{padding:20px}.captain-detail h2{font-size:20px}}
@media(max-width:600px){.captain-detail{padding:16px}.captain-detail header{gap:12px;flex-wrap:wrap}.captain-detail nav{gap:18px}.candidate-table th,.candidate-table td{padding:7px 5px;font-size:12px}}
</style>
