<template>
  <div class="product-drawer" v-if="event">
    <!-- Header -->
    <div class="drawer-header">
      <button class="back-btn" @click="handleBack">← 返回列表</button>
      <div class="drawer-title-area">
        <h2 class="drawer-title">{{ event.title }}</h2>
        <span class="drawer-status tag" :class="event.priority">
          {{ priorityLabels[event.priority] }}
        </span>
        <span class="drawer-status tag" :class="event.status">
          {{ statusLabels[event.status] }}
        </span>
      </div>
    </div>

    <div class="drawer-body">
      <!-- Snapshot Data -->
      <section class="d-section">
        <div class="d-section-title">事件快照 · 事发时数据</div>
        <div class="snapshot-grid">
          <div
            v-for="sensor in event.snapshot.sensors"
            :key="sensor.name"
            class="snapshot-card"
          >
            <div class="sc-label">{{ sensor.name }}</div>
            <div class="sc-value" :class="sensor.status">
              {{ sensor.value }}<span class="sc-unit">{{ sensor.unit }}</span>
            </div>
            <div class="sc-threshold" v-if="sensor.threshold">
              阈值: {{ sensor.threshold }}{{ sensor.unit }}
            </div>
            <div class="sc-threshold" v-else-if="sensor.range">
              范围: {{ sensor.range }}{{ sensor.unit }}
            </div>
          </div>
        </div>
      </section>

      <!-- Trend Chart -->
      <section class="d-section" v-if="event.snapshot.trendData.length > 0">
        <div class="d-section-title">温度趋势（事发前24h）</div>
        <div class="trend-chart-container" ref="chartRef"></div>
      </section>

      <!-- AI Diagnosis -->
      <section class="d-section" v-if="event.aiAnalysis">
        <div class="d-section-title">AI 诊断分析</div>
        <div class="ai-card">
          <div class="ai-summary">{{ event.aiAnalysis.summary }}</div>

          <div class="ai-fault-table" v-if="event.aiAnalysis.faultTable.length > 0">
            <div class="ai-subtitle">可能原因：</div>
            <div
              v-for="(f, idx) in event.aiAnalysis.faultTable"
              :key="idx"
              class="fault-item"
            >
              <span class="fault-prob" :class="f.probability">
                {{ f.probability === 'high' ? '高' : f.probability === 'medium' ? '中' : '低' }}
              </span>
              <span class="fault-name">{{ f.name }}</span>
              <span class="fault-detail">{{ f.detail }}</span>
            </div>
          </div>

          <div class="ai-suggestion" v-if="event.aiAnalysis.suggestions">
            <div class="ai-subtitle">优先排查建议：</div>
            <div class="suggestion-text">{{ event.aiAnalysis.suggestions }}</div>
          </div>
        </div>
      </section>

      <!-- Related Cases -->
      <section class="d-section" v-if="event.relatedCases && event.relatedCases.length > 0">
        <div class="d-section-title">关联案例</div>
        <div class="related-list">
          <div v-for="c in event.relatedCases" :key="c.id" class="related-item">
            <span class="related-icon">📄</span>
            <span class="related-title">{{ c.title }}</span>
          </div>
        </div>
      </section>

      <!-- Timeline -->
      <section class="d-section" v-if="event.timeline">
        <div class="d-section-title">处理时间线</div>
        <div class="timeline">
          <div v-for="(t, idx) in event.timeline" :key="idx" class="timeline-item">
            <div class="tl-dot" :class="{ first: idx === 0 }"></div>
            <div class="tl-content">
              <span class="tl-time">{{ formatTime(t.time) }}</span>
              <span class="tl-action">{{ t.action }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Bottom hint -->
      <div class="drawer-bottom-hint">
        如需操作，请联系右侧 AI 助手
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { eventPriorityLabels, eventStatusLabels } from '@/mock/events'

const props = defineProps({
  event: { type: Object, default: null }
})

const emit = defineEmits(['back'])

const chartRef = ref(null)
let chartInstance = null

const priorityLabels = eventPriorityLabels
const statusLabels = eventStatusLabels

function formatTime(time) {
  const d = new Date(time)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function handleBack() {
  emit('back')
}

function renderChart() {
  if (!chartRef.value || !props.event?.snapshot?.trendData?.length) return

  nextTick(() => {
    if (chartInstance) chartInstance.dispose()

    const data = props.event.snapshot.trendData
    const threshold = props.event.snapshot.sensors.find(s => s.threshold)?.threshold || 85

    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0F1F38',
        borderColor: '#1E3A5F',
        textStyle: { color: '#E8F0FF', fontSize: 12 }
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.time),
        axisLine: { lineStyle: { color: '#1E3A5F' } },
        axisLabel: { color: '#5A7A92', fontSize: 11 },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        min: Math.floor(Math.min(...data.map(d => d.value)) - 5),
        max: Math.ceil(Math.max(...data.map(d => d.value)) + 5),
        axisLine: { lineStyle: { color: '#1E3A5F' } },
        axisLabel: { color: '#5A7A92', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1E3A5F', type: 'dashed' } }
      },
      series: [
        {
          type: 'line',
          data: data.map(d => d.value),
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: '#1890FF', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24,144,255,0.3)' },
              { offset: 1, color: 'rgba(24,144,255,0.02)' }
            ])
          },
          itemStyle: { color: '#1890FF' },
          markLine: {
            silent: true,
            data: [{
              yAxis: threshold,
              label: {
                formatter: `阈值 ${threshold}°C`,
                color: '#FF4D4F',
                fontSize: 11
              },
              lineStyle: { color: '#FF4D4F', type: 'dashed', width: 1 }
            }]
          },
          markPoint: {
            data: data.reduce((acc, d, i) => {
              if (d.value > threshold) {
                acc.push({ coord: [i, d.value], symbol: 'circle', symbolSize: 8, itemStyle: { color: '#FF4D4F' } })
              }
              return acc
            }, []),
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: { color: '#FF4D4F' }
          }
        }
      ]
    })
  })
}

watch(() => props.event, () => {
  renderChart()
}, { deep: true })

onMounted(() => {
  renderChart()
})
</script>

<style scoped>
.product-drawer {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  overflow: hidden;
}

.drawer-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.back-btn {
  font-size: var(--text-base);
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
  display: block;
}
.back-btn:hover { color: var(--accent-hover); }

.drawer-title-area {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.drawer-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.drawer-status.tag {
  font-size: var(--text-xs);
}
.drawer-status.critical { background: rgba(255,77,79,0.15); color: var(--danger); }
.drawer-status.important { background: rgba(250,173,20,0.15); color: var(--warning); }
.drawer-status.normal { background: rgba(24,144,255,0.15); color: var(--accent); }
.drawer-status.pending { background: rgba(250,173,20,0.15); color: var(--warning); }
.drawer-status.processing { background: rgba(24,144,255,0.15); color: var(--accent); }
.drawer-status.resolved { background: rgba(82,196,26,0.15); color: var(--success); }

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 28px;
}

.d-section {
  margin-bottom: 20px;
}

.d-section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

/* Snapshot Grid — responsive auto-fill */
.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.snapshot-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px;
}

.sc-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: 4px;
}

.sc-value {
  font-size: 22px;
  font-weight: 600;
  font-family: Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
.sc-value.over { color: var(--danger); }
.sc-value.warning { color: var(--warning); }
.sc-value.normal { color: var(--text-primary); }

.sc-unit {
  font-size: var(--text-sm);
  font-weight: 400;
  margin-left: 2px;
}

.sc-threshold {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: 3px;
}

/* Trend Chart — responsive height */
.trend-chart-container {
  width: 100%;
  height: clamp(180px, 20vh, 280px);
  min-height: 180px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
}

/* AI Diagnosis */
.ai-card {
  background: linear-gradient(135deg, rgba(24,144,255,0.08), rgba(0,188,212,0.08));
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.ai-summary {
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--text-primary);
  margin-bottom: 14px;
}

.ai-subtitle {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 8px;
}

.fault-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  font-size: var(--text-sm);
}

.fault-prob {
  font-size: var(--text-xs);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
  flex-shrink: 0;
  margin-top: 1px;
}
.fault-prob.high { background: rgba(255,77,79,0.15); color: var(--danger); }
.fault-prob.medium { background: rgba(250,173,20,0.15); color: var(--warning); }
.fault-prob.low { background: rgba(90,122,146,0.15); color: var(--offline); }

.fault-name {
  color: var(--text-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.fault-detail {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.suggestion-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Related */
.related-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.related-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

.related-icon {
  font-size: 16px;
}

.related-title {
  font-size: var(--text-sm);
  color: var(--accent);
}

/* Timeline */
.timeline {
  padding-left: 8px;
}

.timeline-item {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
  position: relative;
}
.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: var(--border-color);
}

.tl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  margin-top: 3px;
}
.tl-dot.first {
  background: var(--accent);
  width: 10px;
  height: 10px;
  margin-top: 2px;
}

.tl-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tl-time {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: Consolas, monospace;
}

.tl-action {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.drawer-bottom-hint {
  text-align: center;
  padding: 14px 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  margin-top: 10px;
}
</style>
