<template>
  <div class="monitor-page">
    <!-- ====== 顶部：级联选择器 + 巡检记录 ====== -->
    <div class="top-bar">
      <el-cascader
        v-model="rangePath"
        :options="deviceStore.cascadeOptions"
        :props="{ expandTrigger: 'hover', emitPath: true }"
        placeholder="进入默认从第一个设备"
        clearable
        size="default"
        @change="onRangeChange"
        style="width: 280px"
      />
      <button class="btn-inspect" @click="showReportList = !showReportList">巡检记录</button>
    </div>

    <!-- ====== 上半部：AI 分析摘要（可滚动 / 选中传感器时收起为简版）====== -->
    <section class="ai-section" :class="{ 'ais-collapsed': selectedSensors.length > 0 && !ai.stopped }" ref="aiSectionRef">
      <div class="ais-header">
        <span class="ais-title">AI分析摘要</span>
        <span class="ais-time">数据更新时间：{{ dataUpdateTime }}</span>
      </div>

      <!-- 停机态：简化显示 -->
      <div v-if="ai.stopped" class="ais-stopped">
        <h3 class="as-h3">停机信息</h3>
        <ul class="stopped-list">
          <li v-for="(item, i) in ai.stopInfo" :key="i">{{ item }}</li>
        </ul>
      </div>

      <!-- 运行态：完整摘要（未选中传感器时） -->
      <template v-else-if="selectedSensors.length === 0">
        <!-- 工况行 -->
        <div class="status-row">
          <span class="sr-label">工况：</span>
          <span class="sr-val wc-tag" :class="wcClass">{{ ai.workCondition }}<span v-if="ai.avgRpm">（平均{{ ai.avgRPM }} RPM）</span></span>
          <span class="sr-label sr-gap">设备健康度：</span>
          <span class="health-val" :style="{ color: healthColor }"><b>{{ ai.healthScore }}%</b>·{{ ai.healthLabel }}</span>
          <span v-if="ai.suggestFocus" class="suggest-focus">建议关注：<b>{{ ai.suggestFocus }}</b>（{{ ai.suggestReason }}）</span>
        </div>

        <!-- 结论 -->
        <div class="ais-block">
          <h3 class="as-h3">结论：</h3>
          <p class="conclusion-text" v-html="renderHtml(ai.conclusion)" @click="onConclusionKwClick($event)"></p>
        </div>

        <!-- 关注点（结论关键词已内联高亮，此处保留快捷入口） -->
        <div class="ais-block" v-if="ai.concerns?.length">
          <h3 class="as-h3 concern-h3">
            关注点：
            <span class="concern-kw" v-for="(c, i) in ai.concerns" :key="i" @click="openConcernCard(c)">
              {{ c.keyword }}
            </span>
          </h3>
        </div>

        <!-- 建议 -->
        <div class="ais-block" v-if="ai.suggestions?.length">
          <h3 class="as-h3">建议：</h3>
          <ol class="suggestion-list">
            <li v-for="(s, i) in ai.suggestions" :key="i" v-html="renderHtml(s)"></li>
          </ol>
        </div>
      </template>

      <!-- 运行态：简版（选中传感器时收起） -->
      <div v-else class="ais-mini">
        <div class="mini-row">
          <span class="mini-label">工况：</span>
          <span class="mini-wc wc-tag" :class="wcClass">{{ ai.workCondition }}<span v-if="ai.avgRpm">（平均{{ ai.avgRPM }} RPM）</span></span>
          <span class="mini-gap"></span>
          <span class="mini-label">设备健康度：</span>
          <span class="health-val" :style="{ color: healthColor }"><b>{{ ai.healthScore }}%</b>·{{ ai.healthLabel }}</span>
          <span v-if="ai.suggestFocus" class="mini-focus">建议关注：<b>{{ ai.suggestFocus }}</b>（{{ ai.suggestReason }}）</span>
        </div>
      </div>

      <!-- 小结（底部提示，仅完整模式显示）-->
      <div class="ais-footer" v-if="!ai.stopped && !selectedSensors.length && ai.footerText">
        {{ ai.footerText }}
      </div>
    </section>

    <!-- ====== 下半部：传感器数据区（未选=全宽3列卡片网格 / 已选=左右分栏）====== -->
    <section class="sensor-section" :class="{ 'has-selected': selectedSensors.length > 0 }">

      <!-- ========== 模式A：未选中 → 全宽 3 列卡片网格 ========== -->
      <div v-if="selectedSensors.length === 0" class="ss-full">
        <!-- 搜索 + Tab -->
        <div class="ss-toolbar">
          <div class="ss-search-wrap">
            <Icon icon="mdi:magnify" class="search-icon" />
            <input v-model="sensorSearch" class="ss-search" placeholder="输入传感器名称..." type="text" />
          </div>
          <div class="group-tabs">
            <button
              v-for="g in groupTabs"
              :key="g.key"
              :class="{ active: activeGroup === g.key }"
              @click="activeGroup = g.key"
            >{{ g.label }}</button>
          </div>
        </div>

        <!-- 3列×N行 大卡片网格（可滚动）-->
        <div class="grid-container" ref="gridRef">
          <div
            v-for="s in filteredSensors"
            :key="s.id"
            class="grid-card"
            :class="[s.status]"
            @click="toggleSelect(s.id)"
            @contextmenu.prevent="showRangeTip(s)"
            @touchstart.passive="onCardTouchStart($event, s)"
            @touchend.passive="onCardTouchEnd($event, s)"
          >
            <div class="gc-bar"></div>
            <div class="gc-info">
              <div class="gc-name-en">{{ s.nameEn }}</div>
              <div class="gc-name-cn">{{ s.nameCn }}</div>
              <div class="gc-meta">{{ s.groupLabel || s.systemKey }} · {{ s.deviceName }}</div>
            </div>
            <div class="gc-val-area">
              <span class="gc-num font-mono-num" :class="'v-' + s.status">{{ s.value }}</span>
              <span class="gc-unit">{{ s.unit }}</span>
              <span class="sc-tag" :class="'tag-' + s.status">{{ statusLbl(s.status) }}</span>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!filteredSensors.length" class="grid-empty">无匹配的传感器</div>
        </div>
      </div>

      <!-- ========== 模式B：已选中 → 左侧固定列表 | 右侧趋势图 ========== -->
      <div v-else class="ss-split">
        <!-- 左侧：全量传感器列表（已选高亮）-->
        <div class="split-left">
          <div class="sl-toolbar">
            <div class="sl-search-wrap">
              <Icon icon="mdi:magnify" class="search-icon" />
              <input v-model="sensorSearch" class="ss-search sl-search" placeholder="输入传感器名称..." type="text" />
            </div>
            <div class="group-tabs sl-tabs">
              <button
                v-for="g in groupTabs"
                :key="g.key"
                :class="{ active: activeGroup === g.key }"
                @click="activeGroup = g.key"
              >{{ g.label }}</button>
            </div>
          </div>
          <p class="split-hint">{{ multiLineMode ? '多线对比模式：可勾选多个传感器' : '点击传感器卡片查看趋势图' }}</p>
          <div class="sl-card-list">
            <div
              v-for="s in filteredSensors"
              :key="s.id"
              class="sl-card"
              :class="[s.status, { selected: selectedSensors.includes(s.id), 'multi-mode': multiLineMode }]"
              @click="toggleSelect(s.id)"
              @contextmenu.prevent="showRangeTip(s)"
              @touchstart.passive="onCardTouchStart($event, s)"
              @touchend.passive="onCardTouchEnd($event, s)"
            >
              <!-- 多线模式：复选框 -->
              <div v-if="multiLineMode" class="sl-checkbox-wrap">
                <span class="sl-checkbox" :class="{ checked: selectedSensors.includes(s.id) }">
                  <Icon v-if="selectedSensors.includes(s.id)" icon="mdi:check" class="sl-check-icon" />
                </span>
              </div>
              <div class="sc-bar"></div>
              <div class="sl-info">
                <div class="sl-name">{{ s.nameEn }}</div>
                <div class="sl-sub">{{ s.nameCn }}</div>
                <div class="sl-meta">{{ s.groupLabel || s.systemKey }} · {{ s.deviceName }}</div>
              </div>
              <div class="sl-val-area">
                <span class="sl-num font-mono-num" :class="'v-' + s.status">{{ s.value }}</span>
                <span class="sl-unit">{{ s.unit }}</span>
                <span class="sc-tag" :class="'tag-' + s.status">{{ statusLbl(s.status) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：趋势图 -->
        <div class="split-right">
          <div class="chart-header">
            <span class="ch-title">传感器趋势图</span>
            <!-- 多线对比开关（替换原来的标签区） -->
            <label class="multi-line-switch" :class="{ active: multiLineMode }">
              <span class="mls-label">多线对比</span>
              <input type="checkbox" v-model="multiLineMode" class="mls-checkbox" />
              <span class="mls-toggle"><span class="mls-dot"></span></span>
            </label>
            <div class="ch-time-seg">
              <button v-for="r in timeRanges" :key="r.val" :class="{ active: trendRange === r.val && !customRangeActive }" @click="selectPresetRange(r.val)">{{ r.label }}</button>
            </div>
            <div class="custom-range-wrap">
              <button class="btn-custom" :class="{ active: customRangeActive }" @click="showCustomPicker = !showCustomPicker">
                <Icon icon="mdi:calendar-clock" />自定义
              </button>
              <transition name="picker-fade">
                <div v-if="showCustomPicker" class="custom-picker-panel">
                  <div class="cpp-header">
                    <span>自定义时间范围</span>
                    <button class="cpp-close" @click="showCustomPicker = false"><Icon icon="mdi:close" /></button>
                  </div>
                  <div class="cpp-body">
                    <div class="cpp-row">
                      <label>开始时间</label>
                      <input type="datetime-local" v-model="customStartTime" class="cpp-input" />
                    </div>
                    <div class="cpp-row">
                      <label>结束时间</label>
                      <input type="datetime-local" v-model="customEndTime" class="cpp-input" />
                    </div>
                    <div class="cpp-quick">
                      <button v-for="q in quickCustomRanges" :key="q.val" @click="applyQuickCustom(q.val)">{{ q.label }}</button>
                    </div>
                  </div>
                  <div class="cpp-footer">
                    <button class="cpp-cancel" @click="showCustomPicker = false">取消</button>
                    <button class="cpp-confirm" @click="applyCustomRange">确认</button>
                  </div>
                </div>
              </transition>
              <span v-if="customRangeActive" class="custom-range-label">{{ customRangeLabel }}</span>
            </div>
          </div>
          <div class="chart-body" ref="chartWrapRef" @click="quickReportFromChart">
            <v-chart class="trend-chart" :option="trendOption" autoresize />
          </div>
          <p class="chart-hint">此时AI分析摘要为收起/简版状态</p>
        </div>
      </div>
    </section>

    <!-- ====== 关键词详情卡片弹层 ====== -->
    <transition name="fade">
      <div v-if="concernCard" class="concern-overlay" @click.self="concernCard = null">
        <div class="concern-card">
          <div class="cc-header">
            <span class="cc-title">关注系统：{{ concernCard.systemName }}</span>
            <button class="cc-close" @click="concernCard = null">&times;</button>
          </div>
          <div class="cc-body" v-html="renderHtml(concernCard.detail)"></div>
        </div>
      </div>
    </transition>

    <!-- ====== 正常范围浮层 ====== -->
    <transition name="fade">
      <div v-if="rangeTooltip" class="range-tooltip" @click="rangeTooltip = null">
        <Icon icon="mdi:information-outline" />
        <span><b>正常范围：</b>{{ rangeTooltip }}</span>
      </div>
    </transition>

    <!-- ====== 巡检记录（右侧抽屉） ====== -->
    <transition name="drawer-slide">
      <div v-if="showReportList" class="drawer-backdrop" @click.self="showReportList=false">
        <div class="inspection-drawer">
          <!-- 列表模式（点击跳转独立详情页） -->
          <div class="id-header">
            <span><Icon icon="mdi:clipboard-text-clock" /> 巡检记录</span>
            <button class="id-close" @click="showReportList=false"><Icon icon="mdi:close" /></button>
          </div>
          <div class="id-list" ref="idListRef" @scroll="onListScroll">
            <div v-for="r in visibleReports" :key="r.id" class="id-item" @click="goToReport(r)">
              <div class="id-date">{{ r.date }}</div>
              <div class="id-summary">{{ r.summary }}</div>
            </div>
            <!-- 加载更多 -->
            <div v-if="loadingMore" class="id-loading">
              <Icon icon="mdi:loading" class="spin-icon" /> 加载中...
            </div>
            <div v-else-if="visibleReports.length >= reports.length && reports.length > PAGE_SIZE" class="id-end">— 已全部加载 —</div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, DataZoomComponent, LegendComponent } from 'echarts/components'
import { useDeviceStore } from '@/stores/deviceStore'
import { aiMonitorSummary, inspectionReports, SENSOR_PRESET_GROUPS, DEVICE_SYSTEMS } from '@/mock'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent, DataZoomComponent, LegendComponent])

const deviceStore = useDeviceStore()
const router = useRouter()
const emit = defineEmits(['report'])

// ---- 数据源 ----
const ai = reactive({ ...aiMonitorSummary })
const reports = inspectionReports

// ---- UI 状态 ----
const rangePath = ref([])
const showReportList = ref(false)
const rangeTooltip = ref('')
const concernCard = ref(null)

// ---- 时间 ----
const dataUpdateTime = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
})

// ---- 健康度 & 工况 ----
const healthColor = computed(() => {
  const s = ai.healthScore || 0
  return s >= 85 ? '#52C41A' : s >= 70 ? '#FAAD14' : '#FF4D4F'
})
const wcClass = computed(() => {
  const m = { running:'wc-run', stopped:'wc-stop', warmup:'wc-warmup', transit:'wc-transit', cruise:'wc-cruise' }
  return m[ai.workCondition] || 'wc-run'
})

// ---- 级联选择器 ----
function onRangeChange() {}

// ---- AI 关键词渲染 ----
function renderHtml(text) {
  if (!text) return ''
  let html = text
  // 匹配 **关键词** 或 {关键词} 格式，渲染为高亮可点击
  html = html.replace(/\*\*(.+?)\*\*/g, '<span class="kw">$1</span>')
  html = html.replace(/\{(.+?)\}/g, '<span class="kw">$1</span>')
  return html
}

function openConcernCard(c) {
  concernCard.value = c
}

// 结论中关键词点击 → 匹配关注点并打开详情卡片
function onConclusionKwClick(e) {
  const kwEl = e.target.closest('.kw')
  if (!kwEl) return
  const kwText = kwEl.textContent.trim()
  const match = ai.concerns?.find(c => c.keyword === kwText)
  if (match) openConcernCard(match)
}

// ---- 传感器搜索 & 分组 ----
const sensorSearch = ref('')
const activeGroup = ref('all')

const groupTabs = computed(() =>
  SENSOR_PRESET_GROUPS.map(g => ({ key: g.key, label: g.name }))
)

// 设备名映射 & 分组标签映射（用于卡片显示）
const deviceMap = computed(() => {
  const m = {}
  for (const d of deviceStore.devices) m[d.id] = d.name
  return m
})
const groupLabelMap = computed(() => {
  const m = {}
  for (const g of SENSOR_PRESET_GROUPS) m[g.key] = g.name
  return m
})

// 过滤后的传感器（受级联选择器和搜索和分组影响，并补充显示字段）
const filteredSensors = computed(() => {
  let list = [...deviceStore.sensors]
  // 级联过滤
  if (rangePath.value.length >= 1) {
    const sysKey = rangePath.value[0]
    if (sysKey) list = list.filter(s => s.systemKey === sysKey)
  }
  // 分组Tab过滤
  if (activeGroup.value !== 'all') {
    const g = SENSOR_PRESET_GROUPS.find(x => x.key === activeGroup.value)
    if (g?.sensorIds) list = list.filter(s => g.sensorIds.includes(s.id))
  }
  // 搜索过滤
  const kw = sensorSearch.value.trim().toLowerCase()
  if (kw) list = list.filter(s =>
    s.nameCn.includes(kw) || s.nameEn.toLowerCase().includes(kw) || (s.deviceName||'').toLowerCase().includes(kw)
  )
  // 补充显示字段：deviceName / groupLabel
  const dm = deviceMap.value
  const gm = groupLabelMap.value
  list = list.map(s => ({
    ...s,
    deviceName: dm[s.deviceId] || s.deviceId,
    groupLabel: gm[s.groupKey] || s.groupKey,
  }))
  // 异常前置排序
  const order = { danger: 0, warning: 1, offline: 2, normal: 3 }
  return list.sort((a, b) => (order[a.status]??4) - (order[b.status]??4))
})

// 分页：每页12个（3列×4行）
const PER_PAGE = 12
const sensorPages = computed(() => {
  const pages = []
  for (let i = 0; i < filteredSensors.value.length; i += PER_PAGE) {
    pages.push(filteredSensors.value.slice(i, i + PER_PAGE))
  }
  return pages
})

// ---- 选中状态 ----
const selectedSensors = ref([])
const multiLineMode = ref(false) // 多线对比开关（默认关闭=单选模式）
const selectedSensorObjs = computed(() =>
  selectedSensors.value.map(id => filteredSensors.value.find(s => s.id === id)).filter(Boolean)
)

function toggleSelect(id) {
  if (multiLineMode.value) {
    // 多线模式：多选，可切换
    const idx = selectedSensors.value.indexOf(id)
    if (idx >= 0) {
      selectedSensors.value.splice(idx, 1)
    } else {
      selectedSensors.value.push(id)
    }
  } else {
    // 单选模式：点击即替换为当前这一个
    if (selectedSensors.value.length === 1 && selectedSensors.value[0] === id) {
      // 再次点击同一个 → 取消选中，回到卡片网格
      selectedSensors.value = []
    } else {
      selectedSensors.value = [id]
    }
  }
}

function removeSelect(id) {
  selectedSensors.value = selectedSensors.value.filter(x => x !== id)
}

// ---- 触控滑动分页 ----
const swRef = ref(null)
let touchStartX = 0
const currentPage = ref(0)

function onTouchStart(e) { touchStartX = e.touches[0].clientX }
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) > 40) {
    const dir = dx > 0 ? -1 : 1
    const next = Math.max(0, Math.min(sensorPages.value.length - 1, currentPage.value + dir))
    if (next !== currentPage.value) currentPage.value = next
  }
}
watch(() => filteredSensors.value.length, () => { currentPage.value = 0 })

// ---- 长按显示正常范围 ----
let longPressTimer = null
function onCardTouchStart(e, s) {
  longPressTimer = setTimeout(() => showRangeTip(s), 500)
}
function onCardTouchEnd() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}

function showRangeTip(s) {
  if (s.range) {
    rangeTooltip.value = `${s.range[0]}至${s.range[1]} ${s.unit}`
  }
}

function statusLbl(st) {
  return { normal:'正常', warning:'异常', danger:'超限', offline:'离线' }[st] || '未知'
}

// ---- 趋势图 ----
const timeRanges = [
  { label: '1H', val: 1 }, { label: '6H', val: 6 }, { label: '24H', val: 24 }, { label: '7D', val: 168 },
]
const trendRange = ref(24)

// ---- 自定义时间选择 ----
const showCustomPicker = ref(false)
const customRangeActive = ref(false)
const customStartTime = ref('')
const customEndTime = ref('')
const customHours = ref(24)
const customRangeLabel = ref('')

const quickCustomRanges = [
  { label: '近12小时', val: 12 },
  { label: '近3天', val: 72 },
  { label: '近7天', val: 168 },
  { label: '近30天', val: 720 },
]

// 格式化当前时间为 datetime-local 输入框格式
function formatForInput(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
// 初始化默认时间范围
const _now = new Date('2026-06-26T12:00:00')
const _24hAgo = new Date(_now.getTime() - 24 * 3600 * 1000)
customStartTime.value = formatForInput(_24hAgo)
customEndTime.value = formatForInput(_now)

function selectPresetRange(val) {
  trendRange.value = val
  customRangeActive.value = false
  customRangeLabel.value = ''
  showCustomPicker.value = false
}

function applyQuickCustom(val) {
  const end = new Date('2026-06-26T12:00:00')
  const start = new Date(end.getTime() - val * 3600 * 1000)
  customStartTime.value = formatForInput(start)
  customEndTime.value = formatForInput(end)
}

function applyCustomRange() {
  const start = new Date(customStartTime.value)
  const end = new Date(customEndTime.value)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return
  const diffMs = end.getTime() - start.getTime()
  if (diffMs <= 0) return
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
  customHours.value = diffHours
  trendRange.value = diffHours
  customRangeActive.value = true
  customRangeLabel.value = `${start.toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'})} ${String(start.getHours()).padStart(2,'0')}:00 ~ ${end.toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'})} ${String(end.getHours()).padStart(2,'0')}:00`
  showCustomPicker.value = false
}

const trendOption = computed(() => {
  const objs = selectedSensorObjs.value
  const baseData = deviceStore.getTrendData(selectedSensors.value, trendRange.value)
  const COLORS = ['#1890FF','#13C2C2','#FAAD14','#FF4D4F','#722ED1','#F5A623','#52C41A']

  const series = objs.map((s, i) => ({
    name: s.nameCn,
    type: 'line',
    smooth: true,
    symbol: 'none',
    lineStyle: { width: 2, color: COLORS[i % COLORS.length] },
    itemStyle: { color: COLORS[i % COLORS.length] },
    data: baseData.map(p => p[s.id]),
    markArea: s.range ? {
      silent: true,
      data: [[{ yAxis: s.range[0] }, { yAxis: s.range[1] }]],
      itemStyle: { color: `${COLORS[i % COLORS.length]}08` },
    } : undefined,
  }))

  return {
    backgroundColor: 'transparent',
    animationDuration: 800,
    grid: { left: 46, right: 16, top: 28, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#152A47',
      borderColor: '#243B58',
      textStyle: { color: '#E8F0FF', fontSize: 11 },
    },
    legend: {
      show: true,
      bottom: 0,
      textStyle: { color: '#8BAAC0', fontSize: 10 },
      itemWidth: 12, itemHeight: 2,
      icon: 'roundRect',
    },
    xAxis: {
      type: 'category',
      data: baseData.map(p => p.time),
      axisLine: { lineStyle: { color: '#1E3A5F' } },
      axisLabel: { color: '#4A6A8A', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: { lineStyle: { color: '#152A47' } },
      axisLabel: { color: '#4A6A8A', fontSize: 10 },
    },
    series,
  }
})

// 图表点击上报（单击即可）
function quickReportFromChart() {
  const s = selectedSensorObjs.value[0]
  if (!s) return
  emit('report', {
    deviceId: s.deviceId,
    sensorId: s.id,
    abnormalTime: dataUpdateTime.value,
    description: `${s.nameCn}当前值 ${s.value}${s.unit}，已选时段数据快照`,
  })
}

// ---- 巡检记录 ----
const PAGE_SIZE = 15
const loadingMore = ref(false)
const displayCount = ref(PAGE_SIZE)
const idListRef = ref(null)

// 可见列表（分页加载）
const visibleReports = computed(() => reports.slice(0, displayCount.value))

// 滚动加载更多
function onListScroll(e) {
  const el = e.target
  if (loadingMore.value) return
  // 距底部 60px 时触发加载
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
    loadMoreReports()
  }
}

async function loadMoreReports() {
  if (displayCount.value >= reports.length) return
  loadingMore.value = true
  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 500))
  displayCount.value = Math.min(displayCount.value + 10, reports.length)
  loadingMore.value = false
}

// 跳转到报告详情独立页面
function goToReport(r) {
  showReportList.value = false
  router.push(`/report/${r.id}`)
}

// 重置列表状态（关闭抽屉时）
watch(showReportList, (val) => {
  if (!val) displayCount.value = PAGE_SIZE
})

// 关闭多线模式时，多选→只保留第一个（单选）
watch(multiLineMode, (val) => {
  if (!val && selectedSensors.value.length > 1) {
    selectedSensors.value = [selectedSensors.value[0]]
  }
})
</script>

<script>
// 额外 import watch（因为 template 里用到了）
import { watch } from 'vue'
export default {
  // watch 已在 setup 中通过额外 script 使用
}
</script>

<style scoped>
/* ====== 页面容器 ====== */
.monitor-page {
  padding: 14px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ====== 顶部栏 ====== */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.btn-inspect {
  background: transparent; border: 1px solid #1890FF; color: #1890FF;
  border-radius: 5px; padding: 6px 16px; font-size: 13px; cursor: pointer;
  font-weight: 600;
}
.btn-inspect:hover { background: rgba(24,144,255,0.08); }

/* ====== AI 分析摘要 ====== */
.ai-section {
  background: #fff; border-radius: 8px; padding: 18px 20px;
  color: #222; flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: all 0.35s ease;
  overflow: hidden;
}
/* 收起态（选中传感器时） */
.ai-section.ais-collapsed {
  padding: 12px 16px;
}
.ais-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.ais-title { font-size: 15px; font-weight: 700; color: #111; }
.ais-time { font-size: 11px; color: #888; }

/* ---- 完整模式（未选中传感器）---- */
/* 工况行 */
.status-row {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; margin-bottom: 14px;
  line-height: 1.6;
}
.sr-label { font-size: 13px; color: #555; }
.sr-gap { margin-left: 6px; }
.wc-tag { font-weight: 600; }
.wc-run { color: #1890FF; }
.wc-stop { color: #999; }
.wc-warmup { color: #FAAD14; }
.wc-transit { color: #F5A623; }
.wc-cruise { color: #52C41A; }
.health-val b { font-weight: 800; font-family: Consolas, monospace; font-size: 15px; }
.suggest-focus {
  margin-top: 4px; width: 100%; font-size: 12px; color: #666;
}
.suggest-focus b { color: #FF4D4F; }

/* 区块 */
.ais-block { margin-bottom: 12px; }
.as-h3 { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 6px; display: inline; }
.concern-h3 { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }

/* 结论文本 */
.conclusion-text { font-size: 13px; color: #333; line-height: 1.75; margin: 0; }

/* 关注点关键词 */
.concern-kw {
  color: #FF4D4F; font-weight: 700; cursor: pointer;
  text-decoration: underline; text-decoration-style: dashed;
  padding: 1px 3px; border-radius: 3px;
  transition: background 0.15s;
}
.concern-kw:hover { background: rgba(255,77,79,0.06); }

/* 建议列表 */
.suggestion-list {
  margin: 0; padding-left: 20px; font-size: 13px; color: #333; line-height: 1.75;
}
.suggestion-list li { margin-bottom: 4px; }

/* ---- 简版模式（选中传感器时收起）---- */
.ais-mini {
  /* 紧凑单行：工况 + 健康度 + 建议关注 */
}
.mini-row {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap; line-height: 1.6;
}
.mini-label { font-size: 13px; color: #555; }
.mini-wc { font-weight: 600; }
.mini-gap { width: 1px; height: 14px; background: #ddd; margin: 0 2px; }
.mini-focus { font-size: 12px; color: #666; }
.mini-focus b { color: #FF4D4F; }

/* AI 高亮关键词（结论内联 + 关注点） */
:deep(.kw) {
  color: #1890FF; font-weight: 700;
  cursor: pointer; border-bottom: 1px dashed #1890FF;
  transition: background 0.15s, color 0.15s;
  padding: 0 2px; border-radius: 3px;
}
:deep(.kw:hover) {
  background: rgba(24,144,255,0.1); color: #096DD9;
}

/* 停机态 */
.ais-stopped h3 { font-size: 15px; font-weight: 700; margin: 0 0 8px; }
.stopped-list { margin: 0; padding-left: 20px; font-size: 13px; color: #444; }
.stopped-list li { margin-bottom: 5px; line-height: 1.6; }

/* 底部小结 */
.ais-footer {
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid #eee; font-size: 12px; color: #888;
}

/* ====== 传感器数据区（双模式：未选=全宽网格 / 已选=左右分栏）====== */
.sensor-section {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  background: #0D1B2E; border-radius: 8px; overflow: hidden;
}

/* ---- 模式A：全宽卡片网格（未选中）---- */
.ss-full {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
}

/* 工具栏 */
.ss-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; flex-shrink: 0; border-bottom: 1px solid #162940;
}

/* 搜索框 */
.search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: #4A6A8A; font-size: 15px;
}
.ss-search-wrap { position: relative; }
.ss-search {
  width: 100%; background: transparent; border: none; border-bottom: 1px solid #243B58;
  padding: 7px 28px 7px 32px; color: #E8F0FF; font-size: 12px;
  outline: none; transition: border-color 0.15s;
}
.ss-search:focus { border-color: #1890FF; }
.ss-search::placeholder { color: #3A5A7A; }

/* 分组Tab */
.group-tabs {
  display: flex; gap: 2px; background: #080f1a; border-radius: 5px; padding: 2px;
}
.group-tabs button {
  padding: 5px 12px; border: none; background: transparent;
  color: #5A7A92; font-size: 11px; border-radius: 4px; cursor: pointer;
  white-space: nowrap; font-weight: 500;
}
.group-tabs button.active { background: #1890FF; color: #fff; }

/* 3列大卡片滚动网格 */
.grid-container {
  flex: 1; min-height: 0; overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px;
  align-content: start;

  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #243B58 transparent;
}
.grid-container::-webkit-scrollbar { width: 6px; }
.grid-container::-webkit-scrollbar-track { background: transparent; }
.grid-container::-webkit-scrollbar-thumb { background: #243B58; border-radius: 4px; }

/* 全宽大卡片（对齐图2截图）*/
.grid-card {
  display: flex; align-items: stretch;
  background: #0c1628;
  border-radius: 10px;
  cursor: pointer;
  border: 1.5px solid transparent;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
  min-height: 100px;
}
.grid-card:hover {
  background: #0e1c33;
  border-color: #243B58;
  transform: translateY(-1px);
}

/* 左色条 */
.gc-bar { width: 5px; flex-shrink: 0; border-radius: 2px; margin: 10px 0; }
.grid-card.normal .gc-bar { background: #52C41A; }
.grid-card.warning .gc-bar { background: #FAAD14; }
.grid-card.danger .gc-bar { background: #FF4D4F; animation: pulse-dot 1.5s infinite; }
.grid-card.offline .gc-bar { background: #3d556b; }

/* 中间信息区 */
.gc-info {
  flex: 1; min-width: 0;
  padding: 10px 6px 10px 12px;
  display: flex; flex-direction: column; gap: 3px; justify-content: center;
}
.gc-name-en { font-size: 13px; font-weight: 700; color: #E0ECF8; line-height: 1.25; letter-spacing: 0.3px; }
.gc-name-cn { font-size: 11px; color: #8BAAC0; line-height: 1.2; }
.gc-meta { font-size: 10px; color: #4A6A8A; line-height: 1.2; }

/* 右侧数值区 */
.gc-val-area {
  flex-shrink: 0;
  padding: 10px 12px;
  display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 4px;
}
.gc-num { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
.v-normal { color: #52C41A; }
.v-warning { color: #FAAD14; }
.v-danger { color: #FF4D4F; }
.v-offline { color: #5A7A92; }
.gc-unit { font-size: 11px; color: #5A7A92; }

/* 状态标签 pill */
.sc-tag {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
  line-height: 1.5; white-space: nowrap;
}
.tag-normal { color: #52C41A; background: rgba(82,196,26,0.14); }
.tag-warning { color: #FAAD14; background: rgba(250,173,20,0.14); }
.tag-danger { color: #FF4D4F; background: rgba(255,77,79,0.14); }
.tag-offline { color: #5A7A92; background: rgba(90,122,146,0.12); }

/* 空状态 */
.grid-empty {
  grid-column: 1 / -1; text-align: center; color: #3A5A7A;
  padding: 40px 0; font-size: 13px;
}

/* ---- 模式B：左右分栏（已选中）---- */
.ss-split {
  display: flex; height: 100%; min-height: 0;
}

/* 左侧传感器列表（正常卡片，固定尺寸，可滚动） */
.split-left {
  width: 300px; flex-shrink: 0; border-right: 1px solid #162940;
  display: flex; flex-direction: column; overflow: hidden; background: #0A1424;
}

/* 左侧工具栏：搜索 + Tab */
.sl-toolbar {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px; flex-shrink: 0; border-bottom: 1px solid #162940;
}
.sl-search-wrap { position: relative; }
.sl-search { width: 100%; padding-right: 24px; }
.sl-tabs { width: 100%; }
.sl-tabs .group-tabs { width: 100%; }
.sl-tabs .group-tabs button { flex: 1; text-align: center; }

.split-hint { font-size: 11px; color: #3A5A7A; padding: 6px 12px 2px; flex-shrink: 0; }

.sl-card-list {
  flex: 1; min-height: 0; overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  padding: 10px 12px 16px;

  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #243B58 transparent;
}
.sl-card-list::-webkit-scrollbar { width: 5px; }
.sl-card-list::-webkit-scrollbar-track { background: transparent; }
.sl-card-list::-webkit-scrollbar-thumb { background: #243B58; border-radius: 4px; }

/* ---- 正常尺寸传感器卡片 ---- */
.sl-card {
  display: flex; align-items: stretch;
  background: #0c1628;
  border-radius: 10px;
  cursor: pointer;
  border: 1.5px solid transparent;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
  min-height: 96px;
}
.sl-card:hover {
  background: #0e1c33;
  border-color: #243B58;
  transform: translateY(-1px);
}
/* 选中态 */
.sl-card.selected {
  border-color: #1890FF;
  background: rgba(24,144,255,0.07);
  box-shadow: 0 0 14px rgba(24,144,255,0.12), inset 0 0 0 1px rgba(24,144,255,0.08);
}

/* 多线模式下的复选框 */
.sl-card.multi-mode { cursor: pointer; }
.sl-checkbox-wrap {
  width: 22px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  padding: 10px 4px;
}
.sl-checkbox {
  width: 16px; height: 16px; border-radius: 4px;
  border: 1.5px solid #3A5A7A; background: transparent;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.sl-checkbox.checked {
  background: #1890FF; border-color: #1890FF;
}
.sl-check-icon { font-size: 11px; color: #fff; }

/* 左色条 */
.sc-bar { width: 5px; flex-shrink: 0; border-radius: 2px; margin: 8px 0; }
.sl-card.normal .sc-bar { background: #52C41A; }
.sl-card.warning .sc-bar { background: #FAAD14; }
.sl-card.danger .sc-bar { background: #FF4D4F; animation: pulse-dot 1.5s infinite; }
.sl-card.offline .sc-bar { background: #3d556b; }

/* 中间信息区 */
.sl-info {
  flex: 1; min-width: 0;
  padding: 10px 8px 10px 12px;
  display: flex; flex-direction: column; gap: 3px; justify-content: center;
}
.sl-name { font-size: 13px; font-weight: 700; color: #E0ECF8; line-height: 1.25; letter-spacing: 0.2px; }
.sl-sub { font-size: 11px; color: #8BAAC0; line-height: 1.2; }
.sl-meta { font-size: 10px; color: #4A6A8A; line-height: 1.2; }

/* 右侧数值区 */
.sl-val-area {
  flex-shrink: 0;
  padding: 10px 12px;
  display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 4px;
}
.sl-num { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
.v-normal { color: #52C41A; }
.v-warning { color: #FAAD14; }
.v-danger { color: #FF4D4F; }
.v-offline { color: #5A7A92; }
.sl-unit { font-size: 11px; color: #5A7A92; }

/* 搜索框 */
.search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: #4A6A8A; font-size: 15px;
}
.ss-search {
  width: 100%; background: transparent; border: none; border-bottom: 1px solid #243B58;
  padding: 7px 28px 7px 32px; color: #E8F0FF; font-size: 12px;
  outline: none; transition: border-color 0.15s;
}
.ss-search:focus { border-color: #1890FF; }
.ss-search::placeholder { color: #3A5A7A; }

/* 分组Tab */
.group-tabs {
  display: flex; gap: 2px; background: #080f1a; border-radius: 5px; padding: 2px;
}
.group-tabs button {
  padding: 5px 10px; border: none; background: transparent;
  color: #5A7A92; font-size: 11px; border-radius: 4px; cursor: pointer;
  white-space: nowrap; font-weight: 500; flex: 1;
}
.group-tabs button.active { background: #1890FF; color: #fff; }

/* 状态标签 pill */
.sc-tag {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
  line-height: 1.5; white-space: nowrap;
}
.tag-normal { color: #52C41A; background: rgba(82,196,26,0.14); }
.tag-warning { color: #FAAD14; background: rgba(250,173,20,0.14); }
.tag-danger { color: #FF4D4F; background: rgba(255,77,79,0.14); }
.tag-offline { color: #5A7A92; background: rgba(90,122,146,0.12); }

/* 右侧趋势图 */
.split-right {
  flex: 1; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
  padding: 12px 14px; overflow: hidden;
}
.chart-header {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  margin-bottom: 8px; flex-wrap: wrap;
}
.ch-title { font-size: 13px; font-weight: 700; color: #E0ECF8; }

/* 多线对比开关 */
.multi-line-switch {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; user-select: none;
  padding: 3px 4px 3px 0; border-radius: 14px;
  transition: background 0.2s;
}
.multi-line-switch:hover { background: rgba(24,144,255,0.06); }
.multi-line-switch.active:hover { background: rgba(24,144,255,0.1); }
.mls-label {
  font-size: 11px; color: #5A7A92; white-space: nowrap;
  transition: color 0.2s;
}
.multi-line-switch.active .mls-label { color: #1890FF; font-weight: 600; }
.mls-checkbox { display: none; }
.mls-toggle {
  position: relative; width: 34px; height: 18px;
  background: #1E3A5F; border-radius: 9px;
  transition: background 0.25s; flex-shrink: 0;
}
.multi-line-switch.active .mls-toggle { background: #1890FF; }
.mls-dot {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px;
  background: #E8F0FF; border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.multi-line-switch.active .mls-dot { transform: translateX(16px); }

.ch-time-seg {
  display: flex; gap: 2px; background: #080f1a; border-radius: 5px; padding: 2px; margin-left: auto;
}
.ch-time-seg button {
  padding: 4px 10px; border: none; background: transparent;
  color: #4A6A8A; font-size: 11px; border-radius: 4px; cursor: pointer;
}
.ch-time-seg button.active { background: #1890FF; color: #fff; }

.btn-custom {
  display: inline-flex; align-items: center; gap: 4px;
  background: transparent; border: 1px solid #3A5A7A; color: #8BAAC0;
  border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;
  transition: all 0.15s;
}
.btn-custom:hover { border-color: #1890FF; color: #1890FF; }
.btn-custom.active { border-color: #1890FF; color: #1890FF; background: rgba(24,144,255,0.1); }
.btn-custom svg { font-size: 13px; }

/* 自定义时间选择面板 */
.custom-range-wrap { position: relative; display: inline-flex; align-items: center; gap: 6px; }

.custom-range-label {
  font-size: 10px; color: #1890FF; white-space: nowrap;
}

.custom-picker-panel {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 100;
  width: 280px;
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(24,144,255,0.1);
  overflow: hidden;
}
.cpp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #162940;
  font-size: 13px; font-weight: 600; color: #E8F0FF;
}
.cpp-close {
  background: none; border: none; cursor: pointer;
  color: #5A7A92; font-size: 16px; padding: 2px;
  display: flex; align-items: center;
}
.cpp-close:hover { color: #E8F0FF; }
.cpp-body { padding: 12px 14px; }
.cpp-row {
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;
}
.cpp-row label {
  font-size: 11px; color: #5A7A92; font-weight: 500;
}
.cpp-input {
  background: #0A1628; border: 1px solid #1E3A5F; border-radius: 4px;
  padding: 6px 8px; font-size: 12px; color: #E8F0FF;
  font-family: inherit; outline: none;
  color-scheme: dark;
}
.cpp-input:focus { border-color: #1890FF; }
.cpp-quick {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;
}
.cpp-quick button {
  padding: 3px 8px; border-radius: 4px; font-size: 10px;
  border: 1px solid #1E3A5F; background: #0A1628; color: #8BAAC0;
  cursor: pointer; transition: all 0.15s;
}
.cpp-quick button:hover { border-color: #1890FF; color: #1890FF; }
.cpp-footer {
  display: flex; gap: 8px; padding: 10px 14px;
  border-top: 1px solid #162940;
  justify-content: flex-end;
}
.cpp-cancel {
  padding: 5px 14px; border-radius: 4px; font-size: 12px;
  border: 1px solid #2A4566; background: transparent; color: #8BAAC0;
  cursor: pointer;
}
.cpp-cancel:hover { color: #E8F0FF; border-color: #3A5A7A; }
.cpp-confirm {
  padding: 5px 14px; border-radius: 4px; font-size: 12px;
  border: none; background: #1890FF; color: #fff; cursor: pointer;
  font-weight: 600;
}
.cpp-confirm:hover { background: #40A9FF; }

/* 面板淡入淡出 */
.picker-fade-enter-active, .picker-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.picker-fade-enter-from, .picker-fade-leave-to {
  opacity: 0; transform: translateY(-6px);
}

.chart-body {
  flex: 1; min-height: 200px; position: relative;
}
.trend-chart { width: 100%; height: 100% !important; }
.chart-hint {
  font-size: 11px; color: #3A5A7A; text-align: right; padding: 4px 0 0;
  flex-shrink: 0;
}

/* ====== 过渡动画 ====== */
.concern-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center;
}
.concern-card {
  background: #fff; border-radius: 10px; width: 520px; max-width: 90vw;
  max-height: 70vh; overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.2);
}
.cc-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px 10px; border-bottom: 1px solid #eee;
}
.cc-title { font-size: 15px; font-weight: 700; color: #111; }
.cc-close { background: none; border: none; font-size: 22px; color: #999; cursor: pointer; line-height: 1; }
.cc-body { padding: 16px 20px 20px; font-size: 13px; color: #333; line-height: 1.8; }
.cc-body :deep(.kw) { color: #1890FF; font-weight: 700; }
/* 竖向排版：标题 + 分段 */
.cc-body :deep(strong) {
  display: block; font-size: 14px; font-weight: 700; color: #111;
  margin: 10px 0 6px;
}
.cc-body :deep(strong:first-child) { margin-top: 0; }
/* 数据行缩进 */
.cc-body :deep(br) { display: block; content: ''; margin: 2px 0; }

/* ====== 正常范围浮层 ====== */
.range-tooltip {
  position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
  z-index: 150; background: #152A47; border: 1px solid #243B58;
  color: #E8F0FF; font-size: 13px; padding: 10px 20px;
  border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}
.range-tooltip svg { color: #1890FF; font-size: 17px; }

/* ====== 巡检记录（右侧抽屉）====== */
.drawer-backdrop {
  position: fixed; inset: 0; z-index: 180;
  background: rgba(0,0,0,0.35);
  display: flex; justify-content: flex-end;
}

.inspection-drawer {
  width: 380px; max-width: 90vw; height: 100%;
  background: #0A1426; display: flex; flex-direction: column;
  box-shadow: -8px 0 32px rgba(0,0,0,0.4);
  border-left: 1px solid #1E3A5F;
}

/* 抽屉头部 */
.id-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid #1E3A5F; flex-shrink: 0;
  font-size: 14px; font-weight: 700; color: #E0ECF8;
  gap: 10px;
}
.id-header-detail .id-back { background: none; border: none; color: #8BAAC0; cursor: pointer; font-size: 18px; padding: 2px; }
.id-header-detail .id-back:hover { color: #1890FF; }

.id-close { background: none; border: none; color: #5A7A92; cursor: pointer; font-size: 18px; padding: 2px; display: flex; }
.id-close:hover { color: #FF4D4F; }

/* 列表 */
.id-list {
  flex: 1; overflow-y: auto; padding: 8px 0;

  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #243B58 transparent;
}
.id-list::-webkit-scrollbar { width: 5px; }
.id-list::-webkit-scrollbar-track { background: transparent; }
.id-list::-webkit-scrollbar-thumb { background: #243B58; border-radius: 4px; }

/* 列表项（对齐图2截图：蓝色日期 + 概要文字）*/
.id-item {
  padding: 11px 18px; cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.12s;
  border-bottom: 1px solid rgba(30,58,95,0.3);
}
.id-item:hover { background: #111e34; }
.id-item:active { background: #162940; }

.id-date {
  font-size: 13px; font-weight: 700; color: #1890FF;
  font-family: Consolas, monospace; margin-bottom: 3px;
}
.id-summary {
  font-size: 12px; color: #8BAAC0; line-height: 1.45;
}

/* 加载状态 */
.id-loading {
  text-align: center; padding: 16px; font-size: 12px; color: #5A7A92;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.spin-icon { animation: spin 1s linear infinite; font-size: 16px; color: #1890FF; }
@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

.id-end {
  text-align: center; padding: 14px; font-size: 11px; color: #3A5A7A;
}

/* 动画 */
@keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 抽屉从右侧滑入 */
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: all 0.3s ease; }
.drawer-slide-enter-from .inspection-drawer, .drawer-slide-leave-to .inspection-drawer {
  transform: translateX(100%);
}
.drawer-slide-enter-from, .drawer-slide-leave-to { opacity: 0; }
</style>
