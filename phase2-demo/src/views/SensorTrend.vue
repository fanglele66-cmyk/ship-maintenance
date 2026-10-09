<template>
  <div class="sensor-trend">
    <!-- Left: Sensor list -->
    <div class="st-sidebar">
      <div class="st-group-scroll">
        <section v-for="group in groupedSensors" :key="group.key" class="st-group">
          <button
            type="button"
            class="st-group-head"
            :aria-expanded="isGroupExpanded(group.key)"
            @click="toggleGroup(group.key)"
          >
            <span class="st-group-icon" aria-hidden="true">
              <img
                v-if="isGroupExpanded(group.key)"
                class="st-group-icon-down"
                src="/detail-assets/chevron-down.svg"
                alt=""
              />
              <img
                v-else
                class="st-group-icon-right"
                src="/detail-assets/chevron-right.svg"
                alt=""
              />
            </span>
            <span class="st-group-name">{{ group.label }}</span>
            <span class="st-group-count">{{ group.sensors.length }}</span>
          </button>

          <div v-show="isGroupExpanded(group.key)" class="st-group-list">
            <button
              v-for="sensor in group.sensors"
              :key="sensor.id"
              type="button"
              class="st-list-item"
              :class="{
                selected: !multiTrend && sensorStore.selectedSensorId === sensor.id,
                checked: multiTrend && multiSelectedList.includes(sensor.id)
              }"
              @click="handleSensorClick(sensor)"
          >
              <span class="stl-body">
                <span class="stl-name">{{ sensor.nameEn }}</span>
                <span class="stl-cn">{{ sensor.nameCn }}</span>
                <span class="stl-value">{{ sensor.value }}{{ sensor.unit }}</span>
              </span>
              <span v-if="multiTrend" class="stl-checkbox" aria-hidden="true">
                <span class="stl-checkmark" :class="{ on: multiSelectedList.includes(sensor.id) }"></span>
              </span>
            </button>
          </div>
        </section>

        <div v-if="groupedSensors.length === 0" class="st-search-empty">
          未找到匹配的传感器
        </div>
      </div>
    </div>

    <!-- Right: Trend chart -->
    <div class="st-chart-area">
      <!-- Controls bar -->
      <div class="st-controls">
        <div class="st-controls-left">
          <label class="multi-toggle" title="多趋势对比">
            <input type="checkbox" v-model="multiTrend" @change="onMultiTrendChange" />
            <span class="multi-toggle-slider"></span>
            <span class="multi-toggle-label">多趋势对比</span>
          </label>
        </div>

        <div class="st-controls-right">
          <div class="st-toggle-group">
            <button
              v-for="h in timeRanges"
              :key="h"
              class="st-time-btn"
              :class="{ active: isCustomRange ? false : sensorStore.trendHours === h }"
              @click="applyPreset(h)"
            >
              {{ h === 1 ? '1H' : h === 6 ? '6H' : h === 24 ? '24H' : h === 168 ? '7D' : '自定义' }}
            </button>
          </div>

          <!-- 自定义按钮 + 下拉面板 -->
          <div class="st-custom-wrap" ref="customWrapRef">
            <button
              class="st-time-btn st-custom-btn"
              :class="{ active: isCustomRange }"
              @click="showCustomPanel = !showCustomPanel"
              title="自定义时间范围"
            >
              📅 自定义
            </button>
            <div v-if="showCustomPanel" class="st-custom-panel">
              <div class="st-custom-panel-inner">
                <div class="st-custom-field">
                  <label>开始时间</label>
                  <input type="datetime-local" v-model="customStart" class="st-datetime-input" />
                </div>
                <div class="st-custom-field">
                  <label>结束时间</label>
                  <input type="datetime-local" v-model="customEnd" class="st-datetime-input" />
                </div>
                <div class="st-custom-actions">
                  <button class="st-custom-apply" @click="applyCustomRange">应用</button>
                  <button class="st-custom-cancel" @click="showCustomPanel = false">取消</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="st-chart-shell" @click.capture="handleChartSurfaceClick">
        <div class="st-chart" ref="chartRef"></div>

        <Transition name="st-selected-expand" mode="out-in">
          <aside
            v-if="selectedPoint"
            :key="selectedPoint.index"
            class="st-selected-card"
            :style="selectedCardStyle"
            aria-live="polite"
            aria-label="已选趋势数据"
            @click.stop
          >
            <div class="st-selected-head">
              <div class="st-selected-time">
                <time>{{ selectedPoint.time }}</time>
              </div>
              <button
                class="st-selected-close"
                type="button"
                aria-label="关闭选中详情"
                title="关闭"
                @click.stop="clearSelectedPoint"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div class="st-selected-values">
              <div v-for="row in selectedPoint.rows" :key="row.id" class="st-selected-row">
                <span class="st-selected-name">
                  <i :style="{ backgroundColor: row.color }" aria-hidden="true"></i>
                  {{ row.name }}
                </span>
                <strong>{{ row.value }}{{ row.unit }}</strong>
              </div>
            </div>
            <button class="st-selected-report" type="button" @click.stop="openQuickReport">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <span>快速上报</span>
            </button>
          </aside>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed, reactive } from 'vue'
import * as echarts from 'echarts'
import { useSensorStore } from '@/stores/sensorStore'
import { generateTrendData } from '@/mock/sensors'

const emit = defineEmits(['back', 'quick-report'])
const props = defineProps({
  searchQuery: { type: String, default: '' }
})

const sensorStore = useSensorStore()
const chartRef = ref(null)
const customWrapRef = ref(null)
let chartInstance = null
let renderVersion = 0
let activeTipIndex = null
const selectedPoint = ref(null)
const selectedAnchor = ref(null)
const hoveredIndex = ref(null)
const chartSize = reactive({ width: 0, height: 0 })
let hoverPointerType = 'dashed'

const timeRanges = [1, 6, 24, 168]

const selectedCardStyle = computed(() => {
  const chartRect = chartRef.value?.getBoundingClientRect?.()
  const width = chartSize.width || chartRect?.width || 0
  const height = chartSize.height || chartRect?.height || 0
  const anchor = selectedAnchor.value
  if (!width || !height || !anchor) return {}

  const edgeGap = 12
  const cardGap = 10
  const cardWidth = Math.min(220, Math.max(168, width - edgeGap * 2))
  const estimatedHeight = Math.min(
    82 + (selectedPoint.value?.rows.length || 1) * 22,
    Math.max(120, height - edgeGap * 2)
  )

  const left = Math.min(
    Math.max(anchor.x - cardWidth / 2, edgeGap),
    Math.max(edgeGap, width - cardWidth - edgeGap)
  )

  let top = anchor.y + cardGap
  let originY = '0px'
  if (top + estimatedHeight > height - edgeGap) {
    top = anchor.y - estimatedHeight - cardGap
    originY = '100%'
  }
  top = Math.max(edgeGap, top)

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${cardWidth}px`,
    maxHeight: `${Math.max(120, height - top - edgeGap)}px`,
    transformOrigin: `${Math.min(Math.max(anchor.x - left, 18), cardWidth - 18)}px ${originY}`
  }
})

// ===== 多趋势（用 plain array 而非 Set，保证 Vue 响应式） =====
const multiTrend = ref(false)
const multiSelectedList = ref([])
const collapsedGroups = reactive({})

// ===== 自定义时间段 =====
const isCustomRange = ref(false)
const showCustomPanel = ref(false)
const customStart = ref('')
const customEnd = ref('')

function generateTrendForSensor(sensor, hours) {
  const data = generateTrendData(sensor.value, sensor.value * 0.1, hours, sensor.id)
  if (!data.length) return data
  return data.map((item, index) => index === data.length - 1
    ? { ...item, value: Number(sensor.value) }
    : item
  )
}

function getTrendDataForHours(hours) {
  const s = sensorStore.selectedSensor
  if (!s) return []
  return generateTrendForSensor(s, hours)
}

const scopedSensors = computed(() => {
  let sensors = sensorStore.allSensors
  if (sensorStore.currentDeviceId) {
    sensors = sensors.filter(sensor => sensor.deviceId === sensorStore.currentDeviceId)
  } else if (sensorStore.currentSystem !== '全部') {
    sensors = sensors.filter(sensor => sensor.system === sensorStore.currentSystem)
  }
  return sensors
})

function sensorGroupKey(sensor) {
  return sensorStore.currentDeviceId
    ? (sensor.subsystem || '其他')
    : (sensor.system || '其他')
}

const filteredSensors = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()
  if (!query) return scopedSensors.value
  return scopedSensors.value.filter(sensor => [
    sensor.nameEn,
    sensor.nameCn,
    sensor.subsystem,
    sensor.system,
    sensor.unit
  ].some(value => String(value || '').toLowerCase().includes(query)))
})

const groupedSensors = computed(() => {
  const groups = new Map()
  filteredSensors.value.forEach(sensor => {
    const key = sensorGroupKey(sensor)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(sensor)
  })

  const statusOrder = { over: 0, warning: 1, normal: 2 }
  const preferredOrder = sensorStore.currentDeviceId
    ? sensorStore.currentSubsystemTags.filter(tag => tag !== '全部')
    : [...new Set(scopedSensors.value.map(sensor => sensor.system || '其他'))]
  const order = new Map(preferredOrder.map((key, index) => [key, index]))

  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    .map(([key, sensors]) => ({
      key,
      label: key,
      sensors: [...sensors].sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
    }))
})

function isGroupExpanded(key) {
  return props.searchQuery.trim() ? true : collapsedGroups[key] !== true
}

function toggleGroup(key) {
  if (props.searchQuery.trim()) return
  collapsedGroups[key] = !collapsedGroups[key]
}

function syncGroupExpansion() {
  const activeGroup = sensorStore.selectedSensor ? sensorGroupKey(sensorStore.selectedSensor) : ''
  groupedSensors.value.forEach(group => {
    if (!(group.key in collapsedGroups)) collapsedGroups[group.key] = group.key !== activeGroup
  })
  if (activeGroup) collapsedGroups[activeGroup] = false
}

const multiSelectedSensors = computed(() => {
  const sensorsById = new Map(scopedSensors.value.map(sensor => [sensor.id, sensor]))
  return multiSelectedList.value.map(id => sensorsById.get(id)).filter(Boolean)
})

const seriesColors = [
  '#1677FF', '#52C41A', '#FA8C16', '#F5222D', '#722ED1',
  '#13C2C2', '#EB2F96', '#FAAD14', '#2F54EB', '#A0D911',
  '#FA541C', '#597EF7'
]

function handleSensorClick(sensor) {
  if (multiTrend.value) {
    toggleMultiSelect(sensor.id)
    // 同步渲染：toggleMultiSelect 已直接 push/splice 到数组，数据已就绪
    renderChart()
  } else {
    sensorStore.selectSensor(sensor.id)
  }
}

function toggleMultiSelect(id) {
  const idx = multiSelectedList.value.indexOf(id)
  if (idx >= 0) {
    multiSelectedList.value.splice(idx, 1)
  } else {
    multiSelectedList.value.push(id)
  }
}

function onMultiTrendChange() {
  if (multiTrend.value) {
    // 开启多趋势时，当前正在查看的传感器必须同步出现在左侧选中态，
    // 避免图表已经有曲线、左侧却没有对应勾选项的状态。
    const currentId = sensorStore.selectedSensorId
    const currentIsVisible = currentId && scopedSensors.value.some(sensor => sensor.id === currentId)
    multiSelectedList.value = currentIsVisible ? [currentId] : []
  } else {
    multiSelectedList.value = []
    clearSelectedPoint()
  }
  renderChart()
}

function applyPreset(hours) {
  isCustomRange.value = false
  showCustomPanel.value = false
  sensorStore.setTrendHours(hours)
}

function applyCustomRange() {
  if (customStart.value && customEnd.value) {
    isCustomRange.value = true
    showCustomPanel.value = false
    renderChart()
  }
}

function getCustomHours() {
  if (!isCustomRange.value || !customStart.value || !customEnd.value) return null
  const start = new Date(customStart.value).getTime()
  const end = new Date(customEnd.value).getTime()
  if (isNaN(start) || isNaN(end) || end <= start) return null
  return Math.ceil((end - start) / 3600000)
}

function getCustomTrendData(sensor) {
  const hours = getCustomHours()
  if (!hours) return []
  const startTime = new Date(customStart.value).getTime()
  const endTime = new Date(customEnd.value).getTime()
  const count = Math.min(hours, 168)
  const interval = (endTime - startTime) / count
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(startTime + i * interval).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: sensor.value + Math.sin(i / 4) * sensor.value * 0.1 + Math.random() * sensor.value * 0.03
  }))
}

function buildOption() {
  if (multiTrend.value && multiSelectedSensors.value.length > 0) {
    return buildMultiOption()
  }
  if (!sensorStore.selectedSensor) return null
  return buildSingleOption()
}

function formatReportDateTime(timestamp) {
  const date = new Date(timestamp)
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function getSelectedPointTimeRange() {
  const option = chartInstance?.getOption()
  const count = option?.xAxis?.[0]?.data?.length || 0
  const index = Math.min(Math.max(activeTipIndex ?? count - 1, 0), Math.max(count - 1, 0))
  const now = Date.now()
  let rangeStart
  let rangeEnd
  let interval

  if (isCustomRange.value && customStart.value && customEnd.value) {
    rangeStart = new Date(customStart.value).getTime()
    rangeEnd = new Date(customEnd.value).getTime()
    interval = count > 1 ? (rangeEnd - rangeStart) / (count - 1) : rangeEnd - rangeStart
  } else {
    interval = 3600000
    rangeEnd = now
    rangeStart = rangeEnd - Math.max(count - 1, 0) * interval
  }

  const pointTime = rangeStart + index * interval
  const segment = Math.max(interval || 3600000, 60000)
  return [formatReportDateTime(pointTime - segment), formatReportDateTime(pointTime)]
}

function openQuickReport() {
  const sensor = sensorStore.selectedSensor
  if (!sensor) return
  const reportSensors = multiTrend.value && multiSelectedSensors.value.length
    ? multiSelectedSensors.value
    : [sensor]
  emit('quick-report', {
    deviceId: sensor.deviceId,
    systems: [...new Set(reportSensors.map(item => item.subsystem || item.system).filter(Boolean))],
    sensorIds: reportSensors.map(item => item.id),
    timeRange: getSelectedPointTimeRange()
  })
}

function formatHoverTimeTooltip(params) {
  const rows = Array.isArray(params) ? params : [params]
  const visibleRows = rows.filter(Boolean)
  if (!visibleRows.length) return ''
  // 大卡锁定后，当前选中点由大卡展示；移动到其他时间点时仍保留
  // 鼠标附近的小时间卡，方便继续比较并点击切换选中时间。
  const first = visibleRows[0]
  const rawHoverIndex = first.dataIndex ?? first.dataIndexInside
  const hoverIndex = Number.isInteger(Number(rawHoverIndex))
    ? Number(rawHoverIndex)
    : hoveredIndex.value
  if (selectedPoint.value && Number.isInteger(hoverIndex) && hoverIndex === selectedPoint.value.index) {
    return ''
  }
  const time = visibleRows[0].axisValueLabel || visibleRows[0].name || ''
  return `<div class="st-hover-time">${time}</div>`
}

function positionHoverTimeTooltip(point, _params, _dom, _rect, size) {
  const [pointerX, pointerY] = point
  const [viewWidth, viewHeight] = size.viewSize
  const [tooltipWidth, tooltipHeight] = size.contentSize
  const edgeGap = 8
  const pointerGap = 10
  const clampLeft = value => Math.min(
    Math.max(value, edgeGap),
    Math.max(edgeGap, viewWidth - tooltipWidth - edgeGap)
  )
  // 将时间提示优先放到指针上方，避免横向移动时手指/鼠标遮挡；
  // 顶部空间不足时改放到指针左侧，最后才回退到下方。
  const aboveTop = pointerY - tooltipHeight - pointerGap
  if (aboveTop >= edgeGap) {
    return [clampLeft(pointerX - tooltipWidth / 2), aboveTop]
  }
  const left = pointerX - tooltipWidth - pointerGap
  if (left >= edgeGap) {
    return [left, Math.min(Math.max(pointerY - tooltipHeight / 2, edgeGap), viewHeight - tooltipHeight - edgeGap)]
  }
  return [clampLeft(pointerX - tooltipWidth / 2), Math.min(pointerY + pointerGap, viewHeight - tooltipHeight - edgeGap)]
}

function resolveHoverIndex(event) {
  const axisInfo = event?.axesInfo?.[0]
  const seriesInfo = axisInfo?.seriesDataIndices?.[0]
  const directValue = event?.dataIndex ?? event?.dataIndexInside ?? seriesInfo?.dataIndex
  const directIndex = Array.isArray(directValue) ? directValue[0] : directValue
  if (directIndex !== undefined && directIndex !== null && Number.isInteger(Number(directIndex))) {
    return Number(directIndex)
  }

  const axisValue = axisInfo?.value ?? event?.value
  if (axisValue === undefined || axisValue === null || !chartInstance) return null
  const xData = chartInstance.getOption()?.xAxis?.[0]?.data || []
  const byValue = xData.findIndex(value => String(value) === String(axisValue))
  if (byValue >= 0) return byValue
  const numericValue = Number(axisValue)
  return Number.isInteger(numericValue) ? numericValue : null
}

function setHoverPointerType(type) {
  if (!chartInstance || hoverPointerType === type) return
  hoverPointerType = type
  chartInstance.setOption({
    tooltip: {
      axisPointer: {
        lineStyle: { color: '#106BFF', width: 1, type }
      }
    }
  })
}

function rememberHoveredIndex(index) {
  const option = chartInstance?.getOption?.()
  const count = option?.xAxis?.[0]?.data?.length || 0
  if (!Number.isInteger(index) || index < 0 || index >= count) return
  hoveredIndex.value = index
  setHoverPointerType(selectedPoint.value?.index === index ? 'solid' : 'dashed')
}

function bindChartHoverTracking() {
  if (!chartInstance) return
  chartInstance.on('showTip', event => {
    rememberHoveredIndex(resolveHoverIndex(event))
  })
  chartInstance.on('updateAxisPointer', event => {
    rememberHoveredIndex(resolveHoverIndex(event))
  })
  chartInstance.on('datazoom', () => {
    // 缩放/拖动后原来的悬停索引可能已经不对应当前可视区，
    // 下一次点击应重新按当前位置计算，避免选中点跳动。
    hoveredIndex.value = null
    setHoverPointerType('dashed')
  })
}

function normalizeAxisUnit(unit) {
  const value = String(unit || '').trim()
  if (!value) return { key: '__unitless__', label: '' }
  if (/^(°c|℃)$/i.test(value)) return { key: '°C', label: '°C' }
  if (/^mpa$/i.test(value)) return { key: 'MPa', label: 'MPa' }
  return { key: value, label: value }
}

function buildMultiYAxis(seriesData) {
  const unitGroups = []

  seriesData.forEach(item => {
    const unit = normalizeAxisUnit(item.sensor.unit)
    if (!unitGroups.some(group => group.key === unit.key)) {
      unitGroups.push({ ...unit, color: item.color })
    }
  })

  return unitGroups.map((unit, index) => {
    const visible = index < 2
    const position = index === 1 ? 'right' : 'left'

    return {
      type: 'value',
      show: visible,
      position,
      scale: true,
      name: visible ? unit.label : '',
      nameLocation: 'end',
      nameGap: 12,
      nameTextStyle: {
        color: unit.color,
        fontSize: 12,
        align: position === 'right' ? 'left' : 'right'
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: visible, color: '#8B919A', fontSize: 12 },
      splitLine: {
        show: index === 0,
        lineStyle: { color: '#DDE5F0', type: 'dashed' }
      }
    }
  })
}

function formatSelectedValue(rawValue) {
  const value = typeof rawValue === 'object' && rawValue !== null
    ? rawValue.value
    : rawValue
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return value
  return Number(numericValue.toFixed(Math.abs(numericValue) >= 100 ? 0 : 2))
}

function buildSelectedPoint(index) {
  if (!chartInstance) return null
  const option = chartInstance.getOption()
  const time = option?.xAxis?.[0]?.data?.[index]
  if (time === undefined) return null

  const sensors = multiTrend.value && multiSelectedSensors.value.length
    ? multiSelectedSensors.value
    : [sensorStore.selectedSensor].filter(Boolean)

  const rows = sensors.map((sensor, seriesIndex) => ({
    id: sensor.id,
    name: sensor.nameCn,
    unit: sensor.unit || '',
    value: formatSelectedValue(option?.series?.[seriesIndex]?.data?.[index]),
    color: multiTrend.value ? seriesColors[seriesIndex % seriesColors.length] : '#106BFF'
  }))

  return { index, time, rows }
}

function applySelectedMarker(point) {
  if (!chartInstance || !point) return
  hoverPointerType = hoveredIndex.value === point.index ? 'solid' : 'dashed'
  chartInstance.setOption({
    // 锁定详情卡后仍保留 tooltip，让鼠标移动到其他时间时继续看到
    // 时间预览；只有选中的那条位置额外叠加一条实线。
    tooltip: {
      show: true,
      // 锁定详情卡时只隐藏当前选中点的小卡；移动到其他位置仍显示
      // 时间预览，点击后会把大卡和实线一起切换到新的时间点。
      showContent: true,
      axisPointer: {
        lineStyle: {
          color: '#106BFF',
          width: 1,
          type: hoverPointerType
        }
      }
    },
    series: [{
      markLine: {
        silent: true,
        animation: false,
        symbol: ['none', 'none'],
        label: { show: false },
        lineStyle: { color: '#106BFF', width: 2, type: 'solid' },
        // 时间标签按小时显示，7D 等范围会出现重复的 "08:01/20:01"。
        // 使用数据索引定位，避免 markLine 按重复字符串匹配到后面的点。
        data: [{ xAxis: point.index }]
      }
    }]
  })
}

function clearSelectedPoint() {
  selectedPoint.value = null
  selectedAnchor.value = null
  activeTipIndex = null
  setHoverPointerType('dashed')
  if (!chartInstance) return
  chartInstance.setOption({
    tooltip: { show: true, showContent: true },
    series: [{ markLine: { data: [] } }]
  })
}

function selectPointAtIndex(index, anchor) {
  if (selectedPoint.value?.index === index) {
    clearSelectedPoint()
    return
  }
  const point = buildSelectedPoint(index)
  if (!point) return
  activeTipIndex = index
  selectedAnchor.value = { x: anchor[0], y: anchor[1] }
  selectedPoint.value = point
  applySelectedMarker(point)
  chartInstance?.dispatchAction({ type: 'hideTip' })
}

function handleDocumentSelectionClear(event) {
  if (!selectedPoint.value) return
  if (event.target?.closest?.('.st-selected-card')) return
  if (chartRef.value?.contains(event.target)) return
  clearSelectedPoint()
}

function handleChartSurfaceClick(event) {
  if (!chartInstance || !chartRef.value) return
  if (event.target?.closest?.('.st-selected-card')) return
  if (event.target === event.currentTarget) {
    clearSelectedPoint()
    return
  }
  const rect = chartRef.value.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const clickPoint = [x, Math.min(Math.max(event.clientY - rect.top, 0), rect.height)]
  // 底部 dataZoom 缩略条用于拖动时间范围，不把它误判为时间点点击。
  const hasVisibleDataZoom = (chartInstance.getOption()?.dataZoom || [])
    .some(item => item.type === 'slider' && item.show !== false)
  if (hasVisibleDataZoom && event.clientY - rect.top > rect.height - 28) return
  const axisPoint = [x, rect.height / 2]
  const option = chartInstance.getOption()
  const count = option?.xAxis?.[0]?.data?.length || 0
  if (!count) return
  const axisValue = chartInstance.convertFromPixel({ xAxisIndex: 0 }, axisPoint)
  const rawIndex = Array.isArray(axisValue) ? axisValue[0] : axisValue
  const fallbackIndex = (x / Math.max(rect.width, 1)) * Math.max(count - 1, 0)
  const convertedIndex = Number.isFinite(Number(rawIndex)) ? Number(rawIndex) : fallbackIndex
  // ECharts 的 axis pointer 已经吸附到了最近的数据点时，直接复用它的
  // dataIndex，避免通过像素再次换算造成点击后向后跳一格。
  const indexFromHover = Number.isInteger(hoveredIndex.value) ? hoveredIndex.value : convertedIndex
  const index = Math.min(
    Math.max(Math.round(indexFromHover), 0),
    Math.max(count - 1, 0)
  )
  selectPointAtIndex(index, clickPoint)
}

function buildSingleOption() {
  const sensor = sensorStore.selectedSensor
  const data = isCustomRange.value ? getCustomTrendData(sensor) : getTrendDataForHours(sensorStore.trendHours)
  if (!data || !data.length) return null

  return {
    backgroundColor: 'transparent',
    grid: { left: 18, right: 24, top: 50, bottom: 42, containLabel: true },
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove',
      alwaysShowContent: false,
      enterable: false,
      confine: true,
      transitionDuration: 0,
      position: positionHoverTimeTooltip,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      extraCssText: 'border-radius:0;box-shadow:none;pointer-events:none;',
      textStyle: { color: '#FFFFFF', fontSize: 13 },
      axisPointer: {
        type: 'line',
        snap: true,
        lineStyle: { color: '#106BFF', width: 1, type: 'dashed' }
      },
      formatter: formatHoverTimeTooltip
    },
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#E5E6EB' } },
      axisLabel: { color: '#8B919A', fontSize: 12 },
      splitLine: { show: false }
    },
    // 触控端支持双指缩放、单指拖动查看时间段；桌面端也可使用滚轮缩放。
    dataZoom: [{
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: true,
      preventDefaultMouseMove: false
    }, {
      type: 'slider',
      show: data.length > 24,
      xAxisIndex: 0,
      bottom: 8,
      height: 14,
      showDetail: false,
      brushSelect: false,
      borderColor: '#E4E7ED',
      backgroundColor: '#F7F8FA',
      fillerColor: 'rgba(22, 119, 255, 0.14)',
      dataBackground: {
        lineStyle: { color: '#B8C5D6', width: 1 },
        areaStyle: { color: 'rgba(184, 197, 214, 0.38)' }
      },
      selectedDataBackground: {
        lineStyle: { color: '#6C9FE8', width: 1 },
        areaStyle: { color: 'rgba(22, 119, 255, 0.16)' }
      },
      handleStyle: { color: '#1677FF', borderColor: '#1677FF' },
      moveHandleStyle: { color: '#8CB8F5' }
    }],
    yAxis: {
      type: 'value',
      name: sensor.unit,
      nameLocation: 'end',
      nameGap: 12,
      nameTextStyle: { color: '#9195A2', fontSize: 12, align: 'right' },
      axisLine: { show: false },
      axisLabel: { color: '#8B919A', fontSize: 12 },
      splitLine: { lineStyle: { color: '#DDE5F0', type: 'dashed' } }
    },
    series: [{
      type: 'line',
      name: `${sensor.nameCn}(${sensor.nameEn})`,
      data: data.map(d => d.value),
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: false,
      lineStyle: { color: '#106BFF', width: 2 },
      itemStyle: { color: '#FFFFFF', borderColor: '#106BFF', borderWidth: 3 },
      emphasis: { scale: 1.15 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16,107,255,0.22)' },
          { offset: 1, color: 'rgba(16,107,255,0.025)' }
        ])
      }
    }]
  }
}

function buildMultiOption() {
  const sources = multiSelectedSensors.value
  if (!sources.length) return null

  const seriesData = sources.map((sensor, idx) => {
    const data = isCustomRange.value ? getCustomTrendData(sensor) : generateTrendForSensor(sensor, sensorStore.trendHours)
    if (!data || !data.length) return null
    return { sensor, data, color: seriesColors[idx % seriesColors.length] }
  }).filter(Boolean)

  if (!seriesData.length) return null

  const xData = seriesData[0].data.map(d => d.time)
  const yAxisKeys = []
  seriesData.forEach(item => {
    const key = normalizeAxisUnit(item.sensor.unit).key
    if (!yAxisKeys.includes(key)) yAxisKeys.push(key)
  })
  const yAxes = buildMultiYAxis(seriesData)

  return {
    backgroundColor: 'transparent',
    grid: { left: 18, right: yAxes.length > 1 ? 36 : 24, top: 58, bottom: 42, containLabel: true },
    tooltip: {
      trigger: 'axis',
      triggerOn: 'mousemove',
      alwaysShowContent: false,
      enterable: false,
      confine: true,
      transitionDuration: 0,
      position: positionHoverTimeTooltip,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      padding: 0,
      extraCssText: 'border-radius:0;box-shadow:none;pointer-events:none;',
      textStyle: { color: '#FFFFFF', fontSize: 13 },
      axisPointer: {
        type: 'line',
        snap: true,
        lineStyle: { color: '#106BFF', width: 1, type: 'dashed' }
      },
      formatter: formatHoverTimeTooltip
    },
    legend: {
      top: 0,
      left: 'center',
      textStyle: { fontSize: 12, color: '#8B919A' },
      data: seriesData.map(sd => `${sd.sensor.nameCn}(${sd.sensor.nameEn})`)
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLine: { lineStyle: { color: '#E5E6EB' } },
      axisLabel: { color: '#8B919A', fontSize: 11 },
      splitLine: { show: false }
    },
    dataZoom: [{
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: true,
      preventDefaultMouseMove: false
    }, {
      type: 'slider',
      show: xData.length > 24,
      xAxisIndex: 0,
      bottom: 8,
      height: 14,
      showDetail: false,
      brushSelect: false,
      borderColor: '#E4E7ED',
      backgroundColor: '#F7F8FA',
      fillerColor: 'rgba(22, 119, 255, 0.14)',
      dataBackground: {
        lineStyle: { color: '#B8C5D6', width: 1 },
        areaStyle: { color: 'rgba(184, 197, 214, 0.38)' }
      },
      selectedDataBackground: {
        lineStyle: { color: '#6C9FE8', width: 1 },
        areaStyle: { color: 'rgba(22, 119, 255, 0.16)' }
      },
      handleStyle: { color: '#1677FF', borderColor: '#1677FF' },
      moveHandleStyle: { color: '#8CB8F5' }
    }],
    yAxis: yAxes,
    series: seriesData.map(sd => ({
      type: 'line',
      name: `${sd.sensor.nameCn}(${sd.sensor.nameEn})`,
      data: sd.data.map(d => d.value),
      yAxisIndex: Math.max(0, yAxisKeys.indexOf(normalizeAxisUnit(sd.sensor.unit).key)),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: sd.color, width: 2 },
      itemStyle: { color: sd.color }
    }))
  }
}

function renderChart() {
  if (!chartRef.value) return
  const opt = buildOption()
  if (!opt) return
  const version = ++renderVersion
  activeTipIndex = null
  selectedPoint.value = null
  selectedAnchor.value = null
  hoveredIndex.value = null
  hoverPointerType = 'dashed'

  // 先 dispose 清空，nextTick 后再 init 避免宽高为 0
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  nextTick(() => {
    if (version !== renderVersion || !chartRef.value || !chartRef.value.clientHeight) return
    const existingInstance = echarts.getInstanceByDom(chartRef.value)
    if (existingInstance) existingInstance.dispose()
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(opt)
    bindChartHoverTracking()
  })
}

let resizeObserver = null

function updateChartSize() {
  const nextWidth = chartRef.value?.clientWidth || 0
  const nextHeight = chartRef.value?.clientHeight || 0
  const previousWidth = chartSize.width
  const previousHeight = chartSize.height

  // 详情卡的锚点使用图表内部像素坐标。窗口缩放、助手拖拽调宽或
  // iPad 横竖屏切换后，按尺寸比例同步锚点，避免卡片停在旧位置。
  if (selectedAnchor.value && previousWidth > 0 && previousHeight > 0 && nextWidth > 0 && nextHeight > 0) {
    selectedAnchor.value = {
      x: Math.min(Math.max(selectedAnchor.value.x * nextWidth / previousWidth, 0), nextWidth),
      y: Math.min(Math.max(selectedAnchor.value.y * nextHeight / previousHeight, 0), nextHeight)
    }
  }

  chartSize.width = nextWidth
  chartSize.height = nextHeight
}

onMounted(() => {
  if (filteredSensors.value.length > 0 && !sensorStore.selectedSensorId) {
    sensorStore.selectSensor(filteredSensors.value[0].id)
  }
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 3600000)
  customStart.value = yesterday.toISOString().slice(0, 16)
  customEnd.value = now.toISOString().slice(0, 16)

  nextTick(() => renderChart())

  if (chartRef.value) {
    updateChartSize()
    resizeObserver = new ResizeObserver(() => {
      updateChartSize()
      if (chartInstance) chartInstance.resize()
    })
    resizeObserver.observe(chartRef.value)
  }
  document.addEventListener('click', handleDocumentSelectionClear)
})

onUnmounted(() => {
  renderVersion++
  if (chartInstance) chartInstance.dispose()
  if (resizeObserver) resizeObserver.disconnect()
  document.removeEventListener('click', handleDocumentSelectionClear)
})

watch(() => sensorStore.selectedSensorId, () => renderChart())
watch(() => sensorStore.trendHours, () => renderChart())
watch(() => sensorStore.selectedSensor?.value, () => renderChart())
watch(
  [() => groupedSensors.value.map(group => group.key).join('|'), () => sensorStore.selectedSensorId],
  syncGroupExpansion,
  { immediate: true }
)
watch(() => sensorStore.currentDeviceId, () => {
  Object.keys(collapsedGroups).forEach(key => delete collapsedGroups[key])
  nextTick(syncGroupExpansion)
})

// 点击面板外部关闭自定义时间面板
function handleClickOutside(e) {
  if (showCustomPanel.value && customWrapRef.value && !customWrapRef.value.contains(e.target)) {
    showCustomPanel.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside, true))
onUnmounted(() => document.removeEventListener('click', handleClickOutside, true))
</script>

<style scoped>
.sensor-trend {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ===== Left sidebar ===== */
.st-sidebar {
  width: 220px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-primary);
  overflow: hidden;
}

.st-search-wrap {
  flex: none;
  padding: 10px 10px 8px;
  border-bottom: 1px solid var(--border-secondary);
  background: var(--bg-surface);
}

.st-search {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid #E1E2E5;
  border-radius: 8px;
  background: #F7F7F8;
  color: #9195A2;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.st-search:focus-within {
  border-color: #BFD4FF;
  background: #F5F9FF;
  box-shadow: 0 0 0 2px rgba(16, 107, 255, 0.08);
}
.st-search > svg {
  width: 15px;
  height: 15px;
  flex: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}
.st-search > input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
}
.st-search > input::placeholder { color: #B5B8C1; }
.st-search > input::-webkit-search-cancel-button { display: none; }
.st-search > button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #E7E9ED;
  color: #737782;
  font-size: 14px;
  line-height: 17px;
  cursor: pointer;
}

.st-group-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 6px 0 12px;
}

.st-group + .st-group { margin-top: 2px; }
.st-group-head {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: #686A70;
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.st-group-head:hover { background: #F7F7F8; color: var(--text-primary); }
.st-group-head:focus-visible { outline: 2px solid #106BFF; outline-offset: -2px; }
.st-group-icon {
  width: 16px;
  height: 16px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.45;
}
.st-group-head:hover .st-group-icon { opacity: 0.68; }
.st-group-icon > img { display: block; max-width: none; }
.st-group-icon-down { width: 9px; height: 6px; }
.st-group-icon-right { width: 6px; height: 9px; transform: rotate(180deg); }
.st-group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-group-count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #F0F1F3;
  color: #9195A2;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.st-group-list { padding: 2px 8px 6px 22px; }

.st-search-empty {
  padding: 32px 16px;
  color: #9195A2;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}

.st-list-item {
  width: 100%;
  display: flex;
  align-items: center;
  margin: 0 0 4px;
  padding: 10px 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.st-list-item:hover {
  background: #F5F9FF;
  border-color: #D7E5FF;
}
.st-list-item.selected,
.st-list-item.checked {
  background: #EDF4FF;
  border-color: #BFD4FF;
  box-shadow: 0 1px 2px rgba(16, 107, 255, 0.08);
}
.st-list-item:focus-visible { outline: 2px solid #106BFF; outline-offset: 1px; }

.stl-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10px;
  flex-shrink: 0;
  cursor: pointer;
}
.stl-checkbox input { display: none; }
.stl-checkmark {
  width: 16px; height: 16px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  display: inline-block;
  position: relative;
  transition: all 0.2s;
  background: var(--bg-surface);
}
.stl-checkmark.on {
  background: var(--accent);
  border-color: var(--accent);
}
.stl-checkmark.on::after {
  content: '';
  position: absolute;
  left: 4px; top: 1px;
  width: 4px; height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.st-list-item:hover .stl-checkmark { border-color: var(--accent); }

.stl-body { min-width: 0; flex: 1; display: flex; flex-direction: column; }

.stl-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stl-cn {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 1px;
}

.stl-value {
  font-size: var(--font-md);
  font-weight: 600;
  font-family: Consolas, monospace;
  color: var(--text-primary);
  margin-top: 4px;
}

/* ===== Right chart area ===== */
.st-chart-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container-type: inline-size;
}

.st-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  flex-shrink: 0;
  gap: 12px;
}

.st-controls-left { display: flex; align-items: center; gap: 14px; }
.st-controls-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

/* ===== 多趋势开关 ===== */
.multi-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.multi-toggle input { display: none; }
.multi-toggle-slider {
  position: relative;
  width: 36px; height: 20px;
  background: var(--border-color);
  border-radius: 10px;
  transition: background 0.25s;
}
.multi-toggle-slider::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.multi-toggle input:checked + .multi-toggle-slider { background: var(--accent); }
.multi-toggle input:checked + .multi-toggle-slider::after { transform: translateX(16px); }
.multi-toggle-label {
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ===== 时间按钮组 ===== */
.st-toggle-group { display: flex; gap: 4px; }

.st-time-btn {
  font-size: var(--font-xs);
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.st-time-btn:hover { border-color: var(--accent); color: var(--accent); }
.st-time-btn.active {
  background: #EAF3FF;
  border-color: #B7D3FF;
  color: #106BFF;
  font-weight: 600;
}

/* ===== 自定义时间按钮 + 下拉面板 ===== */
.st-custom-wrap { position: relative; }
.st-custom-btn { }

.st-custom-panel {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  z-index: 50;
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  min-width: 260px;
}
.st-custom-panel-inner { padding: 14px; }
.st-custom-field { margin-bottom: 10px; }
.st-custom-field label {
  display: block;
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-bottom: 4px;
}
.st-datetime-input {
  width: 100%;
  font-size: var(--font-sm);
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}
.st-datetime-input:focus { border-color: var(--accent); }
.st-datetime-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }

.st-custom-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}
.st-custom-apply {
  font-size: var(--font-xs);
  padding: 4px 14px;
  border-radius: 4px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.st-custom-apply:hover { background: var(--accent-hover, #4096FF); }
.st-custom-cancel {
  font-size: var(--font-xs);
  padding: 4px 14px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.st-custom-cancel:hover { border-color: var(--accent); color: var(--accent); }

/* ===== Chart ===== */
.st-chart-shell {
  position: relative;
  flex: 1;
  min-height: 200px;
  margin: 0 16px 12px;
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  box-shadow: none;
}

.st-chart {
  width: 100%;
  height: 100%;
  /* 图表任意时间点都可点击锁定详情，使用手指光标提示可交互。 */
  cursor: pointer;
}

.st-chart :deep(canvas) { cursor: pointer; }

.st-chart :deep(.st-hover-time) {
  padding: 4px 8px;
  border-radius: 4px;
  background: #19213D;
  color: rgba(247, 250, 255, 0.88);
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 6px 18px rgba(25, 33, 61, 0.18);
  pointer-events: none;
}

.st-selected-card {
  position: absolute;
  z-index: 8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(139, 203, 255, 0.26);
  border-radius: 6px;
  background: #19213D;
  color: #F7FAFF;
  box-shadow: 0 10px 28px rgba(25, 33, 61, 0.22);
  will-change: transform, opacity;
}

.st-selected-expand-enter-active {
  transition:
    opacity 0.16s ease-out,
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.st-selected-expand-leave-active {
  transition:
    opacity 0.12s ease-in,
    transform 0.14s ease-in;
}

.st-selected-expand-enter-from {
  opacity: 0;
  transform: scale(0.62);
}

.st-selected-expand-leave-to {
  opacity: 0;
  transform: scale(0.88);
}

.st-selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 7px;
  color: rgba(247, 250, 255, 0.58);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}

.st-selected-time {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.st-selected-close {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(247, 250, 255, 0.58);
  cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease;
}

.st-selected-close svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.st-selected-close:hover,
.st-selected-close:focus-visible {
  color: #F7FAFF;
  background: rgba(255, 255, 255, 0.1);
}

.st-selected-close:focus-visible {
  outline: 2px solid rgba(139, 203, 255, 0.72);
  outline-offset: 1px;
}

.st-selected-head time {
  color: rgba(247, 250, 255, 0.88);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.st-selected-values {
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 8px;
}

.st-selected-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(247, 250, 255, 0.72);
  font-size: 12px;
  line-height: 22px;
}

.st-selected-name {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-selected-name i {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
}

.st-selected-row strong {
  flex: none;
  color: #F7FAFF;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.st-selected-report {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  border: 0;
  border-top: 1px solid rgba(247, 250, 255, 0.1);
  background: transparent;
  color: #8BCBFF;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.16s ease-out, background-color 0.16s ease-out;
}

.st-selected-report svg {
  width: 14px;
  height: 14px;
  flex: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.st-selected-report:hover {
  background: rgba(139, 203, 255, 0.08);
  color: #DDF1FF;
}

.st-selected-report:focus-visible {
  outline: 2px solid rgba(139, 203, 255, 0.65);
  outline-offset: -3px;
}

@container (max-width: 900px) {
  .st-controls {
    flex-wrap: nowrap;
    justify-content: space-between;
    gap: 8px;
    padding-block: 9px;
  }

  .st-controls-left,
  .st-controls-right {
    min-width: 0;
  }

  .st-controls-left { flex: 0 0 auto; }

  .st-controls-right {
    flex: 0 1 auto;
    margin-left: auto;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 6px;
  }
}

@container (max-width: 520px) {
  .st-controls { flex-wrap: wrap; }
  .st-controls-right { flex: 1 1 100%; flex-wrap: wrap; justify-content: flex-end; }
  .st-toggle-group { flex-wrap: wrap; justify-content: flex-end; }
}
</style>
