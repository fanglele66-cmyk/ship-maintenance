<template>
  <div class="kb-page">
    <!-- 顶部栏 -->
    <div class="kb-header">
      <div class="kb-header-left">
        <span class="kb-logo">📚</span>
        <span class="kb-title">知识库</span>
      </div>
      <span class="kb-status-badge">
        <span class="kb-status-dot"></span>
        {{ selectedKbDevice }} · {{ kbFilteredDocs.length }} 篇
      </span>
    </div>

    <!-- 搜索栏 -->
    <div class="kb-search-bar">
      <div class="kb-search-box">
        <span class="kb-search-icon">🔍</span>
        <input v-model="kbSearchQuery" type="text" placeholder="搜索文档标题、关键词..." />
      </div>
    </div>

    <!-- 主体：左侧分类 + 右侧文档列表 -->
    <div class="kb-body">
      <aside class="kb-sidebar">
        <div class="kb-sidebar-section">
          <div class="kb-sidebar-title">设备类型</div>
          <div
            v-for="d in kbDeviceTypes"
            :key="d.name"
            :class="['kb-sidebar-item', { active: selectedKbDevice === d.name }]"
            @click="selectedKbDevice = d.name"
          >
            <span class="kb-sidebar-item-label">{{ d.name }}</span>
            <span class="kb-sidebar-item-count">{{ d.count }}</span>
          </div>
        </div>
        <div class="kb-sidebar-section">
          <div class="kb-sidebar-title">文档类型</div>
          <div
            v-for="t in kbDocTypes"
            :key="t.name"
            :class="['kb-sidebar-item', { active: selectedKbDocType === t.name }]"
            @click="selectedKbDocType = t.name"
          >
            <span class="kb-sidebar-item-label">{{ t.name }}</span>
            <span class="kb-sidebar-item-count">{{ t.count }}</span>
          </div>
        </div>
      </aside>

      <main class="kb-content">
        <div class="kb-content-header">
          <div class="kb-content-title">
            {{ selectedKbDevice }} · <span class="count">{{ kbFilteredDocs.length }} 篇文档</span>
          </div>
        </div>
        <div v-if="kbFilteredDocs.length" class="kb-doc-grid">
          <div
            v-for="doc in kbFilteredDocs"
            :key="doc.id"
            class="kb-doc-card"
            @click="kbOpenDoc(doc)"
          >
            <span :class="['kb-doc-tag', doc.typeKey]">{{ doc.typeName }}</span>
            <div class="kb-doc-title">{{ doc.title }}</div>
            <div class="kb-doc-meta">
              <span>更新 {{ doc.date }}</span>
              <span v-if="doc.code" class="kb-doc-code">{{ doc.code }}</span>
            </div>
          </div>
        </div>
        <div v-else class="kb-empty">📂 没有符合条件的文档</div>
      </main>
    </div>

    <!-- 文档详情预览 -->
    <div v-if="kbPreviewDoc" class="kb-preview-overlay">
      <div class="kb-preview-header">
        <div class="kb-preview-header-left">
          <button class="kb-back-btn" @click="kbPreviewDoc = null">← 返回</button>
          <span class="kb-preview-title">{{ kbPreviewDoc.title }}</span>
        </div>
        <div class="kb-preview-info">
          <span>编号: {{ kbPreviewDoc.code || 'DOC-AUTO' }}</span>
          <span>版本: V3.2</span>
        </div>
        <button class="kb-preview-download">⬇ 下载PDF</button>
      </div>
      <div class="kb-preview-body">
        <div class="kb-doc-paper">
          <h2>{{ kbDocContent.title }}</h2>

          <template v-for="(sec, si) in kbDocContent.sections" :key="si">
            <p class="kb-section-num">{{ sec.num }} {{ sec.heading }}</p>
            <p v-if="sec.text" class="kb-section-text" v-html="sec.text"></p>

            <table v-if="sec.table" class="kb-doc-table">
              <tr><th v-for="(th, thi) in sec.table.headers" :key="thi">{{ th }}</th></tr>
              <tr v-for="(row, ri) in sec.table.rows" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
              </tr>
            </table>

            <div v-if="sec.warning" :class="['kb-warning-box', sec.warning.type]">
              <span class="wb-icon">{{ sec.warning.type === 'warn' ? '⚠️' : 'ℹ️' }}</span>
              <span v-html="sec.warning.text"></span>
            </div>
          </template>

          <div class="kb-related-box">
            <h4>📚 关联文档</h4>
            <a
              v-for="r in kbDocContent.related"
              :key="r"
              class="kb-related-link"
              @click="kbJumpRelated(r)"
            >{{ r }}</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { knowledgeDocs, kbDeviceTypes, kbDocTypes, kbDocContent } from '@/mock'

const kbSearchQuery = ref('')
const selectedKbDevice = ref('主机')
const selectedKbDocType = ref('全部类型')
const kbPreviewDoc = ref(null)

const kbFilteredDocs = computed(() => {
  let list = knowledgeDocs.filter(d => d.device === selectedKbDevice.value)
  if (selectedKbDocType.value !== '全部类型') {
    list = list.filter(d => d.typeName === selectedKbDocType.value)
  }
  if (kbSearchQuery.value) {
    const q = kbSearchQuery.value.toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(q) || (d.code && d.code.toLowerCase().includes(q))
    )
  }
  list.sort((a, b) => b.date.localeCompare(a.date))
  return list
})

function kbOpenDoc(doc) {
  kbPreviewDoc.value = doc
}

function kbJumpRelated(name) {
  // 模拟跳转
  console.log('Jump to:', name)
}
</script>

<style scoped>
.kb-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #060d17;
}

/* ===== 顶部栏 ===== */
.kb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #0A1628;
  border-bottom: 1px solid #162940;
  flex-shrink: 0;
}
.kb-header-left { display: flex; align-items: center; gap: 10px; }
.kb-logo { font-size: 22px; }
.kb-title { font-size: 17px; font-weight: 800; color: #E0ECF8; }
.kb-status-badge {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #8BAAC0;
  background: rgba(82,196,26,0.08);
  border: 1px solid rgba(82,196,26,0.2);
  padding: 4px 12px; border-radius: 14px;
}
.kb-status-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #52C41A;
  box-shadow: 0 0 6px rgba(82,196,26,0.6);
}

/* ===== 搜索栏 ===== */
.kb-search-bar {
  padding: 12px 20px;
  background: #08121f;
  border-bottom: 1px solid #162940;
  flex-shrink: 0;
}
.kb-search-box {
  display: flex; align-items: center; gap: 8px;
  max-width: 500px;
  background: #0D1B2E;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 8px 14px;
  transition: border-color 0.2s;
}
.kb-search-box:focus-within { border-color: #1890FF; }
.kb-search-icon { font-size: 14px; opacity: 0.5; }
.kb-search-box input {
  flex: 1; background: none; border: none; outline: none;
  color: #E0ECF8; font-size: 13px;
}
.kb-search-box input::placeholder { color: #5A7A92; }

/* ===== 主体 ===== */
.kb-body {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr;
  overflow: hidden;
}

/* ===== 左侧分类 ===== */
.kb-sidebar {
  border-right: 1px solid #162940;
  background: #08121f;
  overflow-y: auto;
  padding: 8px 0 16px;
}
.kb-sidebar-section { margin-bottom: 6px; }
.kb-sidebar-title {
  padding: 12px 16px 6px;
  font-size: 11px; font-weight: 700;
  color: #5A7A92; letter-spacing: 0.5px;
  text-transform: uppercase;
}
.kb-sidebar-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer; transition: all 0.12s;
  border-left: 3px solid transparent;
}
.kb-sidebar-item:hover { background: #0D1B2E; }
.kb-sidebar-item.active {
  background: rgba(24,144,255,0.08);
  border-left-color: #1890FF;
}
.kb-sidebar-item-label {
  font-size: 13px; color: #8BAAC0;
}
.kb-sidebar-item.active .kb-sidebar-item-label {
  color: #1890FF; font-weight: 700;
}
.kb-sidebar-item-count {
  font-size: 10px; color: #5A7A92;
  background: #0c1420;
  padding: 1px 7px; border-radius: 8px;
}
.kb-sidebar-item.active .kb-sidebar-item-count {
  background: rgba(24,144,255,0.15);
  color: #1890FF;
}

/* ===== 右侧内容 ===== */
.kb-content {
  overflow-y: auto;
  padding: 16px 20px;
}
.kb-content-header {
  margin-bottom: 14px;
}
.kb-content-title {
  font-size: 15px; font-weight: 700; color: #E0ECF8;
}
.kb-content-title .count {
  font-size: 12px; color: #5A7A92; font-weight: 400;
}

/* ===== 文档卡片网格 ===== */
.kb-doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.kb-doc-card {
  position: relative;
  background: #0D1B2E;
  border: 1px solid #162940;
  border-radius: 8px;
  padding: 16px 18px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.kb-doc-card:hover {
  border-color: #243B58;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
.kb-doc-tag {
  display: inline-block;
  font-size: 10px; padding: 2px 8px;
  border-radius: 3px; font-weight: 600;
  margin-bottom: 8px;
}
.kb-doc-tag.manual { background: rgba(82,196,26,0.15); color: #52C41A; }
.kb-doc-tag.procedure { background: rgba(24,144,255,0.15); color: #1890FF; }
.kb-doc-tag.case { background: rgba(255,77,79,0.15); color: #FF4D4F; }
.kb-doc-tag.notice { background: rgba(250,173,20,0.15); color: #FAAD14; }

.kb-doc-title {
  font-size: 13px; font-weight: 700; color: #E0ECF8;
  line-height: 1.4; margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.kb-doc-meta {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; color: #5A7A92;
}
.kb-doc-code {
  font-family: 'Consolas', monospace;
  background: #080f1a;
  padding: 1px 6px; border-radius: 3px;
}

.kb-empty {
  grid-column: 1/-1;
  display: flex; align-items: center; justify-content: center;
  padding: 60px 0;
  color: #3A5A7A; font-size: 14px;
}

/* ===== 文档详情预览 ===== */
.kb-preview-overlay {
  position: fixed;
  inset: 0;
  background: #060d17;
  z-index: 200;
  display: flex;
  flex-direction: column;
}
.kb-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #0A1628;
  border-bottom: 1px solid #162940;
  flex-shrink: 0;
}
.kb-preview-header-left {
  display: flex; align-items: center; gap: 16px;
}
.kb-back-btn {
  background: none; border: none;
  color: #8BAAC0; cursor: pointer;
  font-size: 13px; padding: 4px 8px;
  border-radius: 4px; transition: all 0.12s;
}
.kb-back-btn:hover { color: #1890FF; background: rgba(24,144,255,0.08); }
.kb-preview-title {
  font-size: 15px; font-weight: 700; color: #E0ECF8;
}
.kb-preview-info {
  display: flex; gap: 16px;
  font-size: 12px; color: #5A7A92;
}
.kb-preview-download {
  padding: 6px 16px; border-radius: 6px;
  border: 1px solid #1890FF; background: rgba(24,144,255,0.08);
  color: #1890FF; font-size: 12px; cursor: pointer;
  transition: all 0.15s;
}
.kb-preview-download:hover { background: rgba(24,144,255,0.15); }

.kb-preview-body {
  flex: 1; overflow-y: auto;
  padding: 32px;
  display: flex; justify-content: center;
}

/* ===== 文档纸张样式 ===== */
.kb-doc-paper {
  max-width: 780px;
  width: 100%;
  background: #0D1B2E;
  border: 1px solid #162940;
  border-radius: 8px;
  padding: 40px 48px;
}
.kb-doc-paper h2 {
  font-size: 20px; font-weight: 800; color: #E0ECF8;
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 2px solid #1E3A5F;
}
.kb-section-num {
  font-size: 15px; font-weight: 700; color: #1890FF;
  margin: 24px 0 8px;
}
.kb-section-text {
  font-size: 13px; color: #8BAAC0;
  line-height: 1.8; margin: 8px 0;
}
.kb-doc-table {
  width: 100%; border-collapse: collapse;
  font-size: 12px; margin: 12px 0;
}
.kb-doc-table th {
  background: #0a1020; color: #5A7A92;
  padding: 9px 14px; text-align: left;
  font-weight: 600; border-bottom: 1px solid #1E3A5F;
}
.kb-doc-table td {
  padding: 9px 14px;
  border-bottom: 1px solid #111e34;
  color: #B0C4D8;
}

.kb-warning-box {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 12px; line-height: 1.6;
  margin: 16px 0;
}
.kb-warning-box.info {
  background: rgba(24,144,255,0.08);
  border: 1px solid rgba(24,144,255,0.2);
  color: #8BAAC0;
}
.kb-warning-box.warn {
  background: rgba(250,173,20,0.08);
  border: 1px solid rgba(250,173,20,0.2);
  color: #FAAD14;
}
.wb-icon { font-size: 16px; flex-shrink: 0; }

.kb-related-box {
  margin-top: 32px;
  padding: 18px 20px;
  background: #08121f;
  border: 1px solid #162940;
  border-radius: 8px;
}
.kb-related-box h4 {
  font-size: 14px; font-weight: 700; color: #E0ECF8;
  margin: 0 0 12px;
}
.kb-related-link {
  display: block;
  font-size: 12px; color: #1890FF;
  padding: 6px 0;
  cursor: pointer;
  transition: color 0.12s;
}
.kb-related-link:hover { color: #40A9FF; text-decoration: underline; }
</style>
