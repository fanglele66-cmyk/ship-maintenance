<template>
  <div class="event-list" ref="listRef">
    <!-- Header: compact title/search/filter -->
    <div class="el-header">
      <div class="el-row">
        <h2 v-if="prioritySectionEvents.length" class="event-section-title priority-section-heading">优先处理</h2>
        <div class="el-tools">
          <div class="el-search">
            <svg class="el-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
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
          </button>
          <button class="report-entry-btn" type="button" @click="reportDialogOpen = true">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <span>异常上报</span>
          </button>
        </div>
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

    <!-- Events -->
    <div class="el-items" ref="itemsRef">
      <section v-if="prioritySectionEvents.length" class="event-section">
        <div class="event-grid">
          <div
            v-for="event in prioritySectionEvents"
            :key="event.id"
            class="event-card"
            :class="[eventCardClass(event), { 'priority-event-card': isWorkflowPriority(event) }]"
            :data-id="event.id"
            :title="isWorkflowPriority(event) ? '默认优先处理' : '已置顶'"
            @click="handleEventClick(event)"
          >
            <div class="event-main">
              <div class="event-title-row">
                <div class="card-title" v-html="highlightMatch(event.title)"></div>
                <div class="card-head-meta">
                  <span class="card-time">{{ formatMessageTime(latestEventTime(event)) }}</span>
                  <button
                    v-if="!isWorkflowPriority(event)"
                    class="card-pin-btn"
                    :class="{ active: isPinned(event.id) }"
                    type="button"
                    :title="isPinned(event.id) ? '取消置顶' : '置顶'"
                    :aria-label="isPinned(event.id) ? '取消置顶事件' : '置顶事件'"
                    @click.stop="togglePinned(event.id)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12 17v5M5 3h14M7 3l1 8-3 3h14l-3-3 1-8" />
                      <path class="unpin-slash" d="M4 4l16 16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="card-preview" v-html="highlightMatch(cardPreview(event))"></div>
            </div>
            <div class="event-card-foot">
              <div class="event-meta">
                <span class="event-status-tag" :class="'st-' + event.status">{{ statusLabels[event.status] }}</span>
                <span class="system-tag">{{ event.system || '未分组设备' }}</span>
              </div>
              <button class="handle-now-btn" :class="handleTone(event)" @click.stop="handleEventClick(event)">
                <span>{{ event.status === 'resolved' ? '查看详情' : '立即处理' }}</span>
                <span
                  v-if="event.status !== 'resolved' && unreadById(event.id) > 0"
                  class="handle-unread-badge"
                  :class="{ 'unread-badge-pulse': recentlyBumped[event.id] }"
                  :title="`${unreadById(event.id)} 条未读消息`"
                >{{ unreadDisplay(event.id) }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="regularEvents.length" class="event-section">
        <h2 class="event-section-title">事件 inbox</h2>
        <div class="event-grid regular-event-grid">
          <div
            v-for="event in regularEvents"
            :key="event.id"
            class="event-card"
            :class="eventCardClass(event)"
            :data-id="event.id"
            data-drag-group="regular"
            title="拖拽排序（Pad 长按）"
            @pointerdown="rememberDragPointer($event)"
            @click="handleEventClick(event)"
          >
            <div class="event-main">
              <div class="event-title-row">
                <div class="card-title" v-html="highlightMatch(event.title)"></div>
                <div class="card-head-meta">
                  <span class="card-time">{{ formatMessageTime(latestEventTime(event)) }}</span>
                  <button
                    class="card-pin-btn"
                    type="button"
                    title="置顶"
                    aria-label="置顶事件"
                    @click.stop="togglePinned(event.id)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12 17v5M5 3h14M7 3l1 8-3 3h14l-3-3 1-8" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="card-preview" v-html="highlightMatch(cardPreview(event))"></div>
            </div>
            <div class="event-card-foot">
              <div class="event-meta">
                <span class="event-status-tag" :class="'st-' + event.status">{{ statusLabels[event.status] }}</span>
                <span class="system-tag">{{ event.system || '未分组设备' }}</span>
              </div>
              <button class="handle-now-btn" :class="handleTone(event)" @click.stop="handleEventClick(event)">
                <span>{{ event.status === 'resolved' ? '查看详情' : '立即处理' }}</span>
                <span
                  v-if="event.status !== 'resolved' && unreadById(event.id) > 0"
                  class="handle-unread-badge"
                  :class="{ 'unread-badge-pulse': recentlyBumped[event.id] }"
                  :title="`${unreadById(event.id)} 条未读消息`"
                >{{ unreadDisplay(event.id) }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div v-if="displayEvents.length > 0" class="event-count-footer">共 {{ displayEvents.length }} 个事件</div>

      <div v-if="displayEvents.length === 0" class="empty-state">
        {{ emptyMessage }}
      </div>
    </div>

    <AbnormalReportDialog
      :open="reportDialogOpen"
      :prefill="null"
      @close="reportDialogOpen = false"
      @submit="submitGenericReport"
    />
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted, watch, reactive, inject, nextTick } from 'vue'
  import Sortable from 'sortablejs'
  import { ElMessage } from 'element-plus'
  import AbnormalReportDialog from '@/components/AbnormalReportDialog.vue'
  import { useAbnormalReport } from '@/composables/useAbnormalReport'
  import { useEventStore } from '@/stores/eventStore'

  const eventStore = useEventStore()
  const { createAbnormalEvent } = useAbnormalReport()
  const reportDialogOpen = ref(false)
  const listRef = ref(null)
  const itemsRef = ref(null)
  const searchInputRef = ref(null)
  const advPanelRef = ref(null)
  const pinnedEventIds = ref([])

  function submitGenericReport(report) {
    createAbnormalEvent(report, '异常报告提交（事件中心手动上报）')
    reportDialogOpen.value = false
    ElMessage({ type: 'success', message: '异常报告已提交', duration: 2400 })
  }

  const priorityLabels = {
    critical: '紧急',
    important: '重要',
    normal: '一般'
  }

  // ---- Inject unread counter from AssistantPanel ----
  const eventUnread = inject('eventUnread', reactive({}))
  function unreadById(id) {
    return eventUnread[id] || 0
  }
  function unreadDisplay(id) {
    return Math.min(unreadById(id), 99)
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
  resolved: '已闭环'
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

// ---- Reorder state: the Sortable instance only handles presentation. The
// store is updated once on drop, so no event status or workflow data changes.
const dragState = reactive({
  active: false,
  activeId: null,
  moved: false
})

const LONG_PRESS_MS = 320
const MOVE_THRESHOLD = 6
let movedResetTimer = null
let sortableInstance = null
let dropIndicator = null
let lastDragPointerType = 'mouse'

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

function eventPriorityTone(event) {
  if (event.priority === 'critical') return 'critical'
  if (event.priority === 'important') return 'important'
  return 'normal'
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

function cardPreview(event) {
  if (event.status === 'resolved') {
    const timeline = event.timeline || []
    const latest = timeline[timeline.length - 1]
    if (latest?.action) return latest.action
  }
  return event.aiAnalysis?.summary || eventPreview(event)
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

function applyRegularOrder(orderedRegularIds) {
  const regularIds = new Set(orderedRegularIds)
  let regularIndex = 0
  const mergedOrder = eventStore.events.map(event => (
    regularIds.has(event.id) ? orderedRegularIds[regularIndex++] : event.id
  ))
  eventStore.reorderEvents(mergedOrder)
}

const displayEvents = computed(() => {
  let base = [...eventStore.events]
  let result = base.filter(e => matchesSearch(e, searchKeyword.value))
  result = result.filter(e => passesAdvanced(e))
  return result
})

// Priority follows the complete workflow order. Search/filter must not promote a
// different card just because the actual first item is temporarily hidden.
const globalPriorityEvent = computed(() => {
  return eventStore.events.find(event => event.status !== 'resolved') || null
})

function isWorkflowPriority(event) {
  return globalPriorityEvent.value?.id === event.id
}

function isPinned(eventId) {
  return pinnedEventIds.value.includes(eventId)
}

function togglePinned(eventId) {
  if (globalPriorityEvent.value?.id === eventId) return
  pinnedEventIds.value = isPinned(eventId)
    ? pinnedEventIds.value.filter(id => id !== eventId)
    : [...pinnedEventIds.value, eventId]
}

const prioritySectionEvents = computed(() => {
  const priorityId = globalPriorityEvent.value?.id
  const result = []
  const visiblePriority = displayEvents.value.find(event => event.id === priorityId)
  if (visiblePriority) result.push(visiblePriority)

  for (const event of displayEvents.value) {
    if (event.id !== priorityId && isPinned(event.id)) result.push(event)
  }
  return result
})

const regularEvents = computed(() => {
  const priorityIds = new Set(prioritySectionEvents.value.map(event => event.id))
  return displayEvents.value.filter(event => !priorityIds.has(event.id))
})

function handleTone(event) {
  if (globalPriorityEvent.value?.id === event.id) return 'priority'
  return event.status
}

function eventCardClass(event) {
  return {
    selected: eventStore.selectedEventId === event.id,
    dragging: dragState.activeId === event.id,
    ['tone-' + eventPriorityTone(event)]: true,
    ['status-' + event.status]: true
  }
}

// Advanced-filter predicate (in-memory, not stored)
function passesAdvanced(event) {
  if (localAdv.priorities.length && !localAdv.priorities.includes(eventPriorityTone(event))) return false
  if (localAdv.statuses.length && !localAdv.statuses.includes(event.status)) return false
  if (localAdv.systems.length && !localAdv.systems.includes(event.system)) return false
  return true
}

const emptyMessage = computed(() => {
  if (searchKeyword.value) return '没有匹配的事件'
  if (hasAnyFilter.value) return '没有符合筛选条件的事件'
  return '暂无事件'
})

// ---- Click ----
function handleEventClick(event) {
  if (dragState.moved) return
  eventStore.selectEvent(event.id)
}

// ---- SortableJS reorder (mouse drag, touch long-press) ----
function rememberDragPointer(e) {
  lastDragPointerType = e.pointerType || 'mouse'
}

function clearDropIndicator() {
  if (!dropIndicator) return
  dropIndicator.classList.remove('drag-insert-before', 'drag-insert-after')
  dropIndicator = null
}

function updateDropIndicator(evt) {
  const target = evt.related
  if (!target || target === evt.dragged || !target.classList.contains('event-card')) {
    clearDropIndicator()
    return
  }

  const rect = target.getBoundingClientRect()
  const insertAfter = typeof evt.willInsertAfter === 'boolean'
    ? evt.willInsertAfter
    : evt.originalEvent?.clientY > rect.top + rect.height / 2
  if (dropIndicator !== target) clearDropIndicator()
  dropIndicator = target
  target.classList.toggle('drag-insert-before', !insertAfter)
  target.classList.toggle('drag-insert-after', insertAfter)
}

function resetDragState() {
  clearDropIndicator()
  dragState.active = false
  dragState.activeId = null
  if (movedResetTimer) clearTimeout(movedResetTimer)
  movedResetTimer = setTimeout(() => {
    dragState.moved = false
    movedResetTimer = null
  }, 80)
}

function initSortable() {
  const grid = itemsRef.value?.querySelector('.regular-event-grid')
  if (!grid || sortableInstance?.el === grid) return
  sortableInstance?.destroy()

  sortableInstance = Sortable.create(grid, {
    animation: 220,
    easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
    draggable: '.event-card',
    filter: 'button, input, textarea, select, a, label',
    preventOnFilter: false,
    delay: LONG_PRESS_MS,
    delayOnTouchOnly: true,
    touchStartThreshold: MOVE_THRESHOLD,
    fallbackTolerance: MOVE_THRESHOLD,
    fallbackOnBody: true,
    chosenClass: 'drag-chosen',
    ghostClass: 'drag-ghost',
    fallbackClass: 'drag-fallback',
    onStart(evt) {
      dragState.active = true
      dragState.activeId = evt.item.dataset.id
      dragState.moved = true
      document.body.style.userSelect = 'none'
      if (lastDragPointerType !== 'mouse' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(18)
      }
    },
    onMove(evt) {
      updateDropIndicator(evt)
      return true
    },
    onEnd(evt) {
      document.body.style.userSelect = ''
      const orderedIds = Array.from(evt.to.querySelectorAll('.event-card')).map(card => card.dataset.id)
      if (evt.oldIndex !== evt.newIndex && orderedIds.length) applyRegularOrder(orderedIds)
      resetDragState()
    }
  })
}

function scheduleSortable() {
  nextTick(initSortable)
}

onMounted(scheduleSortable)
watch(() => regularEvents.value.map(event => event.id).join('|'), scheduleSortable)

onUnmounted(() => {
  if (movedResetTimer) clearTimeout(movedResetTimer)
  clearDropIndicator()
  sortableInstance?.destroy()
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
  background: #F5F7FA;
  display: flex;
  flex-direction: column;
  transition: opacity 0.16s ease;
  overflow: hidden;
  touch-action: pan-y;
}

.el-header {
  padding: 16px 16px 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  background: transparent;
}

.el-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
}

.el-title-group {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.el-title {
  margin: 0;
  color: #19213D;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 700;
}

.el-tools {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 300px;
  margin-left: auto;
}

.report-entry-btn {
  height: 32px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 11px;
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 8px;
  background: #FFF7F7;
  color: #E5484D;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.16s, background 0.16s, color 0.16s;
}
.report-entry-btn:hover { border-color: rgba(239, 68, 68, 0.55); background: #FFEEEE; color: #D9363E; }
.report-entry-btn:focus-visible { outline: 2px solid rgba(239, 68, 68, 0.35); outline-offset: 2px; }
.report-entry-btn svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.el-search {
  position: relative;
  flex: 0 0 260px;
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  display: flex;
  align-items: center;
  background: var(--bg-panel);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0 8px 0 28px;
  height: 32px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.el-search:focus-within {
  flex-basis: 260px;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(22,119,255,0.10);
}
.el-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}
.el-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
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
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
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
.chip.pri-important { background: rgba(255,125,0,0.12); color: #d46b08; border-color: rgba(255,125,0,0.28); }
.chip.pri-normal { background: var(--bg-hover); color: var(--text-secondary); border-color: var(--border-primary); }
.chip.st-pending { background: rgba(255,125,0,0.12); color: #d46b08; border-color: rgba(255,125,0,0.28); }
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
  left: auto;
  right: 16px;
  width: 400px;
  max-width: calc(100% - 32px);
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
.opt-pill.on {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent);
}

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
  margin-top: -10px;
  padding: 10px 16px 24px;
}

.event-section + .event-section {
  margin-top: 24px;
}

.event-section-title {
  margin: 0 0 8px;
  color: #9195A2;
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
}

.priority-section-heading {
  flex: none;
  margin: 0;
  line-height: 32px;
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  align-items: stretch;
  gap: 16px;
}

.event-card {
  --event-tone: #106BFF;
  --event-tone-rgb: 16, 107, 255;
  width: 100%;
  height: 216px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  background: #FFFFFF;
  cursor: pointer;
  transition: background-color 0.15s, box-shadow 0.15s, border-color 0.15s, opacity 0.15s;
  user-select: none;
  position: relative;
  overflow: visible;
  touch-action: pan-x pan-y;
}
.event-card:hover {
  border-color: #D8DEE8;
  box-shadow: 0 2px 12px rgba(109, 117, 143, 0.10);
}
.event-card.selected {
  background: linear-gradient(180deg, #F3F7FF 0%, #FFFFFF 52%);
  border-color: #106BFF;
}
.priority-event-card {
  --event-tone: #E52E2E;
  --event-tone-rgb: 229, 46, 46;
  border-color: #E52E2E;
  background: linear-gradient(180deg, #FEF5F5 0%, #FFFFFF 52%);
  box-shadow: 0 2px 16px rgba(229, 46, 46, 0.16);
  animation: priority-shadow-pulse 3s ease-out infinite;
}
.event-card.status-pending:not(.priority-event-card) {
  --event-tone: #FF8000;
  --event-tone-rgb: 255, 128, 0;
  border-color: #FFD6AD;
  background: linear-gradient(180deg, #FFF8F2 0%, #FFFFFF 52%);
}
.event-card.status-processing:not(.priority-event-card) {
  --event-tone: #106BFF;
  --event-tone-rgb: 16, 107, 255;
  border-color: #B8D2FF;
  background: linear-gradient(180deg, #F3F7FF 0%, #FFFFFF 52%);
}
.event-card.status-resolved:not(.priority-event-card) {
  --event-tone: #9195A2;
  --event-tone-rgb: 145, 149, 162;
  border-color: #E4E7ED;
  background: linear-gradient(180deg, #F7F8FA 0%, #FFFFFF 52%);
}
.event-card.status-pending:not(.priority-event-card):hover {
  border-color: #FFB76B;
  box-shadow: 0 2px 12px rgba(255, 128, 0, 0.12);
}
.event-card.status-processing:not(.priority-event-card):hover {
  border-color: #7FAEFF;
  box-shadow: 0 2px 12px rgba(16, 107, 255, 0.12);
}
.event-card.status-resolved:not(.priority-event-card):hover {
  border-color: #D8DEE8;
  box-shadow: 0 2px 12px rgba(109, 117, 143, 0.10);
}
.priority-event-card:hover {
  border-color: #E52E2E;
}

@keyframes priority-shadow-pulse {
  0% {
    box-shadow: 0 2px 16px rgba(var(--event-tone-rgb), 0.16), 0 0 0 0 rgba(var(--event-tone-rgb), 0.18);
  }
  45% {
    box-shadow: 0 2px 16px rgba(var(--event-tone-rgb), 0.16), 0 0 0 6px rgba(var(--event-tone-rgb), 0.08);
  }
  70% {
    box-shadow: 0 2px 16px rgba(var(--event-tone-rgb), 0.16), 0 0 0 10px rgba(var(--event-tone-rgb), 0);
  }
  100% {
    box-shadow: 0 2px 16px rgba(var(--event-tone-rgb), 0.16), 0 0 0 10px rgba(var(--event-tone-rgb), 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .priority-event-card {
    animation: none;
  }
  .event-card.drag-chosen,
  .event-card.drag-fallback {
    transition: none;
  }
}
.event-card.drag-chosen,
.event-card.drag-fallback {
  opacity: 0.72;
  cursor: grabbing;
  box-shadow: 0 12px 28px rgba(25, 33, 61, 0.16);
}
.event-card.drag-ghost {
  opacity: 0.16;
  border-color: #106BFF;
  background: #F3F7FF;
}
.event-card.drag-insert-before::before,
.event-card.drag-insert-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 8;
  height: 2px;
  border-radius: 2px;
  background: #106BFF;
  box-shadow: 0 0 0 1px rgba(16, 107, 255, 0.10);
  pointer-events: none;
}
.event-card.drag-insert-before::before { top: -9px; }
.event-card.drag-insert-after::after { bottom: -9px; }

.event-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.event-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.card-head-meta {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-pin-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9195A2;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}
.card-pin-btn svg { width: 17px; height: 17px; }
.card-pin-btn .unpin-slash { stroke-width: 2.4; }
.card-pin-btn:hover,
.card-pin-btn:focus-visible {
  color: #686D76;
  background: #F1F2F4;
  outline: none;
}
.card-pin-btn.active {
  color: #7A7F89;
  background: #F1F2F4;
}
.event-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.event-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.card-title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-md);
  font-weight: 700;
  color: #19213D;
  line-height: 28px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-preview {
  min-width: 0;
  color: #6C7183;
  font-size: var(--font-sm);
  line-height: 24px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.event-status-tag,
.system-tag {
  max-width: 160px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: var(--font-sm);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-status-tag {
  font-weight: 400;
}
.event-status-tag.st-pending { background: #FFF4E8; border-color: #FFD6AD; color: #B85C00; }
.event-status-tag.st-processing { background: #EDF4FF; border-color: #B8D2FF; color: #106BFF; }
.event-status-tag.st-resolved { background: #F0F1F4; border-color: #E4E7ED; color: #6C7183; }
.system-tag {
  background: #F5F7FA;
  border-color: #E4E7ED;
  color: #6C7183;
}
.status-chip {
  max-width: 160px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-xs);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-chip.st-pending { background: rgba(255,125,0,0.12); color: #d46b08; border-color: rgba(255,125,0,0.26); }
.status-chip.st-processing { background: var(--accent-bg); color: var(--accent); }
.status-chip.st-resolved { background: var(--success-bg); color: var(--success); }

.card-time {
  flex-shrink: 0;
  color: #9195A2;
  font-size: var(--font-sm);
  line-height: 1;
  font-weight: 500;
  white-space: nowrap;
}

.open-indicator {
  color: var(--text-muted);
  font-size: 22px;
  line-height: 1;
}

.handle-now-btn {
  flex-shrink: 0;
  width: 112px;
  height: 32px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid #FF8000;
  border-radius: 8px;
  background: #FF8000;
  color: #fff;
  font-size: var(--font-sm);
  font-weight: 700;
  font-family: inherit;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.handle-now-btn:hover {
  background: #E67300;
  border-color: #E67300;
  box-shadow: 0 4px 12px rgba(255,128,0,0.20);
}
.handle-now-btn.priority {
  background: #E52E2E;
  border-color: #E52E2E;
}
.handle-now-btn.priority:hover {
  background: #CC2929;
  border-color: #CC2929;
  box-shadow: 0 4px 12px rgba(229,46,46,0.18);
}
.handle-now-btn.pending {
  background: #FF8000;
  border-color: #FF8000;
}
.handle-now-btn.pending:hover {
  background: #E67300;
  border-color: #E67300;
  box-shadow: 0 4px 12px rgba(255,128,0,0.20);
}
.handle-now-btn.processing {
  background: #106BFF;
  border-color: #106BFF;
}
.handle-now-btn.processing:hover {
  background: #0E5FE3;
  border-color: #0E5FE3;
  box-shadow: 0 4px 12px rgba(16,107,255,0.18);
}
.handle-now-btn.resolved {
  background: #9195A2;
  border-color: #9195A2;
}
.handle-now-btn.resolved:hover {
  background: #7F8493;
  border-color: #7F8493;
  box-shadow: 0 4px 12px rgba(108,113,131,0.16);
}
.handle-unread-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255,255,255,0.20);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  font-weight: 800;
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
    padding: 16px 14px 0;
  }
  .el-row {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }
  .el-title-group {
    justify-content: space-between;
  }
  .el-tools {
    flex: none;
    width: 300px;
    min-width: 300px;
  }
  .el-search {
    flex: 0 0 260px;
    width: 260px;
    min-width: 260px;
    max-width: 260px;
  }
  .el-search:focus-within {
    flex-basis: 260px;
  }
  .el-items {
    margin-top: -10px;
    padding: 10px 14px 14px;
  }
  .event-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .event-card {
    min-height: 146px;
  }
  .card-meta-row {
    flex-wrap: wrap;
  }
}

.empty-state {
  padding: 40px 14px;
  text-align: center;
  font-size: var(--font-base);
  color: var(--text-muted);
}

.event-count-footer {
  padding: 16px 0 0;
  color: #9195A2;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

/* ===== 2026-07 event home visual refresh ===== */
.event-list {
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  margin: 12px;
  border-radius: 8px;
  background: #FFFFFF;
}
.el-header {
  height: 48px;
  padding: 16px 16px 0;
  background: #FFFFFF;
}
.el-row { min-height: 28px; }
.el-title { font-size: 16px; line-height: 28px; }
.el-search,
.adv-btn { height: 32px; background: #FFFFFF; }
.el-items {
  margin-top: 0;
  padding: 16px 16px 24px;
}
.event-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 16px;
}
.event-card {
  max-width: none;
  height: 196px;
  gap: 8px;
  padding: 16px;
}
.card-title {
  font-size: 16px;
  line-height: 28px;
  -webkit-line-clamp: 1;
}
.card-preview {
  font-size: 14px;
  line-height: 24px;
  -webkit-line-clamp: 2;
}
.system-tag,
.event-status-tag,
.status-chip { font-size: 14px; }
.card-time { font-size: 14px; }
.handle-now-btn { font-size: 16px; font-weight: 400; }

@media (max-width: 900px) {
  .event-card { max-width: none; }
}

@media (max-width: 760px) {
  .event-list {
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    margin: 8px;
  }
  .el-header {
    height: auto;
    padding: 12px 14px 0;
  }
  .el-row {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }
  .el-tools {
    width: 100%;
    min-width: 0;
    margin-left: 0;
    align-self: auto;
  }
  .el-search {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    max-width: none;
  }
  .el-items { margin-top: 0; padding: 12px 14px 16px; }
  .event-card { max-width: none; height: 196px; }
}
</style>
