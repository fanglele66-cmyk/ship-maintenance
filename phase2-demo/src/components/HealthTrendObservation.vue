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

    <HealthTrackingPanel v-if="store.trackingDispositions[scenario]?.status!=='closed'" :request-id="scenario" detail embedded />

    <section v-if="!recommendations.length&&!store.trackingDispositions[scenario]&&!store.canDecideTracking(scenario)" class="observation-waiting">
      <h3>当前持续观测，尚未形成维保建议</h3>
      <p>先核对变化是否持续、工况是否可比，以及现场信息是否充分。形成新的检查需求后，再在此处评估必要性与实施条件。</p>
    </section>
    <BaselineTrend class="long-term-trend" :scenario="scenario"/>
  </section>
</template>

<script setup>
import BaselineTrend from './BaselineTrend.vue'
import { computed } from 'vue'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { maintenanceRecommendations } from '@/mock/issueRelationships'
import HealthTrackingPanel from './HealthTrackingPanel.vue'

const props = defineProps({ scenario: { type: String, required: true } })
const store = usePhase2DemoStore()
const recommendations = computed(() => maintenanceRecommendations(store, props.scenario))
const stages = ['健康趋势观测', '核实变化与背景', '轮机长处置决策', '事件闭环']
const stageIndex = computed(() => {
  if (store.trackingDispositions[props.scenario]?.status==='closed') return 3
  if (store.canDecideTracking(props.scenario)||recommendations.value.length) return 2
  return store.todoCreated[props.scenario] || store.checkAssessments[props.scenario] ? 1 : 0
})
const currentStage = computed(() => stages[stageIndex.value])
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
.observation-intro,.observation-stages{flex:none}
@media(max-width:650px){.observation-stages{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
