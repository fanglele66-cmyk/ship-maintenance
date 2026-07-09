<template>
  <!-- ===== 浮动入口按钮（可拖拽） ===== -->
  <div class="kf-float" :class="{ 'kf-active': isOpen, 'kf-dot': showUnreadDot, 'kf-dragging': isDragging }" :style="floatStyle"
    @mousedown="onDragStart"
    @touchstart="onDragStart"
    @click.stop="onFloatClick"
  >
    <span v-if="isOpen" class="kf-x">✕</span>
    <span v-else class="kf-icon">✨</span>
  </div>

  <!-- ===== 面板（浮动覆盖层，侧栏不受影响） ===== -->
  <transition name="slide-fade">
    <div v-if="isOpen" class="kap-panel" :class="{ 'is-mobile': isMobile }">
      <!-- Header -->
      <div class="kap-header">
        <div class="kap-header-left">
          <span class="kap-sparkle">✨</span>
          <span class="kap-title">AI 助手</span>
        </div>
        <div class="kap-header-right">
          <span v-if="contextLabel" class="kap-context-pill">{{ contextLabel }}</span>
          <button class="kap-close-btn" @click="closePanel" title="关闭">✕</button>
        </div>
      </div>

      <!-- 上下文条 -->
      <div v-if="searchQuery || hasFilter" class="kap-context-bar">
        <svg class="kcb-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="9" cy="9" r="6"/><path d="M13.5 13.5L18 18"/>
        </svg>
        <span class="kcb-text">{{ contextBarText }}</span>
        <span class="kcb-count">{{ filteredDocCount }} 篇</span>
      </div>

      <!-- 消息区 -->
      <div class="kap-msgs" ref="msgsRef" @click="handleDocRefClick">
        <template v-for="(m, i) in messages" :key="i">
          <div v-if="m.role === 'assistant'" class="km km-ai">
            <div class="km-avatar">✨</div>
            <div class="km-bubble" v-html="getMsgContent(m)"></div>
          </div>
          <div v-else class="km km-user">
            <div class="km-bubble km-user-bubble">{{ m.content }}</div>
          </div>
        </template>
        <div v-if="isTyping" class="km km-ai">
          <div class="km-avatar">✨</div>
          <div class="km-bubble km-typing">
            <span class="td"></span><span class="td"></span><span class="td"></span>
          </div>
        </div>
      </div>

      <!-- 快捷推荐 -->
      <div v-if="chips.length > 0" class="kap-chips">
        <button
          v-for="(c, i) in chips" :key="i"
          class="kc-chip"
          :class="{ 'kc-cta': c.highlight }"
          @click="handleChip(c)"
        >{{ c.text }}</button>
      </div>

      <!-- 输入区 -->
      <div class="kap-input">
        <div class="kap-input-wrapper">
          <input
            v-model="inputText" class="kap-input-field"
            placeholder="输入追问..." @keyup.enter="sendMessage"
          />
          <button class="kap-send-btn" :disabled="!inputText.trim()" @click="sendMessage">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="9" y1="1" x2="9" y2="17"/><polyline points="4 6 9 1 14 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { knowledgeDocs } from '@/mock/knowledge'

const props = defineProps({
  searchQuery: { type: String, default: '' },
  selectedDevice: { type: String, default: '全部' },
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
const isOpen = ref(false)
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

// ============ 拖拽移动 ============
const BTN_SIZE = 46
const DRAG_THRESHOLD = 8
const isDragging = ref(false)
const floatPos = ref(null) // { right, bottom }
let dragStartX = 0, dragStartY = 0
let dragOffsetX = 0, dragOffsetY = 0
let didDrag = false

// 初始化位置
function loadFloatPos() {
  try {
    const saved = localStorage.getItem('kf-float-pos')
    if (saved) floatPos.value = JSON.parse(saved)
  } catch {}
}
loadFloatPos()

const floatStyle = computed(() => {
  if (!floatPos.value) return {}
  const { right, bottom } = floatPos.value
  return { right: `${right}px`, bottom: `${bottom}px` }
})

function onFloatClick() {
  if (didDrag) { didDrag = false; return }
  togglePanel()
}

function onDragStart(e) {
  isDragging.value = true
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
  }
  if (!didDrag) return

  e.preventDefault()
  const right = Math.max(8, window.innerWidth - (ev.clientX - dragOffsetX + BTN_SIZE))
  const bottom = Math.max(8, window.innerHeight - (ev.clientY - dragOffsetY + BTN_SIZE))
  floatPos.value = { right, bottom }
}

function onDragEnd(e) {
  isDragging.value = false
  if (floatPos.value) {
    localStorage.setItem('kf-float-pos', JSON.stringify(floatPos.value))
  }
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend', onDragEnd)
}

// ============ 上下文 ============
const hasFilter = computed(() => props.selectedDevice !== '全部' || props.selectedDocType !== '全部类型')

const contextBarText = computed(() => {
  const parts = []
  if (props.searchQuery) parts.push(`搜索"${props.searchQuery}"`)
  if (props.selectedDevice !== '全部') parts.push(props.selectedDevice)
  if (props.selectedDocType !== '全部类型') parts.push(props.selectedDocType)
  return parts.join(' · ')
})

const contextLabel = computed(() => {
  if (props.searchQuery) return '搜索问答'
  if (hasFilter.value) return '知识导览'
  return '知识库'
})

// ============ 消息系统 ============
const msgsRef = ref(null)
const inputText = ref('')
const isTyping = ref(false)
const messages = ref([])

function scrollToBottom() {
  nextTick(() => { if (msgsRef.value) msgsRef.value.scrollTop = msgsRef.value.scrollHeight })
}

function streamMessage(idx, fullText) {
  const parts = fullText.split(/(<[^>]+>|\s+)/g).filter(Boolean)
  let pos = 0
  const msg = messages.value[idx]
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

function pushAssistantMessage(content, delay = 400) {
  const idx = messages.value.length
  messages.value.push({ role: 'assistant', content: '', raw: content, ts: Date.now() })
  setTimeout(() => streamMessage(idx, content), delay)
}

function pushUserMessage(text) {
  messages.value.push({ role: 'user', content: text, ts: Date.now() })
}

function generateInitialResponse() {
  isTyping.value = true
  setTimeout(() => {
    isTyping.value = false
    if (props.searchQuery) pushAssistantMessage(generateSearchSummary())
    else if (hasFilter.value) pushAssistantMessage(generateFilterSummary())
    else pushAssistantMessage(generateWelcome())
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
  return `根据搜索"<b>${props.searchQuery}</b>"共找到 <b>${docs.length}</b> 篇相关文档，涉及 ${deviceSummary}，涵盖 ${typeSummary}。<br><br>推荐阅读：<br>${docLinks}<br>💡 点击文档标题可直接跳转阅读。`
}

function generateFilterSummary() {
  const dev = props.selectedDevice; const type = props.selectedDocType; const count = props.filteredDocCount
  let intro = `<b>${dev}</b>`
  if (type !== '全部类型') intro += ` · <b>${type}</b>`
  intro += ` · 共 ${count} 篇文档`
  const docs = props.filteredDocs.slice(0, 4)
  const docLinks = docs.map(d => `<div class="km-ref" data-doc-id="${d.id}">📄 <b>${d.title}</b><span class="km-ref-meta">${d.docType} · ${d.id}</span></div>`).join('')
  return `当前查看：${intro}<br><br>推荐阅读：<br>${docLinks}`
}

function generateWelcome() {
  const totalDocs = props.filteredDocCount || 79
  const featured = ['📋 增压器故障分析及处理案例集', '📋 冷却系统维护与故障诊断', '📋 舵机系统操作与故障处理', '📋 分油机操作与故障排除']
  const items = featured.map(t => `• ${t}`).join('<br>')
  return `你好！知识库共 <b>${totalDocs}</b> 篇技术文档。<br><br>📂 文档覆盖：主机 · 辅机 · 锅炉 · 舵机 · 分油机<br>📂 文档类型：设备手册 · 操作规程 · 故障案例 · 技术通告<br><br>📖 推荐阅读：<br>${items}<br><br>💡 你可以：<br>• 在搜索框输入关键词，AI 自动总结<br>• 在左侧选择设备/文档类型筛选<br>• 直接输入问题，我来帮你找答案`
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
  pushUserMessage(text)
  inputText.value = ''
  isTyping.value = true
  scrollToBottom()
  setTimeout(() => {
    isTyping.value = false
    pushAssistantMessage(generateFollowUp(text))
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

function getMsgContent(m) {
  if (m.streamed !== undefined) return m.streamed + '<span class="cursor-blink">▍</span>'
  return m.content
}

function handleDocRefClick(e) {
  const ref = e.target.closest('.km-ref')
  if (ref) {
    e.preventDefault(); e.stopPropagation()
    const docId = ref.dataset.docId
    if (docId) emit('open-doc', docId)
  }
}
</script>

<style scoped>
/* ===== 浮动按钮 ===== */
.kf-float {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 999;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #4096FF);
  box-shadow: 0 4px 16px rgba(22,119,255,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  cursor: grab;
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  user-select: none;
  touch-action: none;
}
.kf-float:hover {
  box-shadow: 0 6px 24px rgba(22,119,255,0.5);
  transform: scale(1.08);
}
.kf-float:active { transform: scale(0.95); }
.kf-float.kf-dragging { transition: none !important; transform: none !important; }
.kf-icon { font-size: 21px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)); line-height: 1; }
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

/* ===== 面板（浮动覆盖层） ===== */
.kap-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  max-width: calc(100vw - 48px);
  height: 100%;
  z-index: 1001;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-primary);
  box-shadow: -4px 0 24px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
}
.kap-panel.is-mobile {
  top: auto;
  bottom: 0;
  width: 100%;
  max-width: 100%;
  height: 78vh;
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
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
  background: var(--bg-panel);
}
.kap-header-left { display: flex; align-items: center; gap: 8px; }
.kap-sparkle { font-size: 16px; }
.kap-title { font-size: var(--font-md); font-weight: 700; color: var(--text-primary); }
.kap-header-right { display: flex; align-items: center; gap: 8px; }
.kap-context-pill {
  font-size: var(--font-xs); padding: 2px 8px;
  border-radius: 10px; background: var(--accent-bg); color: var(--accent); font-weight: 500;
}
.kap-close-btn {
  width: 28px; height: 28px; border-radius: 50%;
  background: transparent; border: none; color: var(--text-muted);
  font-size: 15px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.kap-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ===== 上下文条 ===== */
.kap-context-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #F5F9FF, #EEF4FC);
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0; font-size: var(--font-sm);
}
.kcb-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--accent); }
.kcb-text { flex: 1; color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kcb-count { font-size: var(--font-xs); color: var(--text-muted); background: var(--bg-hover); padding: 2px 8px; border-radius: 8px; }

/* ===== 消息区 ===== */
.kap-msgs { flex: 1; overflow-y: auto; padding: 12px 0; display: flex; flex-direction: column; }
.km { display: flex; gap: 8px; margin: 0 14px 12px; max-width: 100%; }
.km-ai { align-items: flex-start; }
.km-user { justify-content: flex-end; }
.km-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #36CFC9);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 14px; box-shadow: 0 2px 6px rgba(22,119,255,0.15);
}
.km-bubble {
  max-width: 92%; font-size: var(--font-sm); line-height: 1.65;
  color: var(--text-secondary); border: 1px solid var(--border-primary);
  border-radius: 4px var(--radius-md) var(--radius-md) 4px;
  padding: 10px 14px; background: var(--bg-surface); box-shadow: var(--shadow-sm);
}
.km-user-bubble {
  background: linear-gradient(135deg, var(--accent), #4096FF);
  color: #fff; border: none;
  border-radius: var(--radius-md) 4px var(--radius-md) var(--radius-md);
}

/* 文档引用 */
.kap-msgs :deep(.km-ref) {
  display: block; padding: 10px 12px; margin: 8px 0; border-radius: 8px;
  background: var(--bg-hover); border: 1px solid var(--border-secondary);
  color: var(--text-primary); cursor: pointer; transition: all 0.18s;
  line-height: 1.5; position: relative;
}
.kap-msgs :deep(.km-ref::after) {
  content: '→ 点击跳转'; position: absolute; right: 10px; top: 50%;
  transform: translateY(-50%); font-size: var(--font-xs);
  color: var(--accent); opacity: 0; transition: opacity 0.18s; font-weight: 500;
}
.kap-msgs :deep(.km-ref:hover) {
  background: var(--accent-bg); border-color: var(--accent);
  box-shadow: 0 1px 6px rgba(22,119,255,0.08); padding-right: 80px;
}
.kap-msgs :deep(.km-ref:hover::after) { opacity: 1; }
.kap-msgs :deep(.km-ref-meta) {
  display: block; font-size: var(--font-xs); color: var(--text-muted); margin-top: 2px;
}

/* 打字 */
.km-typing { display: flex; align-items: center; gap: 5px; padding: 12px 16px; }
.td { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.3; animation: td-bounce 1.4s ease-in-out infinite; }
.td:nth-child(2) { animation-delay: 0.2s; }
.td:nth-child(3) { animation-delay: 0.4s; }
@keyframes td-bounce { 0%,60%,100%{transform:translateY(0);opacity:0.3} 30%{transform:translateY(-4px);opacity:1} }
:deep(.cursor-blink) { animation: kap-blink 0.8s ease-in-out infinite; color: var(--accent); font-weight: 700; }
@keyframes kap-blink { 0%,100%{opacity:1} 50%{opacity:0} }

/* ===== 快捷 Chip ===== */
.kap-chips { padding: 8px 14px 4px; border-top: 1px solid var(--border-secondary); display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
.kc-chip {
  font-size: var(--font-xs); padding: 5px 10px; border-radius: 14px;
  border: 1px solid var(--border-primary); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
  white-space: nowrap; font-family: inherit;
}
.kc-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }
.kc-cta {
  background: linear-gradient(135deg, var(--accent), #4096FF) !important;
  color: #fff !important; border: none !important; font-weight: 600;
  box-shadow: 0 2px 8px rgba(22,119,255,0.2);
}
.kc-cta:hover { box-shadow: 0 4px 14px rgba(22,119,255,0.35); transform: translateY(-1px); }

/* ===== 输入区 ===== */
.kap-input { padding: 10px 14px 14px; border-top: 1px solid var(--border-primary); flex-shrink: 0; background: var(--bg-surface); }
.kap-input-wrapper {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-panel); border: 1px solid var(--border-primary);
  border-radius: 22px; padding: 4px 4px 4px 14px; transition: border-color 0.2s;
}
.kap-input-wrapper:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(22,119,255,0.08); }
.kap-input-field {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-primary); font-size: var(--font-sm); padding: 6px 0; font-family: inherit;
}
.kap-input-field::placeholder { color: var(--text-muted); }
.kap-send-btn {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #4096FF);
  border: none; color: #fff; display: flex; align-items: center;
  justify-content: center; cursor: pointer; transition: all 0.2s;
  flex-shrink: 0; box-shadow: 0 2px 8px rgba(22,119,255,0.25);
}
.kap-send-btn:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(22,119,255,0.4); transform: scale(1.06); }
.kap-send-btn:disabled { opacity: 0.25; cursor: not-allowed; box-shadow: none; }

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .kf-float { bottom: 20px; right: 20px; width: 42px; height: 42px; }
  .kap-panel { border-top-left-radius: 16px; border-top-right-radius: 16px; }
}
</style>
