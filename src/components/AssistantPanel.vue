<template>
  <transition name="slide-panel">
    <div v-if="visible" class="assistant-panel">
      <!-- 标题栏 -->
      <div class="ap-head">
        <span class="ap-title"><Icon icon="mdi:robot-outline" /> 智能助手</span>
        <div class="ap-head-tools">
          <button class="tts-btn" :class="{ active: assistantTTS }" @click="assistantTTS = !assistantTTS" title="语音播报">
            <Icon icon="mdi:volume-high" />
          </button>
          <button class="ap-close" @click="emit('update:visible', false)"><Icon icon="mdi:close" /></button>
        </div>
      </div>

      <!-- 事件关联选择器 -->
      <div class="ap-event-bar">
        <Icon icon="mdi:link-variant" class="aeb-icon" :class="{ linked: currentCtx !== 'general' }" />
        <select v-model="assistantEventId" class="aeb-select">
          <option :value="null">— 通用对话 —</option>
          <option v-for="ev in eventOptions" :key="ev.id" :value="ev.id">
            [{{ ev.id }}] {{ ev.title }}
          </option>
        </select>
        <Icon icon="mdi:chevron-down" class="aeb-arrow" />
      </div>

      <!-- 消息区 -->
      <div class="ap-body" ref="bodyRef">
        <!-- 通用模式欢迎（无消息时显示为 Bot 气泡） -->
        <template v-if="isGeneralMode && !hasGeneralMessages">
          <div class="msg-row bot">
            <div class="bubble bot-bubble">
              <p class="db-welcome">{{ greetingText }}</p>
              <p class="db-summary" v-html="summaryHtml"></p>
            </div>
          </div>
        </template>

        <!-- 正常消息列表 -->
        <div v-for="m in displayMessages" :key="m.id" class="msg-row" :class="m.role">
          <div class="bubble" :class="m.role + '-bubble'" v-html="m.text"></div>
        </div>

        <!-- 思考中 -->
        <div v-if="thinking" class="msg-row bot">
          <div class="bubble bot-bubble thinking-bubble">
            <span></span><span></span><span></span>
          </div>
        </div>

        <!-- 推荐问题（始终显示在底部，点击后标记已问） -->
        <div v-if="currentChips.length && !thinking" class="dash-chips-row">
          <button
            v-for="(chip, ci) in currentChips"
            :key="ci"
            class="dash-chip"
            :class="{ clicked: clickedChipSet.has(chip.send) }"
            @click="sendChip(chip)"
          >
            <Icon :icon="chip.icon" />
            <span>{{ chip.label }}</span>
            <Icon v-if="clickedChipSet.has(chip.send)" icon="mdi:check" class="chip-check" />
          </button>
        </div>
      </div>

      <!-- 输入区 / 语音面板 -->
      <div class="ap-input-area">
        <template v-if="!assistantListening">
          <textarea
            ref="inputRef"
            v-model="assistantInput"
            class="ap-textarea"
            placeholder="输入问题… (Enter 发送, Shift+Enter 换行)"
            rows="1"
            @keydown.enter.exact.prevent="sendMsg"
            @input="autoResize"
          ></textarea>
          <button class="input-btn mic-btn" @click="startVoice" title="语音输入">
            <Icon icon="mdi:microphone-outline" />
          </button>
          <button class="input-btn send-btn" @click="sendMsg" :disabled="!assistantInput.trim()">
            <Icon icon="mdi:send" />
          </button>
        </template>

        <!-- 语音识别面板 -->
        <div v-else class="voice-panel">
          <div class="vp-left">
            <div class="vp-mic"><Icon icon="mdi:microphone" /></div>
            <div class="vp-info">
              <div class="vp-status">正在聆听…</div>
              <div class="vp-text">{{ assistantVoiceText || '等待说话…' }}</div>
            </div>
          </div>
          <div class="vp-actions">
            <button class="vp-cancel" @click="cancelVoice">取消</button>
            <button class="vp-done" @click="finishVoice">✓ 完成</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useRepairStore } from '@/stores/repairStore'

const props = defineProps({
  visible: Boolean,
  eventId: { type: String, default: null }
})
const emit = defineEmits(['update:visible'])

const repairStore = useRepairStore()
const bodyRef = ref(null)
const inputRef = ref(null)

// ===== 状态变量 =====
const assistantTTS = ref(false)
const assistantEventId = ref(null)
const assistantInput = ref('')
const assistantListening = ref(false)
const assistantVoiceText = ref('')
const thinking = ref(false)

// ===== 会话隔离 =====
// key: 'general' | eventId
const sessions = reactive({})
const eventContextSent = reactive({})

function getSession(ctxId) {
  if (!sessions[ctxId]) sessions[ctxId] = []
  return sessions[ctxId]
}

const currentCtx = computed(() => {
  // 以用户选择为准（assistantEventId 可被 props.eventId 初始化，但用户可自由切换）
  if (assistantEventId.value) return assistantEventId.value
  return 'general'
})

const isGeneralMode = computed(() => currentCtx.value === 'general')

const currentMessages = computed(() => getSession(currentCtx.value))

// ===== 事件列表 =====
const eventOptions = computed(() => repairStore.events)

// 当前关联的事件对象
const linkedEvent = computed(() => {
  const id = currentCtx.value === 'general' ? null : currentCtx.value
  if (!id) return null
  return repairStore.events.find(e => e.id === id) || null
})

// ===== 通用模式 Dashboard 数据 =====
const urgentEvents = computed(() =>
  repairStore.events.filter(e => e.priority === 'high' && e.status !== 'resolved' && e.status !== 'false_alarm')
)
const pendingEvents = computed(() =>
  repairStore.events.filter(e => e.status === 'pending' || e.status === 'processing' || e.status === 'temp_handled')
)

// 通用模式是否有消息（控制欢迎页显示）
const hasGeneralMessages = computed(() => (sessions['general'] || []).length > 0)

// 通用模式显示的消息列表（有消息时正常显示，无消息时不重复渲染）
const displayMessages = computed(() => {
  if (isGeneralMode.value && !hasGeneralMessages.value) return []
  return currentMessages.value
})

// 欢迎语（纯文本）
const greetingText = computed(() => {
  const urgent = urgentEvents.value.length
  const pending = pendingEvents.value.length
  if (urgent > 0 && pending > 0) {
    return `检测到您有 ${urgent} 个紧急告警待处理，${pending} 个事件跟进中。`
  } else if (urgent > 0) {
    return `检测到您有 ${urgent} 个紧急告警待处理，建议优先处置。`
  } else if (pending > 0) {
    return `当前有 ${pending} 个事件正在跟进中，暂无紧急告警。`
  }
  return '所有设备运行正常，暂无待处理告警。'
})

// 摘要详情 HTML（含最紧急事件）
const summaryHtml = computed(() => {
  const topEv = urgentEvents.value[0] || pendingEvents.value[0]
  if (!topEv) return ''
  const ai = topEv.aiAnalysis
  const card0 = ai?.dataCards?.[0]
  const sensorCode = card0?.name?.split('-')?.[0] || ''
  let html = `<span style="color:#00bcd4;font-weight:600">最紧急：</span>${topEv.title}`
  if (sensorCode) html += `<br><span style="color:#8899b0">核心传感器：${sensorCode}</span>`
  if (ai?.conclusion) html += `<br><span style="color:#8899b0">AI诊断：${ai.conclusion}</span>`
  return html
})

const dashboardChips = computed(() => {
  const chips = []
  const topEv = urgentEvents.value[0] || pendingEvents.value[0]
  if (topEv) {
    chips.push({
      label: `去查看 ${topEv.title.slice(0, 12)}${topEv.title.length > 12 ? '…' : ''}`,
      icon: 'mdi:alert-circle-outline',
      send: `去查看 ${topEv.title}`
    })
  }
  chips.push({ label: '今天巡检有什么异常？', icon: 'mdi:clipboard-check-outline', send: '今天巡检有什么异常？' })
  chips.push({ label: '生成今日巡检报告', icon: 'mdi:file-document-outline', send: '生成今日巡检报告' })
  return chips.slice(0, 3)
})

// ===== 事件模式推荐问题（基于事件 aiAnalysis 数据动态生成，每个事件不同） =====
const eventChips = computed(() => {
  if (isGeneralMode.value || !linkedEvent.value) return []
  const ev = linkedEvent.value
  const ai = ev.aiAnalysis
  const chips = []
  const title = ev.title

  // 1. 基于首要故障候选生成针对性原因问题
  if (ai?.faultTable?.length) {
    const topFault = ai.faultTable[0]
    chips.push({
      label: `${topFault.candidate}是主因吗？`,
      icon: 'mdi:help-circle-outline',
      send: `${title} 是不是${topFault.candidate}导致的？`
    })
  }

  // 2. 基于核心传感器生成具体数据查询问题
  if (ai?.dataCards?.length) {
    const coreCard = ai.dataCards[0]
    const sensorShort = coreCard.name.split('-')[0] || coreCard.name
    const isAbnormal = coreCard.verdictType === 'danger' || coreCard.verdictType === 'warning'
    chips.push({
      label: isAbnormal ? `${sensorShort}为什么异常？` : `${sensorShort}当前读数？`,
      icon: 'mdi:chart-line',
      send: `${title} ${sensorShort}传感器当前数据是多少？${isAbnormal ? '为什么异常？' : ''}`
    })
  }

  // 3. 根据事件特征生成第三个推荐问题（差异化）
  if (ai?.relatedCases?.length) {
    const topCase = ai.relatedCases[0]
    const caseTitle = topCase.title.length > 14 ? topCase.title.slice(0, 14) + '…' : topCase.title
    chips.push({
      label: `类似「${caseTitle}」案例？`,
      icon: 'mdi:book-open-outline',
      send: `${title} 有没有类似"${topCase.title}"的历史案例？`
    })
  } else if (ai?.suggestionsList?.length) {
    chips.push({
      label: '怎么处理？处置建议',
      icon: 'mdi:lightbulb-outline',
      send: `${title} 应该怎么处理？给点处置建议`
    })
  } else if (ai?.autoActions?.length) {
    chips.push({
      label: '系统已做了什么？',
      icon: 'mdi:clock-outline',
      send: `${title} 系统自动做了哪些操作？`
    })
  }

  return chips.slice(0, 3)
})

// ===== 统一推荐问题（始终显示，点击后标记已问） =====
const currentChips = computed(() => {
  if (isGeneralMode.value) return dashboardChips.value
  return eventChips.value
})

// 已点击的推荐问题（按 ctx 分组，切换上下文时重置）
const clickedChips = reactive({})  // { [ctxId]: Set<string> }
const clickedChipSet = computed(() => {
  const ctx = currentCtx.value
  if (!clickedChips[ctx]) clickedChips[ctx] = new Set()
  return clickedChips[ctx]
})

// 切换上下文时不清空（保留已问标记，让用户知道哪些问过了）

// ===== props.eventId 联动 =====
watch(() => props.eventId, (newId) => {
  if (newId) {
    assistantEventId.value = newId
    pushEventContextIfNeed(newId)
  }
}, { immediate: true })

watch(() => props.visible, (v) => {
  if (v) {
    if (props.eventId) {
      assistantEventId.value = props.eventId
      pushEventContextIfNeed(props.eventId)
    }
    nextTick(() => scrollBtm())
  }
})

watch(assistantEventId, (newId, oldId) => {
  // 切换到新事件时推送上下文消息；切换到通用模式不做处理
  if (newId && newId !== oldId) pushEventContextIfNeed(newId)
  // 切换上下文时滚动到底部
  nextTick(() => scrollBtm())
})

function pushEventContextIfNeed(evId) {
  if (eventContextSent[evId]) return
  const ev = repairStore.events.find(e => e.id === evId)
  if (!ev) return
  eventContextSent[evId] = true
  const ai = ev.aiAnalysis
  const cards = ai?.dataCards || []
  const sourceMap = { ai: 'AI检测', inspect: '巡检发现', report: '船员上报' }

  // 核心传感器摘要（取前2个）
  let sensorHtml = ''
  if (cards.length) {
    const sensorLines = cards.slice(0, 2).map(c => {
      const val = (c.value || '').replace(/<[^>]+>/g, '').slice(0, 45)
      const vColor = c.verdictType === 'danger' ? '#FF4D4F' : c.verdictType === 'warning' ? '#FAAD14' : '#52C41A'
      return `　· ${c.name.split('-')[0] || c.name}：${val}… <span style="color:${vColor}">${c.verdict}</span>`
    }).join('<br>')
    sensorHtml = `<br><br><strong>核心传感器：</strong><br>${sensorLines}`
  }

  // 可能原因摘要（取概率最高的1条）
  let causeHtml = ''
  if (ai?.faultTable?.length) {
    const top = ai.faultTable[0]
    const probColor = top.probability === '高' ? '#FF4D4F' : top.probability === '中' ? '#FAAD14' : '#52C41A'
    causeHtml = `<br><br><strong>首要可能原因：</strong>${top.candidate} <span style="color:${probColor}">[${top.probability}]</span>`
  }

  // 同类案例数
  let caseHtml = ''
  if (ai?.relatedCases?.length) {
    caseHtml = `<br><strong>同类案例：</strong>已检索到 ${ai.relatedCases.length} 条（最高匹配 ${ai.relatedCases[0].match}%）`
  }

  getSession(evId).push({
    id: Date.now(),
    role: 'bot',
    text: `已关联事件 <strong>${ev.id}</strong>：「${ev.title}」<br><br>` +
          `<strong>设备：</strong>${ev.deviceName}<br>` +
          `<strong>状态：</strong>${ev.status}　<strong>优先级：</strong>${ev.priority}<br>` +
          `<strong>来源：</strong>${sourceMap[ev.source] || ev.source}　<strong>发生时间：</strong>${ev.createdAt}<br>` +
          (ai?.conclusion ? `<br><strong>AI诊断：</strong>${ai.conclusion}${ai.confidence ? `（置信度 ${ai.confidence}%）` : ''}` : '') +
          sensorHtml + causeHtml + caseHtml +
          `<br><br><span style="color:#8899b0">👇 点击下方推荐问题快速提问，或直接输入您的问题。</span>`
  })
  nextTick(() => scrollBtm())
}

// ===== 发送消息 =====
function sendChip(chip) {
  // 标记已点击
  clickedChipSet.value.add(chip.send)
  sendMsg(chip.send)
}

function sendMsg(forceText) {
  const txt = (typeof forceText === 'string' ? forceText : assistantInput.value).trim()
  if (!txt) return

  const ctx = currentCtx.value
  getSession(ctx).push({ id: Date.now(), role: 'user', text: txt })
  assistantInput.value = ''
  nextTick(() => { autoResize(); scrollBtm() })

  // 800ms 延迟后回复
  thinking.value = true
  scrollBtm()
  setTimeout(() => {
    thinking.value = false
    const reply = genReply(txt)
    getSession(ctx).push({ id: Date.now() + 1, role: 'bot', text: reply })
    scrollBtm()
  }, 800)
}

// ===== AI 回复引擎 =====
const randomReplies = [
  '根据设备运行数据和历史记录分析，建议先检查该系统的传感器读数是否在正常范围内。',
  '这类故障通常与系统压力异常或传感器漂移有关。建议先执行标准排查流程。',
  '我已检索到相关维修手册章节，关键排查步骤已整理好。建议按优先级逐步排查。',
  '根据当前工况数据和报警记录，建议关注相关传感器的实时变化趋势。'
]

function genReply(q) {
  const ev = linkedEvent.value
  const ai = ev?.aiAnalysis

  // --- 查看具体事件 ---
  if (/去查看|查看.*事件|看一下/.test(q)) {
    const target = ev || urgentEvents.value[0] || repairStore.events[0]
    if (!target) return randomReplies[Math.floor(Math.random() * randomReplies.length)]
    const tai = target.aiAnalysis
    const cards = tai?.dataCards || []
    const cardLines = cards.slice(0, 2).map(c => {
      const val = (c.value || '').replace(/<[^>]+>/g, '').slice(0, 50)
      return `　· ${c.name}：${val}… → <span style="color:#00bcd4">${c.verdict}</span>`
    }).join('<br>')
    return `事件 <strong>${target.id}</strong>：「${target.title}」<br><br>` +
           `<strong>设备：</strong>${target.deviceName}<br>` +
           `<strong>状态：</strong>${target.status}　<strong>优先级：</strong>${target.priority}<br>` +
           `<strong>来源：</strong>${target.source === 'ai' ? 'AI检测' : target.source === 'inspect' ? '巡检发现' : '船员上报'}<br>` +
           `<strong>发生时间：</strong>${target.createdAt}<br>` +
           (tai?.conclusion ? `<br><strong>AI诊断结论：</strong>${tai.conclusion}（置信度 ${tai.confidence || '--'}%）<br>` : '') +
           (tai?.conclusionDetail ? `<br><span style="color:#8899b0">${tai.conclusionDetail.split('\n').slice(0, 3).join('<br>')}</span><br>` : '') +
           (cardLines ? `<br><strong>核心传感器数据：</strong><br>${cardLines}<br>` : '') +
           (tai?.faultTable?.length ? `<br><strong>可能原因（${tai.faultTable.length}项）：</strong>${tai.faultTable.slice(0, 2).map(f => f.candidate).join('、')}${tai.faultTable.length > 2 ? '…' : ''}<br>` : '') +
           `<br>可继续问我：<span style="color:#00bcd4">原因分析</span> / <span style="color:#00bcd4">传感器数据</span> / <span style="color:#00bcd4">同类案例</span> / <span style="color:#00bcd4">处置建议</span>`
  }

  // --- 原因分析 ---
  if (/原因|为什么|什么问题|什么故障|怎么回事|分析|是不是|是主因|导致|引起的/.test(q)) {
    if (ai?.faultTable?.length) {
      const causes = ai.faultTable.map((f, i) => {
        const probColor = f.probability === '高' ? '#FF4D4F' : f.probability === '中' ? '#FAAD14' : '#52C41A'
        return `<strong>${i + 1}. ${f.candidate}</strong> <span style="color:${probColor}">[概率：${f.probability}]</span><br>` +
               `　<strong>依据：</strong>${f.reason}<br>` +
               `　<strong>后果：</strong>${f.consequence}`
      }).join('<br><br>')
      return `根据传感器数据和AI诊断，<strong>${ev.title}</strong>的可能原因分析如下：<br><br>` +
             causes + '<br><br>' +
             `<strong>诊断结论：</strong>${ai.conclusion || ''}<br>` +
             `<strong>置信度：</strong>${ai.confidence || '--'}%<br>` +
             `<strong>设备：</strong>${ev.deviceName}<br>` +
             `<br><span style="color:#8899b0">建议按概率从高到低逐项排查，点击「处置建议」获取详细方案。</span>`
    }
  }

  // --- 趋势/数据/传感器 ---
  if (/趋势|数据|传感器|读数|多少|当前值/.test(q)) {
    if (ai?.dataCards?.length) {
      const cards = ai.dataCards.map((c, i) => {
        const val = (c.value || '').replace(/<[^>]+>/g, '')
        const vColor = c.verdictType === 'danger' ? '#FF4D4F' : c.verdictType === 'warning' ? '#FAAD14' : '#52C41A'
        return `<strong>${i + 1}. ${c.name}</strong><br>` +
               `　<strong>采样信息：</strong>${c.meta}<br>` +
               `　<strong>实测数据：</strong>${val}<br>` +
               `　<strong>判定：</strong><span style="color:${vColor}">${c.verdict}</span>`
      }).join('<br><br>')
      let trendLine = ''
      if (ai.trendData) {
        const td = ai.trendData
        const points = td.times.map((t, i) => `${t}: ${td.values[i]}${td.yUnit}`).join(' → ')
        trendLine = `<br><br><strong>趋势曲线（${td.seriesName}）：</strong><br>　${points}<br>　范围：${td.yMin}~${td.yMax}${td.yUnit}`
      }
      return `<strong>${ev.title}</strong> 的传感器实时数据如下（共 ${ai.dataCards.length} 项监控）：<br><br>` + cards + trendLine +
             `<br><br><span style="color:#8899b0">完整趋势曲线和图谱可在「检修中心 → AI分析」Tab查看。</span>`
    }
  }

  // --- 排查/步骤 ---
  if (/检查|排查|处置|怎么修|如何|步骤|怎么办/.test(q)) {
    if (ev?.todos?.inspections?.[0]?.steps?.length) {
      const insp = ev.todos.inspections[0]
      const steps = insp.steps.slice(0, 5).map((s, i) => {
        const items = (s.items || []).slice(0, 3).map(it => `　　· ${it}`).join('<br>')
        return `<strong>${i + 1}. ${s.title}</strong>${s.time ? ` <span style="color:#8899b0">[${s.time}]</span>` : ''}<br>${items}`
      }).join('<br>')
      return `<strong>${insp.title || '排查步骤'}</strong>（共 ${insp.steps.length} 步）：<br><br>` + steps +
             `<br><br><span style="color:#8899b0">参考文档：${ev.deviceName} 维护手册。完整步骤请在「检修中心」查看维修方案。</span>`
    }
  }

  // --- 处置建议（新增） ---
  if (/处置建议|怎么处理|解决方案|建议|怎么办|措施/.test(q)) {
    if (ai?.suggestionsList?.length) {
      const sugs = ai.suggestionsList.map((s, i) =>
        `<strong>${i + 1}.</strong> ${s}`
      ).join('<br>')
      return `<strong>${ev.title}</strong> 的处置建议（共 ${ai.suggestionsList.length} 条）：<br><br>` + sugs +
             `<br><br><strong>诊断结论：</strong>${ai.conclusion || ''}` +
             `<br><span style="color:#8899b0">如需查看具体排查步骤，请点击「排查步骤」。</span>`
    }
  }

  // --- 案例/同类 ---
  if (/案例|同类|历史故障|相似|以前.*发生/.test(q)) {
    if (ai?.relatedCases?.length) {
      const cases = ai.relatedCases.map((c, i) => {
        const matchColor = c.match >= 80 ? '#52C41A' : c.match >= 60 ? '#FAAD14' : '#8899b0'
        return `<strong>案例 ${i + 1}：</strong>${c.title}<br>` +
               `　<strong>匹配度：</strong><span style="color:${matchColor}">${c.match}%</span><br>` +
               `　<strong>处置方案：</strong>${c.solution}`
      }).join('<br><br>')
      return `已检索到 <strong>${ai.relatedCases.length} 条同类历史案例</strong>，按匹配度排序：<br><br>` + cases +
             `<br><br><span style="color:#8899b0">建议参考高匹配度案例的处置方案进行排查。</span>`
    }
  }

  // --- 自动操作/时间线 ---
  if (/自动|时间线|什么时候|过程|做了什么/.test(q)) {
    if (ai?.autoActions?.length) {
      const actions = ai.autoActions.map((a, i) =>
        `<strong>${i + 1}.</strong> ${a}`
      ).join('<br>')
      return `<strong>${ev.title}</strong> 的系统自动操作时间线：<br><br>` + actions +
             `<br><br><span style="color:#8899b0">系统已自动完成告警、数据关联、案例检索和工单生成等操作。</span>`
    }
  }

  // --- 巡检异常 ---
  if (/巡检.*异常|异常.*巡检|今天.*巡检|巡检.*今天/.test(q)) {
    const abnormalEvts = repairStore.events.filter(e => e.priority !== 'low' && e.status !== 'resolved' && e.status !== 'false_alarm')
    const lines = abnormalEvts.slice(0, 3).map((e, i) =>
      `${i + 1}. <strong>${e.title}</strong>（${e.deviceName}）— 事件 ${e.id}`
    ).join('<br>')
    return `今日机舱日检完成，共发现 <strong style="color:#00bcd4">${abnormalEvts.length}</strong> 项异常：<br><br>` +
           (lines || '暂无异常项') + '<br><br>其余检查项目均在正常范围内。'
  }

  // --- 待办/待处理 ---
  if (/待处理|待办|有什么事|今天.*什么/.test(q)) {
    const pending = repairStore.events.filter(e => e.status === 'pending' || e.status === 'processing')
    const list = pending.length
      ? pending.map((e, i) => `${i + 1}. ${e.id} · ${e.title}（${e.status}）`).join('<br>')
      : '当前无待处理事件。'
    return `当前待处理事件共 <strong style="color:#00bcd4">${pending.length}</strong> 项：<br><br>` + list
  }

  // --- 默认：4条随机回复 ---
  if (ev) {
    return `关于「${ev.title}」，${randomReplies[Math.floor(Math.random() * randomReplies.length)]}`
  }
  return randomReplies[Math.floor(Math.random() * randomReplies.length)]
}

// ===== 语音输入 (Web Speech API) =====
let recognition = null

function startVoice() {
  assistantListening.value = true
  assistantVoiceText.value = ''

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    // 浏览器不支持，模拟一下
    assistantVoiceText.value = '（浏览器不支持语音识别，请使用文本输入）'
    setTimeout(() => {
      assistantListening.value = false
    }, 2000)
    return
  }

  recognition = new SR()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onresult = (event) => {
    let finalText = ''
    let interimText = ''
    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalText += transcript
      } else {
        interimText += transcript
      }
    }
    assistantVoiceText.value = finalText + interimText
  }

  recognition.onerror = (e) => {
    assistantVoiceText.value = '识别出错：' + e.error
  }

  recognition.onend = () => {
    // 如果还在聆听状态但识别结束了，不自动关闭
  }

  try {
    recognition.start()
  } catch (e) {
    // 忽略重复启动错误
  }
}

function cancelVoice() {
  if (recognition) {
    try { recognition.stop() } catch (e) {}
    recognition = null
  }
  assistantListening.value = false
  assistantVoiceText.value = ''
}

function finishVoice() {
  if (recognition) {
    try { recognition.stop() } catch (e) {}
    recognition = null
  }
  assistantListening.value = false
  if (assistantVoiceText.value.trim()) {
    assistantInput.value = assistantVoiceText.value.trim()
    assistantVoiceText.value = ''
    nextTick(() => {
      autoResize()
      inputRef.value?.focus()
    })
  }
}

// ===== 工具函数 =====
function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

function scrollBtm() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}
</script>

<style scoped>
/* ===== 整体面板 ===== */
.assistant-panel {
  position: fixed; top: 0; right: 0; bottom: 56px;
  width: 400px; z-index: 85;
  display: flex; flex-direction: column;
  background: #0a1120;
  box-shadow: -4px 0 30px rgba(0,0,0,0.5);
  overflow: hidden;
}

/* ===== 标题栏 ===== */
.ap-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  background: #0d1526;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.ap-title {
  font-size: 15px; font-weight: 700; color: #00bcd4;
  display: flex; align-items: center; gap: 7px;
}
.ap-title svg { font-size: 20px; }
.ap-head-tools { display: flex; align-items: center; gap: 6px; }
.tts-btn {
  width: 32px; height: 32px; border-radius: 50%;
  background: transparent; border: none; color: #4d5f75;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 18px; transition: all 0.15s;
}
.tts-btn:hover { color: #8899b0; }
.tts-btn.active {
  color: #00bcd4;
  animation: ttsPulse 1.5s ease-in-out infinite;
}
@keyframes ttsPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,188,212,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(0,188,212,0); }
}
.ap-close {
  width: 32px; height: 32px; border-radius: 50%;
  background: transparent; border: none; color: #4d5f75;
  cursor: pointer; font-size: 20px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.ap-close:hover { background: rgba(255,255,255,0.08); color: #e8edf4; }

/* ===== 事件关联选择器 ===== */
.ap-event-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  background: #0d1526;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0; position: relative;
}
.aeb-icon { font-size: 18px; color: #4d5f75; flex-shrink: 0; }
.aeb-icon.linked { color: #00bcd4; }
.aeb-select {
  flex: 1; height: 32px;
  background: #1e2d3d; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 0 28px 0 10px;
  font-size: 13px; color: #e8edf4; outline: none;
  cursor: pointer; appearance: none;
  transition: border-color 0.15s;
}
.aeb-select:hover { border-color: rgba(0,188,212,0.3); }
.aeb-select:focus { border-color: #00bcd4; }
.aeb-select:disabled { opacity: 0.6; cursor: not-allowed; }
.aeb-select option { background: #1e2d3d; color: #e8edf4; }
.aeb-arrow {
  position: absolute; right: 42px; top: 50%; transform: translateY(-50%);
  font-size: 16px; color: #4d5f75; pointer-events: none;
}
.aeb-lock {
  font-size: 10px; color: #00bcd4; background: rgba(0,188,212,0.12);
  padding: 2px 8px; border-radius: 10px; white-space: nowrap; flex-shrink: 0;
}

/* ===== 消息区 ===== */
.ap-body {
  flex: 1; overflow-y: auto; padding: 16px 14px;
  display: flex; flex-direction: column; gap: 12px;
}
.ap-body::-webkit-scrollbar { width: 4px; }
.ap-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.msg-row { display: flex; }
.msg-row.bot { justify-content: flex-start; }
.msg-row.user { justify-content: flex-end; }

.bubble {
  max-width: 90%; padding: 10px 14px;
  font-size: 13px; line-height: 1.6; word-break: break-word;
}

/* Bot 气泡：暗色渐变 */
.bot-bubble {
  background: linear-gradient(145deg, #1a2a44, #1f3250);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px 12px 12px 2px;
  color: #e8edf4;
}
.bot-bubble :deep(strong) { color: #00bcd4; }

/* 通用模式欢迎气泡 */
.db-welcome {
  margin: 0 0 6px; font-size: 13px; color: #e8edf4; line-height: 1.6;
}
.db-summary {
  margin: 0; font-size: 12px; color: #8899b0; line-height: 1.7;
}
.db-summary :deep(span) { /* already styled inline */ }

/* 推荐标签行（独立于气泡） */
.dash-chips-row {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding: 0 0 0 4px;
}
.dash-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 18px;
  background: rgba(0,188,212,0.08);
  border: 1px solid rgba(0,188,212,0.22);
  color: #00bcd4; font-size: 12px; cursor: pointer;
  transition: all 0.15s; font-weight: 500;
}
.dash-chip:hover { background: rgba(0,188,212,0.16); border-color: #00bcd4; }
.dash-chip svg { font-size: 15px; flex-shrink: 0; }

/* 已点击的推荐问题 */
.dash-chip.clicked {
  opacity: 0.45;
  background: rgba(82,196,26,0.06);
  border-color: rgba(82,196,26,0.2);
  color: #52c41a;
}
.dash-chip.clicked:hover { background: rgba(82,196,26,0.12); border-color: rgba(82,196,26,0.4); }
.chip-check { font-size: 13px !important; }

/* User 气泡：青色 */
.user-bubble {
  background: #00bcd4;
  border-radius: 12px 12px 2px 12px;
  color: #fff;
}

/* 思考动画 */
.thinking-bubble { display: flex; gap: 5px; align-items: center; padding: 14px 18px; }
.thinking-bubble span {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4d5f75; animation: dotBounce 1.2s infinite;
}
.thinking-bubble span:nth-child(2) { animation-delay: 0.2s; }
.thinking-bubble span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotBounce {
  0%,80%,100% { transform: scale(0.55); opacity: 0.25; }
  40% { transform: scale(1); opacity: 1; }
}

/* ===== 输入区 ===== */
.ap-input-area {
  flex-shrink: 0; padding: 10px 14px;
  background: #0d1526;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: flex-end; gap: 8px;
}
.ap-textarea {
  flex: 1; min-height: 36px; max-height: 100px;
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
  background: #1e2d3d; padding: 8px 12px;
  font-size: 13px; color: #e8edf4; outline: none;
  resize: none; line-height: 1.5;
  transition: border-color 0.15s;
  font-family: inherit;
}
.ap-textarea::placeholder { color: #4d5f75; }
.ap-textarea:focus { border-color: #00bcd4; }

.input-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; transition: all 0.15s;
}
.mic-btn {
  background: #1e2d3d; color: #8899b0;
  border: 1px solid rgba(255,255,255,0.08);
}
.mic-btn:hover { color: #00bcd4; border-color: rgba(0,188,212,0.3); }
.send-btn {
  background: #00bcd4; color: #fff;
}
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.send-btn:not(:disabled):hover { background: #00a5b8; }

/* ===== 语音识别面板 ===== */
.voice-panel {
  flex: 1; display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 10px 14px;
  background: rgba(239,68,68,0.12);
  border: 1px solid #ef4444; border-radius: 10px;
}
.vp-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.vp-mic {
  width: 36px; height: 36px; border-radius: 50%;
  background: #ef4444; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
  animation: micPulse 1.2s ease-in-out infinite;
}
@keyframes micPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
  50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
}
.vp-info { min-width: 0; flex: 1; }
.vp-status { font-size: 12px; color: #ef4444; font-weight: 600; }
.vp-text {
  font-size: 13px; color: #e8edf4; margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.vp-actions { display: flex; gap: 8px; flex-shrink: 0; }
.vp-cancel {
  padding: 6px 14px; border-radius: 8px; font-size: 12px;
  background: transparent; color: #8899b0;
  border: 1px solid rgba(255,255,255,0.15); cursor: pointer;
  font-weight: 600; transition: all 0.15s;
}
.vp-cancel:hover { background: rgba(255,255,255,0.08); color: #e8edf4; }
.vp-done {
  padding: 6px 14px; border-radius: 8px; font-size: 12px;
  background: #00bcd4; color: #fff; border: none; cursor: pointer;
  font-weight: 600; transition: all 0.15s;
}
.vp-done:hover { background: #00a5b8; }

/* ===== 过渡动画 ===== */
.slide-panel-enter-active, .slide-panel-leave-active {
  transition: transform 0.28s ease, opacity 0.28s;
}
.slide-panel-enter-from, .slide-panel-leave-to {
  transform: translateX(120%); opacity: 0;
}
</style>
