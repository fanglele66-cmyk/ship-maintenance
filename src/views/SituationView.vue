<template>
  <div class="situation-view">
    <!-- 层级指示器 -->
    <div class="level-indicator">
      <div
        v-for="level in 3"
        :key="level"
        class="level-dot"
        :class="{ active: currentLevel === level }"
        @click="goToLevel(level)"
      ></div>
    </div>

    <!-- 第一层：船舶线框图 + 悬浮设备卡片 -->
    <div v-show="currentLevel === 1" class="level level-1">
      <div class="ship-container">
        <div class="ship-image-wrapper">
          <img :src="shipBg" alt="船舶线框图" class="ship-image" />
          <!-- 扫描动效 -->
          <div class="scan-line"></div>
          <div class="scan-glow"></div>
          <!-- 设备卡片 -->
          <div
            v-for="device in shipDevices"
            :key="device.id"
            class="device-card"
            :style="{ left: device.x + '%', top: device.y + '%' }"
            @click="selectDevice(device)"
          >
            <div class="device-status-dot" :class="device.status"></div>
            <div class="device-info">
              <div class="device-name">{{ device.name }}</div>
              <div class="device-status-text" :class="device.status">{{ device.statusText }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第二层：系统筛选 + 传感器卡片网格 -->
    <div v-show="currentLevel === 2" class="level level-2">
      <div class="level-header">
        <button class="back-btn" @click="goToLevel(1)">
          <Icon icon="mdi:arrow-left" />
          返回
        </button>
        <h3 class="level-title">{{ selectedSystem?.name || '传感器列表' }}</h3>
      </div>
      <div class="system-tabs">
        <button
          v-for="sys in systems"
          :key="sys.key"
          class="system-tab"
          :class="{ active: selectedSystem?.key === sys.key }"
          @click="selectSystem(sys)"
        >{{ sys.name }}</button>
      </div>
      <div class="sensor-grid">
        <div
          v-for="sensor in filteredSensors"
          :key="sensor.id"
          class="sensor-card"
          :class="sensor.status"
          @click="selectSensor(sensor)"
        >
          <div class="sensor-indicator"></div>
          <div class="sensor-content">
            <div class="sensor-name-en">{{ sensor.nameEn }}</div>
            <div class="sensor-name-cn">{{ sensor.nameCn }}</div>
            <div class="sensor-value">
              {{ sensor.value }}<span class="sensor-unit">{{ sensor.unit }}</span>
            </div>
            <div class="sensor-status-badge" :class="sensor.status">
              {{ statusLabel(sensor.status) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第三层：左侧传感器列表 + 右侧趋势图 -->
    <div v-show="currentLevel === 3" class="level level-3">
      <div class="level-header">
        <button class="back-btn" @click="goToLevel(2)">
          <Icon icon="mdi:arrow-left" />
          返回
        </button>
        <h3 class="level-title">{{ selectedSensor?.nameCn || '趋势详情' }}</h3>
      </div>
      <div class="trend-layout">
        <div class="sensor-list">
          <div
            v-for="sensor in filteredSensors"
            :key="sensor.id"
            class="sensor-list-item"
            :class="{ selected: selectedSensor?.id === sensor.id, [sensor.status]: true }"
            @click="selectSensor(sensor)"
          >
            <div class="list-item-indicator"></div>
            <div class="list-item-content">
              <div class="list-item-name">{{ sensor.nameEn }}</div>
              <div class="list-item-value">{{ sensor.value }}{{ sensor.unit }}</div>
            </div>
          </div>
        </div>
        <div class="trend-chart-container">
          <v-chart :option="trendOption" autoresize style="height: 100%;" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import shipBg from '@/assets/shipBg'
import { deviceList, sensorData } from '@/mock'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const currentLevel = ref(1)
const selectedDevice = ref(null)
const selectedSystem = ref(null)
const selectedSensor = ref(null)

// 船舶上显示的设备（4个关键设备）
const shipDevices = computed(() => {
  const keyDevices = ['DEV-001', 'DEV-003', 'DEV-005', 'DEV-010']
  return deviceList
    .filter(d => keyDevices.includes(d.id))
    .map((d, idx) => ({
      ...d,
      statusText: { normal: '正常', warning: '预警', danger: '异常', offline: '离线' }[d.status],
      x: [63, 70, 35, 91][idx],
      y: [60, 36, 54, 62][idx]
    }))
})

// 系统列表（key 对应 sensorData.system 字段）
const systems = [
  { key: 'engine', name: '主机系统' },
  { key: 'generator', name: '辅机系统' },
  { key: 'pump', name: '泵系统' },
  { key: 'deck', name: '甲板机械' }
]

// 筛选后的传感器
const filteredSensors = computed(() => {
  if (!selectedSystem.value) return sensorData
  return sensorData.filter(s => s.system === selectedSystem.value.key)
})

function selectDevice(device) {
  selectedDevice.value = device
  // 根据设备选择对应系统
  const system = systems.find(s => s.key === device.system) || systems[0]
  if (system) {
    selectedSystem.value = system
  }
  currentLevel.value = 2
}

function selectSystem(system) {
  selectedSystem.value = system
}

function selectSensor(sensor) {
  selectedSensor.value = sensor
  currentLevel.value = 3
}

function goToLevel(level) {
  currentLevel.value = level
}

function statusLabel(status) {
  return { danger: '超限', warning: '预警', normal: '正常' }[status] || status
}

// 趋势图配置
const trendOption = computed(() => {
  const sensor = selectedSensor.value
  if (!sensor) return {}

  // 生成模拟趋势数据
  const hours = 24
  const data = []
  const now = new Date()
  for (let i = hours - 1; i >= 0; i--) {
    const t = new Date(now - i * 3600000)
    const base = sensor.value
    const variation = (Math.random() - 0.5) * base * 0.1
    data.push({
      time: `${String(t.getHours()).padStart(2, '0')}:00`,
      value: +(base + variation).toFixed(2)
    })
  }

  return {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
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
      }
    }]
  }
})

// 默认选择第一个系统
if (!selectedSystem.value && systems.length > 0) {
  selectedSystem.value = systems[0]
}
</script>

<style scoped>
.situation-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* 层级指示器 */
.level-indicator {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  z-index: 10;
}

.level-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1E3A5F;
  cursor: pointer;
  transition: all 0.3s ease;
}

.level-dot.active {
  width: 18px;
  border-radius: 3px;
  background: #1890FF;
}

/* 层级容器 */
.level {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 第一层：船舶线框图 */
.level-1 {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0A1628;
}

.ship-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.ship-image-wrapper {
  position: relative;
  width: 90%;
  max-width: 960px;
  aspect-ratio: 960 / 640;
}

.ship-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 扫描动效 */
.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00BCD4, transparent);
  animation: scanMove 3s linear infinite;
}

@keyframes scanMove {
  0% { top: 0; }
  100% { top: 100%; }
}

.scan-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(180deg, rgba(0,188,212,0.15), transparent);
  animation: scanMove 3s linear infinite;
  pointer-events: none;
}

/* 设备卡片 */
.device-card {
  position: absolute;
  transform: translate(-50%, -50%);
  background: rgba(15,31,56,0.8);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(0,188,212,0.4);
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 120px;
}

.device-card:hover {
  border-color: rgba(0,188,212,0.8);
  transform: translate(-50%, -50%) translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,188,212,0.2);
}

.device-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.device-status-dot.normal { background: #52C41A; }
.device-status-dot.warning { background: #FAAD14; }
.device-status-dot.danger { background: #FF4D4F; }
.device-status-dot.offline { background: #5A7A92; }

.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-name {
  font-size: 13px;
  font-weight: 700;
  color: #E8F0FF;
}

.device-status-text {
  font-size: 10px;
}

.device-status-text.normal { color: #52C41A; }
.device-status-text.warning { color: #FAAD14; }
.device-status-text.danger { color: #FF4D4F; }
.device-status-text.offline { color: #5A7A92; }

/* 第二层：传感器网格 */
.level-2 {
  display: flex;
  flex-direction: column;
  background: #0A1628;
}

.level-header {
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
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.back-btn:hover {
  color: #E8F0FF;
  background: rgba(255,255,255,0.06);
}

.back-btn svg {
  font-size: 16px;
}

.level-title {
  font-size: 14px;
  font-weight: 700;
  color: #E8F0FF;
  margin: 0;
}

.system-tabs {
  display: flex;
  gap: 6px;
  padding: 12px 20px;
  border-bottom: 1px solid #1E3A5F;
  overflow-x: auto;
}

.system-tab {
  padding: 6px 14px;
  font-size: 12px;
  color: #5A7A92;
  background: transparent;
  border: 1px solid #1E3A5F;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.system-tab:hover {
  color: #8BAAC0;
  border-color: #2A4566;
}

.system-tab.active {
  color: #fff;
  background: #1890FF;
  border-color: #1890FF;
}

.sensor-grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  align-content: start;
}

.sensor-card {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  gap: 12px;
  position: relative;
  overflow: hidden;
}

.sensor-card:hover {
  border-color: #1890FF;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(24,144,255,0.15);
}

.sensor-indicator {
  width: 3px;
  background: #52C41A;
  border-radius: 2px;
  flex-shrink: 0;
}

.sensor-card.danger .sensor-indicator { background: #FF4D4F; }
.sensor-card.warning .sensor-indicator { background: #FAAD14; }
.sensor-card.normal .sensor-indicator { background: #52C41A; }

.sensor-content {
  flex: 1;
  min-width: 0;
}

.sensor-name-en {
  font-size: 13px;
  font-weight: 700;
  color: #E8F0FF;
  margin-bottom: 2px;
}

.sensor-name-cn {
  font-size: 10px;
  color: #5A7A92;
  margin-bottom: 8px;
}

.sensor-value {
  font-size: 20px;
  font-weight: 700;
  font-family: 'Consolas', monospace;
  margin-bottom: 6px;
}

.sensor-card.danger .sensor-value { color: #FF4D4F; }
.sensor-card.warning .sensor-value { color: #FAAD14; }
.sensor-card.normal .sensor-value { color: #52C41A; }

.sensor-unit {
  font-size: 11px;
  font-weight: 400;
  margin-left: 2px;
}

.sensor-status-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  position: absolute;
  right: 12px;
  bottom: 12px;
}

.sensor-status-badge.danger {
  color: #FF4D4F;
  background: rgba(255,77,79,0.15);
}

.sensor-status-badge.warning {
  color: #FAAD14;
  background: rgba(250,173,20,0.15);
}

.sensor-status-badge.normal {
  color: #52C41A;
  background: rgba(82,196,26,0.15);
}

/* 第三层：趋势图 */
.level-3 {
  display: flex;
  flex-direction: column;
  background: #0A1628;
}

.trend-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sensor-list {
  width: 200px;
  border-right: 1px solid #1E3A5F;
  overflow-y: auto;
  background: #0B1A2E;
}

.sensor-list-item {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #1E3A5F;
  cursor: pointer;
  transition: background 0.15s;
}

.sensor-list-item:hover {
  background: rgba(24,144,255,0.05);
}

.sensor-list-item.selected {
  background: rgba(24,144,255,0.1);
  border-left: 2px solid #1890FF;
}

.list-item-indicator {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}

.sensor-list-item.danger .list-item-indicator { background: #FF4D4F; }
.sensor-list-item.warning .list-item-indicator { background: #FAAD14; }
.sensor-list-item.normal .list-item-indicator { background: #52C41A; }

.list-item-content {
  flex: 1;
  min-width: 0;
}

.list-item-name {
  font-size: 12px;
  font-weight: 600;
  color: #E8F0FF;
  margin-bottom: 4px;
}

.list-item-value {
  font-size: 11px;
  color: #5A7A92;
  font-family: 'Consolas', monospace;
}

.trend-chart-container {
  flex: 1;
  padding: 20px;
  background: #0F1F38;
}
</style>
