<template>
  <div class="sensor-grid">
    <!-- Subsystem filter tabs (设备级) / System filter tabs (全局级) -->
    <div class="sg-tabs-wrapper">
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
      <span class="sg-stats">{{ sensorStore.sensorStats.total }} 个传感器</span>
    </div>

    <div ref="listScrollRef" class="sg-content-scroll">
      <!-- Sensor cards grid (3 columns) -->
      <div class="sg-grid">
        <div
          v-for="sensor in paginatedSensors"
          :key="sensor.id"
          class="sensor-card"
          role="button"
          tabindex="0"
          :aria-label="`查看${sensor.nameCn}的趋势分析`"
          @click="$emit('selectSensor', sensor)"
          @keydown.enter="$emit('selectSensor', sensor)"
          @keydown.space.prevent="$emit('selectSensor', sensor)"
        >
          <div class="sc-body">
            <div class="sc-name-en">{{ sensor.nameEn }}</div>
            <div class="sc-name-cn">{{ sensor.nameCn }}</div>
            <div class="sc-value-row">
              <span class="sc-value">
                {{ sensor.precision != null ? Number(sensor.value).toFixed(sensor.precision) : sensor.value }}
                <span class="sc-unit">{{ sensor.unit }}</span>
              </span>
            </div>
            <div class="sc-action">查看趋势 <span aria-hidden="true">›</span></div>
          </div>
        </div>

        <div v-if="filteredSensors.length === 0" class="empty-state">
          未找到匹配的传感器
        </div>
      </div>

      <div v-if="filteredSensors.length > pageSize" class="pagination-bar">
        <span class="pagination-total">共 {{ filteredSensors.length }} 个传感器</span>
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredSensors.length"
          size="default"
          layout="prev, pager, next"
          background
          @current-change="scrollListTop"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useSensorStore } from '@/stores/sensorStore'
import { systemTags } from '@/mock/sensors'

const emit = defineEmits(['selectSensor'])
const props = defineProps({
  searchQuery: { type: String, default: '' }
})

const sensorStore = useSensorStore()
const tabsRef = ref(null)
const listScrollRef = ref(null)
const currentPage = ref(1)
const pageSize = 15

const filteredSensors = computed(() => {
  let list = sensorStore.filteredSensors
  if (props.searchQuery.trim()) {
    const q = props.searchQuery.toLowerCase()
    list = list.filter(s =>
      s.nameEn.toLowerCase().includes(q) ||
      s.nameCn.includes(q)
    )
  }
  return list
})

const paginatedSensors = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredSensors.value.slice(start, start + pageSize)
})

function scrollListTop() {
  listScrollRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(filteredSensors, () => {
  currentPage.value = 1
  nextTick(() => listScrollRef.value?.scrollTo({ top: 0 }))
})
</script>

<style scoped>
.sensor-grid {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sg-tabs-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px 8px;
  flex-shrink: 0;
  min-width: 0;
}

.sg-tabs {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.sg-tabs::-webkit-scrollbar { display: none; }

.filter-tag {
  height: 32px;
  box-sizing: border-box;
  flex: none;
  padding: 5px 12px;
  border: 1px solid #E1E2E5;
  border-radius: 8px;
  background: #F7F7F8;
  color: #686A70;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.filter-tag:hover {
  color: #106BFF;
  background: #F5F9FF;
  border-color: #BFD4FF;
}
.filter-tag.active {
  color: #106BFF;
  background: #EDF4FF;
  border-color: #BFD4FF;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(16, 107, 255, 0.08);
}
.filter-tag:focus-visible { outline: 2px solid #106BFF; outline-offset: 1px; }

.sg-stats {
  flex: none;
  color: #B5B8C1;
  font-size: 12px;
  line-height: 20px;
  font-weight: 400;
  white-space: nowrap;
}

.sg-content-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.sg-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 6px 16px 16px;
  align-content: start;
}

.sensor-card {
  display: flex;
  background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(16, 107, 255, 0.035) 100%);
  border: 1px solid #DEE1E6;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(29, 33, 41, 0.025);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.sensor-card:hover {
  border-color: #C8CDD5;
  box-shadow: 0 6px 18px rgba(29, 33, 41, 0.08);
  transform: translateY(-1px);
}
.sensor-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
.sc-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 9px;
  padding-top: 7px;
  border-top: 1px solid #E7E9ED;
  color: #8A9099;
  font-size: var(--font-xs);
  font-weight: 500;
  transition: color 0.18s ease;
}
.sc-action span {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(29, 33, 41, 0.045);
  color: #8A9099;
  font-size: 16px;
  line-height: 1;
  transition: color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}
.sensor-card:hover .sc-action {
  color: #5F6670;
}
.sensor-card:hover .sc-action span {
  color: #5F6670;
  background: rgba(29, 33, 41, 0.075);
  transform: translateX(1px);
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

.pagination-bar {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 16px 16px;
  background: var(--bg-surface);
}

.pagination-total {
  margin-right: 12px;
  color: var(--text-muted);
  font-size: 13px;
  white-space: nowrap;
}

.pagination-bar :deep(.el-pagination.is-background .el-pager li.is-active) {
  background-color: #106BFF;
}

.pagination-bar :deep(.el-pagination button:not(:disabled)),
.pagination-bar :deep(.el-pagination .el-pager li) {
  cursor: pointer;
}

.pagination-bar :deep(.el-pagination button:disabled) {
  cursor: not-allowed;
}
</style>
