<template>
  <div class="knowledge-view">
    <!-- ===== 左侧：双维度侧边栏 ===== -->
    <aside class="sidebar">
      <!-- 设备类型 -->
      <div class="sb-section">
        <div class="sb-section-title">设备类型</div>
        <button
          v-for="dt in deviceTypes"
          :key="dt.key"
          class="sb-item"
          :class="{ active: selectedDevice === dt.key }"
          @click="selectDevice(dt.key)"
        >
          <span class="sb-item-label">{{ dt.key }}</span>
          <span class="sb-item-count" :class="{ active: selectedDevice === dt.key }">{{ dt.count }}</span>
        </button>
      </div>
      <!-- 文档类型 -->
      <div class="sb-section">
        <div class="sb-section-title">文档类型</div>
        <button
          v-for="dt in docTypeKeys"
          :key="dt"
          class="sb-item"
          :class="{ active: selectedDocType === dt }"
          @click="selectedDocType = dt"
        >
          <span class="sb-item-label">{{ dt }}</span>
          <span class="sb-item-count" :class="{ active: selectedDocType === dt }">{{ docTypeStats[dt] }}</span>
        </button>
      </div>
    </aside>

    <!-- ===== 主内容区 ===== -->
    <main class="main-content">
      <!-- 文件库视图 -->
      <template v-if="!selectedDoc">
        <!-- 顶部栏 -->
        <div class="top-bar">
          <div class="top-bar-left">
            <h2 class="page-title">
              <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="#1890ff" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              知识库
            </h2>
            <div class="search-box">
              <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input v-model="searchQuery" type="text" placeholder="搜索文档标题、关键词..." class="search-input" />
            </div>
          </div>
          <div class="top-bar-right">
            <span class="device-badge">
              <span class="device-badge-dot"></span>
              {{ selectedDevice }} . {{ filteredDocs.length }} 篇文档
            </span>
          </div>
        </div>

        <!-- 文档卡片网格 -->
        <div class="doc-grid">
          <div
            v-for="doc in filteredDocs"
            :key="doc.id"
            class="doc-card"
            @click="openDoc(doc)"
          >
            <div class="doc-card-top">
              <span class="doc-type-badge" :style="badgeStyle(doc.docType)">{{ doc.docType }}</span>
            </div>
            <div class="doc-card-title">{{ doc.title }}</div>
            <div class="doc-card-bottom">
              <span class="doc-card-date">更新 {{ doc.updatedAt }}</span>
              <span class="doc-card-id">{{ doc.id }}</span>
            </div>
          </div>
          <div v-if="filteredDocs.length === 0" class="empty-grid">
            未找到匹配的文档
          </div>
        </div>
      </template>

      <!-- 文档详情页 -->
      <template v-else>
        <div class="detail-page">
          <!-- 顶部导航栏 -->
          <div class="detail-topbar">
            <button class="back-btn" @click="goBackFromDoc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              返回
            </button>
            <span class="detail-title">{{ selectedDoc.title }}</span>
            <span class="detail-meta">编号: {{ selectedDoc.id }}&nbsp;&nbsp;版本: {{ selectedDoc.version }}</span>
            <button class="download-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              下载PDF
            </button>
          </div>

          <!-- 文档内容 -->
          <div class="detail-content">
            <div class="doc-content-card">
              <div class="doc-content-body" v-html="renderContent"></div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- ===== AI 问答助手 ===== -->
    <KnowledgeAIPanel
      :search-query="searchQuery"
      :selected-device="selectedDevice"
      :selected-doc-type="selectedDocType"
      :filtered-doc-count="filteredDocs.length"
      :filtered-docs="filteredDocs"
      @open-doc="handleOpenDocById"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  knowledgeDocs, DEVICE_TYPES, DOC_TYPE_STATS,
  docTypeColors
} from '@/mock/knowledge'
import KnowledgeAIPanel from '@/components/KnowledgeAIPanel.vue'

const deviceTypes = DEVICE_TYPES
const docTypeKeys = Object.keys(DOC_TYPE_STATS)
const docTypeStats = DOC_TYPE_STATS

const selectedDevice = ref('主机')
const selectedDocType = ref('全部类型')
const searchQuery = ref('')
const selectedDoc = ref(null)

const filteredDocs = computed(() => {
  let list = [...knowledgeDocs]
  if (selectedDevice.value !== '全部') {
    list = list.filter(d => d.device === selectedDevice.value)
  }
  if (selectedDocType.value !== '全部类型') {
    list = list.filter(d => d.docType === selectedDocType.value)
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

function selectDevice(key) {
  selectedDevice.value = key
}

function openDoc(doc) {
  selectedDoc.value = doc
}

function badgeStyle(type) {
  const c = docTypeColors[type]
  if (!c) return {}
  return {
    color: c.color,
    background: c.bg,
    border: `1px solid ${c.border}`
  }
}

// 从 AI 面板的文档引用跳转
function handleOpenDocById(docId) {
  const doc = knowledgeDocs.find(d => d.id === docId)
  if (doc) selectedDoc.value = doc
}

// 从文档详情返回列表
function goBackFromDoc() {
  selectedDoc.value = null
}

// 渲染文档内容 HTML
const renderContent = computed(() => {
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

/* ============ 左侧 Sidebar ============ */
.sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 12px 0;
}

.sb-section {
  margin-bottom: 8px;
}

.sb-section-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 16px 6px;
  letter-spacing: 0.5px;
}

.sb-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  font-family: inherit;
}

.sb-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sb-item.active {
  color: var(--accent);
  background: var(--accent-bg);
}

.sb-item-label { flex: 1; }

.sb-item-count {
  font-size: var(--font-xs);
  color: var(--text-muted);
  padding: 1px 7px;
  border-radius: 8px;
  background: var(--bg-surface);
  min-width: 22px;
  text-align: center;
}

.sb-item-count.active {
  color: var(--accent);
  background: var(--accent-bg);
}

/* ============ 主内容区 ============ */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* 顶部栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
}

.page-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.title-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-panel);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px 14px;
  width: 280px;
}

.search-icon {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--font-sm);
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.top-bar-right {
  display: flex;
  align-items: center;
}

.device-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--success);
  padding: 5px 14px;
  border-radius: 14px;
  background: var(--success-bg);
  border: 1px solid var(--success-bg);
  white-space: nowrap;
}

.device-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 6px rgba(0, 180, 42, 0.6);
}

/* ============ 文档卡片网格 ============ */
.doc-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  align-content: start;
}

.doc-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--shadow-sm);
}

.doc-card:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.doc-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.doc-type-badge {
  font-size: var(--font-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
}

.doc-card-title {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-card-bottom {
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
  font-size: var(--font-xs);
  color: var(--text-muted);
  font-family: Consolas, monospace;
}

.empty-grid {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: var(--font-md);
}

/* ============ 文档详情页 ============ */
.detail-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-topbar {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-panel);
  gap: 16px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-sm);
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
  font-family: inherit;
}
.back-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
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

/* 文档内容 */
.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
}

.doc-content-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 28px 36px;
  max-width: 720px;
  width: 100%;
  box-shadow: var(--shadow-sm);
}

/* ===== 文档内容 HTML 样式 ===== */
.doc-content-body :deep(h3) {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-primary);
}

.doc-content-body :deep(h4) {
  font-size: var(--font-md);
  font-weight: 700;
  color: var(--accent);
  margin: 20px 0 8px 0;
}

.doc-content-body :deep(h5) {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--accent);
  margin: 16px 0 6px 0;
}

.doc-content-body :deep(p) {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.8;
  margin: 6px 0;
}

.doc-content-body :deep(strong) {
  color: var(--text-primary);
}

.doc-content-body :deep(ul),
.doc-content-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.doc-content-body :deep(li) {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.8;
  margin: 2px 0;
}

.doc-content-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: var(--font-sm);
}

.doc-content-body :deep(thead th) {
  background: var(--bg-panel);
  color: var(--text-muted);
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-primary);
  font-size: var(--font-sm);
}

.doc-content-body :deep(tbody td) {
  padding: 8px 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-secondary);
}

.doc-content-body :deep(tbody tr:hover) {
  background: var(--bg-hover);
}

/* 通知框 */
.doc-content-body :deep(.notice-box) {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: var(--font-sm);
  line-height: 1.6;
  margin: 12px 0;
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
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-primary);
}

.doc-content-body :deep(.related-docs h4) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 0;
}

.doc-content-body :deep(.related-docs h4::before) {
  content: '';
  font-size: var(--font-md);
}

.doc-content-body :deep(.related-docs ul) {
  list-style: none;
  padding: 0;
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
  display: flex;
  gap: 20px;
  padding: 8px 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: var(--font-sm);
  color: var(--text-muted);
  font-family: Consolas, monospace;
  margin-bottom: 20px;
}
</style>
