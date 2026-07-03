<template>
  <div class="inspection-view">
    <!-- ===== 列表视图 ===== -->
    <template v-if="!selectedReport">
      <div class="top-bar">
        <h2 class="page-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="#1890ff" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
          巡检报告
        </h2>
        <span class="report-count">共 {{ reports.length }} 份报告</span>
      </div>

      <div class="report-list">
        <div
          v-for="rpt in reports"
          :key="rpt.id"
          class="report-card"
          @click="openReport(rpt)"
        >
          <div class="rc-left">
            <div class="rc-date">{{ rpt.date }}</div>
            <div class="rc-title">{{ rpt.title }}</div>
            <div class="rc-summary">{{ rpt.summary }}</div>
          </div>
          <div class="rc-right">
            <svg class="rc-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== 详情视图 ===== -->
    <template v-else>
      <div class="detail-page">
        <div class="detail-topbar">
          <button class="back-btn" @click="selectedReport = null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            返回
          </button>
          <span class="detail-title">{{ selectedReport.title }}</span>
          <button class="download-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            导出PDF
          </button>
        </div>

        <div class="detail-body" v-if="reportDetail">
          <!-- 报告头信息 -->
          <div class="rpt-header">
            <div class="rpt-header-left">
              <h1 class="rpt-title">{{ reportDetail.title }}</h1>
              <div class="rpt-subtitle">{{ reportDetail.subtitle }}</div>
              <div class="rpt-meta">
                <span>{{ reportDetail.dateYear }}</span>
                <span>巡检时间 {{ reportDetail.timeRange }}</span>
                <span>AI分析完成 {{ reportDetail.aiCost }}</span>
              </div>
            </div>
            <div class="rpt-header-right">
              <div class="rpt-date-big">{{ reportDetail.dateLabel }}</div>
              <div class="rpt-vessel">{{ reportDetail.vesselName }}</div>
            </div>
          </div>

          <!-- 统计卡片 -->
          <div class="rpt-stats">
            <div v-for="s in reportDetail.stats" :key="s.label" class="stat-card" :class="s.bg">
              <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
              <div class="stat-label">{{ s.label }}</div>
            </div>
          </div>

          <!-- AI 智能摘要 -->
          <div class="rpt-ai-summary">
            <div class="ai-summary-header">
              <svg class="ai-icon" viewBox="0 0 24 24" fill="none" stroke="#1890ff" stroke-width="2"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 6v6l4 2"/></svg>
              <span>AI 智能分析摘要</span>
              <span class="ai-score" :style="{ color: aiColor }">{{ reportDetail.aiSummary.score }}分 · {{ reportDetail.aiSummary.tag }}</span>
            </div>
            <div class="ai-points">
              <div v-for="(p, idx) in reportDetail.aiSummary.points" :key="idx" class="ai-point" :class="p.type">
                <div class="ai-point-title">{{ p.title }}</div>
                <div class="ai-point-text">{{ p.text }}</div>
              </div>
            </div>
          </div>

          <!-- 系统巡检明细 -->
          <div class="rpt-systems">
            <div v-for="sys in reportDetail.systems" :key="sys.name" class="sys-section">
              <button class="sys-header" @click="sys.expanded = !sys.expanded">
                <svg class="sys-caret" :class="{ open: sys.expanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
                <span class="sys-name">{{ sys.name }}</span>
                <span class="sys-status" :class="sys.level">{{ sys.statusText }}</span>
              </button>
              <div v-show="sys.expanded" class="sys-items">
                <table class="sys-table">
                  <thead>
                    <tr>
                      <th>检查项目</th>
                      <th>实测值</th>
                      <th>标准范围</th>
                      <th>状态</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in sys.items" :key="item.name">
                      <td>{{ item.name }}</td>
                      <td class="item-value">{{ item.value }} <span class="item-unit">{{ item.unit }}</span></td>
                      <td>{{ item.range }}</td>
                      <td><span class="item-status" :class="item.status">{{ item.statusText }}</span></td>
                      <td class="item-remark">{{ item.remark }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { inspectionReports, inspectionReportDetails } from '@/mock/inspection'

const reports = inspectionReports
const selectedReport = ref(null)

const reportDetail = computed(() => {
  if (!selectedReport.value) return null
  return inspectionReportDetails[selectedReport.value.id] || null
})

const aiColor = computed(() => {
  if (!reportDetail.value) return '#52c41a'
  const level = reportDetail.value.aiSummary.level
  return { ok: '#52c41a', warn: '#faad14', bad: '#ff4d4f' }[level] || '#52c41a'
})

function openReport(rpt) {
  selectedReport.value = rpt
}
</script>

<style scoped>
.inspection-view {
  flex: 1; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden; background: #070c14;
}

/* ===== 列表视图 ===== */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid #162940;
  flex-shrink: 0;
}
.page-title {
  font-size: 15px; font-weight: 700; color: #ffffff; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.title-icon { width: 18px; height: 18px; flex-shrink: 0; }
.report-count { font-size: 12px; color: #4a6a8a; }

.report-list {
  flex: 1; overflow-y: auto; padding: 12px 20px;
  display: flex; flex-direction: column; gap: 8px;
}
.report-card {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 18px; background: #0d192d;
  border: 1px solid #162940; border-radius: 8px;
  cursor: pointer; transition: all 0.2s;
}
.report-card:hover {
  border-color: #1890ff; background: #111e34;
}
.rc-left { flex: 1; min-width: 0; }
.rc-date { font-size: 11px; color: #4a6a8a; margin-bottom: 4px; font-family: Consolas, monospace; }
.rc-title { font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 4px; }
.rc-summary { font-size: 11px; color: #8baac0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-right { flex-shrink: 0; }
.rc-arrow { width: 20px; height: 20px; color: #4a6a8a; }

/* ===== 详情视图 ===== */
.detail-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.detail-topbar {
  display: flex; align-items: center; padding: 10px 20px;
  border-bottom: 1px solid #162940; background: #0a1020;
  gap: 16px; flex-shrink: 0;
}
.back-btn {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; color: #4a6a8a; background: transparent;
  border: none; cursor: pointer; padding: 4px 8px;
  border-radius: 4px; transition: all 0.15s; font-family: inherit;
}
.back-btn:hover { color: #ffffff; background: #162940; }
.detail-title { font-size: 13px; font-weight: 600; color: #ffffff; flex: 1; }
.download-btn {
  display: flex; align-items: center; gap: 4px; padding: 5px 12px;
  font-size: 11px; color: #1890ff; background: transparent;
  border: 1px solid #1890ff; border-radius: 4px; cursor: pointer;
  transition: all 0.15s; font-family: inherit;
}
.download-btn:hover { background: #1890ff1f; }

.detail-body {
  flex: 1; overflow-y: auto; padding: 20px;
}

/* 报告头 */
.rpt-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: 16px; border-bottom: 1px solid #162940; margin-bottom: 16px;
}
.rpt-title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 4px 0; }
.rpt-subtitle { font-size: 11px; color: #4a6a8a; margin-bottom: 8px; }
.rpt-meta { display: flex; gap: 16px; font-size: 11px; color: #4a6a8a; }
.rpt-date-big { font-size: 36px; font-weight: 700; color: #1890ff; line-height: 1; }
.rpt-vessel { font-size: 12px; color: #4a6a8a; margin-top: 4px; text-align: right; }

/* 统计卡片 */
.rpt-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;
}
.stat-card {
  background: #0d192d; border: 1px solid #162940; border-radius: 8px;
  padding: 16px; text-align: center;
}
.stat-value { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
.stat-label { font-size: 11px; color: #4a6a8a; }

/* AI 摘要 */
.rpt-ai-summary {
  background: #0d192d; border: 1px solid #162940; border-radius: 8px;
  padding: 16px; margin-bottom: 16px;
}
.ai-summary-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  font-size: 13px; font-weight: 600; color: #ffffff;
}
.ai-icon { width: 18px; height: 18px; flex-shrink: 0; }
.ai-score { margin-left: auto; font-size: 12px; font-weight: 600; }
.ai-points { display: flex; flex-direction: column; gap: 10px; }
.ai-point {
  padding: 10px 14px; border-radius: 6px; font-size: 12px; line-height: 1.6;
}
.ai-point.warn { background: #faad140f; border-left: 3px solid #faad14; color: #a0aec0; }
.ai-point.info { background: #1890ff0f; border-left: 3px solid #1890ff; color: #a0aec0; }
.ai-point.bad  { background: #ff4d4f0f; border-left: 3px solid #ff4d4f; color: #a0aec0; }
.ai-point-title { font-weight: 600; color: #ffffff; margin-bottom: 4px; }

/* 系统巡检明细 */
.rpt-systems { display: flex; flex-direction: column; gap: 8px; }
.sys-section { background: #0d192d; border: 1px solid #162940; border-radius: 8px; overflow: hidden; }
.sys-header {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; background: transparent; border: none;
  cursor: pointer; font-family: inherit; text-align: left;
  transition: background 0.15s;
}
.sys-header:hover { background: #16294033; }
.sys-caret { width: 16px; height: 16px; color: #4a6a8a; transition: transform 0.2s; flex-shrink: 0; }
.sys-caret.open { transform: rotate(90deg); }
.sys-name { flex: 1; font-size: 13px; font-weight: 600; color: #ffffff; }
.sys-status { font-size: 10px; padding: 2px 8px; border-radius: 3px; }
.sys-status.ok   { color: #52c41a; background: #52c41a1f; }
.sys-status.warn { color: #faad14; background: #faad141f; }
.sys-status.bad  { color: #ff4d4f; background: #ff4d4f1f; }

.sys-items { border-top: 1px solid #162940; }
.sys-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sys-table th {
  background: #0a1020; color: #4a6a8a; font-weight: 600;
  text-align: left; padding: 8px 14px; border-bottom: 1px solid #162940;
  font-size: 11px;
}
.sys-table td {
  padding: 10px 14px; border-bottom: 1px solid #0c1320; color: #a0aec0;
}
.sys-table tbody tr:hover { background: #16294033; }
.item-value { color: #ffffff; font-weight: 600; font-family: Consolas, monospace; }
.item-unit { font-size: 10px; color: #4a6a8a; font-weight: 400; }
.item-status { font-size: 11px; padding: 2px 8px; border-radius: 3px; }
.item-status.normal  { color: #52c41a; background: #52c41a1f; }
.item-status.warning { color: #faad14; background: #faad141f; }
.item-status.bad     { color: #ff4d4f; background: #ff4d4f1f; }
.item-remark { font-size: 11px; color: #4a6a8a; }
</style>
