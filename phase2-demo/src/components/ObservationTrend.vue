<template>
  <div class="observation-trend">
    <div class="trend-toolbar">
      <span>{{ model.count }} 个有效观测点 · {{ model.timed ? '真实时间轴' : '按记录节点比较' }}</span>
      <button v-if="model.points.length > 12" type="button" @click="resetRange">重置范围</button>
    </div>
    <div v-if="model.count" ref="chartEl" class="observation-chart" role="img" :aria-label="series.name + '观测趋势，' + model.count + '个有效观测点'" />
    <p v-else class="empty-trend">暂无有效观测数值。</p>
    <div class="trend-caption">
      <span v-if="model.timed">原始范围：{{ model.points[0]?.label }} — {{ model.points.at(-1)?.label }}</span>
      <span>悬停或点击查看数值{{ model.points.length > 12 ? ' · 拖动下方滑块缩放时间范围' : '' }}</span>
    </div>
  </div>
</template>

<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import * as echarts from 'echarts'
import {observationData, observationOption} from './observationTrend'

const props = defineProps({series: {type: Object, required: true}})
const model = computed(() => observationData(props.series))
const chartEl = ref(null)
let chart, observer
function render() {
  if (!chartEl.value) { chart?.dispose(); chart = undefined; return }
  if (!chart) chart = echarts.init(chartEl.value, null, {renderer: 'svg'})
  chart.setOption(observationOption(props.series, chartEl.value.clientWidth), true)
}
function resetRange() { chart?.dispatchAction({type: 'dataZoom', start: 0, end: 100}) }
onMounted(() => {
  render()
  observer = new ResizeObserver(() => {
    if (!chart) return
    chart.resize()
    chart.setOption({xAxis: {splitNumber: chartEl.value.clientWidth < 560 ? 3 : 6}})
  })
  if (chartEl.value) observer.observe(chartEl.value)
})
watch(() => props.series, () => nextTick(() => {
  observer?.disconnect()
  render()
  if (chartEl.value) observer?.observe(chartEl.value)
}), {deep: true})
onUnmounted(() => { observer?.disconnect(); chart?.dispose() })
</script>

<style scoped>
.observation-trend{min-width:0;width:100%}
.trend-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:30px;color:#8190a3;font-size:11px}
.trend-toolbar button{border:1px solid #ddd4c4;border-radius:5px;padding:4px 10px;background:#fff;color:#8b682d;font:inherit;cursor:pointer}
.trend-toolbar button:hover{background:#faf5eb}.trend-toolbar button:focus-visible{outline:2px solid #936821;outline-offset:2px}
.observation-chart{width:100%;height:272px;min-width:0}
.trend-caption{display:flex;justify-content:space-between;gap:5px 16px;flex-wrap:wrap;font-size:11px;line-height:1.7;color:#8190a3;padding:4px 0 8px}
.empty-trend{color:#8190a3;font-size:12px}
@media(max-width:600px){.observation-chart{height:248px}.trend-caption{display:grid}}
</style>
