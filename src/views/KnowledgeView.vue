<template>
  <div class="knowledge-view">
    <!-- ===== 左侧：分类树导航 (280px) ===== -->
    <aside class="sidebar">
      <div class="sidebar-header">缺陷知识库</div>
      <div class="sidebar-body">
        <div
          v-for="group in categoryTree"
          :key="group.key"
          class="tree-group"
        >
          <!-- 一级分类 -->
          <button
            class="tree-parent"
            :class="{ active: currentFilter === group.key }"
            @click="toggleGroup(group); filterByCategory(group)"
          >
            <svg
              class="tree-caret"
              :class="{ open: isOpen(group.key) }"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
            <span class="tree-label">{{ group.label }}</span>
            <span class="tree-count">{{ countByCategory(group.key) }}</span>
          </button>
          <!-- 二级子分类 -->
          <div v-show="isOpen(group.key)" class="tree-children">
            <button
              v-for="child in group.children"
              :key="child.key"
              class="tree-child"
              :class="{ active: currentFilter === child.key }"
              @click="filterBySubcategory(child)"
            >
              <span class="child-label">{{ child.label }}</span>
              <span class="child-count">{{ countBySubcategory(child.key) }}</span>
            </button>
          </div>
        </div>
      </div>
      <!-- 显示全部 -->
      <div class="sidebar-footer">
        <button
          class="show-all-btn"
          :class="{ active: currentFilter === 'all' }"
          @click="currentFilter = 'all'"
        >显示全部（{{ fscData.length }} 条）</button>
      </div>
    </aside>

    <!-- ===== 右侧：主数据表格 ===== -->
    <div class="main-area" :class="{ 'drawer-open': !!selectedItem }">
      <!-- 搜索栏 + 统计 -->
      <div class="top-bar">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input v-model="searchQuery" type="text" placeholder="搜索部件名称或缺陷描述..." class="search-input" />
        </div>
        <div class="stats-summary">
          <span class="stat-badge sev-bad">严重 {{ countBySeverity('bad') }}</span>
          <span class="stat-badge sev-warn">普通 {{ countBySeverity('warn') }}</span>
          <span class="stat-badge sev-ok">轻微 {{ countBySeverity('ok') }}</span>
        </div>
      </div>

      <!-- 表格容器 -->
      <div class="fsc-table-wrap">
        <table class="fsc-custom-table">
          <thead>
            <tr>
              <th class="col-id">编号</th>
              <th class="col-cat">分类</th>
              <th class="col-comp">设备部件</th>
              <th class="col-desc">标准缺陷描述摘要</th>
              <th class="col-sev">扣分</th>
              <th class="col-act">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredData"
              :key="row.id"
              class="data-row"
              :class="{ selected: selectedItem?.id === row.id }"
              @click="openDrawer(row)"
            >
              <td class="col-id">{{ row.id }}</td>
              <td class="col-cat">{{ row.subcategory }}</td>
              <td class="col-comp">{{ row.component }}</td>
              <td class="col-desc">{{ row.standard_description }}</td>
              <td class="col-sev">
                <span class="sev-badge" :class="'sev-' + row.severity">
                  {{ row.score }}pts
                </span>
              </td>
              <td class="col-act">
                <button class="view-btn" @click.stop="openDrawer(row)" title="查看详情">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </td>
            </tr>
            <tr v-if="filteredData.length === 0">
              <td colspan="6" class="empty-row">未找到匹配的缺陷记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== 右侧：详情抽屉 Drawer (550px) ===== -->
    <transition name="drawer-slide">
      <aside v-if="selectedItem" class="detail-drawer">
        <!-- 顶部关闭栏 -->
        <div class="drawer-top">
          <span class="drawer-label">缺陷详情</span>
          <button class="close-btn" @click="selectedItem = null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="drawer-body">
          <!-- 1. 基础头信息 -->
          <div class="d-card d-header-card">
            <h2 class="d-component">{{ selectedItem.component }}</h2>
            <div class="d-meta-row">
              <span class="d-id">{{ selectedItem.id }}</span>
              <span class="d-sev" :class="'sev-' + selectedItem.severity">
                {{ severityMap[selectedItem.severity].label }}缺陷 · 扣{{ selectedItem.score }}分
              </span>
            </div>
            <div class="d-category-tag">{{ selectedItem.category }} · {{ selectedItem.subcategory }}</div>
          </div>

          <!-- 2. 法规条文依据 -->
          <div class="d-card d-law-card">
            <div class="d-card-hd">
              <svg class="d-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
              规范条文依据
            </div>
            <div class="d-card-bd law-text">{{ selectedItem.law_basis }}</div>
          </div>

          <!-- 3. 标准缺陷描述 -->
          <div class="d-card d-desc-card">
            <div class="d-card-hd">
              <svg class="d-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              标准缺陷描述
              <button class="copy-btn" @click="copyText(selectedItem.standard_description)">复制文本</button>
            </div>
            <div class="d-card-bd desc-text">{{ selectedItem.standard_description }}</div>
          </div>

          <!-- 4. 整改建议 -->
          <div class="d-card d-advice-card">
            <div class="d-card-hd">
              <svg class="d-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              整改及安全建议
            </div>
            <div class="d-card-bd advice-text">{{ selectedItem.rectification_advice }}</div>
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fscData, categoryTree, severityMap } from '@/mock/knowledge'

const searchQuery = ref('')
const currentFilter = ref('all')
const selectedItem = ref(null)
const openGroups = ref(new Set([]))

function toggleGroup(group) {
  const s = new Set(openGroups.value)
  if (s.has(group.key)) s.delete(group.key); else s.add(group.key)
  openGroups.value = s
}
function isOpen(key) { return openGroups.value.has(key) }

function filterByCategory(group) {
  currentFilter.value = group.key
  // 自动展开
  const s = new Set(openGroups.value)
  s.add(group.key)
  openGroups.value = s
}
function filterBySubcategory(child) {
  currentFilter.value = child.key
}

const filteredData = computed(() => {
  let list = [...fscData]
  // 分类筛选
  if (currentFilter.value !== 'all') {
    list = list.filter(r =>
      r.subcategory === currentFilter.value ||
      r.category.startsWith(currentFilter.value)
    )
  }
  // 全局搜索
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(r =>
      r.component.toLowerCase().includes(q) ||
      r.standard_description.toLowerCase().includes(q)
    )
  }
  return list
})

function countByCategory(key) {
  return fscData.filter(r => r.category.startsWith(key)).length
}
function countBySubcategory(key) {
  return fscData.filter(r => r.subcategory === key).length
}
function countBySeverity(sev) {
  return filteredData.value.filter(r => r.severity === sev).length
}

function openDrawer(row) { selectedItem.value = row }

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {})
}
</script>

<style scoped>
/* ===== 整体布局 ===== */
.knowledge-view {
  flex: 1; height: 100%;
  display: flex;
  overflow: hidden;
  background: #070c14;
}

/* ============ 左侧 Sidebar ============ */
.sidebar {
  width: 280px; min-width: 280px;
  background: #0a101d;
  border-right: 1px solid #162940;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  padding: 16px 18px;
  font-size: 14px; font-weight: 700;
  color: #ffffff;
  border-bottom: 1px solid #162940;
  letter-spacing: 0.5px;
}
.sidebar-body {
  flex: 1; overflow-y: auto;
  padding: 6px 0;
}
.sidebar-footer {
  padding: 10px 14px;
  border-top: 1px solid #162940;
}
.show-all-btn {
  width: 100%; padding: 8px 12px;
  font-size: 12px; color: #4a6a8a;
  background: transparent; border: 1px solid #162940;
  border-radius: 6px; cursor: pointer;
  text-align: left; transition: all 0.2s;
  font-family: inherit;
}
.show-all-btn:hover { border-color: #4a6a8a; color: #ffffff; }
.show-all-btn.active { color: #1890ff; border-color: #1890ff; background: #1890ff0f; }

/* 树形结构 */
.tree-group { margin-bottom: 2px; }
.tree-parent {
  width: 100%; display: flex; align-items: center;
  gap: 6px; padding: 10px 14px;
  font-size: 13px; font-weight: 600; color: #a0aec0;
  background: transparent; border: none; cursor: pointer;
  text-align: left; transition: all 0.15s;
  font-family: inherit;
}
.tree-parent:hover { color: #ffffff; background: #16294033; }
.tree-parent.active { color: #ffffff; background: #16294055; }
.tree-caret {
  width: 14px; height: 14px; flex-shrink: 0;
  color: #4a6a8a; transition: transform 0.2s;
}
.tree-caret.open { transform: rotate(90deg); }
.tree-label { flex: 1; }
.tree-count {
  font-size: 10px; color: #4a6a8a;
  padding: 1px 7px; border-radius: 8px;
  background: #0a1020; min-width: 22px; text-align: center;
}

/* 子节点 */
.tree-children { padding-left: 22px; }
.tree-child {
  width: 100%; display: flex; align-items: center;
  justify-content: space-between;
  padding: 7px 14px; font-size: 11px;
  color: #4a6a8a; background: transparent;
  border: none; cursor: pointer;
  text-align: left; transition: all 0.15s;
  font-family: inherit;
}
.tree-child:hover { color: #a0aec0; background: #16294033; }
.tree-child.active { color: #ffffff; background: #1890ff0f; border-left: 2px solid #1890ff; }
.child-label { flex: 1; }
.child-count { font-size: 10px; color: #4a6a8a; }

/* ============ 右侧主区域 ============ */
.main-area {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden; min-width: 0;
}

/* 搜索栏 */
.top-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid #162940;
  flex-shrink: 0;
}
.search-box {
  flex: 1; display: flex; align-items: center;
  gap: 8px; padding: 9px 14px;
  background: #0a1020; border: 1px solid #162940;
  border-radius: 6px;
}
.search-icon { width: 16px; height: 16px; color: #4a6a8a; flex-shrink: 0; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #ffffff; font-size: 13px; font-family: inherit;
}
.search-input::placeholder { color: #4a6a8a; }
.stats-summary { display: flex; gap: 8px; flex-shrink: 0; }
.stat-badge {
  font-size: 10px; font-weight: 600; padding: 4px 10px;
  border-radius: 3px; white-space: nowrap;
}

/* ============ 表格 ============ */
.fsc-table-wrap {
  flex: 1; overflow: auto;
  border-top: 1px solid #111e34;
}
.fsc-custom-table {
  width: 100%; border-collapse: collapse;
  min-width: 900px; table-layout: fixed;
}
.fsc-custom-table thead { position: sticky; top: 0; z-index: 5; }
.fsc-custom-table th {
  background: #0a1020; font-size: 11px; font-weight: 600;
  color: #4a6a8a; text-align: left; padding: 11px 14px;
  border-bottom: 1px solid #162940;
  white-space: nowrap; letter-spacing: 0.3px;
}
.col-id   { width: 110px; }
.col-cat  { width: 160px; }
.col-comp { width: 170px; }
.col-sev  { width: 60px; }
.col-act  { width: 50px; }

/* 数据行 */
.data-row { transition: background 0.15s; cursor: pointer; }
.data-row:hover { background: #162940; }
.data-row.selected { background: #1890ff0d; border-left: 2px solid #1890ff; }
.data-row td {
  padding: 12px 14px; border-bottom: 1px solid #0c1320;
  font-size: 12px; color: #ffffff; vertical-align: middle;
  height: 48px;
}
td.col-id   { color: #4a6a8a; font-size: 11px; font-family: Consolas, monospace; }
td.col-cat  { color: #4a6a8a; font-size: 11px; }
td.col-comp { font-weight: 600; }
td.col-desc { color: #a0aec0; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }

/* 扣分标签 */
.sev-badge {
  display: inline-block; font-size: 11px; font-weight: 700;
  padding: 3px 8px; border-radius: 3px;
}
.sev-bad  { color: #ff4d4f; background: #ff4d4f1f; border: 1px solid #ff4d4f33; }
.sev-warn { color: #faad14; background: #faad141f; border: 1px solid #faad1433; }
.sev-ok   { color: #52c41a; background: #52c41a1f; border: 1px solid #52c41a33; }

/* 操作按钮 */
.view-btn {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent;
  border-radius: 4px; cursor: pointer; color: #4a6a8a;
  transition: all 0.2s; padding: 0;
}
.view-btn:hover { color: #ffffff; background: #162940; border-color: #4a6a8a; }
.view-btn svg { width: 16px; height: 16px; }

.empty-row {
  text-align: center; padding: 56px 14px !important;
  color: #4a6a8a !important; font-size: 13px !important;
}

/* ============ 右侧详情抽屉 Drawer ============ */
.detail-drawer {
  width: 550px; min-width: 550px;
  background: #0b1220;
  border-left: 1px solid #162940;
  display: flex; flex-direction: column;
  overflow: hidden; z-index: 10;
}
.drawer-top {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #162940;
  flex-shrink: 0;
}
.drawer-label { font-size: 13px; font-weight: 700; color: #ffffff; }
.close-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid #162940;
  border-radius: 6px; cursor: pointer; color: #4a6a8a;
  transition: all 0.2s; padding: 0;
}
.close-btn:hover { color: #ffffff; border-color: #ff4d4f; background: #ff4d4f0f; }
.close-btn svg { width: 16px; height: 16px; }

.drawer-body {
  flex: 1; overflow-y: auto;
  padding: 16px 20px;
  display: flex; flex-direction: column; gap: 14px;
}

/* 抽屉卡片 */
.d-card {
  border: 1px solid #162940;
  border-radius: 8px;
  background: #0d192d;
  overflow: hidden;
}
.d-card-hd {
  display: flex; align-items: center; gap: 7px;
  padding: 12px 16px;
  font-size: 12px; font-weight: 600;
  color: #ffffff;
  border-bottom: 1px solid #162940;
}
.d-card-icon { width: 16px; height: 16px; color: #1890ff; flex-shrink: 0; }
.d-card-bd {
  padding: 12px 16px;
  font-size: 12px; line-height: 1.7; color: #a0aec0;
}

/* 1. 基础信息卡 */
.d-header-card { border-color: #162940; }
.d-component { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 10px; }
.d-meta-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.d-id {
  font-size: 11px; color: #4a6a8a;
  font-family: Consolas, monospace;
  padding: 2px 8px; border-radius: 3px; background: #0a1020;
}
.d-sev {
  font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 3px;
}
.d-category-tag {
  font-size: 11px; color: #4a6a8a;
  margin-top: 4px;
}

/* 2. 法规卡片 */
.d-law-card { border-left: 3px solid #1890ff; }
.law-text { font-style: italic; color: #a0aec0; }

/* 3. 描述卡片 */
.d-desc-card { }
.copy-btn {
  margin-left: auto; padding: 3px 10px;
  font-size: 10px; color: #4a6a8a;
  background: #0a1020; border: 1px solid #162940;
  border-radius: 4px; cursor: pointer; transition: all 0.15s;
  font-family: inherit;
}
.copy-btn:hover { color: #ffffff; border-color: #4a6a8a; }
.desc-text { white-space: pre-wrap; }

/* 4. 整改建议卡片 */
.d-advice-card { border-left: 3px solid #52c41a; }
.advice-text { white-space: pre-wrap; }

/* Drawer 滑入动画 */
.drawer-slide-enter-active, .drawer-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
}
.drawer-slide-enter-from, .drawer-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
  width: 0; min-width: 0;
}
</style>
