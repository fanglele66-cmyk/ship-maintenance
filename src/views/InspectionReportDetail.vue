<template>
  <div class="report-detail-page">
    <!-- ====== 顶部导航栏 ====== -->
    <nav class="rdp-navbar">
      <button class="rdp-back" @click="goBack"><Icon icon="mdi:arrow-left" /> 返回</button>
      <h1 class="rdp-nav-title">机舱日检报告</h1>
      <span class="rdp-nav-sub">Engine Room Daily Inspection Report</span>
      <button class="rdp-download" @click="downloadPDF">
        <Icon icon="mdi:download" /> 下载PDF
      </button>
    </nav>

    <!-- ====== 提示条 ====== -->
    <div class="rdp-tip-bar">
      <Icon icon="mdi:information-outline" />
      字段值为系统自动生成，仅提供参考不干预，不作判断确
    </div>

    <!-- ====== 报告头部卡片 ====== -->
    <section class="rdp-header-card">
      <!-- 顶行：左(标签+标题) | 右(大号日期) -->
      <div class="rdpc-top">
        <div class="rdpc-left">
          <div class="rdpc-badge">DAILY INSPECTION</div>
          <h2 class="rdpc-title">机舱巡检日检报告</h2>
          <p class="rdpc-sub">Engine Room Daily Inspection Report — Automated by AI Monitoring System</p>
        </div>
        <div class="rdpc-right">
          <div class="rdb-bigdate font-mono-num">{{ report.dateLabel || '--' }}</div>
          <div class="rdb-year">{{ report.dateYear || '' }}</div>
        </div>
      </div>

      <!-- 底部三列信息卡片 -->
      <div class="rdpc-meta-row">
        <div class="rdm-cell">
          <span class="rdm-lbl">船名</span>
          <b>{{ report.vesselName || '远洋号' }}</b>
        </div>
        <div class="rdm-cell">
          <span class="rdm-lbl">起止时间</span>
          <b class="font-mono-num">{{ report.timeRange || '' }}</b>
        </div>
        <div class="rdm-cell">
          <span class="rdm-lbl">报告生成</span>
          <b>AI 自动 · {{ report.aiCost || '' }}</b>
        </div>
      </div>
    </section>

    <!-- ====== 统计卡片区 ====== -->
    <section v-if="report.stats" class="rdp-stats-section">
      <div v-for="(st,i) in report.stats" :key="i" class="rdp-stat-card" :class="'sc-' + st.bg">
        <div class="rdps-icon"><Icon :icon="st.icon" /></div>
        <div class="rdps-body">
          <span class="rdps-label">{{ st.label }}</span>
          <span class="rdps-value font-mono-num" :style="{color: st.color}">{{ st.value }}</span>
        </div>
      </div>
    </section>

    <!-- ====== AI 智能分析摘要 ====== -->
    <section v-if="report.aiSummary" class="rdp-ai-section">
      <h3 class="rdpas-h3"><Icon icon="mdi:robot" style="color:#1890FF; margin-right:4px;" /> AI智能分析摘要</h3>

      <!-- 左侧圆环分数 + 右侧文字 -->
      <div class="rdpas-score-row">
        <div class="score-ring-wrap">
          <svg viewBox="0 0 120 120" class="score-ring-svg">
            <!-- 背景环 -->
            <circle cx="60" cy="60" r="50" fill="none" stroke="#162940" stroke-width="10"/>
            <!-- 进度环 -->
            <circle cx="60" cy="60" r="50" fill="none"
              :stroke="ringColor" stroke-width="10"
              stroke-linecap="round"
              :stroke-dasharray="`${report.aiSummary.score * 3.14} 314`"
              transform="rotate(-90 60 60)"
            />
            <!-- 分数文字 -->
            <text x="60" y="58" text-anchor="middle" dominant-baseline="middle"
              :fill="ringColor" font-size="32" font-weight="900" font-family="Consolas, monospace">
              {{ report.aiSummary.score }}
            </text>
            <text x="60" y="78" text-anchor="middle" dominant-baseline="middle"
              fill="#5A7A92" font-size="11">
              /100
            </text>
          </svg>
        </div>
        <div class="score-right">
          <div class="sr-main">
            <b>{{ report.aiSummary.tag }}</b> · {{ report.aiSummary.text }}
          </div>
          <p class="sr-desc">
            今日06:00主机所机状态下各项运行指标。缸间偏差及关键参数处于安全范围内。但涡轮增压系统效率持续下降（增速器转速与扫气压力双呈明显下降趋势），建议近期安排检查。
          </p>
        </div>
      </div>

      <!-- 要点列表 -->
      <div class="rdpas-points">
        <div v-for="(pt, i) in (report.aiSummary.points||[])" :key="i" class="pt-item">
          <div class="pt-icon" :class="pt.type || 'info'">
            <Icon :icon="pt.icon" />
          </div>
          <div class="pt-body">
            <b>{{ pt.title }}</b>
            <p>{{ pt.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ====== 各系统检查表 ====== -->
    <section v-if="report.systems" class="rdp-systems-section">
      <div v-for="(sys, si) in report.systems" :key="si" class="rdp-sys-card" :class="'sys-' + sys.level">
        <div class="rdpsc-head" @click="toggleSys(si)">
          <span class="rdpsc-icon" :style="{color: sysColor(sys.level)}">
            <Icon :icon="sys.icon || 'mdi:cog'" />
          </span>
          <span class="rdpsc-name">{{ sys.name }}</span>
          <span :class="['rdpsc-status', 'sts-' + sys.level]">{{ sys.statusText }}</span>
          <Icon :icon="sys.expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" class="rdpsc-arrow" />
        </div>

        <!-- 展开表格 -->
        <div v-if="sys.expanded && sys.items?.length" class="rdpsc-table-wrap">
          <table class="rdpsc-table">
            <thead>
              <tr>
                <th>检测项目</th>
                <th>实测值</th>
                <th>正常范围</th>
                <th>状态</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, ii) in sys.items" :key="ii">
                <td>{{ item.name }}<span v-if="item.unit" class="unit">({{ item.unit }})</span></td>
                <td class="font-mono-num val-col">{{ item.value }}</td>
                <td class="font-mono-num range-col">{{ item.range || '—' }}</td>
                <td>
                  <span :class="['status-pill', 'sp-' + item.status]">{{ item.statusText }}</span>
                </td>
                <td :class="['remark-col', {warn: item.remarkWarn}]">{{ item.remark }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ====== 底部信息 ====== -->
    <footer class="rdp-footer">
      本报告由监测数据自动生成 · 报告编号 {{ route.params.id }} · AI 模型版本 v3.5.0<br/>
      数据截止时间：{{ dataTime }} · 如有疑问请联系轮机长确认
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { inspectionReportDetails } from '@/mock'

const route = useRoute()
const router = useRouter()

// 当前时间字符串
const dataTime = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
})

// 报告数据
const report = computed(() => {
  return inspectionReportDetails[route.params.id] || generateFallbackDetail(route.params.id)
})

// 圆环颜色
const ringColor = computed(() => {
  const s = report.value?.aiSummary?.score ?? 87
  if (s >= 85) return '#52C41A'
  if (s >= 65) return '#FAAD14'
  return '#FF4D4F'
})

// 系统图标颜色
function sysColor(level) {
  const map = { ok: '#52C41A', warn: '#FAAD14', bad: '#FF4D4F', offline: '#5A7A92' }
  return map[level] || '#1890FF'
}

// 展开/收起系统
function toggleSys(index) {
  const sys = report.value.systems?.[index]
  if (sys) sys.expanded = !sys.expanded
}

// 返回
function goBack() {
  router.back()
}

// 下载 PDF（模拟）
function downloadPDF() {
  alert(`正在生成 PDF：${route.params.id}\n\n支持预览、下载\n不支持修改`)
}

// 兜底详情（当 mock 中没有该 ID 时）
function generateFallbackDetail(id) {
  return {
    dateLabel: id.replace('RPT-','').replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3').slice(5),
    dateYear: new Date().getFullYear() + '年',
    deviceCount: 16,
    timeRange: '06:00 — 08:30',
    aiCost: '09:35',
    stats: [
      { icon: 'mdi:check-circle', bg: 'ok', color: '#52C41A', value: 26, label: '正常项' },
      { icon: 'mdi:alert', bg: 'warn', color: '#FAAD14', value: 0, label: '异常项' },
      { icon: 'mdi:close-circle', bg: 'bad', color: '#FF4D4F', value: 0, label: '故障项' },
      { icon: 'mdi:chart-donut', bg: 'blue', color: '#1890FF', value: '92%', label: '设备健康度' }
    ],
    aiSummary: {
      level: 'ok',
      score: 92,
      tag: '整体良好',
      text: '各系统参数均在正常范围内',
      points: []
    },
    systems: [
      { name: '主机系统', level: 'ok', statusText: '✓ 全部正常', icon: 'mdi:engine', expanded: true, items: [] },
      { name: '涡轮增压器系统', level: 'ok', statusText: '✓ 正常', icon: 'mdi:turbine', expanded: false, items: [] },
      { name: '燃油系统', level: 'ok', statusText: '✓ 正常', icon: 'mdi:gas-station', expanded: false, items: [] },
      { name: '润滑系统', level: 'ok', statusText: '✓ 正常', icon: 'mdi:oil', expanded: false, items: [] },
      { name: '冷却水系统', level: 'ok', statusText: '✓ 正常', icon: 'mdi:water-pump', expanded: false, items: [] },
      { name: '液压与舵机系统', level: 'ok', statusText: '✓ 正常', icon: 'mdi:anchor', expanded: false, items: [] },
      { name: '电气与安全系统', level: 'ok', statusText: '✓ 正常', icon: 'mdi:lightning-bolt', expanded: false, items: [] }
    ]
  }
}
</script>

<style scoped>
/* ========== 页面容器 ========== */
.report-detail-page {
  min-height: 100vh;
  background: #070E1A;
  color: #B0C4D8;
  padding-bottom: 40px;
}

/* ========== 顶部导航栏 ========== */
.rdp-navbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px;
  background: #0A1426;
  border-bottom: 1px solid #1E3A5F;
  position: sticky; top: 0; z-index: 100;
  flex-shrink: 0;
}
.rdp-back {
  background: none; border: 1px solid #2A4566; border-radius: 6px;
  color: #8BAAC0; padding: 6px 14px; cursor: pointer;
  font-size: 13px; display: flex; align-items: center; gap: 4px;
  transition: all 0.15s;
}
.rdp-back:hover { background: rgba(24,144,255,0.08); border-color: #1890FF; color: #1890FF; }
.rdp-nav-title { font-size: 17px; font-weight: 800; color: #E8F0FF; margin: 0; }
.rdp-nav-sub { font-size: 10px; color: #5A7A92; margin-left: auto; }
.rdp-download {
  background: #1890FF; border: none; border-radius: 6px;
  color: #fff; padding: 7px 18px; cursor: pointer;
  font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 5px;
  transition: background 0.15s;
  margin-left: 8px;
}
.rdp-download:hover { background: #40A9FF; }

/* ========== 提示条 ========== */
.rdp-tip-bar {
  display: flex; align-items: center; gap: 6px;
  justify-content: center; font-size: 12px; color: #1890FF;
  padding: 8px 0; margin-top: 4px;
}

/* ========== 报告头部卡片 ========== */
.rdp-header-card {
  margin: 12px 20px 0; padding: 24px 28px;
  background: linear-gradient(145deg, #0C1A30 0%, #081220 100%);
  border-radius: 12px; border: 1px solid #1E3A5F;
  display: flex; flex-direction: column; gap: 0;
}

/* 顶行：左(标签+标题) | 右(大号日期) */
.rdpc-top {
  display: flex; justify-content: space-between; align-items: flex-start;
}

/* 左侧：标签+标题 */
.rdpc-left { flex: 1; min-width: 0; }
.rdpc-badge {
  display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 1.5px;
  color: #fff; background: linear-gradient(135deg, #1890FF, #096DD9);
  padding: 3px 14px; border-radius: 4px; margin-bottom: 14px;
}
.rdpc-title { font-size: 24px; font-weight: 900; color: #E8F0FF; margin: 0 0 4px; letter-spacing: 1px; }
.rdpc-sub { font-size: 11px; color: #4A6A8A; margin: 0; font-family: Consolas, monospace; }

/* 右侧：大号日期（右上角对齐）*/
.rdpc-right { text-align: right; flex-shrink: 0; margin-left: 30px; padding-top: 2px; }
.rdb-bigdate { font-size: 52px; font-weight: 900; color: #1890FF; line-height: 1; letter-spacing: -1px; }
.rdb-year { font-size: 12px; color: #5A7A92; margin-top: 2px; }

/* 底部三列信息卡片 */
.rdpc-meta-row {
  display: flex; gap: 0;
  margin-top: 20px; padding-top: 16px; border-top: 1px solid #152238;
}
.rdm-cell {
  flex: 1; padding: 14px 18px;
  border-right: 1px solid #162940;
}
.rdm-cell:last-child { border-right: none; }
.rdm-lbl {
  display: block; font-size: 11px; color: #5A7A92; margin-bottom: 6px;
}
.rdm-cell b { font-size: 14px; color: #E0ECF8; display: block; }

/* ========== 统计卡片 ========== */
.rdp-stats-section {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  margin: 14px 20px;
}
.rdp-stat-card {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 18px; border-radius: 10px;
  transition: transform 0.15s;
}
.rdp-stat-card:hover { transform: translateY(-1px); }
.rdp-stat-card.sc-ok { background: rgba(82,196,26,0.07); border: 1px solid rgba(82,196,26,0.18); }
.rdp-stat-card.sc-warn { background: rgba(250,173,20,0.07); border: 1px solid rgba(250,173,20,0.18); }
.rdp-stat-card.sc-bad { background: rgba(255,77,79,0.07); border: 1px solid rgba(255,77,79,0.18); }
.rdp-stat-card.sc-blue { background: rgba(24,144,255,0.07); border: 1px solid rgba(24,144,255,0.18); }
.rdps-icon { font-size: 28px; opacity: 0.85; }
.rdp-stat-card.sc-ok .rdps-icon { color: #52C41A; }
.rdp-stat-card.sc-warn .rdps-icon { color: #FAAD14; }
.rdp-stat-card.sc-bad .rdps-icon { color: #FF4D4F; }
.rdp-stat-card.sc-blue .rdps-icon { color: #1890FF; }
.rdps-body { display: flex; flex-direction: column; }
.rdps-label { font-size: 11px; color: #5A7A92; }
.rdps-value { font-size: 28px; font-weight: 800; line-height: 1.2; }

/* ========== AI 分析摘要 ========== */
.rdp-ai-section {
  margin: 14px 20px; padding: 22px 24px;
  background: #080f1a; border-radius: 12px; border: 1px solid #152238;
}
.rdpas-h3 { font-size: 15px; font-weight: 700; color: #E0ECF8; margin: 0 0 16px; display: flex; align-items: center; }

/* 分数行 */
.rdpas-score-row { display: flex; gap: 24px; margin-bottom: 20px; align-items: center; }
.score-ring-wrap { width: 110px; height: 110px; flex-shrink: 0; }
.score-ring-svg { width: 100%; height: 100%; }
.score-right { flex: 1; }
.sr-main { font-size: 15px; font-weight: 700; color: #E0ECF8; margin-bottom: 6px; }
.sr-main b { color: #52C41A; }
.sr-desc { font-size: 12.5px; color: #8BAAC0; line-height: 1.6; margin: 0; }

/* 要点列表 */
.rdpas-points { display: flex; flex-direction: column; gap: 10px; }
.pt-item { display: flex; gap: 10px; align-items: flex-start; }
.pt-icon {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
  margin-top: 1px;
}
.pt-icon.warn { background: rgba(250,173,20,0.12); color: #FAAD14; }
.pt-icon.info { background: rgba(24,144,255,0.12); color: #1890FF; }
.pt-icon.ok { background: rgba(82,196,26,0.12); color: #52C41A; }
.pt-bad { background: rgba(255,77,79,0.12); color: #FF4D4F; }
.pt-body b { font-size: 13px; color: #E0ECF8; display: block; margin-bottom: 2px; }
.pt-body p { font-size: 12px; color: #8BAAC0; line-height: 1.55; margin: 0; }

/* ========== 各系统检查表 ========== */
.rdp-systems-section { margin: 14px 20px; display: flex; flex-direction: column; gap: 8px; }
.rdp-sys-card {
  background: #080f1a; border-radius: 10px; overflow: hidden;
  border: 1px solid #111e34; transition: border-color 0.15s;
}
.rdp-sys-card.sys-warn { border-color: rgba(250,173,20,0.25); }
.rdp-sys-card.sys-bad { border-color: rgba(255,77,79,0.25); }
.rdp-sys-card:hover { border-color: #243B58; }

.rdpsc-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px; cursor: pointer; user-select: none;
  transition: background 0.12s;
}
.rdpsc-head:hover { background: #0c1420; }
.rdpsc-icon { font-size: 20px; }
.rdpsc-name { flex: 1; font-size: 14px; font-weight: 700; color: #E0ECF8; }
.rdpsc-status { font-size: 10px; padding: 2px 10px; border-radius: 4px; font-weight: 700; }
.sts-ok { background: rgba(82,196,26,0.12); color: #52C41A; }
.sts-warn { background: rgba(250,173,20,0.12); color: #FAAD14; }
.sts-bad { background: rgba(255,77,79,0.12); color: #FF4D4F; }
.rdpsc-arrow { color: #4A6A8A; font-size: 18px; }

/* 表格 */
.rdpsc-table-wrap { border-top: 1px solid #111e34; overflow-x: auto; }
.rdpsc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.rdpsc-table th {
  background: #0a1020; color: #4A6A8A; font-size: 10px; font-weight: 700;
  text-align: left; padding: 10px 14px; border-bottom: 1px solid #162940;
  white-space: nowrap;
}
.rdpsc-table td {
  padding: 10px 14px; border-bottom: 1px solid #0c1320; color: #B0C4D8;
  white-space: nowrap;
}
.rdpsc-table .unit { color: #4A6A8A; font-size: 10px; margin-left: 2px; }
.val-col { color: #E0ECF8; font-weight: 600; }
.range-col { color: #5A7A92; }
.status-pill {
  font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 4px;
}
.sp-ok { color: #52C41A; background: rgba(82,196,26,0.1); }
.sp-warn { color: #FAAD14; background: rgba(250,173,20,0.1); }
.sp-bad { color: #FF4D4F; background: rgba(255,77,79,0.1); }
.remark-col.warn { color: #FAAD14; }

/* ========== 底部 ========== */
.rdp-footer {
  margin: 20px 20px 0; padding: 16px 0;
  border-top: 1px solid #162940;
  font-size: 10px; color: #3A5A7A; line-height: 1.7; text-align: center;
}
</style>
