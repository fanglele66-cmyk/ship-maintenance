<template>
<article v-if="issue" ref="rootRef" class="captain-detail">
  <BackButton :label="route.query.from==='issues'?'返回事件目录':route.query.from==='workbench'?'返回船舶态势':route.query.from==='device'?'返回'+issue.device+'相关事件':'返回'+issue.device+'概览'" @click="$emit('back',issue.deviceId)"/>
  <header>
    <div><span class="issue-type">{{issue.type}} · {{issue.device}}</span><h2>{{issue.title}}</h2></div>
    <span>{{issue.eventState}}</span>
  </header>
  <nav role="tablist">
    <button v-for="tab in tabs" :key="tab" role="tab" :aria-selected="active===tab" :class="{active:active===tab}" @click="goTab(tab)">{{tab}}</button>
  </nav>
  <main>
    <!-- 事件概览：结论与建议先行，关键依据摘要，推理可展开，快链与下一步 -->
    <template v-if="active==='事件概览'">
      <EventDecisionBrief v-if="briefing" :brief="decisionBriefing" :event-type="issue.type"/>
      <MarkdownContent v-else :content="dossier.overviewMarkdown"/>
      <section v-if="briefing&&hasCurrentUpdate&&!store.trackingDispositions[issue.id]" class="dossier-block current-event-update"><h3>当前处置状态</h3><p>{{dossier.overviewSummary}}</p></section>
      <TrackingDisposition :scenario="issue.id"/>
      <details v-if="issue.history && dossier.timeline?.length" class="dossier-block"><summary>历史核实与闭环依据</summary><SituationTimeline :entries="dossier.timeline" expanded/></details>
      <section v-if="(issue.history||issue.eventState==='已闭环')&&!hasCurrentUpdate" class="dossier-block"><h3>处置结果</h3><p>{{dossier.reference?.result||store.completedTasks[issue.id]?.reason||issue.reason}}</p></section>
      <section v-else-if="issue.eventState!=='已闭环'&&!issue.isTrackingContainer&&!store.isTaskHandled(issue.id)" class="next-step">
        <TaskAssignment :scenario="issue.id" :allow-ignore="issue.type!=='报警事件'" :action-title="issue.type==='报警事件'?'安排报警排查':issue.type==='预警事件'?'安排预警现场核实':'评估并安排检查'">
          <template #secondary-action><button v-if="issue.type==='报警事件'" type="button" class="p2-secondary" @click="falseAlarmOpen=!falseAlarmOpen">{{falseAlarmOpen?'取消误报反馈':'反馈误报'}}</button></template>
        </TaskAssignment>
        <button v-if="store.todoCreated[issue.id]" class="p2-primary" @click="openTask">查看处理任务</button>
        <template v-else-if="issue.type==='报警事件'">
          <InquiryMessage v-if="falseAlarmOpen||feedback" :message="falseAlarmInquiry" @submit-inquiry="reportFalseAlarm"/>
        </template>
      </section>
    </template>
    <LinkedMaintenanceTasks v-else-if="active==='维保任务'" :scenario="issue.id" />
    <template v-else-if="active==='效果观察'"><SituationObservation v-for="taskId in observationTaskIds" :key="taskId" :scenario="taskId" @back="goTab('事件概览')"/></template>
    <!-- 研判分析：观察事实、推断、候选解释与未确认问题分层 -->
    <template v-else-if="active==='研判分析'">
      <BaselineTrend :scenario="issue.id"/><MarkdownContent :content="dossier.analysisMarkdown"/>
      <section v-if="!briefing" class="dossier-block">
        <h3>关联证据与判断范围</h3>
        <ul class="evidence-list">
          <li v-for="text in issue.evidence" :key="text">{{text}}</li>
        </ul>
        <p class="limit-note">{{briefing?.boundary||issue.limit}}</p>
      </section>
      <section v-if="dossier.plan?.length" class="dossier-block">
        <h3>计划与安排来源</h3>
        <table class="candidate-table">
          <thead><tr><th>项目</th><th>内容</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="row in dossier.plan" :key="row.label||row.name">
              <th scope="row">{{row.label||row.name}}</th>
              <td>{{row.value}}</td>
              <td>{{row.status||row.meaning}}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <div class="quick-links" aria-label="返回概览">
        <button type="button" @click="goTab('事件概览')">返回事件概览</button>
      </div>
    </template>
    <!-- 证据资料：来源记录、原始采样与曲线；解释和处置进展由对应页签承载 -->
    <template v-else>
      <EventEvidenceSources v-if="briefing" :brief="briefing"/>
      <MarkdownContent v-else :content="dossier.evidenceMarkdown"/>
      <section class="dossier-block">
        <h3>{{briefing?.temporalScope==='post-repair-followup'?'原低压事件采样记录':'测点采样记录'}}</h3>
        <div v-if="briefing&&rawSnapshots.length" class="source-facts-scroll" tabindex="0" aria-label="测点采样记录"><table class="candidate-table source-facts-table"><thead><tr><th>测点</th><th>记录数值</th><th>采样时间</th></tr></thead><tbody><tr v-for="sample in rawSnapshots" :key="sample.name"><th scope="row">{{sample.name}}</th><td>{{sample.value}} {{sample.unit}}</td><td>{{sample.at}}</td></tr></tbody></table></div>
        <table v-else-if="dossier.snapshots?.length" class="candidate-table">
          <thead><tr><th>测点/项目</th><th>数值</th><th>记录时间</th><th>来源</th></tr></thead>
          <tbody>
            <tr v-for="snap in dossier.snapshots" :key="snap.name+snap.value">
              <th scope="row">{{snap.name}}</th>
              <td>{{snap.value}}</td>
              <td>{{snap.reference}}</td>
              <td>{{snap.source}}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="block-empty">暂无数据快照。</p>
      </section>
      <section class="dossier-block">
        <h3>原始观测趋势 <small v-if="dossier.series?.length">{{dossier.series.length}} 组测点 · 展开查看</small></h3>
        <template v-if="dossier.series?.length">
          <details v-for="(series,index) in dossier.series" :key="scenario+':'+index" class="source-series" @toggle="toggleSeries(index,$event)">
            <summary><strong>{{series.name}}<small v-if="series.unit">（{{series.unit}}）</small></strong><time>{{series.labels?.[0]}} — {{series.labels?.at(-1)}}</time></summary>
            <div v-if="openedSeries.has(index)" class="source-series-chart">
              <p v-if="!briefing">{{series.scope}}</p><ObservationTrend :series="series"/>
              <details class="sample-records"><summary>采样明细 · {{series.labels.length}} 条</summary><div class="sample-records-table" tabindex="0" :aria-label="series.name+'采样明细'"><table class="candidate-table"><thead><tr><th>采样时间</th><th>数值</th><th>单位</th></tr></thead><tbody><tr v-for="(at,pointIndex) in series.labels" :key="pointIndex"><td>{{at}}</td><td>{{Number.isFinite(series.values[pointIndex])?series.values[pointIndex]:'—'}}</td><td>{{series.unit}}</td></tr></tbody></table></div></details>
            </div>
          </details>
        </template>
        <p v-else class="block-empty">暂无连续采样记录。</p>
      </section>



    </template>
  </main>
</article>
<div v-else class="p2-empty">未找到该事件，请返回态势中心。</div>
</template>
<script setup>
import BaselineTrend from './BaselineTrend.vue'
import TrackingDisposition from './TrackingDisposition.vue'
import {taskChildIds,maintenanceChildIds} from '@/mock/issueRelationships'
import SituationTimeline from './SituationTimeline.vue'
import SituationObservation from './SituationObservation.vue'
import {computed,nextTick,ref,watch} from 'vue'
import ObservationTrend from './ObservationTrend.vue'
import {useRoute,useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {workbenchIssues} from '@/mock/captainWorkbench'
import {storyDossier} from '@/mock/fourStoryWorkflow'
import MarkdownContent from './MarkdownContent.vue'
import LinkedMaintenanceTasks from './LinkedMaintenanceTasks.vue'
import InquiryMessage from './messages/InquiryMessage.vue'
import assignmentTemplate from '@/message-flows/task-assignment.json'
import BackButton from './BackButton.vue'
import TaskAssignment from './TaskAssignment.vue'
import EventDecisionBrief from './EventDecisionBrief.vue'
import EventEvidenceSources from './EventEvidenceSources.vue'
import {eventBriefingFor} from '@/mock/eventBriefings'
import {observationConfig} from '@/mock/phase2Observation'
const props=defineProps({scenario:String}),store=usePhase2DemoStore(),router=useRouter(),route=useRoute()
watch(()=>props.scenario,id=>store.openRealCase(id),{immediate:true})
const tabs=computed(()=>['事件概览',...(issue.value?.type==='异动跟踪'&&maintenanceTaskIds.value.length?['维保任务']:[]),'研判分析',...(observationTaskIds.value.length?['效果观察']:[]),'证据资料']),active=ref('事件概览'),falseAlarmOpen=ref(false),falseAlarmReason=ref(''),feedback=ref(false)
const rootRef=ref(null),overviewScroll=ref(0)
const issue=computed(()=>workbenchIssues(store).find(item=>item.id===props.scenario))
const recordIds=computed(()=>[...new Set([...(issue.value?.isTrackingContainer?[]:[props.scenario]),...taskChildIds(props.scenario).filter(id=>store.todoCreated[id])])])
const maintenanceTaskIds=computed(()=>maintenanceChildIds(props.scenario).filter(id=>store.todoCreated[id]||store.executionRecords[id]?.length))
const hasJournalRecords=computed(()=>store.storyJournal.some(record=>recordIds.value.includes(record.taskId)))
const unloggedNotes=computed(()=>recordIds.value.flatMap(id=>store.dossierNotes[id]||[]).filter(note=>!dossier.value.timeline.some(entry=>entry.text===note.text||note.text==='忽略本次建议：'+entry.text)))
const observationTaskIds=computed(()=>recordIds.value.filter(id=>observationConfig[id]&&(store.executionRecords[id]?.length||store.observationHistory[id]?.length||store.observationRecords[id]?.length)))
watch(tabs,value=>{if(!value.includes(active.value))active.value=tabs.value[0]})
watch(()=>[props.scenario,store.eventStatus[props.scenario]],()=>{if(store.eventStatus[props.scenario]==='pending'){falseAlarmOpen.value=false;falseAlarmReason.value='';feedback.value=false;active.value=tabs.value[0]}})
watch(()=>[props.scenario,route.query.tab],()=>{const tab=normalizeSection(route.query.tab);active.value=tabs.value.includes(tab)?tab:tabs.value[0]},{immediate:true})
const dossier=computed(()=>storyDossier(store,props.scenario))
const briefing=computed(()=>eventBriefingFor(props.scenario))
const decisionBriefing=computed(()=>{
 const record=store.trackingDispositions[props.scenario]
 if(!record?.priorProcessId||record.status!=='review'||record.observationResult)return briefing.value
 return {...briefing.value,
  captainDecision:'结合首轮核实反馈再次确认处置：已有充分解释时确认闭环；仍需现场检查时明确专项维保范围、责任人与条件；资料尚缺时确定补证与观察计划。',
  dispatchReason:'首轮已复核月度相对变化并登记解释范围；工况、历史调整和独立测温校验仍有缺项。后续安排针对剩余信息需求，检查范围由补充证据确定。',
 }
})
const rawSnapshots=computed(()=>(dossier.value.series||[]).flatMap(series=>{
  const index=series.values.findLastIndex(value=>Number.isFinite(value))
  return index<0?[]:[{name:series.name,value:series.values[index],unit:series.unit,at:series.labels[index]}]
}))
const hasCurrentUpdate=computed(()=>dossier.value.hasUpdate&&(Boolean(store.trackingDispositions[props.scenario])||recordIds.value.some(id=>store.checkAssessments[id]||store.executionRecords[id]?.length||store.completedTasks[id]||store.ignoredSuggestions[id])))
const openedSeries=ref(new Set())
watch(()=>props.scenario,()=>{openedSeries.value=new Set()})
function toggleSeries(index,event){if(event.target.open)openedSeries.value.add(index);else openedSeries.value.delete(index)}
function goTab(tab){
  tab=normalizeSection(tab)
  if(active.value==='事件概览'&&tab!=='事件概览')overviewScroll.value=rootRef.value?.scrollTop||0
  active.value=tab
  if(tab==='事件概览')nextTick(()=>{if(rootRef.value)rootRef.value.scrollTop=overviewScroll.value})
}
function openTask(){const id=issue.value.taskId||issue.value.id;if(!store.activeTaskPortfolio.some(item=>item.id===id)){goTab('事件概览');return}store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
const falseAlarmInquiry=computed(()=>({...assignmentTemplate.falseAlarm,text:'确认误报依据',hint:'记录现场核对与判断依据。本次处置将结束，原报警和快照仍保留。',id:'false-alarm-'+props.scenario,status:feedback.value?'submitted':'pending',values:{reason:falseAlarmReason.value},submitLabel:'确认误报并留档',receiptText:'本次误报决定及依据已保存，原始报警仍可回查。'}))
function reportFalseAlarm(payload){const reason=payload.values.reason;if(!store.confirmFalseAlarm(issue.value.id,reason))return;falseAlarmReason.value=reason;feedback.value=true;falseAlarmOpen.value=false}
function normalizeSection(section){return section==='处置记录'?'事件概览':['健康趋势观测','健康趋势分析'].includes(section)?'研判分析':section}
async function showSection(section){section=normalizeSection(section);if(section==='decision'){active.value='事件概览';await nextTick();rootRef.value?.querySelector('.tracking-disposition, .task-assignment')?.scrollIntoView({block:'start',behavior:'smooth'})}else if(tabs.value.includes(section)){goTab(section);await nextTick();if(rootRef.value)rootRef.value.scrollTop=0}}
defineExpose({showSection})
defineEmits(['back'])
</script>
<style scoped>
.captain-detail{width:100%;min-width:0;height:100%;overflow:auto;scrollbar-gutter:stable;background:white;padding:24px;box-sizing:border-box;color:#445870;font-size:var(--wb-body,14px);line-height:1.8}
.captain-detail header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:20px 0}
.captain-detail h2{color:#202020;font-size:var(--wb-title,22px);margin:5px 0}
.issue-type{color:#7a8595;font-size:max(13px,var(--wb-label,12px))}
.captain-detail nav{display:flex;gap:26px;flex-wrap:wrap;border-bottom:1px solid #e4eaf1}
.captain-detail nav button{border:0;background:none;padding:10px 0;color:#68788e;font:inherit;cursor:pointer}
.captain-detail nav .active{color:#936821;border-bottom:2px solid #b49359}
.captain-detail main{width:100%;min-width:0;max-width:none}.captain-detail main>*{min-width:0;box-sizing:border-box}.captain-detail p,.captain-detail li,.captain-detail td,.captain-detail th{overflow-wrap:break-word;word-break:normal}
.captain-detail h3{font-size:max(15px,calc(var(--wb-body,14px) + 2px));color:#30445d;margin:20px 0 6px}
.captain-detail :deep(.markdown-content){max-width:68em;font-size:max(15px,var(--wb-body,14px));line-height:1.9}
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
.snapshot-card small{color:#7a8595;font-size:var(--wb-label,12px)}
.snapshot-card strong{font-size:18px;color:#24354c;font-variant-numeric:tabular-nums}
.snapshot-card p{margin:0;font-size:var(--wb-label,12px);color:#68788e}
.snapshot-card span{font-size:var(--wb-label,12px);color:#4c5f78}
.snapshot-card em{font-style:normal;font-size:var(--wb-label,12px);color:#8a94a5}
.limit-note{font-size:var(--wb-label,12px);color:#8a7a5c;background:#faf8f3;border-radius:6px;padding:8px 12px;margin:8px 0 0}
.reasoning{margin:14px 0 4px;border:1px solid #e4eaf1;border-radius:8px;background:#fff}
.reasoning summary{cursor:pointer;padding:10px 14px;color:#8b682d;font-size:max(13px,calc(var(--wb-body,14px) - 1px))}
.reason-step{padding:10px 16px;border-top:1px solid #edf0f5}
.reason-step b{display:block;color:#30445d;font-size:max(13px,calc(var(--wb-body,14px) - 1px));margin-bottom:4px}
.reason-step p{margin:4px 0;font-size:max(13px,calc(var(--wb-body,14px) - 1px));color:#54677f}
.reason-step p span{display:inline-block;background:#f1ede2;color:#8b682d;border-radius:4px;padding:1px 7px;font-size:var(--wb-label,12px);margin-right:8px}
.quick-links{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.quick-links button{border:1px solid #d8c4a2;background:#fff;color:#8b682d;border-radius:7px;padding:8px 14px;font:inherit;font-size:max(13px,calc(var(--wb-body,14px) - 1px));cursor:pointer;min-height:36px}
.quick-links button:hover{background:#faf5eb}
.next-step{margin-top:8px}
.tracking-entry{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #e5ddcc;background:#faf8f3;color:#8b682d;padding:17px 18px;border-radius:8px;text-align:left;cursor:pointer;font:inherit;margin:18px 0}.tracking-entry strong,.tracking-entry small{display:block}.tracking-entry small{font-size:var(--wb-label,12px);color:#7e8895;margin-top:3px}.tracking-entry>span:last-child{white-space:nowrap;font-size:max(13px,calc(var(--wb-body,14px) - 1px))}.tracking-entry:focus-visible{outline:2px solid #a78a59;outline-offset:2px}
.candidate-table{table-layout:fixed;width:100%;border-collapse:collapse;margin:10px 0;font-size:max(13px,calc(var(--wb-body,14px) - 1px))}
.candidate-table th,.candidate-table td{border:1px solid #e4eaf1;padding:9px 11px;text-align:left;vertical-align:top;line-height:1.6}
.candidate-table thead th{background:#f6f4ee;color:#5c6b80;font-size:var(--wb-label,12px)}
.candidate-table tbody th{color:#33415a;font-weight:600;background:#fbfcfe;width:auto}
.open-questions{margin:8px 0;padding-left:20px}
.open-questions li{margin:5px 0}
.block-empty{font-size:max(13px,calc(var(--wb-body,14px) - 1px));color:#8593a5;background:#f7f9fc;border:1px dashed #d9e3ef;border-radius:6px;padding:10px 14px}
.series-block{border:0;border-bottom:1px solid #e4eaf1;border-radius:0;padding:12px 0;margin:10px 0;background:#fff}
.series-block header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin:0 0 6px}
.series-block header b{color:#30445d;font-size:max(13px,calc(var(--wb-body,14px) - 1px))}
.series-block header span{color:#68788e;font-size:var(--wb-label,12px)}
.series-block header small{margin-left:auto;color:#8a94a5;font-size:var(--wb-label,12px)}
.dossier-block>h3>small{font-weight:400;font-size:var(--wb-label,12px);color:#8b99aa;margin-left:12px}
.source-facts-scroll{max-width:100%;overflow-x:auto}.source-facts-scroll:focus-visible{outline:2px solid #b29360;outline-offset:2px}.source-facts-table{min-width:480px}
.source-series{border-bottom:1px solid #e4eaf1;min-width:0}.source-series>summary{display:flex;align-items:baseline;justify-content:space-between;gap:5px 18px;flex-wrap:wrap;cursor:pointer;padding:12px 4px;list-style:none;font-size:max(13px,calc(var(--wb-body,14px) - 1px));color:#526a85}.source-series>summary:before{content:'›';color:#a58b60}.source-series[open]>summary:before{content:'⌄'}.source-series>summary strong{font-size:max(13px,calc(var(--wb-body,14px) - 1px));font-weight:500;flex:1}.source-series>summary small{font-size:var(--wb-label,12px);color:#8694a6;font-weight:400}.source-series>summary time{font-size:var(--wb-label,12px);color:#8b98a8;font-variant-numeric:tabular-nums}.source-series>summary::-webkit-details-marker{display:none}.source-series>summary:focus-visible{outline:2px solid #b29360;outline-offset:2px}.source-series-chart{padding:0 10px 10px}.source-series-chart>p{font-size:var(--wb-label,12px);color:#7e8c9f}.current-event-content{padding:0 16px 12px}.source-facts-table td:nth-child(2){font-variant-numeric:tabular-nums;color:#344e6b}.source-facts-table th:first-child{width:50%}.source-facts-table th:nth-child(2){width:18%}.source-facts-table th:nth-child(3){width:32%}
.evidence-list{margin:8px 0;padding-left:20px}
.evidence-list li{margin:5px 0}

@media(max-width:1200px){.captain-detail{padding:20px}.captain-detail h2{font-size:20px}}
@media(max-width:600px){.captain-detail{padding:16px}.captain-detail header{gap:12px;flex-wrap:wrap}.captain-detail nav{gap:18px}.candidate-table th,.candidate-table td{padding:7px 5px;font-size:var(--wb-label,12px)}}
.sample-records{margin-top:10px}.sample-records>summary{cursor:pointer;font-size:var(--wb-label,12px);color:#8b682d;padding:8px 0}.sample-records-table{max-height:280px;overflow:auto}.sample-records-table table{margin-top:0;font-variant-numeric:tabular-nums}.sample-records-table th{position:sticky;top:0;background:#f7f8fa}
</style>
