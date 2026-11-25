<template>
  <div class="pq-view">
    <!-- Left: Instantiated Points Tree (only enabled devices & enabled points) -->
    <aside class="pq-sidebar" aria-label="已启用点位列表">
      <div class="pq-side-head">
        <div class="pq-side-title">
          <span class="pq-accent-bar"></span>
          <strong>点位列表</strong>
          <small>{{ totalInstantiatedCount }} 个已启用</small>
        </div>
        <label class="pq-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input v-model="searchQuery" type="search" placeholder="搜索点位编号/名称" aria-label="搜索已启用点位" />
        </label>
      </div>

      <div class="pq-tree-scroll">
        <section v-for="device in filteredTree" :key="device.deviceId" class="pq-device-group">
          <button
            type="button"
            class="pq-device-head"
            :aria-expanded="isExpanded(device.deviceId)"
            @click="toggleDevice(device.deviceId)"
          >
            <svg class="pq-caret" :class="{ open: isExpanded(device.deviceId) }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
            <span class="pq-device-name">{{ device.deviceName }}</span>
            <span class="pq-device-count">{{ device.points.length }}个点位</span>
          </button>

          <div v-show="isExpanded(device.deviceId)" class="pq-point-list">
            <button
              v-for="pt in device.points"
              :key="pointKey(device.deviceId, pt.pointCode)"
              type="button"
              class="pq-point-row"
              :class="{ selected: isSelected(device.deviceId, pt.pointCode) }"
              :aria-pressed="isSelected(device.deviceId, pt.pointCode)"
              @click="onPointClick(device, pt)"
            >
              <span v-if="compareMode" class="pq-check" :class="{ on: isSelected(device.deviceId, pt.pointCode) }" aria-hidden="true"></span>
              <span v-else class="pq-dot" :style="{ backgroundColor: dotColor(device.deviceId, pt.pointCode, pt.pointKind) }"></span>
              <span class="pq-point-name" :title="pt.instanceName">{{ pt.instanceName }}</span>
              <span class="pq-point-code">{{ pt.pointCode }}</span>
            </button>
          </div>
        </section>

        <div v-if="filteredTree.length === 0" class="pq-empty-tree">
          暂无匹配的已启用点位
        </div>
      </div>
    </aside>

    <!-- Right: Controls + Interactive ECharts Canvas -->
    <main class="pq-canvas">
      <header class="pq-toolbar">
        <div class="pq-time-group" role="group" aria-label="时间范围选择">
          <button
            v-for="preset in timePresets"
            :key="preset.hours"
            type="button"
            class="pq-time-btn"
            :class="{ active: !customRangeActive && selectedHours === preset.hours }"
            :aria-pressed="!customRangeActive && selectedHours === preset.hours"
            @click="applyPreset(preset.hours)"
          >
            {{ preset.label }}
          </button>

          <div class="pq-custom-wrap">
            <button
              type="button"
              class="pq-time-btn"
              :class="{ active: customRangeActive || customOpen }"
              :aria-expanded="customOpen"
              @click="toggleCustomPanel"
            >
              自定义
            </button>
            <div v-if="customOpen" class="pq-custom-pop">
              <label>
                <span>开始时间</span>
                <input v-model="customStart" type="datetime-local" />
              </label>
              <label>
                <span>结束时间</span>
                <input v-model="customEnd" type="datetime-local" />
              </label>
              <p v-if="customError" class="pq-custom-err">{{ customError }}</p>
              <div class="pq-custom-actions">
                <button type="button" class="pq-pop-cancel" @click="customOpen = false">取消</button>
                <button type="button" class="pq-pop-apply" @click="applyCustomRange">应用</button>
              </div>
            </div>
          </div>
        </div>

        <div class="pq-compare-actions">
          <button v-if="selectedKeys.length > 0" type="button" class="pq-clear-btn" @click="clearSelection">
            清空选择
          </button>
          <button
            type="button"
            class="pq-compare-btn"
            :class="{ active: compareMode }"
            :aria-pressed="compareMode"
            @click="toggleCompareMode"
          >
            <component :is="compareMode ? Check : Plus" class="pq-control-icon" aria-hidden="true" />
            {{ compareMode ? `对比模式（${selectedKeys.length}/6）` : '添加点位对比' }}
          </button>
        </div>
      </header>

      <!-- Selected chips + stats -->
      <div v-if="selectedItems.length > 0" class="pq-selected-strip">
        <div class="pq-chip-list">
          <span v-for="(item, idx) in selectedItems" :key="item.key" class="pq-chip">
            <i :style="{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }"></i>
            <strong>{{ item.deviceName }} · {{ item.point.instanceName }}</strong>
            <small>{{ item.point.pointCode }}</small>
            <button type="button" :aria-label="`移除${item.deviceName}的${item.point.instanceName}`" @click="removeKey(item.key)">
              <Close class="pq-control-icon" aria-hidden="true" />
            </button>
          </span>
        </div>

        <div v-if="singleStats" class="pq-kpi-strip">
          <div>
            <span>最新值</span>
            <strong>{{ singleStats.latest }}<small>{{ singleStats.unit }}</small></strong>
          </div>
          <div>
            <span>区间均值</span>
            <strong>{{ singleStats.avg }}<small>{{ singleStats.unit }}</small></strong>
          </div>
          <div>
            <span>最小 / 最大</span>
            <strong>{{ singleStats.min }} ~ {{ singleStats.max }}<small>{{ singleStats.unit }}</small></strong>
          </div>
          <div>
            <span>正常上下限</span>
            <strong class="range-val">{{ singleStats.normalRangeText }}</strong>
          </div>
        </div>
      </div>

      <!-- Empty state vs Chart -->
      <div class="pq-chart-stage">
        <div v-if="selectedItems.length === 0" class="pq-empty-stage">
          <svg class="pq-empty-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M12 48h40M32 14v34" stroke="#CBD5E1" stroke-width="2.5" stroke-linecap="round" />
            <path d="M16 24h32" stroke="#CBD5E1" stroke-width="2.5" stroke-linecap="round" />
            <path d="M16 24 10 36h12l-6-12ZM48 24l-6 12h12l-6-12Z" stroke="#CBD5E1" stroke-width="2.2" stroke-linejoin="round" />
            <circle cx="32" cy="14" r="3" fill="#CBD5E1" />
          </svg>
          <p>请从左侧点位列表中选择一个点位</p>
        </div>
        <div v-show="selectedItems.length > 0" ref="chartRef" class="pq-echarts"></div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { Check, Close, Plus } from '@element-plus/icons-vue'
import { useShipConfigStore } from '@/stores/shipConfigStore'
import { useSensorStore } from '@/stores/sensorStore'
import { formatNormalRangeText } from '@/workflow/localSensorData.js'

const props = defineProps({
  deviceId: { type: String, default: '' }
})

const configStore = useShipConfigStore()
const sensorStore = useSensorStore()

const tree = computed(() => props.deviceId
  ? configStore.instantiatedTree.filter(device => device.deviceId === props.deviceId)
  : configStore.instantiatedTree)

const SERIES_COLORS = ['#927443', '#498378', '#94688c', '#5c7690', '#b26443', '#727e4e']

const searchQuery = ref('')
const compareMode = ref(false)
const selectedKeys = ref([])
const expandedDevices = reactive({})

const timePresets = [
  { hours: 3, label: '近3小时' },
  { hours: 6, label: '近6小时' },
  { hours: 12, label: '近12小时' },
  { hours: 24, label: '近24小时' }
]
const selectedHours = ref(3)
const customRangeActive = ref(false)
const customOpen = ref(false)
const customStart = ref('')
const customEnd = ref('')
const customError = ref('')

const chartRef = ref(null)
let chartInstance = null
let resizeObserver = null

function pointKey(deviceId, pointCode) {
  return `${deviceId}::${pointCode}`
}

// Expand all enabled devices by default so instantiated points are immediately visible like the reference UI
watch(
  () => tree.value,
  (tree) => {
    for (const dev of tree) {
      if (!(dev.deviceId in expandedDevices)) expandedDevices[dev.deviceId] = true
    }
    // Prune any keys that were disabled or deleted in PointListPanel / DeviceManagerPanel
    const valid = new Set(
      tree.flatMap((dev) => dev.points.map((pt) => pointKey(dev.deviceId, pt.pointCode)))
    )
    selectedKeys.value = selectedKeys.value.filter((k) => valid.has(k))
  },
  { immediate: true, deep: true }
)

const totalInstantiatedCount = computed(() =>
  tree.value.reduce((sum, dev) => sum + dev.points.length, 0)
)

const filteredTree = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return tree.value
    .map((dev) => ({
      ...dev,
      points: !q
        ? dev.points
        : dev.points.filter((pt) =>
            [pt.pointCode, pt.instanceName, pt.defaultName, pt.systemName, dev.deviceName].some((val) =>
              String(val || '').toLowerCase().includes(q)
            )
          )
    }))
    .filter((dev) => dev.points.length > 0)
})

const itemLookup = computed(() => {
  const map = new Map()
  for (const dev of tree.value) {
    for (const pt of dev.points) {
      const key = pointKey(dev.deviceId, pt.pointCode)
      map.set(key, { key, deviceId: dev.deviceId, deviceName: dev.deviceName, point: pt })
    }
  }
  return map
})

const selectedItems = computed(() =>
  selectedKeys.value.map((k) => itemLookup.value.get(k)).filter(Boolean)
)

function isExpanded(deviceId) {
  return searchQuery.value.trim() ? true : expandedDevices[deviceId] !== false
}

function toggleDevice(deviceId) {
  expandedDevices[deviceId] = !isExpanded(deviceId)
}

function isSelected(deviceId, pointCode) {
  return selectedKeys.value.includes(pointKey(deviceId, pointCode))
}

function dotColor(deviceId, pointCode, kind) {
  const idx = selectedKeys.value.indexOf(pointKey(deviceId, pointCode))
  if (idx >= 0) return SERIES_COLORS[idx % SERIES_COLORS.length]
  return kind === 'alarm' ? '#E04640' : '#a38b61'
}

function onPointClick(device, pt) {
  const key = pointKey(device.deviceId, pt.pointCode)
  if (compareMode.value) {
    const idx = selectedKeys.value.indexOf(key)
    if (idx >= 0) {
      selectedKeys.value.splice(idx, 1)
    } else {
      if (selectedKeys.value.length >= 6) {
        ElMessage.warning('最多同时对比 6 个已启用点位')
        return
      }
      selectedKeys.value.push(key)
    }
  } else {
    selectedKeys.value = [key]
  }
}

function toggleCompareMode() {
  compareMode.value = !compareMode.value
  if (!compareMode.value && selectedKeys.value.length > 1) {
    selectedKeys.value = [selectedKeys.value[0]]
  }
}

function removeKey(key) {
  selectedKeys.value = selectedKeys.value.filter((k) => k !== key)
}

function clearSelection() {
  selectedKeys.value = []
}

function toInputDateTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toggleCustomPanel() {
  customOpen.value = !customOpen.value
  if (customOpen.value && !customStart.value) {
    const end = sensorStore.localData?.now || Date.now()
    customEnd.value = toInputDateTime(end)
    customStart.value = toInputDateTime(end - 3 * 3600000)
  }
}

function applyPreset(hours) {
  selectedHours.value = hours
  customRangeActive.value = false
  customOpen.value = false
  customError.value = ''
}

function applyCustomRange() {
  customError.value = ''
  const s = new Date(customStart.value).getTime()
  const e = new Date(customEnd.value).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
    customError.value = '请选择有效的起止时间范围。'
    return
  }
  customRangeActive.value = true
  customOpen.value = false
}

function seriesForItem(item) {
  if (customRangeActive.value && customStart.value && customEnd.value) {
    const start = new Date(customStart.value).getTime()
    const end = new Date(customEnd.value).getTime()
    return sensorStore.getPointTrendByCode(item.point.pointCode, selectedHours.value, start, end)
  }
  return sensorStore.getPointTrendByCode(item.point.pointCode, selectedHours.value)
}

const singleStats = computed(() => {
  if (selectedItems.value.length !== 1) return null
  const item = selectedItems.value[0]
  const pts = seriesForItem(item)
  const vals = pts.map((p) => p.value).filter((v) => Number.isFinite(v))
  const precision = Number.isInteger(item.point.precision) ? item.point.precision : 2
  const fmt = (n) => (Number.isFinite(n) ? Number(n).toFixed(precision) : '—')
  const latest = vals.length ? vals.at(-1) : null
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  const min = vals.length ? Math.min(...vals) : null
  const max = vals.length ? Math.max(...vals) : null
  return {
    latest: fmt(latest),
    avg: fmt(avg),
    min: fmt(min),
    max: fmt(max),
    unit: item.point.unit ? ` ${item.point.unit}` : '',
    normalRangeText: formatNormalRangeText(item.point.normalMin, item.point.normalMax, item.point.unit, item.point.pointKind)
  }
})

function renderChart() {
  if (!chartRef.value || selectedItems.value.length === 0) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }
  const datasets = selectedItems.value.map((item, idx) => ({
    item,
    color: SERIES_COLORS[idx % SERIES_COLORS.length],
    data: seriesForItem(item)
  }))

  const baseTimes = datasets[0]?.data.map((d) => d.time) || []
  const units = []
  for (const ds of datasets) {
    const u = ds.item.point.unit || ''
    if (!units.includes(u)) units.push(u)
  }

  const yAxis = units.map((u, idx) => ({
    type: 'value',
    name: u,
    scale: true,
    show: idx < 2,
    position: idx === 1 ? 'right' : 'left',
    nameTextStyle: { color: '#6b768a', fontSize: 11 },
    axisLabel: { color: '#8490a4', fontSize: 11 },
    splitLine: { show: idx === 0, lineStyle: { color: '#eaeff6', type: 'dashed' } }
  }))

  const isSingle = datasets.length === 1
  const singlePt = isSingle ? datasets[0].item.point : null
  const hasMin = singlePt && singlePt.normalMin !== null && singlePt.normalMin !== undefined
  const hasMax = singlePt && singlePt.normalMax !== null && singlePt.normalMax !== undefined

  const markLineData = []
  if (hasMin) {
    markLineData.push({
      yAxis: Number(singlePt.normalMin),
      name: '正常下限',
      lineStyle: { color: '#16A34A', type: 'dashed', width: 1.5 },
      label: { formatter: `下限 ${singlePt.normalMin}${singlePt.unit || ''}`, color: '#15803D', fontSize: 11 }
    })
  }
  if (hasMax) {
    markLineData.push({
      yAxis: Number(singlePt.normalMax),
      name: '正常上限',
      lineStyle: { color: '#EA580C', type: 'dashed', width: 1.5 },
      label: { formatter: `上限 ${singlePt.normalMax}${singlePt.unit || ''}`, color: '#C2410C', fontSize: 11 }
    })
  }

  const series = datasets.map((ds) => {
    const yAxisIndex = Math.min(units.indexOf(ds.item.point.unit || ''), yAxis.length - 1)
    return {
      name: `${ds.item.deviceName} · ${ds.item.point.instanceName}`,
      type: 'line',
      yAxisIndex: Math.max(0, yAxisIndex),
      showSymbol: false,
      smooth: 0.18,
      lineStyle: { width: 2, color: ds.color },
      itemStyle: { color: ds.color },
      areaStyle: isSingle
        ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(146, 116, 67, 0.16)' },
              { offset: 1, color: 'rgba(146, 116, 67, 0.01)' }
            ])
          }
        : undefined,
      data: ds.data.map((d) => d.value),
      ...(isSingle && markLineData.length
        ? { markLine: { silent: true, symbol: ['none', 'none'], data: markLineData } }
        : {}),
      ...(isSingle && hasMin && hasMax
        ? {
            markArea: {
              silent: true,
              itemStyle: { color: 'rgba(22, 163, 74, 0.06)' },
              data: [[{ yAxis: Number(singlePt.normalMin) }, { yAxis: Number(singlePt.normalMax) }]]
            }
          }
        : {})
    }
  })

  chartInstance.setOption(
    {
      animationDuration: 280,
      grid: { left: 48, right: units.length > 1 ? 52 : 24, top: 34, bottom: 50, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 29, 47, 0.94)',
        borderWidth: 0,
        textStyle: { color: '#f4f7fc', fontSize: 12 }
      },
      legend: {
        show: !isSingle,
        top: 2,
        textStyle: { color: '#4f5c72', fontSize: 11.5 }
      },
      xAxis: {
        type: 'category',
        data: baseTimes,
        axisLine: { lineStyle: { color: '#dfe5ef' } },
        axisLabel: { color: '#8490a4', fontSize: 11 }
      },
      yAxis: yAxis.length ? yAxis : [{ type: 'value' }],
      dataZoom: [
        { type: 'inside', xAxisIndex: 0 },
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 10,
          height: 16,
          borderColor: '#e4e8f0',
          backgroundColor: '#f7f9fc',
          fillerColor: 'rgba(146, 116, 67, 0.14)',
          showDetail: false
        }
      ],
      series
    },
    true
  )
  chartInstance.resize()
}

watch(
  [selectedItems, selectedHours, customRangeActive, customStart, customEnd, () => sensorStore.localData?.sampledAt],
  async () => {
    await nextTick()
    if (selectedItems.value.length > 0) renderChart()
  },
  { deep: true }
)

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(() => chartInstance?.resize())
    resizeObserver.observe(chartRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style scoped>
.pq-view {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: #f7f7f4;
}

.pq-sidebar {
  width: 274px;
  flex: 0 0 274px;
  background: #ffffff;
  border-right: 1px solid var(--ui-line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pq-side-head {
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--ui-line);
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.pq-side-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.pq-accent-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--ui-accent);
}

.pq-side-title strong {
  font-size: 13px;
  color: var(--ui-ink);
}

.pq-side-title small {
  margin-left: auto;
  font-size: 11px;
  color: var(--ui-muted);
}

.pq-search {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  background: #f7f7f4;
  color: var(--ui-muted);
}

.pq-search:focus-within {
  border-color: var(--ui-accent-line);
  background: #ffffff;
}

.pq-search svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.pq-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--ui-ink);
}

.pq-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 6px 16px;
}

.pq-device-group + .pq-device-group {
  margin-top: 8px;
}

.pq-device-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: #f7f7f4;
  color: var(--ui-ink);
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.pq-device-head:hover {
  background: #f1f2ed;
}

.pq-caret {
  width: 13px;
  height: 13px;
  stroke: var(--ui-muted);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.14s ease;
}

.pq-caret.open {
  transform: rotate(90deg);
}

.pq-device-name {
  font-size: 12.5px;
  font-weight: 700;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pq-device-count {
  font-size: 11px;
  color: var(--ui-muted);
  flex: none;
}

.pq-point-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0 0 8px;
}

.pq-point-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5.5px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s;
}

.pq-point-row:hover {
  background: #f6f4ee;
}

.pq-point-row.selected {
  background: var(--ui-warm);
}

.pq-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}

.pq-check {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--ui-border);
  border-radius: 3px;
  flex: none;
  position: relative;
}

.pq-check.on {
  border-color: var(--ui-accent);
  background: var(--ui-accent);
}

.pq-check.on::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 1px;
  width: 4px;
  height: 7px;
  border: solid #ffffff;
  border-width: 0 1.8px 1.8px 0;
  transform: rotate(42deg);
}

.pq-point-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ui-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pq-point-row.selected .pq-point-name {
  color: var(--ui-accent);
  font-weight: 600;
}

.pq-point-code {
  font-family: Consolas, monospace;
  font-size: 10.5px;
  color: var(--ui-muted);
  flex: none;
}

.pq-empty-tree {
  text-align: center;
  padding: 28px 12px;
  font-size: 12px;
  color: var(--ui-muted);
}

/* Right canvas */
.pq-canvas {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px;
  gap: 10px;
  overflow: hidden;
}

.pq-toolbar {
  background: #ffffff;
  border: 1px solid var(--ui-line);
  border-radius: var(--ui-radius);
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.pq-time-group {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.pq-time-btn,
.pq-compare-btn,
.pq-pop-cancel,
.pq-pop-apply {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: #ffffff;
  box-shadow: var(--ui-control-shadow);
  color: var(--ui-ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pq-time-btn:hover,
.pq-compare-btn:hover,
.pq-pop-cancel:hover {
  border-color: var(--ui-accent-line);
  color: var(--ui-accent);
}

.pq-time-btn.active,
.pq-compare-btn.active {
  border-color: var(--ui-accent-line);
  background: var(--ui-warm);
  color: var(--ui-accent);
  font-weight: 600;
}

.pq-control-icon { width: 14px; height: 14px; flex: none; }

.pq-custom-wrap {
  position: relative;
}

.pq-custom-pop {
  position: absolute;
  top: 34px;
  left: 0;
  z-index: 50;
  width: 248px;
  padding: 12px;
  border-radius: var(--ui-radius);
  background: #ffffff;
  border: 1px solid var(--ui-border);
  box-shadow: 0 10px 28px rgba(15, 23, 38, 0.16);
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.pq-custom-pop label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: #636960;
}

.pq-custom-pop input {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ui-border);
  border-radius: 5px;
  font: inherit;
  font-size: 12px;
}

.pq-custom-err {
  margin: 0;
  font-size: 11px;
  color: #cf3731;
}

.pq-custom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.pq-pop-apply {
  border-color: #373932;
  background: linear-gradient(#44463e, #31332c);
  color: #ffffff;
}

.pq-compare-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pq-clear-btn {
  border: 0;
  background: transparent;
  color: var(--ui-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pq-clear-btn:hover { color: var(--ui-ink); }

.pq-selected-strip {
  background: #ffffff;
  border: 1px solid var(--ui-line);
  border-radius: var(--ui-radius);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pq-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pq-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f1f2ed;
  border: 1px solid var(--ui-line);
  font-size: 12px;
  color: var(--ui-ink);
}

.pq-chip i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.pq-chip small {
  font-family: Consolas, monospace;
  color: var(--ui-muted);
  font-size: 11px;
}

.pq-chip button {
  display: inline-grid;
  place-items: center;
  height: 22px;
  width: 22px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.pq-chip button:hover {
  color: var(--ui-ink);
  background: var(--ui-line);
}

.pq-kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.pq-kpi-strip > div {
  padding: 7px 10px;
  border-radius: var(--ui-radius);
  background: #f7f7f4;
  border: 1px solid var(--ui-line);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pq-kpi-strip span {
  font-size: 11px;
  color: var(--ui-muted);
}

.pq-kpi-strip strong {
  font-size: 14px;
  font-weight: 700;
  font-family: Consolas, monospace;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.pq-kpi-strip strong small {
  font-weight: 400;
  font-size: 11px;
  color: var(--ui-muted);
}

.pq-kpi-strip strong.range-val {
  font-size: 12.5px;
  color: #15803d;
}

.pq-chart-stage {
  flex: 1;
  min-height: 280px;
  background: #ffffff;
  border: 1px solid var(--ui-line);
  border-radius: var(--ui-radius);
  position: relative;
  overflow: hidden;
  display: flex;
}

.pq-empty-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--ui-muted);
  text-align: center;
}

.pq-empty-icon {
  width: 56px;
  height: 56px;
  opacity: 0.85;
}

.pq-empty-stage p {
  margin: 0;
  font-size: 13.5px;
  color: #636960;
  font-weight: 500;
}

.pq-empty-stage span {
  font-size: 12px;
  color: var(--ui-muted);
}

.pq-echarts {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 280px;
}

@media (max-width: 1100px) {
  .pq-sidebar { width: 205px; flex-basis: 205px; }
}
@media (max-width: 740px) {
  .pq-view { flex-direction: column; overflow: auto; }
  .pq-sidebar { flex: none; width: 100%; max-height: 210px; border-right: 0; border-bottom: 1px solid var(--ui-line); }
  .pq-canvas { flex: none; overflow: visible; }
  .pq-chart-stage { flex: none; height: clamp(300px, 54vh, 450px); }
  .pq-kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pq-time-group { position: relative; }
  .pq-custom-wrap { position: static; }
  .pq-custom-pop { top: calc(100% + 4px); max-width: 100%; }
  .pq-toolbar { flex-wrap: wrap; }
}
</style>
