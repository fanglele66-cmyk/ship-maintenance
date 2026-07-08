<template>
  <div class="ship-overview">
    <!-- 顶部：设备态势状态条 -->
    <div class="status-header">
      <div class="sh-left">
        <div class="sh-bar"></div>
        <span class="sh-title">设备态势</span>
      </div>
      <div class="sh-meta">
        <div class="sh-meta-item">
          <span class="sh-meta-label">JADE STAR</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">在线情况</span>
          <span class="sh-meta-value online">在线</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">监测设备</span>
          <span class="sh-meta-value">8 点位</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">最近巡检时间</span>
          <span class="sh-meta-value">2026-06-26 08:00</span>
        </div>
        <div class="sh-meta-item">
          <span class="sh-meta-label">累计作业次数</span>
          <span class="sh-meta-value">5680 次</span>
        </div>
        <div class="sh-meta-health">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(82,196,26,0.15)" stroke-width="4" />
            <circle
              cx="28" cy="28" r="22"
              fill="none" stroke="#52C41A" stroke-width="4" stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="healthOffset"
              transform="rotate(-90, 28, 28)"
            />
          </svg>
          <span class="sh-health-text">86%</span>
        </div>
      </div>
    </div>

    <!-- 中部：船舶 + 浮动设备卡 -->
    <div class="ship-body-container">
      <div class="scan-grid-overlay"></div>
      <div class="scan-glow"></div>

      <!-- 船舶线框图（衬底） -->
      <img src="/ship-blueprint.png" class="ship-img" alt="ship blueprint" />

      <!-- 浮动设备卡 -->
      <div
        v-for="device in floatingDevices"
        :key="device.id"
        class="float-dev-card"
        :class="{ danger: device.status === 'danger', warning: device.status === 'warning' }"
        :style="{ left: device.position.x, top: device.position.y }"
        @click="$emit('selectDevice', device)"
      >
        <div class="fdc-name">{{ device.name }}</div>
        <div class="fdc-status-row">
          <span class="fdc-dot" :class="device.status"></span>
          <span class="fdc-status" :class="device.status">
            {{ device.status === 'danger' ? '异常' : device.status === 'warning' ? '预警' : '正常' }}
          </span>
        </div>
        <div v-if="device.eventCount" class="fdc-event">{{ device.eventCount }} 事件</div>
      </div>
    </div>

    <!-- 底部：船舶工况条 -->
    <div class="ship-work-cond">
      <div class="wc-item">
        <span class="wc-label">工况</span>
        <span class="wc-value sailing">航行中</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">航向</span>
        <span class="wc-value">185°</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">航速</span>
        <span class="wc-value">14.2 kn</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">主机转速</span>
        <span class="wc-value">78 rpm</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDeviceStore } from '@/stores/deviceStore'

const emit = defineEmits(['selectDevice'])

const deviceStore = useDeviceStore()

// 4 个关键设备的浮动位置（侧视图船体：船头朝左，船尾朝右）
const floatingDevices = computed(() => {
  const devices = deviceStore.devices.filter(d =>
    ['main-engine-1', 'boiler', 'steering-gear', 'air-compressor'].includes(d.id)
  )
  // 基于新船舶侧视图（720x360 近似）的设备定位
  const positions = {
    'main-engine-1': { x: '60%', y: '60%' },   // 机舱中下部
    'boiler':         { x: '74%', y: '22%' },   // 上层建筑/烟囱附近
    'steering-gear':  { x: '86%', y: '65%' },   // 船尾舵/螺旋桨区域
    'air-compressor': { x: '48%', y: '54%' }    // 机舱偏前
  }
  return devices.map(d => ({
    ...d,
    position: positions[d.id] || { x: '50%', y: '50%' },
    eventCount: d.id === 'main-engine-1' ? 1 : 0
  }))
})

const circumference = 2 * Math.PI * 22 // ~138.2
const healthOffset = computed(() => {
  return circumference - (0.86 * circumference)
})
</script>

<style scoped>
.ship-overview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #F0F2F5;
  overflow: hidden;
}

/* ===== 顶部状态条 ===== */
.status-header {
  background: var(--bg-surface);
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  gap: 24px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.sh-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sh-bar {
  width: 3px;
  height: 18px;
  background: var(--accent);
  border-radius: 2px;
}
.sh-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}
.sh-meta {
  display: flex;
  align-items: center;
  gap: 32px;
  flex: 1;
}
.sh-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sh-meta-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.sh-meta-value {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-family: Consolas, monospace;
}
.sh-meta-value.online {
  color: var(--success);
}
.sh-meta-health {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  margin-left: auto;
}
.sh-health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-sm);
  font-weight: 700;
  color: var(--success);
  font-family: Consolas, monospace;
}

/* ===== 中部船体 ===== */
.ship-body-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #E8EDF2 0%, #DCE3EA 100%);
}
.scan-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}
.scan-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.ship-img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 720px;
  height: auto;
  filter: drop-shadow(0 8px 24px rgba(0, 188, 212, 0.15));
}

/* ===== 浮动设备卡 ===== */
.float-dev-card {
  position: absolute;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  min-width: 92px;
  box-shadow: var(--shadow-sm);
  transform: translate(-50%, -50%);
}
.float-dev-card:hover {
  border-color: var(--accent);
  transform: translate(-50%, calc(-50% - 2px));
  box-shadow: var(--shadow-md);
}
.float-dev-card.danger {
  border-color: rgba(245,63,63,0.4);
  box-shadow: 0 2px 8px rgba(245,63,63,0.1);
}
.float-dev-card.warning {
  border-color: rgba(255,125,0,0.4);
  box-shadow: 0 2px 8px rgba(255,125,0,0.1);
}

.fdc-name {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.fdc-status-row {
  display: flex;
  align-items: center;
  gap: 5px;
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
.fdc-event {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 2px;
}

/* ===== 底部工况条 ===== */
.ship-work-cond {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 20px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-primary);
  flex-shrink: 0;
  font-family: Consolas, monospace;
}
.wc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-sm);
}
.wc-label {
  color: var(--text-muted);
}
.wc-value {
  color: var(--text-primary);
  font-weight: 600;
}
.wc-value.sailing {
  color: var(--success);
}
.wc-divider {
  width: 1px;
  height: 14px;
  background: var(--border-primary);
}
</style>
