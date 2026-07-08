<template>
  <div class="situation-view">
    <!-- Layer indicator -->
    <div class="layer-indicator">
      <div class="layer-dots">
        <span v-for="(lbl, idx) in layerLabels" :key="idx" class="layer-dot" :class="{ active: currentLayer === idx + 1 }" @click="goToLayer(idx + 1)"></span>
      </div>
      <div class="layer-title">{{ layerLabels[currentLayer - 1] }}</div>
    </div>

    <div class="situation-body">
      <div class="situation-content">
        <!-- Layer 1: Ship Overview -->
        <div class="layer" :class="layerClass(1)">
          <ShipOverview @select-device="handleDeviceClick" />
        </div>

        <!-- Layer 2: Sensor Grid -->
        <div class="layer" :class="layerClass(2)">
          <div class="layer-header">
            <button class="back-btn" @click="goToLayer(1)">← 返回</button>
            <span class="layer-subtitle">{{ selectedDeviceName }}</span>
          </div>
          <SensorGrid @select-sensor="handleSensorClick" />
        </div>

        <!-- Layer 3: Sensor Trend -->
        <div class="layer" :class="layerClass(3)">
          <div class="layer-header">
            <button class="back-btn" @click="goToLayer(2)">← 返回</button>
            <span class="layer-subtitle">{{ selectedSensorName }}</span>
          </div>
          <SensorTrend @back="goToLayer(2)" @generate-event="handleGenerateEvent" />
        </div>
      </div>

      <!-- 拖拽手柄（在内容区和助手之间，独立元素不受 overflow 裁剪） -->
      <div
        class="panel-resize-handle"
        @mousedown="startResize"
        @dblclick="resetWidth"
        title="拖拽调整宽度 · 双击重置"
      >
        <div class="panel-resize-grip"></div>
      </div>

      <!-- 助手面板容器（宽度由拖拽控制） -->
      <div class="assistant-wrapper" :style="assistantWidthStyle">
        <AssistantPanel mode="auxiliary" :event-context="null" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, provide, watch } from 'vue'
import AssistantPanel from '@/components/AssistantPanel.vue'
import ShipOverview from './ShipOverview.vue'
import SensorGrid from './SensorGrid.vue'
import SensorTrend from './SensorTrend.vue'
import { useDeviceStore } from '@/stores/deviceStore'
import { useSensorStore } from '@/stores/sensorStore'
import { useEventStore } from '@/stores/eventStore'

const deviceStore = useDeviceStore()
const sensorStore = useSensorStore()
const eventStore = useEventStore()

const currentLayer = ref(1)
const selectedDeviceId = ref(null)
const selectedDeviceName = ref('')
const selectedSensorName = ref('')
const layerLabels = ['船舶总览', '设备传感器', '趋势分析']

const situationContext = reactive({
  layer: 1,
  device: null,
  sensor: null,
  action: null
})
provide('situationContext', situationContext)

// ===== 助手面板拖拽调宽 =====
const STORAGE_KEY = 'situation-assistant-width'
const MIN_W = 300
const MAX_W = 750
const DEFAULT_W = 420

const customWidth = ref(null)

const assistantWidthStyle = computed(() => {
  const w = customWidth.value || DEFAULT_W
  return { width: w + 'px', minWidth: w + 'px', maxWidth: w + 'px', flex: 'none' }
})

function startResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startW = customWidth.value || DEFAULT_W

  const onMove = (ev) => {
    const dx = startX - ev.clientX
    customWidth.value = Math.min(Math.max(startW + dx, MIN_W), MAX_W)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    try { localStorage.setItem(STORAGE_KEY, String(customWidth.value)) } catch (_) {}
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resetWidth() {
  customWidth.value = null
  try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
}

try {
  const v = parseInt(localStorage.getItem(STORAGE_KEY), 10)
  if (v >= MIN_W && v <= MAX_W) customWidth.value = v
} catch (_) {}

function layerClass(layer) {
  return {
    'layer-current': currentLayer.value === layer,
    'layer-hidden-left': currentLayer.value > layer,
    'layer-hidden-right': currentLayer.value < layer
  }
}

const selectedDevice = computed(() => {
  if (!selectedDeviceId.value) return null
  return deviceStore.getDeviceById(selectedDeviceId.value)
})

function goToLayer(layer) {
  currentLayer.value = layer
  situationContext.layer = layer
  situationContext.action = 'back'
  if (layer === 1) sensorStore.clearDevice()
}

function handleDeviceClick(device) {
  selectedDeviceId.value = device.id
  selectedDeviceName.value = device.name
  sensorStore.setDevice(device.id)
  goToLayer(2)
  situationContext.layer = 2
  situationContext.device = { ...device }
  situationContext.action = 'select_device'
}

function handleSensorClick(sensor) {
  sensorStore.selectSensor(sensor.id)
  selectedSensorName.value = sensor.nameEn + ' · ' + sensor.nameCn
  goToLayer(3)
  situationContext.layer = 3
  situationContext.sensor = { ...sensor }
  situationContext.action = 'select_sensor'
}

function handleGenerateEvent() {
  const sensor = sensorStore.selectedSensor
  if (!sensor) return
  const newId = 'EVT-2026-007'
  if (!eventStore.events.find(e => e.id === newId)) {
    eventStore.events.unshift({
      id: newId,
      title: `${sensor.nameCn}(${sensor.nameEn})异常`,
      system: sensor.system,
      priority: sensor.status === 'over' ? 'critical' : 'important',
      status: 'pending',
      createdAt: new Date().toISOString(),
      source: 'situation_referral',
      snapshot: {
        sensors: [{ name: sensor.nameCn, value: sensor.value, unit: sensor.unit, threshold: sensor.threshold, status: sensor.status }],
        trendData: sensorStore.currentTrendData,
        snapshotTime: new Date().toISOString()
      },
      aiAnalysis: {
        summary: `态势感知面板跳转：${sensor.nameCn}当前值${sensor.value}${sensor.unit}` + (sensor.status === 'over' ? `，超过阈值${sensor.threshold}${sensor.unit}` : ''),
        faultTable: sensor.status === 'over' ? [
          { name: '传感器读数异常', probability: 'high', detail: '当前值持续超过阈值，需立即排查原因' },
          { name: '设备运行工况变化', probability: 'medium', detail: '检查是否因负载变化导致参数偏移' }
        ] : [],
        suggestions: sensor.status === 'over' ? '建议立即进入事件详情，AI 助手会引导排查流程' : '建议持续监控趋势变化'
      },
      relatedCases: [],
      timeline: [{ time: new Date().toISOString(), action: '事件创建（态势感知跳转）' }]
    })
  }
  eventStore.selectEvent(newId)
}

situationContext.layer = 1
situationContext.action = 'enter_layer'
</script>

<style scoped>
.situation-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.situation-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.layer-indicator {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 20;
  pointer-events: none;
}

.layer-dots { display: flex; gap: 6px; pointer-events: auto; }
.layer-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border-color); cursor: pointer; transition: all 0.3s ease; }
.layer-dot.active { width: 18px; border-radius: 3px; background: var(--accent); }
.layer-title { font-size: var(--font-xs); color: var(--text-muted); }

.situation-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.layer {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  overflow: hidden;
}
.layer-current { transform: translateX(0); opacity: 1; z-index: 2; }
.layer-hidden-left { transform: translateX(-100%); opacity: 0; pointer-events: none; z-index: 1; }
.layer-hidden-right { transform: translateX(100%); opacity: 0; pointer-events: none; z-index: 1; }

.layer-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0; z-index: 5;
  box-shadow: var(--shadow-sm);
}

.back-btn {
  font-size: var(--font-sm); color: var(--accent);
  background: none; border: none; cursor: pointer;
  padding: 5px 10px; border-radius: var(--radius-sm); font-weight: 500;
}
.back-btn:hover { background: var(--accent-bg); }
.layer-subtitle { font-size: var(--font-base); color: var(--text-secondary); font-weight: 500; }

/* ===== 拖拽手柄 ===== */
.panel-resize-handle {
  width: 16px;
  cursor: col-resize;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  position: relative;
  transition: background 0.2s;
}
.panel-resize-handle:hover,
.panel-resize-handle:active {
  background: rgba(22, 119, 255, 0.06);
}
.panel-resize-grip {
  width: 4px;
  height: 40px;
  border-radius: 2px;
  background: var(--border-color);
  transition: all 0.2s;
}
.panel-resize-handle:hover .panel-resize-grip,
.panel-resize-handle:active .panel-resize-grip {
  background: var(--accent);
  height: 56px;
}

/* ===== 助手面板容器 ===== */
.assistant-wrapper {
  flex: none;
  overflow: hidden;
  border-left: 1px solid var(--border-primary);
}
/* 覆盖 AssistantPanel 自身的 flex/min-width，让外层 wrapper 完全掌控宽度 */
.assistant-wrapper :deep(.assistant-panel) {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: 100% !important;
}
</style>
