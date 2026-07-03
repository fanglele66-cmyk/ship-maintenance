<template>
  <div class="event-list" ref="listRef">
    <!-- Header -->
    <div class="el-header">
      <div class="el-title">
        <span>事件中心</span>
        <span class="el-count">{{ eventStore.events.length }}</span>
      </div>
      <!-- Filter tabs -->
      <div class="el-filters">
        <button
          v-for="f in filters"
          :key="f.key"
          class="filter-tab"
          :class="{ active: eventStore.filterStatus === f.key }"
          @click="eventStore.setFilter(f.key)"
        >
          {{ f.label }}
          <span v-if="getCount(f.key) > 0" class="filter-count">{{ getCount(f.key) }}</span>
        </button>
      </div>
    </div>

    <!-- Event cards -->
    <div class="el-items" ref="itemsRef">
      <div
        v-for="event in eventStore.sortedEvents"
        :key="event.id"
        class="event-card"
        :class="{ selected: eventStore.selectedEventId === event.id }"
        :data-id="event.id"
        draggable="true"
        @dragstart="onDragStart($event, event)"
        @dragover.prevent="onDragOver($event, event)"
        @dragend="onDragEnd"
        @click="handleEventClick(event)"
      >
        <span class="drag-handle" title="拖拽排序">⠿</span>
        <span class="priority-dot" :class="event.priority"></span>
        <div class="card-body">
          <div class="card-title text-overflow">{{ event.title }}</div>
          <div class="card-meta">
            <span class="meta-system">{{ event.system }}</span>
            <span class="meta-time">{{ formatTime(event.createdAt) }}</span>
          </div>
        </div>
        <span class="tag" :class="event.priority">
          {{ priorityLabels[event.priority] }}
        </span>
      </div>

      <div v-if="eventStore.sortedEvents.length === 0" class="empty-state">
        暂无事件
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import { eventPriorityLabels } from '@/mock/events'

const eventStore = useEventStore()
const listRef = ref(null)
const itemsRef = ref(null)

const priorityLabels = eventPriorityLabels
const dragData = ref(null)

const filters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'resolved', label: '已解决' }
]

function getCount(key) {
  if (key === 'all') return eventStore.events.length
  return eventStore.events.filter(e => e.status === key).length
}

function formatTime(time) {
  const d = new Date(time)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function handleEventClick(event) {
  eventStore.selectEvent(event.id)
}

// Drag & Drop
function onDragStart(e, event) {
  dragData.value = event.id
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e, target) {
  if (!dragData.value || dragData.value === target.id) return
  const items = eventStore.sortedEvents
  const fromIdx = items.findIndex(i => i.id === dragData.value)
  const toIdx = items.findIndex(i => i.id === target.id)
  if (fromIdx === -1 || toIdx === -1) return

  // Reorder
  const newOrder = items.map(i => i.id)
  newOrder.splice(fromIdx, 1)
  newOrder.splice(toIdx, 0, dragData.value)
  eventStore.reorderEvents(newOrder)
}

function onDragEnd() {
  dragData.value = null
}
</script>

<style scoped>
.event-list {
  width: var(--event-list-width);
  min-width: var(--event-list-width);
  height: 100%;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease;
  overflow: hidden;
}

.el-header {
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.el-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.el-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 1px 7px;
  border-radius: 8px;
}

.el-filters {
  display: flex;
  gap: 4px;
}

.filter-tab {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.filter-tab:hover {
  color: var(--text-secondary);
  background: rgba(24,144,255,0.05);
}
.filter-tab.active {
  color: var(--accent);
  background: rgba(24,144,255,0.1);
}

.filter-count {
  font-size: 9px;
  color: currentColor;
  opacity: 0.7;
}

.el-items {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.event-card {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid #0F1F38;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.event-card:hover {
  background: rgba(24,144,255,0.05);
}
.event-card.selected {
  background: rgba(24,144,255,0.1);
  border-left: 2px solid var(--accent);
  padding-left: 12px;
}

.drag-handle {
  color: var(--text-muted);
  font-size: 14px;
  cursor: grab;
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  margin-top: 1px;
  user-select: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.event-card:hover .drag-handle {
  opacity: 1;
}

.priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.priority-dot.critical { background: var(--danger); }
.priority-dot.important { background: var(--warning); }
.priority-dot.normal { background: var(--accent); }

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.card-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-muted);
}

.empty-state {
  padding: 32px 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
