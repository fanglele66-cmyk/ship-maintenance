<template>
  <div class="home-assistant">
    <!-- 顶部：欢迎语 -->
    <div class="ha-top">
      <h2 class="ha-greeting">Hi 轮机长，今天我们从哪里开始</h2>
    </div>

    <!-- 中部：快捷提问 chips -->
    <div class="ha-chips">
      <button
        v-for="(chip, idx) in activeChips"
        :key="chip.key"
        class="ha-chip"
        @click="handleChipClick(chip, idx)"
      >{{ chip.text }}</button>
    </div>

    <!-- 底部：对话消息流（chip 触发后追加） -->
    <div class="ha-conversation" ref="convRef">
      <div v-for="(m, i) in conversation" :key="i" class="ha-msg" :class="'ha-msg-' + m.role">
        <div v-if="m.role === 'ai'" class="ha-msg-avatar">AI</div>
        <div class="ha-msg-bubble" v-html="m.content"></div>
      </div>
    </div>

    <!-- 底部：输入栏 -->
    <div class="ha-input">
      <button class="ha-input-attach" title="附件">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <input
        v-model="inputText"
        class="ha-input-field"
        type="text"
        placeholder="[这是输入框] 发消息或按住说话……"
        @keyup.enter="handleSend"
      />
      <button class="ha-input-mic" title="语音">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useEventStore } from '@/stores/eventStore'

const eventStore = useEventStore()
const convRef = ref(null)
const inputText = ref('')
const conversation = ref([])

// 三个推荐快捷问题（点击后移除）
const chips = ref([
  { text: '今天有哪些待处理事件？', key: 'pending' },
  { text: '近期有没有重复出现的故障？', key: 'repeat' },
  { text: '下一次定期巡检是什么时候？', key: 'inspection' }
])

const activeChips = computed(() => chips.value)

// 三组AI回复内容
const responses = {
  pending: () => {
    const list = eventStore.events.filter(e => e.status !== 'resolved')
    if (!list.length) return '<b>当前没有待处理事件，一切正常运行。</b>'
    const html = list.slice(0, 5).map((e, i) => {
      const color = e.priority === 'critical' ? 'var(--danger)' : e.priority === 'important' ? 'var(--warning)' : 'var(--text-muted)'
      return `<div style="margin:6px 0;padding:8px 10px;background:var(--bg-surface);border-left:3px solid ${color};border-radius:4px">
        <div style="font-weight:600">${i + 1}. ${e.title || e.id}</div>
        <div style="color:var(--text-muted);font-size:var(--font-sm)">${e.system || ''} · ${e.priority === 'critical' ? '紧急' : e.priority === 'important' ? '重要' : '一般'}</div>
      </div>`
    }).join('')
    return `当前共有 <b>${list.length}</b> 件待处理事件：${html}<div style="margin-top:8px;color:var(--text-muted)">点击左侧事件卡片可进入处理流程。</div>`
  },
  repeat: () => {
    const all = eventStore.events
    const sysCount = {}
    all.forEach(e => {
      if (e.system) sysCount[e.system] = (sysCount[e.system] || 0) + 1
    })
    const sorted = Object.entries(sysCount).sort((a, b) => b[1] - a[1])
    if (!sorted.length) return '<b>近期未发现重复故障。</b>'
    const top = sorted.slice(0, 3).map(([sys, n], i) =>
      `<div style="margin:4px 0"><b>${i + 1}. ${sys}</b> · ${n} 次相关事件</div>`
    ).join('')
    return `近30天共记录 <b>${all.length}</b> 件事件，重复出现频率最高的系统：${top}<div style="margin-top:6px;color:var(--text-muted)">建议在下次坞修时重点关注。</div>`
  },
  inspection: () => {
    const next = new Date()
    next.setDate(next.getDate() + 3)
    const dateStr = `${next.getMonth() + 1}月${next.getDate()}日`
    return `<b>下一次定期巡检安排：</b><br>
      <div style="margin-top:6px;padding:8px 10px;background:var(--bg-surface);border-radius:4px">
        📅 <b>${dateStr} 09:00</b> · 主机舱例行巡检<br>
        <span style="color:var(--text-muted);font-size:var(--font-sm)">负责人：值班轮机员 · 预计耗时 1.5h</span>
      </div>
      <div style="margin-top:6px">本次巡检项：冷却水系统 / 滑油系统 / 燃油系统 / 应急设备</div>`
  }
}

function pushUserMsg(text) {
  conversation.value.push({ role: 'user', content: text })
  scrollBottom()
}

function pushAiMsg(html) {
  // 模拟思考
  conversation.value.push({ role: 'ai', content: '<span class="ha-typing">▍ AI 正在分析</span>' })
  scrollBottom()
  setTimeout(() => {
    conversation.value.pop()
    conversation.value.push({ role: 'ai', content: html })
    scrollBottom()
  }, 600)
}

function scrollBottom() {
  nextTick(() => {
    if (convRef.value) convRef.value.scrollTop = convRef.value.scrollHeight
  })
}

function handleChipClick(chip) {
  pushUserMsg(chip.text)
  pushAiMsg(responses[chip.key]())
  // 点击后从列表中移除
  const idx = chips.value.findIndex(c => c.key === chip.key)
  if (idx !== -1) chips.value.splice(idx, 1)
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  pushUserMsg(text)
  inputText.value = ''
  // 默认回复
  pushAiMsg('已收到你的问题："' + text + '"。我正在查询相关信息…')
}

onMounted(() => {
  scrollBottom()
})
</script>

<style scoped>
.home-assistant {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  padding: 24px 20px 0;
  overflow: hidden;
}

/* ===== 顶部欢迎区 ===== */
.ha-top {
  padding: 12px 4px 18px;
  flex-shrink: 0;
}
.ha-greeting {
  font-size: var(--font-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 14px 0;
  line-height: 1.4;
}
.ha-alert {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-surface);
  border: 1.5px solid var(--warning);
  border-radius: 999px;
  color: var(--text-primary);
  font-size: var(--font-base);
}
.ha-alert-arrow {
  color: var(--warning);
  font-weight: 700;
  font-size: var(--font-md);
}
.ha-alert-text {
  font-weight: 500;
}

/* ===== 快捷提问 chips ===== */
.ha-chips {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0 16px;
  flex-shrink: 0;
}
.ha-chip {
  text-align: left;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: var(--font-base);
  cursor: pointer;
  transition: all 0.2s;
}
.ha-chip:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
  transform: translateX(2px);
}

/* ===== 对话流 ===== */
.ha-conversation {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ha-msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  animation: msgIn 0.3s ease;
}
@keyframes msgIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.ha-msg-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  font-weight: 700;
  flex-shrink: 0;
}
.ha-msg-bubble {
  flex: 1 1 0;
  padding: 10px 14px;
  background: var(--bg-surface);
  border-radius: 10px;
  font-size: var(--font-base);
  line-height: 1.6;
  color: var(--text-primary);
}
.ha-msg-user {
  flex-direction: row-reverse;
}
.ha-msg-user .ha-msg-bubble {
  background: var(--accent);
  color: #fff;
  max-width: 75%;
}
.ha-typing {
  color: var(--text-muted);
  font-style: italic;
}

/* ===== 输入栏 ===== */
.ha-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 16px;
  border-top: 1px solid var(--border-primary);
  flex-shrink: 0;
}
.ha-input-attach,
.ha-input-mic {
  width: 36px; height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.ha-input-attach:hover,
.ha-input-mic:hover {
  background: var(--bg-hover);
  color: var(--accent);
}
.ha-input-field {
  flex: 1 1 0;
  height: 40px;
  padding: 0 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  font-size: var(--font-base);
  color: var(--text-primary);
  outline: none;
  transition: border 0.15s;
}
.ha-input-field:focus {
  border-color: var(--accent);
}
</style>
