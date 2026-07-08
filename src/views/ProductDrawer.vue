<template>
  <div class="product-drawer" v-if="event">
    <!-- Header: 返回 + 4 段阶段进度条 -->
    <div class="drawer-header">
      <button class="back-btn" @click="handleBack">← 返回列表</button>
      <div class="stage-progress">
        <div
          v-for="(s, idx) in displayStages"
          :key="s.key"
          class="sp-item"
          :class="{
            done: idx < currentDisplayIdx,
            active: idx === currentDisplayIdx,
            pending: idx > currentDisplayIdx
          }"
        >
          <span class="sp-dot">{{ idx < currentDisplayIdx ? '✓' : (idx + 1) }}</span>
          <span class="sp-label">{{ s.label }}</span>
          <span v-if="idx < displayStages.length - 1" class="sp-line"></span>
        </div>
      </div>
    </div>

    <div class="drawer-body">
      <!-- ========== 产物卡片列表 ========== -->
      <!-- 4 份产物：AI 初步分析 / 排查方案 / 维修方案 / 维修报告 -->
      <!-- 阶段推进：上一份产物收成 ▶ 摘要，新产物展开 + 流式 -->

      <!-- 🧠 AI 初步分析 -->
      <section
        v-if="visibleSections.ai"
        class="prod-card"
        :class="{
          'card-current': currentSection === 'ai',
          'card-collapsed': !aiExpanded
        }"
      >
        <header class="prod-head" @click="aiExpanded = !aiExpanded">
          <span class="prod-icon">🧠</span>
          <div class="prod-titles">
            <div class="prod-title">
              AI 初步分析
              <span v-if="currentSection === 'ai' && streaming.section === 'ai'" class="prod-gen">生成中</span>
            </div>
            <div class="prod-sub">基于事件快照 / 趋势 / 历史案例的智能诊断</div>
          </div>
          <span class="prod-toggle">{{ aiExpanded ? '▼' : '▶' }}</span>
        </header>

        <div v-show="aiExpanded" class="prod-body">
          <!-- ① 结论与建议（主要 · 默认展开） -->
          <div class="block">
            <div class="sub-head" @click="aiSubs.conclusion = !aiSubs.conclusion">
              <div class="block-title">结论与建议</div>
              <span class="sub-toggle">{{ aiSubs.conclusion ? '▼' : '▶' }}</span>
            </div>
            <div v-show="aiSubs.conclusion">
              <div class="verdict">
                <div class="verdict-row"><span class="verdict-label">判定结论</span></div>
                <div class="verdict-text">{{ product.ai.verdict }}</div>
              </div>
              <div class="data-line"><span class="data-label">数据：</span>{{ product.ai.dataLine }}</div>
              <div class="advice-line"><span class="advice-label">建议：</span>{{ product.ai.advice }}</div>
            </div>
          </div>

          <!-- ② 数据分析（主要 · 默认展开）—— 传感器卡片 + 趋势图 -->
          <div class="block">
            <div class="sub-head" @click="aiSubs.data = !aiSubs.data">
              <div class="block-title">数据分析</div>
              <span class="sub-toggle">{{ aiSubs.data ? '▼' : '▶' }}</span>
            </div>
            <div v-show="aiSubs.data">
              <!-- 传感器卡片横向排列 -->
              <div class="sensor-cards-row">
                <div
                  v-for="(s, i) in event.snapshot?.sensors || []"
                  :key="i"
                  class="sensor-card-h"
                  :class="{
                    'sc-selected': selectedSensorIndex === i,
                    'sc-over': s.status === 'over',
                    'sc-warning': s.status === 'warning'
                  }"
                  @click="selectedSensorIndex = i"
                >
                  <div class="sc-header">
                    <span class="sc-name">{{ s.name }}</span>
                    <span v-if="s.tag" class="sc-tag">{{ s.tag }}</span>
                    <span v-if="selectedSensorIndex === i" class="sc-dot"></span>
                  </div>
                  <div class="sc-meta">{{ s.sampleCount }}个采样点{{ s.trendHours ? '·' + s.trendHours : '' }}</div>
                  <div class="sc-history">{{ s.historyDesc }}</div>
                  <div class="sc-status" :class="'st-' + s.status">{{ s.statusDesc }}</div>
                </div>
              </div>
              <!-- 趋势图（跟随选中传感器） -->
              <div class="trend-chart-area">
                <div class="trend-chart-header">
                  <span class="tch-title">📈 {{ selectedSensor?.name || '—' }}</span>
                  <span class="tch-hint">点击上方卡片切换趋势图</span>
                </div>
                <div v-if="!trendLoaded" class="trend-skeleton-lg">
                  <div class="trend-skel-pulse"></div>
                  <span class="trend-skel-text">正在加载趋势数据…</span>
                </div>
                <svg v-else-if="currentTrendPoints" class="trend-svg-lg" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet">
                  <!-- 网格线 -->
                  <line v-for="y in 5" :key="'g'+y" :x1="60" :y1="20 + (y-1)*36" :x2="780" :y2="20 + (y-1)*36" stroke="var(--border-secondary)" stroke-width="0.5" />
                  <!-- 数据折线 -->
                  <polyline :points="currentTrendPoints" fill="none" :stroke="trendColor" stroke-width="2.5" />
                  <!-- 面积填充 -->
                  <polygon :points="trendAreaPoints" :fill="trendColor" opacity="0.08" />
                </svg>
              </div>
            </div>
          </div>

          <!-- ③ 工程机理分析（次要 · 默认收起） -->
          <div class="block">
            <div class="sub-head" @click="aiSubs.mechanism = !aiSubs.mechanism">
              <div class="block-title">工程机理分析</div>
              <span class="sub-toggle">{{ aiSubs.mechanism ? '▼' : '▶' }}</span>
            </div>
            <div v-show="aiSubs.mechanism">
              <div class="mechanism">
                <div class="mech-label">本次诊断：</div>
                <div class="mech-text">{{ product.ai.mechanism }}</div>
              </div>
              <div class="fault-match">
                <div class="fm-row fm-head"><span class="fm-name">候选故障</span><span class="fm-match">匹配度</span></div>
                <div v-for="(f, i) in product.ai.faultMatch" :key="i" class="fm-row">
                  <span class="fm-name">{{ f.name }}</span>
                  <span class="fm-bar">
                    <span class="fm-bar-fill" :style="{ width: f.match + '%', background: f.color }"></span>
                    <span class="fm-bar-text">{{ f.match }}%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- ④ 可能的原因与后果（次要 · 默认收起） -->
          <div class="block">
            <div class="sub-head" @click="aiSubs.reasons = !aiSubs.reasons">
              <div class="block-title">可能的原因与后果</div>
              <span class="sub-toggle">{{ aiSubs.reasons ? '▼' : '▶' }}</span>
            </div>
            <div v-show="aiSubs.reasons">
              <div class="reason-table">
                <div class="rt-row rt-head"><span class="rt-col rt-fault">候选故障</span><span class="rt-col rt-cause">可能原因</span><span class="rt-col rt-effect">直接后果</span></div>
                <div v-for="(r, i) in product.ai.reasons" :key="i" class="rt-row">
                  <span class="rt-col rt-fault"><span class="rt-prob" :class="r.prob">{{ r.probLabel }}</span>{{ r.fault }}</span>
                  <span class="rt-col rt-cause">{{ r.cause }}</span>
                  <span class="rt-col rt-effect">{{ r.effect }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 流式进行中提示 -->
          <div v-if="currentSection === 'ai' && streaming.section === 'ai'" class="stream-tip">
            <span class="cursor-blink">▍</span> AI 正在生成分析…
          </div>
        </div>
      </section>

      <!-- ============================================= -->
      <!-- 🔍 排查-维修 顺序配对（T1→R1→T2→R2→T3→R3→T4→R4） -->
      <!-- ============================================= -->
      <template v-for="(item, idx) in (product.check?.checkItems || [])" :key="'pair-' + idx">
        <!-- 排查项卡片 -->
        <section
          v-if="isCheckVisible(idx)"
          :id="'check-card-' + idx"
          class="prod-card"
          :class="{ 'card-collapsed': !checkCardsExpanded[idx] }"
        >
          <header class="prod-head" @click="checkCardsExpanded[idx] = !checkCardsExpanded[idx]">
            <span class="prod-icon">🔍</span>
            <div class="prod-titles">
              <div class="prod-title">排查项 · {{ cleanTitle(item.title) }}</div>
              <div class="prod-sub">{{ item.target || ('针对' + cleanTitle(item.title) + '的标准排查流程') }}</div>
            </div>
            <span class="prod-status" :class="checkItemStatusClass(item)">{{ checkItemStatusText(item) }}</span>
            <span class="prod-toggle">{{ checkCardsExpanded[idx] !== false ? '▼' : '▶' }}</span>
          </header>
          <div v-show="checkCardsExpanded[idx] !== false" class="prod-body">
            <div class="ci-warning"><span class="ci-warning-label">注意事项：</span><span>{{ item.warning }}</span></div>
            <div class="ci-steps-label">排查步骤与反馈：</div>
            <div v-for="(step, si) in item.steps" :key="si" class="ci-step">
              <div class="ci-step-num">{{ si + 1 }}. {{ step.title }}</div>
              <ul class="ci-step-details">
                <li v-for="(d, di) in step.details" :key="di" class="ci-detail-row" :class="{ 'ci-detail-with-feedback': item.status === 'active' && getDetailFeedbackItem(item, si, di) }">
                  <span class="ci-detail-text">{{ d }}</span>
                  <span v-if="item.status === 'active' && getDetailFeedbackItem(item, si, di)" class="ci-detail-feedback">
                    <label v-for="(opt, oi) in getDetailFeedbackItem(item, si, di).options" :key="oi" class="ci-inline-opt">
                      <input type="radio" :name="'check-' + idx + '-' + si + '-' + di" v-model="getDetailFeedbackItem(item, si, di).selected" :value="oi" />
                      <span>{{ opt }}</span>
                    </label>
                  </span>
                </li>
              </ul>
              <div class="ci-step-diagram">[可能有示意图]</div>
            </div>
            <div v-if="item.status === 'active'" :id="'check-feedback-' + idx" class="ci-inline-note">
              <div class="ci-inline-note-label">现场备注</div>
              <textarea v-model="item.feedbackNotes" class="ci-inline-textarea" placeholder="边查边记录现场现象、读数、照片编号等，可为空"></textarea>
            </div>
            <div v-if="item.feedback && item.feedback.length" class="ci-feedback-summary">
              <div class="ci-summary-label">登记反馈摘要</div>
              <div v-for="(f, fi) in item.feedback" :key="fi" class="ci-feedback-row">
                <span>{{ f.item }} → </span>
                <span :class="f.status === 'abnormal' ? 'ci-f-abnormal' : 'ci-f-normal'">{{ f.display }}</span>
              </div>
              <div v-if="item.notes" class="ci-notes">备注：{{ item.notes }}</div>
            </div>
            <!-- 操作按钮：仅 active 时显示 -->
            <div v-if="item.status === 'active'" class="ci-actions">
              <button class="ci-action-btn ci-action-feedback" @click.stop="submitInlineFeedback(idx)">提交排查结果</button>
            </div>
          </div>
        </section>

        <!-- 维修项卡片（反馈异常后才展示） -->
        <section
          v-if="item.repair && item.status === 'done-abnormal'"
          :id="'repair-card-' + idx"
          class="prod-card repair-card-section"
        >
          <header class="prod-head" @click="repairCardsExpanded[idx] = !repairCardsExpanded[idx]">
            <span class="prod-icon">🔧</span>
            <div class="prod-titles">
              <div class="prod-title">维修项 · {{ cleanTitle(item.title) }}</div>
              <div class="prod-sub">注意事项 / 维修步骤 / 备件清单 / 验收标准</div>
            </div>
            <span class="prod-status" :class="repairItemStatusClass(item)">{{ repairItemStatusText(item) }}</span>
            <span class="prod-toggle">{{ repairCardsExpanded[idx] !== false ? '▼' : '▶' }}</span>
          </header>
          <div v-show="repairCardsExpanded[idx] !== false" class="prod-body">
            <div class="block">
              <div class="block-title">注意事项</div>
              <ul class="repair-list"><li v-for="(w, wi) in item.repair.safety" :key="wi">{{ w }}</li></ul>
            </div>
            <div class="block">
              <div class="block-title">维修步骤</div>
              <ol class="repair-steps"><li v-for="(s, si) in item.repair.steps" :key="si">{{ s }}</li></ol>
            </div>
            <div class="block">
              <div class="block-title">备件清单</div>
              <div class="repair-parts">{{ item.repair.parts.join(' / ') }}</div>
            </div>
            <div class="block accept-inline">
              <div class="block-title">验收标准</div>
              <div class="repair-accept-text">{{ item.repair.acceptance }}</div>
            </div>
            <div v-if="item.repaired === undefined" class="repair-actions">
              <button class="ra-btn ra-resolved" @click="markItemRepaired(idx)">解决了，验收通过</button>
              <button class="ra-btn ra-continue" @click="markItemNotFixed(idx)">没解决，继续排查</button>
            </div>
          </div>
        </section>
      </template>


      <!-- 全部排查完成 → 事件小结 -->
      <template v-if="allChecksDone && !hasActiveRepair">
        <div class="pair-divider"></div>
      </template>

      <!-- ✅ 事件记录 -->
      <section
        v-if="showReportCard || currentStage === 'S5'"
        id="event-record-card"
        class="prod-card"
        :class="{ 'card-collapsed': !reportExpanded }"
      >
        <header class="prod-head" @click="reportExpanded = !reportExpanded">
          <span class="prod-icon">✅</span>
          <div class="prod-titles">
            <div class="prod-title">事件记录</div>
            <div class="prod-sub">本事件处理过程 · 共耗时 {{ product.report.elapsed }}</div>
          </div>
          <span class="prod-toggle">{{ reportExpanded ? '▼' : '▶' }}</span>
        </header>

        <div v-show="reportExpanded" class="prod-body">
          <div class="report-summary">
            <div class="report-banner" :class="{ 'banner-needs-manual': needsManualClose, 'banner-false-alarm': isFalseAlarm }">
              <div class="report-banner-icon">{{ needsManualClose ? '!' : isFalseAlarm ? 'ℹ' : '✓' }}</div>
              <div class="report-banner-text">{{ needsManualClose ? '全部排查已完成，仍需手动处理' : isFalseAlarm ? '已标记为误报' : '维修完成 · 验收通过' }}</div>
            </div>
            <div class="report-stat-grid">
              <div class="rs-item">
                <div class="rs-label">维修结果</div>
                <div class="rs-value" :class="{ success: !needsManualClose && !isFalseAlarm, warning: needsManualClose, muted: isFalseAlarm }">{{ needsManualClose ? '未解决' : isFalseAlarm ? '误报' : '已修复' }}</div>
              </div>
              <div class="rs-item">
                <div class="rs-label">开始时间</div>
                <div class="rs-value">{{ formatTime(event.createdAt) }}</div>
              </div>
              <div class="rs-item">
                <div class="rs-label">完成时间</div>
                <div class="rs-value">{{ formatTime(new Date().toISOString()) }}</div>
              </div>
              <div class="rs-item">
                <div class="rs-label">处理人</div>
                <div class="rs-value">当前用户</div>
              </div>
            </div>
            <div class="report-key">
              <div class="rk-row">
                <span class="rk-label">故障根因</span>
                <span class="rk-text">{{ product.report.rootCause }}</span>
              </div>
              <div class="rk-row">
                <span class="rk-label">维修内容</span>
                <span class="rk-text">{{ product.report.workDone }}</span>
              </div>
              <div class="rk-row">
                <span class="rk-label">关键验收</span>
                <span class="rk-text">{{ product.report.keyAccept }}</span>
              </div>
              <div class="rk-row">
                <span class="rk-label">遗留建议</span>
                <span class="rk-text">{{ product.report.followup }}</span>
              </div>
            </div>
            <div v-if="manualFeedback" class="report-key" style="margin-top:10px">
              <div class="rk-row">
                <span class="rk-label">手动反馈</span>
                <span class="rk-text">{{ manualFeedback }}</span>
              </div>
            </div>
            <div v-if="event.timeline && event.timeline.length" class="report-timeline">
              <div class="rtl-title">📋 处理时间线</div>
              <div class="timeline-list">
                <div v-for="(t, i) in event.timeline" :key="i" class="tl-row">
                  <div class="tl-time-col">{{ formatTime(t.time) }}</div>
                  <div class="tl-dot-col"><span class="tl-dot-report" :class="{ first: i === 0, last: i === event.timeline.length - 1 }"></span></div>
                  <div class="tl-action-col">{{ t.action }}</div>
                </div>
              </div>
            </div>
            <div class="report-footer">本报告由系统自动生成 · 维修完成后写入 · 仅供运维归档</div>
          </div>
          <!-- 按钮已移至右侧助手对话 -->
        </div>
      </section>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, reactive, onUnmounted } from 'vue'

const props = defineProps({
  event: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['back'])

// ============ 阶段定义（外显 3 段：AI分析 / 处理中 / 已完成）============
// 内部仍是 4 个折叠产物：AI分析 → 排查方案 → 维修方案 → 事件小结
const displayStages = [
  { key: 'ai', label: 'AI分析' },
  { key: 'mid', label: '处理中' },
  { key: 'done', label: '已完成' }
]

const currentDisplayIdx = computed(() => {
  if (currentStage.value === 'S1') return 0
  if (currentStage.value === 'S2' || currentStage.value === 'S4') return 1
  return 2
})

// 阶段 → 主产物（4 个折叠面板的内部映射）
const sectionMap = {
  S1: 'ai',
  S2: 'check',
  S4: 'repair',
  S5: 'report'
}

const eventStage = inject('eventStage', reactive({}))
const eventAssistantAction = inject('eventAssistantAction', reactive({}))
const eventAssistantCommand = inject('eventAssistantCommand', reactive({}))

const currentStage = computed(() => eventStage[props.event?.id] || 'S1')
const currentSection = computed(() => sectionMap[currentStage.value])

// 各产物可见性（AI 分析 + 排查-维修对 + 事件小结）
const visibleSections = computed(() => ({
  ai: currentDisplayIdx.value >= 0
}))

// ============ 折叠状态 ============
const aiExpanded = ref(true)
const reportExpanded = ref(false)
const showReportCard = ref(false)
const needsManualClose = ref(false)
const isFalseAlarm = ref(false)
const manualFeedback = ref('')

function scrollIntoCard(id, delay = 50) {
  setTimeout(() => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, delay)
}

// 维修卡片展开状态
const repairCardsExpanded = reactive({})
// 排查卡片展开状态
const checkCardsExpanded = reactive({})

// 标题清理：去掉"排查"后缀
function cleanTitle(title) {
  return (title || '').replace(/排查$/, '')
}

// ============ 排查-维修 顺序配对逻辑 ============
function isCheckVisible(idx) {
  // 误报 → 不再展示排查卡
  if (isFalseAlarm.value) return false
  if (currentStage.value === 'S1') return false
  const items = product.value?.check?.checkItems || []
  if (idx === 0) return true
  const prev = items[idx - 1]
  if (!prev) return false
  // 正常 → 下一项可见
  if (prev.status === 'done-normal') return true
  // 异常且点了"没解决"(repaired===false) → 下一项可见
  if (prev.status === 'done-abnormal' && prev.repaired === false) return true
  return false
}

function checkItemStatusClass(item) {
  if (item.status === 'done-normal') return 'done'
  if (item.status === 'done-abnormal' && item.repaired) return 'done'
  if (item.status === 'done-abnormal') return 'abnormal'
  if (item.status === 'active') return 'active'
  return 'pending'
}

function checkItemStatusText(item) {
  if (item.status === 'done-normal') return '✓ 正常'
  if (item.status === 'done-abnormal' && item.repaired) return '✓ 已修复'
  if (item.status === 'done-abnormal') return '⚠ 异常'
  if (item.status === 'active') return '进行中'
  return ''
}

function repairItemStatusClass(item) {
  if (item.repaired === true) return 'done'
  if (item.repaired === false) return 'abnormal'
  return ''
}

function repairItemStatusText(item) {
  if (item.repaired === true) return '✓ 已解决'
  if (item.repaired === false) return '⚠ 未解决'
  return ''
}

const allChecksDone = computed(() => {
  const items = product.value?.check?.checkItems || []
  return items.length > 0 && items.every(i => i.status === 'done-normal' || i.status === 'done-abnormal')
})

const hasActiveRepair = computed(() => {
  const items = product.value?.check?.checkItems || []
  return items.some(i => i.status === 'done-abnormal' && i.repaired === undefined)
})

// 所有卡片已打光，且异常项全部未解决 → 才需要手动登记
const allRepairsExhausted = computed(() => {
  if (!allChecksDone.value) return false
  if (hasActiveRepair.value) return false
  const items = product.value?.check?.checkItems || []
  const abnormalItems = items.filter(i => i.status === 'done-abnormal')
  if (abnormalItems.length === 0) return false
  return abnormalItems.every(i => i.repaired === false)
})

// 全部排查正常（无异常项）
const allChecksNormal = computed(() => {
  if (!allChecksDone.value) return false
  const items = product.value?.check?.checkItems || []
  return items.length > 0 && items.every(i => i.status === 'done-normal')
})

// 是否全部排查已走完（S5阶段展示事件小结）
const shouldShowReport = computed(() => currentStage.value === 'S5')

// ============ 排查项卡片交互（产物区操作按钮）============
const feedbackModal = reactive({
  open: false,
  currentIdx: -1,
  items: [],
  notes: ''
})

// 反馈项配置：按具体步骤明细行挂载，判断类明细才展示选项
const feedbackConfig = {
  0: [
    { stepIdx: 0, detailIdx: 0, name: '油箱焊缝渗漏', options: ['无渗漏油渍', '有湿润痕迹', '有明显渗漏'] },
    { stepIdx: 0, detailIdx: 1, name: '放油堵状态', options: ['无湿润痕迹', '有湿润痕迹', '有滴漏'] },
    { stepIdx: 0, detailIdx: 2, name: '液位计读数', options: ['读数一致', '读数不一致', '远程值异常'] },
    { stepIdx: 0, detailIdx: 3, name: '连通阀状态', options: ['全开', '未全开', '卡滞'] },
    { stepIdx: 2, detailIdx: 0, name: '法兰接头油渍', options: ['无油渍', '有油渍', '持续渗油'] },
    { stepIdx: 2, detailIdx: 1, name: '软管段状态', options: ['无异常', '鼓包/老化', '龟裂/渗油'] },
    { stepIdx: 2, detailIdx: 2, name: '支架/卡箍磨损', options: ['无磨损', '有磨损', '固定松动'] },
    { stepIdx: 2, detailIdx: 3, name: '应力部位湿润', options: ['无湿润', '有湿润', '有渗油'] }
  ],
  1: [
    { stepIdx: 0, detailIdx: 0, name: '滤器堵塞', options: ['无堵塞', '轻微堵塞', '严重堵塞'] },
    { stepIdx: 0, detailIdx: 1, name: '杂质沉积量', options: ['少量/正常', '较多', '大量堆积'] },
    { stepIdx: 0, detailIdx: 2, name: '通流面积', options: ['基本正常', '轻度减少', '明显减少'] },
    { stepIdx: 0, detailIdx: 3, name: '滤网骨架', options: ['无变形破损', '轻微变形', '破损需更换'] },
    { stepIdx: 1, detailIdx: 0, name: '额定流量负压', options: ['正常记录', '偏高', '超过处置值'] },
    { stepIdx: 1, detailIdx: 1, name: '历史基准对比', options: ['接近基准', '高于基准', '明显异常'] },
    { stepIdx: 1, detailIdx: 2, name: '负压趋势', options: ['趋势平稳', '异常升高', '波动明显'] },
    { stepIdx: 2, detailIdx: 1, name: '底部油液状态', options: ['无异常', '有水分', '有絮状物'] },
    { stepIdx: 2, detailIdx: 2, name: '铁磁性颗粒', options: ['未见金属屑', '少量金属屑', '明显金属屑'] }
  ],
  2: [
    { stepIdx: 0, detailIdx: 0, name: '参照校验', options: ['读数一致', '轻微偏差', '明显偏差'] },
    { stepIdx: 0, detailIdx: 1, name: '读数偏差', options: ['偏差可接受', '偏差偏大', '偏差失准'] },
    { stepIdx: 0, detailIdx: 2, name: '供电回路', options: ['正常稳定', '电压波动', '供电异常'] },
    { stepIdx: 0, detailIdx: 3, name: '信号回路', options: ['无异常', '接地异常', '短路异常'] },
    { stepIdx: 1, detailIdx: 0, name: '屏蔽接地', options: ['正常可靠', '接地不良', '屏蔽层破损'] },
    { stepIdx: 1, detailIdx: 1, name: '大功率设备干扰', options: ['未见干扰', '偶发干扰', '明显干扰'] },
    { stepIdx: 1, detailIdx: 2, name: '信号噪声', options: ['无高频噪声', '偶发噪声', '持续噪声'] },
    { stepIdx: 1, detailIdx: 3, name: '安装支架', options: ['无松动', '轻微松动', '振动明显'] }
  ],
  3: [
    { stepIdx: 0, detailIdx: 0, name: '接头/焊缝油渍', options: ['无油渍', '有湿润痕迹', '有明显渗漏'] },
    { stepIdx: 0, detailIdx: 1, name: '应力集中部位', options: ['无异常', '有湿润', '有裂纹/渗漏'] },
    { stepIdx: 0, detailIdx: 2, name: '支架磨损渗漏', options: ['无磨损', '有磨损痕迹', '磨损伴随渗漏'] },
    { stepIdx: 0, detailIdx: 3, name: '法兰垫片湿润', options: ['无异常', '湿润', '渗油'] },
    { stepIdx: 1, detailIdx: 0, name: '液压缸外泄漏', options: ['无外泄漏', '轻微渗油', '明显外泄漏'] },
    { stepIdx: 1, detailIdx: 1, name: '马达轴封渗油', options: ['无渗油', '轻微渗油', '明显渗油'] },
    { stepIdx: 1, detailIdx: 2, name: '执行机构动作', options: ['动作平稳', '轻微爬行', '卡滞/冲击'] },
    { stepIdx: 1, detailIdx: 3, name: '端盖温度', options: ['正常记录', '偏高', '异常升温'] }
  ]
}

function createFeedbackDraft(idx) {
  return (feedbackConfig[idx] || []).map(c => ({ ...c, selected: 0 }))
}

function ensureFeedbackDraft(item, idx) {
  if (!item.feedbackDraft || !item.feedbackDraft.length) {
    item.feedbackDraft = createFeedbackDraft(idx)
  }
  if (item.feedbackNotes === undefined) item.feedbackNotes = ''
  return item.feedbackDraft
}

function getDetailFeedbackItem(item, stepIdx, detailIdx) {
  const idx = product.value?.check?.checkItems?.indexOf(item) ?? -1
  const draft = ensureFeedbackDraft(item, idx)
  return draft.find(f => f.stepIdx === stepIdx && f.detailIdx === detailIdx)
}

function isFeedbackOptionAbnormal(feedbackItem) {
  return Number(feedbackItem?.selected || 0) !== 0
}

function openFeedbackModal(idx) {
  const item = product.value?.check?.checkItems?.[idx]
  if (!item) return
  ensureFeedbackDraft(item, idx)
  checkCardsExpanded[idx] = true
  scrollIntoCard('check-feedback-' + idx)
}

function closeFeedbackModal() {
  feedbackModal.open = false
  feedbackModal.currentIdx = -1
}

function handleImageUpload(e) {
  const files = Array.from(e.target.files || [])
  feedbackModal.images = files.map(f => ({ name: f.name, size: f.size }))
}

function markNormal(idx) {
  const items = product.value?.check?.checkItems
  if (!items || !items[idx]) return
  const draft = ensureFeedbackDraft(items[idx], idx)
  draft.forEach(f => { f.selected = 0 })
  items[idx].feedbackNotes = ''
  submitInlineFeedback(idx)
}

function submitFeedback() {
  if (feedbackModal.currentIdx < 0) return
  submitInlineFeedback(feedbackModal.currentIdx)
}

function submitInlineFeedback(idx) {
  const items = product.value?.check?.checkItems
  if (!items || !items[idx]) return
  const item = items[idx]
  const draft = ensureFeedbackDraft(item, idx)

  const hasAbnormal = draft.some(f => isFeedbackOptionAbnormal(f))

  item.status = hasAbnormal ? 'done-abnormal' : 'done-normal'
  item.feedback = draft.map(f => ({
    item: f.name,
    selectedIdx: f.selected,
    display: f.options[f.selected],
    status: isFeedbackOptionAbnormal(f) ? 'abnormal' : 'normal'
  }))
  item.notes = item.feedbackNotes || ''

  closeFeedbackModal()

  // 异常项：折叠当前排查卡片，展开对应维修卡片
  if (hasAbnormal) {
    checkCardsExpanded[idx] = false
    repairCardsExpanded[idx] = true
    scrollIntoCard('repair-card-' + idx)
    if (props.event) {
      eventStage[props.event.id] = 'S4'
      eventAssistantAction[props.event.id] = 'check_abnormal_' + idx
    }
    return
  }

  // 正常项：折叠当前排查卡片，激活下一项
  checkCardsExpanded[idx] = false
  if (idx + 1 < items.length && items[idx + 1].status === 'pending') {
    items[idx + 1].status = 'active'
    ensureFeedbackDraft(items[idx + 1], idx + 1)
    checkCardsExpanded[idx + 1] = true
    scrollIntoCard('check-card-' + (idx + 1))
    // 通知助手
    eventAssistantAction[props.event.id] = 'check_normal_' + idx + '|' + (idx + 1)
  }

  // 全部完成检查
  checkAllDone()
}

function checkAllDone() {
  if (!props.event) return
  const items = product.value?.check?.checkItems
  if (!items) return
  const done = items.filter(i => i.status === 'done-normal' || i.status === 'done-abnormal').length
  if (done === items.length) {
    const hasActive = items.some(i => i.status === 'done-abnormal' && i.repaired === undefined)
    if (hasActive) {
      eventStage[props.event.id] = 'S4'
    }
    // 全部正常/全部已解决/全部未解决 → 由 allChecksNormal / allRepairsExhausted watch 处理
  }
}

function markItemRepaired(idx) {
  if (!props.event) return
  const items = product.value?.check?.checkItems
  if (!items || !items[idx]) return
  items[idx].repaired = true
  repairCardsExpanded[idx] = false
  // 激活事件记录卡并展开
  showReportCard.value = true
  reportExpanded.value = true
  scrollIntoCard('event-record-card')
  // 通知助手：维修已解决
  eventAssistantAction[props.event.id] = 'repair_solved'
}

function markItemNotFixed(idx) {
  if (!props.event) return
  const items = product.value?.check?.checkItems
  if (!items || !items[idx]) return
  items[idx].repaired = false
  repairCardsExpanded[idx] = false
  // 激活下一个排查项
  if (idx + 1 < items.length && items[idx + 1].status === 'pending') {
    items[idx + 1].status = 'active'
    ensureFeedbackDraft(items[idx + 1], idx + 1)
    checkCardsExpanded[idx + 1] = true
    scrollIntoCard('check-card-' + (idx + 1))
    // 通知助手
    eventAssistantAction[props.event.id] = 'repair_not_fixed_' + idx + '|' + (idx + 1)
  }
}

// AI 子模块展开状态（主要默认展开，次要默认收起）
const aiSubs = reactive({
  conclusion: true,   // 结论与建议 - 主要
  data: true,         // 数据分析 - 主要
  mechanism: false,   // 工程机理分析 - 次要
  reasons: false,     // 可能原因与后果 - 次要
})

// 选中的传感器索引（用于切换趋势图）
const selectedSensorIndex = ref(0)
const trendLoaded = ref(false)

// ============ 子模块渐进展示 ============
// 钥匙：assistant 动作 → 解锁 sub-section
const revealedSubs = reactive({
  ai_conclusion: false,   // 结论与建议
  ai_data: false,         // 数据分析（指标卡）
  ai_trend: false,        // 趋势图
  ai_trend_loaded: false, // 趋势图加载完成
  ai_mechanism: false,    // 工程机理分析
  ai_reasons: false,      // 可能原因
  check_warn: false,      // 排查-注意事项
  check_steps: false,     // 排查-步骤
  repair_recap: false,    // 维修-前情
  repair_flows: false,    // 维修-流程
  repair_accept: false,   // 维修-验收
  report_content: false   // 报告内容
})

function resetSubs() {
  Object.keys(revealedSubs).forEach(k => { revealedSubs[k] = false })
}

// 延迟展现某个 sub（模拟异步加载）
function revealSub(key, delay = 0) {
  if (delay) {
    setTimeout(() => { revealedSubs[key] = true }, delay)
  } else {
    revealedSubs[key] = true
  }
}

function revealSubsSequence(keys, baseDelay = 150, stagger = 100) {
  keys.forEach((k, i) => {
    setTimeout(() => { revealedSubs[k] = true }, baseDelay + i * stagger)
  })
}

// ============ 流式状态（仅作为"新产物入场"的视觉提示，0.9s 闪一下后自动收尾）============
const streaming = reactive({ section: null })
let streamTimer = null
function stopStream() {
  if (streamTimer) { clearTimeout(streamTimer); streamTimer = null }
  streaming.section = null
}
// "新产物入场" 视觉脉冲：闪一下当前 section 的卡片（不真流式——样例图本身就是写完的）
function pulseInto(section, ms = 900) {
  stopStream()
  streaming.section = section
  streamTimer = setTimeout(() => {
    streaming.section = null
    streamTimer = null
  }, ms)
}

onUnmounted(() => stopStream())

// ============ 产物数据（按 eventId 缓存）============
// 每份产物包含详尽字段，按"事件名 / 系统 / 严重程度"动态适配
const productCache = reactive({})

function getOrCreateProduct(ev) {
  if (!ev) return null
  if (productCache[ev.id]) return productCache[ev.id]
  productCache[ev.id] = buildProduct(ev)
  return productCache[ev.id]
}

const product = computed(() => {
  const p = getOrCreateProduct(props.event)
  if (p) return p
  // 完整空 fallback：每个字段都是数组，避免 v-for 报 undefined is not iterable
  return {
    ai: { verdict: '', dataSnapshot: '', dataLine: '', advice: '', metrics: [], faultMatch: [], reasons: [] },
    check: { warnings: [], steps: [{ title: '', subs: [] }], checklist: [] },
    repair: { recap: '', safetyWarnings: [], flows: [{ name: '', steps: [] }], acceptance: [] },
    report: { banner: '', rows: [], conclusions: [] }
  }
})

// 选中的传感器
const selectedSensor = computed(() => {
  const sensors = props.event?.snapshot?.sensors || []
  return sensors[selectedSensorIndex.value] || sensors[0] || null
})



// 当前选中传感器的趋势数据
const currentTrendData = computed(() => {
  const sensors = props.event?.snapshot?.sensors || []
  const s = sensors[selectedSensorIndex.value]
  return s?.trendData || []
})

// 趋势图：把当前传感器的 trendData 转成 SVG 坐标点
const currentTrendPoints = computed(() => {
  const data = currentTrendData.value
  if (!data || !data.length) return ''
  const W = 800, H = 220, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 40
  const values = data.map(d => d.value)
  const minV = Math.min(...values) * 0.9
  const maxV = Math.max(...values) * 1.1
  return data.map((d, i) => {
    const x = PAD_L + (i / Math.max(data.length - 1, 1)) * (W - PAD_L - PAD_R)
    const y = PAD_T + (1 - (d.value - minV) / (maxV - minV)) * (H - PAD_T - PAD_B)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

// 面积填充多边形
const trendAreaPoints = computed(() => {
  const data = currentTrendData.value
  if (!data || !data.length) return ''
  const W = 800, H = 220, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 40
  const values = data.map(d => d.value)
  const minV = Math.min(...values) * 0.9
  const maxV = Math.max(...values) * 1.1
  const bottomY = PAD_T + (1 - (minV - minV) / (maxV - minV)) * (H - PAD_T - PAD_B)
  const linePoints = data.map((d, i) => {
    const x = PAD_L + (i / Math.max(data.length - 1, 1)) * (W - PAD_L - PAD_R)
    const y = PAD_T + (1 - (d.value - minV) / (maxV - minV)) * (H - PAD_T - PAD_B)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const firstX = PAD_L
  const lastX = PAD_L + (W - PAD_L - PAD_R)
  return [...linePoints, `${lastX.toFixed(1)},${bottomY.toFixed(1)}`, `${firstX.toFixed(1)},${bottomY.toFixed(1)}`].join(' ')
})

// 趋势线颜色（根据传感器状态）
const trendColor = computed(() => {
  const s = selectedSensor.value
  if (!s) return 'var(--accent)'
  if (s.status === 'over') return 'var(--danger)'
  if (s.status === 'warning') return 'var(--warning)'
  return 'var(--success)'
})

// ============ 详尽的产物数据生成 ============
function buildProduct(ev) {
  const title = ev.title || ''
  const sys = ev.system || '本系统'
  const priority = ev.priority || 'normal'
  const firstSensor = ev.snapshot?.sensors?.[0] || { name: '主参数', value: 0, unit: '' }

  // ========== 🧠 AI 初步分析 ==========
  const relatedNames = (ev.snapshot?.sensors || []).slice(1, 3).map(s => s.name).join('、') || '辅助参数'
  const ai = {
    verdict: `${firstSensor.name}当前为 ${firstSensor.value}${firstSensor.unit}，系统结合多项传感器实际数据与短时趋势判定本次事件需要处置。`,
    dataLine: `本次事件发生时，${firstSensor.name}为 ${firstSensor.value}${firstSensor.unit}，近 12 分钟未见回落；同时关联的${relatedNames}也出现同步偏离，需联合评估整体运行状态。`,
    advice: `建议立即按"诊断-隔离-排查-维修-验收"流程处置，优先排查与${firstSensor.name}直接耦合的回路与执行机构，避免故障扩散。`,
    metrics: (ev.snapshot?.sensors || []).slice(0, 4).map((s, idx) => ({
      name: s.name,
      trend: s.status === 'over' ? 'up' : (idx === 1 ? 'down' : 'flat'),
      trendLabel: s.status === 'over' ? '上升' : (idx === 1 ? '下降' : '稳定'),
      current: s.value,
      unit: s.unit,
      analyze: s.status === 'over'
        ? `与关联参数共同偏离，需纳入联合诊断`
        : `走势相对平稳，可作为对照参数`
    })),
    mechanism: `${sys}在工况下出现${firstSensor.name}异常，结合物理机理分析：冷却介质流量下降、换热效率降低或执行机构卡滞均可能引发类似表征；当前数据更倾向于"流量不足 + 换热下降"复合原因。`,
    faultMatch: (ev.aiAnalysis?.faultTable || []).map(f => ({
      name: f.name,
      match: f.probability === 'high' ? 82 : f.probability === 'medium' ? 56 : 28,
      color: f.probability === 'high' ? '#ff4d4f' : f.probability === 'medium' ? '#faad14' : '#52c41a'
    })),
    reasons: (ev.aiAnalysis?.faultTable || []).map(f => ({
      prob: f.probability,
      probLabel: f.probability === 'high' ? '高' : f.probability === 'medium' ? '中' : '低',
      fault: f.name,
      cause: f.detail,
      effect: f.probability === 'high' ? '如不处置，30 分钟内可能触发二级保护' : f.probability === 'medium' ? '可能影响系统长周期运行稳定性' : '短期内影响有限，但有累积恶化风险'
    }))
  }

  // ========== 🔍 排查方案 (T1-T4 匹配对话稿) ==========
  const check = {
    warnings: [
      '作业前确保停机断电，相关阀门已关闭，安全标识已挂',
      '佩戴防护用具（护目镜、防烫手套），谨防烫伤与机械伤害',
      '记录所有原始数据后再行拆装，不要直接调整关键部件，先排查原因',
      '如需进入受限空间，必须办理许可证并落实气体检测'
    ],
    steps: [
      {
        title: 'T1 · 液压系统故障排查',
        target: '排查油箱外观、管路接头、密封件、吸入口状态（6步/21关键点）',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '目视检查油箱外壁焊缝处有无渗漏油渍' },
          { tag: 'must', tagLabel: '必查', text: '检查油箱底部放油堵有无湿润痕迹' },
          { tag: 'must', tagLabel: '必查', text: '对比液位计读数与远程监控值是否一致' },
          { tag: 'must', tagLabel: '必查', text: '检查管路各接头有无油渍，软管段有无鼓包/老化/龟裂' },
          { tag: 'suggest', tagLabel: '建议', text: '使用荧光检漏剂定位微漏点并拍照标记' },
          { tag: 'suggest', tagLabel: '建议', text: '听诊泵吸入口有无气蚀噪声，检查吸入滤器压差' },
          { tag: 'test', tagLabel: '送检', text: '取样化验液压油品质（含水量/颗粒度/粘度）' }
        ]
      },
      {
        title: 'T2 · 系统或油柜吸口堵塞排查',
        target: '排查吸口滤网、负压值、沉积物、回油过滤器（4步/15关键点）',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '拆检吸口滤器有无堵塞/异物附着，记录滤网表面杂质类型' },
          { tag: 'must', tagLabel: '必查', text: '在额定流量下读取吸入侧真空表数值' },
          { tag: 'must', tagLabel: '必查', text: '打开放油旋塞取样底部油液，观察有无金属屑/水分' },
          { tag: 'suggest', tagLabel: '建议', text: '用磁铁检查铁磁性颗粒含量，评估是否需彻底清洗油箱' }
        ]
      },
      {
        title: 'T3 · 压力传感器故障排查',
        target: '排查传感器校验、供电信号回路、电磁干扰、机械安装（4步/15关键点）',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '使用标准传感器对核心监控传感器进行参照校验' },
          { tag: 'must', tagLabel: '必查', text: '检查传感器供电回路是否稳定（24V±5%）' },
          { tag: 'suggest', tagLabel: '建议', text: '排查信号回路有无接地或短路，使用示波器观察信号噪声' },
          { tag: 'suggest', tagLabel: '建议', text: '检查电缆屏蔽层接地，排查附近大功率设备干扰' }
        ]
      },
      {
        title: 'T4 · 系统管线泄漏排查',
        target: '排查高压管路、执行机构密封、控制阀内泄、油箱附件（5步/19关键点）',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '沿管路走向逐段目视检查接头、焊缝有无油渍' },
          { tag: 'must', tagLabel: '必查', text: '重点检查弯头、三通等应力集中部位，法兰密封垫片有无湿润' },
          { tag: 'must', tagLabel: '必查', text: '检查液压缸活塞杆处有无外泄漏，液压马达轴封处有无渗油' },
          { tag: 'photo', tagLabel: '拍照', text: '对每个可疑泄漏点拍照标记坐标位置，按严重程度分级' }
        ]
      }
    ],
    checkItems: [
      {
        title: '液压系统故障排查',
        warning: '检查前确认设备已停机，系统已泄压至零，操作面板挂"禁止启动"标识',
        steps: [
          { title: '检查液压油箱外观及液位计', details: ['目视检查油箱外壁焊缝处有无渗漏油渍', '检查油箱底部放油堵有无湿润痕迹', '对比液位计读数与远程监控值是否一致', '检查液位计上下连通阀是否处于全开位置'] },
          { title: '记录当前油位和油温初始数据', details: ['拍照记录液位计当前读数', '记录液压油温度（正常范围40~70℃）', '读取系统压力表稳态值（正常16~21MPa）', '记录电机运行电流'] },
          { title: '目视检查管路各接头及软管段', details: ['重点检查高压管路法兰接头有无油渍', '检查软管段有无鼓包/老化/龟裂/渗油', '检查管路支架/卡箍处有无摩擦磨损痕迹', '检查弯头、三通等应力集中部位有无湿润'] },
          { title: '使用荧光检漏剂定位微漏点', details: ['在油液中按规定比例加入紫外荧光示踪剂', '系统循环运行15min使示踪剂充分扩散', '在疑似渗漏区域用UV灯照射观察荧光痕迹', '标记所有发现的微漏点位置并拍照记录'] }
        ],
        status: 'pending', feedback: null,
        repair: { safety: ['确认锚机已停机系统已泄压至零', '佩戴防油手套和护目镜'], steps: ['关闭相关阀门系统泄压', '更换法兰密封垫片NBR Shore A 70±5', '力矩紧固50±2Nm分3次对角', '试压确认无渗漏', '恢复运行持续监控24h'], parts: ['法兰密封垫片×2', 'O型密封圈×4', '力矩扳手5-80Nm'], acceptance: '法兰接头无渗漏，压力稳定在16~21MPa' }
      },
      {
        title: '系统或油柜吸口堵塞排查',
        warning: '需停机泄压后操作',
        steps: [
          { title: '检查吸油口滤网状态', details: ['拆检吸口滤器有无堵塞/异物附着', '记录滤网表面杂质类型和沉积量', '评估滤网通流面积减少百分比', '检查滤网骨架有无变形/破损'] },
          { title: '测量吸口负压值', details: ['在额定流量下读取吸入侧真空表数值', '对比历史正常负压基准判断有无异常阻力', '在不同转速工况下记录负压变化趋势', '若负压超过-0.08MPa需立即清洗滤器'] },
          { title: '检查油箱底部沉积物', details: ['打开放油旋塞取样底部油液', '观察有无金属屑/水分/絮状物', '用磁铁检查铁磁性颗粒含量', '评估是否需要彻底清洗油箱内部'] }
        ],
        status: 'pending', feedback: null,
        repair: { safety: ['停机泄压后操作', '佩戴防护手套'], steps: ['清洗吸口滤网', '清除油箱底部沉积物', '更换回油过滤器滤芯', '补油至正常液位60~70%'], parts: ['回油过滤器滤芯×1', '液压油×20L'], acceptance: '滤器压差≤0.03MPa，吸口负压正常，油位≥60%' }
      },
      {
        title: '压力传感器故障排查',
        warning: '注意防止电磁干扰影响测量精度',
        steps: [
          { title: '传感器校验', details: ['使用标准传感器对核心监控传感器进行参照校验', '记录校验前后读数偏差', '检查传感器供电回路是否稳定（24V±5%）', '排查信号回路有无接地或短路'] },
          { title: '电磁干扰排查', details: ['检查传感器电缆屏蔽层接地是否良好', '排查附近有无大功率设备启动干扰', '使用示波器观察信号是否存在高频噪声', '检查传感器安装支架有无振动松动'] }
        ],
        status: 'pending', feedback: null,
        repair: { safety: ['确认供电已断开', '防静电损坏传感器'], steps: ['更换故障传感器', '重新校准零量和量程', '检查屏蔽接地', '通电测试读数一致性'], parts: ['压力传感器×1', '屏蔽电缆×5m'], acceptance: '读数偏差≤2%，无噪声干扰' }
      },
      {
        title: '系统管线泄漏排查',
        warning: '分段检查时注意系统压力，确认各段隔离阀状态',
        steps: [
          { title: '分段检查高压管路', details: ['沿管路走向逐段目视检查接头、焊缝有无油渍', '重点检查弯头、三通等应力集中部位', '检查管路固定支架处有无磨损渗漏', '检查法兰密封垫片处有无湿润痕迹'] },
          { title: '执行机构密封检查', details: ['检查液压缸活塞杆处有无外泄漏', '检查液压马达轴封处有无渗油', '观察执行机构动作是否平稳无爬行', '测量执行机构端盖温度判断内部泄漏'] },
          { title: '记录并拍照', details: ['对每个可疑泄漏点拍照标记坐标位置', '在管路图上标注所有泄漏点位置', '按严重程度分级（严重/中等/轻微）', '整理泄漏点清单供维修参考'] }
        ],
        status: 'pending', feedback: null,
        repair: { safety: ['确认系统泄压至零', '准备接油及消防设备'], steps: ['更换渗漏部位密封件', '力矩紧固分3次对角', '恢复运行试压检漏', '24h跟踪验证'], parts: ['法兰密封垫片×2', 'O型密封圈×4', '力矩扳手'], acceptance: '无可见渗漏，24h油位变化<2%' }
      }
    ],
  }

  // ========== 🔧 维修方案 ==========
  const repair = {
    recap: '排查阶段共发现 2 项关键异常：① T1 排查发现法兰接头渗漏（放油堵湿润+荧光定位）② T4 排查确认法兰垫片湿润，与T1交叉验证。根因指向：高压管路法兰接头密封垫片失效。',
    partsList: [
      { name: 'ISO VG 46 抗磨液压油', spec: '100L（核对合格证及批次号）' },
      { name: '法兰密封垫片（NBR丁腈橡胶）', spec: 'Shore A 70±5 × 2片' },
      { name: 'O型密封圈（匹配法兰尺寸）', spec: '× 4个' },
      { name: '加油泵（手摇式或电动式）', spec: '× 1台' },
      { name: '60目过滤漏斗', spec: '× 1个' },
      { name: '力矩扳手（量程 5-80Nm）', spec: '× 1把' }
    ],
    safetyWarnings: [
      '【强制】维修前必须办理《热工作业许可证》，现场配备灭火器材，专人监护',
      '【强制】系统泄压至零，确认无残余压力后方可拆装',
      '【强制】化学清洗剂（除垢剂）使用时必须佩戴防酸碱护具，准备应急冲洗水源',
      '【强制】维修完成后必须试压检漏，确认无渗漏方可投入运行'
    ],
    flows: [
      {
        title: '冷却水滤器清洗与滤芯更换',
        target: '滤芯脏污 / 压差超标',
        steps: [
          '关闭滤器进出口阀门，系统泄压',
          '打开滤器盖板（注意残余水），取出旧滤芯',
          '检查滤器壳体内壁，清理沉积物',
          '安装新滤芯（型号 XX-100，规格 100μm），密封圈涂抹食品级润滑脂',
          '复位盖板，手动预紧后按规定扭矩复紧',
          '缓慢开阀排气，观察无渗漏后投入运行'
        ],
        expectedResult: '滤器压差降至 ≤0.03MPa，系统流量恢复至 ≥80m³/h'
      },
      {
        title: '淡水侧换热面化学清洗',
        target: '换热面结垢',
        steps: [
          '隔离换热器，泄放淡水侧介质',
          '配置 5% 柠檬酸除垢液，加温至 50-60°C',
          '循环清洗 4 小时，期间每 30 分钟采样检测 pH 与含铁量',
          '排空除垢液，用清水冲洗至 pH=7',
          '目视检查换热面，残留水垢用软毛刷辅助清理',
          '复装试压 0.6MPa，30 分钟无渗漏'
        ],
        expectedResult: '换热效率恢复 ≥90%，换热面温度偏差 ≤1°C'
      },
      {
        title: '温控阀检修与调试',
        target: '阀芯卡滞 / 开度受限',
        steps: [
          '断电隔离执行机构，泄放控制油压',
          '拆下阀体，检查阀芯、阀座密封面',
          '清理阀芯表面沉积物，研磨密封面',
          '更换老化密封圈，复装阀体',
          '通电调试，检查阀位反馈线性度',
          '联动测试：模拟 0%/50%/100% 开度，确认响应时间 ≤3s'
        ],
        expectedResult: '阀位控制精度 ±2%，无卡滞/振荡'
      }
    ],
    acceptance: [
      { name: '冷却水出口温度', req: '≤ 85°C', current: '78°C', curPass: true, method: '在线监测持续 1h' },
      { name: '冷却水流量', req: '≥ 80m³/h', current: '92m³/h', curPass: true, method: '超声波流量计实测' },
      { name: '滤器压差', req: '≤ 0.03MPa', current: '0.02MPa', curPass: true, method: '压差计读数' },
      { name: '系统渗漏', req: '无可见渗漏', current: '无渗漏', curPass: true, method: '目视 + 试压 0.6MPa 30min' },
      { name: '振动值', req: '≤ 4.5mm/s', current: '3.8mm/s', curPass: true, method: '振动仪三向测量' }
    ]
  }

  // ========== ✅ 维修报告 ==========
  const report = {
    elapsed: '4 小时 32 分',
    rootCause: '冷却水滤器脏污导致管路流量下降，叠加淡水侧换热面积垢与温控阀阀芯轻微卡滞，三者耦合引发冷却水温异常偏高。',
    workDone: '更换冷却水滤器 1 套，对淡水侧换热面进行化学清洗，检修温控阀并更换密封件，调试阀位控制曲线。',
    keyAccept: '出口温度稳定在 78°C（≤85°C），流量 92m³/h（≥80m³/h），滤器压差 0.02MPa（≤0.03MPa），系统无渗漏，振动值 3.8mm/s（≤4.5mm/s），验收通过。',
    followup: '建议将该滤器纳入月度巡检重点关注对象；下一次坞修时对换热面进行彻底机械清洗；建立温控阀定期调试台账（每 6 个月一次）。'
  }

  return { ai, check, repair, report }
}

// ============ 阶段 / 事件切换：折叠所有 → 展开当前 → 脉冲 ============
watch(() => [props.event?.id, currentStage.value], (newVal, oldVal) => {
  const [eid, stage] = newVal
  const [oldEid, oldStage] = oldVal || [undefined, undefined]
  if (!eid) return

  const isStageChanged = oldStage !== undefined && oldStage !== stage
  const isEventChanged = eid !== oldEid

  // 切事件：重置状态
  if (isEventChanged) {
    aiExpanded.value = true
    reportExpanded.value = false
    needsManualClose.value = false
    isFalseAlarm.value = false
    manualFeedback.value = ''
    showReportCard.value = false
    aiSubs.conclusion = true
    aiSubs.data = true
    aiSubs.mechanism = false
    aiSubs.reasons = false
    selectedSensorIndex.value = 0
    trendLoaded.value = false
    setTimeout(() => { trendLoaded.value = true }, 600)
    // 重置排查和维修卡片
    Object.keys(checkCardsExpanded).forEach(k => delete checkCardsExpanded[k])
    Object.keys(repairCardsExpanded).forEach(k => delete repairCardsExpanded[k])
  }

  // 阶段变化
  if (isStageChanged) {
    if (stage !== 'S1') aiExpanded.value = false
    if (stage === 'S5') reportExpanded.value = true
    pulseInto(sectionMap[stage], 900)
  }

  // 初始化 S2：激活第一项排查
  if ((isStageChanged || isEventChanged) && stage === 'S2') {
    const items = product.value?.check?.checkItems
    if (items && items.length > 0 && items[0].status === 'pending') {
      items[0].status = 'active'
      ensureFeedbackDraft(items[0], 0)
      checkCardsExpanded[0] = true
    }
  }
}, { immediate: true })

// 全部正常 → 仍需手动闭环（排查不等于维修完成）
watch(allChecksNormal, (normal) => {
  if (normal) {
    showReportCard.value = true
    reportExpanded.value = true
    needsManualClose.value = true
    scrollIntoCard('event-record-card')
    if (props.event) {
      eventStage[props.event.id] = 'S4'
      eventAssistantAction[props.event.id] = 'needs_manual_close'
    }
  }
})

// 所有牌打光且均未解决 → 触发事件记录 + 手动闭环入口
watch(allRepairsExhausted, (exhausted) => {
  if (exhausted) {
    const hasResolvedRepair = (product.value?.check?.checkItems || []).some(i => i.status === 'done-abnormal' && i.repaired === true)
    if (hasResolvedRepair) return
    showReportCard.value = true
    reportExpanded.value = true
    needsManualClose.value = true
    scrollIntoCard('event-record-card')
    if (props.event) {
      eventStage[props.event.id] = 'S4'
      eventAssistantAction[props.event.id] = 'needs_manual_close'
    }
  }
})

// ============ 助手卡片联动：渐进展开子模块 ============
const cardToSection = {
  diagnosis: 'ai',
  snapshot: 'ai',
  guide: 'check',
  warning: 'check',
  report: 'report'
}
watch(() => eventAssistantAction[props.event?.id], (action) => {
  if (!action || !props.event) return
  stopStream()

  // 激活第一个排查项
  if (action === 'check_activate_first') {
    const items = product.value?.check?.checkItems
    if (items && items.length > 0 && items[0].status === 'pending') {
      items[0].status = 'active'
      ensureFeedbackDraft(items[0], 0)
      checkCardsExpanded[0] = true
    }
    pulseInto('check', 700)
    return
  }

  // 标记为误报：折叠 AI 分析，展开事件记录
  if (action === 'false_alarm_closed') {
    aiExpanded.value = false
    showReportCard.value = true
    reportExpanded.value = true
    needsManualClose.value = false
    isFalseAlarm.value = true
    scrollIntoCard('event-record-card')
    if (props.event) eventStage[props.event.id] = 'S5'
    return
  }

  // 手动闭环：记录用户反馈文本
  if (action.startsWith('manual_close_done')) {
    const feedback = action.split('|').slice(1).join('|')
    manualFeedback.value = feedback
    return
  }


  const section = cardToSection[action]
  if (!section) return

  aiExpanded.value = (section === 'ai')
  reportExpanded.value = (section === 'report')
  pulseInto(section, 700)
})

function applyNaturalLanguageCheckFeedback(key, rawText = '') {
  const items = product.value?.check?.checkItems || []
  const activeIdx = items.findIndex(i => i.status === 'active')
  if (activeIdx < 0) return false
  const item = items[activeIdx]
  const draft = ensureFeedbackDraft(item, activeIdx)
  const rules = {
    tank_weld_leak_obvious: { names: ['油箱焊缝渗漏'], option: 2 },
    tank_weld_wet: { names: ['油箱焊缝渗漏'], option: 1 },
    hose_crack_leak: { names: ['软管段状态'], option: 2 },
    flange_oil_stain: { names: ['法兰接头油渍', '接头/焊缝油渍'], option: 1 },
    filter_block_severe: { names: ['滤器堵塞'], option: 2 },
    sensor_deviation_obvious: { names: ['参照校验', '读数偏差'], option: 2 }
  }
  const rule = rules[key]
  if (!rule) return false
  const target = draft.find(f => rule.names.some(name => f.name.includes(name)))
  if (!target) return false
  target.selected = Math.min(rule.option, target.options.length - 1)
  item.feedbackNotes = rawText ? `右侧助手识别：${rawText}` : item.feedbackNotes
  checkCardsExpanded[activeIdx] = true
  scrollIntoCard('check-card-' + activeIdx)
  return true
}

// 右侧 chip / 自然语言快速反馈 → 只触发左侧原有按钮函数，不修改额外阶段状态
watch(() => eventAssistantCommand[props.event?.id], (command) => {
  if (!command) return
  const parts = String(command).split('|')
  const action = parts[0]
  const items = product.value?.check?.checkItems || []

  if (action === 'nl_check_feedback') {
    applyNaturalLanguageCheckFeedback(parts[1], decodeURIComponent(parts[2] || ''))
    return
  }

  if (action === 'chip_check_normal') {
    const activeIdx = items.findIndex(i => i.status === 'active')
    if (activeIdx >= 0) markNormal(activeIdx)
    return
  }
  if (action === 'chip_open_feedback') {
    const activeIdx = items.findIndex(i => i.status === 'active')
    if (activeIdx >= 0) openFeedbackModal(activeIdx)
    return
  }
  if (action === 'chip_repair_solved') {
    const activeIdx = items.findIndex(i => i.status === 'done-abnormal' && i.repaired === undefined)
    if (activeIdx >= 0) markItemRepaired(activeIdx)
    return
  }
  if (action === 'chip_repair_not_fixed') {
    const activeIdx = items.findIndex(i => i.status === 'done-abnormal' && i.repaired === undefined)
    if (activeIdx >= 0) markItemNotFixed(activeIdx)
  }
})

function handleBack() { emit('back') }
function formatTime(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d.getTime())) return '—'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.product-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  border-left: 1px solid var(--border-primary);
}

/* ============ Header ============ */
.drawer-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}
.back-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary, var(--text-secondary));
  cursor: pointer;
  font-size: var(--font-base);
  padding: 4px 8px;
  border-radius: 4px;
}
.back-btn:hover { background: var(--bg-hover); }

/* ============ 阶段进度条 ============ */
.stage-progress {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  justify-content: center;
}
.sp-item {
  display: flex;
  align-items: center;
  position: relative;
}
.sp-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: var(--font-sm);
  font-weight: 600;
  background: var(--border-primary);
  color: var(--text-muted);
  border: 2px solid var(--border-primary);
  transition: all 0.3s;
}
.sp-item.done .sp-dot {
  background: var(--success);
  color: #fff;
  border-color: var(--success);
}
.sp-item.active .sp-dot {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.15);
}
.sp-label {
  margin: 0 6px;
  font-size: var(--font-sm);
  color: var(--text-muted);
}
.sp-item.done .sp-label { color: var(--success); }
.sp-item.active .sp-label { color: var(--accent); font-weight: 600; }
.sp-line {
  width: 50px;
  height: 2px;
  background: var(--border-primary);
  margin: 0 2px;
}
.sp-item.done .sp-line { background: var(--success); }
.sp-cursor {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  animation: cursorPulse 1s infinite;
}
@keyframes cursorPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* ============ Drawer Body ============ */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 24px;
}

/* ============ 产物卡片 ============ */
.prod-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.3s;
}
.prod-card.card-current {
  border-color: var(--accent);
  border-left-width: 3px;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
}
.prod-card.card-collapsed { /* 折叠态：弱化 */ }

.prod-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(to right, var(--bg-hover), var(--bg-surface));
  border-bottom: 1px solid transparent;
  transition: all 0.2s;
}
.prod-head:hover { background: var(--accent-bg); }
.prod-card.card-current .prod-head { background: linear-gradient(to right, var(--accent-bg), var(--accent-bg)); border-bottom-color: var(--border-primary); }
.prod-card.card-collapsed .prod-head { border-bottom-color: transparent; }

.prod-icon { font-size: 20px; }
.prod-titles { flex: 1; min-width: 0; }
.prod-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.prod-card.card-current .prod-title { color: var(--accent); }
.prod-sub {
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin-top: 2px;
}
.prod-gen {
  font-size: var(--font-xs);
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(22, 119, 255, 0.12);
  color: var(--accent);
  animation: genPulse 1.2s infinite;
}
@keyframes genPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.prod-toggle {
  font-size: var(--font-sm);
  color: var(--text-muted);
}

.prod-status {
  font-size: var(--font-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  margin-left: auto;
  margin-right: 8px;
}
.prod-status.done { background: var(--success-bg); color: var(--success); }
.prod-status.abnormal { background: var(--danger-bg); color: var(--danger); }
.prod-status.active { background: var(--accent-bg); color: var(--accent); }
.prod-status.pending { background: var(--bg-panel); color: var(--text-muted); }

.prod-body { padding: 14px; }

/* ============ 通用 block ============ */
.block { margin-bottom: 16px; }
.block:last-child { margin-bottom: 0; }
.block-title {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid var(--accent);
}
.warn-block .block-title { border-left-color: var(--warning); }
.danger-block .block-title { border-left-color: var(--danger); }
.recap-block .block-title { border-left-color: var(--accent); }
.accept-block .block-title { border-left-color: var(--success); }

/* ============ AI 块 ============ */
.verdict { margin-bottom: 10px; }
.verdict-label {
  font-size: var(--font-sm);
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}
.verdict-text {
  font-size: var(--font-base);
  line-height: 1.7;
  color: var(--text-primary);
  background: var(--accent-bg);
  border-left: 3px solid var(--accent);
  padding: 8px 10px;
  border-radius: 0 4px 4px 0;
}
.snapshot-mini {
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.snapshot-mini-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.snapshot-mini-time {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-bottom: 6px;
}
.snapshot-mini-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.snapshot-mini-list li {
  font-size: var(--font-sm);
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.sm-name { color: var(--text-secondary); }
.sm-val { font-weight: 600; font-family: monospace; }
.sm-val.over { color: var(--danger); }
.sm-val.normal { color: var(--success); }

.data-line, .advice-line {
  font-size: var(--font-sm);
  line-height: 1.7;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.data-label, .advice-label { color: var(--text-muted); margin-right: 4px; }
.advice-line { color: var(--text-primary); }

/* 指标卡 */
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.metric {
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px 10px;
}
.metric-name { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); }
.metric-trend {
  display: inline-block;
  font-size: var(--font-xs);
  margin: 2px 0;
  padding: 1px 5px;
  border-radius: 3px;
}
.metric-trend.up { background: var(--bg-surface)1f0; color: var(--danger); }
.metric-trend.down { background: var(--bg-surface)7e6; color: var(--warning); }
.metric-trend.flat { background: var(--success-bg); color: var(--success); }
.metric-range { font-size: var(--font-xs); color: var(--text-muted); margin: 2px 0 4px; }
.metric-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-bottom: 2px;
}
.metric-current { font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: monospace; }
.metric-unit { font-size: var(--font-xs); color: var(--text-secondary); }
.metric-analyze { font-size: var(--font-xs); color: var(--text-secondary); line-height: 1.4; }

/* 趋势图 */
.trend-meta { font-size: var(--font-sm); color: var(--text-muted); margin-bottom: 6px; }
.trend-svg {
  width: 100%;
  height: 140px;
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
}
.trend-legend {
  display: flex;
  gap: 16px;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  margin-top: 6px;
  justify-content: center;
}
.lg-item { display: flex; align-items: center; gap: 4px; }
.lg-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

/* 工程机理 */
.mechanism { margin-bottom: 10px; }
.mech-label { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.mech-text { font-size: var(--font-sm); line-height: 1.7; color: var(--text-primary); }

.fault-match { background: var(--bg-hover); border: 1px solid var(--border-primary); border-radius: 6px; padding: 8px 10px; }
.fm-row {
  display: flex;
  align-items: center;
  font-size: var(--font-sm);
  padding: 4px 0;
  border-bottom: 1px dashed var(--border-primary);
}
.fm-row:last-child { border-bottom: none; }
.fm-row.fm-head { font-weight: 600; color: var(--text-muted); border-bottom: 1px solid var(--border-primary); }
.fm-name { flex: 1; }
.fm-bar { position: relative; width: 120px; height: 16px; background: var(--bg-hover); border-radius: 8px; overflow: hidden; }
.fm-bar-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  transition: width 0.6s;
}
.fm-bar-text {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--text-primary);
  z-index: 1;
}

/* 原因表 */
.reason-table {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  overflow: hidden;
}
.rt-row {
  display: grid;
  grid-template-columns: 1.2fr 1.5fr 1.5fr;
  gap: 8px;
  padding: 8px 10px;
  font-size: var(--font-sm);
  border-bottom: 1px solid var(--border-primary);
}
.rt-row:last-child { border-bottom: none; }
.rt-row.rt-head { background: var(--bg-hover); font-weight: 600; color: var(--text-secondary); }
.rt-col { line-height: 1.5; }
.rt-fault { display: flex; align-items: center; gap: 4px; }
.rt-prob {
  font-size: var(--font-xs);
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 600;
}
.rt-prob.high { background: var(--bg-surface)1f0; color: var(--danger); }
.rt-prob.medium { background: var(--bg-surface)7e6; color: var(--warning); }
.rt-prob.low { background: var(--success-bg); color: var(--success); }

/* ============ 排查块 ============ */
.warn-block, .danger-block { background: var(--bg-surface)7e6; border-radius: 6px; padding: 10px 12px; }
.danger-block { background: var(--bg-surface)1f0; }
.warn-block .block-title, .danger-block .block-title { border-left: none; padding-left: 0; }
.warn-list, .danger-list {
  margin: 0;
  padding-left: 20px;
  font-size: var(--font-sm);
  line-height: 1.8;
  color: var(--text-primary);
}
.warn-list li::marker { color: var(--warning); font-weight: 600; }
.danger-list li::marker { color: var(--danger); font-weight: 600; }

.step {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--bg-hover);
}
.step-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: var(--font-sm);
  font-weight: 600;
}
.step-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); }
.step-target { font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 6px; }
.step-sub { list-style: none; padding: 0; margin: 0 0 8px; }
.step-sub li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: var(--font-sm);
  line-height: 1.6;
  padding: 2px 0;
}
.sub-tag {
  font-size: var(--font-xs);
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 2px;
}
.sub-tag.must { background: var(--bg-surface)1f0; color: var(--danger); }
.sub-tag.suggest { background: var(--accent-bg); color: var(--accent); }
.sub-tag.photo { background: rgba(22, 119, 255, 0.06); color: var(--accent); }
.sub-tag.data { background: var(--success-bg); color: var(--success); }
.sub-tag.test { background: var(--bg-surface)7e6; color: var(--warning); }
.sub-text { color: var(--text-primary); }

.step-photo { margin-top: 4px; }
.photo-placeholder {
  border: 1px dashed var(--border-primary);
  border-radius: 4px;
  padding: 16px;
  text-align: center;
  font-size: var(--font-sm);
  color: var(--text-muted);
  background: var(--bg-surface);
  cursor: pointer;
}
.photo-placeholder:hover { border-color: var(--accent); color: var(--accent); }

/* 排查项 checklist */
.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: pointer;
  font-size: var(--font-sm);
  user-select: none;
  transition: all 0.15s;
}
.check-item:hover { background: var(--accent-bg); }
.check-item.done { background: var(--success-bg); border-color: var(--success-bg-hover); }
.check-box { font-size: var(--font-md); }
.check-item.done .check-box { color: var(--success); }
.check-item.done .check-text { text-decoration: line-through; color: var(--text-muted); }
.check-text { flex: 1; }
.check-flag {
  font-size: var(--font-xs);
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--bg-surface)1f0;
  color: var(--danger);
  font-weight: 600;
}

/* ============ 维修块 ============ */
.recap-block { background: rgba(22, 119, 255, 0.06); border-radius: 6px; padding: 10px 12px; }
.recap-block .block-title { border-left: none; padding-left: 0; color: var(--accent); }
.recap-text { font-size: var(--font-sm); line-height: 1.7; color: var(--text-primary); }

.flow {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--bg-hover);
}
.flow-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.flow-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--warning);
  color: #fff;
  font-size: var(--font-sm);
  font-weight: 600;
}
.flow-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); flex: 1; }
.flow-target { font-size: var(--font-sm); color: var(--danger); background: var(--bg-surface)1f0; padding: 1px 6px; border-radius: 3px; }
.flow-steps { margin: 6px 0; padding-left: 20px; font-size: var(--font-sm); line-height: 1.7; color: var(--text-primary); }
.flow-result {
  font-size: var(--font-sm);
  color: var(--success);
  background: var(--success-bg);
  border-radius: 3px;
  padding: 4px 8px;
  margin-top: 4px;
}

.accept-block { background: var(--success-bg); border-radius: 6px; padding: 10px 12px; }
.accept-block .block-title { border-left: none; padding-left: 0; color: var(--success); }
.accept-list { list-style: none; padding: 0; margin: 0; }
.accept-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--font-sm);
  padding: 4px 0;
  border-bottom: 1px dashed rgba(0, 180, 42, 0.3);
}
.accept-list li:last-child { border-bottom: none; }
.accept-name { font-weight: 600; color: var(--text-primary); min-width: 120px; }
.accept-req { color: var(--warning); }
.accept-method { color: var(--text-secondary); flex: 1; min-width: 120px; text-align: right; }

/* ============ 报告块 ============ */
.report-summary { }
.report-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, var(--success), #73d13d);
  color: #fff;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 12px;
}
.report-banner-icon {
  width: 32px; height: 32px;
  background: rgba(255,255,255,0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}
.report-banner-text { font-size: var(--font-lg); font-weight: 600; }
.banner-needs-manual {
  background: linear-gradient(135deg, var(--warning), #ff9c6e);
}
.banner-needs-manual .report-banner-icon {
  background: rgba(255,255,255,0.3);
}
.banner-false-alarm {
  background: linear-gradient(135deg, #8c8c8c, #bfbfbf);
}
.banner-false-alarm .report-banner-icon {
  background: rgba(255,255,255,0.25);
}

.report-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.rs-item {
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  padding: 8px 10px;
}
.rs-label { font-size: var(--font-xs); color: var(--text-muted); }
.rs-value { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); margin-top: 2px; }
.rs-value.success { color: var(--success); }

.report-key {
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px 12px;
}
.rk-row { padding: 6px 0; border-bottom: 1px dashed var(--border-primary); font-size: var(--font-sm); }
.rk-row:last-child { border-bottom: none; }
.rk-label {
  display: inline-block;
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-bg);
  padding: 1px 6px;
  border-radius: 2px;
  margin-right: 6px;
  min-width: 60px;
  text-align: center;
}
.rk-text { color: var(--text-primary); line-height: 1.6; }

.report-footer {
  text-align: center;
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-primary);
}

/* 流式提示 */
.stream-tip {
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--accent-bg);
  border: 1px solid rgba(22, 119, 255, 0.3);
  border-radius: 4px;
  font-size: var(--font-sm);
  color: var(--accent);
  text-align: center;
  animation: streamPulse 1.2s infinite;
}
@keyframes streamPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.cursor-blink {
  display: inline-block;
  color: var(--accent);
  animation: cursorBlink 0.8s infinite step-end;
  margin-right: 2px;
}
@keyframes cursorBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* ============ 子模块渐进展示动画 ============ */
.reveal-block {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  margin-bottom: 0;
  transition: max-height 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
              opacity 0.4s ease,
              margin-bottom 0.3s ease;
}
.reveal-block.revealed {
  max-height: 800px;
  opacity: 1;
  margin-bottom: 16px;
}

/* ============ 趋势图加载骨架 ============ */
.trend-skeleton {
  width: 100%;
  height: 140px;
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.trend-skel-pulse {
  width: 60%;
  height: 4px;
  background: linear-gradient(90deg, var(--border-primary) 0%, var(--accent-bg) 50%, var(--border-primary) 100%);
  background-size: 200% 100%;
  border-radius: 2px;
  animation: skel-pulse 1.5s ease-in-out infinite;
}

@keyframes skel-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.trend-skel-text {
  font-size: var(--font-sm);
  color: var(--text-muted);
  animation: skel-fade 1.5s ease-in-out infinite;
}

@keyframes skel-fade {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* === 子模块折叠头 === */
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}
.sub-head:hover .block-title { color: var(--accent); }
.sub-toggle { font-size: var(--font-xs); color: var(--text-muted); flex-shrink: 0; }

/* === 可点击传感器卡片 === */
.sensor-card-clickable {
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.15s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sensor-card-clickable:hover { background: var(--accent-bg); }
.sensor-selected { background: var(--accent-bg); border-left: 2px solid var(--accent); padding-left: 4px; }

/* === 趋势图区域 === */
.trend-section { margin-top: 12px; }

/* === 横向传感器卡片 === */
.sensor-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.sensor-card-h {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.sensor-card-h:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(22,119,255,0.08);
  transform: translateY(-1px);
}
.sc-selected {
  border-color: var(--accent) !important;
  border-width: 2px;
  box-shadow: 0 0 0 3px rgba(22,119,255,0.12);
}
.sc-over { border-left: 3px solid var(--danger); }
.sc-warning { border-left: 3px solid var(--warning); }
.sc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.sc-name {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
}
.sc-tag {
  font-size: var(--font-xs);
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 500;
}
.sc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  margin-left: auto;
  box-shadow: 0 0 6px var(--accent);
  animation: dot-pulse 1.5s infinite;
}
@keyframes dot-pulse {
  0%,100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}
.sc-meta {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-bottom: 6px;
  line-height: 1.4;
}
.sc-history {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 6px;
}
.sc-status {
  font-size: var(--font-xs);
  font-weight: 600;
  line-height: 1.4;
}
.sc-status.st-over { color: var(--danger); }
.sc-status.st-warning { color: var(--warning); }
.sc-status.st-normal { color: var(--success); }

/* === 大尺寸趋势图 === */
.trend-chart-area {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 16px;
}
.trend-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.tch-title {
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--text-primary);
}
.tch-hint {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.trend-svg-lg {
  width: 100%;
  height: auto;
}
.trend-skeleton-lg {
  height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* === 验收标准当前值 === */
.accept-cur { font-size: var(--font-base); font-weight: 600; min-width: 80px; text-align: center; padding: 1px 6px; border-radius: 3px; }
.cur-pass { color: var(--success); background: var(--success-bg); }
.cur-fail { color: var(--danger); background: var(--danger-bg); }

/* === 报告时间线 === */
.report-timeline { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-primary); }
.rtl-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); margin-bottom: 10px; }
.timeline-list { display: flex; flex-direction: column; }
.tl-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; position: relative; }
.tl-row:not(:last-child)::before { content: ''; position: absolute; left: 84px; top: 22px; bottom: 0; width: 1px; background: var(--border-primary); }
.tl-time-col { font-size: var(--font-xs); color: var(--text-muted); font-family: Consolas, monospace; width: 75px; flex-shrink: 0; text-align: right; }
.tl-dot-col { display: flex; align-items: center; justify-content: center; width: 20px; flex-shrink: 0; }
.tl-dot-report { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
.tl-dot-report.first { background: var(--accent); width: 10px; height: 10px; box-shadow: 0 0 4px var(--accent); }
.tl-dot-report.last { background: var(--success); }
.tl-action-col { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.5; flex: 1; }

/* === 备件清单 === */
.parts-block { background: var(--accent-bg); border-radius: 6px; padding: 10px 12px; }
.parts-block .block-title { border-left: none; padding-left: 0; color: var(--accent); }
.parts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.parts-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border-secondary); }
.parts-name { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); }
.parts-spec { font-size: var(--font-xs); color: var(--text-muted); }

/* === 排查项卡片（截图1/2/4样式） === */
.check-items-section { }
.check-progress { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
.check-item-card { border: 1px solid var(--border-primary); border-radius: 8px; margin-bottom: 8px; background: var(--bg-surface); overflow: hidden; transition: all 0.2s; }
.ci-pending { border-color: var(--border-primary); }
.ci-pending .ci-header { background: var(--bg-hover); }
.ci-active { border-color: var(--accent); border-width: 2px; box-shadow: 0 0 0 3px rgba(22,119,255,0.08); }
.ci-active .ci-header { background: var(--accent-bg); }
.ci-done-normal { border-color: var(--success); border-left: 4px solid var(--success); opacity: 0.8; }
.ci-done-abnormal { border-color: var(--danger); border-left: 4px solid var(--danger); opacity: 0.9; }
.ci-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: pointer; user-select: none; }
.ci-header:hover { background: var(--bg-hover); }
.ci-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); }
.ci-toggle { font-size: var(--font-xs); color: var(--text-muted); }
.ci-body { padding: 14px; border-top: 1px solid var(--border-primary); }
.ci-warning { font-size: var(--font-sm); padding: 8px 10px; background: rgba(250,173,20,0.08); border-left: 3px solid var(--warning); border-radius: 0 4px 4px 0; margin-bottom: 12px; }
.ci-warning-label { font-weight: 700; color: var(--warning); }
.ci-steps-label { font-size: var(--font-sm); font-weight: 700; color: var(--warning); margin-bottom: 8px; }
.ci-step { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border-secondary); }
.ci-step:last-child { border-bottom: none; }
.ci-step-num { font-size: var(--font-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 5px; line-height: 1.5; }
.ci-step-details { margin: 0; padding-left: 18px; font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.62; }
.ci-detail-row { margin-bottom: 5px; }
.ci-detail-with-feedback {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  padding: 2px 0;
}
.ci-detail-text { min-width: 0; flex: 1 1 auto; line-height: 1.62; }
.ci-detail-feedback {
  display: inline-flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
  white-space: nowrap;
}
.ci-step-diagram { font-size: var(--font-xs); color: var(--text-muted); margin-top: 6px; font-style: italic; }
.ci-actions { display: flex; gap: 12px; justify-content: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-primary); }
.ci-action-btn { font-size: var(--font-base); padding: 10px 28px; border-radius: 20px; border: 2px solid var(--accent); cursor: pointer; font-weight: 600; transition: all 0.2s; background: var(--bg-surface); }
.ci-action-ok { color: var(--success); border-color: var(--success); }
.ci-action-ok:hover { background: var(--success-bg); }
.ci-action-feedback { color: var(--accent); }
.ci-action-feedback:hover { background: var(--accent-bg); }
.ci-summary { padding: 10px 14px; border-top: 1px solid var(--border-primary); background: var(--bg-hover); }
.ci-summary-label { font-size: var(--font-xs); color: var(--text-muted); font-weight: 600; }
.ci-feedback-summary { margin-top: 6px; }
.ci-feedback-row { font-size: var(--font-sm); padding: 2px 0; color: var(--text-secondary); }
.ci-f-abnormal { color: var(--danger); font-weight: 600; }
.ci-f-normal { color: var(--success); }

/* === 排查明细行内反馈 === */
.ci-inline-opt {
  min-height: 23px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: var(--font-xs);
  line-height: 1.25;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.ci-inline-opt:has(input:checked) {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  font-weight: 600;
}
.ci-inline-opt input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}
@media (max-width: 1180px) {
  .ci-detail-with-feedback {
    gap: 6px;
  }
  .ci-inline-opt {
    min-height: 22px;
    padding: 2px 5px;
    gap: 2px;
    font-size: 11px;
  }
}
@media (max-width: 860px) {
  .ci-detail-with-feedback {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .ci-detail-feedback {
    width: 100%;
    flex-wrap: wrap;
  }
}
.ci-inline-note {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px dashed var(--border-primary);
  border-radius: 8px;
  background: var(--bg-surface);
}
.ci-inline-note-label {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.ci-inline-textarea {
  width: 100%;
  min-height: 58px;
  padding: 8px 10px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: var(--font-sm);
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
}
.ci-inline-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12);
}
/* === 维修完成按钮 === */
.repair-actions { display: flex; gap: 12px; justify-content: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-primary); }
.ra-btn { font-size: var(--font-base); padding: 10px 24px; border-radius: 20px; border: 2px solid var(--accent); cursor: pointer; font-weight: 600; transition: all 0.2s; background: var(--bg-surface); }
.ra-resolved { color: var(--success); border-color: var(--success); }
.ra-resolved:hover { background: var(--success-bg); }
.ra-continue { color: var(--warning); border-color: var(--warning); }
.ra-continue:hover { background: var(--warning-bg); }
.ra-manual { color: var(--warning); border-color: var(--warning); background: var(--warning-bg); width: 100%; }
.ra-manual:hover { background: #fff0e6; }
.ra-resolved-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--success);
  padding: 10px 24px;
  border-radius: 20px;
  background: var(--success-bg);
  border: 2px solid var(--success);
}
.ra-notfixed-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--warning);
  padding: 10px 24px;
  border-radius: 20px;
  background: var(--warning-bg);
  border: 2px solid var(--warning);
}

/* === 内联维修方案 === */
.ci-repair { padding: 14px; border-top: 2px solid var(--accent); background: var(--accent-bg); border-left: 4px solid var(--accent); }
.ci-repair-title { font-size: var(--font-base); font-weight: 700; color: var(--accent); margin-bottom: 10px; }
.ci-repair-row { font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 6px; line-height: 1.6; }
.cb-accept { color: var(--success) !important; font-weight: 600; padding: 6px 8px; background: var(--success-bg); border-radius: 4px; }
.ci-repair-steps { margin: 0 0 6px; padding-left: 20px; font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.6; }
.ci-repair-actions { display: flex; gap: 10px; justify-content: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(22,119,255,0.2); }
.ci-rp-btn { font-size: var(--font-base); padding: 8px 18px; border-radius: 16px; border: 2px solid; cursor: pointer; font-weight: 600; transition: all 0.2s; background: var(--bg-surface); }
.ci-rp-done { color: var(--success); border-color: var(--success); }
.ci-rp-done:hover { background: var(--success-bg); }
.ci-rp-fail { color: var(--warning); border-color: var(--warning); }
.ci-rp-fail:hover { background: var(--warning-bg); }
.ci-repaired-badge { text-align: center; padding: 8px; font-size: var(--font-sm); color: var(--success); font-weight: 600; border-top: 1px solid var(--success); background: var(--success-bg); }

/* === 排查项维修卡片（独立于排查方案）=== */
.repair-card-inline { border-left: 4px solid var(--accent); box-shadow: 0 2px 8px rgba(22,119,255,0.1); }
.repair-card-section { border-left: 4px solid var(--accent); box-shadow: 0 2px 8px rgba(22,119,255,0.1); }
.repair-list { margin: 0; padding-left: 18px; font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.6; }
.repair-list li { margin-bottom: 2px; }
.repair-steps { margin: 0; padding-left: 18px; font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.6; }
.repair-steps li { margin-bottom: 4px; }
.repair-parts { font-size: var(--font-sm); color: var(--text-secondary); padding: 6px 10px; background: var(--bg-hover); border-radius: 4px; }
.repair-accept-text { font-size: var(--font-base); color: var(--success); font-weight: 600; padding: 8px 10px; background: var(--success-bg); border-radius: 4px; border-left: 3px solid var(--success); }
.accept-inline .block-title { color: var(--success) !important; border-left-color: var(--success) !important; }
</style>
