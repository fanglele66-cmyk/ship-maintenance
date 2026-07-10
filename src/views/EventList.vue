<template>
  <div class="event-list" ref="listRef">
    <!-- Header: search/filter only -->
    <div class="el-header">
      <div class="el-row">
        <div class="el-search">
          <span class="el-search-icon" aria-hidden="true">⌕</span>
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            class="el-search-input"
            type="text"
            placeholder="搜索事件 / 设备 / 状态"
            @keydown.esc="searchKeyword = ''"
          />
          <button
            v-if="searchKeyword"
            class="el-search-clear"
            title="清空"
            @click="searchKeyword = ''"
          >×</button>
        </div>
        <button
          class="adv-btn"
          :class="{ active: advOpen || hasAnyFilter }"
          @click="toggleAdv"
          :title="hasAnyFilter ? `高级筛选 · 已选 ${activeFilterCount} 项` : '高级筛选'"
        >
          <span class="adv-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </span>
          <span v-if="activeFilterCount > 0" class="adv-dot"></span>
        </button>
      </div>

      <!-- Active filter chips (only when at least one filter is set) -->
      <div v-if="hasAnyFilter" class="chip-row">
        <span
          v-for="p in activePriorities"
          :key="'p-' + p"
          class="chip"
          :class="'pri-' + p"
        >
          {{ priorityLabels[p] }}
          <button class="chip-x" @click="togglePriority(p)">×</button>
        </span>
        <span
          v-for="s in activeStatuses"
          :key="'s-' + s"
          class="chip"
          :class="'st-' + s"
        >
          {{ statusLabels[s] }}
          <button class="chip-x" @click="toggleStatus(s)">×</button>
        </span>
        <span
          v-for="sys in activeSystems"
          :key="'sys-' + sys"
          class="chip chip-sys"
        >
          {{ sys }}
          <button class="chip-x" @click="toggleSystem(sys)">×</button>
        </span>
        <button class="chip-clear-all" @click="clearAdvancedFilters" title="清空所有筛选">
          清空
        </button>
      </div>

      <!-- Advanced filter panel -->
      <div
        v-if="advOpen"
        class="adv-panel"
        ref="advPanelRef"
        @mousedown.stop
      >
        <div class="adv-section">
          <div class="adv-section-title">严重程度（多选）</div>
          <div class="adv-options">
            <button
              v-for="p in priorityOptions"
              :key="p"
              class="opt-pill"
              :class="['pri-' + p, { on: localAdv.priorities.includes(p) }]"
              @click="togglePriority(p)"
            >
              {{ priorityLabels[p] }}
            </button>
          </div>
        </div>

        <div class="adv-section">
          <div class="adv-section-title">状态（多选）</div>
          <div class="adv-options">
            <button
              v-for="s in statusOptions"
              :key="s"
              class="opt-pill"
              :class="['st-' + s, { on: localAdv.statuses.includes(s) }]"
              @click="toggleStatus(s)"
            >
              {{ statusLabels[s] }}
            </button>
          </div>
        </div>

        <div class="adv-section">
          <div class="adv-section-title">设备 / 系统（多选）</div>
          <div class="adv-options adv-options-wrap">
            <button
              v-for="sys in systemOptions"
              :key="sys"
              class="opt-pill sys-pill"
              :class="{ on: localAdv.systems.includes(sys) }"
              @click="toggleSystem(sys)"
            >
              {{ sys }}
            </button>
            <span v-if="systemOptions.length === 0" class="opt-empty">暂无可选项</span>
          </div>
        </div>

        <div class="adv-footer">
          <button class="adv-clear" @click="clearAdvancedFilters">清空</button>
          <button class="adv-close" @click="advOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- Event inbox -->
    <div class="el-items" ref="itemsRef">
      <button
        v-if="priorityEvent"
        class="priority-card"
        :class="priorityTone(priorityEvent)"
        @click="handleEventClick(priorityEvent)"
      >
        <div class="priority-card-top">
          <span class="priority-card-kicker">优先处理</span>
          <span
            v-if="unreadById(priorityEvent.id) > 0"
            class="unread-badge priority-unread"
          >
            {{ unreadById(priorityEvent.id) > 99 ? '99+' : unreadById(priorityEvent.id) }}
          </span>
        </div>
        <span class="priority-card-title" v-html="highlightMatch(priorityEvent.title)"></span>
        <span class="priority-card-desc" v-html="highlightMatch(eventPreview(priorityEvent))"></span>
        <span class="priority-card-meta">
          <span>{{ priorityEvent.system || '未分组设备' }}</span>
          <span>{{ statusLabels[priorityEvent.status] }}</span>
          <span class="priority-card-time">{{ formatMessageTime(latestEventTime(priorityEvent)) }}</span>
        </span>
      </button>

      <div class="inbox-section-head">
        <span>事件 inbox</span>
        <span>{{ displayEvents.length }} 件</span>
      </div>

      <div
        v-for="(event, idx) in displayEvents"
        :key="event.id"
        class="event-card"
        :class="{
          selected: eventStore.selectedEventId === event.id,
          'drag-over-top': dragState.overId === event.id && dragState.overPos === 'top',
          'drag-over-bottom': dragState.overId === event.id && dragState.overPos === 'bottom',
          dragging: dragState.activeId === event.id,
          swiping: swipeState.activeId === event.id,
          'pin-ready': swipeState.activeId === event.id && swipeState.ready
        }"
        :style="swipeCardStyle(event.id)"
        :data-id="event.id"
        @pointerdown="onPointerDown($event, event, idx)"
        @click="handleEventClick(event)"
      >
        <span class="pin-action" aria-hidden="true">置顶</span>
        <span class="drag-handle" title="长按或拖拽排序">⠿</span>
        <span class="priority-rail" :class="priorityTone(event)"></span>
        <div class="event-main">
          <div class="card-topline">
            <div class="card-title text-overflow" v-html="highlightMatch(event.title)"></div>
            <span class="card-time">{{ formatMessageTime(latestEventTime(event)) }}</span>
          </div>
          <div class="card-preview text-overflow" v-html="highlightMatch(eventPreview(event))"></div>
          <div class="card-meta-row">
            <span class="system-tag">{{ event.system || '未分组设备' }}</span>
            <span class="status-chip" :class="'st-' + event.status">{{ statusLabels[event.status] }}</span>
          </div>
        </div>
        <div class="event-tail">
          <span
            v-if="unreadById(event.id) > 0"
            class="unread-badge"
            :class="{ 'unread-badge-pulse': recentlyBumped[event.id] }"
            :title="`${unreadById(event.id)} 条未读消息`"
          >
            {{ unreadById(event.id) > 99 ? '99+' : unreadById(event.id) }}
          </span>
          <span class="open-indicator">›</span>
        </div>
      </div>

      <div v-if="displayEvents.length === 0" class="empty-state">
        {{ emptyMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onUnmounted, watch, reactive, inject } from 'vue'
  import { useEventStore } from '@/stores/eventStore'

  const eventStore = useEventStore()
  const listRef = ref(null)
  const itemsRef = ref(null)
  const searchInputRef = ref(null)
  const advPanelRef = ref(null)

  const priorityLabels = {
    critical: '紧急',
    normal: '一般'
  }

  // ---- Inject unread counter from AssistantPanel ----
  const eventUnread = inject('eventUnread', reactive({}))
  function unreadById(id) {
    return eventUnread[id] || 0
  }
  // 视觉：刚 +1 时闪一下
  const recentlyBumped = reactive({})
  let lastUnreadSnapshot = {}
  watch(eventUnread, (curr) => {
    for (const k of Object.keys(curr)) {
      const prev = lastUnreadSnapshot[k] || 0
      if (curr[k] > prev) {
        recentlyBumped[k] = true
        setTimeout(() => { recentlyBumped[k] = false; delete recentlyBumped[k] }, 1200)
      }
    }
    lastUnreadSnapshot = { ...curr }
  }, { deep: true })

// ---- Status labels (zh) ----
const statusLabels = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决'
}

// ---- Search ----
const searchKeyword = ref('')

// ---- Advanced filter state (in-memory only, not persisted) ----
const advOpen = ref(false)
const localAdv = reactive({
  priorities: [],  // critical | normal (important is shown as normal on home)
  statuses: [],    // pending | processing | resolved
  systems: []      // dynamic, from events
})

// Available options
const priorityOptions = ['critical', 'normal']
const statusOptions = ['pending', 'processing', 'resolved']

// Dynamic systems list — derived from current events, sorted by frequency desc
const systemOptions = computed(() => {
  const counts = new Map()
  for (const e of eventStore.events) {
    if (e.system) counts.set(e.system, (counts.get(e.system) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sys]) => sys)
})

// ---- Toggle helpers ----
function togglePriority(p) {
  const i = localAdv.priorities.indexOf(p)
  if (i === -1) localAdv.priorities.push(p)
  else localAdv.priorities.splice(i, 1)
}
function toggleStatus(s) {
  const i = localAdv.statuses.indexOf(s)
  if (i === -1) localAdv.statuses.push(s)
  else localAdv.statuses.splice(i, 1)
}
function toggleSystem(sys) {
  const i = localAdv.systems.indexOf(sys)
  if (i === -1) localAdv.systems.push(sys)
  else localAdv.systems.splice(i, 1)
}
function clearAdvancedFilters() {
  localAdv.priorities = []
  localAdv.statuses = []
  localAdv.systems = []
}

// Active filter projection for chip row (only the actually-selected ones,
// regardless of which section they came from)
const activePriorities = computed(() => [...localAdv.priorities])
const activeStatuses = computed(() => [...localAdv.statuses])
const activeSystems = computed(() => [...localAdv.systems])

const activeFilterCount = computed(() =>
  localAdv.priorities.length + localAdv.statuses.length + localAdv.systems.length
)
const hasAnyFilter = computed(() => activeFilterCount.value > 0)

function toggleAdv() {
  advOpen.value = !advOpen.value
}

// Click-outside & Esc to close panel
function onWindowMouseDown(e) {
  if (!advOpen.value) return
  const panel = advPanelRef.value
  if (panel && !panel.contains(e.target)) {
    // Click on the trigger button itself is handled by @click on the button
    if (e.target.closest('.adv-btn')) return
    advOpen.value = false
  }
}
function onWindowKeyDown(e) {
  if (advOpen.value && e.key === 'Escape') {
    advOpen.value = false
  }
}
window.addEventListener('mousedown', onWindowMouseDown)
window.addEventListener('keydown', onWindowKeyDown)

// ---- Pointer-based drag state (works on mouse + touch + pen) ----
const dragState = reactive({
  active: false,
  activeId: null,
  overId: null,
  overPos: 'bottom',
  startY: 0,
  startX: 0,
  longPressTimer: null,
  moved: false,
  pointerId: null,
  workingList: null
})

const swipeState = reactive({
  activeId: null,
  offsetX: 0,
  ready: false,
  locked: false
})

const LONG_PRESS_MS = 220
const MOVE_THRESHOLD = 6
const SWIPE_START_THRESHOLD = 12
const SWIPE_PIN_THRESHOLD = 96
const SWIPE_MAX_OFFSET = 128

// localStorage key for user-customized order (per filter)
const ORDER_STORAGE_KEY = 'ship-event-list-order-v1'

// ---- Helpers ----
function formatMessageTime(time) {
  if (!time) return ''
  const d = new Date(time)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((today - target) / 86400000)

  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const ymd = `${d.getFullYear()}-${md}`

  if (diffDays === 0) return hm
  if (diffDays === 1) return '昨天'
  if (now.getFullYear() === d.getFullYear()) return `${md} ${hm}`
  return `${ymd} ${hm}`
}

function priorityTone(event) {
  if (event.status === 'resolved') return 'resolved'
  return event.priority === 'critical' ? 'critical' : 'normal'
}

function latestEventTime(event) {
  const lastTimeline = event.timeline?.[event.timeline.length - 1]?.time
  return lastTimeline || event.createdAt
}

function eventPreview(event) {
  const messages = eventStore.getSessionMessages(event.id)
  const lastMessage = messages?.[messages.length - 1]
  if (lastMessage?.content) {
    return stripHtml(lastMessage.content)
  }
  const lastTimeline = event.timeline?.[event.timeline.length - 1]?.action
  return lastTimeline || event.aiAnalysis?.summary || '暂无最新进度'
}

function stripHtml(text) {
  return String(text).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// ---- Fuzzy search ----
function eventToSearchableText(event) {
  const parts = [
    event.id,
    event.title,
    event.system,
    event.priority,
    event.status,
    event.source,
    event.aiAnalysis?.summary,
    event.aiAnalysis?.suggestions,
    ...(event.relatedCases || []).map(c => c.title)
  ]
  return parts.filter(Boolean).join(' \u0001 ')
}

function matchesSearch(event, keyword) {
  if (!keyword) return true
  const haystack = eventToSearchableText(event).toLowerCase()
  const needle = keyword.toLowerCase().trim()
  if (!needle) return true
  return needle.split(/\s+/).every(token => haystack.includes(token))
}

function highlightMatch(text) {
  if (!searchKeyword.value || !text) return text
  const tokens = searchKeyword.value.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return text
  const pattern = new RegExp(
    '(' + tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi'
  )
  return String(text).replace(pattern, '<mark class="search-hl">$1</mark>')
}

// ---- Display pipeline: persisted order (per filter) -> search -> advanced filters ----
function loadPersistedOrder(filterKey) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.[filterKey] || null
  } catch {
    return null
  }
}

function savePersistedOrder(filterKey, orderedIds) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[filterKey] = orderedIds
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

function pinEventToTop(eventId) {
  const base = [...eventStore.events]
  const idx = base.findIndex(e => e.id === eventId)
  if (idx <= 0) return
  const [target] = base.splice(idx, 1)
  base.unshift(target)
  const orderedIds = base.map(e => e.id)
  savePersistedOrder('all', orderedIds)
  eventStore.reorderEvents(orderedIds)
}

function swipeCardStyle(eventId) {
  if (swipeState.activeId !== eventId) return null
  return { transform: `translateX(${swipeState.offsetX}px)` }
}

const displayEvents = computed(() => {
  // While dragging, render the in-memory working list verbatim
  if (dragState.active && dragState.workingList) {
    return dragState.workingList.filter(e => matchesSearch(e, searchKeyword.value))
      .filter(e => passesAdvanced(e))
  }

  // 1. Reorder the underlying events by persisted order.
  const orderKey = 'all'
  const persistedOrder = loadPersistedOrder(orderKey)
  let base = [...eventStore.events]
  if (persistedOrder && persistedOrder.length) {
    const map = new Map(eventStore.events.map(e => [e.id, e]))
    const ordered = []
    persistedOrder.forEach(id => { if (map.has(id)) { ordered.push(map.get(id)); map.delete(id) } })
    ordered.push(...map.values())
    base = ordered
  }
  let result = base.filter(e => matchesSearch(e, searchKeyword.value))
  result = result.filter(e => passesAdvanced(e))
  return result
})

const priorityEvent = computed(() => {
  const candidates = displayEvents.value.filter(e => e.status !== 'resolved')
  return candidates
    .slice()
    .sort((a, b) => {
      const pa = a.priority === 'critical' ? 0 : 1
      const pb = b.priority === 'critical' ? 0 : 1
      if (pa !== pb) return pa - pb
      const ua = unreadById(a.id)
      const ub = unreadById(b.id)
      if (ua !== ub) return ub - ua
      return new Date(latestEventTime(b)).getTime() - new Date(latestEventTime(a)).getTime()
    })[0] || null
})

// Advanced-filter predicate (in-memory, not stored)
function passesAdvanced(event) {
  if (localAdv.priorities.length && !localAdv.priorities.includes(priorityTone(event))) return false
  if (localAdv.statuses.length && !localAdv.statuses.includes(event.status)) return false
  if (localAdv.systems.length && !localAdv.systems.includes(event.system)) return false
  return true
}

const emptyMessage = computed(() => {
  if (searchKeyword.value) return '没有匹配的事件'
  if (hasAnyFilter.value) return '没有符合筛选条件的事件'
  return '暂无事件'
})

// Keep persisted order in sync when the source events list changes
watch(() => eventStore.events.map(e => `${e.id}:${e.status}`).join('|'), () => {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    const validIds = new Set(eventStore.events.map(e => e.id))
    let changed = false
    for (const k of Object.keys(parsed)) {
      const before = parsed[k].length
      parsed[k] = parsed[k].filter(id => validIds.has(id))
      if (parsed[k].length !== before) changed = true
    }
    if (changed) localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(parsed))
  } catch { /* ignore */ }
})

// ---- Click ----
function handleEventClick(event) {
  if (dragState.moved || swipeState.locked) return
  eventStore.selectEvent(event.id)
}

// ---- Pointer-based drag & drop (mouse + touch + pen) ----
function clearLongPressTimer() {
  if (dragState.longPressTimer) {
    clearTimeout(dragState.longPressTimer)
    dragState.longPressTimer = null
  }
}

function onPointerDown(e, event, idx) {
  if (e.button !== undefined && e.button !== 0) return
  // Don't start a drag when interacting with form controls inside the card
  if (e.target.closest('input, button')) return
  dragState.pointerId = e.pointerId
  dragState.startY = e.clientY
  dragState.startX = e.clientX
  dragState.moved = false
  dragState.activeId = event.id
  dragState.workingList = displayEvents.value.slice()
  swipeState.activeId = null
  swipeState.offsetX = 0
  swipeState.ready = false
  swipeState.locked = false

  clearLongPressTimer()
  dragState.longPressTimer = setTimeout(() => {
    beginDrag(event, e.pointerId)
  }, LONG_PRESS_MS)

  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp, { passive: false })
  window.addEventListener('pointercancel', onPointerCancel, { passive: false })
  window.addEventListener('keydown', onDragKeyDown)
}

function beginDrag(event, pointerId) {
  dragState.active = true
  dragState.activeId = event.id
  document.body.style.userSelect = 'none'
  try {
    if (pointerId !== undefined && listRef.value?.setPointerCapture) {
      listRef.value.setPointerCapture(pointerId)
    }
  } catch { /* not all browsers */ }
}

function onPointerMove(e) {
  if (dragState.pointerId !== null && e.pointerId !== dragState.pointerId) return
  const dx = e.clientX - dragState.startX
  const dy = e.clientY - dragState.startY

  if (!dragState.active && dx > SWIPE_START_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.4) {
    clearLongPressTimer()
    swipeState.activeId = dragState.activeId
    swipeState.offsetX = Math.min(dx, SWIPE_MAX_OFFSET)
    swipeState.ready = dx >= SWIPE_PIN_THRESHOLD
    swipeState.locked = true
    dragState.moved = true
    e.preventDefault()
    return
  }

  if (swipeState.activeId) {
    swipeState.offsetX = Math.max(0, Math.min(dx, SWIPE_MAX_OFFSET))
    swipeState.ready = dx >= SWIPE_PIN_THRESHOLD
    dragState.moved = true
    e.preventDefault()
    return
  }

  if (!dragState.active) {
    if (Math.abs(dy) < MOVE_THRESHOLD) return
    beginDrag({ id: dragState.activeId }, e.pointerId)
  }
  e.preventDefault()
  dragState.moved = true
  updateDropTarget(e.clientY)
}

function updateDropTarget(clientY) {
  const cards = itemsRef.value?.querySelectorAll('.event-card')
  if (!cards) return
  let bestMatch = null
  for (const card of cards) {
    if (card.classList.contains('dragging')) continue
    const rect = card.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      const mid = (rect.top + rect.bottom) / 2
      bestMatch = { id: card.dataset.id, pos: clientY < mid ? 'top' : 'bottom' }
      break
    }
  }
  if (bestMatch) {
    dragState.overId = bestMatch.id
    dragState.overPos = bestMatch.pos
  } else {
    dragState.overId = null
  }
}

function onPointerUp(e) {
  if (dragState.pointerId !== null && e.pointerId !== dragState.pointerId) return

  if (swipeState.activeId) {
    finishSwipe()
    return
  }
  finishDrag(true)
}

function onPointerCancel() {
  if (swipeState.activeId) {
    finishSwipe()
    return
  }
  finishDrag(false)
}

function onDragKeyDown(e) {
  if (e.key === 'Escape' && dragState.active) {
    if (swipeState.activeId) {
      finishSwipe()
      return
    }
    finishDrag(false)
  }
}

function finishSwipe() {
  const eventId = swipeState.activeId

  if (swipeState.ready && eventId) {
    pinEventToTop(eventId)
  }

  swipeState.offsetX = 0
  swipeState.activeId = null
  swipeState.ready = false
  swipeState.locked = false

  // Clean up drag-like listeners
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onDragKeyDown)
  clearLongPressTimer()
  document.body.style.userSelect = ''

  dragState.active = false
  dragState.activeId = null
  dragState.overId = null
  dragState.overPos = 'bottom'
  dragState.pointerId = null
  dragState.workingList = null
  setTimeout(() => { dragState.moved = false }, 50)
}

function finishDrag(commit) {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onDragKeyDown)
  clearLongPressTimer()
  document.body.style.userSelect = ''

  if (dragState.active && commit && dragState.overId && dragState.workingList) {
    const fromId = dragState.activeId
    const toId = dragState.overId
    const pos = dragState.overPos
    const list = dragState.workingList
    const fromIdx = list.findIndex(e => e.id === fromId)
    let toIdx = list.findIndex(e => e.id === toId)
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      const [moved] = list.splice(fromIdx, 1)
      if (toIdx > fromIdx) toIdx -= 1
      const insertAt = pos === 'top' ? toIdx : toIdx + 1
      list.splice(insertAt, 0, moved)
      const orderKey = 'all'
      savePersistedOrder(orderKey, list.map(e => e.id))
      eventStore.reorderEvents(list.map(e => e.id))
    }
  }

  dragState.active = false
  dragState.activeId = null
  dragState.overId = null
  dragState.overPos = 'bottom'
  dragState.pointerId = null
  dragState.workingList = null
  setTimeout(() => { dragState.moved = false }, 50)
}

onUnmounted(() => {
  clearLongPressTimer()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('keydown', onDragKeyDown)
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('mousedown', onWindowMouseDown)
  document.body.style.userSelect = ''
})
</script>

<style scoped>
.event-list {
  width: 100%;
  min-width: 0;
  height: 100%;
  background: var(--bg-app);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease;
  overflow: hidden;
  touch-action: pan-y;
}

.el-header {
  padding: 12px 22px;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  background: var(--bg-surface);
}

.el-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.el-search {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-panel);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0 8px 0 28px;
  height: 34px;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: 0;
}
.el-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(22,119,255,0.10);
}
.el-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-md);
  color: var(--text-muted);
  pointer-events: none;
}
.el-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--font-base);
  height: 100%;
  min-width: 0;
}
.el-search-input::placeholder {
  color: var(--text-muted);
}
.el-search-clear {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--font-lg);
  line-height: 1;
  padding: 0 4px;
  border-radius: 3px;
}
.el-search-clear:hover {
  color: var(--text-primary);
  background: rgba(0,0,0,0.04);
}

/* Advanced filter button */
.adv-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  background: var(--bg-panel);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.adv-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.adv-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.adv-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-sm);
  line-height: 0;
}
.adv-icon svg { display: block; }
.adv-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 1.5px var(--bg-surface);
}

/* Active filter chips row */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 4px 3px 8px;
  border-radius: 10px;
  font-size: var(--font-sm);
  line-height: 1.2;
  border: 1px solid transparent;
  font-weight: 500;
}
.chip.pri-critical { background: var(--danger-bg); color: var(--danger); border-color: rgba(245,63,63,0.25); }
.chip.pri-normal { background: var(--bg-hover); color: var(--text-secondary); border-color: var(--border-primary); }
.chip.st-pending { background: var(--offline-bg); color: var(--offline); border-color: rgba(134,144,156,0.25); }
.chip.st-processing { background: var(--accent-bg); color: var(--accent); border-color: rgba(22,119,255,0.25); }
.chip.st-resolved { background: var(--success-bg); color: var(--success); border-color: rgba(0,180,42,0.25); }
.chip.chip-sys { background: var(--bg-hover); color: var(--text-secondary); border-color: var(--border-primary); }
.chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--font-base);
  line-height: 1;
  padding: 0 2px;
  border-radius: 50%;
  color: inherit;
  opacity: 0.7;
}
.chip-x:hover { opacity: 1; background: rgba(0,0,0,0.06); }
.chip-clear-all {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-sm);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  margin-left: auto;
}
.chip-clear-all:hover { color: var(--accent); background: var(--accent-bg); }

/* Advanced filter dropdown panel */
.adv-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 12px;
  right: 12px;
  z-index: 100;
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}
.adv-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.adv-section-title {
  font-size: var(--font-sm);
  color: var(--text-muted);
  letter-spacing: 0.02em;
  font-weight: 500;
}
.adv-options {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}
.adv-options-wrap { flex-wrap: wrap; }
.opt-empty {
  font-size: var(--font-sm);
  color: var(--text-muted);
  padding: 4px 0;
}
.opt-pill {
  font-size: var(--font-sm);
  padding: 4px 10px;
  border-radius: 10px;
  border: 1px solid var(--border-primary);
  background: var(--bg-panel);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.opt-pill:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.opt-pill.on.pri-critical { background: var(--danger-bg); color: var(--danger); border-color: var(--danger); }
.opt-pill.on.pri-normal { background: var(--bg-hover); color: var(--text-primary); border-color: var(--text-secondary); }
.opt-pill.on.st-pending { background: var(--offline-bg); color: var(--offline); border-color: var(--offline); }
.opt-pill.on.st-processing { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }
.opt-pill.on.st-resolved { background: var(--success-bg); color: var(--success); border-color: var(--success); }
.opt-pill.sys-pill.on { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }

.adv-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-primary);
}
.adv-clear {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-sm);
  cursor: pointer;
  padding: 4px 8px;
}
.adv-clear:hover { color: var(--accent); }
.adv-close {
  background: var(--accent);
  border: none;
  color: #fff;
  font-size: var(--font-sm);
  padding: 5px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.adv-close:hover { background: var(--accent-hover); }

.el-items {
  flex: 1;
  overflow-y: auto;
  padding: 16px 22px 22px;
}

.priority-card {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 16px;
  padding: 16px 18px;
  margin-bottom: 14px;
  border: 1px solid var(--border-primary);
  border-left: 4px solid #8A95A6;
  border-radius: 10px;
  background: var(--bg-surface);
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  position: relative;
}
.priority-card.critical { border-left-color: var(--danger); }
.priority-card.normal { border-left-color: var(--accent); }
.priority-card:hover { border-color: rgba(22,119,255,0.35); box-shadow: var(--shadow-md); }
.priority-card-top {
  grid-column: 1 / 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.priority-card-kicker {
  color: var(--text-muted);
  font-size: var(--font-sm);
  font-weight: 600;
}
.priority-card-title {
  min-width: 0;
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1.3;
  font-weight: 700;
}
.priority-card-desc {
  grid-column: 1 / 3;
  color: var(--text-secondary);
  font-size: var(--font-base);
  line-height: 1.55;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.priority-card-meta {
  grid-column: 1 / 3;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: var(--font-sm);
}
.priority-card-meta > span:not(.priority-card-time) {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg-panel);
  border: 1px solid var(--border-secondary);
}
.priority-card-time {
  margin-left: auto;
  color: var(--text-muted);
  font-size: var(--font-sm);
  line-height: 1;
}
.priority-unread { box-shadow: none; }

.inbox-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px 8px;
  color: var(--text-muted);
  font-size: var(--font-sm);
  font-weight: 600;
}

.event-card {
  display: grid;
  grid-template-columns: 18px 4px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  padding: 13px 14px;
  margin-bottom: 8px;
  border: 1px solid var(--border-secondary);
  border-radius: 10px;
  background: var(--bg-surface);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, border-color 0.15s;
  user-select: none;
  position: relative;
  overflow: hidden;
  touch-action: pan-x pan-y;
  min-height: 84px;
}
.event-card:hover {
  border-color: rgba(22,119,255,0.28);
  box-shadow: var(--shadow-sm);
}
.event-card.selected {
  background: var(--bg-selected);
  border-color: rgba(22,119,255,0.35);
}
.event-card.dragging {
  opacity: 0.5;
  background: var(--bg-surface);
  transform: scale(0.99);
}
.event-card.drag-over-top {
  box-shadow: inset 0 2px 0 0 var(--accent);
}
.event-card.drag-over-bottom {
  box-shadow: inset 0 -2px 0 0 var(--accent);
}

/* Swipe-to-pin */
.pin-action {
  position: absolute;
  inset: 0;
  left: 0;
  width: 100%;
  display: flex;
  align-items: center;
  padding-left: 22px;
  background: var(--accent);
  color: #fff;
  font-size: var(--font-md);
  font-weight: 700;
  opacity: 0;
  pointer-events: none;
  border-radius: 10px;
  transition: opacity 0.12s;
}
.event-card.swiping .pin-action { opacity: 0.55; }
.event-card.pin-ready .pin-action { opacity: 1; }
.event-card.swiping,
.event-card.pin-ready {
  transition: transform 0.05s linear;
}
.event-card:not(.swiping):not(.pin-ready) {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s, box-shadow 0.15s, border-color 0.15s;
}

.drag-handle {
  color: var(--text-muted);
  font-size: 15px;
  cursor: grab;
  width: 18px;
  text-align: center;
  user-select: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.event-card:hover .drag-handle,
.event-card.dragging .drag-handle { opacity: 1; }
.event-card:active .drag-handle { cursor: grabbing; }

.priority-rail {
  width: 4px;
  height: 52px;
  border-radius: 4px;
  justify-self: center;
}
.priority-rail.critical { background: var(--danger); }
.priority-rail.normal { background: var(--accent); }
.priority-rail.resolved { background: var(--text-muted); }

.event-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-topline {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.card-title {
  min-width: 0;
  flex: 1;
  font-size: var(--font-md);
  font-weight: 650;
  color: var(--text-primary);
  line-height: 1.35;
}

.card-preview {
  min-width: 0;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  line-height: 1.45;
}

.card-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.system-tag,
.status-chip {
  max-width: 160px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: var(--font-xs);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.system-tag {
  background: var(--bg-panel);
  border: 1px solid var(--border-secondary);
  color: var(--text-secondary);
}
.status-chip.st-pending { background: var(--offline-bg); color: var(--offline); }
.status-chip.st-processing { background: var(--accent-bg); color: var(--accent); }
.status-chip.st-resolved { background: var(--success-bg); color: var(--success); }

.event-tail {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 40px;
}

.card-time {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: var(--font-sm);
  line-height: 1;
  white-space: nowrap;
}

.open-indicator {
  color: var(--text-muted);
  font-size: 22px;
  line-height: 1;
}

:deep(.search-hl) {
  background: rgba(22,119,255,0.18);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}

/* Unread badge */
.unread-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: var(--font-xs);
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--bg-surface);
  pointer-events: none;
}
.unread-badge-pulse {
  animation: badge-pulse 1.2s ease-out;
}
@keyframes badge-pulse {
  0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,63,63,0.6); }
  40%  { transform: scale(1.35); box-shadow: 0 0 0 6px rgba(245,63,63,0); }
  100% { transform: scale(1); }
}

@media (max-width: 760px) {
  .el-header {
    padding: 14px 14px 10px;
  }
  .el-items {
    padding: 10px 14px 14px;
  }
  .priority-card {
    padding: 14px;
    border-radius: 9px;
  }
  .priority-card-title {
    font-size: 17px;
  }
  .event-card {
    grid-template-columns: 4px minmax(0, 1fr) auto;
    row-gap: 8px;
    column-gap: 10px;
  }
  .drag-handle {
    display: none;
  }
  .priority-rail {
    grid-column: 1;
    height: auto;
    align-self: stretch;
  }
  .event-main {
    grid-column: 2;
  }
  .event-tail {
    grid-column: 3;
  }
  .card-topline {
    align-items: flex-start;
  }
  .card-meta-row {
    flex-wrap: wrap;
  }
  .status-chip {
    display: none;
  }
}

.empty-state {
  padding: 40px 14px;
  text-align: center;
  font-size: var(--font-base);
  color: var(--text-muted);
}
</style>
