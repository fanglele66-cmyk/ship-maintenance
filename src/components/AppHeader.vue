<template>
  <header class="app-header">
    <!-- 左侧：船名 + 航行状态 -->
    <div class="header-left">
      <div class="ship-brand">
        <Icon icon="mdi:ferry" class="brand-icon" />
        <span class="ship-name">{{ shipStore.shipDisplayName }}</span>
        <span class="ship-status">{{ shipStore.navStatusLabel }}</span>
      </div>
    </div>

    <!-- 中间：时钟 -->
    <div class="header-center">
      <div class="clock font-mono-num">{{ timeStr }}</div>
      <div class="date">{{ dateStr }}</div>
    </div>

    <!-- 右侧：网络指示 -->
    <div class="header-right">
      <NetworkIndicator />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShipStore } from '@/stores/shipStore'
import NetworkIndicator from './NetworkIndicator.vue'

const shipStore = useShipStore()

const timeStr = computed(() => {
  const d = shipStore.systemTime
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
})

const dateStr = computed(() => {
  const d = shipStore.systemTime
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`
})
</script>

<style scoped>
.app-header {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: linear-gradient(180deg, #0F2238 0%, #0A1828 100%);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
}

.ship-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 22px;
  color: var(--accent-primary);
}

.ship-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.ship-status {
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 8px;
  background: rgba(24, 144, 255, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(24, 144, 255, 0.2);
}

.header-center {
  text-align: center;
}

.clock {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-primary);
  letter-spacing: 1px;
}

.date {
  font-size: 10px;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
