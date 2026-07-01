<script setup>
import { computed } from 'vue'
import { useShipStore } from '@/stores/shipStore'
import { Icon } from '@iconify/vue'

const shipStore = useShipStore()

const isOnline = computed(() => shipStore.isOnline)
const pendingCount = computed(() => shipStore.pendingSyncCount)
const lastSync = computed(() => shipStore.lastSyncAt)
</script>

<template>
  <div
    class="network-indicator"
    :class="{ online: isOnline, offline: !isOnline }"
  >
    <div class="net-icon-wrap">
      <Icon :icon="isOnline ? 'mdi:wifi' : 'mdi:wifi-off'" class="net-icon" />
      <span class="net-dot"></span>
    </div>
    <div class="net-info">
      <div class="net-status">
        {{ isOnline ? '在线' : '离线模式' }}
      </div>
      <div class="net-detail">
        <template v-if="isOnline">
          已同步 · {{ lastSync.substring(11) }}
        </template>
        <template v-else>
          {{ pendingCount > 0 ? `${pendingCount} 项待同步` : '本地缓存可用' }}
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.network-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid;
  user-select: none;
}

.network-indicator.online {
  background: rgba(82,196,26,0.1);
  border-color: rgba(82,196,26,0.4);
  color: #52C41A;
}

.network-indicator.offline {
  background: rgba(250,173,20,0.1);
  border-color: rgba(250,173,20,0.4);
  color: #FAAD14;
}

.net-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.net-icon {
  font-size: 18px;
}

.net-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #0A1628;
}

.online .net-dot {
  background: #52C41A;
  box-shadow: 0 0 6px rgba(82,196,26,0.8);
}

.offline .net-dot {
  background: #FAAD14;
  box-shadow: 0 0 6px rgba(250,173,20,0.8);
}

.net-status {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.1;
}

.net-detail {
  font-size: 10px;
  color: #8BAAC0;
  margin-top: 1px;
  line-height: 1.1;
}
</style>
