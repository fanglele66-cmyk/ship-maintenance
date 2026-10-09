<template>
  <div class="event-center" :class="{ 'has-detail': eventStore.isDrawerOpen && eventStore.selectedEvent }" ref="eventCenterRef">
    <!-- Home: Event List -->
    <div
      v-if="!eventStore.isDrawerOpen"
      class="event-list-wrapper"
    >
      <EventList />
    </div>

    <button
      v-if="isCompactDetail"
      class="compact-assistant-float"
      :class="{ 'is-active': compactAssistantOpen, 'is-dragging': isCompactFloatDragging }"
      :style="compactFloatStyle"
      type="button"
      :title="compactAssistantOpen ? '关闭事件助手' : '打开事件助手'"
      :aria-label="compactAssistantOpen ? '关闭事件助手' : '打开事件助手'"
      @mousedown="startCompactFloatDrag"
      @touchstart="startCompactFloatDrag"
      @click.stop="toggleCompactAssistant"
    >
      <span v-if="compactAssistantOpen" class="compact-assistant-x" aria-hidden="true">✕</span>
      <img
        v-else
        class="compact-assistant-icon"
        src="/assistant-icons/knowledge-entry.svg"
        alt=""
        aria-hidden="true"
        draggable="false"
        @dragstart.prevent
      />
    </button>

    <!-- Center: Product Drawer (always in DOM for transition, width controlled by CSS) -->
    <div
      class="drawer-wrapper"
      :class="{
        'drawer-has-content': eventStore.isDrawerOpen && eventStore.selectedEvent
      }"
    >
      <transition name="drawer-slide" mode="out-in">
        <ProductDrawer
          v-if="eventStore.isDrawerOpen && eventStore.selectedEvent"
          :event="eventStore.selectedEvent"
          @back="eventStore.closeDrawer()"
        />
      </transition>
    </div>

    <div
      v-if="eventStore.isDrawerOpen && eventStore.selectedEvent && !isCompactDetail"
      class="event-assistant-resize-handle"
      :class="{ resizing: isResizingAssistant }"
      @pointerdown="startAssistantResize"
      @dblclick="resetAssistantWidth"
      role="separator"
      aria-orientation="vertical"
      aria-label="拖拽调整事件详情与事件助手宽度"
      title="拖拽调整宽度 · 双击重置"
    >
      <div class="event-assistant-resize-grip"></div>
    </div>

    <!-- Right: event detail assistant only -->
    <Transition name="compact-assistant-slide">
      <div
        v-if="eventStore.isDrawerOpen && eventStore.selectedEvent && (!isCompactDetail || compactAssistantOpen)"
        class="event-assistant-wrapper"
        :class="{ 'compact-assistant-overlay': isCompactDetail }"
        :style="assistantWidthStyle"
      >
        <AssistantPanel
          mode="event"
          :event-context="eventStore.selectedEvent"
          :fill-remaining="true"
          @chip-click="handleChipAction"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, reactive, provide, ref, onMounted, onUnmounted } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import EventList from './EventList.vue'
import ProductDrawer from './ProductDrawer.vue'
import AssistantPanel from '@/components/AssistantPanel.vue'

const eventStore = useEventStore()

const eventCenterRef = ref(null)
const isResizingAssistant = ref(false)
const customAssistantWidth = ref(null)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1366)
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1024)
const compactAssistantOpen = ref(false)
const compactFloatPos = ref(null)
const isCompactFloatDragging = ref(false)
const hasCustomCompactFloatPos = ref(false)
const COMPACT_FLOAT_SIZE = 46
const COMPACT_FLOAT_DRAG_THRESHOLD = 8
let compactFloatDragStartX = 0
let compactFloatDragStartY = 0
let compactFloatOffsetX = 0
let compactFloatOffsetY = 0
let compactFloatDidDrag = false

const ASSISTANT_WIDTH_STORAGE_KEY = 'event-assistant-width-v4'
const ASSISTANT_MIN_W = 320
const ASSISTANT_MAX_W = 760
const RESIZE_HANDLE_W = 12

function defaultAssistantWidth() {
  return 400
}

const isCompactDetail = computed(() => (
  Boolean(eventStore.isDrawerOpen && eventStore.selectedEvent) &&
  windowWidth.value <= 900 && windowHeight.value >= windowWidth.value
))

function minDrawerWidth() {
  if (windowWidth.value <= 760) return 280
  if (windowWidth.value <= 1024) return 360
  return 420
}

function clampAssistantWidth(width) {
  const containerW = eventCenterRef.value?.getBoundingClientRect().width || windowWidth.value
  const maxBySpace = Math.max(ASSISTANT_MIN_W, containerW - minDrawerWidth() - RESIZE_HANDLE_W)
  const maxW = Math.min(ASSISTANT_MAX_W, maxBySpace)
  const minW = Math.min(ASSISTANT_MIN_W, maxW)
  return Math.min(Math.max(width, minW), maxW)
}

const assistantWidth = computed(() => clampAssistantWidth(customAssistantWidth.value || defaultAssistantWidth()))

const assistantWidthStyle = computed(() => {
  if (isCompactDetail.value) {
    return { width: '400px', minWidth: '0', maxWidth: 'none', flex: 'none' }
  }
  const w = assistantWidth.value
  return {
    width: `${w}px`,
    minWidth: `${w}px`,
    maxWidth: `${w}px`,
    flex: 'none'
  }
})

const compactFloatStyle = computed(() => {
  const base = compactFloatPos.value || (windowWidth.value < 768
    ? { right: 20, bottom: 52 }
    : { right: 24, bottom: 80 })
  let { right, bottom } = base
  if (compactAssistantOpen.value) {
    const panelWidth = Math.min(400, Math.max(0, windowWidth.value - 24))
    const safeRight = panelWidth + 32
    if (!hasCustomCompactFloatPos.value || right < safeRight) right = safeRight
  }
  return { right: `${right}px`, bottom: `${bottom}px` }
})

function toggleCompactAssistant() {
  if (compactFloatDidDrag) {
    compactFloatDidDrag = false
    return
  }
  compactAssistantOpen.value = !compactAssistantOpen.value
}

function startCompactFloatDrag(event) {
  if (compactAssistantOpen.value) return
  isCompactFloatDragging.value = false
  compactFloatDidDrag = false
  const isTouch = event.type === 'touchstart'
  const point = isTouch ? event.touches[0] : event
  compactFloatDragStartX = point.clientX
  compactFloatDragStartY = point.clientY
  const rect = event.currentTarget.getBoundingClientRect()
  compactFloatOffsetX = point.clientX - rect.left
  compactFloatOffsetY = point.clientY - rect.top
  if (isTouch) {
    document.addEventListener('touchmove', moveCompactFloat, { passive: false })
    document.addEventListener('touchend', stopCompactFloatDrag)
  } else {
    document.addEventListener('mousemove', moveCompactFloat)
    document.addEventListener('mouseup', stopCompactFloatDrag)
  }
}

function moveCompactFloat(event) {
  const isTouch = event.type === 'touchmove'
  const point = isTouch ? event.touches[0] : event
  const dx = point.clientX - compactFloatDragStartX
  const dy = point.clientY - compactFloatDragStartY
  if (!compactFloatDidDrag && (Math.abs(dx) > COMPACT_FLOAT_DRAG_THRESHOLD || Math.abs(dy) > COMPACT_FLOAT_DRAG_THRESHOLD)) {
    compactFloatDidDrag = true
    isCompactFloatDragging.value = true
  }
  if (!compactFloatDidDrag) return
  event.preventDefault()
  compactFloatPos.value = {
    right: Math.max(8, window.innerWidth - (point.clientX - compactFloatOffsetX + COMPACT_FLOAT_SIZE)),
    bottom: Math.max(8, window.innerHeight - (point.clientY - compactFloatOffsetY + COMPACT_FLOAT_SIZE))
  }
}

function stopCompactFloatDrag() {
  isCompactFloatDragging.value = false
  if (compactFloatDidDrag && compactFloatPos.value) hasCustomCompactFloatPos.value = true
  document.removeEventListener('mousemove', moveCompactFloat)
  document.removeEventListener('mouseup', stopCompactFloatDrag)
  document.removeEventListener('touchmove', moveCompactFloat)
  document.removeEventListener('touchend', stopCompactFloatDrag)
}

// ============ 共享状态（兄弟组件 ProductDrawer & AssistantPanel 都从这里 inject）============
const eventUnread = eventStore.eventUnread
const eventStage = eventStore.workflowStages
eventStore.events.forEach(event => {
  if (event.status === 'resolved' && !eventStage[event.id]) eventStage[event.id] = 'S5'
})
const eventAssistantAction = eventStore.workflowAssistantActions
const eventAssistantCommand = reactive({})
const eventSituationTabs = eventStore.workflowSituationTabs // { [eventId]: { unlocked: {summary,data,workload}, active: string, section: string } }
const totalUnread = computed(() => Object.values(eventUnread).reduce((a, b) => a + b, 0))

provide('eventUnread', eventUnread)
provide('totalUnread', totalUnread)
provide('eventStage', eventStage)
provide('eventAssistantAction', eventAssistantAction)
provide('eventAssistantCommand', eventAssistantCommand)
provide('eventSituationTabs', eventSituationTabs)

// 初始化未读计数：有 AI 分析的事件 = 2 条未读
eventStore.events.forEach(ev => {
  if (ev.aiAnalysis?.summary && ev.status !== 'resolved') {
    eventStore.eventUnread[ev.id] = 2
  }
})

function startAssistantResize(e) {
  if (!eventStore.isDrawerOpen || !eventStore.selectedEvent) return
  e.preventDefault()
  e.stopPropagation()

  const startX = e.clientX
  const startW = assistantWidth.value
  isResizingAssistant.value = true

  const onPointerMove = (ev) => {
    ev.preventDefault()
    const dx = startX - ev.clientX
    customAssistantWidth.value = clampAssistantWidth(startW + dx)
  }

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    isResizingAssistant.value = false
    try { localStorage.setItem(ASSISTANT_WIDTH_STORAGE_KEY, String(assistantWidth.value)) } catch (_) {}
  }

  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointercancel', onPointerUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resetAssistantWidth() {
  customAssistantWidth.value = null
  try { localStorage.removeItem(ASSISTANT_WIDTH_STORAGE_KEY) } catch (_) {}
}

function onWindowResize() {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
  if (customAssistantWidth.value !== null) {
    customAssistantWidth.value = clampAssistantWidth(customAssistantWidth.value)
  }
}

onMounted(() => {
  try {
    const saved = parseInt(localStorage.getItem(ASSISTANT_WIDTH_STORAGE_KEY), 10)
    if (!Number.isNaN(saved)) customAssistantWidth.value = clampAssistantWidth(saved)
  } catch (_) {}
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  stopCompactFloatDrag()
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

function handleChipAction(action) {
  const sessionKey = eventStore.selectedEvent?.id || 'general'
  let text = ''
  switch (action) {
    case 'view_causes': text = '查看可能的原因'; break
    case 'start_check': text = '开始排查'; break
    case 'create_order': text = '创建工单'; break
    default: text = action
  }
  eventStore.addMessage(sessionKey, { role: 'user', content: text })
  setTimeout(() => {
    let response = ''
    if (action === 'view_causes' && eventStore.selectedEvent?.aiAnalysis?.faultTable) {
      const table = eventStore.selectedEvent.aiAnalysis.faultTable
      let html = '<div style="font-size:var(--font-md);line-height:1.7">根据AI诊断，可能原因如下：<br><br>'
      table.forEach((f, i) => {
        const probColor = f.probability === 'high' ? 'var(--danger)' : f.probability === 'medium' ? 'var(--warning)' : 'var(--text-muted)'
        html += `<b>${i + 1}. ${f.name}</b> <span style="color:${probColor}">[${f.probability === 'high' ? '高概率' : f.probability === 'medium' ? '中概率' : '低概率'}]</span><br>`
        html += `<span style="color:var(--text-muted);font-size:var(--font-base)">${f.detail}</span><br><br>`
      })
      response = html + '</div>'
    } else if (action === 'start_check') {
      response = `<div class="action-card"><div class="action-title">排查步骤建议</div><div class="action-desc">根据AI分析，建议按以下顺序排查：</div>
        <div style="font-size:var(--font-base);line-height:1.7;color:var(--text-muted);margin:6px 0">1️⃣ 检查相关设备运行参数<br>2️⃣ 对比历史数据判断趋势<br>3️⃣ 按照SOP执行排查步骤<br>4️⃣ 记录排查结果</div>
        <div class="action-buttons"><button class="btn-primary">开始排查</button><button class="btn-ghost">查看SOP</button></div></div>`
    } else if (action === 'create_order') {
      response = `<div class="action-card"><div class="action-title">创建工单确认</div><div class="action-desc">系统将根据当前事件数据自动生成维修工单。</div>
        <div class="action-buttons"><button class="btn-primary">确认创建</button><button class="btn-danger">标记误报</button></div></div>`
    } else {
      response = '已收到请求，正在处理...'
    }
    eventStore.addMessage(sessionKey, { role: 'assistant', content: response })
  }, 500)
}
</script>

<style scoped>
.event-center { flex: 1; display: flex; height: 100%; min-height: 0; overflow: hidden; }
.event-center.has-detail {
  padding: 12px;
  background: #F5F7FA;
}
.event-list-wrapper {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  transition: opacity 0.16s ease;
  overflow: hidden;
}
.event-list-wrapper.collapsed { flex: 0 0 0; width: 0; min-width: 0; opacity: 0; border-right: none; }

/* 中间产物区：有内容时 flex:1 占空间，无内容时收缩到 0（助手区 fill 填充剩余） */
.drawer-wrapper {
  width: 0;
  min-width: 0;
  min-height: 0;
  flex-shrink: 0;
  overflow: hidden;
  transition: opacity 0.16s ease;
}
.drawer-wrapper.drawer-has-content {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 8px;
  background: #FFFFFF;
}

.event-assistant-resize-handle {
  width: 12px;
  flex: none;
  cursor: col-resize;
  position: relative;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  touch-action: none;
}
.event-assistant-resize-handle::before {
  content: none;
}
.event-assistant-resize-handle:hover,
.event-assistant-resize-handle.resizing {
  background: transparent;
}
.event-assistant-resize-grip {
  width: 4px;
  height: 104px;
  border-radius: 999px;
  background: #D3D5DD;
  opacity: 0;
  transform: scaleY(0.82);
  transition: opacity 0.16s ease, transform 0.16s ease;
  pointer-events: none;
}
.event-assistant-resize-handle:hover .event-assistant-resize-grip,
.event-assistant-resize-handle.resizing .event-assistant-resize-grip {
  opacity: 1;
  transform: scaleY(1);
}

.event-assistant-wrapper {
  flex: none;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #FFFFFF;
}
.event-assistant-wrapper :deep(.assistant-panel) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  flex: 1 1 auto !important;
  border-left: none;
}

@media (max-width: 900px) and (orientation: portrait) {
  .event-center.has-detail {
    position: relative;
    padding: 12px;
  }
  .compact-assistant-float {
    position: fixed;
    z-index: 1002;
    width: 46px;
    height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #106BFF;
    box-shadow: 0 4px 16px rgba(22, 119, 255, 0.35);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    touch-action: none;
  }
  .compact-assistant-float:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 24px rgba(22, 119, 255, 0.5);
  }
  .compact-assistant-float:active { transform: scale(0.95); }
  .compact-assistant-float.is-active { box-shadow: 0 4px 20px rgba(22, 119, 255, 0.55); }
  .compact-assistant-float.is-dragging {
    cursor: grabbing;
    transform: scale(1.04) !important;
    transition: none !important;
    box-shadow: 0 8px 28px rgba(16, 107, 255, 0.5);
  }
  .compact-assistant-icon {
    display: block;
    width: 24px;
    height: 24px;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
  }
  .compact-assistant-x {
    font-size: 17px;
    color: #fff;
    font-weight: 600;
    line-height: 1;
  }
  .drawer-wrapper.drawer-has-content {
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    flex: 1 1 auto !important;
  }
  .event-assistant-wrapper.compact-assistant-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 90;
    width: min(400px, calc(100% - 24px)) !important;
    height: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    border-radius: 8px;
    box-shadow: -6px 0 24px rgba(25, 33, 61, 0.16);
  }
  .compact-assistant-slide-enter-active,
  .compact-assistant-slide-leave-active { transition: transform 0.22s ease, opacity 0.18s ease; }
  .compact-assistant-slide-enter-from,
  .compact-assistant-slide-leave-to { opacity: 0; transform: translateX(24px); }
}

.drawer-slide-enter-active, .drawer-slide-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.drawer-slide-enter-from { opacity: 0; transform: translateX(-30px); }
.drawer-slide-leave-to { opacity: 0; transform: translateX(-30px); }

</style>
