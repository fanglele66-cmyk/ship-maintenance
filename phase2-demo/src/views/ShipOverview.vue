<template>
  <div class="ship-overview">
    <!-- 顶部标题栏：来自 Figma 132:695 -->
    <div class="status-header">
      <div class="sh-left">
        <img class="sh-icon" src="/detail-assets/device-situation-icon.svg" alt="" aria-hidden="true" />
        <span class="sh-title">设备态势</span>
        <span class="sh-demo-tag">演示数据</span>
      </div>
    </div>

    <!-- 中部：船舶数字孪生 + 浮动设备卡 -->
    <div ref="shipBodyRef" class="ship-body-container">
      <div class="sh-meta">
        <div class="sh-meta-item">
          <span class="sh-meta-label">在线设备</span>
          <span class="sh-meta-value online">{{ deviceStore.ship.onlineDevices }} / {{ deviceStore.ship.totalDevices }} 台</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">重点设备</span>
          <span class="sh-meta-value">{{ floatingDevices.length }} / {{ deviceStore.devices.length }} 台</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">最近巡检时间</span>
          <span class="sh-meta-value">{{ deviceStore.ship.lastInspectionAt }}</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">累计作业次数</span>
          <span class="sh-meta-value">{{ deviceStore.ship.cumulativeOperations.toLocaleString() }} 次</span>
        </div>
        <div class="sh-meta-health">
          <svg width="48" height="48" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(82,196,26,0.15)" stroke-width="4" />
            <circle
              cx="28" cy="28" r="22"
              fill="none" stroke="#52C41A" stroke-width="4" stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="healthOffset"
              transform="rotate(-90, 28, 28)"
            />
          </svg>
          <span class="sh-health-text">{{ deviceStore.ship.healthScore }}</span>
        </div>
      </div>

      <div class="ship-scene" :class="{ 'is-compact': isCompactScene }">
        <img src="/ship-hologram-v6.png" class="ship-img" alt="清晰通透的蓝色全息工业船舶数字孪生模型" />

        <svg class="device-link-layer" width="100%" height="100%" aria-hidden="true">
          <g v-for="device in floatingDevices" :key="`link-${device.id}`">
            <line
              :x1="device.anchor.x"
              :y1="device.anchor.y"
              :x2="device.position.x"
              :y2="device.position.y"
              class="device-link-line"
            />
            <circle :cx="device.anchor.x" :cy="device.anchor.y" r="5" class="device-anchor-ring" />
            <circle :cx="device.anchor.x" :cy="device.anchor.y" r="2" class="device-anchor-dot" />
          </g>
        </svg>

        <!-- 浮动设备卡与船体共用同一坐标系，缩放时关系不会漂移 -->
        <div
          v-for="device in floatingDevices"
          :key="device.id"
          class="float-dev-card"
          :class="[
            { danger: device.status === 'danger', warning: device.status === 'warning' },
            `device-${device.id}`
          ]"
          :style="{ left: device.position.x, top: device.position.y }"
          role="button"
          tabindex="0"
          :aria-label="`查看${device.name}的设备态势`"
          @click="$emit('selectDevice', device)"
          @keydown.enter="$emit('selectDevice', device)"
          @keydown.space.prevent="$emit('selectDevice', device)"
        >
          <div class="fdc-name-row">
            <span class="fdc-name">{{ device.name }}</span>
            <span class="fdc-link-arrow" aria-hidden="true">→</span>
          </div>
          <div class="fdc-status-row">
            <span class="fdc-dot" :class="device.status"></span>
            <span class="fdc-status" :class="device.status">
              {{ device.status === 'danger' ? '异常' : device.status === 'warning' ? '关注' : '正常' }}
            </span>
            <span
              v-if="device.openEventCount"
              class="fdc-event-badge"
              :title="`${device.openEventCount} 项未处理待办`"
              :aria-label="`${device.openEventCount} 项未处理待办`"
            >待办 {{ device.openEventCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部：船舶工况条 -->
    <div class="ship-work-cond">
      <div class="wc-item">
        <span class="wc-label">工况</span>
        <span class="wc-value sailing"><i aria-hidden="true"></i>航行中</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">航向</span>
        <span class="wc-value">{{ deviceStore.ship.heading }}°</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">航速</span>
        <span class="wc-value">{{ deviceStore.ship.speed }} kn</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">主机转速</span>
        <span class="wc-value">450 rpm</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useDeviceStore } from '@/stores/deviceStore'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'

const emit = defineEmits(['selectDevice'])

const deviceStore = useDeviceStore()
const demoStore = usePhase2DemoStore()
const shipBodyRef = ref(null)
const { width: shipBodyWidth } = useElementSize(shipBodyRef)
const isCompactScene = computed(() => shipBodyWidth.value > 0 && shipBodyWidth.value <= 720)
const compactCardX = (ratio) => {
  const cardHalfWidth = 75
  const edgeGutter = 8
  const safeInset = cardHalfWidth + edgeGutter
  const sceneWidth = shipBodyWidth.value
  const desiredX = sceneWidth * ratio
  const safeX = Math.min(Math.max(desiredX, safeInset), sceneWidth - safeInset)
  return `${Math.round(safeX)}px`
}

const openEventCounts = computed(() => {
  return {'main-engine-1':demoStore.visibleTodos.filter(todo=>!demoStore.isTaskHandled(todo.id)).length}
})

// 4 个关键设备的浮动位置（侧视图船体：船头朝左，船尾朝右）
const floatingDevices = computed(() => {
  const devices = deviceStore.devices.filter(d =>
    ['main-engine-1', 'boiler', 'steering-gear', 'air-compressor'].includes(d.id)
  )
  // 卡片围绕船身排布；窄画布使用错层布局，避免 150px 卡片互相覆盖
  const desktopPositions = {
    'main-engine-1': {
      position: { x: '68%', y: '74%' },
      anchor: { x: '68%', y: '55%' }
    },
    'boiler': {
      position: { x: '72%', y: '31%' },
      anchor: { x: '68%', y: '45%' }
    },
    'steering-gear': {
      position: { x: '83%', y: '70%' },
      anchor: { x: '79%', y: '50%' }
    },
    'air-compressor': {
      position: { x: '46%', y: '40%' },
      anchor: { x: '48%', y: '53%' }
    }
  }
  const compactPositions = {
    'main-engine-1': {
      position: { x: compactCardX(0.59), y: '80%' },
      anchor: { x: '69.8%', y: '55.5%' }
    },
    'boiler': {
      position: { x: compactCardX(0.71), y: '27%' },
      anchor: { x: '69.8%', y: '44.5%' }
    },
    'steering-gear': {
      position: { x: compactCardX(0.78), y: '59%' },
      anchor: { x: '81.9%', y: '50%' }
    },
    'air-compressor': {
      position: { x: compactCardX(0.43), y: '41%' },
      anchor: { x: '47.8%', y: '53.3%' }
    }
  }
  const positions = isCompactScene.value ? compactPositions : desktopPositions
  return devices.map(d => ({
    ...d,
    status:d.id==='main-engine-1'?(demoStore.progress.fault<4||demoStore.todoCreated.drift&&demoStore.progress.drift>=2&&demoStore.progress.drift<6?'danger':demoStore.monitorStep.stable<2||!demoStore.todoCreated.drift||!demoStore.todoCreated.maintenance?'warning':'normal'):d.status,
    position: positions[d.id]?.position || { x: '50%', y: '50%' },
    anchor: positions[d.id]?.anchor || { x: '50%', y: '50%' },
    openEventCount: openEventCounts.value[d.id] || 0
  }))
})

const circumference = 2 * Math.PI * 22 // ~138.2
const healthOffset = computed(() => {
  return circumference - ((deviceStore.ship.healthScore || 0) / 100 * circumference)
})
</script>

<style scoped>
.ship-overview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #F3F7FF;
  overflow: hidden;
}

/* ===== 顶部状态条 ===== */
.status-header {
  height: 48px;
  box-sizing: border-box;
  padding: 0 16px;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.sh-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sh-icon { width: 20px; height: 20px; display: block; }
.sh-title {
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 500;
}
.sh-demo-tag { border-radius: 10px; background: #F1F5FA; color: #77869A; padding: 3px 8px; font-size: 11px; line-height: 1.4; }
.sh-meta {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  box-sizing: border-box;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.72);
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0,8,20,0.10);
}
.sh-meta-item {
  flex: 1 1 112px;
  min-width: 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.sh-meta-label {
  color: #6C7183;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}
.sh-meta-value {
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sh-meta-value.online {
  color: var(--success);
}
.sh-meta-health {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  margin-left: auto;
}
.sh-health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 13px;
  font-weight: 700;
  color: #19213D;
  font-variant-numeric: tabular-nums;
}

/* ===== 中部船体 ===== */
.ship-body-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  /* 取自图片上下边缘的实际色值，让不同屏幕比例下的留白自然延展 */
  background: linear-gradient(180deg, #001133 0%, #001235 100%);
}
.ship-scene {
  position: absolute;
  left: 50%;
  top: 57%;
  width: 112%;
  aspect-ratio: 1672 / 941;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.ship-scene.is-compact {
  /* 卡片坐标层保持在可视区域内，船图在内部独立放大 */
  width: 100%;
}
.ship-scene.is-compact .ship-img {
  transform: scale(1.1);
  transform-origin: center;
}
.ship-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  z-index: 1;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 5%, #000 93%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 5%, #000 93%, transparent 100%);
}
.device-link-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: visible;
  pointer-events: none;
}
.device-link-line {
  stroke: rgba(103, 207, 255, 0.34);
  stroke-width: 1;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.device-anchor-ring {
  fill: rgba(5, 33, 62, 0.72);
  stroke: rgba(103, 207, 255, 0.38);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.device-anchor-dot {
  fill: #67CFFF;
  filter: drop-shadow(0 0 4px rgba(103, 207, 255, 0.75));
}

/* ===== 浮动设备卡 ===== */
.float-dev-card {
  position: absolute;
  width: 150px;
  min-width: 150px;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid rgba(105,199,255,0.26);
  border-radius: 8px;
  background: rgba(7,29,51,0.88);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,10,28,0.30);
  transform: translate(-50%, -50%);
}
.float-dev-card:hover {
  border-color: #66D0FF;
  transform: translate(-50%, calc(-50% - 2px));
  box-shadow: 0 10px 28px rgba(0,16,38,0.42), 0 0 0 1px rgba(102,208,255,0.10);
}
.float-dev-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.float-dev-card.danger {
  border-color: rgba(255,103,116,0.44);
}
.float-dev-card.warning {
  border-color: rgba(255,174,92,0.44);
}
.float-dev-card.danger:hover {
  border-color: #FF6774;
  box-shadow: 0 10px 28px rgba(0,16,38,0.42), 0 0 0 1px rgba(255,103,116,0.22), 0 0 18px rgba(255,103,116,0.16);
}
.float-dev-card.warning:hover {
  border-color: #FFAE5C;
  box-shadow: 0 10px 28px rgba(0,16,38,0.42), 0 0 0 1px rgba(255,174,92,0.22), 0 0 18px rgba(255,174,92,0.16);
}

.fdc-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
}
.fdc-name {
  font-size: var(--font-base);
  font-weight: 600;
  color: #F4F8FF;
}
.fdc-link-arrow {
  margin-left: auto;
  color: #67CFFF;
  font-size: var(--font-base);
  line-height: 1;
  transition: transform 0.18s ease;
}
.float-dev-card:hover .fdc-link-arrow {
  transform: translateX(2px);
}
.fdc-status-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 20px;
}
.fdc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.fdc-dot.danger { background: var(--danger); }
.fdc-dot.warning { background: var(--warning); }
.fdc-dot.normal { background: var(--success); }

.fdc-status {
  font-size: var(--font-sm);
  font-weight: 500;
}
.fdc-status.danger { color: var(--danger); }
.fdc-status.warning { color: var(--warning); }
.fdc-status.normal { color: var(--success); }
.fdc-event-badge {
  margin-left: auto;
  padding: 0 6px;
  border: 1px solid rgba(185, 201, 216, 0.20);
  border-radius: 999px;
  background: rgba(185, 201, 216, 0.08);
  color: #B9C9D8;
  font-size: 11px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
}
/* ===== 底部工况条 ===== */
.ship-work-cond {
  height: 32px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px 16px;
  background: #FFFFFF;
  flex-shrink: 0;
}
.wc-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.wc-label {
  color: #6C7183;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}
.wc-value {
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.wc-value.sailing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
  font-weight: 400;
}
.wc-value.sailing i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.wc-divider {
  width: 1px;
  height: 16px;
  background: #EBEEF5;
}

@media (max-width: 980px) {
  .sh-meta { gap: 10px; padding-inline: 12px; }
  .sh-meta-item { min-width: 72px; }
  .float-dev-card { min-width: 100px; }
}
</style>
