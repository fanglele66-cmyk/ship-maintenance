<template>
  <div class="sensor-trend">
    <!-- Left: Sensor list -->
    <div class="st-sidebar">
      <div class="st-sidebar-hint">点击传感器查看趋势图</div>
      <div
        v-for="sensor in filteredSensors"
        :key="sensor.id"
        class="st-list-item"
        :class="{ selected: sensorStore.selectedSensorId === sensor.id }"
        @click="sensorStore.selectSensor(sensor.id)"
      >
        <div class="stl-left-bar" :class="sensor.status"></div>
        <div class="stl-body">
          <div class="stl-name">{{ sensor.nameEn }}</div>
          <div class="stl-cn">{{ sensor.nameCn }}</div>
          <div class="stl-meta">{{ sensor.system }} · {{ sensor.device }}</div>
          <div class="stl-value" :class="sensor.status">{{ sensor.value }}{{ sensor.unit }}</div>
        </div>
        <span class="stl-badge" :class="sensor.status">
          {{ sensor.status === 'over' ? '超限' : sensor.status === 'warning' ? '预警' : '正常' }}
        </span>
      </div>
    </div>

    <!-- Right: Trend chart -->
    <div class="st-chart-area">
      <!-- Controls -->
      <div class="st-controls">
        <div class="st-toggle-group">
          <button
            v-for="h in timeRanges"
            :key="h"
            class="st-time-btn"
            :class="{ active: sensorStore.trendHours === h }"
            @click="sensorStore.setTrendHours(h)"
          >
            {{ h === 1 ? '1H' : h === 6 ? '6H' : h === 24 ? '24H' : h === 168 ? '7D' : '自定义' }}
          </button>
        </div>
      </div>

      <!-- Chart container -->
      <div class="st-chart" ref="chartRef"></div>

      <!-- AI analysis summary (collapsible) -->
      <div class="st-ai-summary" v-if="sensorStore.selectedSensor">
        <div class="st-ai-header" @click="showAiAnalysis = !showAiAnalysis">
          <span>🤖 AI 分析摘要</span>
          <span class="st-ai-toggle">{{ showAiAnalysis ? '▲' : '▼' }}</span>
        </div>
        <div class="st-ai-body" v-show="showAiAnalysis">
          <div class="ai-line" v-if="sensorStore.selectedSensor.status !== 'normal'">
            传感器 <b style="color: #FF4D4F">{{ sensorStore.selectedSensor.nameCn }}</b>
            当前值为 <b>{{ sensorStore.selectedSensor.value }}{{ sensorStore.selectedSensor.unit }}</b>，
            超出{{ sensorStore.selectedSensor.status === 'over' ? '阈值' : '预警范围' }}。
          </div>
          <div class="ai-line" v-else>
            传感器 <b style="color: #52C41A">{{ sensorStore.selectedSensor.nameCn }}</b>
            运行正常，当前值 {{ sensorStore.selectedSensor.value }}{{ sensorStore.selectedSensor.unit }}。
          </div>
          <div class="ai-line" style="margin-top:6px">
            趋势分析：最近 {{ sensorStore.trendHours }} 小时内数据
            {{ sensorStore.selectedSensor.status !== 'normal' ? '呈上升趋势，需密切关注。' : '平稳无异常变化。' }}
          </div>
          <div class="ai-action" style="margin-top:8px">
            <button class="btn-ghost-sm" @click="$emit('generateEvent')">
              ⚡ 生成事件快照
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import * as echarts from 'echarts'
import { useSensorStore } from '@/stores/sensorStore'

const emit = defineEmits(['back', 'generateEvent'])

const sensorStore = useSensorStore()
const chartRef = ref(null)
const showAiAnalysis = ref(true)
let chartInstance = null

const timeRanges = [1, 6, 24, 168]

const filteredSensors = computed(() => {
  return sensorStore.filteredSensors
})

function renderChart() {
  if (!chartRef.value || !sensorStore.selectedSensor) return

  nextTick(() => {
    if (chartInstance) chartInstance.dispose()

    const data = sensorStore.currentTrendData
    const threshold = sensorStore.selectedSensor.threshold

    chartInstance = echarts.init(chartRef.value)
    const option = {
      backgroundColor: 'transparent',
      grid: { left: 50, right: 16, top: 20, bottom: 28 },
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
        axisLine: { lineStyle: { color: '#1E3A5F' } },
        axisLabel: { color: '#5A7A92', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1E3A5F', type: 'dashed' } }
      },
      series: [
        {
          type: 'line',
          data: data.map(d => d.value),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#1890FF', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24,144,255,0.25)' },
              { offset: 1, color: 'rgba(24,144,255,0.02)' }
            ])
          }
        }
      ]
    }

    // Add threshold mark line if exists
    if (threshold) {
      option.series[0].markLine = {
        silent: true,
        data: [{
          yAxis: threshold,
          label: {
            formatter: `阈值 ${threshold}`,
            color: '#FF4D4F',
            fontSize: 11
          },
          lineStyle: { color: '#FF4D4F', type: 'dashed', width: 1 }
        }]
      }
    }

    chartInstance.setOption(option)
  })
}

watch(() => sensorStore.selectedSensorId, renderChart)
watch(() => sensorStore.trendHours, renderChart)
watch(() => sensorStore.selectedSensor?.value, renderChart)

onMounted(() => {
  // Select first sensor by default
  if (filteredSensors.value.length > 0 && !sensorStore.selectedSensorId) {
    sensorStore.selectSensor(filteredSensors.value[0].id)
  }
})
</script>

<style scoped>
.sensor-trend {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* Left sidebar */
.st-sidebar {
  width: 200px;
  min-width: 200px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.st-sidebar-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
}

.st-list-item {
  display: flex;
  padding: 8px 10px;
  border-bottom: 1px solid #0F1F38;
  cursor: pointer;
  transition: all 0.15s;
  gap: 6px;
}
.st-list-item:hover {
  background: rgba(24,144,255,0.05);
}
.st-list-item.selected {
  background: rgba(24,144,255,0.15);
  border-left: 2px solid var(--accent);
}

.stl-left-bar {
  width: 3px;
  flex-shrink: 0;
  border-radius: 2px;
}
.stl-left-bar.over { background: var(--danger); }
.stl-left-bar.warning { background: var(--warning); }
.stl-left-bar.normal { background: var(--success); }

.stl-body {
  flex: 1;
  min-width: 0;
}

.stl-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stl-cn {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.stl-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stl-value {
  font-size: var(--text-lg);
  font-weight: 600;
  font-family: Consolas, monospace;
  margin-top: 2px;
}
.stl-value.over { color: var(--danger); }
.stl-value.warning { color: var(--warning); }
.stl-value.normal { color: var(--success); }

.stl-badge {
  font-size: var(--text-xs);
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
}
.stl-badge.over { background: rgba(255,77,79,0.15); color: var(--danger); }
.stl-badge.warning { background: rgba(250,173,20,0.15); color: var(--warning); }
.stl-badge.normal { background: rgba(82,196,26,0.15); color: var(--success); }

/* Right chart area */
.st-chart-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.st-controls {
  display: flex;
  justify-content: flex-end;
  padding: 8px 16px;
  flex-shrink: 0;
}

.st-toggle-group {
  display: flex;
  gap: 4px;
}

.st-time-btn {
  font-size: var(--text-xs);
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.st-time-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.st-time-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.st-chart {
  flex: 1;
  min-height: 200px;
  margin: 0 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* AI Analysis */
.st-ai-summary {
  margin: 8px 16px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  flex-shrink: 0;
}

.st-ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}

.st-ai-toggle {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.st-ai-body {
  padding: 0 12px 10px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.btn-ghost-sm {
  font-size: var(--text-xs);
  padding: 3px 10px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--accent);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-ghost-sm:hover {
  border-color: var(--accent);
  background: rgba(24,144,255,0.1);
}
</style>
