<template>
  <div ref="knowledgeViewRef" class="knowledge-view">

    <!-- ===== 主内容区 ===== -->
    <main class="main-content">
      <!-- 文件库视图 -->
      <template v-if="!selectedDoc">
        <div class="knowledge-filter-stack" aria-label="按设备筛选文档">
          <div class="knowledge-filter-row device-filter-row">
            <div class="device-filter-list" aria-label="按设备类型筛选">
              <button
                v-for="device in deviceTypes"
                :key="device.key"
                type="button"
                class="device-filter-tag"
                :class="{ active: selectedDevice === device.key }"
                @click="selectDevice(device.key)"
              >
                <span>{{ device.key }}</span>
              </button>
            </div>
            <div class="top-bar-filter-tools" :class="{ 'search-open': isSearchOpen }">
              <button
                type="button"
                class="search-toggle"
                aria-label="展开搜索"
                @click="openSearch"
              >
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </button>
              <label class="search-box" aria-label="搜索知识库文档">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  ref="searchInputRef"
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索文档标题、关键词..."
                  class="search-input"
                  @blur="closeSearch"
                  @keydown.esc="closeSearch"
                />
              </label>
            </div>
          </div>
        </div>

        <div class="doc-list-scroll">
          <!-- 文档卡片网格 -->
          <div class="doc-grid">
            <div
              v-for="doc in paginatedDocs"
              :key="doc.id"
              class="doc-card"
              role="button"
              tabindex="0"
              @keydown.enter="openDoc(doc)"
              @keydown.space.prevent="openDoc(doc)"
              @click="openDoc(doc)"
            >
            <div class="doc-card-title">{{ doc.title }}</div>
            <div class="doc-card-description">{{ doc.category }} / {{ doc.subcategory }}</div>
            <div class="doc-card-meta">
              <span class="doc-type-badge">
                <svg v-if="doc.docType === '设备手册'" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2.5h7.5A1.5 1.5 0 0 1 12 4v9H4.5A1.5 1.5 0 0 1 3 11.5v-9Z"/><path d="M4.5 10.5H12M5.5 5h4"/></svg>
                <svg v-else-if="doc.docType === '操作规程'" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 4 1 1 2-2M8 4h5M3 8l1 1 2-2M8 8h5M3 12l1 1 2-2M8 12h5"/></svg>
                <svg v-else-if="doc.docType === '故障案例'" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.5 2.5a3.5 3.5 0 0 0-4.3 4.3L2.5 9.5l4 4 2.7-2.7a3.5 3.5 0 0 0 4.3-4.3l-2 2-2-2 2-2-2-2Z"/></svg>
                <svg v-else viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2.5a4 4 0 0 0-4 4v2l-1 2h10l-1-2v-2a4 4 0 0 0-4-4ZM6.5 12.5h3"/></svg>
                {{ doc.docType }}
              </span>
            </div>
            <div class="doc-card-bottom">
              <span class="doc-card-date">更新 {{ doc.updatedAt }}</span>
              <span class="doc-card-id" :title="`文档唯一编号：${doc.id}`">编号 {{ doc.id }}</span>
              <span class="doc-card-action">查看详情
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>
              </span>
            </div>
            </div>
            <div v-if="filteredDocs.length === 0" class="empty-grid">
              未找到匹配的文档
            </div>
          </div>
          <div class="pagination-bar">
            <span class="pagination-total">共 {{ filteredDocs.length }} 篇文档</span>
            <el-pagination
              v-if="filteredDocs.length > pageSize"
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="filteredDocs.length"
              size="default"
              layout="prev, pager, next"
              background
            />
          </div>
        </div>
      </template>

      <!-- 文档详情页 -->
      <template v-else>
        <div class="detail-page">
          <div class="detail-body">
            <div class="detail-layout">
              <nav class="knowledge-toc" aria-label="文档目录">
                <span class="toc-label">文档目录</span>
                <button
                  v-for="section in contentSections"
                  :key="section.id"
                  type="button"
                  @click="scrollToSection(section.id)"
                >{{ section.title }}</button>
              </nav>

              <article :key="selectedDoc.id" class="doc-content-card" aria-labelledby="knowledge-doc-title">
                <div class="doc-heading">
                  <h1 id="knowledge-doc-title" class="doc-title">{{ selectedDoc.title }}</h1>
                  <button class="download-btn" type="button" @click="exportPdf">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    导出 PDF
                  </button>
                </div>
                <div class="doc-meta-block">
                  <div class="doc-meta-row"><span class="doc-meta-label">文档编号</span><span class="doc-meta-value">{{ selectedDoc.id }}</span></div>
                  <div class="doc-meta-row"><span class="doc-meta-label">版本</span><span class="doc-meta-value">{{ selectedDoc.version || '—' }}</span></div>
                  <div class="doc-meta-row"><span class="doc-meta-label">更新日期</span><span class="doc-meta-value">{{ selectedDoc.updatedAt }}</span></div>
                  <div class="doc-meta-row"><span class="doc-meta-label">分类</span><span class="doc-meta-value">{{ selectedDoc.category }} / {{ selectedDoc.subcategory }}</span></div>
                </div>
                <div class="doc-content-body" v-html="renderContent"></div>
              </article>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- ===== AI 问答助手 ===== -->
    <KnowledgeAIPanel
      :compact="isAssistantCollapsed"
      :search-query="searchQuery"
      :selected-device="selectedDevice"
      :selected-system="selectedSystem"
      :selected-doc-type="selectedDocType"
      :filtered-doc-count="filteredDocs.length"
      :filtered-docs="filteredDocs"
      @open-doc="handleOpenDocById"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { knowledgeDocs, DEVICE_TYPES } from '@/mock/knowledge'
import KnowledgeAIPanel from '@/components/KnowledgeAIPanel.vue'
import { knowledgeViewCache } from '@/stores/viewCache'

const deviceTypes = computed(() => DEVICE_TYPES.map(device => ({
  ...device,
  count: knowledgeDocs.filter(doc => doc.device === device.key).length
})))
const route = useRoute()
const router = useRouter()
const selectedDevice = ref(knowledgeViewCache.selectedDevice)
const selectedSystem = ref('全部系统')
const selectedDocType = ref('全部类型')
const searchQuery = ref(knowledgeViewCache.searchQuery)
const searchInputRef = ref(null)
const isSearchOpen = ref(false)
const selectedDoc = ref(null)
const currentPage = ref(knowledgeViewCache.currentPage)
const pageSize = 20
const knowledgeViewRef = ref(null)
const isAssistantCollapsed = ref(typeof window !== 'undefined' ? window.innerWidth <= 1100 : false)
let knowledgeResizeObserver = null

const KNOWLEDGE_ASSISTANT_W = 400
const KNOWLEDGE_CONTENT_MIN_W = 620
const KNOWLEDGE_LAYOUT_GAP = 12

function updateKnowledgeAssistantVisibility() {
  const viewWidth = knowledgeViewRef.value?.clientWidth || 0
  if (!viewWidth) return
  isAssistantCollapsed.value = viewWidth < KNOWLEDGE_CONTENT_MIN_W + KNOWLEDGE_ASSISTANT_W + KNOWLEDGE_LAYOUT_GAP
}

onMounted(() => {
  knowledgeViewCache.selectedSystem = '全部系统'
  knowledgeViewCache.selectedDocType = '全部类型'
  nextTick(() => {
    if (window.ResizeObserver && knowledgeViewRef.value) {
      knowledgeResizeObserver = new ResizeObserver(updateKnowledgeAssistantVisibility)
      knowledgeResizeObserver.observe(knowledgeViewRef.value)
    }
    updateKnowledgeAssistantVisibility()
  })
})

onBeforeUnmount(() => {
  knowledgeResizeObserver?.disconnect()
})

const filteredDocs = computed(() => {
  let list = [...knowledgeDocs]
  if (selectedDevice.value !== '全部') {
    list = list.filter(d => d.device === selectedDevice.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.subcategory.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    )
  }
  return list
})

const paginatedDocs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredDocs.value.slice(start, start + pageSize)
})

watch([selectedDevice, selectedSystem, selectedDocType, searchQuery], () => {
  knowledgeViewCache.selectedDevice = selectedDevice.value
  knowledgeViewCache.selectedSystem = selectedSystem.value
  knowledgeViewCache.selectedDocType = selectedDocType.value
  knowledgeViewCache.searchQuery = searchQuery.value
  currentPage.value = 1
  knowledgeViewCache.currentPage = 1
})
watch(currentPage, value => { knowledgeViewCache.currentPage = value })

function selectDevice(key) {
  selectedDevice.value = key
  selectedDocType.value = '全部类型'
  selectedSystem.value = '全部系统'
}

function openSearch() {
  isSearchOpen.value = true
  nextTick(() => searchInputRef.value?.focus())
}

function closeSearch() {
  isSearchOpen.value = false
}

function openDoc(doc) {
  selectedDoc.value = doc
  knowledgeViewCache.selectedDocId = doc.id
  router.push({ path: route.path, query: { doc: doc.id } })
}

// 从 AI 面板的文档引用跳转
function handleOpenDocById(docId) {
  const doc = knowledgeDocs.find(d => d.id === docId)
  if (doc) openDoc(doc)
}

// 从文档详情返回列表
function goBackFromDoc() {
  selectedDoc.value = null
  knowledgeViewCache.selectedDocId = null
  router.replace({ path: route.path })
}

// 渲染文档内容 HTML
const rawContent = computed(() => {
  if (!selectedDoc.value) return ''
  if (selectedDoc.value.chapterHTML) {
    return selectedDoc.value.chapterHTML
  }
  return `
    <h3>${selectedDoc.value.title}</h3>
    <p><strong>设备类型：</strong>${selectedDoc.value.device}</p>
    <p><strong>文档类型：</strong>${selectedDoc.value.docType}</p>
    <p><strong>所属分类：</strong>${selectedDoc.value.category} / ${selectedDoc.value.subcategory}</p>
    <p><strong>文档编号：</strong>${selectedDoc.value.id}</p>
    <p><strong>版本：</strong>${selectedDoc.value.version}</p>
    <p><strong>更新日期：</strong>${selectedDoc.value.updatedAt}</p>
    <hr>
    <p>本文档详细内容正在编制中，敬请期待。</p>
  `
})

const contentSections = computed(() => {
  const sections = []
  const headingPattern = /<h([34])[^>]*>([\s\S]*?)<\/h\1>/gi
  let match
  while ((match = headingPattern.exec(rawContent.value))) {
    sections.push({
      id: `knowledge-section-${sections.length}`,
      title: match[2].replace(/<[^>]+>/g, '').trim()
    })
  }
  return sections
})

const renderContent = computed(() => {
  let index = 0
  return rawContent.value.replace(/<h([34])([^>]*)>/gi, (_match, level, attrs) => {
    const id = `knowledge-section-${index++}`
    return `<h${level}${attrs} id="${id}" class="knowledge-anchor">`
  })
})

watch(() => route.query.doc, (docId) => {
  if (!docId) {
    const cachedDoc = knowledgeViewCache.selectedDocId
      ? knowledgeDocs.find(item => item.id === knowledgeViewCache.selectedDocId) || null
      : null
    selectedDoc.value = cachedDoc
    return
  }
  const doc = knowledgeDocs.find(item => item.id === docId) || null
  selectedDoc.value = doc
  knowledgeViewCache.selectedDocId = doc?.id || null
  if (!doc) router.replace({ path: route.path })
}, { immediate: true })

// 全局标题栏返回按钮可能在 URL 已经没有 query 时触发，
// 此时路由不会重新导航，需直接响应缓存清空退出详情。
watch(() => knowledgeViewCache.selectedDocId, (docId) => {
  if (!docId) {
    selectedDoc.value = null
    return
  }
  if (!selectedDoc.value || selectedDoc.value.id !== docId) {
    selectedDoc.value = knowledgeDocs.find(item => item.id === docId) || null
  }
})

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function exportPdf() {
  await nextTick()
  window.print()
}
</script>

<style scoped>
/* ===== 整体布局 ===== */
.knowledge-view {
  flex: 1;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: var(--bg-surface);
}

.knowledge-view :where(button, a, [role="button"], .doc-card) { cursor: pointer; }
.knowledge-view :where(button:disabled, [aria-disabled="true"]) { cursor: not-allowed; }
.knowledge-view :deep(.el-pagination button:not(:disabled)),
.knowledge-view :deep(.el-pagination .el-pager li) { cursor: pointer; }
.knowledge-view :deep(.el-pagination button:disabled) { cursor: not-allowed; }

/* ============ 左侧 Sidebar ============ */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-app);
  border-right: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 0 16px 16px;
  animation: section-list-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.sb-section {
  margin-bottom: 14px;
}

.sb-section + .sb-section {
  padding-top: 14px;
  border-top: 1px solid #E7E7E9;
}

.sb-section-title {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #77777D;
  padding: 4px 8px 7px;
  letter-spacing: 0.02em;
}

.sb-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  min-height: 34px;
  padding: 6px 8px;
  border-radius: 7px;
  font-size: 13px;
  color: #57575D;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  font-family: inherit;
}

.sb-item:hover {
  color: #242428;
  background: #ECECEE;
}

.sb-item.active {
  color: #1F1F22;
  background: #E4E4E7;
  font-weight: 600;
}

.sb-item-label { flex: 1; }

.sb-device-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex: none;
  opacity: 0.68;
  transition: opacity 0.15s, transform 0.15s;
}

.sb-item.active .sb-device-icon {
  opacity: 1;
  transform: scale(1.04);
}

.sb-item-count {
  font-size: 11px;
  line-height: 18px;
  color: #85858B;
  padding: 0 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  min-width: 22px;
  text-align: center;
}

.sb-item.active .sb-item-count {
  color: #55555B;
  background: rgba(255, 255, 255, 0.88);
}

/* ============ 主内容区 ============ */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  container-type: inline-size;
  background: var(--bg-app);
}

/* 顶部栏 */
.top-bar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  box-sizing: border-box;
  padding: 16px 16px 0;
  border-bottom: 0;
  flex-shrink: 0;
}

.knowledge-filter-stack,
.doc-list-scroll {
  animation: section-list-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.knowledge-filter-stack {
  position: relative;
  z-index: 20;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 16px 12px;
  padding: 0;
  border: 0;
  background: transparent;
  flex-shrink: 0;
}

.knowledge-filter-row {
  min-width: 0;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.knowledge-filter-label {
  flex: 0 0 28px;
  color: #9195A2;
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
}

.device-filter-list {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.device-filter-list::-webkit-scrollbar { display: none; }

.device-filter-tag {
  min-width: 46px;
  height: 30px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: #FFFFFF;
  color: #60646C;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}
.device-filter-tag:hover {
  color: #106BFF;
  background: #F5F9FF;
  border-color: #D5E3FF;
}
.device-filter-tag.active {
  color: #106BFF;
  border-color: #BFD4FF;
  background: #EDF4FF;
  font-weight: 600;
}
.device-filter-tag:focus-visible {
  outline: 2px solid #106BFF;
  outline-offset: 1px;
}

.top-bar-filter-tools {
  flex: none;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  margin-left: auto;
  position: relative;
}

.search-toggle {
  display: none;
  width: 32px;
  height: 32px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  flex: none;
  padding: 0;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--text-muted);
  cursor: pointer;
  position: relative;
  z-index: 6;
  transition: opacity 90ms ease-out;
}
.search-toggle:hover {
  color: var(--accent);
  border-color: #BFD4FF;
  background: #F8FAFF;
}
.search-toggle:hover .search-icon { color: var(--accent); }
.search-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.doc-type-filter-list {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  background: transparent;
  overflow: visible;
}

.doc-type-filter-tag {
  min-width: 46px;
  height: 30px;
  box-sizing: border-box;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: #FFFFFF;
  color: #686A70;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}
.doc-type-filter-tag:hover {
  color: #106BFF;
  background: #F5F9FF;
  border-color: #D5E3FF;
}
.doc-type-filter-tag.active {
  color: #106BFF;
  background: #EDF4FF;
  border-color: #BFD4FF;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(16, 107, 255, 0.08);
}
.doc-type-filter-tag:focus-visible { outline: 2px solid #106BFF; outline-offset: 1px; }

.system-filter-scroll {
  position: relative;
  flex: 1;
  width: auto;
  min-width: 0;
}

.system-filter-scroll::before,
.system-filter-scroll::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 28px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease-out;
}
.system-filter-scroll::before {
  left: 0;
  background: linear-gradient(90deg, var(--bg-app) 18%, rgba(247, 248, 250, 0));
}
.system-filter-scroll::after {
  right: 0;
  background: linear-gradient(270deg, var(--bg-app) 18%, rgba(247, 248, 250, 0));
}
.system-filter-scroll.can-scroll-left::before,
.system-filter-scroll.can-scroll-right::after { opacity: 1; }

.system-filter-list {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.system-filter-list::-webkit-scrollbar { display: none; }

.system-filter-tag {
  min-width: 46px;
  height: 30px;
  box-sizing: border-box;
  flex: none;
  padding: 3px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: #FFFFFF;
  color: #686A70;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.system-filter-tag:hover { color: #106BFF; background: #F5F9FF; border-color: #D5E3FF; }
.system-filter-tag.active {
  color: #106BFF;
  background: #EDF4FF;
  border-color: #BFD4FF;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(16, 107, 255, 0.08);
}
.system-filter-tag:focus-visible { outline: 2px solid #106BFF; outline-offset: 1px; }

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: none;
}

.page-title {
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.title-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  background: #FFFFFF;
}

.title-icon {
  display: block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  background: #106BFF;
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: contain;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

.search-box {
  position: relative;
  z-index: 5;
  height: 32px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-panel);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0 10px;
  width: 240px;
  overflow: hidden;
  cursor: text;
  visibility: visible;
  pointer-events: auto;
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}
.search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(16, 107, 255, 0.10); }

.top-bar-filter-tools.search-open .search-box {
  background: #FFFFFF;
  visibility: visible;
  pointer-events: auto;
  clip-path: inset(0 0 0 0 round 8px);
  transition:
    clip-path 200ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s linear 0s,
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}
.top-bar-filter-tools.search-open .search-toggle {
  opacity: 0;
  pointer-events: none;
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  min-width: 0;
  opacity: 1;
  transition: opacity 120ms ease-out 0ms;
  font-size: var(--font-sm);
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* ============ 文档卡片网格 ============ */
.doc-list-scroll {
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
  overflow-y: auto;
}

.top-bar-filter-tools.search-open .search-input {
  opacity: 1;
  transition-delay: 55ms;
}

.doc-grid {
  overflow: visible;
  padding: 0 16px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  align-content: start;
}

.doc-card {
  min-height: 150px;
  box-sizing: border-box;
  background: #FFFFFF;
  border: 1px solid #E3E5E8;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 1px 2px rgba(25, 33, 61, 0.025);
}

.doc-card:hover {
  border-color: #CDD0D6;
  background: #FFFFFF;
  box-shadow: 0 8px 22px rgba(25, 33, 61, 0.08);
}

.doc-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.doc-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 1px 6px;
  border: 1px solid #E1E2E5;
  border-radius: 4px;
  background: #F4F4F5;
  color: #686A70;
  font-size: 11px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
}

.doc-type-badge svg {
  width: 13px;
  height: 13px;
  flex: none;
  margin: 0;
  stroke: currentColor;
  stroke-width: 1.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.doc-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-card-description {
  overflow: hidden;
  color: #7A7D85;
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-card-bottom {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.doc-card-date {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.doc-card-id {
  font-size: 11px;
  color: #8A8C92;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  transition: opacity 0.16s ease-out;
}

.doc-card-action {
  position: absolute;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #4D5057;
  font-size: 12px;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-3px);
  transition: opacity 0.16s ease-out, visibility 0.16s ease-out, transform 0.16s ease-out;
}

.doc-card-action svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.doc-card:hover .doc-card-action,
.doc-card:focus-visible .doc-card-action {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}

.doc-card:hover .doc-card-id,
.doc-card:focus-visible .doc-card-id {
  opacity: 0;
}

.empty-grid {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: var(--font-md);
}

.pagination-bar {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 16px 16px;
  background: transparent;
}

.pagination-total {
  margin-right: 12px;
  color: var(--text-muted);
  font-size: 13px;
  white-space: nowrap;
}

.pagination-bar :deep(.el-pagination.is-background .el-pager li.is-active) {
  background-color: #106BFF;
}

/* ============ 文档详情页 ============ */
.detail-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: section-detail-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes section-detail-enter {
  from { opacity: 0; transform: translateX(18px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes section-list-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

.detail-topbar {
  height: 48px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 16px 16px 0;
  border-bottom: 0;
  background: #FFFFFF;
  gap: 8px;
  flex-shrink: 0;
}

.back-btn {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  background: #FFFFFF;
  color: #6C7183;
  cursor: pointer;
  transition: border-color 0.16s, color 0.16s, background 0.16s;
}
.back-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.back-btn:hover {
  border-color: #BFD4FF;
  background: #F3F7FF;
  color: #106BFF;
}

.detail-title {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-meta {
  font-size: var(--font-sm);
  color: var(--text-muted);
  white-space: nowrap;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  font-size: var(--font-sm);
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}
.download-btn:hover {
  background: var(--accent-bg);
}
.download-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 文档内容，与日志详情共用同一阅读骨架 */
.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-app);
}

.detail-layout {
  width: 100%;
  max-width: 1144px;
  display: grid;
  grid-template-columns: 152px minmax(0, 960px);
  align-items: start;
  justify-content: center;
  gap: 32px;
}

.knowledge-toc {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding-top: 4px;
}

.toc-label { padding: 0 8px 8px; color: #9195A2; font-size: 12px; line-height: 20px; }
.knowledge-toc button {
  width: 100%;
  padding: 5px 8px;
  overflow: hidden;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #6C7183;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.knowledge-toc button:hover { color: #1F1F22; background: #E4E4E7; font-weight: 600; }
.knowledge-toc button:focus-visible { outline: 2px solid #106BFF; outline-offset: 1px; }

.doc-content-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 24px;
  max-width: 960px;
  width: 100%;
  min-height: 200px;
  box-shadow: var(--shadow-sm);
  animation: article-content-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes article-content-enter {
  from { opacity: 0; transform: translateX(14px); }
  to { opacity: 1; transform: translateX(0); }
}

.doc-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.doc-title { min-width: 0; margin: 0; color: var(--text-primary); font-size: 28px; line-height: 40px; font-weight: 700; }
.doc-heading .download-btn { flex-shrink: 0; }

.doc-meta-block {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 28px;
  margin-bottom: 32px;
  padding: 16px 20px;
  border-radius: 8px;
  background: #F7F8FA;
}
.doc-meta-row { min-width: 0; display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: start; gap: 12px; font-size: 14px; line-height: 24px; }
.doc-meta-label { color: #9195A2; white-space: nowrap; }
.doc-meta-value { min-width: 0; color: #19213D; font-weight: 500; }

.doc-content-body {
  width: 100%;
}

.doc-content-body :deep(.knowledge-anchor) { scroll-margin-top: 16px; }

/* ===== 文档内容 HTML 样式 ===== */
.doc-content-body :deep(h3) {
  font-size: 18px;
  line-height: 28px;
  font-weight: 700;
  color: #19213D;
  margin: 0 0 12px;
}

.doc-content-body :deep(h4) {
  font-size: 16px;
  line-height: 26px;
  font-weight: 700;
  color: #19213D;
  margin: 28px 0 10px;
}

.doc-content-body :deep(h5) {
  font-size: 14px;
  line-height: 24px;
  font-weight: 600;
  color: #19213D;
  margin: 20px 0 8px;
}

.doc-content-body :deep(p) {
  max-width: 72ch;
  font-size: 14px;
  color: #6C7183;
  line-height: 24px;
  margin: 0 0 12px;
}

.doc-content-body :deep(strong) {
  color: var(--text-primary);
}

.doc-content-body :deep(ul),
.doc-content-body :deep(ol) {
  margin: 8px 0 20px;
  padding-left: 22px;
}

.doc-content-body :deep(li) {
  font-size: 14px;
  color: #6C7183;
  line-height: 24px;
  margin: 4px 0;
}

.doc-content-body :deep(table) {
  width: 100%;
  overflow: hidden;
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  border-collapse: separate;
  border-spacing: 0;
  margin: 12px 0 28px;
  font-size: 14px;
}

.doc-content-body :deep(thead th) {
  background: #F7F8FA;
  color: #6C7183;
  font-weight: 500;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #E4E7ED;
  font-size: 14px;
}

.doc-content-body :deep(tbody td) {
  padding: 11px 12px;
  color: #6C7183;
  border-bottom: 1px solid #EEF0F4;
  vertical-align: top;
}

.doc-content-body :deep(tbody tr:last-child td) { border-bottom: 0; }

.doc-content-body :deep(tbody tr:hover) {
  background: var(--bg-hover);
}

/* 通知框 */
.doc-content-body :deep(.notice-box) {
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 24px;
  margin: 16px 0 24px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.doc-content-body :deep(.notice-box::before) {
  flex-shrink: 0;
  font-size: var(--font-md);
}

.doc-content-body :deep(.notice-box.info) {
  background: var(--accent-bg);
  border: 1px solid var(--accent-bg);
  color: var(--text-secondary);
}
.doc-content-body :deep(.notice-box.info::before) {
  content: '';
}

.doc-content-body :deep(.notice-box.warn) {
  background: var(--warning-bg);
  border: 1px solid var(--warning-bg);
  color: var(--warning);
}
.doc-content-body :deep(.notice-box.warn::before) {
  content: '';
}

.doc-content-body :deep(.notice-box.danger) {
  background: var(--danger-bg);
  border: 1px solid var(--danger-bg);
  color: var(--danger);
}
.doc-content-body :deep(.notice-box.danger::before) {
  content: '';
}

/* 关联文档 */
.doc-content-body :deep(.related-docs) {
  margin-top: 32px;
  padding: 16px 20px;
  border-radius: 8px;
  background: #F7F8FA;
}

.doc-content-body :deep(.related-docs h4) {
  display: flex;
  align-items: center;
  margin: 0;
}

.doc-content-body :deep(.related-docs h4::before) {
  content: '';
  font-size: var(--font-md);
}

.doc-content-body :deep(.related-docs ul) {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
}

.doc-content-body :deep(.related-docs li) {
  padding: 4px 0;
  color: var(--accent);
  cursor: pointer;
  font-size: var(--font-sm);
}
.doc-content-body :deep(.related-docs li:hover) {
  text-decoration: underline;
}

.doc-content-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-primary);
  margin: 16px 0;
}

/* 文档元信息头 */
.doc-content-body :deep(.doc-meta-header) {
  display: none;
}

@container (max-width: 680px) {
  .search-toggle {
    display: inline-flex;
  }
  .search-box {
    position: absolute;
    top: 0;
    right: 0;
    visibility: hidden;
    pointer-events: none;
    clip-path: inset(0 0 0 calc(100% - 32px) round 8px);
    will-change: clip-path;
    transition:
      clip-path 200ms cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s linear 200ms,
      border-color 150ms ease-out,
      box-shadow 150ms ease-out;
  }
  .search-input {
    opacity: 0;
  }
}

@media (max-width: 1100px) {
  .top-bar-filter-tools { margin-left: 10px; }
  .doc-type-filter-tag { padding-inline: 8px; }
}

@media (max-width: 900px) {
  .top-bar { gap: 8px; }
  .page-title { font-size: 16px; gap: 6px; }
  .title-icon-box { width: 28px; height: 28px; }
  .title-icon { width: 20px; height: 20px; }
  .doc-type-filter-tag { padding-inline: 7px; }
}

@media (max-width: 760px) {
  .top-bar { padding-inline: 12px; }
  .top-bar-filter-tools { margin-left: 4px; }
  .knowledge-filter-stack {
    margin-inline: 12px;
  }
  .knowledge-filter-row { gap: 8px; }
  .knowledge-filter-label { flex-basis: 28px; }
  .detail-body { padding: 16px 12px; }
  .detail-layout { display: block; }
  .knowledge-toc {
    position: static;
    flex-direction: row;
    gap: 4px;
    margin-bottom: 12px;
    padding: 0 0 4px;
    overflow-x: auto;
  }
  .toc-label { display: none; }
  .knowledge-toc button { width: auto; flex: 0 0 auto; padding: 5px 9px; background: #F7F8FA; }
  .doc-content-card { padding: 24px; overflow-x: auto; }
  .doc-meta-block { grid-template-columns: 1fr; padding: 14px 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .top-bar,
  .knowledge-filter-stack,
  .doc-list-scroll,
  .detail-page,
  .doc-content-card { animation: none; }
  .search-box,
  .search-input { transition: none; }
}
</style>
