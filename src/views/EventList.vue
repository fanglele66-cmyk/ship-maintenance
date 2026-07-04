<template>
  <div class="event-list" ref="listRef">
    <!-- Header: search box + advanced filter button -->
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

    <!-- Event cards -->
    <div class="el-items" ref="itemsRef">
      <div
        v-for="(event, idx) in displayEvents"
        :key="event.id"
        class="event-card"
        :class="{
          selected: eventStore.selectedEventId === event.id,
          'drag-over-top': dragState.overId === event.id && dragState.overPos === 'top',
          'drag-over-bottom': dragState.overId === event.id && dragState.overPos === 'bottom',
          dragging: dragState.activeId === event.id
        }"
        :data-id="event.id"
        @pointerdown="onPointerDown($event, event, idx)"
        @click="handleEventClick(event)"
      >
        <span class="drag-handle" title="长按或拖拽排序">⠿</span>
        <span class="priority-dot" :class="event.priority"></span>
        <div class="card-body">
          <div class="card-title text-overflow" v-html="highlightMatch(event.title)"></div>
          <div class="card-meta">
            <span class="meta-system">{{ event.system }}</span>
            <span class="meta-time">{{ formatTime(event.createdAt) }}</span>
          </div>
        </div>
        <span class="tag" :class="event.priority">
          {{ priorityLabels[event.priority] }}
        </span>
        <span
          v-if="unreadById(event.id) > 0"
          class="unread-badge"
          :class="{ 'unread-badge-pulse': recentlyBumped[event.id] }"
          :title="`${unreadById(event.id)} 条未读消息`"
        >
          {{ unreadById(event.id) > 99 ? '99+' : unreadById(event.id) }}
        </span>
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
  import { eventPriorityLabels } from '@/mock/events'

  const eventStore = useEventStore()
  const listRef = ref(null)
  const itemsRef = ref(null)
  const searchInputRef = ref(null)
  const advPanelRef = ref(null)

  const priorityLabels = eventPriorityLabels

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
  priorities: [],  // critical | important | normal
  statuses: [],    // pending | processing | resolved
  systems: []      // dynamic, from events
})

// Available options
const priorityOptions = ['critical', 'important', 'normal']
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
  longPressTimer: null,
  moved: false,
  pointerId: null,
  workingList: null
})

const LONG_PRESS_MS = 220
const MOVE_THRESHOLD = 6

// localStorage key for user-customized order (per filter)
const ORDER_STORAGE_KEY = 'ship-event-list-order-v1'

// ---- Helpers ----
function formatTime(time) {
  const d = new Date(time)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

const displayEvents = computed(() => {
  // While dragging, render the in-memory working list verbatim
  if (dragState.active && dragState.workingList) {
    return dragState.workingList.filter(e => matchesSearch(e, searchKeyword.value))
      .filter(e => passesAdvanced(e))
  }

  // 1. Reorder the underlying events by persisted order (only the current
  //    store-level filter is the legacy "全部/待处理/处理中/已解决" tab;
  //    since we removed that tab, treat this as 'all' for ordering purposes.)
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
  // 2. Apply fuzzy search
  let result = base.filter(e => matchesSearch(e, searchKeyword.value))
  // 3. Apply advanced filters (in-memory; not persisted)
  result = result.filter(e => passesAdvanced(e))
  return result
})

// Advanced-filter predicate (in-memory, not stored)
function passesAdvanced(event) {
  if (localAdv.priorities.length && !localAdv.priorities.includes(event.priority)) return false
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
  if (dragState.moved) return
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
  dragState.moved = false
  dragState.activeId = event.id
  dragState.workingList = displayEvents.value.slice()

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
  const dy = e.clientY - dragState.startY
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
  finishDrag(true)
}

function onPointerCancel() {
  finishDrag(false)
}

function onDragKeyDown(e) {
  if (e.key === 'Escape' && dragState.active) {
    finishDrag(false)
  }
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
  width: var(--event-list-width);
  min-width: var(--event-list-width);
  height: 100%;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-primary);
  transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease;
  overflow: visible;
  touch-action: pan-y;
}

.el-header {
  padding: 12px 14px 10px;
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
  font-size: 14px;
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
  font-size: 16px;
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
  font-size: 12px;
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
  font-size: 11px;
  line-height: 1.2;
  border: 1px solid transparent;
  font-weight: 500;
}
.chip.pri-critical { background: var(--danger-bg); color: var(--danger); border-color: rgba(245,63,63,0.25); }
.chip.pri-important { background: var(--warning-bg); color: var(--warning); border-color: rgba(255,125,0,0.25); }
.chip.pri-normal { background: var(--accent-bg); color: var(--accent); border-color: rgba(22,119,255,0.25); }
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
  font-size: 13px;
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
  font-size: 11px;
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
  font-size: 11px;
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
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px 0;
}
.opt-pill {
  font-size: 11px;
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
.opt-pill.on.pri-important { background: var(--warning-bg); color: var(--warning); border-color: var(--warning); }
.opt-pill.on.pri-normal { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }
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
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
}
.adv-clear:hover { color: var(--accent); }
.adv-close {
  background: var(--accent);
  border: none;
  color: #fff;
  font-size: 12px;
  padding: 5px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.adv-close:hover { background: var(--accent-hover); }

.el-items {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.event-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-secondary);
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
  position: relative;
  touch-action: pan-y;
  min-height: 50px;
}
.event-card:hover {
  background: var(--bg-hover);
}
.event-card.selected {
  background: var(--bg-selected);
  border-left: 3px solid var(--accent);
  padding-left: 11px;
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

/* Priority tag in card */
.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  margin-top: 1px;
  align-self: flex-start;
  font-weight: 500;
}
.tag.critical { background: var(--danger-bg); color: var(--danger); }
.tag.important { background: var(--warning-bg); color: var(--warning); }
.tag.normal { background: var(--accent-bg); color: var(--accent); }

.drag-handle {
  color: var(--text-muted);
  font-size: 15px;
  cursor: grab;
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  margin-top: 1px;
  user-select: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.event-card:hover .drag-handle,
.event-card.dragging .drag-handle { opacity: 1; }
.event-card:active .drag-handle { cursor: grabbing; }

.priority-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}
.priority-dot.critical { background: var(--danger); }
.priority-dot.important { background: var(--warning); }
.priority-dot.normal { background: var(--accent); }

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: var(--font-base);
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  padding-right: 30px;
}

.card-meta {
  display: flex;
  gap: 10px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-muted);
}

:deep(.search-hl) {
  background: rgba(22,119,255,0.18);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}

/* Unread badge */
.unread-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: 10px;
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

.empty-state {
  padding: 40px 14px;
  text-align: center;
  font-size: var(--font-base);
  color: var(--text-muted);
}
</style>
