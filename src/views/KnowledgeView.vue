<template>
  <div class="knowledge-view">
    <!-- ===== 顶部搜索/过滤栏 ===== -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索组件名称或检修标准..."
          class="search-input"
        />
      </div>
      <div class="filter-actions">
        <button
          v-for="sys in systems"
          :key="sys"
          class="system-chip"
          :class="{ active: currentSystem === sys }"
          @click="currentSystem = sys"
        >{{ sys }}</button>
        <button class="reset-btn" @click="resetFilters">重置</button>
      </div>
    </div>

    <!-- ===== 统计摘要栏 ===== -->
    <div class="stats-bar">
      <span class="stats-total">共 {{ filteredData.length }} 条记录</span>
      <span class="stats-dot sts-ok-dot"></span> 正常 {{ countByStatus('ok') }}
      <span class="stats-dot sts-warn-dot"></span> 预警 {{ countByStatus('warn') }}
      <span class="stats-dot sts-bad-dot"></span> 异常 {{ countByStatus('bad') }}
    </div>

    <!-- ===== 表格容器 ===== -->
    <div class="rdpsc-table-wrap">
      <table class="rdpsc-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th class="col-sys">所属系统</th>
            <th class="col-comp">部件名称</th>
            <th class="col-standard">检修标准 / 描述</th>
            <th class="col-status">状态</th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in filteredData"
            :key="row.id"
            class="data-row"
          >
            <td class="col-num">{{ idx + 1 }}</td>
            <td class="col-sys">{{ row.system }}</td>
            <td class="col-comp">{{ row.component }}</td>
            <td class="col-standard">{{ row.standard }}</td>
            <td class="col-status">
              <span class="status-badge" :class="statusCls(row.status)">
                {{ row.statusText }}
              </span>
            </td>
            <td class="col-action">
              <button class="action-btn" title="查看详情">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </td>
          </tr>
          <tr v-if="filteredData.length === 0">
            <td colspan="6" class="empty-row">未找到匹配的检修记录</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { mockKnowledge, systemFilters, statusStyleMap } from '@/mock/knowledge'

const searchQuery = ref('')
const currentSystem = ref('全部')
const systems = systemFilters

const filteredData = computed(() => {
  let list = [...mockKnowledge]
  // 系统筛选
  if (currentSystem.value !== '全部') {
    list = list.filter(r => r.system === currentSystem.value)
  }
  // 模糊搜索：匹配组件名称 或 检修标准
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(r =>
      r.component.toLowerCase().includes(q) ||
      r.standard.toLowerCase().includes(q)
    )
  }
  return list
})

function countByStatus(s) {
  return filteredData.value.filter(r => r.status === s).length
}

function statusCls(s) {
  return statusStyleMap[s]?.cls || ''
}

function resetFilters() {
  searchQuery.value = ''
  currentSystem.value = '全部'
}
</script>

<style scoped>
/* ===== 页面容器 ===== */
.knowledge-view {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
}

/* ===== 顶部搜索/过滤栏 ===== */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0a1020;
  border: 1px solid #162940;
  border-radius: 6px;
  padding: 9px 14px;
}

.search-icon {
  width: 16px;
  height: 16px;
  color: #4a6a8a;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font-size: 13px;
  font-family: inherit;
}
.search-input::placeholder {
  color: #4a6a8a;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.system-chip {
  padding: 5px 12px;
  font-size: 11px;
  color: #4a6a8a;
  background: transparent;
  border: 1px solid #162940;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: inherit;
}
.system-chip:hover {
  color: #ffffff;
  border-color: #4a6a8a;
}
.system-chip.active {
  color: #ffffff;
  background: #1890ff;
  border-color: #1890ff;
}

.reset-btn {
  margin-left: auto;
  padding: 5px 14px;
  font-size: 11px;
  color: #4a6a8a;
  background: transparent;
  border: 1px solid #162940;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.reset-btn:hover {
  color: #ffffff;
  border-color: #ff4d4f;
}

/* ===== 统计摘要栏 ===== */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 11px;
  color: #4a6a8a;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.stats-total {
  font-weight: 600;
  color: #ffffff;
  margin-right: 12px;
}
.stats-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sts-ok-dot  { background: #52c41a; }
.sts-warn-dot { background: #faad14; }
.sts-bad-dot  { background: #ff4d4f; }

/* ===== 表格容器 ===== */
.rdpsc-table-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  border-top: 1px solid #111e34;
}

.rdpsc-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  min-width: 700px;
}

/* ===== 表头 ===== */
.rdpsc-table thead {
  position: sticky;
  top: 0;
  z-index: 5;
}

.rdpsc-table th {
  background: #0a1020;
  font-size: 11px;
  font-weight: 600;
  color: #4a6a8a;
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid #162940;
  white-space: nowrap;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

/* ===== 列宽 ===== */
.col-num    { width: 40px; }
.col-sys    { width: 100px; }
.col-comp   { width: 130px; }
.col-status { width: 80px; }
.col-action { width: 44px; }
.col-standard { /* flex剩余 */ }

/* ===== 数据行 ===== */
.data-row {
  transition: background 0.15s ease;
}

.data-row:hover {
  background: #162940;
}

.data-row td {
  padding: 12px 14px;
  border-bottom: 1px solid #0c1320;
  font-size: 12px;
  color: #ffffff;
  vertical-align: middle;
}

.data-row td.col-num {
  color: #4a6a8a;
  font-size: 11px;
}

.data-row td.col-sys {
  color: #8baac0;
  font-size: 11px;
}

.data-row td.col-comp {
  font-weight: 600;
}

.data-row td.col-standard {
  color: #c8d8e8;
  line-height: 1.5;
}

/* ===== 状态标签 ===== */
.status-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 3px;
  white-space: nowrap;
}

.sts-ok {
  color: #52c41a;
  background: #52c41a1f;
}

.sts-warn {
  color: #faad14;
  background: #faad141f;
}

.sts-bad {
  color: #ff4d4f;
  background: #ff4d4f1f;
}

/* ===== 操作按钮 ===== */
.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #4a6a8a;
  transition: all 0.2s;
  padding: 0;
}
.action-btn:hover {
  color: #ffffff;
  background: #162940;
  border-color: #162940;
}
.action-btn svg {
  width: 16px;
  height: 16px;
}

/* ===== 空状态 ===== */
.empty-row {
  text-align: center;
  padding: 48px 14px !important;
  color: #4a6a8a !important;
  font-size: 13px !important;
}
</style>
