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

    <!-- Subsystem filter tabs (设备级) / System filter tabs (全局级) -->
    <div class="sg-tabs-wrapper">
      <div class="sg-tabs-label" v-if="sensorStore.currentDeviceId">按子系统筛选</div>
      <div class="sg-tabs" ref="tabsRef">
        <!-- 设备级：子系统 tab -->
        <template v-if="sensorStore.currentDeviceId">
          <button
            v-for="tag in sensorStore.currentSubsystemTags"
            :key="tag"
            class="filter-tag"
            :class="{ active: sensorStore.currentSubsystem === tag }"
            @click="sensorStore.setSubsystem(tag)"
          >
            {{ tag }}
          </button>
        </template>
        <!-- 全局级：系统 tab（兼容旧逻辑） -->
        <template v-else>
          <button
            v-for="tag in systemTags"
            :key="tag"
            class="filter-tag"
            :class="{ active: sensorStore.currentSystem === tag }"
            @click="sensorStore.setSystem(tag)"
          >
            {{ tag }}
          </button>
        </template>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="sg-stats">
      <span>{{ sensorStore.sensorStats.total }} 个传感器</span>
    </div>

    <!-- Sensor cards grid (3 columns) -->
    <div class="sg-grid">
      <div
        v-for="sensor in filteredSensors"
        :key="sensor.id"
        class="sensor-card"
        @click="$emit('selectSensor', sensor)"
      >
        <div class="sc-body">
          <div class="sc-name-en">{{ sensor.nameEn }}</div>
          <div class="sc-name-cn">{{ sensor.nameCn }}</div>
          <div class="sc-value-row">
            <span class="sc-value">
              {{ sensor.value }}
              <span class="sc-unit">{{ sensor.unit }}</span>
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
  font-size: var(--font-sm);
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

.sg-tabs-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-bottom: 4px;
  padding-left: 2px;
}

.sg-tabs {
  display: flex;
  gap: 6px;
}

.filter-tag {
  font-size: var(--font-sm);
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
  font-size: var(--font-xs);
  color: var(--text-muted);
  flex-shrink: 0;
}

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
  background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(22, 119, 255, 0.03) 100%);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}
.sensor-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.12);
  transform: translateY(-2px);
}

.sc-body {
  flex: 1;
  padding: 10px 12px;
  min-width: 0;
}

.sc-name-en {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-name-cn {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 1px;
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

.sc-unit {
  font-size: var(--font-sm);
  font-weight: 400;
  margin-left: 2px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 32px;
  text-align: center;
  font-size: var(--font-sm);
  color: var(--text-muted);
}
</style>
