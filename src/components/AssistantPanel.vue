<template>
  <aside class="assistant-panel" :style="panelStyle">
    <!-- 拖拽调宽手柄（auxiliary 模式下由父级 SituationView 控制） -->
    <div
      v-if="mode !== 'auxiliary'"
      class="resize-handle"
      @mousedown="startResize"
      @dblclick="resetWidth"
      title="拖拽调整宽度 · 双击重置"
    ></div>
    <!-- Header -->
    <div class="assistant-header" :class="{ 'event-assistant-header': props.mode === 'event' }">
      <span v-if="props.mode !== 'event'" class="mode-tag" :class="modeClass">{{ modeLabel }}</span>
      <span class="assistant-title">
        <svg class="sparkle-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 1.5l.8 2.5a5.5 5.5 0 0 0 3.2 3.2l2.5.8-2.5.8a5.5 5.5 0 0 0-3.2 3.2L8 14.5l-.8-2.5a5.5 5.5 0 0 0-3.2-3.2L1.5 8l2.5-.8a5.5 5.5 0 0 0 3.2-3.2L8 1.5z"/>
        </svg>
        {{ props.mode === 'event' ? '事件助手' : 'AI 助手' }}
      </span>
      <span v-if="props.mode !== 'event' && currentStageLabel" class="stage-pill">{{ currentStageLabel }}</span>
    </div>

    <div v-if="props.mode === 'event' && props.eventContext" class="event-context-bar compact-event-link">
      <span class="ecb-link-label">已关联</span>
      <span class="ecb-name" :title="props.eventContext.title">{{ props.eventContext.title }}</span>
    </div>

    <!-- Messages -->
    <div class="messages-area" ref="messagesRef">
      <!-- 空态：欢迎 + 概览 -->
      <template v-if="messages.length === 0">
        <div class="msg msg-ai welcome-msg">{{ greetingText }}</div>
        <div v-if="summaryHtml" class="msg msg-ai summary-msg" v-html="summaryHtml"></div>
      </template>

      <!-- 消息列表（带入场动画） -->
      <template v-for="(msg, idx) in messages" :key="idx">
        <div class="msg" :class="msg.role === 'user' ? 'msg-user' : 'msg-ai'">
          <!-- AI 头像 -->
          <div v-if="msg.role === 'assistant'" class="assistant-avatar">
            <span class="avatar-dot"></span><span class="avatar-ring"></span>
          </div>

          <!-- === 6 种消息卡片 === -->
          <!-- 类型0：普通文本 -->
          <div v-if="!msg.cardType" class="msg-content" v-html="getStreamContent(msg, idx)"></div>

          <!-- 类型1：诊断分析卡 🧠 -->
          <div v-else-if="msg.cardType === 'diagnosis'" class="msg-card diagnosis-card">
            <div class="card-badge">🧠 AI 诊断分析</div>
            <div class="card-body">
              <div class="diag-conclusion">
                <div class="diag-label">判定结论</div>
                <div class="diag-text">{{ msg.content }}</div>
              </div>
              <div v-if="msg.faults && msg.faults.length" class="diag-faults">
                <div class="diag-label">可能故障</div>
                <div v-for="(f, i) in msg.faults" :key="i" class="diag-fault-row">
                  <span class="df-dot" :class="f.probability"></span>
                  <span class="df-name">{{ f.name }}</span>
                  <span class="df-bar"><span class="df-bar-fill" :style="{ width: f.match + '%', background: f.color }"></span></span>
                  <span class="df-pct">{{ f.match }}%</span>
                </div>
              </div>
              <div class="diag-suggestion">{{ msg.suggestion }}</div>
              <div class="diag-meta">基于 {{ msg.snapshotTime || '事发时' }} 快照数据分析 · 事件关联系统自动触发</div>
            </div>
          </div>

          <!-- 类型2：数据快照卡 📊 -->
          <div v-else-if="msg.cardType === 'snapshot'" class="msg-card snapshot-card">
            <div class="card-badge">📊 事发数据快照</div>
            <div class="card-body">
              <div class="snap-time">🕐 {{ msg.snapshotTime }}</div>
              <div class="snap-grid">
                <div v-for="(s, i) in (msg.sensors || [])" :key="i" class="snap-item" :class="'snap-' + s.status">
                  <div class="snap-name">{{ s.name }}</div>
                  <div class="snap-val">{{ s.value }}<span class="snap-unit">{{ s.unit }}</span></div>
                  <div class="snap-ref">{{ s.range ? '范围 ' + s.range : '阈值 ' + s.threshold + s.unit }}</div>
                  <div class="snap-status">{{ s.status === 'over' ? '⚠ 超限' : s.status === 'warning' ? '⚡ 预警' : '✓ 正常' }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 类型3：操作引导卡 ⚡（紧凑版，点击展开） -->
          <div v-else-if="msg.cardType === 'guide'" class="msg-card guide-card">
            <div class="card-badge">⚡ {{ msg.guideTitle || '操作指引' }}</div>
            <div v-if="msg.guideIntro" class="guide-intro">{{ msg.guideIntro }}</div>
            <div class="guide-steps">
              <div v-for="(s, i) in (msg.steps || [])" :key="i" class="guide-step" @click="toggleGuideStep(i)">
                <span class="gs-num">{{ i + 1 }}</span>
                <div class="gs-body">
                  <div class="gs-title">{{ s.title }} <span class="gs-toggle">{{ msg._expandedSteps?.[i] ? '▲' : '▼' }}</span></div>
                  <div v-if="msg._expandedSteps?.[i]" class="gs-detail">{{ s.detail }}</div>
                </div>
              </div>
            </div>
            <div class="guide-hint">👆 点击各步骤查看详细内容和检查要点</div>
          </div>

          <!-- 类型4：警告提示卡 ⚠ -->
          <div v-else-if="msg.cardType === 'warning'" class="msg-card warning-card" :class="'warn-' + (msg.warnLevel || 'danger')">
            <div class="warn-icon">{{ msg.warnLevel === 'danger' ? '🚨' : '⚠️' }}</div>
            <div class="warn-body">
              <div class="warn-title">{{ msg.warnTitle || '注意事项' }}</div>
              <ul class="warn-list">
                <li v-for="(w, i) in (msg.items || [])" :key="i">{{ w }}</li>
              </ul>
            </div>
          </div>

          <!-- 类型6：通用模式主动追问卡（HTML内容） -->
          <div v-else-if="msg.cardType === 'proactive'" class="msg-content" v-html="getStreamContent(msg, idx)"></div>

          <!-- 类型5：状态报告卡 ✅ -->
          <div v-else-if="msg.cardType === 'report'" class="msg-card report-card">
            <div class="report-banner">
              <span class="rb-icon">✓</span>
              <span class="rb-text">{{ msg.reportTitle || '处理完成' }}</span>
            </div>
            <div class="report-body">
              <div class="rb-metrics" v-if="msg.metrics && msg.metrics.length">
                <div v-for="(m, i) in msg.metrics" :key="i" class="rb-metric">
                  <div class="rbm-label">{{ m.label }}</div>
                  <div class="rbm-value" :class="m.highlight ? 'rbm-hl' : ''">{{ m.value }}</div>
                </div>
              </div>
              <div v-if="msg.conclusion" class="rb-conclusion">📝 {{ msg.conclusion }}</div>
            </div>
          </div>
        </div>
      </template>

      <!-- 正在输入 -->
      <div v-if="isTyping" class="msg msg-ai typing-msg">
        <div class="assistant-avatar"><span class="avatar-dot"></span><span class="avatar-ring"></span></div>
        <div class="msg-content typing-bubble">
          <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
        </div>
      </div>

      <!-- 猜你想问 -->
      <div v-if="recommendedQuestions.length > 0" class="msg msg-ai">
        <div class="msg-bubble chips-bubble">
          <div class="chips-hint">{{ recLabel }}</div>
          <div class="rec-chips">
            <button v-for="(q, idx) in recommendedQuestions" :key="idx"
              class="rec-chip"
              :class="q.action !== 'send' ? 'rec-chip-cta' : ''"
              :style="q.highlight ? 'border-color:var(--accent);color:var(--accent);background:var(--accent-bg);font-weight:600' : ''"
              @click="handleRecommendedClick(q)">
              {{ q.text }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="input-area">
      <div class="input-wrapper">
        <input v-model="inputText" type="text" class="chat-input" placeholder="描述你的问题..." @keyup.enter="sendMessage" />
        <button class="mic-btn" :class="{ recording: isRecording }" @click="toggleVoice" :title="isRecording ? '录音中' : '语音输入'">
          <svg v-if="!isRecording" class="mic-svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="7" y="2" width="6" height="10" rx="3"/><path d="M4 10a6 6 0 0 0 12 0"/><line x1="10" y1="15" x2="10" y2="18"/><line x1="7" y1="18" x2="13" y2="18"/>
          </svg>
          <span v-else class="waveform"><span class="wf-bar" v-for="n in 5" :key="n"></span></span>
        </button>
        <span v-if="isRecording" class="ripple-ring r1"></span>
        <span v-if="isRecording" class="ripple-ring r2"></span>
        <span v-if="isRecording" class="ripple-ring r3"></span>
      </div>
      <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim() && !isRecording">
        <svg class="send-svg" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="9" y1="1" x2="9" y2="17"/><polyline points="4 6 9 1 14 6"/>
        </svg>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, reactive, inject } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { useSensorStore } from '@/stores/sensorStore'
import { eventPriorityLabels, eventStatusLabels } from '@/mock/events'

const props = defineProps({
  mode: { type: String, default: 'general' },
  eventContext: { type: Object, default: null },
  // true=填满剩余空间（事件中心，已有事件列表占位）；false=按页面占比宽度（态势页，更宽默认）
  fillRemaining: { type: Boolean, default: false }
})
const emit = defineEmits(['chip-click'])
const eventStore = useEventStore()
const deviceStore = useDeviceStore()
const sensorStore = useSensorStore()
const messagesRef = ref(null)
const inputText = ref('')
const isRecording = ref(false)
const isTyping = ref(false)
const priorityLabels = eventPriorityLabels
const statusLabels = eventStatusLabels

// ============ 拖拽调宽（占比：默认 50%，可拖拽 36%~60%）============
const RESIZE_STORAGE_KEY = 'assistant-panel-width-pct'
const MIN_RATIO = 0.36
const MAX_RATIO = 0.60
const DEFAULT_RATIO = 0.50
const customPct = ref(null)
const windowWidth = ref(window.innerWidth)

function onWindowResize() { windowWidth.value = window.innerWidth }

function loadSavedWidth() {
  const saved = localStorage.getItem(RESIZE_STORAGE_KEY)
  if (saved) {
    const pct = parseFloat(saved)
    // 旧存档可能超出新范围，重新 clamp 进来
    if (pct >= MIN_RATIO && pct <= MAX_RATIO) customPct.value = pct
  }
}

const panelStyle = computed(() => {
  // auxiliary 模式：宽度由 SituationView 父级控制
  if (props.mode === 'auxiliary') return {}
  // iPad 及以下（≤1024px）：用 flex 自适应填充
  if (windowWidth.value <= 1024) return {}
  // fillRemaining：事件中心场景，助手填满剩余空间
  if (props.fillRemaining) return {}
  // 其他场景：按百分比宽度
  const pct = customPct.value || DEFAULT_RATIO
  const vw = (pct * 100).toFixed(2)
  return { flex: `0 0 ${vw}vw`, minWidth: `calc(${vw}vw)`, maxWidth: `calc(${vw}vw)` }
})

function startResize(e) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  const vw = window.innerWidth
  // 从 DOM 读取实际渲染宽度（flex 填充时比 DEFAULT_RATIO 大得多）
  const panel = e.target.closest('.assistant-panel')
  const startW = panel ? panel.getBoundingClientRect().width : vw * DEFAULT_RATIO

  const onMouseMove = (ev) => {
    const delta = startX - ev.clientX
    const newPct = (startW + delta) / vw
    customPct.value = Math.min(Math.max(newPct, MIN_RATIO), MAX_RATIO)
  }
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (customPct.value !== null) localStorage.setItem(RESIZE_STORAGE_KEY, customPct.value.toString())
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resetWidth() {
  customPct.value = null
  localStorage.removeItem(RESIZE_STORAGE_KEY)
}

onMounted(() => {
  loadSavedWidth()
  window.addEventListener('resize', onWindowResize)
})

// ============ 共享状态（从 EventCenterView 注入，兄弟组件共用）============
const eventUnread = inject('eventUnread', reactive({}))
const eventStage = inject('eventStage', reactive({}))
const eventAssistantAction = inject('eventAssistantAction', reactive({}))
const eventAssistantCommand = inject('eventAssistantCommand', reactive({}))
const eventSituationTabs = inject('eventSituationTabs', reactive({}))
const totalUnread = inject('totalUnread', ref(0))
// 本地状态
const followupSent = reactive({})
let proactiveTimer = null
// 态势上下文（inject from SituationView）
const situationContext = inject('situationContext', null)

// ============ 阶段定义 ============
const STAGES = {
  S1: { label: '事件关联', followup: '' },
  S2: { label: '排查中', followup: '排查进行中，请继续逐项排查。如有任何发现随时告诉我。' },
  S4: { label: '维修中', followup: '维修方案已生成，请按步骤执行维修操作。完成后告知验收结果。' },
  S5: { label: '已闭环', followup: '' }
}

// ============ 迭代排查状态机 ============
const checkItems = reactive({})  // { [eventId]: { 1: {state, result}, 2: ... } }
const currentCheckIdx = reactive({})  // { [eventId]: number }
const repairDone = reactive({}) // { [eventId+'|'+idx]: true }

function initCheckItems(eventId) {
  checkItems[eventId] = {
    1: { state: 'pending', title: 'T1 · 液压系统故障排查' },
    2: { state: 'pending', title: 'T2 · 系统或油柜吸口堵塞排查' },
    3: { state: 'pending', title: 'T3 · 压力传感器故障排查' },
    4: { state: 'pending', title: 'T4 · 系统管线泄漏排查' }
  }
  currentCheckIdx[eventId] = 1
  Object.keys(repairDone).forEach(k => { if (k.startsWith(eventId + '|')) delete repairDone[k] })
}

// ============ 显示 ============
const greetingText = computed(() => {
  const stats = eventStore.stats
  return props.mode === 'event' && props.eventContext
    ? `已切换到「${props.eventContext.title}」，AI 正在为您分析事件数据…`
    : `你好，当前共有 ${stats.total} 件事件，其中 ${stats.pending} 件待处理。`
})

const summaryHtml = computed(() => {
  if (props.mode !== 'general') return ''
  const stats = eventStore.stats
  return `<div class="summary-block">
    <div class="summary-row"><span class="summary-label">船舶健康分</span><span class="summary-value" style="color:var(--success)">82</span></div>
    <div class="summary-row"><span class="summary-label">事件统计</span><span class="summary-value"><span style="color:var(--danger)">紧急 ${stats.critical}</span> / <span style="color:var(--warning)">重要 ${stats.important}</span> / <span style="color:var(--accent)">一般 ${stats.normal}</span></span></div>
    <div class="summary-row"><span class="summary-label">重点关注</span><span class="summary-value" style="color:var(--warning)">主机系统水温异常需优先处理</span></div>
  </div>`
})

const modeClass = computed(() => props.mode === 'event' ? 'event-mode' : props.mode === 'auxiliary' ? 'aux-mode' : 'gen-mode')
const modeLabel = computed(() => props.mode === 'event' ? '事件模式' : props.mode === 'auxiliary' ? '辅助模式' : '通用模式')
const currentStageLabel = computed(() => {
  if (props.mode !== 'event' || !props.eventContext) return ''
  const s = eventStage[props.eventContext.id]; if (!s) return ''
  return STAGES[s]?.label || ''
})

const messages = computed(() => {
  const key = props.mode === 'event' && props.eventContext ? props.eventContext.id : props.mode === 'general' ? 'general' : 'situation'
  return eventStore.getSessionMessages(key)
})

// ============ 流式输出 ============
const streamingState = reactive({})  // { idx: 'current typed text' }
let prevMsgLen = 0

function startStream(idx, fullText) {
  // 按词/tag切分，保证 HTML 标签完整性
  const parts = fullText.split(/(<[^>]+>|\s+)/g).filter(Boolean)
  let pos = 0
  streamingState[idx] = ''
  const timer = setInterval(() => {
    streamingState[idx] = parts.slice(0, pos + 1).join('')
    pos++
    if (pos >= parts.length) {
      clearInterval(timer)
      delete streamingState[idx]
    }
  }, 16)
}

function getStreamContent(msg, idx) {
  if (msg.role !== 'assistant') return msg.content
  if (streamingState[idx] !== undefined) {
    return streamingState[idx] + '<span class="cursor-blink">▍</span>'
  }
  return msg.content
}

watch(messages, (list) => {
  if (list.length > prevMsgLen) {
    for (let i = prevMsgLen; i < list.length; i++) {
      if (list[i].role === 'assistant') {
        startStream(i, list[i].content)
      }
    }
  }
  prevMsgLen = list.length
}, { immediate: true })

// ============ Chips ============
const recommendedQuestions = ref([])
const recLabel = computed(() => messages.value.length > 0 ? '猜你想问' : '试试问我')

function getChipsByContext() {
  if (props.mode === 'general') {
    const criticalEvents = eventStore.events.filter(e => e.priority === 'critical' && e.status !== 'resolved')
    const hasProactive = messages.value.some(m => m.role === 'assistant' && (m.content || '').includes('紧急事件'))

    if (hasProactive && criticalEvents.length > 0) {
      return [
        { text: '立即进入事件详情处理', action: 'goto_event', eventId: criticalEvents[0].id, highlight: true },
        { text: '今天有几件紧急事件？', action: 'send' },
        { text: '有没有重复出现的故障？', action: 'send' }
      ]
    }
    return [
      { text: '今天有几件紧急事件？', action: 'send' },
      { text: '最近哪个系统问题最多？', action: 'send' },
      { text: '有没有重复出现的故障？', action: 'send' }
    ]
  }
  if (props.mode === 'event' && props.eventContext) {
    const ec = props.eventContext; const stage = eventStage[ec.id] || 'S1'
    const action = eventAssistantAction[ec.id]
    if (stage === 'S1') {
      // 基于左侧实际解锁状态推荐下一步
      const tabs = eventSituationTabs[ec.id]
      const unlocked = tabs?.unlocked || { summary: true }
      const hasData = unlocked.data
      const hasWorkload = unlocked.workload
      
      if (!hasData) {
        return [
          { text: '查看数据与趋势图', action: 'open_data', highlight: true },
          { text: '分析相关工况', action: 'open_workload' }
        ]
      }
      if (!hasWorkload) {
        return [
          { text: '分析相关工况', action: 'open_workload', highlight: true },
          { text: '进入排查处置', action: 'start_check' }
        ]
      }
      // 事件情况模块已看全
      return [
        { text: '进入排查处置', action: 'start_check', highlight: true },
        { text: '标记为误报', action: 'mark_false_alarm' }
      ]
    }
    if (stage === 'S2') {
      return []
    }
    if (stage === 'S4') {
      const action = eventAssistantAction[ec.id]
      // 排查/维修过程不再用右侧猜你想问抢焦点，左侧卡片内完成确认、反馈与验收。
      if (action?.startsWith('repair_not_fixed_') || action === 'warning' || action?.startsWith('check_abnormal_')) {
        return []
      }
      if (action === 'repair_solved') {
        return [
          { text: '确认闭环，无需补充', action: 'confirm_close', highlight: true },
          { text: '还有其它要补充', action: 'manual_close_form' }
        ]
      }
      if (action === 'needs_manual_close') {
        return [{ text: '手动登记处理反馈', action: 'manual_close_form', highlight: true }]
      }
      return []
    }
    if (stage === 'S5') {
      // 已闭环，无需推荐提问
      return []
    }
  }
  // 辅助模式（态势感知）
  if (props.mode === 'auxiliary' && situationContext) {
    const ctx = situationContext
    if (ctx.layer === 1) {
      return [
        { text: '查看主机系统传感器', action: 'send' },
        { text: '哪些设备有异常？', action: 'send' },
        { text: '船舶健康状态如何？', action: 'send' }
      ]
    }
    if (ctx.layer === 2 && ctx.device) {
      return [
        { text: `查看${ctx.device.name}的详细趋势`, action: 'send' },
        { text: '生成事件快照', action: 'send' },
        { text: '该设备历史维保记录', action: 'send' }
      ]
    }
    if (ctx.layer === 3 && ctx.sensor) {
      const s = ctx.sensor
      if (s.status !== 'normal') {
        return [
          { text: '生成事件快照并跳转', action: 'send' },
          { text: '查看同类传感器对比', action: 'send' },
          { text: '异常原因分析', action: 'send' }
        ]
      }
      return [
        { text: '查看近24小时趋势', action: 'send' },
        { text: '对比历史同期数据', action: 'send' }
      ]
    }
    return []
  }

  return []
}
function refreshChips() { recommendedQuestions.value = getChipsByContext() }

// ============ 阶段推进 ============
function setStage(eventId, stage) {
  if (!eventId) return
  const prev = eventStage[eventId]; eventStage[eventId] = stage
  if (prev !== stage) {
    delete followupSent[eventId + '|S2']; delete followupSent[eventId + '|S4']; delete followupSent[eventId + '|S5']
  }
}

// ============ 未读 ============
function incUnread(eventId) { if (eventId) eventUnread[eventId] = (eventUnread[eventId] || 0) + 1 }
function clearUnread(eventId) { if (eventId) eventUnread[eventId] = 0 }

function pushMsg(eventId, msg) {
  if (!eventId) return
  eventStore.addMessage(eventId, { role: 'assistant', ts: Date.now(), ...msg, content: msg.content || '' })
  const inDetail = props.mode === 'event' && props.eventContext?.id === eventId
  if (!inDetail) incUnread(eventId)
  // 有 cardType 的信号才传给产物区，避免覆盖 chip 用的 eventAssistantAction
  if (msg.cardType) {
    eventAssistantAction[eventId] = msg.cardType
  }
  nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight })
}

function scrollToBottom() { nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight }) }

// ============ 定时追问 ============
let followupTimers = {}
function clearFollowupTimers(eventId) {
  Object.keys(followupTimers).forEach(k => { if (k.startsWith(eventId + '|')) { clearTimeout(followupTimers[k]); delete followupTimers[k] } })
}
function scheduleFollowup(eventId) {
  if (!eventId) return
  const stage = eventStage[eventId]; if (!stage || stage === 'S1') return
  const dedupKey = eventId + '|' + stage; if (followupSent[dedupKey]) return
  followupTimers[dedupKey] = setTimeout(() => {
    pushMsg(eventId, { content: STAGES[stage].followup })
    followupSent[dedupKey] = true
  }, 6000)
}

// ============ 初始化 —— 核心：自动推送诊断卡片 ============
function initEventSession(eventId) {
  if (!eventId) return
  if (!eventStage[eventId]) eventStage[eventId] = 'S1'
  clearUnread(eventId)
  clearFollowupTimers(eventId)
  initCheckItems(eventId)
  const sess = eventStore.getSessionMessages(eventId)
  if (sess.length === 0) {
    incUnread(eventId)
    const ev = props.eventContext
    const sensor = ev?.snapshot?.sensors?.[0]
    const deviceText = ev?.system || '相关设备'
    pushMsg(eventId, {
      content: `${deviceText}检测到事件：<b>${ev?.title || ''}</b>。${sensor ? `当前关键指标 <b>${sensor.name}</b> ${sensor.value}${sensor.unit}。` : ''}左侧<b>事件情况</b>已整理完毕。`,
      cardType: null
    })
    eventAssistantAction[eventId] = 'open_summary'
  }
  refreshChips()
}

// ============ 构建诊断卡片 ============
function pushDiagnosisCard(eventId, ev) {
  const analysis = ev.aiAnalysis
  pushMsg(eventId, {
    cardType: 'diagnosis',
    content: analysis.summary,
    faults: (analysis.faultTable || []).map(f => ({
      name: f.name, probability: f.probability,
      match: f.probability === 'high' ? 82 : f.probability === 'medium' ? 56 : 28,
      color: f.probability === 'high' ? 'var(--danger)' : f.probability === 'medium' ? 'var(--warning)' : 'var(--success)'
    })),
    suggestion: analysis.suggestions,
    snapshotTime: ev.createdAt ? new Date(ev.createdAt).toLocaleString('zh-CN') : '事发时'
  })
}

// ============ 构建快照卡片 ============
function pushSnapshotCard(eventId, ev) {
  const sensors = ev.snapshot?.sensors || []
  pushMsg(eventId, {
    cardType: 'snapshot',
    content: '传感器快照',
    snapshotTime: ev.createdAt ? new Date(ev.createdAt).toLocaleString('zh-CN') : '',
    sensors: sensors.slice(0, 6)
  })
}

// ============ 构建排查引导卡片 ============
function pushGuideCard(eventId, ev) {
  const title = ev?.snapshot?.sensors?.[0]?.name || '主参数'
  pushMsg(eventId, {
    cardType: 'guide',
    guideTitle: '排查方案',
    guideIntro: `针对「${ev.title || ''}」已生成标准排查流程，点击各步骤展开详情：`,
    _expandedSteps: {}, // 全部默认折叠
    steps: [
      { title: '外观与渗漏检查', detail: '目视检查相关管路、接头、焊缝，确认无渗漏。检查支架是否松动，有无异常振动痕迹。使用内窥镜检查管路内壁结垢与腐蚀情况。对异常部位多角度拍照留存。' },
      { title: '关键参数测量', detail: `使用红外测温仪沿管路扫描，记录各点温度。比对${title}进出口温度差，验证换热效率。使用超声波流量计复核实时流量。导出近 24h 趋势数据，与历史同期对比分析。` },
      { title: '核心部件拆检', detail: '拆检冷却水滤器，观察滤芯脏污程度并拍照。测量淡水侧换热面温度，判断是否结垢。拆下温控阀检查阀芯是否卡滞、密封是否失效。提取油/水样送化验室检测。' },
      { title: '数据记录与反馈', detail: '记录所有排查数据，填写《排查记录表》。对异常项标记并拍照。汇总排查结论，完成后在助手中回复"已完成排查"提交结果。' }
    ]
  })
}

// ============ 构建警告卡片 ============
function pushWarningCard(eventId) {
  pushMsg(eventId, {
    cardType: 'warning',
    warnLevel: 'danger',
    warnTitle: '重要安全警告',
    items: [
      '作业前确保主机停机断电，相关阀门关闭，安全标识已挂',
      '佩戴防护用具（护目镜、防烫手套），谨防烫伤与机械伤害',
      '记录所有原始数据后再行拆装，不要直接调整温控阀',
      '如需进入受限空间，必须办理许可证并落实气体检测'
    ]
  })
}

// ============ 构建状态报告卡片 ============
function pushReportCard(eventId, ev) {
  pushMsg(eventId, {
    cardType: 'report',
    reportTitle: '维修完成 · 验收通过',
    metrics: [
      { label: '维修结果', value: '已修复', highlight: true },
      { label: '处理耗时', value: '4 小时 32 分' },
      { label: '开始时间', value: ev?.createdAt ? new Date(ev.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' },
      { label: '完成时间', value: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
    ],
    conclusion: '冷却水滤器清洗更换完毕，换热面化学清洗完成，温控阀检修调试通过。出口温度稳定78°C，流量92m³/h，无渗漏，验收通过。建议将滤器纳入月度巡检重点对象。'
  })
}

// ============ 监听 ============
// 态势感知：跟随左侧操作自动分析
if (situationContext) {
  let lastAction = null
  watch(() => situationContext.action, (action) => {
    if (!action || action === lastAction) return
    lastAction = action
    const sessionKey = 'situation'
    const ctx = situationContext

    if (action === 'enter_layer' && ctx.layer === 1) {
      setTimeout(() => {
        const devs = deviceStore.devices
        const dangerDevs = devs.filter(d => d.status === 'danger')
        const warnDevs = devs.filter(d => d.status === 'warning')
        eventStore.addMessage(sessionKey, {
          role: 'assistant', ts: Date.now(),
          content: `欢迎查看船舶态势面板。<br><br>📡 <b>设备总览</b>：${devs.length} 台在线<br>${dangerDevs.length ? '🔴 <b style=\"color:var(--danger)\">'+dangerDevs.length+' 台异常</b><br>' : ''}${warnDevs.length ? '🟡 <b style=\"color:var(--warning)\">'+warnDevs.length+' 台预警</b><br>' : ''}✅ 健康分 <b style=\"color:var(--success)\">82</b><br><br>点击浮动设备卡片查看详情。`
        })
        refreshChips()
      }, 500)
    }

    if (action === 'select_device' && ctx.device) {
      const d = ctx.device
      setTimeout(() => {
        const content = generateDeviceAnalysisHtml(d)
        eventStore.addMessage(sessionKey, { role: 'assistant', ts: Date.now(), content })
        refreshChips()
      }, 400)
    }

    // 点击传感器不再自动推送助手消息
  }, { immediate: true })
}

watch(() => props.eventContext?.id, (newId, oldId) => {
  if (props.mode !== 'event') { recommendedQuestions.value = getChipsByContext(); return }
  if (oldId && oldId !== newId) clearFollowupTimers(oldId)
  if (newId) initEventSession(newId)
}, { immediate: true })
watch(() => props.mode, (newMode) => {
  if (newMode === 'general') {
    refreshChips()
    if (proactiveTimer) clearTimeout(proactiveTimer)
    proactiveTimer = setTimeout(() => pushGeneralProactive(), 3000)
  } else {
    if (proactiveTimer) { clearTimeout(proactiveTimer); proactiveTimer = null }
  }
}, { immediate: true })
watch(() => messages.value.length, () => refreshChips())
watch(() => eventStore.selectedEventId, (id) => { if (!id) { Object.keys(followupTimers).forEach(k => clearTimeout(followupTimers[k])); followupTimers = {} } })

// ============ 排查/维修伴随消息库 ============
const CHECK_NORMAL_MSGS = {
  0: `✅ <b>液压系统故障排查</b> —— 油箱外观、管路接头、密封件各检查点均无异常，外观及液位数值一致。<br><br>已自动进入 <b>吸口堵塞排查</b>（4步 · 15个关键点），重点检查吸口滤网、负压值、沉积物和回油过滤器状态。请继续按左侧方案执行。`,
  1: `✅ <b>吸口堵塞排查</b> —— 滤网通畅、负压正常、油液品质无异常表现，成功排除了堵塞类因素。<br><br>接下来排查 <b>压力传感器故障</b>（4步 · 15个关键点），核心确认传感器校验、供电回路与信号干扰情况。结合 AI 分析，根因可能出在采集环节而非机械本体。`,
  2: `✅ <b>压力传感器故障排查</b> —— 读数校验通过、供电电压稳定 24V±3%、信号无噪声干扰，传感器及回路均无异常。<br><br>进入最后一环 <b>系统管线泄漏排查</b>（5步 · 19个关键点），沿管路走向逐段检查接头焊缝、执行机构密封和油箱附件。排查进入收官阶段。`,
  3: `✅ <b>系统管线泄漏排查</b> —— 各接头焊缝、执行机构密封均无泄漏痕迹，管线状态良好。<br><br>四项排查已全部完成。`
}

const REPAIR_NOT_FIXED_MSGS = {
  0: `⚠️ <b>液压系统</b> 维修后问题仍未消除。建议结合维修记录升级处理策略，必要时联系岸基技术支持。<br><br>已自动进入下一排查项 <b>吸口堵塞排查</b>（4步 · 15个关键点），请继续按左侧方案逐项排查其它可能原因。`,
  1: `⚠️ <b>吸口堵塞</b> 维修未解决。滤网已清洁、油液已更换，但症状依旧——原因很可能不在管路侧。<br><br>已进入 <b>压力传感器故障排查</b>（4步 · 15个关键点），重点校验传感器本体的准确性和信号回路。`,
  2: `⚠️ <b>压力传感器</b> 换新后问题仍复现，已彻底排除传感器本体故障。<br><br>已进入最后一环 <b>系统管线泄漏排查</b>（5步 · 19个关键点），沿管路逐段排查接头焊缝与密封件状态。`,
  3: `⚠️ <b>系统管线</b> 维修后仍未根除。四项排查均已尝试维修但问题依旧。<br><br>建议升级处置：联系岸基技术支持或安排坞修检查。`
}
watch(() => eventAssistantAction[props.eventContext?.id], (action) => {
  if (!action || !props.eventContext) return
  const eid = props.eventContext.id
  const ev = props.eventContext

  // ========== 排查项正常 → 下一项 ==========
  if (action.startsWith('check_normal_')) {
    const parts = action.split('|')
    const idx = parseInt(parts[0].split('_').pop())  // 当前项
    const nextIdx = parseInt(parts[1])                // 下一项
    setTimeout(() => {
      pushMsg(eid, { cardType: null, content: CHECK_NORMAL_MSGS[idx] || `✅ T${idx + 1} 排查正常，已进入 T${nextIdx + 1}。` })
      refreshChips()
    }, 400)
  }

  // ========== 维修未解决 → 下一项 ==========
  if (action.startsWith('repair_not_fixed_')) {
    const parts = action.split('|')
    const idx = parseInt(parts[0].split('_').pop())
    const nextIdx = parseInt(parts[1])
    setTimeout(() => {
      pushMsg(eid, { cardType: null, content: REPAIR_NOT_FIXED_MSGS[idx] || `⚠️ T${idx + 1} 维修未解决，已进入 T${nextIdx + 1}。` })
      refreshChips()
    }, 400)
  }

  // 单项异常 → 弹出维修方案卡片
  if (action.startsWith('check_abnormal_')) {
    setTimeout(() => {
      const idx = parseInt(action.split('_').pop())
      const titles = ['液压系统故障', '吸口堵塞', '压力传感器故障', '管线泄漏']
      const title = titles[idx] || ('T' + (idx + 1))
      pushMsg(eid, {
        cardType: null,
        content: `<b>${title}</b> 的排查反馈显示存在异常。左侧已打开对应<b>维修项</b>，里面包含注意事项、维修步骤、备件清单与验收标准。<br><br>请按左侧执行，完成后在这里反馈“修好了”或“仍异常”。`
      })
      refreshChips()
    }, 400)
  }

  // 单项维修通过 → 找下一项或闭环
  if (action === 'item_repaired_next') {
    setTimeout(() => {
      pushMsg(eid, {
        cardType: null,
        content: `✅ 维修通过！<br><br>左侧已自动进入下一流程。如有其它异常项目需继续排查，或所有项目均处理完毕可进入维修报告闭环。`
      })
      refreshChips()
    }, 400)
  }

  // 单项维修失败 → 继续排查
  if (action === 'item_not_fixed') {
    setTimeout(() => {
      pushMsg(eid, {
        cardType: null,
        content: `了解，该项维修未解决问题。<br><br>建议先排查其它项，或联系岸基技术支持。左侧已激活下一项排查，请继续。`
      })
      refreshChips()
    }, 400)
  }

  // 兼容旧动作：异常后进入维修
  if (action === 'repair') {
    setTimeout(() => {
      pushMsg(eid, {
        cardType: null,
        content: `排查反馈已收到，左侧已切到对应维修项。请按维修步骤处理，完成后反馈结果。`
      })
      refreshChips()
    }, 500)
  }

  // 事件闭环 → 推送报告卡片
  if (action === 'report') {
    setTimeout(() => {
      pushReportCard(eid, ev)
      pushMsg(eid, {
        cardType: null,
        content: `事件已关闭。后续关注：${ev?.title || ''}的长期运行趋势，建议安排定期巡检。`
      })
      refreshChips()
    }, 500)
  }

  // 维修已解决 → 推送确认闭环 chip
  if (action === 'repair_solved') {
    setTimeout(() => {
      pushMsg(eid, {
        cardType: null,
        content: `维修已完成，事件记录已更新。`
      })
      // 确保不被后续 watch 覆盖
      eventAssistantAction[eid] = 'repair_solved'
      refreshChips()
    }, 400)
  }

  // 需手动闭环 → 推送手动登记 chip
  if (action === 'needs_manual_close') {
    setTimeout(() => {
      pushMsg(eid, {
        cardType: null,
        content: `全部排查已完成。`
      })
      refreshChips()
    }, 400)
  }

  // 未解决，继续排查
  if (action === 'restart_check') {
    // 未解决，继续排查
    setTimeout(() => {
      pushMsg(eid, {
        cardType: null,
        content: `了解，维修未完全解决异常。左侧已回到排查方案，请对异常项进行新一轮排查。`
      })
      refreshChips()
    }, 400)
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  Object.keys(followupTimers).forEach(k => clearTimeout(followupTimers[k]))
  if (proactiveTimer) clearTimeout(proactiveTimer)
})

// ============ 通用模式主动追问 ============
function pushGeneralProactive() {
  const stats = eventStore.stats
  const criticalEvents = eventStore.events.filter(e => e.priority === 'critical' && e.status !== 'resolved')
  const importantEvents = eventStore.events.filter(e => e.priority === 'important' && e.status !== 'resolved')

  if (criticalEvents.length > 0) {
    const ev = criticalEvents[0]
    const sessionKey = 'general'
    const html = `<div class="proactive-card">
      <div class="pac-header">
        <span class="pac-icon">🔴</span>
        <span class="pac-title">紧急事件提醒</span>
        <span class="pac-count">${criticalEvents.length}</span>
      </div>
      <div class="pac-body">
        <div class="pac-event-title">${ev.title}</div>
        <div class="pac-event-meta">系统：${ev.system} · 时间：${new Date(ev.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
        <div class="pac-question">需要我帮您进入事件详情吗？</div>
      </div>
    </div>`
    eventStore.addMessage(sessionKey, {
      role: 'assistant',
      ts: Date.now(),
      cardType: 'proactive',
      content: html
    })
    refreshChips()
  } else if (importantEvents.length > 0) {
    const ev = importantEvents[0]
    eventStore.addMessage('general', {
      role: 'assistant',
      ts: Date.now(),
      content: `当前有 <b style="color:var(--warning)">${importantEvents.length} 件重要事件</b>需要关注。最新的是「<b>${ev.title}</b>」。需要我帮您进入详情吗？`
    })
    refreshChips()
  }
}

// ============ 排查步骤展开/折叠 ============
function toggleGuideStep(stepIdx) {
  if (messages.value.length === 0) return
  const lastMsg = messages.value[messages.value.length - 1]
  if (!lastMsg || lastMsg.cardType !== 'guide') return
  if (!lastMsg._expandedSteps) lastMsg._expandedSteps = {}
  lastMsg._expandedSteps[stepIdx] = !lastMsg._expandedSteps[stepIdx]
  // 触发重渲染
  refreshChips()
}

// ============ Chips 点击 ============
function handleRecommendedClick(q) {
  if (q.action === 'view_ai') { handleViewAi(); return }
  if (q.action === 'open_data' || q.action === 'open_trend' || q.action === 'open_workload') { handleOpenEventModule(q.action); return }
  if (q.action === 'start_check') { startIterativeCheck(); return }
  if (q.action === 'start_check_item') { startCheckItem(); return }
  if (q.action === 'check_fault') { handleCheckResult('fault_found'); return }
  if (q.action === 'check_ok') { handleCheckResult('no_fault'); return }
  if (q.action === 'repair_fixed') { handleRepairResult('fixed'); return }
  if (q.action === 'repair_not_fixed') { handleRepairResult('not_fixed'); return }
  if (q.action === 'continue_next') { continueNextCheck(); return }
  if (q.action === 'goto_event' && q.eventId) { eventStore.selectEvent(q.eventId); return }
  if (q.action === 'snooze') { handleSnooze(); return }
  if (q.action === 'mark_false_alarm') { handleMarkFalseAlarm(); return }
  if (q.action === 'confirm_close') { handleConfirmClose(); return }
  if (q.action === 'manual_close_form') { handleManualCloseForm(); return }
  // 排查/维修 chip → 通过 eventAssistantAction 通知 ProductDrawer
  if (q.action === 'chip_check_normal' || q.action === 'chip_open_feedback' || q.action === 'chip_repair_solved' || q.action === 'chip_repair_not_fixed') {
    handleChipAction(q.action)
    return
  }
  inputText.value = q.text; sendMessage()
}

// ============ 排查/维修快速反馈 chip → 通知 ProductDrawer ============
const CHIP_LABELS = {
  chip_check_normal: '一切正常，继续排查',
  chip_open_feedback: '登记异常反馈',
  chip_repair_solved: '修好了，事件已解决',
  chip_repair_not_fixed: '维修了，但事件仍异常'
}
const feedbackGuideTs = reactive({})
function handleChipAction(chipAction) {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  const label = CHIP_LABELS[chipAction] || chipAction
  eventStore.addMessage(eid, { role: 'user', content: label, ts: Date.now() })
  scrollToBottom()
  eventAssistantCommand[eid] = chipAction + '|' + Date.now()
  refreshChips()

  // 登记异常反馈：左侧只会滚到反馈区不会回消息，需要助手立即补一条引导
  if (chipAction === 'chip_open_feedback') {
    const now = Date.now()
    if (!feedbackGuideTs[eid] || now - feedbackGuideTs[eid] > 2000) {
      feedbackGuideTs[eid] = now
      pushMsg(eid, {
        content: '左侧当前<b>排查项</b>已经定位到反馈区。请按步骤选择现场结果，提交后我会继续判断下一步。' +
          '<div style="margin-top:4px;padding:4px 8px;background:var(--bg-hover);border-radius:4px;font-size:12px;color:var(--text-muted);">也可以直接输入：油箱外壁焊缝处有明显渗漏油渍。</div>'
      })
      scrollToBottom()
    }
  }
}

const EVENT_MODULE_TEXT = {
  open_data: {
    user: '查看数据与趋势图',
    left: '数据概览',
    reply: '左侧已打开<b>数据概览</b>——上方为各监控项当前值，点击可切换下方趋势图。'
  },
  open_workload: {
    user: '分析相关工况',
    left: '工况分析',
    reply: '左侧已切换到<b>工况分析</b>，含候选故障匹配和可能影响。'
  }
}

function handleOpenEventModule(action) {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  const config = EVENT_MODULE_TEXT[action]
  if (!config) return
  eventStore.addMessage(eid, { role: 'user', content: config.user, ts: Date.now() })
  eventAssistantAction[eid] = action
  // 同步更新 eventSituationTabs，不依赖 ProductDrawer 的 watch 时序
  const tabKey = action === 'open_data' ? 'data' : action === 'open_workload' ? 'workload' : null
  if (tabKey) {
    if (!eventSituationTabs[eid]) eventSituationTabs[eid] = reactive({ unlocked: { summary: true }, active: 'summary' })
    eventSituationTabs[eid].unlocked = { ...eventSituationTabs[eid].unlocked, [tabKey]: true }
    eventSituationTabs[eid].active = tabKey
  }
  pushMsg(eid, { content: config.reply })
  refreshChips()
  scrollToBottom()
}

function handleViewAi() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '查看事件概况', ts: Date.now() })
  eventAssistantAction[eid] = 'open_summary'
  pushMsg(eid, {
    content: '左侧现在是<b>事件概况</b>：基础信息、AI 初步结论和处置建议在同一块里。你可以继续看数据概览或直接进入排查。'
  })
  refreshChips()
  scrollToBottom()
}

// ============ 标记为误报 ============
function handleMarkFalseAlarm() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '标记为误报', ts: Date.now() })
  scrollToBottom()
  setTimeout(() => {
    pushMsg(eid, { content: '请描述一下<b>实际工况或现场情况</b>，我会记录在事件报告中。例如：该告警触发时设备处于停机检修状态，并非实际故障。' })
    // 标记进入误报追问状态，等待用户输入
    eventAssistantAction[eid] = 'false_alarm_followup'
    refreshChips()
  }, 400)
}

// ============ 暂不处理 ============
function handleSnooze() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '暂不处理，稍晚些提醒我', ts: Date.now() })
  scrollToBottom()
  setTimeout(() => {
    pushMsg(eid, { content: '好的，2 小时后提醒你。事件仍可能在持续变化，建议尽快处理 👍。你随时可以在左侧事件列表点击回来继续。' })
    refreshChips()
    // 2小时后自动追问
    setTimeout(() => {
      if (eventStage[eid] === 'S1') {
        pushMsg(eid, { content: '⏰ 提醒：2 小时前你暂缓了「<b>' + (props.eventContext?.title || '') + '</b>」。是否需要开始排查？' })
        refreshChips()
      }
    }, 2 * 60 * 60 * 1000) // 2 hours
  }, 400)
}

// ============ 确认闭环 ============
function handleConfirmClose() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '确认闭环，无需补充', ts: Date.now() })
  scrollToBottom()
  setTimeout(() => {
    pushMsg(eid, { content: '已确认闭环，事件处理完成。' })
    eventStage[eid] = 'S5'
    refreshChips()
  }, 400)
}

// ============ 手动登记处理反馈 ============
function handleManualCloseForm() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '手动登记处理反馈', ts: Date.now() })
  scrollToBottom()
  setTimeout(() => {
    pushMsg(eid, {
      cardType: null,
      content: `📝 <b>请描述实际异常情况与处理方式</b>，完成后自动记录并闭环。<br><br>
        <div style="padding:10px;background:var(--bg-hover);border-radius:6px;border:1px dashed var(--border-primary);color:var(--text-muted);font-size:var(--font-base);line-height:1.7">
        <b>格式参考：</b><br>
        实际异常：___<br>
        处理方式：___<br>
        备注：___
        </div><br>
        请直接在输入框描述，例如："<b>检查发现传感器接头松动，已重新紧固并校准，当前读数正常。</b>"`
    })
    eventAssistantAction[eid] = 'manual_close_followup'
    refreshChips()
  }, 400)
}

// ============ 迭代排查：用户点击"开始排查" → 推第一项 ============
function startIterativeCheck() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  const ev = props.eventContext
  eventStore.addMessage(eid, { role: 'user', content: '进入排查处置', ts: Date.now() })
  eventStage[eid] = 'S2'
  scrollToBottom()
  setTimeout(() => {
    pushMsg(eid, {
      cardType: null,
      content: `已进入排查。接下来先看左侧当前排查项的注意事项，确认后在左侧继续推进步骤和反馈，我会在提交结果后再提示下一步。`
    })
    const p = eventStore.events.find(e => e.id === eid)
    if (p?.snapshot) {
      eventAssistantAction[eid] = 'check_activate_first'
    }
    refreshChips()
  }, 400)
}

// ============ 开始排查当前项 ============
function startCheckItem() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '开始排查', ts: Date.now() })
  setTimeout(() => pushCheckItemGuide(eid), 400)
}

// ============ 迭代排查：助手推送当前排查项引导 ============
function pushCheckItemGuide(eventId) {
  const idx = currentCheckIdx[eventId] || 1
  const item = checkItems[eventId][idx]
  item.state = 'checking'
  const ev = props.eventContext
  const sensor = ev?.snapshot?.sensors?.[0] || {}
  const eSteps = getCheckStepDetail(idx)

  pushMsg(eventId, {
    cardType: 'guide',
    guideTitle: `排查 ${idx}/4：${item.title}`,
    guideIntro: `基于当前事件「${ev?.title || ''}」
分 ${eSteps.length} 个步骤，共涉及关键检查点。请逐项检查后标记 ✓正常 或 ⚠异常。
有异常的关键点可补充文字描述，系统会自动汇总步骤结果和排查项结果。`,
    steps: eSteps
  })
  refreshChips()
}

function getCheckStepDetail(idx) {
  const all = {
    1: [
      {title:'油箱外观及液位计检查',detail:'目视检查油箱外壁焊缝处有无渗漏油渍。检查油箱底部放油堵有无湿润痕迹。对比液位计读数与远程监控值是否一致。检查液位计上下连通阀是否处于全开位置。'},
      {title:'初始数据记录',detail:'拍照记录液位计当前读数。记录液压油温度（正常范围40~70℃）。读取系统压力表稳态值（正常16~21MPa）。记录电机运行电流。'},
      {title:'管路接头及软管段检查',detail:'重点检查高压管路法兰接头有无油渍。检查软管段有无鼓包/老化/龟裂/渗油。检查管路支架/卡箍处有无摩擦磨损痕迹。检查弯头、三通等应力集中部位有无湿润。'}
    ],
    2: [
      {title:'吸油口滤网状态',detail:'拆检吸口滤器有无堵塞/异物附着。记录滤网表面杂质类型和沉积量。评估滤网通流面积减少百分比。检查滤网骨架有无变形/破损。'},
      {title:'吸口负压值测量',detail:'在额定流量下读取吸入侧真空表数值。对比历史正常负压基准判断有无异常阻力。在不同转速工况下记录负压变化趋势。若负压超过-0.08MPa需立即清洗滤器。'},
      {title:'油箱底部沉积物检查',detail:'打开放油旋塞取样底部油液。观察有无金属屑/水分/絮状物。用磁铁检查铁磁性颗粒含量。评估是否需要彻底清洗油箱内部。'}
    ],
    3: [
      {title:'压力传感器校验',detail:'使用标准传感器对核心监控传感器进行参照校验。记录校验前后读数偏差。检查传感器供电回路是否稳定（24V±5%）。排查信号回路有无接地或短路。'},
      {title:'电磁干扰排查',detail:'检查传感器电缆屏蔽层接地是否良好。排查附近有无大功率设备启动干扰。使用示波器观察信号是否存在高频噪声。检查传感器安装支架有无振动松动。'}
    ],
    4: [
      {title:'高压管路分段检查',detail:'沿管路走向逐段目视检查接头、焊缝有无油渍。重点检查弯头、三通等应力集中部位。检查管路固定支架处有无磨损渗漏。检查法兰密封垫片处有无湿润痕迹。'},
      {title:'执行机构密封检查',detail:'检查液压缸活塞杆处有无外泄漏。检查液压马达轴封处有无渗油。观察执行机构动作是否平稳无爬行。测量执行机构端盖温度判断内部泄漏。'},
      {title:'记录并拍照',detail:'对每个可疑泄漏点拍照标记坐标位置。在管路图上标注所有泄漏点位置。按严重程度分级（严重/中等/轻微）。整理泄漏点清单供维修参考。'}
    ]
  }
  return all[idx] || []
}

// ============ 迭代排查：用户反馈排查结果 ============
function handleCheckResult(resultType) {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  const idx = currentCheckIdx[eid] || 1
  checkItems[eid][idx].result = resultType

  eventStore.addMessage(eid, { role: 'user', content: resultType === 'fault_found' ? '发现了异常' : '这项没问题', ts: Date.now() })

  if (resultType === 'fault_found') {
    checkItems[eid][idx].state = 'fault_found'
    eventStage[eid] = 'S4'  // 进入维修阶段
    eventAssistantAction[eid] = 'repair'
    setTimeout(() => {
      const rd = getRepairDetail(idx)
      pushMsg(eid, {
        cardType: 'guide',
        guideTitle: `维修方案 · ${checkItems[eid][idx].title}`,
        guideIntro: `排查项 T${idx} 确认异常，根因指向该项相关部位。
左侧产物区已展开维修方案，包含 ${rd.length} 个维修流程、安全警告和验收标准。

请按步骤执行维修操作。备件清单和注意事项见产物区「维修方案」卡片。`,
        steps: rd
      })
      refreshChips()
    }, 500)
  } else {
    checkItems[eid][idx].state = 'no_fault'
    eventAssistantAction[eid] = 'check_done'
    setTimeout(() => {
      const nextIdx = idx + 1
      if (checkItems[eid][nextIdx]) {
        pushMsg(eid, {
          cardType: 'guide',
          guideTitle: `排查 ${idx} 通过 · 下一项：${checkItems[eid][nextIdx].title}`,
          guideIntro: `排查项 T${idx} 未发现异常，已自动排除。继续排查下一项，是否开始？`,
          steps: [{title:'已排查通过',detail:'该项所有关键检查点均正常。系统已自动标记为排除。'}]
        })
      } else {
        pushMsg(eid, {
          cardType: 'guide',
          guideTitle: '全部排查完成',
          guideIntro: '4 项排查全部完成。未发现明显故障根因。建议升级处理：联系岸基技术支持或安排坞修检查。',
          steps: [{title:'升级处理',detail:'请联系岸基技术支持或安排坞修检查。可将排查记录导出供岸基参考。'}]
        })
      }
      refreshChips()
    }, 400)
  }
}

function getRepairDetail(idx) {
  const all = {
    1: [{title:'清洗管路/更换密封',detail:'关闭阀门系统泄压。对渗漏点焊接修补或更换密封垫片。试压确认无渗漏。'}],
    2: [{title:'化学清洗换热面',detail:'隔离换热器，5%柠檬酸液加温至50-60°C循环清洗4小时。每30分钟检测pH与含铁量。排空后用清水冲洗至pH=7。'}],
    3: [{title:'更换滤芯',detail:'关闭进出口阀门泄压。取出旧滤芯检查壳体内壁。安装新滤芯(100μm)，密封圈涂润滑脂。试压无渗漏。'},{title:'检修温控阀',detail:'断电隔离，拆下阀体检查密封面。清理沉积物研磨密封面，更换老化密封圈。通电调试确认阀位反馈线性度。'}],
    4: [{title:'全面检查与归档',detail:'汇总所有维修记录。执行功能性验证测试。确认所有验收标准达标后归档。'}]
  }
  return all[idx] || [{title:'执行标准维修流程',detail:'按SOP操作，完成后功能验证。'}]
}

// ============ 用户反馈维修结果 ============
function handleRepairResult(resultType) {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  const idx = currentCheckIdx[eid] || 1

  eventStore.addMessage(eid, { role: 'user', content: resultType === 'fixed' ? '修好了，验收通过' : '没修好，问题还在', ts: Date.now() })

  if (resultType === 'fixed') {
    checkItems[eid][idx].state = 'verified'
    eventAssistantAction[eid] = 'repair_verified'
    setTimeout(() => {
      const nextIdx = idx + 1
      if (checkItems[eid][nextIdx]) {
        pushMsg(eid, { content: `✅ 排查项 ${idx} 已修复并验证通过。<br><br>是否还有其他异常？如需继续排查下一项「<b>${checkItems[eid][nextIdx].title}</b>」请告诉我。` })
      } else {
        eventStage[eid] = 'S5'
        eventAssistantAction[eid] = 'report'
        pushReportCard(eid, props.eventContext)
      }
      refreshChips()
    }, 500)
  } else {
    checkItems[eid][idx].state = 'repair_failed'
    setTimeout(() => {
      const nextIdx = idx + 1
      if (checkItems[eid][nextIdx]) {
        pushMsg(eid, { content: `⚠️ 排查项 ${idx} 修复后问题未解决。建议继续排查「<b>${checkItems[eid][nextIdx].title}</b>」。` })
      } else {
        pushMsg(eid, { content: '所有排查项已尝试修复但问题依然存在。建议升级处理：联系岸基技术支持或安排坞修检查。' })
      }
      refreshChips()
    }, 500)
  }
}

// ============ 继续下一项排查 ============
function continueNextCheck() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  currentCheckIdx[eid] = (currentCheckIdx[eid] || 1) + 1
  eventStore.addMessage(eid, { role: 'user', content: '继续排查下一项', ts: Date.now() })
  setTimeout(() => pushCheckItemGuide(eid), 400)
}

// ============ 普通发送 ============
function sendMessage() {
  const text = inputText.value.trim(); if (!text) return
  const sessionKey = props.mode === 'event' && props.eventContext ? props.eventContext.id : props.mode === 'general' ? 'general' : 'situation'
  eventStore.addMessage(sessionKey, { role: 'user', content: text, ts: Date.now() })
  inputText.value = ''; scrollToBottom()

  // 误报追问中 → 用户回复后完成误报闭环
  if (props.eventContext && eventAssistantAction[props.eventContext.id] === 'false_alarm_followup') {
    isTyping.value = true
    setTimeout(() => {
      isTyping.value = false
      const response = '已记录你的反馈：<b>"' + text + '"</b>。该事件已标记为<b>误报</b>并闭环。'
      eventStore.addMessage(sessionKey, { role: 'assistant', content: response, ts: Date.now() })
      scrollToBottom(); refreshChips()
      // 触发产物区：事件记录卡片展开
      eventAssistantAction[props.eventContext.id] = 'false_alarm_closed'
      if (eventStage[props.eventContext.id]) {
        eventStage[props.eventContext.id] = 'false_alarm'
      }
    }, 600)
    return
  }

  // 手动闭环追问中 → 用户回复后完成闭环
  if (props.eventContext && eventAssistantAction[props.eventContext.id] === 'manual_close_followup') {
    isTyping.value = true
    setTimeout(() => {
      isTyping.value = false
      const feedbackText = text
      const response = '已记录处理反馈，事件已手动闭环。<br><br>左侧事件记录已更新。'
      eventStore.addMessage(sessionKey, { role: 'assistant', content: response, ts: Date.now() })
      scrollToBottom(); refreshChips()
      // 把反馈内容传给产物区
      eventAssistantAction[props.eventContext.id] = 'manual_close_done|' + feedbackText
      eventStage[props.eventContext.id] = 'S5'
    }, 600)
    return
  }

  // 排查阶段自然语言反馈 → 先自动填充左侧当前排查卡，不直接提交
  if (props.eventContext && props.mode === 'event' && eventStage[props.eventContext.id] === 'S2') {
    const parsed = parseCheckFeedbackText(text)
    if (parsed) {
      const eid = props.eventContext.id
      eventAssistantCommand[eid] = `nl_check_feedback|${parsed.key}|${encodeURIComponent(text)}|${Date.now()}`
      isTyping.value = true
      setTimeout(() => {
        isTyping.value = false
        eventStore.addMessage(sessionKey, {
          role: 'assistant',
          content: `已识别到排查反馈：<b>${parsed.label}</b>。<br><br>我已先帮你填到左侧当前排查步骤里，请确认后点击左侧「提交排查反馈」。`,
          ts: Date.now()
        })
        scrollToBottom(); refreshChips()
      }, 500)
      return
    }
  }

  isTyping.value = true
  setTimeout(() => {
    isTyping.value = false
    const response = generateAIResponse(text)
    eventStore.addMessage(sessionKey, { role: 'assistant', content: response, ts: Date.now() })
    scrollToBottom(); refreshChips()
  }, 900)
}

function parseCheckFeedbackText(text) {
  const t = String(text || '').toLowerCase()
  const rules = [
    {
      key: 'tank_weld_leak_obvious',
      label: '油箱焊缝有明显渗漏油渍',
      test: () => /油箱|外壁|焊缝/.test(t) && /明显|严重|持续/.test(t) && /渗漏|漏油|油渍/.test(t)
    },
    {
      key: 'tank_weld_wet',
      label: '油箱焊缝有湿润痕迹',
      test: () => /油箱|外壁|焊缝/.test(t) && /湿润|潮湿|油痕/.test(t)
    },
    {
      key: 'hose_crack_leak',
      label: '软管段龟裂或渗油',
      test: () => /软管/.test(t) && /龟裂|裂纹|渗油|漏油/.test(t)
    },
    {
      key: 'flange_oil_stain',
      label: '法兰接头发现油渍',
      test: () => /法兰|接头/.test(t) && /油渍|渗油|漏油/.test(t)
    },
    {
      key: 'filter_block_severe',
      label: '吸口滤网严重堵塞',
      test: () => /滤网|滤器|吸口/.test(t) && /严重堵塞|堵死|大量杂质/.test(t)
    },
    {
      key: 'sensor_deviation_obvious',
      label: '传感器读数明显偏差',
      test: () => /传感器|读数|校验/.test(t) && /明显偏差|偏差很大|失准/.test(t)
    }
  ]
  return rules.find(r => r.test()) || null
}

function generateAIResponse(text) {
  const t = text.toLowerCase()

  if (props.mode === 'general') return generateGeneralResponse(t)
  if (props.mode === 'event' && props.eventContext) return generateEventResponse(t, props.eventContext)
  if (props.mode === 'auxiliary') return generateSituationResponse(t)

  return `已收到：「${text}」。`
}

// ============ 通用模式：4 个故事线 ============
function generateGeneralResponse(t) {
  const stats = eventStore.stats

  // 故事线1：询问紧急事件
  if (/紧急|critical|处理/.test(t)) {
    if (stats.critical > 0) {
      const criticalEvents = eventStore.events.filter(e => e.priority === 'critical' && e.status !== 'resolved')
      const ev = criticalEvents[0]
      return `目前有 <b style="color:var(--danger)">${stats.critical} 件紧急事件</b>待处理。最新的一件是「<b>${ev?.title || '主机冷却水温异常'}</b>」(${ev?.id || 'EVT-2026-001'})，${ev?.system || '主机系统'}，发生于 ${ev ? new Date(ev.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '14:05'}。建议优先处理这件 — 点击事件查看详情，AI 助手会引导你完成全流程。`
    }
    return '当前没有紧急事件。'
  }

  // 故事线2：询问系统问题
  if (/系统|设备|机器/.test(t)) {
    const sysCount = {}
    eventStore.events.forEach(e => {
      if (e.status !== 'resolved' && e.system) sysCount[e.system] = (sysCount[e.system] || 0) + 1
    })
    const top = Object.entries(sysCount).sort((a, b) => b[1] - a[1])[0]
    if (top) {
      return `最近 <b>${top[0]}</b> 的问题最多，<b>${top[1]}</b> 件相关未解决事件。建议关注该系统的运行参数和维保计划。`
    }
    return '当前各系统运行平稳，暂无集中性故障。'
  }

  // 故事线3：询问重复故障
  if (/重复|常见|频率/.test(t)) {
    return `本月共有 <b>${stats.pending + stats.processing}</b> 件未结事件。冷却系统相关故障占比 <b style="color:var(--warning)">33%</b>，主要集中在主机和辅机系统。建议安排一次系统性的冷却回路检查。`
  }

  // 故事线4：维保建议
  if (/维保|维护|保养/.test(t)) {
    const pendingMaint = eventStore.events.filter(e => e.source === 'maintenance_schedule' && e.status !== 'resolved')
    return `当前有 <b>${pendingMaint.length} 件维保提醒</b>待处理。最近到期的是「<b>${pendingMaint[0]?.title || '3号泵计划维保'}</b>」，${pendingMaint[0]?.system || '泵系统'}。我建议优先处理冷却泵维保 — 错过维保周期会加速设备老化。`
  }

  // 故事线5：船舶健康
  if (/健康|评分|运行/.test(t)) {
    return `船舶健康分 <b style="color:var(--success)">82</b>分，处于良好区间。但 <b style="color:var(--danger)">${stats.critical} 件紧急事件</b> 正在影响整体评分，建议优先处置。`
  }

  // 故事线6：知识库
  if (/知识|案例|参考|文档/.test(t)) {
    return `知识库有 <b>79</b> 篇技术文档：18 篇故障案例、28 篇操作规程、24 篇设备手册、9 篇技术通告。你可以从左侧导航进入「知识」模块浏览。事件详情页也会自动推荐相关案例。`
  }

  // 故事线7：流量/数据
  if (/多少|数量|统计|总/.test(t)) {
    return `当前总事件数 <b>${stats.total}</b>：待处理 <b style="color:var(--warning)">${stats.pending}</b>、处理中 <b style="color:var(--accent)">${stats.processing}</b>、已解决 <b style="color:var(--success)">${stats.resolved}</b>。按严重程度：紧急 <b style="color:var(--danger)">${stats.critical}</b>、重要 <b style="color:var(--warning)">${stats.important}</b>、一般 <b style="color:var(--accent)">${stats.normal}</b>。`
  }

  // 故事线8：报告/分析
  if (/报告|分析|总结/.test(t)) {
    return `我可以帮您生成事件分析报告。点击任意事件进入详情，AI 助手会引导你完成从分析到维修的全流程。报告会自动归档到产物区。`
  }

  // 默认
  return `已收到：「${text}」。我正在分析您的问题…您可以问我：<br>• 紧急/重要事件统计<br>• 各系统故障情况<br>• 重复故障模式<br>• 维保计划状态<br>• 船舶健康评分`
}

// ============ 事件模式：上下文感知回复 ============
function generateEventResponse(t, ev) {
  const analysis = ev.aiAnalysis || {}
  const sensors = ev.snapshot?.sensors || []
  const overSensors = sensors.filter(s => s.status === 'over')
  const warnSensors = sensors.filter(s => s.status === 'warning')

  // 原因/推断
  if (/原因|为什么|推断/.test(t)) {
    if (analysis.faultTable?.length) {
      const f = analysis.faultTable[0]
      return `根据数据综合分析，<b>${f.name}</b>是可能性最高的原因（匹配度 <b style="color:var(--danger)">82%</b>）。判断依据：${f.detail}<br><br>同时存在 ${analysis.faultTable.length - 1} 个候选原因，完整列表见右侧 AI 诊断卡片。`
    }
    return '当前事件为维保提醒类，无故障候选分析。'
  }

  // 数据/快照
  if (/快照|传感器|数据|当时/.test(t)) {
    if (overSensors.length > 0) {
      const s = overSensors[0]
      return `关键异常数据：<b style="color:var(--danger)">${s.name}</b> = <b>${s.value}${s.unit}</b>（阈值 ${s.threshold}${s.unit}），超限 <b>${(((s.value - s.threshold) / s.threshold) * 100).toFixed(1)}%</b>。完整快照数据见左侧产物区。`
    }
    return '快照数据已冻结在事发时。完整快照数据见左侧产物区。'
  }

  // 排查/步骤
  if (/排查|步骤|怎么做/.test(t)) {
    if (overSensors.length > 0) {
      return `建议从<b>${overSensors[0].name}</b>入手排查：<br>1. 检查相关管路外观和渗漏<br>2. 测量进出口温度差<br>3. 拆检关键滤器<br>4. 记录原始数据<br><br>点击「进入排查下一步」，左侧会新增当前排查项表单。`
    }
    return '已为您准备好标准排查方案。点击「进入排查下一步」，左侧会新增当前排查项表单。'
  }

  // 误报
  if (/误报|没事|忽略/.test(t)) {
    return '✅ 已标记为<b>疑似误报</b>。事件将转入观察池，<b>24 小时</b>内若不再触发则自动关闭。如果短期内再次触发，会自动恢复为待处理状态并通知你。'
  }

  // 维修
  if (/维修|修复|换|拆/.test(t)) {
    return '维修方案分三步：① 冷却水滤器清洗更换 ② 淡水侧换热面化学清洗 ③ 温控阀检修调试。完整 SOP 和验收标准见左侧产物区「维修方案」卡片。'
  }

  // 备件
  if (/备件|零件|材料/.test(t)) {
    return '所需备件：<br>• 冷却水滤芯 ×1（型号 XX-100，规格 100μm）<br>• 密封圈 ×2（氟橡胶 NBR 70）<br>• 高温润滑脂 ×1 支（食品级）<br>• 5% 柠檬酸除垢液 ×20L<br><br>请确认库存后再开始维修。'
  }

  // 验收
  if (/验收|标准|怎么算好|通过/.test(t)) {
    return '验收标准：<br>• 出口温度 ≤ <b>85°C</b>（当前 78°C ✓）<br>• 流量 ≥ <b>80m³/h</b>（当前 92m³/h ✓）<br>• 滤器压差 ≤ <b>0.03MPa</b><br>• 系统无可见渗漏<br>• 振动值 ≤ <b>4.5mm/s</b>'
  }

  // 危险/安全
  if (/危险|安全|注意/.test(t)) {
    return '⚠️ 关键安全提示：<br>1. 维修前必须停机断电，办理热工作业许可证<br>2. 化学清洗剂操作时佩戴防酸碱护具<br>3. 进入受限空间前必须做气体检测<br>4. 现场配备灭火器材，专人监护'
  }

  // 历史/案例
  if (/历史|案例|以前|类似/.test(t)) {
    if (ev.relatedCases?.length) {
      return `知识库推荐了 <b>${ev.relatedCases.length}</b> 篇相关案例：<br>• ${ev.relatedCases[0].title}<br><br>你可以从「知识」模块查看完整内容，或在维修时参考。`
    }
    return '知识库暂无类似案例。本次故障特征较为典型，建议维修完成后录入新案例以备参考。'
  }

  // 时间/紧急程度
  if (/多久|紧急|时间/.test(t)) {
    return `本次事件<b>${ev.priority === 'critical' ? '非常紧急' : '需关注'}</b>。如不处置，类似故障通常在 30 分钟内可能触发二级保护。建议：① 立即降负荷运行 ② 按 SOP 排查 ③ 2 小时内完成维修。`
  }

  // 趋势
  if (/趋势|变化|历史|走向/.test(t)) {
    return '从趋势图看，事发前 12 小时数据平稳，<b>事发前 4 小时</b>开始出现轻微上升，<b>事发前 1 小时</b>陡升并突破阈值。AI 已将 24 小时趋势数据呈现在 AI 分析产物区。'
  }

  // 默认
  return `已收到您关于「<b>${ev.title || '事件'}</b>」的提问。您可以问：<br>• 这类故障的原因是什么？<br>• 当时的传感器数据？<br>• 怎么排查？<br>• 维修时备件？<br>• 验收标准？<br>• 类似历史案例？`
}

function toggleVoice() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    isRecording.value = !isRecording.value
    if (isRecording.value) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const r = new SpeechRecognition(); r.lang = 'zh-CN'; r.continuous = false; r.interimResults = false
      r.onresult = (e) => { inputText.value = e.results[0][0].transcript; isRecording.value = false }
      r.onerror = () => { isRecording.value = false }
      r.start()
    }
  } else { inputText.value = '主机温度现在多少？' }
}

// ============ 态势感知智能回复 ============
function generateSituationResponse(t) {
  const ctx = situationContext
  if (!ctx) return '请从船舶总览页面开始查看。'

  const devs = deviceStore.devices
  const dangerDevs = devs.filter(d => d.status === 'danger')
  const sensors = sensorStore.allSensors
  const overSensors = sensors.filter(s => s.status === 'over')

  if (/异常|设备|哪些/.test(t)) {
    if (dangerDevs.length > 0) {
      return `${dangerDevs.map(d => `🔴 <b>${d.name}</b> — ${d.status === 'danger' ? '异常' : ''}`).join('<br>')}<br><br>建议在船舶总览页面点击设备卡片查看详情。`
    }
    return '✅ 当前所有设备运行正常，无异常。'
  }

  if (/健康|状态|概述/.test(t)) {
    return `船舶「<b>${deviceStore.ship.name}</b>」运行中，健康分 <b style="color:var(--success)">${deviceStore.ship.healthScore}</b>。<br>航速 ${deviceStore.ship.speed} 节，航向 ${deviceStore.ship.heading}°。<br>${overSensors.length > 0 ? `有 <b style="color:var(--danger)">${overSensors.length} 个传感器超限</b>需关注。` : '所有传感器正常。'}`
  }

  if (/详细|趋势/.test(t) && ctx.sensor) {
    return `传感器「<b>${ctx.sensor.nameCn}</b>」当前 ${ctx.sensor.value}${ctx.sensor.unit}。可在左侧趋势图中调整时间范围查看 1H/6H/24H/7D 数据。`
  }

  if (/事件快照|生成事件|跳转/.test(t)) {
    if (ctx.sensor && ctx.sensor.status !== 'normal') {
      return `可以为「<b>${ctx.sensor.nameCn}</b>」生成事件快照并进入事件中心处理。请点击左侧 ⚡「生成事件快照」按钮。`
    }
    if (ctx.device) {
      return `${ctx.device.name} 当前运行状态为 ${ctx.device.status === 'danger' ? '异常' : ctx.device.status === 'warning' ? '预警' : '正常'}，暂无需生成事件。点击异常传感器后可生成事件。`
    }
    return '请先选中一个异常传感器，然后生成事件快照。'
  }

  if (/维保|历史|记录/.test(t)) {
    return '维保历史记录功能开发中。当前可通过事件中心查看该设备的过往事件和排查记录。'
  }

  if (/对比|同期|其他/.test(t)) {
    return '跨传感器对比分析需要选择两个及以上传感器。您可以在传感器网格中切换系统标签来查看不同系统的传感器数据。'
  }

  if (/主机|冷却|温度/.test(t)) {
    return '主机系统共有 9 个传感器，当前有异常传感器。建议点击「1号主机」浮动卡片进入传感器详情查看。'
  }

  return `已收到：「${text}」。您可以问我：<br>• 哪些设备有异常？<br>• 船舶健康状态如何？<br>• 生成事件快照<br>• 查看详细趋势`
}

// ============ 设备 AI 分析摘要（点击设备卡片触发）============
function generateDeviceAnalysisHtml(d) {
  const ship = deviceStore.ship
  const shipStatusMap = { sailing: '机动航行', anchoring: '锚泊', docking: '靠港' }
  const shipStatus = shipStatusMap[ship.status] || '航行'
  const statusLabel = d.status === 'danger' ? '异常' : d.status === 'warning' ? '预警' : '正常'
  const statusColor = d.status === 'danger' ? 'var(--danger)' : d.status === 'warning' ? 'var(--warning)' : 'var(--success)'

  // 健康度计算
  const metrics = d.metrics || []
  const overCount = metrics.filter(m => m.status === 'over').length
  const warnCount = metrics.filter(m => m.status === 'warning').length
  let healthScore = 100 - overCount * 20 - warnCount * 10
  healthScore = Math.max(0, Math.min(100, healthScore))
  const healthLabel = healthScore >= 80 ? '整体良好' : healthScore >= 60 ? '存在隐患' : '需立即关注'
  const scoreColor = healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--warning)' : 'var(--danger)'

  // 关注点
  const abnormalMetrics = metrics.filter(m => m.status === 'over' || m.status === 'warning')
  const focusSystem = abnormalMetrics.length > 0 ? d.system : '各系统'
  const focusDetail = abnormalMetrics.length > 0
    ? abnormalMetrics.map(m => m.label).join('、')
    : '无明显异常'

  // 结论
  let conclusion = ''
  if (d.status === 'danger') {
    conclusion = `当前<b style="color:var(--danger)">${d.name}存在异常</b>，${abnormalMetrics.map(m => `${m.label}（${m.value}${m.unit}）超限`).join('，')}。建议立即安排检查，必要时停机维修。`
  } else if (d.status === 'warning') {
    conclusion = `当前运行基本正常，但<b style="color:var(--warning)">${focusSystem}效能呈下降趋势</b>（${focusDetail}接近预警阈值），建议近期安排检查。`
  } else {
    conclusion = `当前运行正常，各系统关键参数均在安全范围内，${d.name}状态良好。建议按计划执行预防性维护。`
  }

  // 建议
  let suggestionsHtml = ''
  if (d.status === 'danger') {
    suggestionsHtml = abnormalMetrics.map((m, i) =>
      `<div style="margin:5px 0">${i + 1}. <b>${m.label}</b>：当前 ${m.value}${m.unit} 已超限，需立即检查并确认是否需要紧急停机处理</div>`
    ).join('')
    const base = abnormalMetrics.length
    suggestionsHtml += `
      <div style="margin:5px 0">${base + 1}. 对比历史数据，分析异常趋势并记录排查结果</div>
      <div style="margin:5px 0">${base + 2}. 必要时通知维修人员到场，按照SOP执行排查步骤</div>`
  } else if (d.status === 'warning') {
    suggestionsHtml = abnormalMetrics.map((m, i) =>
      `<div style="margin:5px 0">${i + 1}. <b>${m.label}</b>：当前 ${m.value}${m.unit} 接近预警阈值，持续关注变化趋势</div>`
    ).join('')
    const base = abnormalMetrics.length
    suggestionsHtml += `
      <div style="margin:5px 0">${base + 1}. 检查设备运行环境是否正常，准备备件以防情况恶化</div>
      <div style="margin:5px 0">${base + 2}. 记录当前状态以便后续分析，后续靠港可安排详细检查</div>`
  } else {
    suggestionsHtml = `
      <div style="margin:5px 0">1. 定期巡检，保持设备良好状态</div>
      <div style="margin:5px 0">2. 按计划执行预防性维护</div>
      <div style="margin:5px 0">3. 记录运行数据用于趋势分析</div>`
  }

  return `<div style="font-size:var(--font-base);line-height:1.8">
    <div style="font-weight:700;font-size:var(--font-lg);color:var(--text-primary);margin-bottom:10px">${d.name}AI分析摘要</div>
    <div style="margin:6px 0"><span style="color:var(--text-muted)">工况：</span><span style="color:var(--accent);font-weight:600">${shipStatus}</span></div>
    <div style="margin:6px 0"><span style="color:var(--text-muted)">设备状态：</span><span style="color:${statusColor};font-weight:600">${statusLabel}</span></div>
    <div style="margin:6px 0"><span style="color:var(--text-muted)">设备健康度：</span><span style="color:${scoreColor};font-weight:700;font-size:var(--font-lg)">${healthScore}%</span> · <span style="color:${scoreColor}">${healthLabel}</span></div>
    <div style="margin:6px 0"><span style="color:var(--text-muted)">建议关注：</span><span style="color:var(--warning);font-weight:600">${focusSystem}</span> <span style="color:var(--text-muted)">（${focusDetail}）</span></div>
    <div style="margin:10px 0 4px;font-weight:600;color:var(--text-primary)">结论：</div>
    <div style="margin:4px 0;color:var(--text-secondary)">${conclusion}</div>
    <div style="margin:10px 0 4px;font-weight:600;color:var(--text-primary)">关注点：<span style="color:var(--warning)">${focusDetail}</span></div>
    <div style="margin:10px 0 4px;font-weight:600;color:var(--text-primary)">建议：</div>
    ${suggestionsHtml}
  </div>`
}
</script>

<style scoped>
/* === Panel === */
.assistant-panel {
  flex: 1;
  min-width: var(--assistant-min-width);
  height: 100%;
  background: var(--bg-panel); display: flex; flex-direction: column;
  border-left: 1px solid var(--border-primary);
  position: relative;
}

/* === Resize Handle === */
.resize-handle {
  position: absolute; left: -3px; top: 0; bottom: 0;
  width: 6px; cursor: col-resize; z-index: 50;
  border-radius: 3px; transition: background 0.2s;
}
.resize-handle:hover, .resize-handle:active {
  background: var(--accent); opacity: 0.5;
}

/* === Header === */
.assistant-header {
  padding: 12px 14px; border-bottom: 1px solid var(--border-primary);
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  background: linear-gradient(180deg, var(--bg-surface), #FBFCFD);
}
.assistant-header.event-assistant-header { background: var(--bg-surface); }
.mode-tag { font-size: var(--font-xs); padding: 2px 8px; border-radius: var(--radius-sm); font-weight: 500; }
.gen-mode,.event-mode { background: var(--accent-bg); color: var(--accent); }
.aux-mode { background: rgba(0,188,212,0.10); color: #0096A0; }
.assistant-title { font-size: var(--font-md); font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 5px; }
.sparkle-icon { width: 14px; height: 14px; color: var(--accent); animation: sparkle-rotate 3s linear infinite; }
@keyframes sparkle-rotate { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.15)} 100%{transform:rotate(360deg) scale(1)} }
.stage-pill { margin-left: auto; font-size: var(--font-xs); padding: 2px 8px; border-radius: var(--radius-sm); background: var(--success-bg); color: var(--success); font-weight: 500; }

/* === 事件上下文条 === */
.event-context-bar {
  padding: 8px 14px;
  background: #F5F9FF;
  border-bottom: 1px solid var(--border-primary);
  border-left: 3px solid var(--accent);
  flex-shrink: 0;
}
.compact-event-link { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ecb-link-label { flex-shrink: 0; color: var(--accent); font-size: var(--font-xs); font-weight: 600; }
.ecb-name { font-size: var(--font-sm); font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

/* === Messages === */
.messages-area { flex: 1; overflow-y: auto; padding: 10px 0; display: flex; flex-direction: column; }
.msg { margin: 0 8px 10px; max-width: 96%; }
.msg-ai { display: flex; gap: 7px; align-items: flex-start; }

/* Avatar */
.assistant-avatar { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #36CFC9); display: flex; align-items: center; justify-content: center; position: relative; }
.avatar-dot { width: 7px; height: 7px; border-radius: 50%; background: white; z-index: 1; }
.avatar-ring { position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0.2; animation: avatar-glow 2s ease-in-out infinite; }
@keyframes avatar-glow { 0%,100%{opacity:0.12;transform:scale(1)} 50%{opacity:0.3;transform:scale(1.08)} }

/* === 普通文本气泡 === */
.msg-content { background: var(--bg-surface); border: 1px solid var(--border-primary); border-left: 2px solid var(--accent); border-radius: 4px var(--radius-md) var(--radius-md) 4px; padding: 10px 12px; color: var(--text-secondary); max-width: 100%; font-size: var(--font-base); line-height: 1.6; box-shadow: var(--shadow-sm); }
.msg-user { display: flex; justify-content: flex-end; }
.msg-user .msg-content { background: linear-gradient(135deg, var(--accent), #4096FF); border: none; border-radius: var(--radius-md) 4px var(--radius-md) var(--radius-md); color: #fff; }

/* 欢迎卡片 */
.welcome-msg { margin-top: 4px; background: linear-gradient(135deg, #F8FBFF, #F0F5FF); }
.summary-msg { background: var(--bg-surface); border-radius: var(--radius-lg); padding: 14px; }
.summary-block { display: flex; flex-direction: column; gap: 8px; }
.summary-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--font-sm); }
.summary-label { color: var(--text-muted); }
.summary-value { font-weight: 600; }

/* === Typing === */
.typing-msg { margin-bottom: 6px; }
.typing-bubble { display: flex; align-items: center; gap: 5px; padding: 14px 16px; min-height: 22px; }
.typing-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: 0.4; animation: typing-bounce 1.4s ease-in-out infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-4px);opacity:1} }

/* ======================== */
/* === 6 种富媒体卡片 === */
/* ======================== */
.msg-card { background: var(--bg-surface); border: 1px solid var(--border-primary); border-left: 3px solid var(--accent); border-radius: var(--radius-md); padding: 0; overflow: hidden; box-shadow: var(--shadow-sm); width: 100%; }
.card-badge { font-size: var(--font-sm); font-weight: 600; padding: 8px 12px; border-bottom: 1px solid var(--border-secondary); color: var(--accent); background: var(--accent-bg); }
.card-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }

/* 1. 诊断卡 */
.diag-conclusion { }
.diag-label { font-size: var(--font-xs); color: var(--text-muted); margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }
.diag-text { font-size: var(--font-sm); line-height: 1.7; color: var(--text-primary); }
.diag-faults { margin-top: 2px; }
.diag-fault-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--border-secondary); font-size: var(--font-sm); }
.diag-fault-row:last-child { border-bottom: none; }
.df-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.df-dot.high { background: var(--danger); }
.df-dot.medium { background: var(--warning); }
.df-dot.low { background: var(--success); }
.df-name { flex: 1; color: var(--text-primary); font-weight: 500; }
.df-bar { width: 48px; height: 6px; background: var(--bg-hover); border-radius: 3px; overflow: hidden; }
.df-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s; }
.df-pct { font-family: Consolas, monospace; font-size: var(--font-xs); color: var(--text-muted); width: 28px; text-align: right; }
.diag-suggestion { font-size: var(--font-sm); line-height: 1.6; color: var(--text-secondary); padding-top: 4px; border-top: 1px solid var(--border-secondary); }
.diag-meta { font-size: var(--font-xs); color: var(--text-muted); text-align: center; }

/* 2. 快照卡 */
.snapshot-card { border-left-color: #722ED1; }
.snapshot-card .card-badge { color: #722ED1; background: rgba(114,46,209,0.06); }
.snap-time { font-size: var(--font-xs); color: var(--text-muted); text-align: center; margin-bottom: 2px; }
.snap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.snap-item { background: var(--bg-hover); border-radius: 6px; padding: 8px 10px; border: 1px solid var(--border-secondary); }
.snap-item.snap-over { border-left: 2px solid var(--danger); }
.snap-item.snap-warning { border-left: 2px solid var(--warning); }
.snap-name { font-size: var(--font-xs); color: var(--text-muted); margin-bottom: 3px; }
.snap-val { font-size: var(--font-lg); font-weight: 700; font-family: Consolas, monospace; color: var(--text-primary); }
.snap-unit { font-size: var(--font-xs); font-weight: 400; color: var(--text-muted); margin-left: 2px; }
.snap-ref { font-size: var(--font-xs); color: var(--text-muted); margin-top: 1px; }
.snap-status { font-size: var(--font-xs); font-weight: 600; margin-top: 2px; color: var(--text-muted); }
.snap-item.snap-over .snap-status { color: var(--danger); }

/* 3. 操作引导卡 */
.guide-card { border-left-color: #FA8C16; }
.guide-card .card-badge { color: #FA8C16; background: rgba(250,140,22,0.06); }
.guide-intro { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.6; margin-bottom: 4px; }
.guide-steps { display: flex; flex-direction: column; gap: 0; }
.guide-step { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-secondary); cursor: pointer; transition: background 0.15s; }
.guide-step:hover { background: rgba(22,119,255,0.03); }
.guide-step:last-child { border-bottom: none; }
.gs-num { width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: var(--font-xs); font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.gs-body { flex: 1; }
.gs-title { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 2px; display: flex; align-items: center; gap: 6px; }
.gs-toggle { font-size: var(--font-xs); color: var(--text-muted); flex-shrink: 0; }
.gs-detail { font-size: var(--font-xs); color: var(--text-muted); line-height: 1.5; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-secondary); }
.guide-hint { margin-top: 8px; font-size: var(--font-xs); color: var(--text-muted); text-align: center; font-style: italic; }

/* 4. 警告卡 */
.warning-card { border-left-color: var(--danger); background: var(--danger-bg); display: flex; gap: 10px; padding: 12px; border: 1px solid rgba(245,63,63,0.15); }
.warning-card .card-badge { display: none; }
.warning-card.warn-danger { border-left-color: var(--danger); background: var(--danger-bg); }
.warn-icon { font-size: 18px; flex-shrink: 0; line-height: 1.2; }
.warn-body { flex: 1; }
.warn-title { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.warn-list { margin: 0; padding-left: 18px; font-size: var(--font-sm); line-height: 1.7; color: var(--text-secondary); }
.warn-list li::marker { color: var(--danger); font-weight: 600; }

/* 5. 状态报告卡 */
.report-card { border-left-color: var(--success); }
.report-banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: linear-gradient(135deg, var(--success), #36D15A); color: #fff; }
.rb-icon { width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: var(--font-md); font-weight: 700; }
.rb-text { font-size: var(--font-md); font-weight: 600; }
.report-body { padding: 12px; }
.rb-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.rb-metric { background: var(--bg-hover); border-radius: 6px; padding: 8px 10px; }
.rbm-label { font-size: var(--font-xs); color: var(--text-muted); }
.rbm-value { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); margin-top: 2px; }
.rbm-hl { color: var(--success) !important; }
.rb-conclusion { font-size: var(--font-sm); line-height: 1.6; color: var(--text-secondary); border-top: 1px solid var(--border-secondary); padding-top: 8px; }

/* === 快捷回复 === */
.msg-bubble {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
  box-shadow: var(--shadow-sm);
}
.chips-bubble {
  border: 1px dashed var(--border-secondary);
  background: var(--bg-panel);
}
.chips-hint {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-bottom: 5px;
  font-weight: 500;
}
.rec-chips { display: flex; gap: 5px; flex-wrap: wrap; }
.rec-chip { font-size: var(--font-sm); padding: 5px 10px; border-radius: var(--radius-lg); border: 1px solid var(--border-primary); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; white-space: nowrap; min-height: 32px; }
.rec-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); transform: translateY(-1px); box-shadow: 0 2px 6px rgba(22,119,255,0.07); }
.rec-chip-cta { background: linear-gradient(135deg, var(--accent), #4096FF) !important; color: #fff !important; border: none !important; font-weight: 600; box-shadow: 0 2px 8px rgba(22,119,255,0.25); }
.rec-chip-cta:hover { background: linear-gradient(135deg, #4096FF, var(--accent)) !important; color: #fff !important; box-shadow: 0 4px 14px rgba(22,119,255,0.4); transform: translateY(-2px); }

/* ============ 通用模式主动追问卡 ============ */
.proactive-card { padding: 12px; min-width: 220px; }
.pac-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.pac-icon { font-size: var(--font-lg); }
.pac-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); flex: 1; }
.pac-count { font-size: var(--font-xs); font-weight: 600; padding: 2px 7px; border-radius: 10px; background: var(--danger-bg); color: var(--danger); }
.pac-body { display: flex; flex-direction: column; gap: 6px; }
.pac-event-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); line-height: 1.4; }
.pac-event-meta { font-size: var(--font-sm); color: var(--text-muted); }
.pac-question { font-size: var(--font-sm); color: var(--accent); margin-top: 4px; font-weight: 500; }

/* === 输入区 === */
.input-area { padding: 10px 12px; border-top: 1px solid var(--border-primary); display: flex; gap: 8px; flex-shrink: 0; background: var(--bg-surface); }
.input-wrapper { flex: 1; display: flex; align-items: center; position: relative; background: var(--bg-panel); border: 1px solid var(--border-primary); border-radius: 22px; transition: border-color 0.25s, box-shadow 0.25s; overflow: visible; }
.input-wrapper:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(22,119,255,0.10); }
.chat-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: var(--font-base); padding: 8px 6px 8px 14px; }
.chat-input::placeholder { color: var(--text-muted); }

/* Mic */
.mic-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 50%; cursor: pointer; flex-shrink: 0; margin-right: 2px; color: var(--text-muted); z-index: 2; transition: all 0.3s; }
.mic-btn:hover { color: var(--accent); background: var(--accent-bg); }
.mic-btn.recording { color: var(--danger); background: var(--danger-bg); }
.mic-svg { width: 15px; height: 15px; }
.waveform { display: flex; align-items: center; gap: 2px; height: 14px; }
.wf-bar { width: 3px; border-radius: 2px; background: var(--danger); animation: wf-bounce 0.8s ease-in-out infinite; }
.wf-bar:nth-child(1) { height: 7px; animation-delay: 0s; }
.wf-bar:nth-child(2) { height: 13px; animation-delay: 0.1s; }
.wf-bar:nth-child(3) { height: 9px; animation-delay: 0.2s; }
.wf-bar:nth-child(4) { height: 14px; animation-delay: 0.3s; }
.wf-bar:nth-child(5) { height: 6px; animation-delay: 0.4s; }
@keyframes wf-bounce { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(1.4)} }
.ripple-ring { position: absolute; right: 4px; top: 50%; transform: translate(0, -50%); width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid var(--danger); opacity: 0; z-index: 1; pointer-events: none; }
.ripple-ring.r1 { animation: ripple-out 1.8s ease-out infinite 0s; }
.ripple-ring.r2 { animation: ripple-out 1.8s ease-out infinite 0.6s; }
.ripple-ring.r3 { animation: ripple-out 1.8s ease-out infinite 1.2s; }
@keyframes ripple-out { 0%{transform:translate(0,-50%) scale(1);opacity:0.4} 100%{transform:translate(0,-50%) scale(2.2);opacity:0} }

/* Send */
.send-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--accent), #4096FF); border: none; border-radius: 50%; color: white; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(22,119,255,0.3); transition: all 0.25s; }
.send-btn:hover { box-shadow: 0 4px 16px rgba(22,119,255,0.45); transform: scale(1.06); }
.send-btn:active { transform: scale(0.95); }
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; transform: scale(0.92); }
.send-svg { width: 15px; height: 15px; }

/* 流式输出光标 */
:deep(.cursor-blink) {
  animation: blink 0.8s ease-in-out infinite;
  color: var(--accent);
  font-weight: 700;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
