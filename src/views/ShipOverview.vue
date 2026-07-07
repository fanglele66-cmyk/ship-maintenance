<template>
  <div class="ship-overview">
    <!-- Ship Health Info -->
    <div class="ship-info-bar">
      <div class="health-score">
        <div class="health-ring">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#1E3A5F" stroke-width="3" />
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              :stroke="healthColor"
              stroke-width="3"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="healthOffset"
              transform="rotate(-90, 22, 22)"
            />
          </svg>
          <span class="health-text" :style="{ color: healthColor }">{{ deviceStore.ship.healthScore }}</span>
        </div>
        <div class="health-label">健康分</div>
      </div>
      <div class="ship-status-info">
        <div class="info-row">
          <span class="info-label">航速</span>
          <span class="info-value">{{ deviceStore.ship.speed }} kn</span>
        </div>
        <div class="info-row">
          <span class="info-label">航向</span>
          <span class="info-value">{{ deviceStore.ship.heading }}°</span>
        </div>
        <div class="info-row">
          <span class="info-label">位置</span>
          <span class="info-value">{{ deviceStore.ship.latitude }} {{ deviceStore.ship.longitude }}</span>
        </div>
      </div>
      <div class="device-summary">
        <div class="summary-item">
          <span class="summary-dot" style="background:#FF4D4F"></span>
          <span>{{ dangerCount }} 异常</span>
        </div>
        <div class="summary-item">
          <span class="summary-dot" style="background:#FAAD14"></span>
          <span>{{ warningCount }} 预警</span>
        </div>
        <div class="summary-item">
          <span class="summary-dot" style="background:#52C41A"></span>
          <span>{{ normalCount }} 正常</span>
        </div>
      </div>
    </div>

    <!-- Ship Body canvas area -->
    <div class="ship-body-container">
      <!-- Grid overlay -->
      <div class="scan-grid-overlay"></div>
      <!-- Scan line -->
      <div class="scan-line"></div>
      <div class="scan-glow"></div>

      <!-- Ship SVG outline -->
      <svg class="ship-svg" viewBox="0 0 680 460" xmlns="http://www.w3.org/2000/svg">
        <!-- Hull -->
        <path d="M340 120 L120 340 L80 380 L600 380 L560 340 Z"
          fill="none" stroke="rgba(0,188,212,0.25)" stroke-width="2" />
        <!-- Deck -->
        <line x1="160" y1="300" x2="520" y2="300" stroke="rgba(0,188,212,0.15)" stroke-width="1" />
        <!-- Superstructure -->
        <rect x="260" y="120" width="160" height="180" rx="4"
          fill="none" stroke="rgba(0,188,212,0.2)" stroke-width="1.5" />
        <!-- Cabin -->
        <rect x="280" y="140" width="120" height="60" rx="3"
          fill="none" stroke="rgba(0,188,212,0.15)" stroke-width="1" />
        <!-- Windows -->
        <rect x="290" y="150" width="18" height="14" rx="2" fill="rgba(24,144,255,0.3)" />
        <rect x="314" y="150" width="18" height="14" rx="2" fill="rgba(24,144,255,0.3)" />
        <rect x="338" y="150" width="18" height="14" rx="2" fill="rgba(24,144,255,0.3)" />
        <rect x="362" y="150" width="18" height="14" rx="2" fill="rgba(24,144,255,0.3)" />
        <!-- Funnel / Chimney -->
        <rect x="320" y="80" width="40" height="42" rx="2"
          fill="none" stroke="rgba(0,188,212,0.2)" stroke-width="1.5" />
        <line x1="330" y1="85" x2="330" y2="118" stroke="rgba(0,188,212,0.1)" stroke-width="1" />
        <line x1="350" y1="85" x2="350" y2="118" stroke="rgba(0,188,212,0.1)" stroke-width="1" />
        <!-- Bow -->
        <path d="M340 120 Q380 200 480 340" fill="none" stroke="rgba(0,188,212,0.15)" stroke-width="1" />
        <path d="M340 120 Q300 200 200 340" fill="none" stroke="rgba(0,188,212,0.15)" stroke-width="1" />
        <!-- Waterline -->
        <line x1="60" y1="390" x2="620" y2="390" stroke="rgba(24,144,255,0.15)" stroke-width="1" stroke-dasharray="4,4" />
        <!-- Engine room area indicator -->
        <rect x="200" y="240" width="60" height="40" rx="3" fill="none" stroke="rgba(255,77,79,0.2)" stroke-width="1" />
        <text x="212" y="262" fill="rgba(255,77,79,0.3)" font-size="9" font-family="monospace">ENGINE</text>
      </svg>

      <!-- Floating device cards on ship -->
      <div
        v-for="device in floatingDevices"
        :key="device.id"
        class="float-dev-card"
        :class="{ danger: device.status === 'danger', warning: device.status === 'warning' }"
        :style="{ left: device.position.x, top: device.position.y }"
        @click="$emit('selectDevice', device)"
      >
        <div class="fdc-header">
          <span class="fdc-dot" :class="device.status"></span>
          <span class="fdc-name">{{ device.name }}</span>
        </div>
        <div class="fdc-status" :class="device.status">
          {{ device.status === 'danger' ? '异常' : device.status === 'warning' ? '预警' : '正常' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDeviceStore } from '@/stores/deviceStore'

const emit = defineEmits(['selectDevice'])

const deviceStore = useDeviceStore()

const floatingDevices = computed(() => {
  // Only show 4 key devices on the ship overview
  return deviceStore.devices.filter(d =>
    ['main-engine-1', 'boiler', 'steering-gear', 'air-compressor'].includes(d.id)
  )
})

const dangerCount = computed(() => deviceStore.dangerDevices.length)
const warningCount = computed(() => deviceStore.warningDevices.length)
const normalCount = computed(() => {
  return deviceStore.devices.length - dangerCount.value - warningCount.value
})

const circumference = 2 * Math.PI * 18 // ~113.1
const healthColor = computed(() => {
  const score = deviceStore.ship.healthScore
  if (score >= 80) return '#52C41A'
  if (score >= 60) return '#FAAD14'
  return '#FF4D4F'
})
const healthOffset = computed(() => {
  return circumference - (deviceStore.ship.healthScore / 100) * circumference
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

.ship-info-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 20px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  z-index: 5;
}

.health-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.health-ring {
  position: relative;
  width: 48px;
  height: 48px;
}

.health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 15px;
  font-weight: 700;
  font-family: Consolas, monospace;
}

.health-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.ship-status-info {
  display: flex;
  gap: 18px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.info-value {
  font-size: var(--font-base);
  font-weight: 600;
  font-family: Consolas, monospace;
  color: var(--text-primary);
}

.device-summary {
  margin-left: auto;
  display: flex;
  gap: 14px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.summary-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

/* Ship body */
.ship-body-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #E8EDF2 0%, #DCE3EA 100%);
}

.scan-grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.scan-line {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom,
    transparent 0%,
    rgba(22,119,255,0.04) 50%,
    transparent 100%
  );
  animation: scan-line 3s ease-in-out infinite;
  pointer-events: none;
}

.scan-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(22,119,255,0.06) 0%, transparent 70%);
  animation: scan-glow 3s ease-in-out infinite;
  pointer-events: none;
}

.ship-svg {
  width: 80%;
  max-width: 600px;
  height: auto;
  z-index: 0;
}

@keyframes scan-line {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

@keyframes scan-glow {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.4; }
}

/* Floating device cards */
.float-dev-card {
  position: absolute;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  min-width: 90px;
  box-shadow: var(--shadow-sm);
}
.float-dev-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.float-dev-card.danger {
  border-color: rgba(245,63,63,0.3);
  box-shadow: 0 2px 8px rgba(245,63,63,0.08);
}
.float-dev-card.warning {
  border-color: rgba(255,125,0,0.3);
  box-shadow: 0 2px 8px rgba(255,125,0,0.08);
}

.fdc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.fdc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.fdc-dot.danger { background: var(--danger); }
.fdc-dot.warning { background: var(--warning); }
.fdc-dot.normal { background: var(--success); }

.fdc-name {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
}

.fdc-status {
  font-size: var(--font-sm);
  text-align: right;
  font-weight: 500;
}
.fdc-status.danger { color: var(--danger); }
.fdc-status.warning { color: var(--warning); }
.fdc-status.normal { color: var(--success); }
</style>
