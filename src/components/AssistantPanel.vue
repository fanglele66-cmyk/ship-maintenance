<template>
  <div class="assistant-panel">
    <div class="assistant-header">
      <div class="mode-badge" :class="mode">{{ modeLabel }}</div>
      <h3 class="assistant-title">AI 助手</h3>
    </div>

    <div class="assistant-messages" ref="messagesRef">
      <!-- 通用模式欢迎页 -->
      <template v-if="mode === 'general'">
        <div class="welcome-section">
          <div class="welcome-text">{{ greetingText }}</div>
          <div class="welcome-summary" v-html="summaryHtml"></div>
        </div>
        <div class="recommended-chips">
          <button
            v-for="(chip, idx) in generalChips"
            :key="idx"
            class="chip"
            :class="{ clicked: clickedChips.has(idx) }"
            @click="handleChipClick(chip, idx)"
          >
            <span v-if="clickedChips.has(idx)" class="chip-check">✓</span>
            {{ chip.text }}
          </button>
        </div>
      </template>

      <!-- 事件模式消息 -->
      <template v-if="mode === 'event'">
        <div v-for="(msg, idx) in messages" :key="idx" class="message-bubble" :class="msg.role">
          <div class="bubble-avatar" v-if="msg.role === 'bot'">
            <Icon icon="mdi:robot" />
          </div>
          <div class="bubble-content">
            <div class="bubble-text" v-html="msg.content"></div>
            <div v-if="msg.chips" class="bubble-chips">
              <button
                v-for="(chip, cidx) in msg.chips"
                :key="cidx"
                class="chip small"
                :class="{ clicked: clickedChips.has(`${idx}-${cidx}`) }"
                @click="handleEventChipClick(chip, `${idx}-${cidx}`)"
              >
                <span v-if="clickedChips.has(`${idx}-${cidx}`)" class="chip-check">✓</span>
                {{ chip.text }}
              </button>
            </div>
            <div v-if="msg.actionCard" class="action-card">
              <div class="action-title">{{ msg.actionCard.title }}</div>
              <div class="action-desc">{{ msg.actionCard.desc }}</div>
              <div class="action-buttons">
                <button
                  v-for="(btn, bidx) in msg.actionCard.buttons"
                  :key="bidx"
                  class="action-btn"
                  :class="btn.type"
                >{{ btn.label }}</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 态势感知模式 -->
      <template v-if="mode === 'situation'">
        <div class="situation-brief">
          <div class="brief-title">船舶概览</div>
          <div class="brief-item">
            <span class="brief-label">健康分</span>
            <span class="brief-value">82 <span class="brief-unit">良好</span></span>
          </div>
          <div class="brief-item">
            <span class="brief-label">设备状态</span>
            <span class="brief-value">正常 8 / 预警 1 / 异常 1</span>
          </div>
          <div class="brief-item">
            <span class="brief-label">重点关注</span>
            <span class="brief-value warning">主机冷却水温偏高</span>
          </div>
        </div>
        <div class="recommended-chips">
          <button
            v-for="(chip, idx) in situationChips"
            :key="idx"
            class="chip"
            :class="{ clicked: clickedChips.has(`sit-${idx}`) }"
            @click="handleChipClick(chip, `sit-${idx}`)"
          >
            <span v-if="clickedChips.has(`sit-${idx}`)" class="chip-check">✓</span>
            {{ chip.text }}
          </button>
        </div>
      </template>
    </div>

    <div class="assistant-input">
      <input
        v-model="inputText"
        type="text"
        placeholder="输入问题..."
        @keyup.enter="sendMessage"
      />
      <button class="voice-btn" @click="toggleVoice">
        <Icon icon="mdi:microphone" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { eventList } from '@/mock/eventMock'

const route = useRoute()
const inputText = ref('')
const messagesRef = ref(null)
const clickedChips = ref(new Set())

// 根据路由判断模式
const mode = computed(() => {
  if (route.path === '/event') return 'general'
  if (route.path === '/situation') return 'situation'
  return 'general'
})

const modeLabel = computed(() => {
  return {
    general: '通用模式',
    event: '事件模式',
    situation: '辅助模式'
  }[mode.value]
})

// 通用模式数据
const greetingText = ref('你好，当前共有 6 件事件待处理')

const summaryHtml = computed(() => {
  return `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">船舶健康分</div>
        <div class="summary-value">82 <span class="unit">良好</span></div>
      </div>
      <div class="summary-item">
        <div class="summary-label">事件统计</div>
        <div class="summary-value">
          <span class="stat critical">紧急 3</span>
          <span class="stat warning">预警 2</span>
          <span class="stat info">一般 1</span>
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-label">重点关注</div>
        <div class="summary-value warning">主机冷却水温异常</div>
      </div>
    </div>
  `
})

const generalChips = [
  { text: '今天有几件紧急事件？' },
  { text: '最近哪个系统问题最多？' },
  { text: '有没有重复出现的故障？' }
]

const situationChips = [
  { text: '哪些设备需要关注？' },
  { text: '健康分为什么是82？' },
  { text: '有异常的设备汇总' }
]

// 事件模式消息
const messages = ref([])

// 监听路由变化，切换到事件模式
watch(() => route.path, (newPath) => {
  if (newPath === '/event') {
    // 检查是否有选中的事件（从 EventCenterView 传递）
    // 这里简化处理，实际应该通过 store 或 props 传递
  }
})

function handleChipClick(chip, idx) {
  if (clickedChips.value.has(idx)) return
  clickedChips.value.add(idx)
  
  // 模拟回复
  const reply = generateReply(chip.text)
  messages.value.push({
    role: 'user',
    content: chip.text
  })
  messages.value.push({
    role: 'bot',
    content: reply,
    chips: [
      { text: '查看详细数据' },
      { text: '开始排查' }
    ]
  })
}

function handleEventChipClick(chip, idx) {
  if (clickedChips.value.has(idx)) return
  clickedChips.value.add(idx)
  
  messages.value.push({
    role: 'user',
    content: chip.text
  })
  messages.value.push({
    role: 'bot',
    content: generateReply(chip.text)
  })
}

function sendMessage() {
  if (!inputText.value.trim()) return
  
  messages.value.push({
    role: 'user',
    content: inputText.value
  })
  
  setTimeout(() => {
    messages.value.push({
      role: 'bot',
      content: generateReply(inputText.value)
    })
    inputText.value = ''
  }, 500)
}

function generateReply(text) {
  // 简化的回复生成逻辑
  if (text.includes('紧急')) {
    return '当前有 3 件紧急事件：主机冷却水温异常、舵机液压油温度超限、空压机排气压力波动。建议优先处理主机冷却水系统问题。'
  }
  if (text.includes('系统')) {
    return '主机系统问题最多（3件），其次是辅机系统（2件）和甲板机械（1件）。'
  }
  if (text.includes('重复')) {
    return '检测到 2 起重复故障：主机冷却水系统在过去 3 个月内出现 2 次类似问题，建议彻底排查。'
  }
  if (text.includes('查看')) {
    return '好的，正在为您展示详细数据...'
  }
  if (text.includes('排查')) {
    return '正在为您生成排查步骤...'
  }
  return '收到您的问题，我正在分析...'
}

function toggleVoice() {
  // 语音识别（简化）
  alert('语音输入功能（示例）')
}

// 自动滚动到底部
watch(messages, () => {
  setTimeout(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  }, 100)
}, { deep: true })

onMounted(() => {
  // 初始化时加载通用模式数据
})
</script>

<style scoped>
.assistant-panel {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #0B1422;
  border-left: 1px solid #1E3A5F;
}

.assistant-header {
  padding: 14px 16px;
  border-bottom: 1px solid #1E3A5F;
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-badge {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 600;
}

.mode-badge.general {
  color: #1890FF;
  background: rgba(24,144,255,0.15);
}

.mode-badge.event {
  color: #FAAD14;
  background: rgba(250,173,20,0.15);
}

.mode-badge.situation {
  color: #00BCD4;
  background: rgba(0,188,212,0.15);
}

.assistant-title {
  font-size: 14px;
  font-weight: 700;
  color: #E8F0FF;
  margin: 0;
}

.assistant-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.welcome-section {
  margin-bottom: 20px;
}

.welcome-text {
  font-size: 13px;
  color: #E8F0FF;
  margin-bottom: 12px;
  line-height: 1.6;
}

.welcome-summary {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 14px;
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 11px;
  color: #5A7A92;
}

.summary-value {
  font-size: 12px;
  color: #E8F0FF;
  font-weight: 600;
}

.summary-value .unit {
  font-size: 10px;
  color: #5A7A92;
  font-weight: 400;
}

.summary-value .stat {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  margin-left: 4px;
}

.stat.critical {
  color: #FF4D4F;
  background: rgba(255,77,79,0.1);
}

.stat.warning {
  color: #FAAD14;
  background: rgba(250,173,20,0.1);
}

.stat.info {
  color: #1890FF;
  background: rgba(24,144,255,0.1);
}

.summary-value.warning {
  color: #FAAD14;
}

.recommended-chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chip {
  padding: 8px 12px;
  font-size: 11px;
  color: #8BAAC0;
  background: transparent;
  border: 1px solid #1E3A5F;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chip:hover {
  border-color: #1890FF;
  color: #1890FF;
}

.chip.clicked {
  background: rgba(82,196,26,0.1);
  border-color: rgba(82,196,26,0.3);
  color: #52C41A;
}

.chip-check {
  font-size: 10px;
}

.chip.small {
  padding: 5px 10px;
  font-size: 10px;
}

/* 消息气泡 */
.message-bubble {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.message-bubble.user {
  flex-direction: row-reverse;
}

.bubble-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1890FF, #00BCD4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  flex-shrink: 0;
}

.bubble-content {
  max-width: 220px;
}

.bubble-text {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: #C8D8E8;
  line-height: 1.6;
}

.message-bubble.user .bubble-text {
  background: rgba(24,144,255,0.2);
  border-color: rgba(24,144,255,0.3);
  color: #E8F0FF;
}

.bubble-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.action-card {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.action-title {
  font-size: 11px;
  font-weight: 600;
  color: #E8F0FF;
  margin-bottom: 6px;
}

.action-desc {
  font-size: 10px;
  color: #8BAAC0;
  margin-bottom: 10px;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 5px 10px;
  font-size: 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.action-btn.primary {
  background: rgba(24,144,255,0.15);
  color: #1890FF;
}

.action-btn.success {
  background: rgba(82,196,26,0.15);
  color: #52C41A;
}

.action-btn.danger {
  background: rgba(255,77,79,0.15);
  color: #FF4D4F;
}

.action-btn:hover {
  opacity: 0.8;
}

/* 态势感知概览 */
.situation-brief {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
}

.brief-title {
  font-size: 12px;
  font-weight: 600;
  color: #E8F0FF;
  margin-bottom: 10px;
}

.brief-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #1E3A5F;
}

.brief-item:last-child {
  border-bottom: none;
}

.brief-label {
  font-size: 11px;
  color: #5A7A92;
}

.brief-value {
  font-size: 11px;
  color: #E8F0FF;
  font-weight: 600;
}

.brief-value .brief-unit {
  font-size: 10px;
  color: #5A7A92;
  font-weight: 400;
}

.brief-value.warning {
  color: #FAAD14;
}

/* 输入区 */
.assistant-input {
  padding: 12px 16px;
  border-top: 1px solid #1E3A5F;
  display: flex;
  gap: 8px;
}

.assistant-input input {
  flex: 1;
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #E8F0FF;
  outline: none;
}

.assistant-input input:focus {
  border-color: #1890FF;
}

.voice-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(24,144,255,0.15);
  border: none;
  color: #1890FF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.voice-btn:hover {
  background: rgba(24,144,255,0.25);
}

.voice-btn svg {
  font-size: 16px;
}
</style>
