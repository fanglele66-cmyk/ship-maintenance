<template>
  <div class="inspection-view">
    <!-- ===== 列表视图 ===== -->
    <template v-if="!selectedReport">
      <div class="top-bar">
        <h2 class="page-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="#1890ff" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
          日志
        </h2>
        <span class="report-count">共 {{ reports.length }} 份</span>
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

    <!-- ===== 详情视图（朴素样式，参考知识库文档详情） ===== -->
    <template v-else>
      <div class="detail-page" v-if="reportDetail">
        <!-- 顶部导航栏 -->
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
          <div class="doc-card">
            <!-- 文档头信息 -->
            <div class="doc-meta">
              <div class="doc-meta-row">
                <span class="doc-meta-label">船名</span>
                <span class="doc-meta-value">{{ reportDetail.vesselName }}</span>
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
            <div class="doc-section">
              <h3 class="doc-section-title">AI 智能分析摘要</h3>
              <p class="doc-section-text">{{ reportDetail.aiSummary.text }}</p>
              <div v-for="(p, idx) in reportDetail.aiSummary.points" :key="idx" class="doc-point">
                <strong>{{ p.type === 'bad' ? '注意' : p.type === 'warn' ? '关注' : '提示' }}：</strong>{{ p.text }}
              </div>
            </div>

            <!-- 各系统检测明细 -->
            <div v-for="sys in reportDetail.systems" :key="sys.name" class="doc-section">
              <h3 class="doc-section-title">{{ sys.name }}</h3>
              <table class="doc-table">
                <thead>
                  <tr><th>检测项目</th><th>实测值</th><th>正常范围</th><th>状态</th><th>备注</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in sys.items" :key="item.name">
                    <td class="td-name">{{ item.name }}<span class="td-unit">({{ item.unit }})</span></td>
                    <td class="td-value">{{ item.value }}</td>
                    <td class="td-range">{{ item.range }}</td>
                    <td>{{ item.statusText }}</td>
                    <td class="td-remark">{{ item.remark }}</td>
                  </tr>
                </tbody>
              </table>
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
function openReport(rpt) { selectedReport.value = rpt }
</script>

<style scoped>
.inspection-view { flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-app); }

/* ===== 列表视图 ===== */
.top-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
.page-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px; }
.title-icon { width: 18px; height: 18px; flex-shrink: 0; }
.report-count { font-size: var(--font-sm); color: var(--text-secondary); }
.report-list { flex: 1; overflow-y: auto; padding: 12px 20px; display: flex; flex-direction: column; gap: 8px; }
.report-card { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); }
.report-card:hover { border-color: var(--accent); background: var(--bg-hover); }
.rc-left { flex: 1; min-width: 0; }
.rc-date { font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 4px; font-family: Consolas, monospace; }
.rc-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.rc-summary { font-size: var(--font-sm); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-right { flex-shrink: 0; }
.rc-arrow { width: 20px; height: 20px; color: var(--text-secondary); }

/* ===== 详情视图（朴素样式） ===== */
.detail-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.detail-topbar { display: flex; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--border-primary); background: var(--bg-panel); gap: 16px; flex-shrink: 0; }
.back-btn { display: flex; align-items: center; gap: 4px; font-size: var(--font-sm); color: var(--text-muted); background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.15s; font-family: inherit; }
.back-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.detail-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.download-btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; font-size: var(--font-sm); color: var(--accent); background: transparent; border: 1px solid var(--accent); border-radius: 4px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.download-btn:hover { background: var(--accent-bg); }

.detail-body { flex: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; align-items: center; }

/* 统一白卡片 */
.doc-card { background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: 8px; padding: 28px 36px; max-width: 720px; width: 100%; box-shadow: var(--shadow-sm); }

/* 文档元信息 */
.doc-meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-primary); }
.doc-meta-row { display: flex; align-items: center; gap: 12px; font-size: var(--font-sm); }
.doc-meta-label { color: var(--text-muted); min-width: 72px; flex-shrink: 0; }
.doc-meta-value { color: var(--text-primary); font-weight: 500; }

/* 段落 */
.doc-section { margin-bottom: 20px; }
.doc-section:last-child { margin-bottom: 0; }
.doc-section-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 10px 0; padding-bottom: 8px; border-bottom: 1px solid var(--border-primary); }
.doc-section-text { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.8; margin: 0 0 8px 0; }
.doc-point { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.7; margin: 4px 0; padding: 6px 10px; background: var(--bg-hover); border-radius: 4px; }

/* 表格 */
.doc-table { width: 100%; border-collapse: collapse; font-size: var(--font-sm); }
.doc-table th { background: var(--bg-panel); color: var(--text-muted); font-weight: 600; text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border-primary); }
.doc-table td { padding: 8px 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border-secondary); }
.doc-table tbody tr:hover { background: var(--bg-hover); }
.td-name { color: var(--text-primary); font-weight: 500; }
.td-unit { font-size: var(--font-xs); color: var(--text-muted); font-weight: 400; }
.td-value { font-family: Consolas, monospace; color: var(--text-primary); font-weight: 600; }
.td-range { color: var(--text-muted); font-family: Consolas, monospace; }
.td-remark { color: var(--text-muted); }
</style>
