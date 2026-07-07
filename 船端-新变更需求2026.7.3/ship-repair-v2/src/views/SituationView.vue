<template>
  <div class="situation-view">
    <!-- Layer indicator -->
    <div class="layer-indicator">
      <div class="layer-dots">
        <span
          v-for="(lbl, idx) in layerLabels"
          :key="idx"
          class="layer-dot"
          :class="{ active: currentLayer === idx + 1 }"
          @click="goToLayer(idx + 1)"
        ></span>
      </div>
      <div class="layer-title">{{ layerLabels[currentLayer - 1] }}</div>
    </div>

    <!-- Main content area (without assistant) -->
    <div class="situation-content">
      <!-- Layer 1: Ship Overview -->
      <div
        class="layer"
        :class="{
          'layer-current': currentLayer === 1,
          'layer-hidden-left': currentLayer > 1,
          'layer-hidden-right': currentLayer < 1
        }"
      >
        <ShipOverview @select-device="handleDeviceClick" />
      </div>

      <!-- Layer 2: Sensor Grid -->
      <div
        class="layer"
        :class="{
          'layer-current': currentLayer === 2,
          'layer-hidden-left': currentLayer > 2,
          'layer-hidden-right': currentLayer < 2
        }"
      >
        <div class="layer-header">
          <button class="back-btn" @click="goToLayer(1)">← 返回</button>
          <span class="layer-subtitle">{{ selectedDeviceName }}</span>
        </div>
        <SensorGrid @select-sensor="handleSensorClick" />
      </div>

      <!-- Layer 3: Sensor Trend -->
      <div
        class="layer"
        :class="{
          'layer-current': currentLayer === 3,
          'layer-hidden-left': currentLayer > 3,
          'layer-hidden-right': currentLayer < 3
        }"
      >
        <div class="layer-header">
          <button class="back-btn" @click="goToLayer(2)">← 返回</button>
          <span class="layer-subtitle">{{ selectedSensorName }}</span>
        </div>
        <SensorTrend @back="goToLayer(2)" @generate-event="handleGenerateEvent" />
      </div>
    </div>

    <!-- Right: AI Assistant -->
    <AssistantPanel
      mode="auxiliary"
      :event-context="null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AssistantPanel from '@/components/AssistantPanel.vue'
import ShipOverview from './ShipOverview.vue'
import SensorGrid from './SensorGrid.vue'
import SensorTrend from './SensorTrend.vue'
import { useDeviceStore } from '@/stores/deviceStore'
import { useSensorStore } from '@/stores/sensorStore'

const deviceStore = useDeviceStore()
const sensorStore = useSensorStore()

const currentLayer = ref(1)
const selectedDeviceId = ref(null)
const selectedDeviceName = ref('')
const selectedSensorName = ref('')

const layerLabels = ['船舶总览', '设备传感器', '趋势分析']

const selectedDevice = computed(() => {
  if (!selectedDeviceId.value) return null
  return deviceStore.getDeviceById(selectedDeviceId.value)
})

function goToLayer(layer) {
  currentLayer.value = layer
}

function handleDeviceClick(device) {
  selectedDeviceId.value = device.id
  selectedDeviceName.value = device.name + ' · ' + device.system
  // Filter sensors by this device's system
  sensorStore.setSystem(device.system)
  goToLayer(2)
}

function handleSensorClick(sensor) {
  sensorStore.selectSensor(sensor.id)
  selectedSensorName.value = sensor.nameEn + ' · ' + sensor.nameCn
  goToLayer(3)
}

function handleGenerateEvent() {
  // In a real app, this would create a new event and navigate to event center
  alert('事件快照已生成，请前往事件中心查看')
}
</script>

<style scoped>
.situation-view {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
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

.layer-dots {
  display: flex;
  gap: 6px;
  pointer-events: auto;
}

.layer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-color);
  cursor: pointer;
  transition: all 0.3s ease;
}
.layer-dot.active {
  width: 18px;
  border-radius: 3px;
  background: var(--accent);
}

.layer-title {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.situation-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

/* Layer slide transitions */
.layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  overflow: hidden;
}

.layer-current {
  transform: translateX(0);
  opacity: 1;
  z-index: 2;
}

.layer-hidden-left {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
  z-index: 1;
}

.layer-hidden-right {
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
  z-index: 1;
}

.layer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  z-index: 5;
}

.back-btn {
  font-size: var(--text-sm);
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.back-btn:hover {
  background: rgba(24,144,255,0.1);
}

.layer-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
