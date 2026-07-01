<template>
  <div class="home-page">
    <!-- ============ 通知 Toast（弹出式） ============ -->
    <Transition name="toast-slide">
      <div class="notice-toast" v-if="showNoticeToast && !toastDismissed" @click="goDetail(latestUnreadEvent?.eventId)">
        <div class="toast-icon">🔔</div>
        <div class="toast-body">
          <div class="toast-title">新增异常事件</div>
          <div class="toast-msg">{{ latestUnreadEvent?.title?.replace(/^(新事件[：:]\s*)/, '') || '有待处理通知' }}</div>
        </div>
        <div class="toast-action">立即查看 &rsaquo;</div>
        <button class="toast-close" @click.stop="toastDismissed = true">&times;</button>
      </div>
    </Transition>

    <!-- ============ 主内容三栏 ============ -->
    <div class="home-grid">
    <section class="col col-left">
      <!-- 标题 -->
      <div class="monitor-title">
        <span class="mt-bar"></span>
        <span class="mt-text">监控态势</span>
        <!-- 设备过滤标签 -->
        <span class="filter-tag" v-if="activeDeviceIds">
          已选 {{ selectedDevIds.size }} 个设备
          <button class="filter-clear" @click.stop="clearDevSelection">✕</button>
        </span>
        <!-- 快速选项卡 -->
        <div class="quick-tabs">
          <button v-for="g in sensorGroups" :key="g.key"
                  :class="{ active: activeGroup === g.key }"
                  @click="switchGroup(g.key)">{{ g.name }}</button>
        </div>
      </div>

      <!-- 传感器卡片网格（可左右滑动分页） -->
      <div class="sensor-swiper-wrap" ref="swiperRef"
           @touchstart="onSwiperTouchStart"
           @touchend="onSwiperTouchEnd">
        <div class="sensor-grid" :style="{ transform: `translateX(-${currentPage * 100}%)` }">
          <div v-for="(page, pi) in sensorPages" :key="pi" class="sensor-page">
            <div v-for="s in page" :key="s.id"
                 class="sensor-card" :class="{ selected: isSelected(s.id), abnormal: s.status !== 'normal' }"
                 @click="toggleSelect(s.id)">
              <!-- 头部：传感器名 + 状态圆点 -->
              <div class="sc-header">
                <span class="sc-name">{{ s.nameEn || s.nameCn }}</span>
                <span class="sc-dot" :class="s.status"></span>
              </div>
              <!-- 数值 -->
              <div class="sc-value font-mono-num" :class="'st-' + s.status">{{ formatVal(s.value) }}</div>
              <!-- 单位+状态 -->
              <div class="sc-meta">{{ s.unit }} · {{ statusLabel(s.status) }}</div>
            </div>
          </div>
        </div>
        <!-- 分页指示器 -->
        <div class="page-dots" v-if="totalPages > 1">
          <span v-for="i in totalPages" :key="i" :class="{ active: currentPage === i-1 }"></span>
        </div>
      </div>

      <!-- 趋势图：多通道对比 -->
      <div class="industrial-card panel trend-panel">
        <div class="industrial-card-header">
          <span class="industrial-card-title"><Icon icon="mdi:chart-line" /> 传感器趋势图 · 多通道对比</span>
          <div class="seg">
            <button v-for="r in ranges" :key="r" :class="{active:trendRange===r}" @click="trendRange=r">{{ r }}H</button>
          </div>
        </div>
        <v-chart class="trend-chart" :option="multiTrendOption" autoresize />
      </div>
    </section>

    <!-- ============ 中间：设备态势 + 立体船舶视图 ============ -->
    <section class="col col-center">
      <!-- 设备态势顶部卡 -->
      <div class="industrial-card panel device-status-card">
        <div class="dsc-header">
          <span class="mt-bar"></span>
          <span class="mt-text">设备态势</span>
        </div>
        <div class="dsc-body">
          <!-- 左：船名 -->
          <div class="dsc-name">
            <span class="ship-cn">{{ shipStore.info.name }}</span>
            <span class="ship-en">{{ shipStore.info.nameEn || 'JADE STAR' }}</span>
          </div>
          <!-- 中间四列信息 -->
          <div class="dsc-info-grid">
            <div class="dsc-info-item">
              <span class="dsc-label">在线情况</span>
              <span class="dsc-val online">在线</span>
            </div>
            <div class="dsc-info-item">
              <span class="dsc-label">监测设备</span>
              <span class="dsc-val font-mono-num">{{ deviceStore.devices.length }}<small>点位</small></span>
            </div>
            <div class="dsc-info-item">
              <span class="dsc-label">最近巡检时间</span>
              <span class="dsc-val font-mono-num" style="font-size:12px;color:#8BAAC0">{{ shipStore.info.lastInspection || '2026-06-22 8:00' }}</span>
            </div>
            <div class="dsc-info-item">
              <span class="dsc-label">累计作业次数</span>
              <span class="dsc-val font-mono-num">{{ shipStore.info.totalOps || '5680' }}<small>次</small></span>
            </div>
          </div>
          <!-- 右：健康度环图 -->
          <div class="dsc-health-ring">
            <v-chart :option="healthRingOption" autoresize style="width:72px;height:72px;" />
          </div>
        </div>
      </div>

      <!-- 立体船舶视图 + 设备浮动卡片 -->
      <div class="ship-view-wrap">
        <!-- 船体图片 + 扫描动效 -->
        <div class="ship-img-container">
          <img :src="shipBg" alt="ship" class="ship-bg-img" :class="{ sailing: isSailing }" />
          <!-- 扫描线 -->
          <div class="scan-line-wrap" v-show="!isSailing || true">
            <div class="scan-line"></div>
            <div class="scan-glow"></div>
          </div>
          <!-- 扫描网格叠加 -->
          <div class="scan-grid-overlay"></div>
        </div>

        <!-- 设备浮动卡片（绝对定位覆盖在船体上） -->
        <template v-for="dev in floatingDevices" :key="dev.id">
          <div class="float-dev-card"
               :style="{ left: dev.x + '%', top: dev.y + '%' }"
               :class="{ selected: selectedDevIds.has(dev.id), [dev.status]: true }"
               @click="onFloatDevClick(dev)"
               @contextmenu.prevent="onFloatDevLongPress(dev)">
            <div class="fdc-header">
              <span class="fdc-name">{{ dev.name }}</span>
              <span class="fdc-dot" :class="dev.status"></span>
            </div>
            <div class="fdc-footer">
              <span v-if="dev.eventCount > 0" :class="'evt-count ' + dev.eventLevel">● {{ dev.eventCount }} 事件</span>
              <span v-else class="evt-count ok">● {{ statusLabel(dev.status) }}</span>
            </div>
            <!-- 选中指示器 -->
            <div class="fdc-select-ring" v-if="selectedDevIds.has(dev.id)"></div>
          </div>
        </template>
      </div>

      <!-- 底部工况栏 -->
      <div class="status-bar new-bar">
        <div class="nb-cell">
          <span class="nb-label">工况</span>
          <span class="nb-value nav-status" :class="shipStore.info.navStatus">{{ shipStore.navStatusLabel }}</span>
        </div>
        <div class="nb-divider"></div>
        <div class="nb-cell">
          <span class="nb-label">航向</span>
          <span class="nb-value font-mono-num">{{ shipStore.info.heading }}°</span>
        </div>
        <div class="nb-divider"></div>
        <div class="nb-cell">
          <span class="nb-label">航速</span>
          <span class="nb-value font-mono-num">{{ shipStore.info.speed }} kn</span>
        </div>
        <div class="nb-divider"></div>
        <div class="nb-cell">
          <span class="nb-label">主机转速</span>
          <span class="nb-value font-mono-num highlight-rpm">{{ shipStore.info.mainRpm || '120' }} rpm</span>
        </div>
      </div>
    </section>

    <!-- ============ 右侧：检修操作微看板 ============ -->
    <section class="col col-right">
      <!-- 检修看板 -->
      <div class="industrial-card panel rp-panel">
        <div class="rp-header">
          <span class="rp-title"><span class="rp-title-bar"></span>检修看板</span>
        </div>

        <!-- 2×2 迷你统计（可点击跳转检修中心并筛选） -->
        <div class="mini-grid">
          <div class="mini-card mc-pending" @click="goRepairByStatus('pending')">
            <div class="mc-num font-mono-num">{{ scopedStats.pending }}</div>
            <div class="mc-lbl">待确认</div>
          </div>
          <div class="mini-card mc-temp" @click="goRepairByStatus('temp_handled')">
            <div class="mc-num font-mono-num">{{ scopedStats.temp_handled }}</div>
            <div class="mc-lbl">临时处理</div>
          </div>
          <div class="mini-card mc-processing" @click="goRepairByStatus('processing')">
            <div class="mc-num font-mono-num">{{ scopedStats.processing }}</div>
            <div class="mc-lbl">处理中</div>
          </div>
          <div class="mini-card mc-resolved" @click="goRepairByStatus('resolved')">
            <div class="mc-num font-mono-num">{{ scopedStats.resolved }}</div>
            <div class="mc-lbl">已完成</div>
          </div>
        </div>

        <!-- 最新事件 -->
        <div class="rp-header rp-header2">
          <span class="rp-title"><span class="rp-title-bar"></span>最新事件</span>
        </div>
        <div class="evt-list">
          <div
            v-for="e in scopedLatest"
            :key="e.id"
            class="evt-item"
            @click="goDetail(e.id)"
          >
            <span class="pri-bar" :class="'pri-' + e.priority"></span>
            <div class="ei-body">
              <div class="ei-title">{{ e.title }}</div>
              <div class="ei-meta">
                <span>{{ e.deviceName || '未知设备' }}</span>
                <span class="meta-dot">·</span>
                <span>{{ e.systemName }}</span>
                <span class="meta-dot">·</span>
                <span class="evt-status-tag" :class="'est-' + e.status">{{ eventStatusLabel(e.status) }}</span>
              </div>
            </div>
          </div>
          <div v-if="!scopedLatest.length" class="empty">暂无待处理事件</div>
        </div>
      </div>
    </section>
  </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, GaugeChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, LegendComponent } from 'echarts/components'
import { useShipStore } from '@/stores/shipStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { useRepairStore } from '@/stores/repairStore'
import StatusBadge from '@/components/StatusBadge.vue'
import shipBg from '@/assets/shipBg.js'

use([CanvasRenderer, LineChart, GaugeChart, GridComponent, TooltipComponent, MarkLineComponent, LegendComponent])

const router = useRouter()
const shipStore = useShipStore()
const deviceStore = useDeviceStore()
const repairStore = useRepairStore()

const emit = defineEmits(['report', 'assistant'])

// ---- 通知 Toast（弹出式）----
const toastDismissed = ref(false)
let toastTimer = null

const showNoticeToast = computed(() => shipStore.unreadCount > 0)

const latestUnreadEvent = computed(() => {
  const unread = shipStore.notificationList.filter(n => !n.read)
  return unread.find(n => n.kind === 'new' && n.eventId)
    || unread.find(n => n.eventId)
    || null
})

// 自动消失：8秒后收起
watch(showNoticeToast, (val) => {
  if (val) {
    toastDismissed.value = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastDismissed.value = true }, 8000)
  }
})

// ---- 导航 & 状态 ----
const ranges = [6, 12, 24]
const trendRange = ref(24)
// 船体浮动设备选中（多选，不选时=全部）
const selectedDevIds = ref(new Set())
// 浮动卡片ID → 真实设备ID映射
const FLOAT_DEV_MAP = { 'D01': 'DEV-001', 'D03': 'DEV-003', 'D06': 'DEV-006', 'D08': 'DEV-008' }

// 当前选中的真实设备ID列表（用于过滤左右数据）
const activeDeviceIds = computed(() => {
  if (selectedDevIds.value.size === 0) return null // null = 全部
  return [...selectedDevIds.value].map(id => FLOAT_DEV_MAP[id] || id).filter(Boolean)
})

const isSailing = computed(() => shipStore.info.navStatus === 'sailing')

// ---- 左侧监控态势 ----
import { SENSOR_PRESET_GROUPS } from '@/mock'

const sensorGroups = SENSOR_PRESET_GROUPS
const activeGroup = ref('all')
const selectedSensorIds = ref(new Set())
const currentPage = ref(0)
const swiperRef = ref(null)
let touchStartX = 0

// 当前分组下的传感器（异常前置排序 + 设备过滤联动）
const filteredSensors = computed(() => {
  let list = deviceStore.sensors
  // 按选中设备过滤
  if (activeDeviceIds.value) {
    list = list.filter(s => activeDeviceIds.value.includes(s.deviceId))
  }
  const g = sensorGroups.find(x => x.key === activeGroup.value)
  if (g?.sensorIds) {
    list = list.filter(s => g.sensorIds.includes(s.id))
  }
  // 异常前置排序：danger > warning > normal > offline
  const order = { danger: 0, warning: 1, offline: 2, normal: 3 }
  return [...list].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4))
})

// 分页：每页6张（2列×3行），触屏左右滑动
const PAGE_SIZE = 6
const sensorPages = computed(() => {
  const pages = []
  for (let i = 0; i < filteredSensors.value.length; i += PAGE_SIZE) {
    pages.push(filteredSensors.value.slice(i, i + PAGE_SIZE))
  }
  return pages.length ? pages : [[]]
})
const totalPages = computed(() => sensorPages.value.length)

function switchGroup(key) {
  activeGroup.value = key
  currentPage.value = 0
  // 重置选中：默认选第一个传感器单图
  selectedSensorIds.value.clear()
  if (filteredSensors.value.length > 0) {
    selectedSensorIds.value.add(filteredSensors.value[0].id)
  }
}

function isSelected(id) { return selectedSensorIds.value.has(id) }

function toggleSelect(id) {
  if (selectedSensorIds.value.has(id)) {
    // 如果只剩一个，不让取消（至少保留一个选中）
    if (selectedSensorIds.value.size <= 1) return
    selectedSensorIds.value.delete(id)
  } else {
    selectedSensorIds.value.add(id)
  }
}

// 触屏滑动分页
function onSwiperTouchStart(e) {
  touchStartX = e.touches[0].clientX
}
function onSwiperTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) < 40) return // 滑动距离太小忽略
  if (dx < 0 && currentPage.value < totalPages.value - 1) currentPage.value++
  if (dx > 0 && currentPage.value > 0) currentPage.value--
}

// 初始化默认选中第一个
watch(filteredSensors, (val) => {
  if (!selectedSensorIds.value.size && val.length > 0) {
    selectedSensorIds.value.add(val[0].id)
  }
}, { immediate: true })

function statusLabel(st) { return ({ normal: '正常', warning: '异常', danger: '故障', offline: '离线' })[st] || st }
function formatVal(v) { return Number(v).toFixed(v % 1 === 0 ? 0 : 1) }

// ---- 船舶信息表 ----
const shipInfoRows = computed(() => [[
  { label: '船名 / IMO号', value: `${shipStore.info.name} / ${shipStore.info.imo || 'IMO9827654'}` },
  { label: '船籍 / 建造时间', value: `${shipStore.info.flag || '中国深圳'} / ${shipStore.info.builtYear || '2019年'}` },
], [
  { label: '船长 / 型宽', value: `${shipStore.info.length || '89.5'}m / ${shipStore.info.beam || '15.2'}m` },
  { label: '总吨 / 载重吨', value: `${shipStore.info.grossTonnage || '3250'}t / ${shipStore.info.dwt || '4800'}t` },
], [
  { label: '主机型号', value: shipStore.info.mainEngineModel || 'WARTSILA 6L46' },
  { label: '主机功率', value: `${shipStore.info.mainEnginePower || '8800'} kW` },
]])

// ---- 设备位坐标（基于新船体图片的实际位置）----
const floatingDevices = computed(() => [
  {
    id: 'D01', name: '主机', x: 63, y: 60,
    status: deviceStore.devices.find(d => d.id === 'D01')?.status || 'normal',
    eventCount: eventBadge('D01'), eventLevel: priorityColorByStatus(deviceStore.devices.find(d=>d.id==='D01')?.status),
  },
  {
    id: 'D03', name: '锅炉', x: 70, y: 36,
    status: deviceStore.devices.find(d => d.id === 'D03')?.status || 'normal',
    eventCount: eventBadge('D03'), eventLevel: priorityColorByStatus(deviceStore.devices.find(d=>d.id==='D03')?.status),
  },
  {
    id: 'D06', name: '舵机', x: 91, y: 62,
    status: deviceStore.devices.find(d => d.id === 'D06')?.status || 'danger',
    eventCount: eventBadge('D06') || 1, eventLevel: '#FF4D4F',
  },
  {
    id: 'D08', name: '空压机', x: 35, y: 54,
    status: 'offline',
    eventCount: 0, eventLevel: '',
  },
])

// 健康度环图选项
const healthRingOption = computed(() => ({
  series: [{
    type: 'gauge',
    startAngle: 220,
    endAngle: -40,
    radius: '88%',
    center: ['50%', '55%'],
    min: 0, max: 100,
    splitNumber: 5,
    itemStyle: { color: healthColor.value },
    progress: { show: true, width: 7, roundCap: true },
    pointer: { show: false },
    axisLine: { lineStyle: { width: 7, color: [[1, '#1E2D45']] } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    title: { show: false },
    detail: {
      valueAnimation: true,
      fontSize: 16,
      fontWeight: 800,
      fontFamily: "'Consolas', monospace",
      color: healthColor.value,
      offsetCenter: [0, 2],
      formatter: '{value}%',
    },
    data: [{ value: shipStore.info.healthScore }],
  }],
}))

function onFloatDevClick(dev) {
  // 多选：点击切换选中/取消
  if (selectedDevIds.value.has(dev.id)) {
    selectedDevIds.value.delete(dev.id)
  } else {
    selectedDevIds.value.add(dev.id)
  }
  // 触发响应式更新
  selectedDevIds.value = new Set(selectedDevIds.value)
  // 通知 deviceStore 当前选中的设备（用于联动）
  const realIds = [...selectedDevIds.value].map(id => FLOAT_DEV_MAP[id]).filter(Boolean)
  deviceStore.selectDevice(realIds.length === 1 ? realIds[0] : null)
}

function clearDevSelection() {
  selectedDevIds.value = new Set()
  deviceStore.selectDevice(null)
}

function onFloatDevLongPress(dev) {
  // 长按/右键 → 跳转监控中心对应设备
  router.push({ path: '/monitor', query: { deviceId: dev.id } })
}

function priorityColorByStatus(st) {
  if (st === 'danger') return '#FF4D4F'
  if (st === 'warning') return '#FAAD14'
  return ''
}

// ---- 统计 ----
const stats = computed(() => repairStore.statusStats)
const healthColor = computed(() => {
  const s = shipStore.info.healthScore
  return s >= 85 ? '#52C41A' : s >= 70 ? '#FAAD14' : '#FF4D4F'
})

// ---- 事件统计（受设备选中过滤）----
const scopedStats = computed(() => {
  let events = repairStore.activeEvents
  if (activeDeviceIds.value) {
    events = events.filter(e => activeDeviceIds.value.includes(e.deviceId))
  }
  return {
    pending: events.filter(e => e.status === 'pending').length,
    processing: events.filter(e => e.status === 'processing').length,
    temp_handled: events.filter(e => e.status === 'temp_handled').length,
    resolved: events.filter(e => e.status === 'resolved').length,
  }
})

// ---- 事件列表 ----
const scopedLatest = computed(() => {
  let events = repairStore.latestActiveEvents
  // 按选中设备过滤
  if (activeDeviceIds.value) {
    events = events.filter(e => activeDeviceIds.value.includes(e.deviceId))
  }
  // 按时间倒序，取最新待处理事件
  return events.slice(0, 6)
})

function eventBadge(id) { return repairStore.eventCountByDevice(id) }
function devColor(status) { return ({ normal:'#52C41A', warning:'#FAAD14', danger:'#FF4D4F', offline:'#5A7A92' })[status] || '#5A7A92' }
function devBg(status) { return ({ normal:'rgba(82,196,26,0.08)', warning:'rgba(250,173,20,0.08)', danger:'rgba(255,77,79,0.12)', offline:'rgba(90,122,146,0.06)' })[status] || 'rgba(90,122,146,0.06)' }
function priorityColor(p) { return ({ high:'#FF4D4F', medium:'#FAAD14', low:'#1890FF' })[p] || '#1890FF' }
function eventStatusLabel(s) {
  return ({ pending:'待确认', processing:'处理中', temp_handled:'临时处理', resolved:'已解决', false_alarm:'误报' })[s] || s
}

function goDetail(id) { router.push({ path: '/repair', query: { eventId: id } }) }
function goRepairByStatus(status) { router.push({ path: '/repair', query: { statusFilter: status } }) }

function formatTime(t) {
  if (!t) return ''
  // "2025-06-15 09:30:34" -> "09:30"
  return t.slice(11, 16)
}

// ---- 多通道趋势图 ----
const CHART_COLORS = ['#1890FF', '#FAAD14', '#52C41A', '#FF4D4F', '#722ED1', '#13C2C2']

const multiTrendOption = computed(() => {
  const ids = Array.from(selectedSensorIds.value)
  const sensors = ids.map(id => deviceStore.sensors.find(s => s.id === id)).filter(Boolean)
  if (!sensors.length) return { backgroundColor: 'transparent' }

  // 用第一个传感器的数据生成时间轴
  const baseData = deviceStore.getTrendData(sensors[0].id, trendRange.value) || []
  const times = baseData.map(p => p.time)

  return {
    backgroundColor: 'transparent',
    grid: { left: 40, right: 16, top: 32, bottom: 36 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#152A47',
      borderColor: '#2A4566',
      textStyle: { color: '#E8F0FF', fontSize: 11 },
    },
    legend: {
      data: sensors.map(s => s.nameEn || s.nameCn),
      bottom: 2,
      textStyle: { color: '#7A9AB8', fontSize: 11 },
      itemWidth: 14, itemHeight: 3, icon: 'roundRect',
      itemGap: 16,
      pageTextStyle: { color: '#5A7A92' },
    },
    xAxis: {
      type: 'category', data: times,
      axisLine: { lineStyle: { color: '#1E3A5F' } },
      axisLabel: { color: '#4A6A8A', fontSize: 10, interval: Math.floor(times.length / 6) },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#152A47', type: 'dashed' } },
      axisLabel: { color: '#4A6A8A', fontSize: 10 },
    },
    series: sensors.map((s, i) => ({
      name: s.nameEn || s.nameCn,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: CHART_COLORS[i % CHART_COLORS.length] },
      // 模拟数据：基于传感器当前值 + 随机波动
      data: baseData.map((_, idx) => ({
        value: +(s.value * (0.95 + Math.sin(idx * 0.5 + i) * 0.08)).toFixed(1),
        symbol: idx === baseData.length - 1 ? 'circle' : 'none',
        symbolSize: 5,
      })),
      animationDuration: 800,
      animationEasing: 'cubicOut',
    })),
    animationDurationUpdate: 600,
  }
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ====== 通知 Toast（弹出式）====== */
.notice-toast {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  background: #fff;
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
  cursor: pointer;
  min-width: 360px;
  max-width: 560px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.notice-toast:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.18); }
.toast-icon { font-size: 22px; flex-shrink: 0; }
.toast-body { flex: 1; min-width: 0; }
.toast-title { font-size: 13px; color: #999; font-weight: 500; margin-bottom: 2px; }
.toast-msg { font-size: 14px; color: #222; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toast-action {
  font-size: 13px; color: #1890FF; font-weight: 700;
  white-space: nowrap; flex-shrink: 0;
}
.toast-close {
  background: none; border: none; font-size: 20px; color: #bbb;
  cursor: pointer; padding: 0 4px; line-height: 1; flex-shrink: 0;
  transition: color 0.15s;
}
.toast-close:hover { color: #666; }

/* 滑入滑出动画 */
.toast-slide-enter-active { transition: all 0.35s ease-out; }
.toast-slide-leave-active { transition: all 0.3s ease-in; }
.toast-slide-enter-from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
.toast-slide-leave-to { transform: translateX(-50%) translateY(-20px); opacity: 0; }

.home-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 14px;
  padding: 0 14px 14px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.col { display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow-y: auto; }
.col-center { overflow-y: hidden; }
.col-left { gap: 6px; }
.panel { display: flex; flex-direction: column; border-radius: 8px; background: #0D1B2E; border: 1px solid #162940; }

/* ====== 左侧：监控态势 ====== */
.monitor-title {
  display: flex; align-items: center; gap: 8px;
  padding: 0 4px 2px; flex-shrink: 0;
  flex-wrap: wrap;
}
.mt-bar {
  width: 3px; height: 16px; border-radius: 2px;
  background: #1890FF; flex-shrink: 0;
}
.mt-text { font-size: 15px; font-weight: 700; color: #E0ECF8; white-space: nowrap; flex-shrink: 0; }

.quick-tabs {
  display: flex; gap: 2px;
  background: #080f1a; border-radius: 5px; padding: 2px;
  flex-shrink: 0;
}
.quick-tabs button {
  padding: 4px 12px; border: none; background: transparent;
  color: #5A7A92; font-size: 11px; border-radius: 4px;
  cursor: pointer; white-space: nowrap; transition: all 0.15s;
}
.quick-tabs button.active { background: #1890FF; color: #fff; }
.quick-tabs button:hover:not(.active) { color: #8BAAC0; }

/* 设备过滤标签 */
.filter-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; color: #1890FF;
  background: rgba(24,144,255,0.1); border: 1px solid rgba(24,144,255,0.3);
  padding: 2px 7px 2px 6px; border-radius: 10px;
  white-space: nowrap; font-weight: 600;
  flex-shrink: 0;
}
.filter-tag.small { font-size: 9px; padding: 1px 6px 1px 5px; }
.filter-clear {
  background: none; border: none; color: #1890FF;
  cursor: pointer; font-size: 12px; line-height: 1; padding: 0 1px;
}
.filter-clear:hover { color: #FF4D4F; }

/* 传感器滑动区域 */
.sensor-swiper-wrap {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  touch-action: pan-y pinch-zoom;
  /* 关键：给容器固定高度，让 overflow:hidden 和分页生效 */
  height: 280px;
}
.sensor-grid {
  display: flex;
  height: 100%;
  transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.sensor-page {
  width: 100%;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(3, auto);
  gap: 8px;
  padding: 4px 2px;
  align-content: start;
}

/* 传感器卡片 */
.sensor-card {
  background: #0D1B2E; border: 1px solid #162940; border-radius: 8px;
  padding: 12px 14px; cursor: pointer;
  transition: all 0.18s ease; position: relative;
  user-select: none; -webkit-user-select: none;
  touch-action: manipulation;
}
.sensor-card:hover { border-color: #243B58; background: #0e1d32; }
.sensor-card.selected {
  border-color: #1890FF; background: rgba(24,144,255,0.06);
  box-shadow: 0 0 0 1px rgba(24,144,255,0.25), inset 0 0 20px rgba(24,144,255,0.04);
}
.sc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.sc-name { font-size: 11px; color: #7A9AB8; font-weight: 600; letter-spacing: 0.3px; }
.sc-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.sc-dot.normal { background: #52C41A; box-shadow: 0 0 4px rgba(82,196,26,0.4); }
.sc-dot.warning { background: #FAAD14; box-shadow: 0 0 4px rgba(250,173,20,0.4); }
.sc-dot.danger { background: #FF4D4F; box-shadow: 0 0 4px rgba(255,77,79,0.4); animation: sd-pulse 1.4s infinite; }
.sc-dot.offline { background: #5A7A92; }
@keyframes sd-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }

.sc-value { font-size: 28px; font-weight: 800; line-height: 1; letter-spacing: -0.5px; }
.sc-value.st-normal { color: #52C41A; }
.sc-value.st-warning { color: #FAAD14; }
.sc-value.st-danger { color: #FF4D4F; }
.sc-value.st-offline { color: #5A7A92; }

.sc-meta { font-size: 10px; color: #4A6A8A; margin-top: 4px; }

/* 分页指示器 */
.page-dots {
  display: flex; justify-content: center; gap: 6px;
  padding: 8px 0 4px;
}
.page-dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: #243B58; transition: all 0.2s;
}
.page-dots span.active { background: #1890FF; width: 16px; border-radius: 3px; }

/* 趋势图面板 */
.trend-panel { flex: 1; min-height: 180px; }
.trend-chart { flex: 1; min-height: 150px; }

/* ====== 中间：设备态势 + 船舶视图 ====== */
.device-status-card { flex-shrink: 0; }
.dsc-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px 10px; border-bottom: 1px solid #162940;
}
.dsc-body {
  display: flex; align-items: center; gap: 14px; padding: 12px 16px 14px;
}

/* 船名 */
.dsc-name {
  display: flex; flex-direction: column; gap: 2px;
  min-width: 110px; flex-shrink: 0;
}
.ship-cn { font-size: 15px; font-weight: 800; color: #E0ECF8; }
.ship-en { font-size: 11px; color: #5A7A92; letter-spacing: 0.5px; }

/* 四列信息网格 */
.dsc-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 16px; flex: 1; }
.dsc-info-item { display: flex; flex-direction: column; gap: 3px; }
.dsc-label { font-size: 10px; color: #4A6A8A; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.dsc-val { font-size: 13px; color: #E0ECF8; font-weight: 700; }
.dsc-val.online { color: #52C41A; font-weight: 700; }
.dsc-val small { font-size: 10px; color: #5A7A92; font-weight: 500; margin-left: 2px; }

/* 健康度环图容器 */
.dsc-health-ring { width: 72px; height: 72px; flex-shrink: 0; }

/* 立体船舶视图区域 */
.ship-view-wrap {
  position: relative;
  flex: 1; min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}
/* 船体图片容器 —— 透底无框 */
.ship-img-container {
  position: relative;
  width: 100%;
  max-width: 560px;
  height: auto;
  /* 透底：无背景无边框 */
  overflow: visible;
}
.ship-bg-img {
  width: 100%;
  height: auto;
  display: block;
  transition: opacity 0.3s ease;
}

/* ===== 扫描动效 ===== */
.scan-grid-overlay {
  position: absolute; inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent 49.5%, rgba(0,188,212,0.06) 50%, transparent 50.5%),
    linear-gradient(0deg, transparent 49.5%, rgba(0,188,212,0.06) 50%, transparent 50.5%);
  background-size: 40px 40px, 40px 40px;
  opacity: 0.35;
}
/* 扫描线容器 */
.scan-line-wrap {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: 8px;
}
/* 扫描线本体 - 从上往下扫 */
.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #00bcd4;
  box-shadow:
    0 0 6px #00bcd4,
    0 0 20px rgba(0,188,212,0.55),
    0 0 45px rgba(0,188,212,0.25);
  animation: scanSweep 3s ease-in-out infinite;
}
/* 扫描线下方渐变光尾 */
.scan-glow {
  position: absolute;
  left: 0; right: 0;
  top: 2px;
  height: 80px;
  background: linear-gradient(to bottom,
    rgba(0,188,212,0.18) 0%,
    rgba(0,188,212,0.08) 30%,
    transparent 100%
  );
  animation: scanGlowSweep 3s ease-in-out infinite;
}
@keyframes scanSweep {
  0%   { top: 0%; opacity: 1; }
  100% { top: 100%; opacity: 1; }
}
@keyframes scanGlowSweep {
  0%   { top: 2px; }
  100% { top: calc(100% - 78px); }
}

/* 浮动设备卡片 —— 融入船体风格 */
.float-dev-card {
  position: absolute;
  background: rgba(10,22,40,0.88);
  border: 1px solid rgba(0,188,212,0.35);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  transform: translate(-50%, -50%);
  box-shadow:
    0 2px 12px rgba(0,0,0,0.4),
    0 0 16px rgba(0,188,212,0.08);
  min-width: 72px;
  user-select: none;
  backdrop-filter: blur(6px);
}
.float-dev-card:hover {
  border-color: #00bcd4;
  box-shadow:
    0 4px 20px rgba(0,0,0,0.5),
    0 0 24px rgba(0,188,212,0.2);
  z-index: 20;
  transform: translate(-50%, -50%) scale(1.05);
}
.float-dev-card.selected {
  border-color: #00bcd4;
  box-shadow:
    0 0 0 2px rgba(0,188,212,0.3),
    0 4px 24px rgba(0,188,212,0.25);
  z-index: 21;
}

.fdc-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.fdc-name { font-size: 13px; font-weight: 700; color: #E0ECF8; white-space: nowrap; }
.fdc-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.fdc-dot.normal { background: #52C41A; box-shadow: 0 0 5px rgba(82,196,26,0.45); }
.fdc-dot.warning { background: #FAAD14; box-shadow: 0 0 5px rgba(250,173,20,0.45); }
.fdc-dot.danger { background: #FF4D4F; box-shadow: 0 0 5px rgba(255,77,79,0.45); animation: sd-pulse 1.4s infinite; }
.fdc-dot.offline { background: #5A7A92; }

.fdc-footer { }
.evt-count { font-size: 10px; font-weight: 600; white-space: nowrap; display: block; line-height: 1.3; }
.evt-count.high, .evt-count.danger { color: #FF4D4F; }
.evt-count.warning, .evt-count.medium { color: #FAAD14; }
.evt-count.ok { color: #52C41A; }

/* 选中态外圈 */
.fdc-select-ring {
  position: absolute; inset: -5px;
  border: 1.5px dashed #00bcd4;
  border-radius: 11px;
  pointer-events: none;
  animation: ringPulse 1.8s ease-in-out infinite;
}
@keyframes ringPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* 新底部工况栏 */
.status-bar.new-bar {
  display: flex; align-items: center; justify-content: space-around;
  padding: 10px 16px; flex-shrink: 0;
  background: linear-gradient(180deg, #080f1a 0%, #0c1420 100%);
  border-top: 1px solid #162940; border-radius: 0 0 8px 8px;
}
.nb-cell { display: flex; align-items: baseline; gap: 6px; }
.nb-label { font-size: 11px; color: #4A6A8A; font-weight: 500; }
.nb-value { font-size: 14px; color: #E0ECF8; font-weight: 700; }
.nb-value.highlight-rpm { color: #52C41A; }
.nb-divider { width: 1px; height: 22px; background: #1E3A5F; }

/* ====== 右侧：检修看板 ====== */
.rp-panel { display: flex; flex-direction: column; height: 100%; gap: 0; }
.rp-header { padding: 12px 14px 8px; flex-shrink: 0; }
.rp-header2 { padding: 10px 14px 6px; }
.rp-title { font-size: 14px; font-weight: 700; color: #E0ECF8; display: flex; align-items: center; gap: 7px; }
.rp-title-bar { width: 3px; height: 15px; background: #1890FF; border-radius: 2px; display: inline-block; }

/* 2×2 迷你统计网格 */
.mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 4px 14px 12px;
  flex-shrink: 0;
}
.mini-card {
  background: #0D1B2E;
  border-radius: 8px;
  padding: 14px 10px;
  text-align: center;
  border: 1px solid #162940;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.mini-card:hover { border-color: #2A4566; background: #111E30; }
.mc-num { font-size: 32px; font-weight: 800; line-height: 1.1; letter-spacing: -1px; }
.mc-lbl { font-size: 11px; color: #5A7A92; margin-top: 5px; font-weight: 500; }

/* 四色 */
.mc-pending { border-left: 3px solid #1890FF; }
.mc-pending .mc-num { color: #1890FF; }
.mc-processing { border-left: 3px solid #FAAD14; }
.mc-processing .mc-num { color: #FAAD14; }
.mc-temp { border-left: 3px solid #F5A623; }
.mc-temp .mc-num { color: #F5A623; }
.mc-resolved { border-left: 3px solid #52C41A; }
.mc-resolved .mc-num { color: #52C41A; }

/* 事件列表 */
.evt-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.evt-item {
  display: flex;
  align-items: stretch;
  gap: 10px;
  background: #080f1a;
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.evt-item:hover { border-color: #243B58; background: #0c1420; }

.pri-bar { width: 3.5px; border-radius: 2px; flex-shrink: 0; }
.pri-bar.pri-high { background: #FF4D4F; }
.pri-bar.pri-medium { background: #F5A623; }
.pri-bar.pri-low { background: #1890FF; }

.ei-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
.ei-title { font-size: 13px; font-weight: 600; color: #E0ECF8; line-height: 1.3; }
.ei-meta {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: #5A7A92;
  flex-wrap: wrap;
}
.meta-dot { color: #3A5A7A; font-size: 10px; }

/* 事件内联状态标签 */
.evt-status-tag {
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 3px;
}
.est-pending { background: rgba(24,144,255,0.15); color: #1890FF; }
.est-processing { background: rgba(250,173,20,0.15); color: #FAAD14; }
.est-temp_handled { background: rgba(245,166,35,0.15); color: #F5A623; }
.est-resolved { background: rgba(82,196,26,0.15); color: #52C41A; }

.empty { text-align: center; color: #4A6A8A; font-size: 13px; padding: 28px 0; }

/* 分段控制 */
.seg { display: flex; gap: 2px; background: #080f1a; border-radius: 5px; padding: 2px; }
.seg button { padding: 3px 10px; border: none; background: transparent; color: #4A6A8A; font-size: 11px; border-radius: 4px; cursor: pointer; }
.seg button.active { background: #1890FF; color: #fff; }
</style>
