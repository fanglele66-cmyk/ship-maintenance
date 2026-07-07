<template>
  <aside class="assistant-panel" :style="panelStyle">
    <!-- Drag handle on left edge -->
    <div
      class="resize-handle"
      @mousedown="startResize"
      @dblclick="resetWidth"
      title="拖拽调整宽度 · 双击重置"
    ></div>

    <!-- Header -->
    <div class="assistant-header">
      <span class="mode-tag" :class="modeClass">{{ modeLabel }}</span>
      <span class="assistant-title">AI 助手</span>
    </div>

    <!-- Messages -->
    <div class="messages-area" ref="messagesRef">
      <!-- Summary (HTML) -->
      <div v-if="messages.length === 0 && summaryHtml" class="msg msg-ai summary-msg" v-html="summaryHtml">
      </div>

      <!-- Welcome / Greeting -->
      <div v-if="messages.length === 0" class="msg msg-ai welcome-msg">
        {{ greetingText }}
      </div>

      <!-- Chat messages -->
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="msg"
        :class="msg.role === 'user' ? 'msg-user' : 'msg-ai'"
      >
        <div v-if="msg.role === 'assistant'" class="assistant-avatar">
          <span class="avatar-dot"></span>
        </div>
        <div class="msg-content" v-html="msg.content"></div>
      </div>

      <!-- Auto-push context message for event mode -->
      <div v-if="mode === 'event' && eventContext" class="msg msg-ai event-context-msg">
        <div class="context-header">🤖 事件已关联：{{ eventContext.title }}</div>
        <div class="context-body">
          快照数据显示关键指标存在异常。
          AI 判断：{{ eventContext.aiAnalysis?.summary?.slice(0, 50) }}...
        </div>
        <div class="context-actions">
          <span class="chip" @click="handleChip('view_causes')">🔍 查看可能原因</span>
          <span class="chip" @click="handleChip('start_check')">📋 开始排查</span>
          <span class="chip" @click="handleChip('create_order')">📝 创建工单</span>
        </div>
      </div>

      <!-- Recommended questions -->
      <div v-if="recommendedQuestions.length > 0" class="recommended-section">
        <div class="rec-label">试试问我：</div>
        <div class="rec-chips">
          <button
            v-for="(q, idx) in recommendedQuestions"
            :key="idx"
            class="rec-chip"
            :class="{ clicked: q.clicked }"
            :disabled="q.clicked"
            @click="handleRecommendedClick(q, idx)"
          >
            {{ q.clicked ? '✓ ' : '' }}{{ q.text }}
          </button>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrapper">
        <input
          v-model="inputText"
          type="text"
          class="chat-input"
          placeholder="描述你的问题..."
          @keyup.enter="sendMessage"
        />
        <button
          class="mic-btn"
          :class="{ recording: isRecording }"
          @click="toggleVoice"
          title="语音输入"
        >
          🎤
        </button>
      </div>
      <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim()">
        发送
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import { useDeviceStore } from '@/stores/deviceStore'

const props = defineProps({
  mode: {
    type: String,
    default: 'general' // general | event | auxiliary
  },
  eventContext: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['chip-click'])

const eventStore = useEventStore()
const deviceStore = useDeviceStore()
const messagesRef = ref(null)
const inputText = ref('')
const isRecording = ref(false)

// --- Drag-to-resize (percentage-based) ---
const STORAGE_KEY = 'assistant-panel-width-pct'
const MIN_RATIO = 0.30  // 30% viewport
const MAX_RATIO = 0.50  // 50% viewport
const DEFAULT_RATIO = 0.40 // 40% viewport
const customPct = ref(null) // null = use CSS default (40vw)
const windowWidth = ref(window.innerWidth) // reactive window width

function onWindowResize() {
  windowWidth.value = window.innerWidth
}

// Parse stored percentage
function loadSavedWidth() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const pct = parseFloat(saved)
    if (pct >= MIN_RATIO && pct <= MAX_RATIO) customPct.value = pct
  }
}

const panelStyle = computed(() => {
  // On narrow screens, let CSS media query handle sizing
  if (windowWidth.value <= 900) return {}
  const pct = customPct.value || DEFAULT_RATIO
  return { width: (pct * 100) + 'vw', minWidth: (pct * 100) + 'vw' }
})

function startResize(e) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  const vw = window.innerWidth
  const startPct = customPct.value || DEFAULT_RATIO
  const startW = startPct * vw

  const onMouseMove = (ev) => {
    const delta = startX - ev.clientX // dragging left = wider
    const newW = startW + delta
    const newPct = newW / vw
    customPct.value = Math.min(Math.max(newPct, MIN_RATIO), MAX_RATIO)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    // Persist percentage
    if (customPct.value !== null) {
      localStorage.setItem(STORAGE_KEY, customPct.value.toString())
    }
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resetWidth() {
  customPct.value = null
  localStorage.removeItem(STORAGE_KEY)
}

onMounted(() => {
  loadSavedWidth()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
})

// Greeting text varies by mode
const greetingText = computed(() => {
  const stats = eventStore.stats
  if (props.mode === 'event' && props.eventContext) {
    return `已切换到「${props.eventContext.title}」，请问需要什么帮助？`
  }
  if (props.mode === 'auxiliary') {
    return '欢迎查看船舶态势面板，有需要可以随时问我。'
  }
  return `你好，当前共有 ${stats.total} 件事件，其中 ${stats.pending} 件待处理。`
})

// Summary HTML (general / auxiliary mode)
const summaryHtml = computed(() => {
  if (props.mode === 'general') {
    const stats = eventStore.stats
    return `
      <div class="summary-block">
        <div class="summary-row">
          <span class="summary-label">船舶健康分</span>
          <span class="summary-value" style="color:#52C41A">82</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">事件统计</span>
          <span class="summary-value">
            <span style="color:#FF4D4F">紧急 ${stats.critical}</span>
            / <span style="color:#FAAD14">重要 ${stats.important}</span>
            / <span style="color:#1890FF">一般 ${stats.normal}</span>
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-label">重点关注</span>
          <span class="summary-value" style="color:#FAAD14">主机系统水温异常需优先处理</span>
        </div>
      </div>
    `
  }
  if (props.mode === 'auxiliary') {
    const ship = deviceStore.ship
    const danger = deviceStore.dangerDevices.length
    const warning = deviceStore.warningDevices.length
    const normal = deviceStore.devices.length - danger - warning
    const statusText = { sailing: '航行中', anchoring: '锚泊中', docking: '靠港中' }[ship.status] || ship.status
    const statusColor = { sailing: '#52C41A', anchoring: '#FAAD14', docking: '#1890FF' }[ship.status] || '#8BAAC0'
    const riskLevel = ship.healthScore >= 80 ? '低' : ship.healthScore >= 60 ? '中' : '高'
    const riskColor = ship.healthScore >= 80 ? '#52C41A' : ship.healthScore >= 60 ? '#FAAD14' : '#FF4D4F'
    const scoreColor = ship.healthScore >= 80 ? '#52C41A' : ship.healthScore >= 60 ? '#FAAD14' : '#FF4D4F'
    return `
      <div class="summary-block">
        <div class="summary-row">
          <span class="summary-label">船名 / 状态</span>
          <span class="summary-value">${ship.name} · <span style="color:${statusColor}">${statusText}</span></span>
        </div>
        <div class="summary-row">
          <span class="summary-label">位置 / 航向航速</span>
          <span class="summary-value">${ship.latitude} ${ship.longitude} · ${ship.heading}° · ${ship.speed} kn</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">设备在线</span>
          <span class="summary-value">${ship.onlineDevices}/${ship.totalDevices} 台</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">运行概览</span>
          <span class="summary-value">
            <span style="color:#FF4D4F">${danger} 异常</span>
            / <span style="color:#FAAD14">${warning} 预警</span>
            / <span style="color:#52C41A">${normal} 正常</span>
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-label">健康分 / 风险等级</span>
          <span class="summary-value">
            <span style="color:${scoreColor};font-weight:700">${ship.healthScore}</span>
            · <span style="color:${riskColor}">${riskLevel}风险</span>
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-label">分析结论</span>
          <span class="summary-value" style="color:#FAAD14">主机水温与舵机油温偏高，建议优先关注主机系统。</span>
        </div>
      </div>
    `
  }
  return ''
})

// Recommended questions
const recommendedQuestions = ref([])

function generateRecommendedQuestions() {
  if (props.mode === 'auxiliary') {
    recommendedQuestions.value = [
      { text: '查看主机系统传感器', clicked: false },
      { text: '哪些设备有异常？', clicked: false },
      { text: '船舶健康状态如何？', clicked: false }
    ].map(q => ({ ...q }))
  } else if (props.mode === 'general') {
    recommendedQuestions.value = [
      { text: '今天有几件紧急事件？', clicked: false },
      { text: '最近哪个系统问题最多？', clicked: false },
      { text: '有没有重复出现的故障？', clicked: false }
    ].map(q => ({ ...q }))
  } else if (props.mode === 'event' && props.eventContext) {
    const ec = props.eventContext
    const questions = []
    if (ec.aiAnalysis?.faultTable?.length) {
      questions.push({ text: '查看可能的原因', clicked: false })
    }
    if (ec.relatedCases?.length) {
      questions.push({ text: `${ec.relatedCases[0].title.slice(0, 15)}...`, clicked: false })
    }
    questions.push({ text: '开始排查步骤', clicked: false })
    questions.push({ text: '创建工单', clicked: false })
    recommendedQuestions.value = questions
  } else {
    recommendedQuestions.value = []
  }
}

watch(() => props.mode, generateRecommendedQuestions, { immediate: true })
watch(() => props.eventContext, generateRecommendedQuestions)

// 本地消息列表（用于 auxiliary 模式直接推送）
const localMessages = ref([])

// Session messages
const messages = computed(() => {
  const key = props.mode === 'event' && props.eventContext
    ? props.eventContext.id
    : props.mode === 'general' ? 'general' : 'situation'
  if (props.mode === 'auxiliary') {
    return localMessages.value
  }
  return eventStore.getSessionMessages(key)
})

const modeClass = computed(() => {
  return props.mode === 'event' ? 'event-mode' : props.mode === 'auxiliary' ? 'aux-mode' : 'gen-mode'
})

const modeLabel = computed(() => {
  return props.mode === 'event' ? '事件模式' : props.mode === 'auxiliary' ? '辅助模式' : '通用模式'
})

function handleRecommendedClick(q, idx) {
  q.clicked = true
  recommendedQuestions.value = [...recommendedQuestions.value]
  inputText.value = q.text
  sendMessage()
}

function handleChip(action) {
  emit('chip-click', action)
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return

  const sessionKey = props.mode === 'event' && props.eventContext
    ? props.eventContext.id
    : props.mode === 'general' ? 'general' : 'situation'

  eventStore.addMessage(sessionKey, {
    role: 'user',
    content: text
  })

  // Simulate AI response
  setTimeout(() => {
    const response = generateAIResponse(text)
    eventStore.addMessage(sessionKey, {
      role: 'assistant',
      content: response
    })
    scrollToBottom()
  }, 500)

  inputText.value = ''
  scrollToBottom()
}

function generateAIResponse(text) {
  if (text.includes('原因') || text.includes('为什么')) {
    if (props.eventContext?.aiAnalysis?.faultTable) {
      const table = props.eventContext.aiAnalysis.faultTable
      let html = '<div style="font-size:var(--text-base);line-height:1.7">根据AI诊断，可能原因如下：<br><br>'
      table.forEach((f, i) => {
        const probColor = f.probability === 'high' ? '#FF4D4F' : f.probability === 'medium' ? '#FAAD14' : '#8BAAC0'
        html += `<b>${i + 1}. ${f.name}</b> <span style="color:${probColor}">[${f.probability === 'high' ? '高概率' : f.probability === 'medium' ? '中概率' : '低概率'}]</span><br>`
        html += `<span style="color:#8BAAC0;font-size:var(--text-sm)">${f.detail}</span><br><br>`
      })
      html += '</div>'
      return html
    }
    return '根据当前数据分析，建议先查看AI诊断面板中的候选原因列表。'
  }
  if (text.includes('排查') || text.includes('检查')) {
    return `
      <div class="action-card">
        <div class="action-title">排查步骤建议</div>
        <div class="action-desc">根据AI分析，建议按以下顺序排查：</div>
        <div style="font-size:var(--text-sm);line-height:1.7;color:#8BAAC0;margin:6px 0">
          1️⃣ 检查相关设备运行参数<br>
          2️⃣ 对比历史数据判断趋势<br>
          3️ 按照SOP执行排查步骤<br>
          4️⃣ 记录排查结果
        </div>
        <div class="action-buttons">
          <button class="btn-primary">开始排查</button>
          <button class="btn-ghost">查看SOP</button>
        </div>
      </div>
    `
  }
  if (text.includes('工单') || text.includes('创建')) {
    return `
      <div class="action-card">
        <div class="action-title">创建工单确认</div>
        <div class="action-desc">系统将根据当前事件数据自动生成维修工单。</div>
        <div class="action-buttons">
          <button class="btn-primary">确认创建</button>
          <button class="btn-danger">标记误报</button>
        </div>
      </div>
    `
  }
  return `已收到您的提问：「${text}」。正在查询相关数据，请稍候...`
}

// 设备分析消息生成
function sendDeviceAnalysis(device) {
  console.log('[sendDeviceAnalysis] called with device:', device.name)

  // 添加用户消息到本地列表
  localMessages.value.push({
    role: 'user',
    content: `查看${device.name}分析`
  })

  // 模拟AI回复
  setTimeout(() => {
    const response = generateDeviceAnalysisContent(device)
    localMessages.value.push({
      role: 'assistant',
      content: response
    })
    scrollToBottom()
  }, 500)

  scrollToBottom()
  console.log('[sendDeviceAnalysis] messages count:', localMessages.value.length)
}

// 暴露方法给父组件调用
defineExpose({ sendDeviceAnalysis })

function generateDeviceAnalysisContent(device) {
  const ship = deviceStore.ship
  const shipStatus = { sailing: '机动航行', anchoring: '锚泊', docking: '靠港' }[ship.status] || '航行'
  const statusLabel = device.status === 'danger' ? '异常' : device.status === 'warning' ? '预警' : '正常'
  const statusColor = device.status === 'danger' ? '#FF4D4F' : device.status === 'warning' ? '#FAAD14' : '#52C41A'

  // 计算健康度
  const metrics = device.metrics || []
  const overCount = metrics.filter(m => m.status === 'over').length
  const warningCount = metrics.filter(m => m.status === 'warning').length
  let healthScore = 100 - overCount * 20 - warningCount * 10
  healthScore = Math.max(0, Math.min(100, healthScore))
  const healthLabel = healthScore >= 80 ? '整体良好' : healthScore >= 60 ? '存在隐患' : '需立即关注'
  const scoreColor = healthScore >= 80 ? '#52C41A' : healthScore >= 60 ? '#FAAD14' : '#FF4D4F'

  // 异常/预警指标
  const abnormalMetrics = metrics.filter(m => m.status === 'over' || m.status === 'warning')
  const focusSystem = abnormalMetrics.length > 0 ? device.system : '各系统'
  const focusDetail = abnormalMetrics.length > 0
    ? abnormalMetrics.map(m => `${m.label}`).join('、')
    : '无明显异常'

  // 结论
  let conclusion = ''
  if (device.status === 'danger') {
    conclusion = `当前<strong style="color:#FF4D4F">${device.name}存在异常</strong>，${abnormalMetrics.map(m => `${m.label}（${m.value}${m.unit}）超限`).join('，')}。建议立即安排检查，必要时停机维修。`
  } else if (device.status === 'warning') {
    conclusion = `当前运行基本正常，但<strong style="color:#FAAD14">${focusSystem}效能呈下降趋势</strong>（${focusDetail}接近预警阈值），建议近期安排检查。`
  } else {
    conclusion = `当前运行正常，各系统关键参数均在安全范围内，${device.name}状态良好。建议按计划执行预防性维护。`
  }

  // 建议
  let suggestionsHtml = ''
  if (device.status === 'danger') {
    const items = abnormalMetrics.map((m, i) => {
      return `<div style="margin:4px 0">${i + 1}. <strong>${m.label}</strong>：当前 ${m.value}${m.unit} 已超限，需立即检查并确认是否需要紧急停机处理</div>`
    }).join('')
    suggestionsHtml = items + `
      <div style="margin:4px 0">${abnormalMetrics.length + 1}. 对比历史数据，分析异常趋势并记录排查结果</div>
      <div style="margin:4px 0">${abnormalMetrics.length + 2}. 必要时通知维修人员到场，按照SOP执行排查步骤</div>
    `
  } else if (device.status === 'warning') {
    const items = abnormalMetrics.map((m, i) => {
      return `<div style="margin:4px 0">${i + 1}. <strong>${m.label}</strong>：当前 ${m.value}${m.unit} 接近预警阈值，持续关注变化趋势</div>`
    }).join('')
    suggestionsHtml = items + `
      <div style="margin:4px 0">${abnormalMetrics.length + 1}. 检查设备运行环境是否正常，准备备件以防情况恶化</div>
      <div style="margin:4px 0">${abnormalMetrics.length + 2}. 记录当前状态以便后续分析，后续靠港可安排详细检查</div>
    `
  } else {
    suggestionsHtml = `
      <div style="margin:4px 0">1. 定期巡检，保持设备良好状态</div>
      <div style="margin:4px 0">2. 按计划执行预防性维护</div>
      <div style="margin:4px 0">3. 记录运行数据用于趋势分析</div>
    `
  }

  return `
    <div style="font-size:var(--text-base);line-height:1.8">
      <div style="font-weight:700;font-size:var(--text-lg);color:var(--text-primary);margin-bottom:10px">${device.name}AI分析摘要</div>
      <div style="margin:6px 0"><span style="color:#8BAAC0">工况：</span><span style="color:#1890FF;font-weight:600">${shipStatus}</span></div>
      <div style="margin:6px 0"><span style="color:#8BAAC0">设备状态：</span><span style="color:${statusColor};font-weight:600">${statusLabel}</span></div>
      <div style="margin:6px 0"><span style="color:#8BAAC0">设备健康度：</span><span style="color:${scoreColor};font-weight:700;font-size:var(--text-lg)">${healthScore}%</span> · <span style="color:${scoreColor}">${healthLabel}</span></div>
      <div style="margin:6px 0"><span style="color:#8BAAC0">建议关注：</span><span style="color:#FAAD14;font-weight:600">${focusSystem}</span> <span style="color:#8BAAC0">（${focusDetail}）</span></div>
      <div style="margin:10px 0 4px;font-weight:600;color:var(--text-primary)">结论：</div>
      <div style="margin:4px 0;color:var(--text-secondary)">${conclusion}</div>
      <div style="margin:10px 0 4px;font-weight:600;color:var(--text-primary)">关注点：<span style="color:#FAAD14">${focusDetail}</span></div>
      <div style="margin:10px 0 4px;font-weight:600;color:var(--text-primary)">建议：</div>
      ${suggestionsHtml}
    </div>
  `
}

function toggleVoice() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    isRecording.value = !isRecording.value
    if (isRecording.value) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (event) => {
        inputText.value = event.results[0][0].transcript
        isRecording.value = false
      }
      recognition.onerror = () => { isRecording.value = false }
      recognition.start()
    }
  } else {
    // Fallback: simulate voice input
    inputText.value = '主机温度现在多少？'
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}
</script>

<style scoped>
/* --- Resize Handle --- */
.resize-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 50;
  transition: background 0.2s;
  border-radius: 3px;
}
.resize-handle:hover,
.resize-handle:active {
  background: var(--accent);
  opacity: 0.6;
}

.assistant-panel {
  width: var(--assistant-width);
  min-width: var(--assistant-width);
  height: 100%;
  background: var(--bg-chat);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
}

.assistant-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.mode-tag {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 500;
}
.gen-mode { background: rgba(24,144,255,0.15); color: var(--accent); }
.event-mode { background: rgba(24,144,255,0.2); color: var(--accent); }
.aux-mode { background: rgba(0,188,212,0.15); color: #00BCD4; }

.assistant-title {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-primary);
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
}

/* Welcome message */
.welcome-msg {
  margin: 6px 14px 10px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--text-primary);
}

.summary-msg {
  margin: 0 14px 10px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* Messages */
.msg {
  margin: 0 14px 10px;
  max-width: 95%;
  font-size: var(--text-base);
  line-height: 1.7;
}

.msg-ai {
  display: flex;
  gap: 10px;
}

.assistant-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1890FF, #00BCD4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: white;
}

.msg-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-secondary);
  max-width: none;
  font-size: var(--text-base);
  line-height: 1.7;
}

.msg-user {
  display: flex;
  justify-content: flex-end;
}

.msg-user .msg-content {
  background: rgba(24,144,255,0.15);
  border: 1px solid rgba(24,144,255,0.3);
  color: var(--text-primary);
}

/* Event context message */
.event-context-msg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 6px 14px 10px;
}

.context-header {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--accent);
}

.context-body {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.context-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Action card inside messages */
.action-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}

.action-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.action-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.btn-primary {
  font-size: var(--text-sm);
  padding: 5px 14px;
  border-radius: 5px;
  border: none;
  background: rgba(24,144,255,0.15);
  color: var(--accent);
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: rgba(24,144,255,0.25); }

.btn-danger {
  font-size: var(--text-sm);
  padding: 5px 14px;
  border-radius: 5px;
  border: none;
  background: rgba(255,77,79,0.15);
  color: var(--danger);
  cursor: pointer;
  transition: background 0.2s;
}
.btn-danger:hover { background: rgba(255,77,79,0.25); }

.btn-ghost {
  font-size: var(--text-sm);
  padding: 5px 14px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-ghost:hover { border-color: var(--text-secondary); color: var(--text-secondary); }

/* Summary block */
.summary-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
}

.summary-label {
  color: var(--text-muted);
}

.summary-value {
  font-weight: 600;
}

/* Recommended questions */
.recommended-section {
  margin: 0 16px 10px;
}

.rec-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: 8px;
}

.rec-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rec-chip {
  font-size: var(--text-sm);
  padding: 5px 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.rec-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.rec-chip.clicked {
  background: rgba(82,196,26,0.15);
  border-color: var(--success);
  color: var(--success);
  cursor: default;
}
.rec-chip:disabled {
  opacity: 0.8;
}

/* Input area */
.input-area {
  padding: 12px 14px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: border-color 0.2s;
}
.input-wrapper:focus-within {
  border-color: var(--accent);
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--text-base);
  padding: 8px 12px;
}
.chat-input::placeholder {
  color: var(--text-muted);
}

.mic-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(24,144,255,0.15);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 15px;
  flex-shrink: 0;
  margin-right: 4px;
  transition: all 0.2s;
}
.mic-btn:hover {
  background: rgba(24,144,255,0.25);
}
.mic-btn.recording {
  background: rgba(255,77,79,0.2);
  animation: pulse-mic 1s ease-in-out infinite;
}

@keyframes pulse-mic {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,79,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255,77,79,0); }
}

.send-btn {
  padding: 8px 16px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}
.send-btn:hover {
  background: var(--accent-hover);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Chip in context actions */
.chip {
  display: inline-block;
  font-size: var(--text-sm);
  padding: 4px 12px;
  border-radius: 5px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.chip:hover {
  border-color: var(--accent);
  background: rgba(24,144,255,0.1);
}
</style>
