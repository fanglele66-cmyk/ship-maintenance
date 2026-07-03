<template>
  <div class="event-center">
    <!-- 左侧：事件列表 -->
    <transition name="slide-list">
      <div v-show="!selectedEventId" class="event-list-panel">
        <div class="list-header">
          <div class="list-title-row">
            <h3 class="list-title">事件中心</h3>
            <span class="list-count">{{ filteredEvents.length }}</span>
          </div>
          <div class="filter-tabs">
            <button
              v-for="f in filters"
              :key="f.value"
              class="filter-tab"
              :class="{ active: currentFilter === f.value }"
              @click="currentFilter = f.value"
            >{{ f.label }}</button>
          </div>
        </div>
        <div class="event-cards">
          <div
            v-for="ev in filteredEvents"
            :key="ev.id"
            class="event-card"
            :class="{ selected: selectedEventId === ev.id }"
            @click="selectEvent(ev.id)"
          >
            <div class="card-dot" :style="{ background: priorityColor(ev.priority) }"></div>
            <div class="card-body">
              <div class="card-title">{{ ev.title }}</div>
              <div class="card-meta">
                <span class="card-system">{{ ev.system }}</span>
                <span class="card-priority" :style="{ color: priorityColor(ev.priority) }">{{ priorityLabel(ev.priority) }}</span>
              </div>
              <div class="card-time">{{ formatTime(ev.createdAt) }}</div>
            </div>
            <div class="card-status" :class="ev.status">{{ statusLabel(ev.status) }}</div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 中间：产物抽屉（选中事件后展开） -->
    <transition name="slide-drawer">
      <div v-if="selectedEvent" class="product-drawer">
        <div class="drawer-header">
          <button class="back-btn" @click="deselectEvent">
            <Icon icon="mdi:arrow-left" />
          </button>
          <div class="drawer-title-group">
            <h3 class="drawer-title">{{ selectedEvent.title }}</h3>
            <span class="drawer-status" :class="selectedEvent.status">{{ statusLabel(selectedEvent.status) }}</span>
          </div>
        </div>

        <div class="drawer-content">
          <!-- 快照数据区 -->
          <div class="section">
            <div class="section-title">
              <Icon icon="mdi:camera-outline" />
              事件快照 · 事发时数据
            </div>
            <div class="snapshot-grid">
              <div
                v-for="(sensor, idx) in selectedEvent.snapshot?.sensors || []"
                :key="idx"
                class="snapshot-card"
              >
                <div class="snapshot-name">{{ sensor.name }}</div>
                <div class="snapshot-value" :style="{ color: valueColor(sensor.status) }">
                  {{ sensor.value }}<span class="snapshot-unit">{{ sensor.unit }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 趋势图区 -->
          <div class="section">
            <div class="section-title">
              <Icon icon="mdi:chart-line" />
              温度趋势（事发前 24h）
            </div>
            <div class="trend-chart-box">
              <v-chart :option="trendOption" autoresize style="height: 200px;" />
            </div>
          </div>

          <!-- AI 诊断区 -->
          <div class="section">
            <div class="section-title">
              <Icon icon="mdi:brain" />
              AI 诊断分析
            </div>
            <div class="ai-card">
              <div class="ai-summary">{{ selectedEvent.aiAnalysis?.summary || '暂无 AI 分析数据' }}</div>
              <div v-if="selectedEvent.aiAnalysis?.faultTable?.length" class="ai-causes">
                <div class="cause-label">可能原因：</div>
                <div v-for="(cause, idx) in selectedEvent.aiAnalysis.faultTable" :key="idx" class="cause-item">
                  <span class="cause-dot" :class="cause.probability"></span>
                  <span class="cause-name">{{ cause.name }}</span>
                  <span class="cause-prob">{{ probLabel(cause.probability) }}</span>
                </div>
              </div>
              <div v-if="selectedEvent.aiAnalysis?.suggestions" class="ai-suggest">
                <div class="suggest-label">优先排查建议：</div>
                <div class="suggest-text">{{ selectedEvent.aiAnalysis.suggestions }}</div>
              </div>
            </div>
          </div>

          <!-- 底部提示 -->
          <div class="drawer-footer-hint">
            如需操作，请联系右侧 AI 助手
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { eventList } from '@/mock/eventMock'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

const selectedEventId = ref(null)
const currentFilter = ref('all')

const filters = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已解决', value: 'resolved' }
]

const filteredEvents = computed(() => {
  if (currentFilter.value === 'all') return eventList
  return eventList.filter(e => e.status === currentFilter.value)
})

const selectedEvent = computed(() => {
  return eventList.find(e => e.id === selectedEventId.value) || null
})

function selectEvent(id) {
  selectedEventId.value = id
}

function deselectEvent() {
  selectedEventId.value = null
}

function priorityColor(p) {
  return { critical: '#FF4D4F', important: '#FAAD14', normal: '#1890FF' }[p] || '#1890FF'
}

function priorityLabel(p) {
  return { critical: '紧急', important: '重要', normal: '一般' }[p] || p
}

function statusLabel(s) {
  return { pending: '待处理', processing: '处理中', resolved: '已解决' }[s] || s
}

function valueColor(status) {
  return { over: '#FF4D4F', warning: '#FAAD14', normal: '#E8F0FF' }[status] || '#E8F0FF'
}

function probLabel(p) {
  return { high: '高', medium: '中', low: '低' }[p] || p
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// 趋势图配置
const trendOption = computed(() => {
  const data = selectedEvent.value?.snapshot?.trendData || []
  return {
    backgroundColor: 'transparent',
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#1E3A5F' } },
      axisLabel: { color: '#5A7A92', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1E3A5F', type: 'dashed' } },
      axisLabel: { color: '#5A7A92', fontSize: 10 }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0F1F38',
      borderColor: '#1E3A5F',
      textStyle: { color: '#E8F0FF', fontSize: 11 }
    },
    series: [{
      type: 'line',
      data: data.map(d => d.value),
      smooth: true,
      lineStyle: { color: '#1890FF', width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(24,144,255,0.3)' },
            { offset: 1, color: 'rgba(24,144,255,0.02)' }
          ]
        }
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#FAAD14', type: 'dashed' },
        data: [{ yAxis: 85, label: { formatter: '阈值 85°C', color: '#FAAD14', fontSize: 10 } }]
      }
    }]
  }
})
</script>

<style scoped>
.event-center {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 左侧事件列表 */
.event-list-panel {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid #1E3A5F;
  display: flex;
  flex-direction: column;
  background: #0A1628;
}

.list-header {
  padding: 16px;
  border-bottom: 1px solid #1E3A5F;
}

.list-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.list-title {
  font-size: 15px;
  font-weight: 700;
  color: #E8F0FF;
  margin: 0;
}

.list-count {
  font-size: 11px;
  color: #5A7A92;
  background: #0F1F38;
  padding: 2px 8px;
  border-radius: 10px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.filter-tab {
  padding: 4px 10px;
  font-size: 11px;
  color: #5A7A92;
  background: transparent;
  border: 1px solid #1E3A5F;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-tab:hover {
  color: #8BAAC0;
  border-color: #2A4566;
}

.filter-tab.active {
  color: #1890FF;
  background: rgba(24,144,255,0.1);
  border-color: rgba(24,144,255,0.3);
}

.event-cards {
  flex: 1;
  overflow-y: auto;
}

.event-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #0F1F38;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.event-card:hover {
  background: rgba(24,144,255,0.05);
}

.event-card.selected {
  background: rgba(24,144,255,0.1);
  border-left: 2px solid #1890FF;
}

.card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #E8F0FF;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.card-system {
  font-size: 10px;
  color: #5A7A92;
}

.card-priority {
  font-size: 10px;
  font-weight: 600;
}

.card-time {
  font-size: 10px;
  color: #5A7A92;
}

.card-status {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.card-status.pending {
  color: #FAAD14;
  background: rgba(250,173,20,0.1);
}

.card-status.processing {
  color: #1890FF;
  background: rgba(24,144,255,0.1);
}

.card-status.resolved {
  color: #52C41A;
  background: rgba(82,196,26,0.1);
}

/* 产物抽屉 */
.product-drawer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0B1A2E;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #1E3A5F;
}

.back-btn {
  background: none;
  border: none;
  color: #5A7A92;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.back-btn:hover {
  color: #E8F0FF;
  background: rgba(255,255,255,0.06);
}

.back-btn svg {
  font-size: 18px;
}

.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-title {
  font-size: 14px;
  font-weight: 700;
  color: #E8F0FF;
  margin: 0;
}

.drawer-status {
  font-size: 10px;
  padding: 2px 10px;
  border-radius: 10px;
}

.drawer-status.pending {
  color: #FAAD14;
  background: rgba(250,173,20,0.1);
}

.drawer-status.processing {
  color: #1890FF;
  background: rgba(24,144,255,0.1);
}

.drawer-status.resolved {
  color: #52C41A;
  background: rgba(82,196,26,0.1);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #8BAAC0;
  margin-bottom: 12px;
}

.section-title svg {
  font-size: 16px;
}

.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.snapshot-card {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 12px 14px;
}

.snapshot-name {
  font-size: 10px;
  color: #5A7A92;
  margin-bottom: 6px;
}

.snapshot-value {
  font-size: 20px;
  font-weight: 700;
  font-family: 'Consolas', monospace;
}

.snapshot-unit {
  font-size: 11px;
  font-weight: 400;
  margin-left: 2px;
}

.trend-chart-box {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 12px;
}

.ai-card {
  background: linear-gradient(135deg, rgba(24,144,255,0.08), rgba(0,188,212,0.08));
  border: 1px solid rgba(24,144,255,0.2);
  border-radius: 8px;
  padding: 16px;
}

.ai-summary {
  font-size: 12px;
  color: #C8D8E8;
  line-height: 1.7;
  margin-bottom: 12px;
}

.ai-causes {
  margin-bottom: 12px;
}

.cause-label, .suggest-label {
  font-size: 11px;
  color: #5A7A92;
  margin-bottom: 6px;
}

.cause-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.cause-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cause-dot.high { background: #FF4D4F; }
.cause-dot.medium { background: #FAAD14; }
.cause-dot.low { background: #52C41A; }

.cause-name {
  font-size: 12px;
  color: #E8F0FF;
}

.cause-prob {
  font-size: 10px;
  color: #5A7A92;
}

.suggest-text {
  font-size: 12px;
  color: #C8D8E8;
  line-height: 1.6;
}

.drawer-footer-hint {
  text-align: center;
  padding: 16px;
  font-size: 11px;
  color: #5A7A92;
  border-top: 1px solid #1E3A5F;
}

/* 动画 */
.slide-list-enter-active, .slide-list-leave-active {
  transition: all 0.3s ease;
}

.slide-list-enter-from, .slide-list-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-drawer-enter-active, .slide-drawer-leave-active {
  transition: all 0.3s ease;
}

.slide-drawer-enter-from {
  transform: translateX(-20px);
  opacity: 0;
}

.slide-drawer-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
