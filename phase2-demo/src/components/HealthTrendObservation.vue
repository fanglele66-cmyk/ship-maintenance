<template>
  <section class="health-observation" aria-label="健康趋势观测">
    <div class="observation-intro">
      <div><span class="observation-kicker">持续观测 · 同一跟踪记录</span><h3>从健康变化到维保安排</h3></div>
      <span class="observation-state">{{ currentStage }}</span>
      <p>结合可比趋势与核实反馈，由轮机长确认变化解释、维保安排或专项观察。确认维保安排后，本次异动事件闭环，关联维保任务独立推进。</p>
    </div>
    <ol class="observation-stages" aria-label="健康跟踪阶段">
      <li v-for="(label, index) in stages" :key="label" :class="{ current: index === stageIndex, reached: index < stageIndex }">
        <span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ label }}</strong>
      </li>
    </ol>

    <HealthTrackingPanel :request-id="scenario" detail embedded />

    <section v-if="!recommendations.length&&!store.trackingDispositions[scenario]&&!store.canDecideTracking(scenario)" class="observation-waiting">
      <h3>当前持续观测，尚未形成维保建议</h3>
      <p>先核对变化是否持续、工况是否可比，以及现场信息是否充分。形成新的检查需求后，再在此处评估必要性与实施条件。</p>
    </section>
    <article v-for="recommendation in recommendations" :id="'recommendation-' + recommendation.id" :key="recommendation.id" class="tracking-recommendation">
      <header><div><small>本跟踪的阶段建议</small><h3>{{ recommendation.initialTitle }}</h3></div><span>{{ recommendationState(recommendation.id) }}</span></header>
      <MarkdownContent :content="storyDossier(store, recommendation.id).currentMarkdown" />
      <details class="recommendation-basis">
        <summary>建议依据与原计划</summary>
        <MarkdownContent :content="storyDossier(store, recommendation.id).analysisMarkdown" />
        <div v-for="series in storyDossier(store, recommendation.id).series || []" :key="series.name" class="recommendation-series">
          <h4>{{ series.name }} <small>{{ series.unit }}</small></h4><ObservationTrend :series="series" />
        </div>
        <EventEvidenceSources v-if="eventBriefingFor(recommendation.id)" :brief="eventBriefingFor(recommendation.id)" />
        <MarkdownContent v-else :content="storyDossier(store, recommendation.id).evidenceMarkdown" />
      </details>
      <div v-if="store.completedTasks[recommendation.id]" class="recommendation-result">
        <strong>关联维保任务结果</strong><p>{{ store.completedTasks[recommendation.id].reason }}</p><p>维保任务的执行与验收记录保持关联，原周期项目按实际完成范围登记。</p>
      </div>
      <TaskAssignment v-else-if="!store.canDecideTracking(scenario)&&!store.trackingDispositions[scenario]" :scenario="recommendation.id" action-title="评估维保必要性与实施条件" />
      <button v-if="store.todoCreated[recommendation.id]" type="button" class="p2-secondary" @click="openTask(recommendation.id)">查看维保评估与执行记录</button>
    </article>
    <BaselineTrend class="long-term-trend" :scenario="scenario"/>
  </section>
</template>

<script setup>
import BaselineTrend from './BaselineTrend.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { maintenanceRecommendations } from '@/mock/issueRelationships'
import { storyDossier } from '@/mock/fourStoryWorkflow'
import HealthTrackingPanel from './HealthTrackingPanel.vue'
import TaskAssignment from './TaskAssignment.vue'
import MarkdownContent from './MarkdownContent.vue'
import ObservationTrend from './ObservationTrend.vue'
import EventEvidenceSources from './EventEvidenceSources.vue'
import {eventBriefingFor} from '@/mock/eventBriefings'

const props = defineProps({ scenario: { type: String, required: true } })
const store = usePhase2DemoStore(), router = useRouter()
const recommendations = computed(() => maintenanceRecommendations(store, props.scenario))
const stages = ['健康趋势观测', '核实变化与背景', '轮机长处置决策', '事件闭环']
const stageIndex = computed(() => {
  if (store.trackingDispositions[props.scenario]?.status==='closed') return 3
  if (store.canDecideTracking(props.scenario)||recommendations.value.length) return 2
  return store.todoCreated[props.scenario] || store.checkAssessments[props.scenario] ? 1 : 0
})
const currentStage = computed(() => stages[stageIndex.value])
function recommendationState(id) {
  if (store.completedTasks[id]) return '本轮评估已结束'
  if (store.executionRecords[id]?.length) return '已有执行记录'
  if (store.todoCreated[id]) return '评估任务已安排'
  if (store.ignoredSuggestions[id]) return '本次暂不安排'
  return '待评估'
}
function openTask(id) {
  store.selectTodo(id)
  router.push({ path: '/event', query: { todo: id, parent: props.scenario } })
}
</script>

<style scoped>
.health-observation{padding-top:20px;color:#526176;line-height:1.8;min-width:0}
.long-term-trend{margin-top:28px}
.observation-intro{display:flex;align-items:center;justify-content:space-between;gap:10px 20px;flex-wrap:wrap}
.observation-kicker{font-size:12px;color:#8c7858;letter-spacing:.03em}
.health-observation h3{font-size:17px;color:#283b50;margin:4px 0}
.observation-intro>p{flex-basis:100%;margin:0 0 16px;font-size:14px}
.observation-state{font-size:12px;padding:5px 12px;background:#f5f0e6;color:#8b682d;border-radius:5px}
.observation-stages{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:0;margin:0 0 22px;border-bottom:1px solid #e3e7ec}
.observation-stages li{display:flex;align-items:center;gap:9px;padding:14px 10px;color:#8993a0;border-bottom:2px solid transparent;font-size:13px}
.observation-stages li span{font-variant-numeric:tabular-nums;font-size:12px}.observation-stages li strong{font-weight:500}
.observation-stages .current{border-color:#a78a59;color:#8b682d;background:#faf8f2}.observation-stages .reached{color:#5f786a}
.observation-waiting{border:1px dashed #dce2e8;background:#fafbfc;border-radius:8px;padding:18px;font-size:14px}
.tracking-recommendation{border:1px solid #e5ddcc;border-radius:9px;background:#fff;padding:22px;margin-top:20px;min-width:0}
.tracking-recommendation header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:0 0 12px}
.tracking-recommendation header small{font-size:12px;color:#9b8156}.tracking-recommendation header>span{font-size:12px;color:#8b682d;white-space:nowrap}
.recommendation-basis{border-top:1px solid #edf0f3;border-bottom:1px solid #edf0f3;margin:18px 0;padding:12px 0}
.recommendation-basis summary{font-size:14px;color:#687990;cursor:pointer}.recommendation-basis :deep(.markdown-content){overflow-wrap:anywhere}
.recommendation-series{margin:16px 0}.recommendation-series h4{font-size:14px}.recommendation-series small{font-weight:400;color:#8290a0}
.recommendation-result{font-size:14px;border-left:3px solid #8fa295;padding:12px 16px;background:#f6f9f7;margin:16px 0}.recommendation-result p{margin:5px 0}
@media(max-width:650px){.observation-stages{grid-template-columns:repeat(2,minmax(0,1fr))}.tracking-recommendation{padding:16px}.tracking-recommendation header{flex-wrap:wrap}}
</style>
