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
        <div v-for="rpt in reports" :key="rpt.id" class="report-card" @click="openReport(rpt)">
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
      <div class="detail-page" v-if="reportDetail">
        <!-- 顶部栏 -->
        <div class="detail-topbar">
          <button class="back-btn" @click="selectedReport = null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            返回
          </button>
          <span class="detail-title">{{ reportDetail.title }}</span>
          <button class="download-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            导出PDF
          </button>
        </div>

        <div class="detail-body">
          <!-- 报告头 -->
          <div class="rpt-header">
            <div class="rpt-header-left">
              <div class="daily-badge">DAILY INSPECTION</div>
              <h1 class="rpt-title">{{ reportDetail.title }}</h1>
              <div class="rpt-subtitle">{{ reportDetail.subtitle }}</div>
            </div>
            <div class="rpt-header-right">
              <div class="rpt-date-big">{{ reportDetail.dateLabel }}</div>
              <div class="rpt-date-year">{{ reportDetail.dateYear }}</div>
            </div>
          </div>

          <!-- 元信息行 -->
          <div class="rpt-meta-row">
            <div class="meta-item"><span class="meta-label">船名</span><span class="meta-value">{{ reportDetail.vesselName }}</span></div>
            <div class="meta-item"><span class="meta-label">起止时间</span><span class="meta-value">{{ reportDetail.timeRange }}</span></div>
            <div class="meta-item"><span class="meta-label">报告生成</span><span class="meta-value">AI 自动 · {{ reportDetail.aiCost }}</span></div>
          </div>

          <!-- 统计卡片 -->
          <div class="rpt-stats">
            <div v-for="s in reportDetail.stats" :key="s.label" class="stat-card" :class="s.bg">
              <div class="stat-icon-wrap">
                <span class="stat-icon" v-if="s.bg === 'ok'">✓</span>
                <span class="stat-icon" v-else-if="s.bg === 'warn'">⚠</span>
                <span class="stat-icon" v-else-if="s.bg === 'bad'">✕</span>
                <span class="stat-icon" v-else>◎</span>
              </div>
              <div class="stat-info">
                <div class="stat-label">{{ s.label }}</div>
                <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
              </div>
            </div>
          </div>

          <!-- AI 智能摘要 -->
          <div class="rpt-ai-summary">
            <div class="ai-summary-header">
              <span class="ai-icon">🤖</span>
              <span>AI智能分析摘要</span>
            </div>
            <div class="ai-summary-body">
              <div class="ai-score-ring">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="#162940" stroke-width="5"/>
                  <circle cx="36" cy="36" r="30" fill="none" :stroke="aiColor" stroke-width="5"
                    stroke-dasharray="188.5" :stroke-dashoffset="188.5 - 188.5 * reportDetail.aiSummary.score / 100"
                    stroke-linecap="round" transform="rotate(-90 36 36)"/>
                </svg>
                <div class="ai-score-text">
                  <span class="ai-score-num" :style="{ color: aiColor }">{{ reportDetail.aiSummary.score }}</span>
                  <span class="ai-score-den">/100</span>
                </div>
              </div>
              <div class="ai-summary-text">
                <div class="ai-tag-line">
                  <span class="ai-tag" :style="{ color: aiColor }">{{ reportDetail.aiSummary.tag }}</span>
                  <span class="ai-focus">· 重点关注的涡轮增压器系统</span>
                </div>
                <div class="ai-desc">{{ reportDetail.aiSummary.text }}</div>
              </div>
            </div>
            <div class="ai-points">
              <div v-for="(p, idx) in reportDetail.aiSummary.points" :key="idx" class="ai-point" :class="p.type">
                <span class="ai-point-icon">{{ p.type === 'bad' ? '🔴' : p.type === 'warn' ? '⚠️' : 'ℹ️' }}</span>
                <div class="ai-point-content">
                  <div class="ai-point-title">{{ p.title }}</div>
                  <div class="ai-point-text">{{ p.text }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 系统巡检明细 -->
          <div class="rpt-systems">
            <div v-for="sys in reportDetail.systems" :key="sys.name" class="sys-section">
              <button class="sys-header" @click="sys.expanded = !sys.expanded">
                <span class="sys-icon">{{ sysIcon(sys.name) }}</span>
                <span class="sys-name">{{ sys.name }}</span>
                <span class="sys-status-badge" :class="sys.level">{{ sys.statusText }}</span>
                <svg class="sys-caret" :class="{ open: sys.expanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <div v-show="sys.expanded" class="sys-items">
                <table class="sys-table">
                  <thead>
                    <tr><th>检测项目</th><th>实测值</th><th>正常范围</th><th>状态</th><th>备注</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in sys.items" :key="item.name">
                      <td class="item-name">{{ item.name }} <span class="item-unit-label">({{ item.unit }})</span></td>
                      <td class="item-value">{{ item.value }}</td>
                      <td class="item-range">{{ item.range }}</td>
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
const reportDetail = computed(() => selectedReport.value ? inspectionReportDetails[selectedReport.value.id] || null : null)
const aiColor = computed(() => {
  if (!reportDetail.value) return '#52c41a'
  const l = reportDetail.value.aiSummary.level
  return { ok: '#52c41a', warn: '#faad14', bad: '#ff4d4f' }[l] || '#52c41a'
})
function openReport(rpt) { selectedReport.value = rpt }
function sysIcon(name) {
  const m = { '主机系统': '⚙️', '辅机系统': '', '泵系统': '💧', '甲板机械': '⚓', '燃油系统': '⛽', '润滑系统': '🛢️', '电气与安全系统': '🔌' }
  return m[name] || '📋'
}
</script>

<style scoped>
.inspection-view { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #070c14; }

/* ===== 列表视图 ===== */
.top-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #162940; flex-shrink: 0; }
.page-title { font-size: 15px; font-weight: 700; color: #ffffff; margin: 0; display: flex; align-items: center; gap: 8px; }
.title-icon { width: 18px; height: 18px; flex-shrink: 0; }
.report-count { font-size: 12px; color: #4a6a8a; }
.report-list { flex: 1; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 8px; }
.report-card { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: #0d192d; border: 1px solid #162940; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.report-card:hover { border-color: #1890ff; background: #111e34; }
.rc-left { flex: 1; min-width: 0; }
.rc-date { font-size: 11px; color: #4a6a8a; margin-bottom: 4px; font-family: Consolas, monospace; }
.rc-title { font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 4px; }
.rc-summary { font-size: 11px; color: #8baac0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-right { flex-shrink: 0; }
.rc-arrow { width: 20px; height: 20px; color: #4a6a8a; }

/* ===== 详情视图 ===== */
.detail-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.detail-topbar { display: flex; align-items: center; padding: 10px 20px; border-bottom: 1px solid #162940; background: #0a1020; gap: 16px; flex-shrink: 0; }
.back-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4a6a8a; background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.15s; font-family: inherit; }
.back-btn:hover { color: #ffffff; background: #162940; }
.detail-title { font-size: 13px; font-weight: 600; color: #ffffff; flex: 1; }
.download-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; font-size: 11px; color: #1890ff; background: transparent; border: 1px solid #1890ff; border-radius: 4px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.download-btn:hover { background: #1890ff1f; }

.detail-body { flex: 1; overflow-y: auto; padding: 20px 24px; }

/* 报告头 */
.rpt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.rpt-header-left { flex: 1; }
.daily-badge { display: inline-block; font-size: 10px; font-weight: 700; color: #1890ff; background: #1890ff1f; border: 1px solid #1890ff33; padding: 3px 10px; border-radius: 3px; letter-spacing: 1px; margin-bottom: 8px; }
.rpt-title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 4px 0; }
.rpt-subtitle { font-size: 11px; color: #4a6a8a; }
.rpt-header-right { text-align: right; flex-shrink: 0; margin-left: 20px; }
.rpt-date-big { font-size: 42px; font-weight: 700; color: #1890ff; line-height: 1; font-family: Consolas, monospace; }
.rpt-date-year { font-size: 12px; color: #4a6a8a; margin-top: 4px; }

/* 元信息行 */
.rpt-meta-row { display: flex; gap: 40px; padding: 12px 0; border-top: 1px solid #162940; border-bottom: 1px solid #162940; margin-bottom: 16px; }
.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; color: #4a6a8a; }
.meta-value { font-size: 13px; color: #ffffff; font-weight: 600; }

/* 统计卡片 */
.rpt-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 8px; border: 1px solid; }
.stat-card.ok   { background: #52c41a0a; border-color: #52c41a33; }
.stat-card.warn  { background: #faad140a; border-color: #faad1433; }
.stat-card.bad   { background: #ff4d4f0a; border-color: #ff4d4f33; }
.stat-card.blue  { background: #1890ff0a; border-color: #1890ff33; }
.stat-icon-wrap { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.stat-card.ok   .stat-icon-wrap { background: #52c41a1f; color: #52c41a; }
.stat-card.warn  .stat-icon-wrap { background: #faad141f; color: #faad14; }
.stat-card.bad   .stat-icon-wrap { background: #ff4d4f1f; color: #ff4d4f; }
.stat-card.blue  .stat-icon-wrap { background: #1890ff1f; color: #1890ff; }
.stat-info { display: flex; flex-direction: column; }
.stat-label { font-size: 11px; color: #4a6a8a; }
.stat-value { font-size: 22px; font-weight: 700; line-height: 1.2; }

/* AI 摘要 */
.rpt-ai-summary { background: #0d192d; border: 1px solid #162940; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.ai-summary-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }
.ai-icon { font-size: 16px; }
.ai-summary-body { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
.ai-score-ring { position: relative; flex-shrink: 0; }
.ai-score-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ai-score-num { font-size: 20px; font-weight: 700; line-height: 1; }
.ai-score-den { font-size: 10px; color: #4a6a8a; }
.ai-summary-text { flex: 1; }
.ai-tag-line { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.ai-tag { font-size: 13px; font-weight: 700; }
.ai-focus { font-size: 12px; color: #8baac0; }
.ai-desc { font-size: 11px; color: #8baac0; line-height: 1.6; }
.ai-points { display: flex; flex-direction: column; gap: 8px; }
.ai-point { display: flex; gap: 8px; padding: 10px 14px; border-radius: 6px; align-items: flex-start; }
.ai-point.warn { background: #faad140f; border-left: 3px solid #faad14; }
.ai-point.info { background: #1890ff0f; border-left: 3px solid #1890ff; }
.ai-point.bad  { background: #ff4d4f0f; border-left: 3px solid #ff4d4f; }
.ai-point-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
.ai-point-content { flex: 1; }
.ai-point-title { font-size: 12px; font-weight: 600; color: #ffffff; margin-bottom: 2px; }
.ai-point-text { font-size: 11px; color: #8baac0; line-height: 1.5; }

/* 系统巡检明细 */
.rpt-systems { display: flex; flex-direction: column; gap: 8px; }
.sys-section { background: #0d192d; border: 1px solid #162940; border-radius: 8px; overflow: hidden; }
.sys-header { width: 100%; display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: transparent; border: none; cursor: pointer; font-family: inherit; text-align: left; transition: background 0.15s; }
.sys-header:hover { background: #16294033; }
.sys-icon { font-size: 16px; flex-shrink: 0; }
.sys-name { flex: 1; font-size: 13px; font-weight: 600; color: #ffffff; }
.sys-status-badge { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 3px; }
.sys-status-badge.ok   { color: #52c41a; background: #52c41a1f; }
.sys-status-badge.warn { color: #faad14; background: #faad141f; }
.sys-status-badge.bad  { color: #ff4d4f; background: #ff4d4f1f; }
.sys-caret { width: 16px; height: 16px; color: #4a6a8a; transition: transform 0.2s; flex-shrink: 0; }
.sys-caret.open { transform: rotate(90deg); }
.sys-items { border-top: 1px solid #162940; }
.sys-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sys-table th { background: #0a1020; color: #4a6a8a; font-weight: 600; text-align: left; padding: 10px 14px; border-bottom: 1px solid #162940; font-size: 11px; }
.sys-table td { padding: 10px 14px; border-bottom: 1px solid #0c1320; color: #a0aec0; }
.sys-table tbody tr:hover { background: #16294033; }
.item-name { color: #ffffff; font-weight: 500; }
.item-unit-label { font-size: 10px; color: #4a6a8a; font-weight: 400; }
.item-value { color: #ffffff; font-weight: 600; font-family: Consolas, monospace; }
.item-range { color: #8baac0; font-family: Consolas, monospace; font-size: 11px; }
.item-status { font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: 500; }
.item-status.normal  { color: #52c41a; background: #52c41a1f; }
.item-status.warning { color: #faad14; background: #faad141f; }
.item-status.bad     { color: #ff4d4f; background: #ff4d4f1f; }
.item-remark { font-size: 11px; color: #4a6a8a; max-width: 200px; }
</style>
