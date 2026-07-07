import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockEvents } from '@/mock/events'

export const useEventStore = defineStore('event', () => {
  const events = ref([...mockEvents])
  const selectedEventId = ref(null)
  const filterStatus = ref('all') // all | pending | processing | resolved
  const isDrawerOpen = ref(false)

  // 筛选后的事件列表
  const filteredEvents = computed(() => {
    if (filterStatus.value === 'all') return events.value
    return events.value.filter(e => e.status === filterStatus.value)
  })

  // 按优先级排序的事件列表（紧急→重要→一般→已解决沉底）
  const sortedEvents = computed(() => {
    const priorityOrder = { critical: 0, important: 1, normal: 2 }
    return [...filteredEvents.value].sort((a, b) => {
      // 已解决沉底
      if (a.status === 'resolved' && b.status !== 'resolved') return 1
      if (a.status !== 'resolved' && b.status === 'resolved') return -1
      // 按优先级
      const pa = priorityOrder[a.priority] ?? 3
      const pb = priorityOrder[b.priority] ?? 3
      if (pa !== pb) return pa - pb
      // 按时间倒序
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  })

  const selectedEvent = computed(() => {
    if (!selectedEventId.value) return null
    return events.value.find(e => e.id === selectedEventId.value) || null
  })

  // 统计数据
  const stats = computed(() => {
    const all = events.value
    return {
      total: all.length,
      pending: all.filter(e => e.status === 'pending').length,
      processing: all.filter(e => e.status === 'processing').length,
      resolved: all.filter(e => e.status === 'resolved').length,
      critical: all.filter(e => e.priority === 'critical').length,
      important: all.filter(e => e.priority === 'important').length,
      normal: all.filter(e => e.priority === 'normal').length
    }
  })

  function selectEvent(eventId) {
    selectedEventId.value = eventId
    isDrawerOpen.value = true
  }

  function closeDrawer() {
    isDrawerOpen.value = false
    selectedEventId.value = null
  }

  function setFilter(status) {
    filterStatus.value = status
  }

  function updateEventStatus(eventId, status) {
    const event = events.value.find(e => e.id === eventId)
    if (event) {
      event.status = status
      event.timeline.push({
        time: new Date().toISOString(),
        action: `状态变更为：${status === 'processing' ? '处理中' : status === 'resolved' ? '已解决' : '待处理'}`
      })
    }
  }

  // 拖拽排序
  function reorderEvents(newOrder) {
    // newOrder 是事件 id 数组，按新顺序排列
    const map = {}
    events.value.forEach(e => { map[e.id] = e })
    events.value = newOrder.map(id => map[id]).filter(Boolean)
  }

  // 会话管理
  const sessions = ref({
    general: [],
    event: {}
  })

  const activeSessionKey = ref('general')

  function getSessionMessages(sessionKey) {
    if (sessionKey === 'general') return sessions.value.general
    if (!sessions.value.event[sessionKey]) {
      sessions.value.event[sessionKey] = []
    }
    return sessions.value.event[sessionKey]
  }

  function addMessage(sessionKey, message) {
    if (sessionKey === 'general') {
      sessions.value.general.push(message)
    } else {
      if (!sessions.value.event[sessionKey]) {
        sessions.value.event[sessionKey] = []
      }
      sessions.value.event[sessionKey].push(message)
    }
  }

  function switchSession(sessionKey) {
    activeSessionKey.value = sessionKey
  }

  return {
    events,
    selectedEventId,
    filterStatus,
    isDrawerOpen,
    filteredEvents,
    sortedEvents,
    selectedEvent,
    stats,
    selectEvent,
    closeDrawer,
    setFilter,
    updateEventStatus,
    reorderEvents,
    sessions,
    activeSessionKey,
    getSessionMessages,
    addMessage,
    switchSession
  }
})
