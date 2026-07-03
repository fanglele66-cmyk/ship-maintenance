<template>
  <aside class="assistant-panel">
    <!-- Header -->
    <div class="assistant-header">
      <span class="mode-tag" :class="modeClass">{{ modeLabel }}</span>
      <span class="assistant-title">AI 助手</span>
      <span v-if="currentStageLabel" class="stage-pill">{{ currentStageLabel }}</span>
    </div>

    <!-- 🆕 事件上下文条（事件模式下显示事件名 + 状态） -->
    <div v-if="props.mode === 'event' && props.eventContext" class="event-context-bar">
      <div class="ecb-row">
        <span class="ecb-icon">📋</span>
        <span class="ecb-name" :title="props.eventContext.title">{{ props.eventContext.title }}</span>
      </div>
      <div class="ecb-row ecb-meta">
        <span class="ecb-tag" :class="props.eventContext.priority">
          {{ priorityLabels[props.eventContext.priority] }}
        </span>
        <span class="ecb-tag" :class="props.eventContext.status">
          {{ statusLabels[props.eventContext.status] }}
        </span>
        <span class="ecb-id">#{{ props.eventContext.id }}</span>
      </div>
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

      <!-- Recommended questions (refreshed per message context) -->
      <div v-if="recommendedQuestions.length > 0" class="recommended-section">
        <div class="rec-label">{{ recLabel }}</div>
        <div class="rec-chips">
          <button
            v-for="(q, idx) in recommendedQuestions"
            :key="idx"
            class="rec-chip"
            @click="handleRecommendedClick(q)"
          >
            {{ q.text }}
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
import { ref, computed, watch, nextTick, onUnmounted, reactive, provide } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import { eventPriorityLabels, eventStatusLabels } from '@/mock/events'

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

const priorityLabels = eventPriorityLabels
const statusLabels = eventStatusLabels

// ============ 共享状态：未读 + 阶段（provide 给 EventList / AppNav） ============
const eventUnread = reactive({})      // { [eventId]: number }
const eventStage = reactive({})       // { [eventId]: 'S1' | 'S2' | ... }
const eventStageLastMsgIdx = reactive({}) // { [eventId]: number } 用于判断"是否有新消息触发追问"
const followupSent = reactive({})     // { [eventId+'|'+stage]: true } 每阶段追问去重

const totalUnread = computed(() => {
  return Object.values(eventUnread).reduce((a, b) => a + b, 0)
})

provide('eventUnread', eventUnread)
provide('totalUnread', totalUnread)
provide('eventStage', eventStage)

// ============ 阶段定义 ============
const STAGES = {
  S1: { label: '事件关联', followup: '如需进一步分析，可继续追问；也可让我直接为您生成排查方案。' },
  S2: { label: '排查中', followup: '已为您生成排查方案。**排查中如有异常请反馈；完成请告诉我结果**。' },
  S3: { label: '等待结果', followup: '正在根据您的反馈生成维修方案…', followup2: '维修方案已生成，**请按规范执行，完成后告诉我，我帮您生成验收报告**。' },
  S4: { label: '维修中', followup: '维修进行中。**如遇问题请告诉我，完成后请反馈结果**。' },
  S5: { label: '已闭环', followup: '✅ 事件已闭环，**维修报告已生成在产物区**。' }
}

const stageOrder = ['S1', 'S2', 'S3', 'S4', 'S5']

// ============ 模式与显示 ============
const greetingText = computed(() => {
  const stats = eventStore.stats
  if (props.mode === 'event' && props.eventContext) {
    return `已切换到「${props.eventContext.title}」，请问需要什么帮助？`
  }
  return `你好，当前共有 ${stats.total} 件事件，其中 ${stats.pending} 件待处理。`
})

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

const modeClass = computed(() => {
  return props.mode === 'event' ? 'event-mode' : props.mode === 'auxiliary' ? 'aux-mode' : 'gen-mode'
})

const modeLabel = computed(() => {
  return props.mode === 'event' ? '事件模式' : props.mode === 'auxiliary' ? '辅助模式' : '通用模式'
})

const currentStageLabel = computed(() => {
  if (props.mode !== 'event' || !props.eventContext) return ''
  const s = eventStage[props.eventContext.id]
  if (!s) return ''
  return STAGES[s]?.label || ''
})

// ============ 会话消息 ============
const messages = computed(() => {
  const key = props.mode === 'event' && props.eventContext
    ? props.eventContext.id
    : props.mode === 'general' ? 'general' : 'situation'
  return eventStore.getSessionMessages(key)
})

// ============ Chip 池（按"最新一条 AI 消息"上下文刷新）============
const recommendedQuestions = ref([])

const recLabel = computed(() => {
  return messages.value.length > 0 ? '快捷回复：' : '试试问我：'
})

function getChipsByContext() {
  // 通用模式
  if (props.mode === 'general') {
    return [
      { text: '今天有几件紧急事件？', action: 'send' },
      { text: '最近哪个系统问题最多？', action: 'send' },
      { text: '有没有重复出现的故障？', action: 'send' }
    ]
  }
  // 事件模式：基于当前阶段 + 是否有对话
  if (props.mode === 'event' && props.eventContext) {
    const ec = props.eventContext
    const stage = eventStage[ec.id] || 'S1'
    const lastMsg = messages.value[messages.value.length - 1]
    const hasUserMsg = messages.value.some(m => m.role === 'user')

    // S1 初始：去掉"查看可能原因 / 开始排查 / 创建工单"和顶部事件卡 chip 重复，
    // 只保留"信息流式"引导：追问 AI 推断过程 / 数据快照 / 立即开始排查 / 误报
    if (stage === 'S1' && !hasUserMsg) {
      return [
        { text: '查看具体推断过程', action: 'send' },
        { text: '查看当时数据快照', action: 'send' },
        { text: '立即开始排查，为我生成排查方案', action: 'start_check' },
        { text: '标记为误报', action: 'send' }
      ]
    }

    // S1 有过对话：按用户上次消息上下文给推荐
    if (stage === 'S1' && hasUserMsg) {
      return [
        { text: '这种原因多久能恢复？', action: 'send' },
        { text: '还有其他可能原因吗？', action: 'send' },
        { text: '开始排查，为我生成方案', action: 'start_check' }
      ]
    }

    if (stage === 'S2') {
      return [
        { text: '查看注意事项', action: 'send' },
        { text: '查看具体步骤', action: 'send' },
        { text: '我已完成排查', action: 'check_done' }
      ]
    }

    if (stage === 'S3') {
      return [
        { text: '查看维修方案', action: 'send' },
        { text: '查看备件清单', action: 'send' },
        { text: '报告：维修已完成', action: 'repair_done' }
      ]
    }

    if (stage === 'S4') {
      return [
        { text: '报告：维修已完成', action: 'repair_done' },
        { text: '遇到问题，需要协助', action: 'send' },
        { text: '查看验收标准', action: 'send' }
      ]
    }

    if (stage === 'S5') {
      return [
        { text: '查看维修报告', action: 'send' },
        { text: '继续下一个事件', action: 'send' }
      ]
    }
  }
  return []
}

function refreshChips() {
  recommendedQuestions.value = getChipsByContext()
}

// ============ 阶段推进 ============
function setStage(eventId, stage) {
  if (!eventId) return
  const prev = eventStage[eventId]
  eventStage[eventId] = stage
  // 阶段变更时重置追问标记
  if (prev !== stage) {
    delete followupSent[eventId + '|S2']
    delete followupSent[eventId + '|S3']
    delete followupSent[eventId + '|S4']
    delete followupSent[eventId + '|S5']
  }
}

// ============ 未读计数 ============
function incUnread(eventId) {
  if (!eventId) return
  eventUnread[eventId] = (eventUnread[eventId] || 0) + 1
}

function clearUnread(eventId) {
  if (!eventId) return
  eventUnread[eventId] = 0
}

// ============ 推送助手消息（核心）============
function pushAssistantMessage(eventId, content, options = {}) {
  if (!eventId) return
  eventStore.addMessage(eventId, {
    role: 'assistant',
    content,
    ts: Date.now(),
    isFollowup: options.isFollowup || false
  })
  // 不在详情 = 未读 +1
  const inDetail = props.mode === 'event' && props.eventContext?.id === eventId
  if (!inDetail) {
    incUnread(eventId)
  }
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

// ============ 5s 定时追问 ============
let followupTimers = {} // { [eventId+'|'+stage]: timeoutId }

function clearFollowupTimers(eventId) {
  Object.keys(followupTimers).forEach(k => {
    if (k.startsWith(eventId + '|')) {
      clearTimeout(followupTimers[k])
      delete followupTimers[k]
    }
  })
}

function scheduleFollowup(eventId) {
  if (!eventId) return
  const stage = eventStage[eventId]
  if (!stage) return
  if (stage === 'S1') return // S1 不追问
  const dedupKey = eventId + '|' + stage
  if (followupSent[dedupKey]) return

  // 演示用 5s；S3 有第二条追问
  if (stage === 'S3') {
    followupTimers[dedupKey + '|a'] = setTimeout(() => {
      pushAssistantMessage(eventId, STAGES.S3.followup, { isFollowup: true })
    }, 5000)
    followupTimers[dedupKey + '|b'] = setTimeout(() => {
      pushAssistantMessage(eventId, STAGES.S3.followup2, { isFollowup: true })
    }, 5000 + 3500)
    followupSent[dedupKey] = true
  } else {
    followupTimers[dedupKey] = setTimeout(() => {
      pushAssistantMessage(eventId, STAGES[stage].followup, { isFollowup: true })
      followupSent[dedupKey] = true
    }, 5000)
  }
}

// ============ 事件切进来时的初始化 ============
function initEventSession(eventId) {
  if (!eventId) return
  if (!eventStage[eventId]) {
    eventStage[eventId] = 'S1'
  }
  clearUnread(eventId)
  // 不清历史消息，但清追问标记让本阶段可重新追问
  const curStage = eventStage[eventId]
  delete followupSent[eventId + '|' + curStage]
  clearFollowupTimers(eventId)
  refreshChips()
  // 进入事件时立刻给个 S1 欢迎（如果没消息的话）
  const sess = eventStore.getSessionMessages(eventId)
  if (sess.length === 0) {
    setTimeout(() => {
      pushAssistantMessage(eventId, '已为您关联该事件。<br>AI 初步判断：' + (props.eventContext?.aiAnalysis?.summary || '数据存在异常') + '<br>如需进一步分析，可继续追问；也可直接让我为您生成排查方案。')
      scheduleFollowup(eventId)
    }, 200)
  } else {
    scheduleFollowup(eventId)
  }
}

// ============ 事件切换监听 ============
watch(() => props.eventContext?.id, (newId, oldId) => {
  if (props.mode !== 'event') {
    recommendedQuestions.value = getChipsByContext()
    return
  }
  if (oldId && oldId !== newId) {
    clearFollowupTimers(oldId)
  }
  if (newId) {
    initEventSession(newId)
  }
}, { immediate: true })

watch(() => props.mode, () => {
  if (props.mode === 'general') {
    refreshChips()
  }
})

// ============ 消息长度变化 → 刷新 chips ============
watch(() => messages.value.length, () => {
  refreshChips()
})

// ============ 切事件 / 关闭 drawer 时清理追问 ============
watch(() => eventStore.selectedEventId, (id) => {
  if (!id) {
    // 关闭 drawer
    Object.keys(followupTimers).forEach(k => clearTimeout(followupTimers[k]))
    followupTimers = {}
  }
})

onUnmounted(() => {
  Object.keys(followupTimers).forEach(k => clearTimeout(followupTimers[k]))
})

// ============ Chip 点击 ============
function handleRecommendedClick(q) {
  if (q.action === 'start_check') {
    handleStartCheck()
    return
  }
  if (q.action === 'check_done') {
    handleCheckDone()
    return
  }
  if (q.action === 'repair_done') {
    handleRepairDone()
    return
  }
  // 默认：写用户消息 → AI 响应
  inputText.value = q.text
  sendMessage()
}

function handleStartCheck() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  // 写用户消息
  eventStore.addMessage(eid, { role: 'user', content: '立即开始排查，为我生成排查方案', ts: Date.now() })
  // 推进阶段
  setStage(eid, 'S2')
  // AI 响应
  setTimeout(() => {
    pushAssistantMessage(eid, '已为您生成排查方案，**请在左侧产物区查看完整内容**。排查过程如有异常请随时反馈。')
    refreshChips()
    scheduleFollowup(eid)
  }, 600)
}

function handleCheckDone() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '我已完成排查', ts: Date.now() })
  setStage(eid, 'S3')
  setTimeout(() => {
    pushAssistantMessage(eid, '收到您的排查反馈。**正在根据结果生成维修方案**…')
    refreshChips()
    scheduleFollowup(eid)
  }, 600)
}

function handleRepairDone() {
  if (!props.eventContext) return
  const eid = props.eventContext.id
  eventStore.addMessage(eid, { role: 'user', content: '报告：维修已完成', ts: Date.now() })
  setStage(eid, 'S5')
  setTimeout(() => {
    pushAssistantMessage(eid, '✅ 已记录维修完成。维修报告已生成在左侧产物区。')
    refreshChips()
    scheduleFollowup(eid)
  }, 600)
}

// ============ 普通发送消息 ============
function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return

  const sessionKey = props.mode === 'event' && props.eventContext
    ? props.eventContext.id
    : props.mode === 'general' ? 'general' : 'situation'

  eventStore.addMessage(sessionKey, {
    role: 'user',
    content: text,
    ts: Date.now()
  })

  setTimeout(() => {
    const response = generateAIResponse(text)
    eventStore.addMessage(sessionKey, {
      role: 'assistant',
      content: response,
      ts: Date.now()
    })
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    refreshChips()
  }, 500)

  inputText.value = ''
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

function generateAIResponse(text) {
  if (text.includes('原因') || text.includes('为什么') || text.includes('推断')) {
    if (props.eventContext?.aiAnalysis?.faultTable) {
      const table = props.eventContext.aiAnalysis.faultTable
      let html = '<div style="font-size:12px;line-height:1.7">根据 AI 诊断，可能原因如下：<br><br>'
      table.forEach((f, i) => {
        const probColor = f.probability === 'high' ? '#FF4D4F' : f.probability === 'medium' ? '#FAAD14' : '#8BAAC0'
        html += `<b>${i + 1}. ${f.name}</b> <span style="color:${probColor}">[${f.probability === 'high' ? '高概率' : f.probability === 'medium' ? '中概率' : '低概率'}]</span><br>`
        html += `<span style="color:#8BAAC0;font-size:11px">${f.detail}</span><br><br>`
      })
      html += '</div>'
      return html
    }
    return '根据当前数据分析，建议先查看 AI 诊断面板中的候选原因列表。'
  }
  if (text.includes('数据快照') || text.includes('快照')) {
    return '事件快照数据已冻结，**关键指标在左侧产物区"事件快照"section 中**。您可以查看事发时各传感器读数与阈值的对比。'
  }
  if (text.includes('误报')) {
    return '已标记为疑似误报。事件将转入观察池，**24 小时内若不再触发则自动关闭**。'
  }
  if (text.includes('注意事项')) {
    return '⚠️ 排查注意事项：<br>1. 作业前确保主机停机断电<br>2. 佩戴防护用具，谨防烫伤<br>3. 记录原始数据，**不要直接调整温控阀**'
  }
  if (text.includes('步骤')) {
    return '具体排查步骤已在左侧产物区"排查方案"section 中展示。**请按顺序逐项执行并记录结果**。'
  }
  if (text.includes('维修方案') || text.includes('维修')) {
    return '维修方案已在左侧产物区"维修方案"section 中生成。**请按规范执行，完成后告诉我结果**。'
  }
  if (text.includes('备件')) {
    return '所需备件：① 冷却水滤芯 ×1 ② 密封圈 ×2 ③ 高温润滑脂 1 支。**请确认库存后再开始维修**。'
  }
  if (text.includes('验收标准')) {
    return '验收标准：① 出口温度 ≤ 85°C ② 流量 ≥ 80m³/h ③ 系统无渗漏。**达到以上三项方可关闭事件**。'
  }
  if (text.includes('维修报告')) {
    return '维修报告已在左侧产物区"维修报告"section 中，**只读，不可编辑**。'
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
    inputText.value = '主机温度现在多少？'
  }
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

.stage-pill {
  margin-left: auto;
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(82,196,26,0.15);
  color: var(--success);
  font-weight: 500;
}

/* 🆕 事件上下文条 */
.event-context-bar {
  padding: 10px 14px 12px;
  background: linear-gradient(135deg, rgba(24,144,255,0.08), rgba(0,188,212,0.04));
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.ecb-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ecb-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.ecb-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.ecb-meta {
  margin-top: 6px;
  gap: 5px;
}

.ecb-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}
.ecb-tag.critical { background: rgba(255,77,79,0.15); color: var(--danger); }
.ecb-tag.important { background: rgba(250,173,20,0.15); color: var(--warning); }
.ecb-tag.normal { background: rgba(24,144,255,0.15); color: var(--accent); }
.ecb-tag.pending { background: rgba(250,173,20,0.15); color: var(--warning); }
.ecb-tag.processing { background: rgba(24,144,255,0.15); color: var(--accent); }
.ecb-tag.resolved { background: rgba(82,196,26,0.15); color: var(--success); }

.ecb-id {
  margin-left: auto;
  font-size: 9px;
  color: var(--text-muted);
  font-family: Consolas, monospace;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

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

.recommended-section {
  margin: 4px 14px 8px;
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
  background: rgba(24,144,255,0.08);
}

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
</style>
