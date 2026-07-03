<template>
  <aside class="assistant-panel">
    <!-- Header -->
    <div class="assistant-header">
      <span class="mode-tag" :class="modeClass">{{ modeLabel }}</span>
      <span class="assistant-title">AI 助手</span>
    </div>

    <!-- Messages -->
    <div class="messages-area" ref="messagesRef">
      <!-- Welcome / Greeting -->
      <div v-if="messages.length === 0" class="msg msg-ai welcome-msg">
        {{ greetingText }}
      </div>

      <!-- Summary (HTML) -->
      <div v-if="messages.length === 0 && summaryHtml" class="msg msg-ai summary-msg" v-html="summaryHtml">
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
import { ref, computed, watch, nextTick } from 'vue'
import { useEventStore } from '@/stores/eventStore'

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
const messagesRef = ref(null)
const inputText = ref('')
const isRecording = ref(false)

// Greeting text varies by mode
const greetingText = computed(() => {
  const stats = eventStore.stats
  if (props.mode === 'event' && props.eventContext) {
    return `已切换到「${props.eventContext.title}」，请问需要什么帮助？`
  }
  return `你好，当前共有 ${stats.total} 件事件，其中 ${stats.pending} 件待处理。`
})

// Summary HTML (general mode)
const summaryHtml = computed(() => {
  if (props.mode !== 'general') return ''
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
})

// Recommended questions
const recommendedQuestions = ref([])

function generateRecommendedQuestions() {
  if (props.mode === 'general') {
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

// Session messages
const messages = computed(() => {
  const key = props.mode === 'event' && props.eventContext
    ? props.eventContext.id
    : props.mode === 'general' ? 'general' : 'situation'
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
      let html = '<div style="font-size:12px;line-height:1.7">根据AI诊断，可能原因如下：<br><br>'
      table.forEach((f, i) => {
        const probColor = f.probability === 'high' ? '#FF4D4F' : f.probability === 'medium' ? '#FAAD14' : '#8BAAC0'
        html += `<b>${i + 1}. ${f.name}</b> <span style="color:${probColor}">[${f.probability === 'high' ? '高概率' : f.probability === 'medium' ? '中概率' : '低概率'}]</span><br>`
        html += `<span style="color:#8BAAC0;font-size:11px">${f.detail}</span><br><br>`
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
        <div style="font-size:11px;line-height:1.7;color:#8BAAC0;margin:6px 0">
          1️⃣ 检查相关设备运行参数<br>
          2️⃣ 对比历史数据判断趋势<br>
          3️⃣ 按照SOP执行排查步骤<br>
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
.assistant-panel {
  width: var(--assistant-width);
  min-width: var(--assistant-width);
  height: 100%;
  background: var(--bg-chat);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  flex-shrink: 0;
}

.assistant-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mode-tag {
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 3px;
  font-weight: 500;
}
.gen-mode { background: rgba(24,144,255,0.15); color: var(--accent); }
.event-mode { background: rgba(24,144,255,0.2); color: var(--accent); }
.aux-mode { background: rgba(0,188,212,0.15); color: #00BCD4; }

.assistant-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

/* Welcome message */
.welcome-msg {
  margin: 4px 12px 8px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
}

.summary-msg {
  margin: 0 12px 8px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

/* Messages */
.msg {
  margin: 0 12px 8px;
  max-width: 95%;
  font-size: 12px;
  line-height: 1.6;
}

.msg-ai {
  display: flex;
  gap: 8px;
}

.assistant-avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1890FF, #00BCD4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
}

.msg-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--text-secondary);
  max-width: 220px;
  font-size: 12px;
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
  gap: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 4px 12px 8px;
}

.context-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.context-body {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.context-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Action card inside messages */
.action-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
}

.action-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.action-desc {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.btn-primary {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  background: rgba(24,144,255,0.15);
  color: var(--accent);
  cursor: pointer;
}
.btn-primary:hover { background: rgba(24,144,255,0.25); }

.btn-danger {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 4px;
  border: none;
  background: rgba(255,77,79,0.15);
  color: var(--danger);
  cursor: pointer;
}

.btn-ghost {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
}

/* Summary block */
.summary-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.summary-label {
  color: var(--text-muted);
}

.summary-value {
  font-weight: 600;
}

/* Recommended questions */
.recommended-section {
  margin: 0 14px 8px;
}

.rec-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.rec-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.rec-chip {
  font-size: 10px;
  padding: 4px 10px;
  border-radius: 12px;
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
  padding: 10px 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 6px;
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
  font-size: 12px;
  padding: 7px 10px;
}
.chat-input::placeholder {
  color: var(--text-muted);
}

.mic-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(24,144,255,0.15);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
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
  padding: 7px 14px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
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
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
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
