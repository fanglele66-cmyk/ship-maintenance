<template>
  <header class="app-header">
    <div class="header-left">
      <span class="ship-name">远洋6号</span>
      <span class="status-tag" :style="{ background: statusBg, color: statusColor }">
        {{ statusLabel }}
      </span>
    </div>

    <div class="header-right">
      <span class="network-indicator">
        <span class="net-dot"></span>
        在线
      </span>
      <span class="header-time">{{ currentTime }}</span>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { shipInfo, statusLabels, statusColors } from '@/mock/devices'

const currentTime = ref('')

const statusLabel = computed(() => statusLabels[shipInfo.status] || '未知')
const statusColor = computed(() => statusColors[shipInfo.status] || '#5A7A92')
const statusBg = computed(() => statusColors[shipInfo.status] + '20' || '#5A7A9220')

let timer = null

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.app-header {
  height: var(--header-height);
  background: #0F1F38;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ship-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.network-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--success);
}

.net-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-time {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
</style>
