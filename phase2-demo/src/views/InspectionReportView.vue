<template>
  <div class="inspection-view">
    <!-- ===== 列表视图 ===== -->
    <template v-if="!selectedReport">
      <div class="inspection-home">
      <div class="top-bar">
        <div class="date-filter-shell">
          <el-date-picker
            v-model="dateRange"
            class="date-range-picker"
            type="daterange"
            size="default"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :editable="false"
            aria-label="按日期范围筛选日志"
          />
        </div>
      </div>
      <div class="report-list">
        <button v-for="rpt in paginatedReports" :key="rpt.id" class="report-card" @click="openReport(rpt)">
          <div class="rc-head">
            <time class="rc-date" :datetime="rpt.date">{{ formatDate(rpt.date) }}</time>
            <span class="rc-status" :class="reportTone(rpt)">{{ reportStatus(rpt) }}</span>
          </div>
          <div class="rc-main">
            <div class="rc-title">{{ rpt.summary }}</div>
            <div class="rc-summary">机舱每日巡检 · {{ reportItemCount(rpt) }} 项检测</div>
          </div>
          <div class="rc-foot">
            <span class="rc-id">{{ rpt.id }}</span>
            <span class="rc-action">
              查看详情
            <svg class="rc-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </span>
          </div>
        </button>
        <div v-if="filteredReports.length === 0" class="empty-state">
          <strong>没有找到相关日志</strong>
          <span>调整日期范围后再试</span>
        </div>
      </div>
      <div v-if="filteredReports.length > pageSize" class="pagination-bar">
        <span class="pagination-total">共 {{ filteredReports.length }} 份日志</span>
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredReports.length"
          size="default"
          layout="prev, pager, next"
          background
        />
      </div>
      </div>
    </template>

    <!-- ===== 详情视图（朴素样式，参考知识库文档详情） ===== -->
    <template v-else>
      <div class="detail-page" v-if="reportDetail">
        <div class="detail-body">
          <div class="detail-layout">
            <nav class="report-toc" aria-label="报告目录">
              <span class="toc-label">报告目录</span>
              <button type="button" @click="scrollToSection('section-ai')">智能分析摘要</button>
              <button
                v-for="(sys, index) in reportDetail.systems"
                :key="sys.name"
                type="button"
                @click="scrollToSection('section-system-' + index)"
              >{{ sys.name }}</button>
            </nav>
          <article class="doc-card" aria-labelledby="report-title">
            <div class="doc-heading">
              <h1 id="report-title" class="doc-title">{{ selectedReport.title }}</h1>
              <button class="download-btn" :disabled="isExporting" @click="exportPdf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 012-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                {{ isExporting ? '正在导出…' : '导出 PDF' }}
              </button>
            </div>
            <!-- 文档头信息 -->
            <div class="doc-meta">
              <div class="doc-meta-row">
                <span class="doc-meta-label">船名</span>
                <span class="doc-meta-value">{{ shipInfo.name }}</span>
              </div>
              <div class="doc-meta-row">
                <span class="doc-meta-label">起止时间</span>
                <span class="doc-meta-value">{{ reportDetail.timeRange }}</span>
              </div>
              <div class="doc-meta-row">
                <span class="doc-meta-label">报告生成</span>
                <span class="doc-meta-value">AI 自动 · {{ reportDetail.aiCost }}</span>
              </div>
              <div class="doc-meta-row">
                <span class="doc-meta-label">统计</span>
                <span class="doc-meta-value">正常 {{ reportDetail.stats[0].value }} 项 · 异常 {{ reportDetail.stats[1].value }} 项 · 故障 {{ reportDetail.stats[2].value }} 项 · 健康度 {{ reportDetail.stats[3].value }}</span>
              </div>
            </div>

            <!-- AI 摘要 -->
            <div id="section-ai" class="doc-section report-anchor">
              <h3 class="doc-section-title">AI 智能分析摘要</h3>
              <p class="doc-section-text">{{ reportDetail.aiSummary.text }}</p>
              <div v-for="(p, idx) in reportDetail.aiSummary.points" :key="idx" class="doc-point">
                <strong>{{ p.type === 'bad' ? '注意' : p.type === 'warn' ? '关注' : '提示' }}：</strong>{{ p.text }}
              </div>
            </div>

            <!-- 各系统检测明细 -->
            <div
              v-for="(sys, systemIndex) in reportDetail.systems"
              :id="'section-system-' + systemIndex"
              :key="sys.name"
              class="doc-section report-anchor"
            >
              <h3 class="doc-section-title">{{ sys.name }}</h3>
              <div class="table-scroll">
              <table class="doc-table">
                <colgroup>
                  <col class="col-name" />
                  <col class="col-value" />
                  <col class="col-range" />
                  <col class="col-status" />
                  <col class="col-remark" />
                </colgroup>
                <thead>
                  <tr><th>检测项目</th><th>实测值</th><th>正常范围</th><th>状态</th><th>备注</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in sys.items" :key="item.name">
                    <td class="td-name">{{ item.name }}<span class="td-unit">({{ item.unit }})</span></td>
                    <td class="td-value">{{ item.value }}</td>
                    <td class="td-range">{{ item.range }}</td>
                    <td class="td-status" :class="'status-' + item.status">{{ item.statusText }}</td>
                    <td class="td-remark">{{ item.remark }}</td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </article>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import {ElDatePicker,ElPagination} from 'element-plus'
import 'element-plus/es/components/date-picker/style/css'
import 'element-plus/es/components/pagination/style/css'

import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { inspectionReports, inspectionReportDetails } from '@/mock/inspection'
import { shipInfo } from '@/mock/devices'
import { inspectionViewCache } from '@/stores/viewCache'

const reports = inspectionReports
const route = useRoute()
const router = useRouter()
const selectedReport = ref(null)
const dateRange = ref([...inspectionViewCache.dateRange])
const currentPage = ref(inspectionViewCache.currentPage)
const isExporting = ref(false)
const pageSize = 15
const reportDetail = computed(() => selectedReport.value ? inspectionReportDetails[selectedReport.value.id] || null : null)
const filteredReports = computed(() => {
  return reports.filter(report => {
    const [dateFrom, dateTo] = dateRange.value || []
    if (dateFrom && report.date < dateFrom) return false
    if (dateTo && report.date > dateTo) return false
    return true
  })
})
const paginatedReports = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredReports.value.slice(start, start + pageSize)
})
watch(dateRange, () => {
  inspectionViewCache.dateRange = [...dateRange.value]
  currentPage.value = 1
  inspectionViewCache.currentPage = 1
}, { deep: true })
watch(currentPage, value => { inspectionViewCache.currentPage = value })
watch(() => route.query.report, (reportId) => {
  const effectiveId = reportId || inspectionViewCache.selectedReportId
  const report = reports.find(item => item.id === effectiveId) || null
  selectedReport.value = report
  inspectionViewCache.selectedReportId = report?.id || null
  if (reportId && !report) router.replace({ path: route.path })
}, { immediate: true })

// 路由 query 已被清空但页面仍被 KeepAlive 激活时，
// 监听缓存状态让全局标题栏的返回操作立即回到日志列表。
watch(() => inspectionViewCache.selectedReportId, (reportId) => {
  selectedReport.value = reportId
    ? reports.find(item => item.id === reportId) || null
    : null
})

function reportStats(report) {
  return inspectionReportDetails[report.id]?.stats || []
}

function reportStatus(report) {
  const stats = reportStats(report)
  const warning = Number.parseInt(stats[1]?.value, 10) || 0
  const fault = Number.parseInt(stats[2]?.value, 10) || 0
  if (fault > 0) return `${fault} 项故障`
  if (warning > 0) return `${warning} 项关注`
  return '运行正常'
}

function reportTone(report) {
  const status = reportStatus(report)
  return status.includes('故障') ? 'is-danger' : status.includes('关注') ? 'is-warning' : 'is-normal'
}

function reportItemCount(report) {
  return reportStats(report).slice(0, 3).reduce((total, item) => total + (Number.parseInt(item?.value, 10) || 0), 0)
}

function formatDate(date) {
  const [, month, day] = date.split('-')
  return `${month}月${day}日`
}
function openReport(rpt) {
  selectedReport.value = rpt
  inspectionViewCache.selectedReportId = rpt.id
  router.push({ path: route.path, query: { report: rpt.id } })
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function exportPdf() {
  if (isExporting.value) return
  isExporting.value = true
  await nextTick()
  window.print()
  window.setTimeout(() => { isExporting.value = false }, 500)
}
</script>

<style scoped>
.inspection-view { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #f5f7fa; }
.inspection-home { --el-color-primary: #106BFF; --el-color-primary-light-3: #4D8EFF; --el-color-primary-light-5: #80AEFF; --el-color-primary-light-8: #D9E7FF; --el-color-primary-light-9: #EDF4FF; width: calc(100% - 24px); height: calc(100% - 24px); margin: 12px; display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto; background: var(--bg-surface); border-radius: 8px; animation: section-list-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }

/* ===== 列表视图 ===== */
.top-bar { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 16px 0; flex-shrink: 0; }
.date-filter-shell { flex: 0 0 260px; width: 260px; min-width: 260px; max-width: 260px; height: 32px; }
.date-filter-shell :deep(.el-date-editor.el-input__wrapper) {
  box-sizing: border-box;
  width: 260px !important;
  min-width: 260px !important;
  max-width: 260px !important;
  height: 32px !important;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: #FFFFFF;
  box-shadow: 0 0 0 1px var(--border-primary) inset !important;
  cursor: pointer;
}
.date-filter-shell :deep(.el-date-editor.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--border-primary) inset !important;
}
.date-filter-shell :deep(.el-date-editor.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 2px rgba(22,119,255,0.10) !important;
}
.date-filter-shell :deep(.el-range-input),
.date-filter-shell :deep(.el-range-separator),
.date-filter-shell :deep(.el-range__icon),
.date-filter-shell :deep(.el-range__close-icon) { cursor: pointer; }
.report-list { flex: none; overflow: visible; padding: 16px 16px 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); grid-auto-rows: 196px; align-content: start; gap: 16px; }
.report-card { width: 100%; min-width: 0; max-width: none; height: 196px; display: flex; flex-direction: column; gap: 12px; padding: 16px; text-align: left; font: inherit; color: inherit; background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; cursor: pointer; transition: border-color .18s, box-shadow .18s, transform .18s; }
.report-card:hover { border-color: var(--accent); box-shadow: 0 6px 18px rgba(25, 33, 61, .08); transform: translateY(-1px); }
.report-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rc-head, .rc-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rc-date { color: #19213d; font-size: 14px; font-weight: 600; }
.rc-main { flex: 1; min-width: 0; }
.rc-title { margin-bottom: 8px; color: #19213d; font-size: 16px; line-height: 26px; font-weight: 600; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.rc-summary { color: var(--text-muted); font-size: 14px; line-height: 22px; }
.rc-status { padding: 3px 8px; border-radius: 4px; font-size: 14px; line-height: 20px; }
.rc-status.is-normal { background: #f0f9f2; color: #2f8f46; }
.rc-status.is-warning { background: #fff8ed; color: #c46a00; }
.rc-status.is-danger { background: #fff1f0; color: #d9363e; }
.rc-id { color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.rc-action { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-size: 14px; opacity: 0; visibility: hidden; transform: translateX(-4px); transition: opacity .16s, visibility .16s, transform .16s; }
.report-card:hover .rc-action,
.report-card:focus-visible .rc-action { opacity: 1; visibility: visible; transform: translateX(0); }
.rc-arrow { width: 16px; height: 16px; }
.empty-state { grid-column: 1 / -1; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--text-muted); }
.empty-state strong { color: var(--text-primary); font-size: 15px; }
.empty-state span { font-size: 13px; }
.pagination-bar { min-height: 52px; display: flex; align-items: center; justify-content: flex-end; padding: 8px 16px 16px; background: var(--bg-surface); flex-shrink: 0; }
.pagination-total { margin-right: 12px; color: var(--text-muted); font-size: 13px; white-space: nowrap; }
.pagination-bar :deep(.el-pagination.is-background .el-pager li.is-active) { background-color: #106BFF; }

/* ===== 详情视图（朴素样式） ===== */
.detail-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; animation: section-detail-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) both; }

@keyframes section-detail-enter {
  from { opacity: 0; transform: translateX(18px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes section-list-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}
.download-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; font-size: var(--font-sm); color: var(--accent); background: transparent; border: 1px solid var(--accent); border-radius: 4px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.download-btn:hover { background: var(--accent-bg); }
.download-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.download-btn:disabled { opacity: .55; cursor: wait; }

.detail-body { flex: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; align-items: center; }
.detail-layout { width: 100%; max-width: 1144px; display: grid; grid-template-columns: 152px minmax(0, 960px); align-items: start; justify-content: center; gap: 32px; }
.report-toc { position: sticky; top: 0; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding-top: 4px; }
.toc-label { padding: 0 8px 8px; color: #9195A2; font-size: 12px; line-height: 20px; }
.report-toc button { width: 100%; padding: 5px 8px; overflow: hidden; border: 0; border-radius: 4px; background: transparent; color: #6C7183; font: inherit; font-size: 13px; line-height: 20px; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; transition: color .15s, background .15s; }
.report-toc button:hover {
  color: #1F1F22;
  background: #E4E4E7;
  font-weight: 600;
}
.report-toc button:focus-visible { outline: 2px solid #106BFF; outline-offset: 1px; }
.report-anchor { scroll-margin-top: 16px; }

/* 统一白卡片 */
.doc-card { background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; padding: 24px; max-width: 960px; width: 100%; box-shadow: var(--shadow-sm); }
.doc-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.doc-title { min-width: 0; margin: 0; color: var(--text-primary); font-size: 28px !important; line-height: 40px; font-weight: 700; }
.doc-heading .download-btn { flex-shrink: 0; }

/* 文档元信息 */
.doc-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; margin-bottom: 32px; padding: 16px 20px; border-radius: 8px; background: #F7F8FA; }
.doc-meta-row { min-width: 0; display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: start; gap: 12px; font-size: 14px; line-height: 24px; }
.doc-meta-row:last-child { grid-column: 1 / -1; }
.doc-meta-label { color: #9195A2; white-space: nowrap; }
.doc-meta-value { min-width: 0; color: #19213D; font-weight: 500; }

/* 段落 */
.doc-section { margin-bottom: 32px; }
.doc-section:last-child { margin-bottom: 0; }
.doc-section-title { font-size: 18px; line-height: 28px; font-weight: 700; color: #19213D; margin: 0 0 12px; }
.doc-section-text { max-width: 72ch; font-size: 14px; color: #6C7183; line-height: 24px; margin: 0 0 12px; }
.doc-point { font-size: 14px; color: #6C7183; line-height: 24px; margin: 8px 0 0; padding: 10px 12px; background: #F5F9FF; border-radius: 6px; }
.doc-point strong { color: #19213D; font-weight: 600; }

/* 表格 */
.table-scroll { width: 100%; overflow-x: auto; border-radius: 8px; }
.doc-table { width: 100%; min-width: 760px; table-layout: fixed; overflow: hidden; border: 1px solid #E4E7ED; border-radius: 8px; border-collapse: separate; border-spacing: 0; font-size: 14px; }
.doc-table .col-name { width: 24%; }
.doc-table .col-value { width: 14%; }
.doc-table .col-range { width: 20%; }
.doc-table .col-status { width: 14%; }
.doc-table .col-remark { width: 28%; }
.doc-table th { background: #F7F8FA; color: #6C7183; font-weight: 500; text-align: left; padding: 10px 12px; border-bottom: 1px solid #E4E7ED; white-space: nowrap; }
.doc-table td { padding: 11px 12px; color: #6C7183; border-bottom: 1px solid #EEF0F4; vertical-align: top; overflow-wrap: anywhere; }
.doc-table tbody tr:last-child td { border-bottom: 0; }
.doc-table tbody tr:hover { background: #FAFBFC; }
.td-name { color: var(--text-primary); font-weight: 500; }
.td-unit { font-size: var(--font-xs); color: var(--text-muted); font-weight: 400; }
.td-value { font-family: Consolas, monospace; color: var(--text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
.td-range { color: var(--text-muted); font-family: Consolas, monospace; }
.td-remark { color: var(--text-muted); }
.td-status { white-space: nowrap; font-weight: 500; }
.td-status.status-normal { color: #00A34C; }
.td-status.status-warning { color: #FF8000; }
.td-status.status-danger,
.td-status.status-error { color: #E52E2E; }

@media (max-width: 760px) {
  .inspection-home { width: calc(100% - 16px); height: calc(100% - 16px); margin: 8px; }
  .top-bar { align-items: center; flex-direction: row; flex-wrap: nowrap; gap: 12px; padding: 12px 14px 0; }
  .date-filter-shell { flex: 0 0 260px; width: 260px; min-width: 260px; max-width: 260px; height: 32px; }
  .report-list { padding: 12px 14px 16px; grid-template-columns: 1fr; }
  .report-card { max-width: none; }
  .pagination-bar { padding: 8px 14px; }
  .pagination-bar { justify-content: center; overflow-x: auto; }
  .detail-body { padding: 16px 12px; }
  .detail-layout { display: block; }
  .report-toc { position: static; flex-direction: row; gap: 4px; margin-bottom: 12px; padding: 0 0 4px; overflow-x: auto; }
  .toc-label { display: none; }
  .report-toc button { width: auto; flex: 0 0 auto; padding: 5px 9px; background: #F7F8FA; }
  .doc-card { padding: 24px; overflow-x: auto; }
  .doc-meta { grid-template-columns: 1fr; padding: 14px 16px; }
  .doc-meta-row:last-child { grid-column: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .inspection-home,
  .detail-page { animation: none; }
}

@media (hover: none) {
  .rc-action { opacity: 1; visibility: visible; transform: none; }
}

@media print {
  :global(.app-nav),
  :global(.app-header),
  .report-toc,
  .download-btn { display: none !important; }
  :global(.app-main),
  :global(.app-content),
  .inspection-view,
  .detail-page,
  .detail-body { display: block !important; width: auto !important; height: auto !important; overflow: visible !important; padding: 0 !important; background: #FFFFFF !important; }
  .detail-layout { display: block; max-width: none; }
  .doc-card { max-width: none; border: 0; box-shadow: none; padding: 0; }
  .doc-section { break-inside: avoid; }
  .table-scroll { overflow: visible; }
  .doc-table { min-width: 0; }
}
</style>
