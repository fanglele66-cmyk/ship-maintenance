import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  events as mockEvents, EVENT_STATUS, STAGE_NODES,
  PRIORITY_META, SOURCE_META, DEVICE_STATUS
} from '@/mock'
import { useDeviceStore } from './deviceStore'
import { useShipStore } from './shipStore'

/**
 * 事件检修状态管理（V1.0 核心模块）
 * 状态流：待确认 → 处理中 → 临时处理 → 已解决；待确认 → 误报
 * 阶段节点：确认 → 排查 → 维修 → 归档
 */
export const useRepairStore = defineStore('repair', () => {
  const events = ref(JSON.parse(JSON.stringify(mockEvents)))
  const currentEventId = ref(null)
  const activeTab = ref('ai')   // 详情页当前 Tab（自动定位用）

  const STATUS_LABELS = {
    [EVENT_STATUS.PENDING]: '待确认',
    [EVENT_STATUS.PROCESSING]: '处理中',
    [EVENT_STATUS.TEMP_HANDLED]: '临时处理',
    [EVENT_STATUS.RESOLVED]: '已解决',
    [EVENT_STATUS.FALSE_ALARM]: '误报'
  }

  // ============ Getters ============
  const currentEvent = computed(() =>
    events.value.find(e => e.id === currentEventId.value) || null
  )

  // 状态统计（含临时处理）
  const statusStats = computed(() => {
    const stats = { pending: 0, processing: 0, temp_handled: 0, resolved: 0, false_alarm: 0 }
    events.value.forEach(e => { stats[e.status]++ })
    return stats
  })

  // 待处理事件（未解决/未误报）
  const activeEvents = computed(() =>
    events.value.filter(e =>
      e.status !== EVENT_STATUS.RESOLVED && e.status !== EVENT_STATUS.FALSE_ALARM
    )
  )

  // 排序规则：紧急程度高→低 → 更新时间近→远 → 进度后→前 → 来源人工>AI
  const sourceRank = { crew: 3, inspection: 2, ai: 1 }
  const sortedEvents = computed(() => {
    return [...events.value].sort((a, b) => {
      const pa = PRIORITY_META[a.priority].rank
      const pb = PRIORITY_META[b.priority].rank
      if (pb !== pa) return pb - pa
      if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1
      if (b.stageIndex !== a.stageIndex) return b.stageIndex - a.stageIndex
      return (sourceRank[b.source] || 0) - (sourceRank[a.source] || 0)
    })
  })

  // 最新待处理事件（首页右侧列表，时间倒序）
  const latestActiveEvents = computed(() =>
    [...activeEvents.value].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1)
  )

  // 设备关联事件数
  function eventCountByDevice(deviceId) {
    return events.value.filter(e =>
      e.deviceId === deviceId &&
      e.status !== EVENT_STATUS.RESOLVED &&
      e.status !== EVENT_STATUS.FALSE_ALARM
    ).length
  }

  // ============ Actions ============
  function selectEvent(id) {
    currentEventId.value = id
    // 自动定位到当前阶段 Tab
    autoLocateTab(id)
  }

  /** 进入详情页自动定位 Tab（按当前阶段） */
  function autoLocateTab(id) {
    const ev = events.value.find(e => e.id === id)
    if (!ev) return
    if (ev.status === EVENT_STATUS.PENDING) activeTab.value = 'ai'
    else if (ev.status === EVENT_STATUS.PROCESSING) activeTab.value = ev.stageIndex >= 2 ? 'todo' : 'todo'
    else if (ev.status === EVENT_STATUS.TEMP_HANDLED) activeTab.value = 'log'
    else activeTab.value = 'log'
  }

  function setTab(tab) { activeTab.value = tab }

  /**
   * 推进事件状态
   * pending → processing (stageIndex 1 排查)
   * processing(temp阶段1) → 维修 stageIndex 2
   * processing(维修) → temp_handled / resolved
   * temp_handled → resolved
   */
  function advanceEvent(eventId, action, payload = {}) {
    const ev = events.value.find(e => e.id === eventId)
    if (!ev) return false
    const operator = payload.operator || '当前用户'
    const note = payload.note || ''
    const now = formatNow()

    if (action === 'confirm') {
      // 待确认 → 处理中(排查)
      ev.status = EVENT_STATUS.PROCESSING
      ev.stageIndex = 1
      appendLog(ev, '确认', '事件已确认，进入排查', operator, now)
      ev.progressSummary = '排查中：待执行排查项'
    } else if (action === 'to_repair') {
      // 排查 → 维修
      ev.stageIndex = 2
      appendLog(ev, '维修', '排查完成，进入维修阶段', operator, now)
      ev.progressSummary = '维修中：待执行维修项'
    } else if (action === 'temp_handle') {
      ev.status = EVENT_STATUS.TEMP_HANDLED
      ev.stageIndex = 2
      appendLog(ev, '维修', `临时处理：${note || '已临时处置'}`, operator, now)
      ev.progressSummary = '临时处理：待彻底排查/复装'
    } else if (action === 'resolve') {
      ev.status = EVENT_STATUS.RESOLVED
      ev.stageIndex = 2
      appendLog(ev, '归档', `事件已解决并归档：${note || '处理完成'}`, operator, now)
      ev.progressSummary = '已归档：事件闭环'
      // 联动设备恢复正常
      useDeviceStore().updateDeviceStatus(ev.deviceId, DEVICE_STATUS.NORMAL)
    } else if (action === 'false_alarm') {
      ev.status = EVENT_STATUS.FALSE_ALARM
      ev.stageIndex = 1
      appendLog(ev, '确认', `标记误报：${note || '经核实为误报'}`, operator, now)
      ev.progressSummary = '误报：事件关闭'
      useDeviceStore().updateDeviceStatus(ev.deviceId, DEVICE_STATUS.NORMAL)
    }
    ev.updatedAt = now

    // 通知
    useShipStore().addNotification({
      type: action === 'resolve' ? 'success' : 'info',
      title: `状态变更：${ev.title} → ${STATUS_LABELS[ev.status]}`,
      eventId: ev.id,
      kind: 'change'
    })
    useShipStore().addPendingSync()
    return true
  }

  function appendLog(ev, stage, title, content, operator, time) {
    ev.logs.unshift({ time, stage, title, content, operator })
  }

  /** 排查项反馈 */
  function submitInspection(eventId, todoId, result, detail, operator = '当前用户') {
    const ev = events.value.find(e => e.id === eventId)
    if (!ev) return
    const t = ev.todos.inspections.find(x => x.id === todoId)
    if (!t) return
    t.result = result
    t.detail = detail
    t.operator = operator
    t.time = formatNow()
    t.defaultFold = true
    appendLog(ev, '排查', `排查项反馈：${t.title}`, `判定${result === 'normal' ? '正常' : '异常'}。${detail}`, operator, t.time)
    ev.updatedAt = t.time
    useShipStore().addPendingSync()
  }

  /** 维修项反馈 */
  function submitRepair(eventId, todoId, result, detail, operator = '当前用户') {
    const ev = events.value.find(e => e.id === eventId)
    if (!ev) return
    const r = ev.todos.repairs.find(x => x.id === todoId)
    if (!r) return
    r.result = result
    r.detail = detail
    r.operator = operator
    r.time = formatNow()
    r.defaultFold = true
    appendLog(ev, '维修', `维修项反馈：${r.title}`, `处理情况：${result === 'resolved' ? '已解决' : result === 'partial' ? '部分完成' : '临时处理'}。${detail}`, operator, r.time)
    ev.updatedAt = r.time
    useShipStore().addPendingSync()
  }

  /** 新建事件（异常上报入口），含事件去重 */
  function createEvent({ deviceId, deviceName, systemPart, title, description, priority = 'medium', source = 'crew', sensorId }) {
    // 去重：同设备同系统同现象(标题)的待处理事件归并
    const dup = events.value.find(e =>
      e.deviceId === deviceId && e.title === title &&
      e.status !== EVENT_STATUS.RESOLVED && e.status !== EVENT_STATUS.FALSE_ALARM
    )
    if (dup) {
      appendLog(dup, '确认', '重复报警归并', `同设备同现象重复上报，归并至本事件：${description}`, '当前用户', formatNow())
      dup.updatedAt = formatNow()
      useShipStore().addNotification({ type: 'info', title: `重复报警已归并：${title}`, eventId: dup.id, kind: 'new' })
      return dup
    }
    const newEvent = {
      id: `EVT-2026-${String(43 + events.value.length).padStart(4, '0')}`,
      title, systemPart, deviceId, deviceName,
      priority, source,
      status: EVENT_STATUS.PENDING,
      stageIndex: 0,
      createdAt: formatNow(),
      updatedAt: formatNow(),
      description,
      progressSummary: '待确认：船员上报，待人工确认',
      aiAnalysis: {
        conclusion: '初步AI分析中：根据上报信息匹配历史案例，生成排查建议',
        causes: [{ cause: '待排查确认', consequence: '待评估', probability: '待定' }],
        basis: '基于上报描述的初步推断',
        snapshot: sensorId ? [{ name: '上报传感器', value: '-', unit: '', range: [0, 0], status: 'warning' }] : []
      },
      todos: { inspections: [{ id: 'T1', title: '现场核实异常现象', defaultFold: false, result: null, detail: '', operator: '', time: '' }], repairs: [] },
      logs: [{ time: formatNow(), stage: '确认', title: '船员上报异常', content: description, operator: '当前用户' }]
    }
    events.value.unshift(newEvent)
    useDeviceStore().updateDeviceStatus(deviceId, DEVICE_STATUS.DANGER)
    useShipStore().addNotification({ type: priority === 'high' ? 'danger' : 'warning', title: `新事件：${title}`, eventId: newEvent.id, kind: 'new' })
    useShipStore().addPendingSync()
    return newEvent
  }

  function formatNow() {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // 首页异常趋势数据
  function anomalyTrendData(hours = 24) {
    const pts = Math.max(hours, 6)
    const data = []
    const now = new Date()
    for (let i = pts - 1; i >= 0; i--) {
      const t = new Date(now - i * 3600000)
      const pad = n => String(n).padStart(2, '0')
      const time = `${pad(t.getHours())}:00`
      // 模拟：近期异常略多
      const base = i < 3 ? [1, 2, 1][i] : 0
      const rand = Math.random() > 0.85 ? 1 : 0
      data.push({ time, count: base + rand })
    }
    return data
  }

  return {
    events, currentEventId, activeTab,
    STATUS_LABELS, STAGE_NODES,
    currentEvent, statusStats, activeEvents, sortedEvents, latestActiveEvents,
    eventCountByDevice, selectEvent, setTab,
    advanceEvent, submitInspection, submitRepair, createEvent,
    anomalyTrendData, formatNow
  }
})
