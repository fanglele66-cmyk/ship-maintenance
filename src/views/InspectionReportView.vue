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
  const m = { '主机系统': '⚙️', '辅机系统': '🔧', '泵系统': '💧', '甲板机械': '⚓', '燃油系统': '⛽', '润滑系统': '🛢️', '电气与安全系统': '🔌' }
  return m[name] || '📋'
}
</script>

<style scoped>
.inspection-view { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-app); }

/* ===== 列表视图 ===== */
.top-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
.page-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px; }
.title-icon { width: 18px; height: 18px; flex-shrink: 0; }
.report-count { font-size: 12px; color: var(--text-secondary); }
.report-list { flex: 1; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 8px; }
.report-card { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); }
.report-card:hover { border-color: var(--accent); background: var(--bg-hover); }
.rc-left { flex: 1; min-width: 0; }
.rc-date { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-family: Consolas, monospace; }
.rc-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.rc-summary { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-right { flex-shrink: 0; }
.rc-arrow { width: 20px; height: 20px; color: var(--text-secondary); }

/* ===== 详情视图 ===== */
.detail-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.detail-topbar { display: flex; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--border-primary); background: var(--bg-panel); gap: 16px; flex-shrink: 0; }
.back-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.15s; font-family: inherit; }
.back-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.detail-title { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
.download-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; font-size: 11px; color: var(--accent); background: transparent; border: 1px solid var(--accent); border-radius: 4px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.download-btn:hover { background: var(--accent-bg); }

.detail-body { flex: 1; overflow-y: auto; padding: 20px 24px; }

/* 报告头 */
.rpt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.rpt-header-left { flex: 1; }
.daily-badge { display: inline-block; font-size: 10px; font-weight: 700; color: var(--accent); background: var(--accent-bg); border: 1px solid var(--accent); padding: 3px 10px; border-radius: 3px; letter-spacing: 1px; margin-bottom: 8px; }
.rpt-title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0; }
.rpt-subtitle { font-size: 11px; color: var(--text-secondary); }
.rpt-header-right { text-align: right; flex-shrink: 0; margin-left: 20px; }
.rpt-date-big { font-size: 42px; font-weight: 700; color: var(--accent); line-height: 1; font-family: Consolas, monospace; }
.rpt-date-year { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

/* 元信息行 */
.rpt-meta-row { display: flex; gap: 40px; padding: 12px 0; border-top: 1px solid var(--border-primary); border-bottom: 1px solid var(--border-primary); margin-bottom: 16px; }
.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; color: var(--text-secondary); }
.meta-value { font-size: 13px; color: var(--text-primary); font-weight: 600; }

/* 统计卡片 */
.rpt-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 8px; border: 1px solid; }
.stat-card.ok   { background: var(--success-bg); border-color: var(--success); }
.stat-card.warn  { background: var(--warning-bg); border-color: var(--warning); }
.stat-card.bad   { background: var(--danger-bg); border-color: var(--danger); }
.stat-card.blue  { background: var(--accent-bg); border-color: var(--accent); }
.stat-icon-wrap { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.stat-card.ok   .stat-icon-wrap { background: var(--success-bg); color: var(--success); }
.stat-card.warn  .stat-icon-wrap { background: var(--warning-bg); color: var(--warning); }
.stat-card.bad   .stat-icon-wrap { background: var(--danger-bg); color: var(--danger); }
.stat-card.blue  .stat-icon-wrap { background: var(--accent-bg); color: var(--accent); }
.stat-info { display: flex; flex-direction: column; }
.stat-label { font-size: 11px; color: var(--text-secondary); }
.stat-value { font-size: 22px; font-weight: 700; line-height: 1.2; }

/* AI 摘要 */
.rpt-ai-summary { background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm); }
.ai-summary-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
.ai-icon { font-size: 16px; }
.ai-summary-body { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
.ai-score-ring { position: relative; flex-shrink: 0; }
.ai-score-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ai-score-num { font-size: 20px; font-weight: 700; line-height: 1; }
.ai-score-den { font-size: 10px; color: var(--text-secondary); }
.ai-summary-text { flex: 1; }
.ai-tag-line { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.ai-tag { font-size: 13px; font-weight: 700; }
.ai-focus { font-size: 12px; color: var(--text-muted); }
.ai-desc { font-size: 11px; color: var(--text-muted); line-height: 1.6; }
.ai-points { display: flex; flex-direction: column; gap: 8px; }
.ai-point { display: flex; gap: 8px; padding: 10px 14px; border-radius: 6px; align-items: flex-start; }
.ai-point.warn { background: var(--warning-bg); border-left: 3px solid var(--warning); }
.ai-point.info { background: var(--accent-bg); border-left: 3px solid var(--accent); }
.ai-point.bad  { background: var(--danger-bg); border-left: 3px solid var(--danger); }
.ai-point-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
.ai-point-content { flex: 1; }
.ai-point-title { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.ai-point-text { font-size: 11px; color: var(--text-muted); line-height: 1.5; }

/* 系统巡检明细 */
.rpt-systems { display: flex; flex-direction: column; gap: 8px; }
.sys-section { background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; overflow: hidden; box-shadow: var(--shadow-sm); }
.sys-header { width: 100%; display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: transparent; border: none; cursor: pointer; font-family: inherit; text-align: left; transition: background 0.15s; }
.sys-header:hover { background: var(--bg-hover); }
.sys-icon { font-size: 16px; flex-shrink: 0; }
.sys-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.sys-status-badge { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 3px; }
.sys-status-badge.ok   { color: var(--success); background: var(--success-bg); }
.sys-status-badge.warn { color: var(--warning); background: var(--warning-bg); }
.sys-status-badge.bad  { color: var(--danger); background: var(--danger-bg); }
.sys-caret { width: 16px; height: 16px; color: var(--text-secondary); transition: transform 0.2s; flex-shrink: 0; }
.sys-caret.open { transform: rotate(90deg); }
.sys-items { border-top: 1px solid var(--border-primary); }
.sys-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sys-table th { background: var(--bg-panel); color: var(--text-secondary); font-weight: 600; text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border-primary); font-size: 11px; }
.sys-table td { padding: 10px 14px; border-bottom: 1px solid var(--border-secondary); color: var(--text-muted); }
.sys-table tbody tr:hover { background: var(--bg-hover); }
.item-name { color: var(--text-primary); font-weight: 500; }
.item-unit-label { font-size: 10px; color: var(--text-secondary); font-weight: 400; }
.item-value { color: var(--text-primary); font-weight: 600; font-family: Consolas, monospace; }
.item-range { color: var(--text-muted); font-family: Consolas, monospace; font-size: 11px; }
.item-status { font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: 500; }
.item-status.normal  { color: var(--success); background: var(--success-bg); }
.item-status.warning { color: var(--warning); background: var(--warning-bg); }
.item-status.bad     { color: var(--danger); background: var(--danger-bg); }
.item-remark { font-size: 11px; color: var(--text-secondary); max-width: 200px; }
</style>
