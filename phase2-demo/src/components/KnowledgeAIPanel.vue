<template>
  <div class="knowledge-assistant-shell" :class="{ 'is-compact': compact }">
    <!-- ===== 空间不足时使用浮动入口 ===== -->
    <div
      v-if="compact"
      class="kf-float"
      :class="{ 'kf-active': isOpen, 'kf-dot': showUnreadDot, 'kf-dragging': isDragging }"
      :style="floatStyle"
      @mousedown="onDragStart"
      @touchstart="onDragStart"
      @click.stop="onFloatClick"
    >
      <span v-if="isOpen" class="kf-x">✕</span>
      <img
        v-else
        class="kf-icon"
        src="/assistant-icons/knowledge-entry.svg"
        alt="打开知识库 AI 助手"
        draggable="false"
        @dragstart.prevent
      />
    </div>

    <!-- ===== 宽屏常驻，空间不足时作为覆盖层 ===== -->
    <transition name="slide-fade">
      <div v-if="!compact || isOpen" class="kap-panel" :class="{ 'is-mobile': compact && isMobile }">
      <!-- Header -->
      <div class="kap-header">
        <div class="kap-header-left">
          <svg class="kap-sparkle" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <g class="kap-sparkle-star" transform-origin="8 8">
              <path
                class="kap-sparkle-fill"
                d="M8 1.5l.8 2.5a5.5 5.5 0 0 0 3.2 3.2l2.5.8-2.5.8a5.5 5.5 0 0 0-3.2 3.2L8 14.5l-.8-2.5a5.5 5.5 0 0 0-3.2-3.2L1.5 8l2.5-.8a5.5 5.5 0 0 0 3.2-3.2L8 1.5z"
                fill="currentColor"
              />
              <path
                d="M8 1.5l.8 2.5a5.5 5.5 0 0 0 3.2 3.2l2.5.8-2.5.8a5.5 5.5 0 0 0-3.2 3.2L8 14.5l-.8-2.5a5.5 5.5 0 0 0-3.2-3.2L1.5 8l2.5-.8a5.5 5.5 0 0 0 3.2-3.2L8 1.5z"
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>
          <span class="kap-title">AI 助手</span>
        </div>
        <div class="kap-header-right">
          <ConversationHistory :conversations="sessions.conversations.value" :current-id="sessions.active.value.id" @select="selectConversation" @new-conversation="newConversation" />
          <button class="kap-close-btn" @click="closePanel" title="关闭">✕</button>
        </div>
      </div>

      <!-- 消息区 -->
      <div class="kap-msgs" ref="msgsRef" @click="handleDocRefClick">
        <div v-if="searchQuery || hasFilter" class="knowledge-scope-title">
          <span></span>
          <em>{{ contextBarText }} · {{ filteredDocCount }}篇文档</em>
          <span></span>
        </div>
        <template v-for="(m, i) in messages" :key="i">
          <div v-if="m.role === 'assistant'" class="km km-ai">
            <div
              class="km-bubble"
              :class="{ 'km-bubble-structured': hasKnowledgeCards(m) }"
              v-html="getMsgContent(m)"
            ></div>
          </div>
          <div v-else class="km km-user">
            <div class="km-bubble km-user-bubble">{{ m.content }}</div>
          </div>
        </template>
        <div v-if="chips.length > 0 && messages.length > 0 && !isTyping" class="kap-suggestions">
          <div class="kap-suggestions-title">猜你想问</div>
          <div class="kap-suggestions-list">
            <button
              v-for="(c, i) in chips"
              :key="i"
              class="kap-suggestion-chip"
              @click="handleChip(c)"
            >{{ c.text }}</button>
          </div>
        </div>
        <div v-if="isTyping" class="km km-ai">
          <div class="km-bubble km-typing">
            <span class="td"></span><span class="td"></span><span class="td"></span>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="kap-input">
        <div class="kap-input-wrapper">
          <button class="kap-voice-btn" :class="{ 'is-recording': isVoiceRecording }" @click="toggleVoice" title="语音输入">
            <svg class="kv-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="7" y="2" width="6" height="9" rx="3"/>
              <path d="M4 11a6 6 0 0012 0M10 17v3"/>
            </svg>
            <span v-if="isVoiceRecording" class="kv-pulse"></span>
          </button>
          <input
            v-model="inputText" class="kap-input-field"
            placeholder="输入追问..." @keyup.enter="sendMessage"
          />
          <button class="kap-send-btn" :disabled="!inputText.trim()" @click="sendMessage" title="发送">
            <img :src="sendIcon" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import sendIcon from '@/assets/figma/send.svg'
import ConversationHistory from './messages/ConversationHistory.vue'
import { useAgentConversations, demoConversations } from '@/composables/useAgentConversations'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { knowledgeDocs } from '@/mock/knowledge'

const props = defineProps({
  compact: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  selectedDevice: { type: String, default: '全部' },
  selectedSystem: { type: String, default: '全部系统' },
  selectedDocType: { type: String, default: '全部类型' },
  filteredDocCount: { type: Number, default: 0 },
  filteredDocs: { type: Array, default: () => [] }
})

const emit = defineEmits(['open-doc', 'open-change'])

// ============ 响应式断点 ============
const isMobile = ref(window.innerWidth < 768)
function onResize() { isMobile.value = window.innerWidth < 768 }
window.addEventListener('resize', onResize)
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// ============ 面板开关 ============
const isOpen = ref(!props.compact)
const showUnreadDot = ref(false)
let unreadTimer = null

function togglePanel() {
  if (isOpen.value) closePanel()
  else openPanel()
}

function openPanel() {
  isOpen.value = true
  showUnreadDot.value = false
  if (unreadTimer) { clearTimeout(unreadTimer); unreadTimer = null }
  if (messages.value.length === 0) generateInitialResponse()
  emit('open-change', true)
  nextTick(() => scrollToBottom())
}

function closePanel() {
  isOpen.value = false
  showUnreadDot.value = false
  if (unreadTimer) { clearTimeout(unreadTimer); unreadTimer = null }
  emit('open-change', false)
}

watch(() => props.compact, (compact) => {
  if (compact) closePanel()
  else openPanel()
})

onMounted(() => {
  if (!props.compact) openPanel()
})

// ============ 拖拽移动 ============
const BTN_SIZE = 46
const DRAG_THRESHOLD = 8
const isDragging = ref(false)
const floatPos = ref(null) // { right, bottom }
const hasCustomFloatPos = ref(false)
let dragStartX = 0, dragStartY = 0
let dragOffsetX = 0, dragOffsetY = 0
let didDrag = false

const floatStyle = computed(() => {
  const base = floatPos.value || (isMobile.value ? { right: 20, bottom: 52 } : { right: 24, bottom: 80 })
  let { right, bottom } = base

  if (isOpen.value) {
    if (isMobile.value) {
      const safeBottom = window.innerHeight * 0.78 + 16
      if (!hasCustomFloatPos.value || bottom < safeBottom) bottom = safeBottom
    } else {
      const panelWidth = Math.min(400, window.innerWidth - 48)
      const safeRight = panelWidth + 16
      if (!hasCustomFloatPos.value || right < safeRight) right = safeRight
    }
  }

  return { right: `${right}px`, bottom: `${bottom}px` }
})

function onFloatClick() {
  if (didDrag) { didDrag = false; return }
  togglePanel()
}

function onDragStart(e) {
  if (isOpen.value) return
  isDragging.value = false
  didDrag = false
  const isTouch = e.type === 'touchstart'
  const ev = isTouch ? e.touches[0] : e
  dragStartX = ev.clientX
  dragStartY = ev.clientY

  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  dragOffsetX = ev.clientX - rect.left
  dragOffsetY = ev.clientY - rect.top

  if (isTouch) {
    document.addEventListener('touchmove', onDragMove, { passive: false })
    document.addEventListener('touchend', onDragEnd)
  } else {
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragEnd)
  }
}

function onDragMove(e) {
  const isTouch = e.type === 'touchmove'
  const ev = isTouch ? e.touches[0] : e
  const dx = ev.clientX - dragStartX
  const dy = ev.clientY - dragStartY

  if (!didDrag && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    didDrag = true
    isDragging.value = true
  }
  if (!didDrag) return

  e.preventDefault()
  const right = Math.max(8, window.innerWidth - (ev.clientX - dragOffsetX + BTN_SIZE))
  const bottom = Math.max(8, window.innerHeight - (ev.clientY - dragOffsetY + BTN_SIZE))
  floatPos.value = { right, bottom }
}

function onDragEnd(e) {
  isDragging.value = false
  if (didDrag && floatPos.value) {
    hasCustomFloatPos.value = true
  }
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend', onDragEnd)
}

// ============ 上下文 ============
const hasFilter = computed(() => props.selectedDevice !== '全部' || props.selectedSystem !== '全部系统' || props.selectedDocType !== '全部类型')

const contextBarText = computed(() => {
  const parts = []
  if (props.searchQuery) parts.push(`搜索"${props.searchQuery}"`)
  if (props.selectedDevice !== '全部') parts.push(props.selectedDevice)
  if (props.selectedSystem !== '全部系统') {
    const label = props.selectedSystem.startsWith(props.selectedDevice)
      ? props.selectedSystem.slice(props.selectedDevice.length)
      : props.selectedSystem
    parts.push(label)
  }
  if (props.selectedDocType !== '全部类型') parts.push(props.selectedDocType)
  return parts.join(' · ')
})

// ============ 消息系统 ============
const msgsRef = ref(null)
const isTyping = ref(false)
const sessions=useAgentConversations(computed(()=>'knowledge'),id=>demoConversations(id).map(item=>({...item,messages:item.messages.map(message=>({role:message.role,content:message.text,ts:item.updatedAt}))})))
const inputText=sessions.draft
const messages=computed({get:()=>sessions.active.value.messages,set:value=>{sessions.active.value.messages=value}})
function selectConversation(id){sessions.select(id);scrollToBottom()}
function newConversation(){sessions.newConversation();scrollToBottom()}
let initialResponseTimer = null

function scrollToBottom() {
  nextTick(() => { if (msgsRef.value) msgsRef.value.scrollTop = msgsRef.value.scrollHeight })
}

function streamMessage(msg, fullText) {
  const parts = fullText.split(/(<[^>]+>|\s+)/g).filter(Boolean)
  let pos = 0
  if (!msg) return
  msg.streamed = ''
  const timer = setInterval(() => {
    msg.streamed = parts.slice(0, pos + 1).join('')
    pos++
    scrollToBottom()
    if (pos >= parts.length) {
      clearInterval(timer)
      msg.streamed = undefined
      msg.content = fullText
      scrollToBottom()
    }
  }, 16)
}

function pushAssistantMessage(content, delay = 400, session = sessions.active.value) {
  const message = { role: 'assistant', content: '', raw: content, ts: Date.now() }
  session.messages.push(message)
  sessions.touch(session)
  setTimeout(() => streamMessage(message, content), delay)
}

function pushUserMessage(text) {
  messages.value.push({ role: 'user', content: text, ts: Date.now() })
  sessions.touch()
}

function generateInitialResponse() {
  const session=sessions.active.value
  if (initialResponseTimer) clearTimeout(initialResponseTimer)
  isTyping.value = true
  initialResponseTimer = setTimeout(() => {
    initialResponseTimer = null
    isTyping.value = false
    if (props.searchQuery) pushAssistantMessage(generateSearchSummary(),400,session)
    else if (hasFilter.value) pushAssistantMessage(generateFilterSummary(),400,session)
    else pushAssistantMessage(generateWelcome(),400,session)
    scrollToBottom()
  }, 600)
}

// ============ AI 回复生成 ============
function generateSearchSummary() {
  const docs = props.filteredDocs
  if (docs.length === 0) return `没有找到与"<b>${props.searchQuery}</b>"匹配的文档。`
  const top = docs.slice(0, 3)
  const deviceCounts = {}; const typeCounts = {}
  docs.forEach(d => {
    deviceCounts[d.device] = (deviceCounts[d.device] || 0) + 1
    typeCounts[d.docType] = (typeCounts[d.docType] || 0) + 1
  })
  const deviceSummary = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join('、')
  const typeSummary = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('、')
  const docLinks = top.map(d => `<div class="km-ref" data-doc-id="${d.id}">📄 <b>${d.title}</b><span class="km-ref-meta">${d.device} · ${d.docType} · ${d.id}</span></div>`).join('')
  return `根据搜索"<b>${props.searchQuery}</b>"共找到 <b>${docs.length}</b> 篇相关文档，涉及 ${deviceSummary}，涵盖 ${typeSummary}。<br><br><div class="km-section-title">推荐阅读</div>${docLinks}<br>💡 点击文档标题可直接跳转阅读。`
}

function generateFilterSummary() {
  const docs = props.filteredDocs.slice(0, 4)
  const docLinks = docs.map(d => `<div class="km-ref" data-doc-id="${d.id}">📄 <b>${d.title}</b><span class="km-ref-meta">${d.docType} · ${d.id}</span></div>`).join('')
  return `<div class="km-section-title">推荐阅读</div>${docLinks}`
}

function generateWelcome() {
  const totalDocs = props.filteredDocCount || knowledgeDocs.length
  const featured = ['📋 增压器故障分析及处理案例集', '📋 冷却系统维护与故障诊断', '📋 舵机系统操作与故障处理', '📋 分油机操作与故障排除']
  const items = featured.map(t => `• ${t}`).join('<br>')
  return `你好！知识库共 <b>${totalDocs}</b> 篇技术文档。<br><br>📂 文档覆盖：主机 · 辅机 · 锅炉 · 舵机 · 分油机<br>📂 文档类型：设备手册 · 操作规程 · 故障案例 · 技术通告<br><br>📖 推荐阅读：<br>${items}<br><br>💡 你可以：<br>• 在搜索框输入关键词，AI 自动总结<br>• 在上方按设备、文档类型和系统筛选<br>• 直接输入问题，我来帮你找答案`
}

// ============ 文档搜索 ============
const lastSearchKeyword = ref('')

function searchDocs(keyword) {
  if (!keyword) return null
  const q = keyword.toLowerCase()
  const matches = knowledgeDocs.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.subcategory.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q) ||
    d.device.toLowerCase().includes(q) ||
    d.docType.toLowerCase().includes(q) ||
    d.id.toLowerCase().includes(q)
  )
  return matches
}

function buildSearchResultHtml(matches, keyword) {
  if (matches.length === 0) {
    return `未找到与"<b>${keyword}</b>"相关的文档。试试换个关键词？`
  }
  const top = matches.slice(0, 5)
  const docLinks = top.map(d =>
    `<div class="km-ref" data-doc-id="${d.id}">📄 <b>${d.title}</b><span class="km-ref-meta">${d.device} · ${d.docType} · ${d.id}</span></div>`
  ).join('')

  const deviceStats = {}
  matches.forEach(d => { deviceStats[d.device] = (deviceStats[d.device] || 0) + 1 })
  const typeStats = {}
  matches.forEach(d => { typeStats[d.docType] = (typeStats[d.docType] || 0) + 1 })
  const devStr = Object.entries(deviceStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join('、')
  const typeStr = Object.entries(typeStats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join('、')

  return `找到 <b>${matches.length}</b> 篇与"<b>${keyword}</b>"相关的文档：<br>涉及 ${devStr}，涵盖 ${typeStr}<br><br>${docLinks}${matches.length > 5 ? `<br>…还有 ${matches.length - 5} 篇` : ''}<br><br>💡 点击文档标题可直接跳转阅读。`
}

// ============ AI 回复生成（含搜索） ============
function generateFollowUp(text) {
  const t = text.toLowerCase()

  // 搜索意图：帮我找 / 搜索 / 查一下 / 找一找 + 关键词
  const searchMatch = t.match(/(?:帮我找|搜索|查找|查一下|找一下|找找|有没有|找到)(.+?(?:文件|文档|资料|案例|手册|规程|标准|通告))?/)
  const searchKeyword = searchMatch ? (searchMatch[2] || searchMatch[1]) : null
  if (searchKeyword || /找.*文件|找.*文档|搜索/.test(t)) {
    const kw = searchKeyword || t.replace(/.*?(帮我|请|可以|想|要|能)\s*(找|搜索|查找|查|看)/, '').replace(/的?(文件|文档|资料|案例|手册|规程|标准|通告)?$/, '').trim()
    if (kw && kw.length > 0) {
      const matches = searchDocs(kw)
      lastSearchKeyword.value = kw
      return buildSearchResultHtml(matches, kw)
    }
  }

  // 意图匹配
  if (/原因|为什么|故障|什么原因/.test(t)) {
    const docs = knowledgeDocs.filter(d => d.docType === '故障案例')
    if (docs.length > 0) {
      const d = docs[0]
      return `根据《<b>${d.title}</b>》等 ${docs.length} 篇故障案例，常见原因包括：<br><br>• 密封件老化或损坏<br>• 运动部件磨损超标<br>• 内部通道杂质堵塞<br>• 润滑油路不畅<br><br>📄 <div class="km-ref" data-doc-id="${d.id}">点击查看完整案例 → ${d.title}</div>`
    }
    return '建议在搜索框中输入具体故障现象。'
  }
  if (/维修|处理|怎么修|步骤|怎么做/.test(t)) {
    const docs = knowledgeDocs.filter(d => d.docType === '操作规程' || d.docType === '设备手册')
    if (docs.length > 0) {
      const list = docs.slice(0, 3).map(d => `<div class="km-ref" data-doc-id="${d.id}">📄 ${d.title}</div>`).join('')
      return `以下是 ${docs.length} 篇相关操作规程：<br>${list}<br><br>一般维修步骤：<br>1️⃣ 停机断电<br>2️⃣ 拆卸检查<br>3️⃣ 更换损坏件<br>4️⃣ 清洗通道<br>5️⃣ 装配调试<br>6️⃣ 试车验收`
    }
    return '建议在搜索框中输入具体关键词。'
  }
  if (/备件|零件|型号|规格/.test(t)) {
    const docs = knowledgeDocs.filter(d => d.docType === '设备手册')
    if (docs.length > 0) {
      const list = docs.slice(0, 3).map(d => `<div class="km-ref" data-doc-id="${d.id}">📄 ${d.title}</div>`).join('')
      return `以下是相关的设备手册：<br>${list}<br><br>备件信息通常在"备件清单"章节中，点击文档查看。`
    }
    return '建议搜索对应设备的手册文档。'
  }
  if (/预防|检查|日常|保养|维保/.test(t)) {
    const docs = knowledgeDocs.filter(d => d.docType === '操作规程')
    if (docs.length > 0) {
      const list = docs.slice(0, 3).map(d => `<div class="km-ref" data-doc-id="${d.id}">📄 ${d.title}</div>`).join('')
      return `日常预防措施：<br>1️⃣ 缩短检查周期<br>2️⃣ 定期润滑清洁<br>3️⃣ 建立备件库存<br>4️⃣ 及时记录异常<br><br>相关操作规程：<br>${list}`
    }
    return '日常预防措施：<br>1️⃣ 缩短检查周期<br>2️⃣ 定期润滑清洁<br>3️⃣ 建立备件库存<br>4️⃣ 及时记录异常'
  }
  if (/参数|标准|阈值|正常范围|多少/.test(t)) {
    const docs = knowledgeDocs.filter(d => d.docType === '设备手册')
    if (docs.length > 0) {
      const d = docs[0]
      return `建议查看《<b>${d.title}</b>》。以增压器为例：<br>• 转速：18,500 rpm<br>• 压比：3.2<br>• 效率：≥72%<br><br>📄 <div class="km-ref" data-doc-id="${d.id}">查看完整参数</div>`
    }
    return '建议搜索"技术参数+设备名"。'
  }
  // 兜底：尝试搜索
  const fallbackMatches = searchDocs(t.replace(/^(我想|我要|帮我|请|可以|能)\s*/, '').trim())
  if (fallbackMatches && fallbackMatches.length > 0) {
    lastSearchKeyword.value = t
    return buildSearchResultHtml(fallbackMatches, t)
  }
  return `已收到。试试直接问我：<br>• "帮我找增压器相关的文件"<br>• "搜索冷却系统操作规程"<br>• "故障案例有哪些"`
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  const session=sessions.active.value
  pushUserMessage(text)
  inputText.value = ''
  isTyping.value = true
  scrollToBottom()
  setTimeout(() => {
    isTyping.value = false
    pushAssistantMessage(generateFollowUp(text),400,session)
    scrollToBottom()
  }, 800)
}

const chips = computed(() => {
  if (messages.value.length === 0) {
    if (props.searchQuery) return [
      { text: '常见原因有哪些？', highlight: false },
      { text: '怎么处理/维修？', highlight: false },
      { text: '相关技术参数？', highlight: false }
    ]
    return [
      { text: '帮我找增压器故障案例', highlight: false },
      { text: '搜索冷却系统操作规程', highlight: false },
      { text: '主机设备手册有哪些', highlight: false },
      { text: '查找舵机相关文档', highlight: true }
    ]
  }
  // 有搜索关键词 → 基于搜索结果推荐
  if (lastSearchKeyword.value) {
    return [
      { text: `这些文档的常见原因？`, highlight: false },
      { text: `查看维修步骤`, highlight: false },
      { text: `相关技术参数`, highlight: false },
      { text: `帮你找其他内容`, highlight: true }
    ]
  }
  // 通用追问
  return [
    { text: '常见原因有哪些？', highlight: false },
    { text: '维修步骤是什么？', highlight: true },
    { text: '日常怎么预防？', highlight: false }
  ]
})

function handleChip(c) { inputText.value = c.text; sendMessage() }

watch(() => props.searchQuery, (val) => {
  if (val && !isOpen.value) {
    showUnreadDot.value = true
    if (unreadTimer) clearTimeout(unreadTimer)
    unreadTimer = setTimeout(() => { showUnreadDot.value = false }, 3 * 60 * 1000)
  }
})

// Filtering updates retrieval context, never creates or clears agent conversations.
watch([() => props.selectedDevice, () => props.selectedSystem, () => props.selectedDocType], () => {
  if (!isOpen.value) showUnreadDot.value = true
})

function getMsgContent(m) {
  if (m.streamed !== undefined) return m.streamed + '<span class="cursor-blink">▍</span>'
  return m.content
}

function hasKnowledgeCards(message) {
  const content = message.raw || message.streamed || message.content || ''
  return content.includes('class="km-ref"')
}

function handleDocRefClick(e) {
  const ref = e.target.closest('.km-ref')
  if (ref) {
    e.preventDefault(); e.stopPropagation()
    const docId = ref.dataset.docId
    if (docId) {
      emit('open-doc', docId)
      if (window.innerWidth <= 1024) closePanel()
    }
  }
}

// ============ 语音输入 ============
const isVoiceRecording = ref(false)
let recognition = null
let voiceTimer = null
let voiceRestartTimer = null

function getRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return null
  const r = new SpeechRecognition()
  r.lang = 'zh-CN'
  r.continuous = true
  r.interimResults = true
  r.maxAlternatives = 1
  return r
}

function startVoice() {
  const r = getRecognition()
  if (!r) {
    pushAssistantMessage('⚠️ 当前浏览器不支持语音输入，请使用 Chrome 或 Edge 浏览器。')
    return
  }
  recognition = r
  isVoiceRecording.value = true

  recognition.onresult = (event) => {
    let transcript = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript
    }
    inputText.value = transcript
    // 清除自动发送计时
    if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null }
  }

  recognition.onerror = () => {
    stopVoice()
  }

  recognition.onend = () => {
    // 如果仍在录音状态（非手动停止），自动重启
    if (isVoiceRecording.value) {
      voiceRestartTimer = setTimeout(() => {
        if (isVoiceRecording.value && recognition) {
          try { recognition.start() } catch {}
        }
      }, 200)
    }
  }

  try { recognition.start() } catch (e) { stopVoice() }
}

function stopVoice() {
  if (voiceRestartTimer) { clearTimeout(voiceRestartTimer); voiceRestartTimer = null }
  if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null }
  isVoiceRecording.value = false
  if (recognition) {
    try {
      recognition.onend = null
      recognition.stop()
    } catch {}
    recognition = null
  }
}

function toggleVoice() {
  if (isVoiceRecording.value) {
    stopVoice()
  } else {
    startVoice()
  }
}

onBeforeUnmount(() => {
  if (initialResponseTimer) clearTimeout(initialResponseTimer)
  stopVoice()
})
</script>

<style scoped>
.knowledge-assistant-shell {
  flex: 0 0 400px;
  width: 400px;
  min-width: 400px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-surface);
}
.knowledge-assistant-shell.is-compact {
  flex-basis: 0;
  width: 0;
  min-width: 0;
  overflow: visible;
  background: transparent;
}

/* ===== 浮动按钮 ===== */
.kf-float {
  position: fixed;
  bottom: 80px;
  right: 24px;
  z-index: 1002;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #106BFF;
  box-shadow: 0 4px 16px rgba(22,119,255,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  user-select: none;
  touch-action: none;
}
.kf-float:hover {
  box-shadow: 0 6px 24px rgba(22,119,255,0.5);
  transform: scale(1.08);
}
.kf-float:active { transform: scale(0.95); }
.kf-float.kf-dragging {
  cursor: grabbing;
  transition: none !important;
  transform: scale(1.04) !important;
  box-shadow: 0 8px 28px rgba(16, 107, 255, 0.5);
}
.kf-icon { display: block; width: 24px; height: 24px; object-fit: contain; pointer-events: none; user-select: none; }
.kf-x {
  font-size: 17px; color: #fff; font-weight: 600; line-height: 1;
}
/* 活跃态：按钮带光晕 */
.kf-float.kf-active {
  box-shadow: 0 4px 20px rgba(22,119,255,0.55);
}
/* 未读红点 */
.kf-float.kf-dot::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  border: 2px solid #fff;
  box-shadow: 0 0 6px rgba(245,63,63,0.5);
  animation: dot-pulse 2s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%,100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

/* ===== 面板：宽屏常驻 ===== */
.kap-panel {
  position: relative;
  width: 100%;
  max-width: none;
  height: 100%;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
}
.knowledge-assistant-shell:not(.is-compact) .kap-close-btn {
  display: none;
}

/* 空间不足时沿用态势、事件详情的覆盖层逻辑 */
.knowledge-assistant-shell.is-compact .kap-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: 400px;
  max-width: calc(100vw - 48px);
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  z-index: 1001;
  box-shadow: -4px 0 24px rgba(0,0,0,0.08);
}
.kap-panel.is-mobile {
  top: 0;
  bottom: 0;
  width: 100%;
  max-width: 100%;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  border-left: none;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.1);
}

/* 滑入动画 */
.slide-fade-enter-active { transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
.slide-fade-leave-active { transition: transform 0.2s cubic-bezier(0.4,0,0.2,1); }
.slide-fade-enter-from,
.slide-fade-leave-to { transform: translateX(100%); }
.slide-fade-enter-to,
.slide-fade-leave-from { transform: translateX(0); }

/* ===== Header ===== */
.kap-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 48px;
  box-sizing: border-box;
  padding: 16px 16px 8px;
  border-bottom: 0;
  flex-shrink: 0;
  background: #FFFFFF;
}
.kap-header-left { display: flex; align-items: center; gap: 8px; }
.kap-sparkle { width: 20px; height: 20px; color: #106BFF; overflow: visible; }
.kap-sparkle-star { transform-box: fill-box; transform-origin: center; animation: kap-sparkle-orbit 12s linear infinite; }
.kap-sparkle-fill { opacity: 0.28; }
@keyframes kap-sparkle-orbit {
  0% { transform: rotate(0deg) scale(0); opacity: 0; }
  8.333% { transform: rotate(120deg) scale(1); opacity: 1; }
  91.667% { transform: rotate(1320deg) scale(1); opacity: 1; }
  100% { transform: rotate(1440deg) scale(0); opacity: 0; }
}
.kap-title { font-size: 14px; line-height: 24px; font-weight: 500; color: #19213D; }
.kap-header-right { display: flex; align-items: center; gap: 8px; }
.kap-close-btn {
  width: 28px; height: 28px; border-radius: 50%;
  background: transparent; border: none; color: var(--text-muted);
  font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.kap-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ===== 消息区 ===== */
.kap-msgs { flex: 1; overflow-y: auto; padding: 8px 16px 0; display: flex; flex-direction: column; gap: 16px; background: #FFFFFF; }
.knowledge-scope-title {
  display: grid;
  grid-template-columns: minmax(16px, 1fr) auto minmax(16px, 1fr);
  align-items: center;
  gap: 8px;
  color: #9195A2;
  font-size: 12px;
  line-height: 20px;
}
.knowledge-scope-title span { height: 1px; background: #E4E7ED; }
.knowledge-scope-title em { overflow: hidden; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.kap-suggestions { display: flex; flex-direction: column; gap: 8px; }
.kap-suggestions-title { color: #9195A2; font-size: 14px; line-height: 24px; font-weight: 600; }
.kap-suggestions-list { display: flex; flex-wrap: wrap; gap: 6px; }
.kap-suggestion-chip {
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-sm);
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.kap-suggestion-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }
.km { display: flex; width: 100%; max-width: 100%; margin: 0; font-size: 14px; }
.km-ai { justify-content: flex-start; }
.km-user { justify-content: flex-end; }
.km-bubble {
  max-width: 100%; font-size: 14px; line-height: 24px;
  color: #19213D; border: 0; border-radius: 0;
  padding: 0; background: transparent; box-shadow: none;
}
.km-ai > .km-bubble:not(.km-bubble-structured) {
  box-sizing: border-box;
  width: fit-content;
  max-width: 96%;
  padding: 8px 12px;
  border: 1px solid #EEF0F4;
  border-radius: 8px;
  background: #F5F7FA;
}
.km-ai > .km-bubble-structured {
  box-sizing: border-box;
  width: 96%;
  max-width: 96%;
}
.km-user-bubble {
  width: fit-content;
  padding: 8px 12px;
  background: rgba(16, 107, 255, 0.05);
  color: #1A1C1F;
  border: 0;
  border-radius: 8px;
}

/* 文档引用 */
.kap-msgs :deep(.km-ref) {
  display: block; padding: 10px 12px; margin: 8px 0; border-radius: 8px;
  background: var(--bg-hover); border: 1px solid var(--border-secondary);
  color: var(--text-primary); cursor: pointer; transition: all 0.18s;
  line-height: 1.5; position: relative;
}
.kap-msgs :deep(.km-ref::after) {
  content: '→'; position: absolute; right: 12px; top: 50%;
  transform: translateY(-50%); font-size: 16px;
  color: var(--accent); opacity: 0; transition: opacity 0.18s; font-weight: 500;
}

@media (hover: hover) and (pointer: fine) {
  .kap-msgs :deep(.km-ref:hover) {
    background: var(--accent-bg);
    border-color: var(--accent);
    box-shadow: 0 1px 6px rgba(22,119,255,0.08);
    padding-right: 36px;
  }
  .kap-msgs :deep(.km-ref:hover::after) { opacity: 1; }
}
.kap-msgs :deep(.km-ref-meta) {
  display: block; font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;
}
.kap-msgs :deep(.km-section-title) {
  margin-bottom: 8px;
  color: #9195A2;
  font-size: 14px;
  line-height: 24px;
  font-weight: 600;
}

/* 打字 */
.km-typing { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 52px; min-height: 40px; }
.td { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.3; animation: td-bounce 1.4s ease-in-out infinite; }
.td:nth-child(2) { animation-delay: 0.2s; }
.td:nth-child(3) { animation-delay: 0.4s; }
@keyframes td-bounce { 0%,60%,100%{transform:translateY(0);opacity:0.3} 30%{transform:translateY(-4px);opacity:1} }
:deep(.cursor-blink) { animation: kap-blink 0.8s ease-in-out infinite; color: var(--accent); font-weight: 700; }
@keyframes kap-blink { 0%,100%{opacity:1} 50%{opacity:0} }

/* ===== 输入区 ===== */
.kap-input { padding: 0 16px 16px; border-top: 0; flex-shrink: 0; background: #FFFFFF; }
.kap-input-wrapper {
  position: relative; display: flex; align-items: flex-start; gap: 2px;
  min-height: 88px; box-sizing: border-box;
  background: #FFFFFF; border: 1px solid #E4E7ED;
  border-radius: 8px; padding: 12px; transition: border-color 0.2s, box-shadow 0.2s;
}
.kap-input-wrapper:focus-within { border-color: #C8D8FF; box-shadow: 0 0 0 2px rgba(16,107,255,0.08); }
.kap-input-field {
  flex: 1; background: transparent; border: none; outline: none;
  height: 24px; color: #19213D; font-size: 14px; line-height: 24px; padding: 0; font-family: inherit;
  min-width: 0;
}
.kap-input-field::placeholder { color: var(--text-muted); }

/* 语音按钮 */
.kap-voice-btn {
  position: absolute; right: 64px; bottom: 18px; width: 24px; height: 24px; border-radius: 50%;
  background: transparent; border: none; color: var(--text-muted);
  cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin: 0;
}
.kap-voice-btn:hover { color: var(--accent); background: var(--accent-bg); }
.kap-voice-btn.is-recording {
  color: var(--danger); background: var(--danger-bg);
  animation: voice-pulse 1.2s ease-in-out infinite;
}
.kap-voice-btn .kv-icon { width: 17px; height: 17px; position: relative; z-index: 1; }
.kap-voice-btn .kv-pulse {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid var(--danger); opacity: 0.6;
  animation: pulse-ring 1.2s ease-out infinite;
}
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes voice-pulse {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

/* 发送按钮 */
.kap-send-btn {
  position: absolute; right: 12px; bottom: 12px;
  width: 36px; height: 36px; border-radius: 50%;
  background: #106BFF; border: none; color: #FFFFFF;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
  flex-shrink: 0; margin: 0;
}
.kap-send-btn svg { width: 15px; height: 15px; }
.kap-send-btn:hover:not(:disabled) {
  background: #4096FF; transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(22,119,255,0.3);
}
.kap-send-btn:active:not(:disabled) { transform: scale(0.92); }
.kap-send-btn:disabled { background: #CFE1FF; color: #FFFFFF; cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .kap-sparkle-star { animation: none; opacity: 1; transform: none; }
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .kf-float { bottom: 52px; right: 20px; width: 42px; height: 42px; }
  .kap-panel { border-top-left-radius: 16px; border-top-right-radius: 16px; }
}
</style>
