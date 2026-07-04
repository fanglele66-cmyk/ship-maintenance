<template>
  <div class="sensor-grid">
    <!-- Search bar -->
    <div class="sg-search">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="输入传感器名称..."
      />
    </div>

    <!-- System filter tabs -->
    <div class="sg-tabs-wrapper">
      <div class="sg-tabs" ref="tabsRef">
        <button
          v-for="tag in systemTags"
          :key="tag"
          class="filter-tag"
          :class="{ active: sensorStore.currentSystem === tag }"
          @click="sensorStore.setSystem(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="sg-stats">
      <span>{{ sensorStore.sensorStats.total }} 个传感器</span>
      <span v-if="sensorStore.sensorStats.over > 0" class="stat-over">
        🔴 超限 {{ sensorStore.sensorStats.over }}
      </span>
      <span v-if="sensorStore.sensorStats.warning > 0" class="stat-warning">
        🟡 预警 {{ sensorStore.sensorStats.warning }}
      </span>
    </div>

    <!-- Sensor cards grid (3 columns) -->
    <div class="sg-grid">
      <div
        v-for="sensor in filteredSensors"
        :key="sensor.id"
        class="sensor-card"
        :class="sensor.status"
        @click="$emit('selectSensor', sensor)"
      >
        <div class="sc-left-bar" :class="sensor.status"></div>
        <div class="sc-body">
          <div class="sc-name-en">{{ sensor.nameEn }}</div>
          <div class="sc-name-cn">{{ sensor.nameCn }}</div>
          <div class="sc-meta">{{ sensor.system }} · {{ sensor.device }}</div>
          <div class="sc-value-row">
            <span class="sc-value" :class="sensor.status">
              {{ sensor.value }}
              <span class="sc-unit">{{ sensor.unit }}</span>
            </span>
            <span class="sc-badge" :class="sensor.status">
              {{ sensor.status === 'over' ? '超限' : sensor.status === 'warning' ? '预警' : '正常' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="filteredSensors.length === 0" class="empty-state">
        未找到匹配的传感器
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSensorStore } from '@/stores/sensorStore'
import { systemTags } from '@/mock/sensors'

const emit = defineEmits(['selectSensor'])

const sensorStore = useSensorStore()
const searchQuery = ref('')
const tabsRef = ref(null)

const filteredSensors = computed(() => {
  let list = sensorStore.filteredSensors
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.nameEn.toLowerCase().includes(q) ||
      s.nameCn.includes(q)
    )
  }
  return list
})
</script>

<style scoped>
.sensor-grid {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sg-search {
  padding: 12px 16px 0;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 7px 12px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input::placeholder {
  color: var(--text-muted);
}
.search-input:focus {
  border-color: var(--accent);
}

.sg-tabs-wrapper {
  padding: 10px 16px 6px;
  flex-shrink: 0;
  overflow-x: auto;
}

.sg-tabs {
  display: flex;
  gap: 6px;
}

.filter-tag {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}
.filter-tag:hover {
  color: var(--text-secondary);
  background: rgba(24,144,255,0.05);
}
.filter-tag.active {
  background: var(--accent);
  color: white;
}

.sg-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px 6px;
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.stat-over { color: var(--danger); }
.stat-warning { color: var(--warning); }

.sg-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 6px 16px 16px;
  overflow-y: auto;
  align-content: start;
}

.sensor-card {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}
.sensor-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.sc-left-bar {
  width: 3px;
  flex-shrink: 0;
}
.sc-left-bar.over { background: var(--danger); }
.sc-left-bar.warning { background: var(--warning); }
.sc-left-bar.normal { background: var(--success); }

.sc-body {
  flex: 1;
  padding: 10px 12px;
  min-width: 0;
}

.sc-name-en {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-name-cn {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 1px;
}

.sc-meta {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-value-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 4px;
}

.sc-value {
  font-size: 20px;
  font-weight: 600;
  font-family: Consolas, monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.sc-value.over { color: var(--danger); }
.sc-value.warning { color: var(--warning); }
.sc-value.normal { color: var(--success); }

.sc-unit {
  font-size: 11px;
  font-weight: 400;
  margin-left: 2px;
}

.sc-badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
}
.sc-badge.over { background: var(--danger-bg); color: var(--danger); }
.sc-badge.warning { background: var(--warning-bg); color: var(--warning); }
.sc-badge.normal { background: var(--success-bg); color: var(--success); }

.empty-state {
  grid-column: 1 / -1;
  padding: 32px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
