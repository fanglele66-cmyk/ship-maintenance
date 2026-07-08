<template>
  <div class="sensor-trend">
    <!-- Left: Sensor list -->
    <div class="st-sidebar">
      <div class="st-sidebar-hint">{{ multiTrend ? '勾选多个传感器对比趋势' : '点击传感器查看趋势图' }}</div>
      <div
        v-for="sensor in filteredSensors"
        :key="sensor.id"
        class="st-list-item"
        :class="{
          selected: !multiTrend && sensorStore.selectedSensorId === sensor.id,
          checked: multiTrend && multiSelectedList.includes(sensor.id)
        }"
        @click="handleSensorClick(sensor)"
      >
        <span v-if="multiTrend" class="stl-checkbox">
          <span class="stl-checkmark" :class="{ on: multiSelectedList.includes(sensor.id) }"></span>
        </span>
        <div class="stl-body">
          <div class="stl-name">{{ sensor.nameEn }}</div>
          <div class="stl-cn">{{ sensor.nameCn }}</div>
          <div class="stl-value">{{ sensor.value }}{{ sensor.unit }}</div>
        </div>
      </div>
    </div>

    <!-- Right: Trend chart -->
    <div class="st-chart-area">
      <!-- Controls bar -->
      <div class="st-controls">
        <div class="st-controls-left">
          <label class="multi-toggle" title="多趋势对比">
            <input type="checkbox" v-model="multiTrend" @change="onMultiTrendChange" />
            <span class="multi-toggle-slider"></span>
            <span class="multi-toggle-label">多趋势对比</span>
          </label>
        </div>

        <div class="st-controls-right">
          <div class="st-toggle-group">
            <button
              v-for="h in timeRanges"
              :key="h"
              class="st-time-btn"
              :class="{ active: isCustomRange ? false : sensorStore.trendHours === h }"
              @click="applyPreset(h)"
            >
              {{ h === 1 ? '1H' : h === 6 ? '6H' : h === 24 ? '24H' : h === 168 ? '7D' : '自定义' }}
            </button>
          </div>

          <!-- 自定义按钮 + 下拉面板 -->
          <div class="st-custom-wrap" ref="customWrapRef">
            <button
              class="st-time-btn st-custom-btn"
              :class="{ active: isCustomRange }"
              @click="showCustomPanel = !showCustomPanel"
              title="自定义时间范围"
            >
              📅 自定义
            </button>
            <div v-if="showCustomPanel" class="st-custom-panel">
              <div class="st-custom-panel-inner">
                <div class="st-custom-field">
                  <label>开始时间</label>
                  <input type="datetime-local" v-model="customStart" class="st-datetime-input" />
                </div>
                <div class="st-custom-field">
                  <label>结束时间</label>
                  <input type="datetime-local" v-model="customEnd" class="st-datetime-input" />
                </div>
                <div class="st-custom-actions">
                  <button class="st-custom-apply" @click="applyCustomRange">应用</button>
                  <button class="st-custom-cancel" @click="showCustomPanel = false">取消</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="st-chart" ref="chartRef"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed, reactive } from 'vue'
import * as echarts from 'echarts'
import { useSensorStore } from '@/stores/sensorStore'
import { generateTrendData } from '@/mock/sensors'

const emit = defineEmits(['back'])

const sensorStore = useSensorStore()
const chartRef = ref(null)
const customWrapRef = ref(null)
let chartInstance = null

const timeRanges = [1, 6, 24, 168]

// ===== 多趋势（用 plain array 而非 Set，保证 Vue 响应式） =====
const multiTrend = ref(false)
const multiSelectedList = ref([])

// ===== 自定义时间段 =====
const isCustomRange = ref(false)
const showCustomPanel = ref(false)
const customStart = ref('')
const customEnd = ref('')

function generateTrendForSensor(sensor, hours) {
  return generateTrendData(sensor.value, sensor.value * 0.1, hours)
}

function getTrendDataForHours(hours) {
  const s = sensorStore.selectedSensor
  if (!s) return []
  return generateTrendForSensor(s, hours)
}

const filteredSensors = computed(() => sensorStore.filteredSensors)

const multiSelectedSensors = computed(() => {
  return filteredSensors.value.filter(s => multiSelectedList.value.includes(s.id))
})

const seriesColors = [
  '#1677FF', '#52C41A', '#FA8C16', '#F5222D', '#722ED1',
  '#13C2C2', '#EB2F96', '#FAAD14', '#2F54EB', '#A0D911',
  '#FA541C', '#597EF7'
]

function handleSensorClick(sensor) {
  if (multiTrend.value) {
    toggleMultiSelect(sensor.id)
    // 同步渲染：toggleMultiSelect 已直接 push/splice 到数组，数据已就绪
    renderChart()
  } else {
    sensorStore.selectSensor(sensor.id)
  }
}

function toggleMultiSelect(id) {
  const idx = multiSelectedList.value.indexOf(id)
  if (idx >= 0) {
    multiSelectedList.value.splice(idx, 1)
  } else {
    multiSelectedList.value.push(id)
  }
}

function onMultiTrendChange() {
  if (!multiTrend.value) multiSelectedList.value = []
  renderChart()
}

function applyPreset(hours) {
  isCustomRange.value = false
  showCustomPanel.value = false
  sensorStore.setTrendHours(hours)
}

function applyCustomRange() {
  if (customStart.value && customEnd.value) {
    isCustomRange.value = true
    showCustomPanel.value = false
    renderChart()
  }
}

function getCustomHours() {
  if (!isCustomRange.value || !customStart.value || !customEnd.value) return null
  const start = new Date(customStart.value).getTime()
  const end = new Date(customEnd.value).getTime()
  if (isNaN(start) || isNaN(end) || end <= start) return null
  return Math.ceil((end - start) / 3600000)
}

function getCustomTrendData(sensor) {
  const hours = getCustomHours()
  if (!hours) return []
  const startTime = new Date(customStart.value).getTime()
  const endTime = new Date(customEnd.value).getTime()
  const count = Math.min(hours, 168)
  const interval = (endTime - startTime) / count
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(startTime + i * interval).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: sensor.value + Math.sin(i / 4) * sensor.value * 0.1 + Math.random() * sensor.value * 0.03
  }))
}

function buildOption() {
  if (multiTrend.value && multiSelectedSensors.value.length > 0) {
    return buildMultiOption()
  }
  if (!sensorStore.selectedSensor) return null
  return buildSingleOption()
}

function buildSingleOption() {
  const sensor = sensorStore.selectedSensor
  const data = isCustomRange.value ? getCustomTrendData(sensor) : getTrendDataForHours(sensorStore.trendHours)
  if (!data || !data.length) return null

  return {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 20, top: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E6EB',
      textStyle: { color: '#1D2129', fontSize: 14 }
    },
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#E5E6EB' } },
      axisLabel: { color: '#8B919A', fontSize: 12 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: sensor.unit,
      nameTextStyle: { color: '#8B919A', fontSize: 12 },
      axisLine: { lineStyle: { color: '#E5E6EB' } },
      axisLabel: { color: '#8B919A', fontSize: 12 },
      splitLine: { lineStyle: { color: '#F2F3F5', type: 'dashed' } }
    },
    series: [{
      type: 'line',
      name: `${sensor.nameCn}(${sensor.nameEn})`,
      data: data.map(d => d.value),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#1677FF', width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(22,119,255,0.18)' },
          { offset: 1, color: 'rgba(22,119,255,0.02)' }
        ])
      }
    }]
  }
}

function buildMultiOption() {
  const sources = multiSelectedSensors.value
  if (!sources.length) return null

  const seriesData = sources.map((sensor, idx) => {
    const data = isCustomRange.value ? getCustomTrendData(sensor) : generateTrendForSensor(sensor, sensorStore.trendHours)
    if (!data || !data.length) return null
    return { sensor, data, color: seriesColors[idx % seriesColors.length] }
  }).filter(Boolean)

  if (!seriesData.length) return null

  const xData = seriesData[0].data.map(d => d.time)

  return {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 20, top: 30, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E6EB',
      textStyle: { color: '#1D2129', fontSize: 13 }
    },
    legend: {
      top: 0,
      left: 'center',
      textStyle: { fontSize: 12, color: '#8B919A' },
      data: seriesData.map(sd => `${sd.sensor.nameCn}(${sd.sensor.nameEn})`)
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLine: { lineStyle: { color: '#E5E6EB' } },
      axisLabel: { color: '#8B919A', fontSize: 11 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#E5E6EB' } },
      axisLabel: { color: '#8B919A', fontSize: 12 },
      splitLine: { lineStyle: { color: '#F2F3F5', type: 'dashed' } }
    },
    series: seriesData.map(sd => ({
      type: 'line',
      name: `${sd.sensor.nameCn}(${sd.sensor.nameEn})`,
      data: sd.data.map(d => d.value),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: sd.color, width: 2 },
      itemStyle: { color: sd.color }
    }))
  }
}

function renderChart() {
  if (!chartRef.value) return
  const opt = buildOption()
  if (!opt) return

  // 先 dispose 清空，nextTick 后再 init 避免宽高为 0
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  nextTick(() => {
    if (!chartRef.value || !chartRef.value.clientHeight) return
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(opt)
  })
}

let resizeObserver = null
onMounted(() => {
  if (filteredSensors.value.length > 0 && !sensorStore.selectedSensorId) {
    sensorStore.selectSensor(filteredSensors.value[0].id)
  }
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 3600000)
  customStart.value = yesterday.toISOString().slice(0, 16)
  customEnd.value = now.toISOString().slice(0, 16)

  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (chartInstance) chartInstance.resize()
    })
    resizeObserver.observe(chartRef.value)
  }
})

onUnmounted(() => {
  if (chartInstance) chartInstance.dispose()
  if (resizeObserver) resizeObserver.disconnect()
})

watch(() => sensorStore.selectedSensorId, () => renderChart())
watch(() => sensorStore.trendHours, () => renderChart())
watch(() => sensorStore.selectedSensor?.value, () => renderChart())

// 点击面板外部关闭自定义时间面板
function handleClickOutside(e) {
  if (showCustomPanel.value && customWrapRef.value && !customWrapRef.value.contains(e.target)) {
    showCustomPanel.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside, true))
onUnmounted(() => document.removeEventListener('click', handleClickOutside, true))
</script>

<style scoped>
.sensor-trend {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ===== Left sidebar ===== */
.st-sidebar {
  width: 200px;
  min-width: 200px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-primary);
  overflow-y: auto;
}

.st-sidebar-hint {
  font-size: var(--font-xs);
  color: var(--text-muted);
  text-align: center;
  padding: 10px;
  border-bottom: 1px solid var(--border-primary);
}

.st-list-item {
  display: flex;
  align-items: center;
  padding: 12px 10px;
  border-bottom: 1px solid var(--border-secondary);
  border-left: 3px solid transparent;
  background: linear-gradient(90deg, transparent 0%, transparent 100%);
  cursor: pointer;
  transition: all 0.2s;
}
.st-list-item:hover {
  background: linear-gradient(90deg, rgba(22, 119, 255, 0.04) 0%, transparent 100%);
  border-left-color: rgba(22, 119, 255, 0.35);
}
.st-list-item.selected,
.st-list-item.checked {
  background: linear-gradient(90deg, rgba(22, 119, 255, 0.08) 0%, rgba(22, 119, 255, 0.02) 100%);
  border-left: 3px solid var(--accent);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.08);
}

.stl-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  flex-shrink: 0;
  cursor: pointer;
}
.stl-checkbox input { display: none; }
.stl-checkmark {
  width: 16px; height: 16px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  display: inline-block;
  position: relative;
  transition: all 0.2s;
  background: var(--bg-surface);
}
.stl-checkmark.on {
  background: var(--accent);
  border-color: var(--accent);
}
.stl-checkmark.on::after {
  content: '';
  position: absolute;
  left: 4px; top: 1px;
  width: 4px; height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.st-list-item:hover .stl-checkmark { border-color: var(--accent); }

.stl-body { flex: 1; min-width: 0; }

.stl-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stl-cn {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 1px;
}

.stl-value {
  font-size: var(--font-md);
  font-weight: 600;
  font-family: Consolas, monospace;
  color: var(--text-primary);
  margin-top: 4px;
}

/* ===== Right chart area ===== */
.st-chart-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.st-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  flex-shrink: 0;
  gap: 12px;
}

.st-controls-left { display: flex; align-items: center; }
.st-controls-right { display: flex; align-items: center; gap: 8px; }

/* ===== 多趋势开关 ===== */
.multi-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.multi-toggle input { display: none; }
.multi-toggle-slider {
  position: relative;
  width: 36px; height: 20px;
  background: var(--border-color);
  border-radius: 10px;
  transition: background 0.25s;
}
.multi-toggle-slider::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.multi-toggle input:checked + .multi-toggle-slider { background: var(--accent); }
.multi-toggle input:checked + .multi-toggle-slider::after { transform: translateX(16px); }
.multi-toggle-label {
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

/* ===== 时间按钮组 ===== */
.st-toggle-group { display: flex; gap: 4px; }

.st-time-btn {
  font-size: var(--font-xs);
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.st-time-btn:hover { border-color: var(--accent); color: var(--accent); }
.st-time-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

/* ===== 自定义时间按钮 + 下拉面板 ===== */
.st-custom-wrap { position: relative; }
.st-custom-btn { }

.st-custom-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  z-index: 50;
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  min-width: 260px;
}
.st-custom-panel-inner { padding: 14px; }
.st-custom-field { margin-bottom: 10px; }
.st-custom-field label {
  display: block;
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-bottom: 4px;
}
.st-datetime-input {
  width: 100%;
  font-size: var(--font-sm);
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}
.st-datetime-input:focus { border-color: var(--accent); }
.st-datetime-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }

.st-custom-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}
.st-custom-apply {
  font-size: var(--font-xs);
  padding: 4px 14px;
  border-radius: 4px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.st-custom-apply:hover { background: var(--accent-hover, #4096FF); }
.st-custom-cancel {
  font-size: var(--font-xs);
  padding: 4px 14px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.st-custom-cancel:hover { border-color: var(--accent); color: var(--accent); }

/* ===== Chart ===== */
.st-chart {
  flex: 1;
  min-height: 200px;
  margin: 0 16px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
</style>
