<template>
  <div class="product-drawer" v-if="event">
    <!-- 图片全屏遮罩 -->
    <div v-if="lightboxUrl" class="lightbox-overlay" @click="lightboxUrl = null">
      <img :src="lightboxUrl" class="lightbox-img" alt="放大查看" />
    </div>
    <button class="back-float" @click="handleBack" title="返回事件列表">
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    </button>

    <div class="drawer-body">
      <!-- 任务卡片轨道：产物随流程向右叠加 -->
      <div class="task-card-rail" v-if="stageTabs.length > 0">
        <button
          v-for="(tab, ti) in stageTabs"
          :key="tab.key"
          class="task-card-chip"
          :class="[
            { active: activeTab === tab.key },
            'task-' + (tab.type || 'normal'),
            taskStatusClass(tab)
          ]"
          :style="{ '--stack-i': ti }"
          @click="activeTab = tab.key"
        >
          <span class="task-card-index">{{ String(ti + 1).padStart(2, '0') }}</span>
          <span class="task-card-main">
            <span class="task-card-kicker">{{ taskKicker(tab) }}</span>
            <span class="task-card-title">{{ tab.label }}</span>
          </span>
          <span class="task-card-state">{{ taskStatusText(tab) }}</span>
        </button>
      </div>

      <!-- ==== 事件情况 ==== -->
      <section v-if="activeTab === 'situation'" class="prod-body-wrap">
        <div class="situation-tabs">
          <button
            v-for="tab in visibleSituationTabs"
            :key="tab.key"
            class="situation-tab"
            :class="{ active: activeSituationTab === tab.key }"
            @click="activeSituationTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="activeSituationTab === 'summary'" class="situation-panel">
          <div class="overview-summary-grid">
            <section class="overview-section event-info-section">
              <div class="section-heading">事件信息</div>
              <div class="event-info-list">
                <div v-for="(row, ri) in product.ai.eventInfo" :key="ri" class="event-info-row">
                  <span class="event-info-label">{{ row.label }}</span>
                  <span class="event-info-value">{{ row.value }}</span>
                </div>
              </div>
              <p class="event-info-narrative">{{ product.ai.eventNarrative }}</p>
            </section>

            <section class="overview-section conclusion-section">
              <div class="section-heading">初步判断与结论建议</div>
              <div class="conclusion-stack">
                <div class="conclusion-block">
                  <div class="conclusion-top-row">
                    <div class="conclusion-main">
                      <span class="conclusion-label">初判结论</span>
                      <strong class="conclusion-value">{{ product.ai.initialConclusion }}</strong>
                    </div>
                    <div class="confidence-ring-wrap">
                      <div
                        class="confidence-ring confidence-ring-sm"
                        :style="{ '--confidence-deg': (product.ai.confidence * 3.6) + 'deg' }"
                      >
                        <div class="confidence-ring-inner">
                          <strong class="confidence-value">{{ product.ai.confidence }}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="suggestion-block">
                  <span class="conclusion-label">建议</span>
                  <p>{{ product.ai.recommendation }}</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div v-if="activeSituationTab === 'data'" class="situation-panel">
          <div class="block-title">数据概览</div>
          <div class="sensor-cards-row">
            <div
              v-for="(s, i) in event.snapshot?.sensors || []"
              :key="i"
              class="sensor-card-h"
              :class="{
                'sc-selected': selectedSensorIndex === i,
                'sc-alert': s.status === 'over' || s.status === 'warning'
              }"
              @click="selectedSensorIndex = i"
            >
              <div class="sc-header">
                <span class="sc-name">{{ s.name }}</span>
                <span v-if="s.tag" class="sc-tag">{{ s.tag }}</span>
                <span v-if="selectedSensorIndex === i" class="sc-dot"></span>
              </div>
              <div class="sc-desc">{{ s.historyDesc }}</div>
            </div>
          </div>
          <div class="trend-chart-area" style="margin-top:16px">
            <div class="trend-chart-header">
              <span class="tch-title">{{ selectedSensor?.name || '—' }}</span>
              <span class="tch-hint">点击上方监控块切换趋势</span>
            </div>
            <div v-if="!trendLoaded" class="trend-skeleton-lg">
              <div class="trend-skel-pulse"></div>
              <span class="trend-skel-text">正在加载趋势数据…</span>
            </div>
            <svg v-else-if="currentTrendPoints" class="trend-svg-lg" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet">
              <line v-for="y in 5" :key="'g'+y" :x1="60" :y1="20 + (y-1)*36" :x2="780" :y2="20 + (y-1)*36" stroke="var(--border-secondary)" stroke-width="0.5" />
              <polyline :points="currentTrendPoints" fill="none" :stroke="trendColor" stroke-width="2.5" />
              <polygon :points="trendAreaPoints" :fill="trendColor" opacity="0.08" />
            </svg>
          </div>
        </div>

        <div v-if="activeSituationTab === 'workload'" class="situation-panel">
          <div class="block compact-evidence">
            <div class="block-title">工况分析</div>
            <div class="mechanism">
              <div class="mech-label">当前判断：</div>
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
          <div class="reason-table">
            <div class="rt-row rt-head"><span class="rt-col rt-fault">候选故障</span><span class="rt-col rt-cause">可能原因</span><span class="rt-col rt-effect">影响</span></div>
            <div v-for="(r, i) in product.ai.reasons" :key="i" class="rt-row">
              <span class="rt-col rt-fault"><span class="rt-prob" :class="r.prob">{{ r.probLabel }}</span>{{ r.fault }}</span>
              <span class="rt-col rt-cause">{{ r.cause }}</span>
              <span class="rt-col rt-effect">{{ r.effect }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ==== 排查项 ==== -->
      <template v-for="(item, idx) in (product.check?.checkItems || [])" :key="'pair-' + idx">
        <section
          v-if="activeTab === 'check-' + idx && isCheckVisible(idx)"
          :id="'check-card-' + idx"
          class="prod-body-wrap"
        >
          <div class="detail-sub-tabs">
            <button
              v-for="tab in checkSubTabs(item, idx)"
              :key="tab.key"
              class="detail-sub-tab"
              :class="{ active: activeCheckSubTab[idx] === tab.key }"
              @click="activeCheckSubTab[idx] = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <div v-if="activeCheckSubTab[idx] === 'warning'" class="detail-sub-panel">
            <div class="ci-warning check-warning-focus"><span class="ci-warning-label">注意事项</span>
              <ul class="ci-warning-list">
                <li v-for="(line, li) in item.warning.split('\n')" :key="li">{{ line }}</li>
              </ul>
              <div v-if="item.status === 'active'" class="ci-warning-confirm">
                <button class="ci-confirm-btn" @click.stop="confirmCheckWarning(idx)">确认，开始推进</button>
              </div>
            </div>
          </div>

          <div v-if="activeCheckSubTab[idx] === 'steps'" class="detail-sub-panel check-step-focus-panel">
            <!-- 圆点进度 -->
            <div class="check-step-dots-bar">
              <div class="check-step-dots">
                <span
                  v-for="(step, si) in item.steps"
                  :key="si"
                  class="check-step-dot"
                  :class="{ active: activeCheckStep(idx) === si, done: activeCheckStep(idx) > si }"
                ></span>
              </div>
            </div>

            <!-- 当前步骤标题 -->
            <div class="check-step-title">步骤{{ activeCheckStep(idx) + 1 }}：{{ compactStepTitle(currentCheckStep(item, idx).title) }}</div>

            <!-- 检查项 + 反馈（同一行：左侧描述，右侧选项） -->
            <ul class="ci-step-details check-step-list">
              <li v-for="(d, di) in currentCheckStep(item, idx).details" :key="di" class="ci-detail-row" :class="{ 'ci-detail-with-feedback': item.status === 'active' && getDetailFeedbackItem(item, activeCheckStep(idx), di) }">
                <span class="ci-detail-text">{{ d }}</span>
                <span v-if="item.status === 'active' && getDetailFeedbackItem(item, activeCheckStep(idx), di)" class="ci-detail-feedback">
                  <label v-for="(opt, oi) in getDetailFeedbackItem(item, activeCheckStep(idx), di).options" :key="oi" class="ci-inline-opt">
                    <input type="radio" :name="'check-' + idx + '-' + activeCheckStep(idx) + '-' + di" v-model="getDetailFeedbackItem(item, activeCheckStep(idx), di).selected" :value="oi" />
                    <span>{{ opt }}</span>
                  </label>
                </span>
              </li>
            </ul>
            <div v-if="idx === 0 && activeCheckStep(idx) === 0" class="ci-step-diagram">
              <img src="/check-sample.jpg" alt="现场参考图" @click.stop="openLightbox('/check-sample.jpg')" />
            </div>
            <div v-if="idx === 1 && activeCheckStep(idx) === 0" class="ci-step-diagram">
              <img src="/check-sample-2.jpg" alt="现场参考图" @click.stop="openLightbox('/check-sample-2.jpg')" />
            </div>

            <!-- 备注 -->
            <div v-if="item.status === 'active'" :id="'check-feedback-' + idx" class="ci-inline-note">
              <div class="ci-inline-note-label">当前步骤备注</div>
              <textarea v-model="item.feedbackNotes" class="ci-inline-textarea" placeholder="记录读数、现场现象、照片编号等，可为空"></textarea>
            </div>

            <!-- 底部按钮 -->
            <div v-if="item.status === 'active'" class="ci-actions check-step-actions">
              <button class="ci-action-btn ci-action-secondary" :disabled="activeCheckStep(idx) === 0" @click.stop="prevCheckStep(idx)">上一步</button>
              <button v-if="activeCheckStep(idx) < item.steps.length - 1" class="ci-action-btn ci-action-feedback" @click.stop="nextCheckStep(idx)">下一步</button>
              <button v-else class="ci-action-btn ci-action-feedback" @click.stop="submitInlineFeedback(idx)">提交排查反馈</button>
            </div>
          </div>

          <div v-if="activeCheckSubTab[idx] === 'summary'" class="detail-sub-panel">
            <div v-if="item.feedback && item.feedback.length" class="ci-feedback-summary">
              <div class="ci-summary-label">登记反馈摘要</div>
              <div v-for="(f, fi) in item.feedback" :key="fi" class="ci-feedback-row">
                <span>{{ f.item }} → </span>
                <span :class="f.status === 'abnormal' ? 'ci-f-abnormal' : 'ci-f-normal'">{{ f.display }}</span>
              </div>
              <div v-if="item.notes" class="ci-notes">备注：{{ item.notes }}</div>
            </div>
            <div v-else class="empty-sub-panel">暂无反馈记录</div>
          </div>
        </section>

        <!-- 维修项 -->
        <section
          v-if="activeTab === 'repair-' + idx && item.repair && item.status === 'done-abnormal'"
          :id="'repair-card-' + idx"
          class="prod-body-wrap"
        >
          <div class="detail-sub-tabs">
            <button
              v-for="tab in repairSubTabs"
              :key="tab.key"
              class="detail-sub-tab"
              :class="{ active: activeRepairSubTab[idx] === tab.key }"
              @click="activeRepairSubTab[idx] = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <div v-if="activeRepairSubTab[idx] === 'safety'" class="detail-sub-panel repair-flow-panel">
            <div class="ci-warning repair-warning-panel">
              <span class="ci-warning-label">注意事项</span>
              <ul class="ci-warning-list repair-warning-list">
                <li v-for="(w, wi) in item.repair.safety" :key="wi">{{ w }}</li>
              </ul>
            </div>

            <div class="repair-parts-panel">
              <div class="repair-section-head">
                <div>
                  <div class="block-title">备件清单</div>
                  <p class="repair-section-desc">维修开始前核对库存、型号和替代件适配性，避免拆开后等待物料。</p>
                </div>
                <span class="repair-count">{{ item.repair.parts.length }} 项</span>
              </div>
              <div class="repair-parts-table-wrap">
                <table class="repair-parts-table">
                  <thead>
                    <tr>
                      <th>备件/工具</th>
                      <th>规格</th>
                      <th>数量</th>
                      <th>用途</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(part, pi) in item.repair.parts" :key="pi">
                      <td>{{ repairPartCell(part, 'name') }}</td>
                      <td>{{ repairPartCell(part, 'spec') }}</td>
                      <td>{{ repairPartCell(part, 'qty') }}</td>
                      <td>{{ repairPartCell(part, 'usage') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="item.repaired === undefined" class="repair-actions repair-actions-right">
              <button class="ra-btn ra-primary" @click="confirmRepairPrep(idx)">确认，开始推进</button>
            </div>
          </div>

          <div v-if="activeRepairSubTab[idx] === 'steps'" class="detail-sub-panel repair-flow-panel">
            <div class="repair-step-list">
              <div v-for="(s, si) in item.repair.steps" :key="si" class="repair-step-card">
                <div class="repair-step-index">{{ si + 1 }}</div>
                <div class="repair-step-main">
                  <div class="repair-step-title">{{ repairStepTitle(s) }}</div>
                  <ul class="repair-step-details">
                    <li v-for="(d, di) in repairStepDetails(s)" :key="di">{{ d }}</li>
                  </ul>
                </div>
              </div>
            </div>
            <div v-if="item.repaired === undefined" class="repair-actions repair-actions-right">
              <button class="ra-btn ra-primary" @click="finishRepairWork(idx)">处理完成，推进验收</button>
            </div>
          </div>

          <div v-if="activeRepairSubTab[idx] === 'acceptance'" class="detail-sub-panel repair-flow-panel">
            <div class="block accept-inline repair-accept-panel">
              <div class="block-title">验收标准</div>
              <div class="repair-accept-grid">
                <div v-for="(row, ai) in repairAcceptanceRows(item.repair.acceptance)" :key="ai" class="repair-accept-row">
                  <div class="accept-name">{{ row.name }}</div>
                  <div class="accept-req">{{ row.req }}</div>
                  <div class="accept-method">{{ row.method }}</div>
                </div>
              </div>
            </div>
            <div v-if="item.repaired === undefined" class="repair-actions">
              <button class="ra-btn ra-resolved" @click="markItemRepaired(idx)">事件已解决，验收通过</button>
              <button class="ra-btn ra-continue" @click="markItemNotFixed(idx)">事件仍异常，继续排查</button>
            </div>
          </div>
        </section>
      </template>

      <!-- ==== 事件记录 ==== -->
      <section
        v-if="activeTab === 'report' && (showReportCard || currentStage === 'S5')"
        id="event-record-card"
        class="prod-body-wrap"
      >
        <div class="detail-sub-tabs">
          <button
            v-for="tab in reportSubTabs"
            :key="tab.key"
            class="detail-sub-tab"
            :class="{ active: activeReportSubTab === tab.key }"
            @click="activeReportSubTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="activeReportSubTab === 'summary'" class="detail-sub-panel">
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
          </div>
        </div>

        <div v-if="activeReportSubTab === 'timeline'" class="detail-sub-panel">
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
          <div v-else class="empty-sub-panel">暂无处理时间线</div>
        </div>

        <div v-if="activeReportSubTab === 'feedback'" class="detail-sub-panel">
          <div v-if="manualFeedback" class="report-key">
            <div class="rk-row">
              <span class="rk-label">手动反馈</span>
              <span class="rk-text">{{ manualFeedback }}</span>
            </div>
          </div>
          <div v-else class="empty-sub-panel">暂无手动反馈</div>
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

const eventStage = inject('eventStage', reactive({}))
const eventAssistantAction = inject('eventAssistantAction', reactive({}))
const eventAssistantCommand = inject('eventAssistantCommand', reactive({}))
const eventSituationTabs = inject('eventSituationTabs', reactive({}))

const currentStage = computed(() => eventStage[props.event?.id] || 'S1')
const activeTab = ref('situation')
const activeSituationTab = ref('summary')
const situationTabs = [
  { key: 'summary', label: '事件概况' },
  { key: 'data', label: '数据概览' },
  { key: 'workload', label: '工况分析' }
]
const situationTabOrder = ['summary', 'data', 'workload']
const unlockedSituationTabs = reactive({ summary: true, data: false, workload: false })
const visibleSituationTabs = computed(() => situationTabs.filter(tab => unlockedSituationTabs[tab.key]))

// 大卡内部子 tab 状态
const activeCheckSubTab = reactive({})
const activeRepairSubTab = reactive({})
const activeReportSubTab = ref('summary')
const lightboxUrl = ref(null)
function openLightbox(url) { lightboxUrl.value = url }
const repairSubTabs = [
  { key: 'safety', label: '注意事项与备件' },
  { key: 'steps', label: '维修步骤' },
  { key: 'acceptance', label: '验收标准' }
]
const reportSubTabs = [
  { key: 'summary', label: '处理摘要' },
  { key: 'timeline', label: '处理时间线' },
  { key: 'feedback', label: '手动反馈' }
]
function checkSubTabs(item, idx) {
  const tabs = [
    { key: 'warning', label: '注意事项' },
    { key: 'steps', label: '排查步骤' }
  ]
  if (item.feedback && item.feedback.length) {
    tabs.push({ key: 'summary', label: '反馈摘要' })
  }
  if (!activeCheckSubTab[idx]) activeCheckSubTab[idx] = 'warning'
  return tabs
}

const stageTabs = computed(() => {
  const tabs = [{ key: 'situation', label: '事件情况', type: 'situation' }]
  const items = product.value?.check?.checkItems || []
  for (let idx = 0; idx < items.length; idx++) {
    if (!isCheckVisible(idx)) continue
    tabs.push({ key: 'check-' + idx, label: shortCheckTitle(items[idx].title), type: 'check', idx })
    const item = items[idx]
    if (item.repair && item.status === 'done-abnormal') {
      tabs.push({ key: 'repair-' + idx, label: shortRepairTitle(item.title), type: 'repair', idx })
    }
  }
  if (showReportCard.value || currentStage.value === 'S5') {
    tabs.push({ key: 'report', label: '事件记录', type: 'report' })
  }
  return tabs
})

function taskKicker(tab) {
  const map = { situation: '事件底稿', check: '排查任务', repair: '维修任务', report: '闭环归档' }
  return map[tab.type] || '任务'
}

function taskStatusClass(tab) {
  if (tab.type === 'situation') return 'status-done'
  if (tab.type === 'report') return currentStage.value === 'S5' ? 'status-done' : 'status-active'
  const item = product.value?.check?.checkItems?.[tab.idx]
  if (!item) return ''
  if (tab.type === 'check') return 'status-' + checkItemStatusClass(item)
  if (tab.type === 'repair') return item.repaired === true ? 'status-done' : item.repaired === false ? 'status-abnormal' : 'status-active'
  return ''
}

function taskStatusText(tab) {
  if (tab.type === 'situation') return '已生成'
  if (tab.type === 'report') return currentStage.value === 'S5' ? '已归档' : '待确认'
  const item = product.value?.check?.checkItems?.[tab.idx]
  if (!item) return ''
  if (tab.type === 'check') {
    if (item.status === 'done-normal') return '正常'
    if (item.status === 'done-abnormal') return '已反馈'
    if (item.status === 'active') return '进行中'
    return '待开始'
  }
  if (tab.type === 'repair') {
    if (item.repaired === true) return '已解决'
    if (item.repaired === false) return '未解决'
    return '待维修'
  }
  return ''
}

// ============ 折叠状态 ============
const aiExpanded = ref(true)
const reportExpanded = ref(false)
const showReportCard = ref(false)
const needsManualClose = ref(false)
const isFalseAlarm = ref(false)
const manualFeedback = ref('')

function syncSituationTabs() {
  if (!props.event) return
  const eid = props.event.id
  if (!eventSituationTabs[eid]) eventSituationTabs[eid] = reactive({ unlocked: {}, active: 'summary' })
  eventSituationTabs[eid].unlocked = { ...unlockedSituationTabs }
  eventSituationTabs[eid].active = activeSituationTab.value
}

function unlockSituationTab(tabKey) {
  if (!situationTabOrder.includes(tabKey)) return
  unlockedSituationTabs[tabKey] = true
  activeTab.value = 'situation'
  activeSituationTab.value = tabKey
  syncSituationTabs()
  pulseInto('situation', 700)
}

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
const activeCheckStepMap = reactive({})

// 标题清理：去掉"排查/维修"后缀，取简短名
function cleanTitle(title) {
  const t = (title || '').replace(/[排维]修$/, '').replace(/排查$/, '')
  return t
}
function shortCheckTitle(title) {
  const t = cleanTitle(title)
  const map = {
    '液压系统故障': '液压系统',
    '系统或油柜吸口堵塞': '系统或油柜吸口',
    '压力传感器故障': '压力传感器',
    '系统管线泄漏': '管线泄漏',
  }
  return '排查' + (map[t] || t)
}
function shortRepairTitle(title) {
  const t = cleanTitle(title)
  const map = {
    '液压系统故障': '液压系统',
    '系统或油柜吸口堵塞': '系统或油柜吸口',
    '压力传感器故障': '压力传感器',
    '系统管线泄漏': '管线泄漏',
  }
  return '维修' + (map[t] || t)
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

function activeCheckStep(idx) {
  return Number(activeCheckStepMap[idx] || 0)
}
function setActiveCheckStep(idx, stepIdx) {
  const item = product.value?.check?.checkItems?.[idx]
  const max = Math.max(0, (item?.steps?.length || 1) - 1)
  activeCheckStepMap[idx] = Math.min(Math.max(Number(stepIdx) || 0, 0), max)
}
function currentCheckStep(item, idx) {
  return item?.steps?.[activeCheckStep(idx)] || { title: '', details: [] }
}
function nextCheckStep(idx) { setActiveCheckStep(idx, activeCheckStep(idx) + 1) }
function prevCheckStep(idx) { setActiveCheckStep(idx, activeCheckStep(idx) - 1) }
function compactStepTitle(title) {
  const map = {
    '检查液压油箱外观及液位': '排查液压油箱',
    '记录油位和油温数据': '排查油位和油温',
    '检查管路接头及软管段': '排查管路接头和软管',
    '使用检漏剂定位微漏点': '检测定位微漏点',
    '检查吸油口滤网状态': '排查吸油口滤网',
    '测量吸口负压值': '测量吸口负压',
    '检查油箱底部沉积物': '排查底部沉积物',
    '传感器校验': '校验传感器',
    '电磁干扰排查': '排查电磁干扰',
    '分段检查高压管路': '分段排查高压管路',
    '执行机构密封检查': '排查执行机构密封',
    '记录并拍照': '记录拍照取证'
  }
  return map[title] || title
}

function confirmCheckWarning(idx) {
  const item = product.value?.check?.checkItems?.[idx]
  if (!item) return
  ensureFeedbackDraft(item, idx)
  activeCheckStepMap[idx] = 0
  activeCheckSubTab[idx] = 'steps'
  scrollIntoCard('check-card-' + idx, 80)
}

function confirmRepairPrep(idx) {
  const item = product.value?.check?.checkItems?.[idx]
  if (!item?.repair) return
  activeRepairSubTab[idx] = 'steps'
  scrollIntoCard('repair-card-' + idx, 80)
}

function finishRepairWork(idx) {
  const item = product.value?.check?.checkItems?.[idx]
  if (!item?.repair) return
  activeRepairSubTab[idx] = 'acceptance'
  scrollIntoCard('repair-card-' + idx, 80)
}

function repairPartCell(part, key) {
  if (part && typeof part === 'object') return part[key] || '-'
  if (key === 'name') return String(part || '-')
  if (key === 'qty') {
    const text = String(part || '')
    const match = text.match(/×\s*([^/]+)/)
    return match ? match[1] : '-'
  }
  return '-'
}

function repairStepTitle(step) {
  return typeof step === 'object' ? step.title : step
}
function repairStepDetails(step) {
  return Array.isArray(step?.details) ? step.details : []
}
function repairStepResult(step) {
  return typeof step === 'object' ? step.result : ''
}
function repairAcceptanceRows(acceptance) {
  if (Array.isArray(acceptance)) return acceptance
  return [{ name: '综合验收', req: acceptance || '关键参数恢复正常范围', method: '现场复测并持续观察' }]
}

function openFeedbackModal(idx) {
  const item = product.value?.check?.checkItems?.[idx]
  if (!item) return
  ensureFeedbackDraft(item, idx)
  activeCheckSubTab[idx] = 'steps'
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
    activeTab.value = 'repair-' + idx
    scrollIntoCard('repair-card-' + idx)
    if (props.event) {
      eventStage[props.event.id] = 'S4'
      eventAssistantAction[props.event.id] = 'check_abnormal_' + idx
    }
    return
  }

  // 正常项：折叠当前排查卡片，找下一个可用的排查项
  checkCardsExpanded[idx] = false
  let nxt = idx + 1
  while (nxt < items.length && (items[nxt].status === 'done-normal' || items[nxt].status === 'done-abnormal')) {
    nxt++
  }
  if (nxt < items.length) {
    if (items[nxt].status === 'pending') {
      items[nxt].status = 'active'
      ensureFeedbackDraft(items[nxt], nxt)
    }
    activeCheckSubTab[nxt] = 'warning'
    checkCardsExpanded[nxt] = true
    activeTab.value = 'check-' + nxt
    scrollIntoCard('check-card-' + nxt)
    eventAssistantAction[props.event.id] = 'check_normal_' + idx + '|' + nxt
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
    showReportCard.value = true
    reportExpanded.value = true
    activeTab.value = 'report'
    // 根据异常状态判断走哪种闭环
    const hasAbnormal = items.some(i => i.status === 'done-abnormal')
    const hasUnresolved = items.some(i => i.status === 'done-abnormal' && i.repaired === false)
    const hasResolved = items.some(i => i.status === 'done-abnormal' && i.repaired === true)
    if (hasUnresolved) {
      needsManualClose.value = true
      if (props.event) eventStage[props.event.id] = 'S5'
      scrollIntoCard('event-record-card')
    } else if (!hasAbnormal) {
      // 全部正常
      needsManualClose.value = false
      if (props.event) eventStage[props.event.id] = 'S5'
    } else {
      // 有异常但都解决了
      if (props.event) eventStage[props.event.id] = 'S5'
    }
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
  activeTab.value = 'report'
  if (props.event) eventStage[props.event.id] = 'S5'
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
  // 找下一个需要处理的排查项（跳过已完成的）
  let nxt = idx + 1
  while (nxt < items.length && (items[nxt].status === 'done-normal' || items[nxt].status === 'done-abnormal')) {
    nxt++
  }
  if (nxt < items.length) {
    if (items[nxt].status === 'pending') {
      items[nxt].status = 'active'
      ensureFeedbackDraft(items[nxt], nxt)
    }
    activeCheckSubTab[nxt] = 'warning'
    checkCardsExpanded[nxt] = true
    activeTab.value = 'check-' + nxt
    scrollIntoCard('check-card-' + nxt)
    eventAssistantAction[props.event.id] = 'repair_not_fixed_' + idx + '|' + nxt
  } else {
    // 没有更多排查项了，直接完结
    checkAllDone()
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
    ai: { verdict: '', dataSnapshot: '', dataLine: '', advice: '', eventInfo: [], eventNarrative: '', initialConclusion: '', confidence: 0, recommendation: '', keyFindings: [], metrics: [], faultMatch: [], reasons: [] },
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
  const triggerValue = firstSensor.value && firstSensor.unit ? `${firstSensor.value}${firstSensor.unit}` : '已达到规则阈值'
  const triggerCondition = ev.aiAnalysis?.triggerCondition || `${firstSensor.name}超过设定观察阈值，触发系统预监控规则`
  const eventNarrative = `本次事件由${sys}在${formatTime(ev.createdAt)}触发，触发条件为${triggerCondition}；触发时${firstSensor.name}为${triggerValue}，系统同步记录${relatedNames}变化，用于判断是否存在供给不足、控制偏差或传感器异常趋势。`
  const recommendation = `建议持续监控${firstSensor.name}与${relatedNames}变化；在下一航次或合适窗口检查相关泵组、控制阀、滤器及传感器回路，若趋势继续偏离则进入现场排查。`
  const ai = {
    verdict: `${firstSensor.name}当前为 ${firstSensor.value}${firstSensor.unit}，系统结合多项传感器实际数据与短时趋势判定本次事件需要处置。`,
    dataLine: `本次事件发生时，${firstSensor.name}为 ${firstSensor.value}${firstSensor.unit}，近 12 分钟未见回落；同时关联的${relatedNames}也出现同步偏离，需联合评估整体运行状态。`,
    advice: `建议立即按"诊断-隔离-排查-维修-验收"流程处置，优先排查与${firstSensor.name}直接耦合的回路与执行机构，避免故障扩散。`,
    eventInfo: [
      { label: '时间', value: formatTime(ev.createdAt) },
      { label: '设备系统', value: sys },
      { label: '触发来源', value: ev.source || '系统监测规则' },
      { label: '触发条件', value: triggerCondition }
    ],
    eventNarrative,
    initialConclusion: ev.aiAnalysis?.conclusion || 'suspected（疑似异常）',
    confidence: ev.aiAnalysis?.confidence || 60,
    recommendation,
    keyFindings: [
      `${firstSensor.name}已超过当前工况下的安全观察区间，短时未出现自然回落。`,
      `${relatedNames}与主参数同向偏离，说明不是单点采样噪声，更像系统性波动。`,
      `建议先保护设备运行边界，再按任务卡逐项排查，避免一次性展开过多信息。`
    ],
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
        warning: '拆卸油箱盖板前确认液压系统已泄压至零，操作面板挂"禁止启动"标识\n高压液压油泄漏非常危险，检查时佩戴防油手套和护目镜\n泵柱塞磨损初期可能不表现明显压力下降，仅反映为执行器行程异常\n记录所有原始数据后再行拆装，参照液压系统原理图排查',
        steps: [
          { title: '检查液压油箱外观及液位', details: ['目视检查油箱外壁焊缝处有无渗漏油渍', '对比液位计读数与远程监控值是否一致'] },
          { title: '记录油位和油温数据', details: ['拍照记录液位计当前读数及液压油温度', '读取系统压力表稳态值（正常16~21MPa）'] },
          { title: '检查管路接头及软管段', details: ['重点检查高压法兰接头和软管段有无渗油/鼓包/老化', '检查管路支架、弯头等应力集中部位有无湿润'] },
          { title: '使用检漏剂定位微漏点', details: ['在油液中加入紫外荧光示踪剂循环15min', '用UV灯照射疑似区域标记泄漏点并拍照'] }
        ],
        status: 'pending', feedback: null,
        repair: {
          safety: [
            '确认锚机已停机，液压系统已泄压至零，控制面板挂“禁止启动”标识',
            '拆卸法兰前用接油盘和吸油棉做好围挡，防止液压油进入舱底水系统',
            '更换密封件时不得用尖锐工具刮伤法兰密封面，旧垫片需完整留存便于复核',
            '复装前核对垫片材质、硬度和尺寸，禁止用非耐油橡胶临时代替'
          ],
          steps: [
            { title: '隔离并泄压', details: ['关闭锚机液压站供油阀和回油阀，确认压力表回零', '释放蓄能器残压并悬挂锁定牌，记录泄压完成时间'], result: '压力表读数 0MPa，现场无残余喷溅风险' },
            { title: '拆检渗漏法兰', details: ['按对角顺序松开法兰螺栓，拆下旧 NBR 垫片和 O 型圈', '检查法兰密封面是否有划痕、压痕或杂质嵌入'], result: '密封面清洁无毛刺，旧件已拍照归档' },
            { title: '更换密封件并复装', details: ['安装 NBR Shore A 70±5 法兰垫片，O 型圈薄涂液压油后入槽', '螺栓按 30Nm、45Nm、50±2Nm 三轮对角紧固'], result: '力矩记录完整，法兰贴合均匀无偏压' },
            { title: '试压与复位', details: ['低压循环 5 分钟排气，再升至 16MPa 保压 10 分钟', '清理现场油污，恢复阀位并更新维修记录'], result: '试压期间无渗漏，锚机低速动作平稳' }
          ],
          parts: [
            { name: '法兰密封垫片', spec: 'NBR Shore A 70±5', qty: '2 片', usage: '替换渗漏法兰主密封' },
            { name: 'O 型密封圈', spec: '耐油丁腈橡胶 / 匹配法兰槽', qty: '4 个', usage: '更换老化副密封' },
            { name: '力矩扳手', spec: '5-80Nm，校验有效期内', qty: '1 把', usage: '三轮对角紧固复核' },
            { name: '吸油棉与接油盘', spec: '舱内防污染套件', qty: '1 套', usage: '拆装期间油液收集' }
          ],
          acceptance: [
            { name: '静态保压', req: '16MPa 保压 10min 无压降', method: '现场压力表读数复核' },
            { name: '法兰渗漏', req: '密封面及螺栓孔无油迹', method: '白布擦拭 + 目视检查' },
            { name: '动作验证', req: '锚机低速/中速动作平稳', method: '空载动作 3 次并记录' },
            { name: '趋势观察', req: '24h 油位变化 <2%', method: '系统趋势图持续跟踪' }
          ]
        }
      },
      {
        title: '系统或油柜吸口堵塞排查',
        warning: '油柜吸口堵塞通常伴随进机压力波动，拆检前关闭相关阀门并锁定\n拆检吸口滤器时注意油温，高温可能导致烫伤\n取样时注意容器清洁，避免二次污染油液\n检查燃油日用柜放残，确认无积水或杂质',
        steps: [
          { title: '检查吸油口滤网状态', details: ['拆检吸口滤器有无堵塞/异物附着，记录杂质类型', '评估滤网通流面积减少百分比'] },
          { title: '测量吸口负压值', details: ['在额定流量下读取吸入侧真空表数值', '对比历史正常负压基准判断有无异常阻力'] },
          { title: '检查油箱底部沉积物', details: ['打开放油旋塞取样底部油液，观察有无金属屑/水分', '用磁铁检查铁磁性颗粒含量，评估是否需彻底清洗'] }
        ],
        status: 'pending', feedback: null,
        repair: {
          safety: ['停机泄压后操作，关闭吸入口前后阀并悬挂锁定牌', '拆检滤器前确认油温低于 45°C，佩戴防油手套', '滤芯和沉积物需单独封样，便于判断污染来源'],
          steps: [
            { title: '拆检吸口滤网', details: ['拆下吸口滤网并拍照记录堵塞面积', '使用清洁液反向冲洗并检查滤网破损'], result: '滤网通流面积恢复至 90% 以上' },
            { title: '清理油箱沉积物', details: ['打开放残点排出底部含水油样', '用无纤维布清理底部金属屑和胶质沉积'], result: '底部油样无明显水分和大颗粒杂质' },
            { title: '更换回油滤芯并补油', details: ['安装新回油滤芯并记录型号批次', '经 60 目过滤漏斗补油至液位 60-70%'], result: '滤器压差回落至 0.03MPa 以下' }
          ],
          parts: [
            { name: '回油过滤器滤芯', spec: '10μm / 匹配液压站型号', qty: '1 支', usage: '替换污染滤芯' },
            { name: 'ISO VG 46 液压油', spec: '同批次或兼容牌号', qty: '20L', usage: '清理后补油' },
            { name: '取样瓶', spec: '洁净透明瓶', qty: '2 个', usage: '留存底部油样' }
          ],
          acceptance: [
            { name: '滤器压差', req: '≤0.03MPa', method: '压差计读数' },
            { name: '吸口负压', req: '恢复历史正常区间', method: '额定流量下真空表读数' },
            { name: '油位', req: '液位 60-70%', method: '液位计和远程值双重确认' }
          ]
        }
      },
      {
        title: '压力传感器故障排查',
        warning: '断开传感器前确保发动机处于安全状态\n燃油轨压变送器（4-20mA信号）断开不会影响控制系统功能\n如确认传感器故障，更换后需校验零点\n注意防止电磁干扰影响测量精度',
        steps: [
          { title: '传感器校验', details: ['使用标准传感器对核心监控传感器进行参照校验', '检查传感器供电回路是否稳定（24V±5%）'] },
          { title: '电磁干扰排查', details: ['检查传感器电缆屏蔽层接地是否良好', '使用示波器观察信号是否存在高频噪声'] }
        ],
        status: 'pending', feedback: null,
        repair: {
          safety: ['确认传感器回路已断电，拆线前拍照记录端子序号', '佩戴防静电腕带，避免损坏新传感器敏感元件', '更换后必须做零点和量程校验，不能只看通电有数值'],
          steps: [
            { title: '拆除旧传感器', details: ['记录旧传感器铭牌、量程和接线端子位置', '拆除前测量供电电压，确认回路已隔离'], result: '旧件封存，端子编号清晰' },
            { title: '安装并接线', details: ['安装同量程压力传感器，螺纹处按规范缠绕密封带', '屏蔽层单端接地，避免形成接地环流'], result: '供电 24V±5%，接线无松动' },
            { title: '校准与对比', details: ['用标准压力源校验零点、50%、满量程三点', '与机械压力表和系统历史曲线进行一致性对比'], result: '读数偏差 ≤2%，曲线无尖峰噪声' }
          ],
          parts: [
            { name: '压力传感器', spec: '4-20mA / 同量程替换', qty: '1 只', usage: '替换故障测点' },
            { name: '屏蔽电缆', spec: '船用屏蔽线', qty: '5m', usage: '修复老化或破损线段' },
            { name: '标准压力源', spec: '校验有效期内', qty: '1 台', usage: '零点与量程校准' }
          ],
          acceptance: [
            { name: '读数偏差', req: '≤2%', method: '标准压力源三点校验' },
            { name: '信号噪声', req: '无高频尖峰和跳变', method: '趋势图观察 15min' },
            { name: '接地屏蔽', req: '屏蔽层单端可靠接地', method: '万用表导通检查' }
          ]
        }
      },
      {
        title: '系统管线泄漏排查',
        warning: '高压液压油泄漏非常危险，检查时佩戴安全设备\n分段检查时注意系统压力，确认各段隔离阀状态\n泄漏通常伴随进机压力或共轨压力下降趋势\n管路伴热系统工作正常与否影响油温，检查时一并确认',
        steps: [
          { title: '分段检查高压管路', details: ['沿管路走向逐段目视检查接头、焊缝有无油渍', '重点检查弯头、三通等应力集中部位和法兰密封垫片'] },
          { title: '执行机构密封检查', details: ['检查液压缸活塞杆和液压马达轴封处有无渗油', '观察执行机构动作是否平稳无爬行'] },
          { title: '记录并拍照', details: ['对每个可疑泄漏点拍照标记坐标，在管路图上标注', '按严重程度分级（严重/中等/轻微），整理清单供维修参考'] }
        ],
        status: 'pending', feedback: null,
        repair: {
          safety: ['确认系统泄压至零，泄漏段前后阀已关闭并挂牌', '准备接油盘、吸油棉和灭火器，防止油液污染和火险', '处理弯头、三通等应力集中部位时避免强行撬动管线'],
          steps: [
            { title: '定位并隔离泄漏段', details: ['根据排查照片和管路图确认泄漏坐标', '关闭泄漏段前后隔离阀并排放残油'], result: '泄漏段已隔离，残油收集完成' },
            { title: '更换密封件', details: ['拆下渗漏部位垫片和 O 型圈，清洁密封面', '按规格更换新件并检查法兰平面度'], result: '密封面无划伤，新件型号匹配' },
            { title: '复装试压检漏', details: ['螺栓分三轮对角紧固并记录最终力矩', '恢复运行后用白布擦拭观察是否渗油'], result: '试压无可见渗漏，动作无异常振动' },
            { title: '24h 跟踪验证', details: ['记录维修后 2h、8h、24h 油位变化', '对比压力趋势和执行机构动作稳定性'], result: '24h 油位变化 <2%，压力曲线稳定' }
          ],
          parts: [
            { name: '法兰密封垫片', spec: 'NBR / 匹配管径', qty: '2 片', usage: '替换渗漏密封' },
            { name: 'O 型密封圈', spec: '耐油丁腈橡胶', qty: '4 个', usage: '替换副密封' },
            { name: '力矩扳手', spec: '5-80Nm', qty: '1 把', usage: '复装力矩控制' },
            { name: '白布与检漏剂', spec: '现场检漏套件', qty: '1 套', usage: '试压后复核' }
          ],
          acceptance: [
            { name: '可见渗漏', req: '无油迹、无湿润', method: '白布擦拭与目视检查' },
            { name: '压力稳定', req: '16-21MPa 区间内稳定', method: '在线趋势观察' },
            { name: '油位变化', req: '24h 变化 <2%', method: '液位计定时记录' }
          ]
        }
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

// 切换大 tab 时，保证子 tab 有默认值
watch(activeTab, (tab) => {
  if (!tab) return
  const checkMatch = tab.match(/^check-(\d+)$/)
  if (checkMatch) {
    const idx = Number(checkMatch[1])
    if (!activeCheckSubTab[idx]) activeCheckSubTab[idx] = 'warning'
    return
  }
  const repairMatch = tab.match(/^repair-(\d+)$/)
  if (repairMatch) {
    const idx = Number(repairMatch[1])
    if (!activeRepairSubTab[idx]) activeRepairSubTab[idx] = 'safety'
  }
})

// 小 tab 切换同步给右侧助手
watch(activeSituationTab, () => {
  syncSituationTabs()
})

// ============ 阶段 / 事件切换：折叠所有 → 展开当前 → 脉冲 ============
watch(() => [props.event?.id, currentStage.value], (newVal, oldVal) => {
  const [eid, stage] = newVal
  const [oldEid, oldStage] = oldVal || [undefined, undefined]
  if (!eid) return

  const isStageChanged = oldStage !== undefined && oldStage !== stage
  const isEventChanged = eid !== oldEid

  // 切事件：重置状态
  if (isEventChanged) {
    activeTab.value = 'situation'
    activeSituationTab.value = 'summary'
    Object.keys(unlockedSituationTabs).forEach(k => { unlockedSituationTabs[k] = k === 'summary' })
    aiExpanded.value = true
    reportExpanded.value = false
    needsManualClose.value = false
    isFalseAlarm.value = false
    manualFeedback.value = ''
    showReportCard.value = false
    selectedSensorIndex.value = 0
    trendLoaded.value = false
    activeReportSubTab.value = 'summary'
    Object.keys(activeCheckSubTab).forEach(k => delete activeCheckSubTab[k])
    Object.keys(activeRepairSubTab).forEach(k => delete activeRepairSubTab[k])
    setTimeout(() => { trendLoaded.value = true }, 600)
    // 重置排查和维修卡片
    Object.keys(checkCardsExpanded).forEach(k => delete checkCardsExpanded[k])
    Object.keys(repairCardsExpanded).forEach(k => delete repairCardsExpanded[k])
    syncSituationTabs()
  }

  // 阶段变化
  if (isStageChanged) {
    if (stage === 'S2') {
      const items = product.value?.check?.checkItems
      // Find the first visible/active check item
      let targetIdx = 0
      for (let i = 0; i < (items?.length || 0); i++) {
        if (isCheckVisible(i)) { targetIdx = i; break }
      }
      activeTab.value = 'check-' + targetIdx
    }
    if (stage === 'S4') {
      const items = product.value?.check?.checkItems
      let targetIdx = 0
      for (let i = 0; i < (items?.length || 0); i++) {
        if (items[i].status === 'done-abnormal' && items[i].repaired === undefined) { targetIdx = i; break }
      }
      activeTab.value = 'repair-' + targetIdx
    }
    if (stage === 'S5') {
      activeTab.value = 'report'
      reportExpanded.value = true
    }
  }

  // 初始化 S2：激活第一项排查
  if ((isStageChanged || isEventChanged) && stage === 'S2') {
    const items = product.value?.check?.checkItems
    if (items && items.length > 0 && items[0].status === 'pending') {
      items[0].status = 'active'
      ensureFeedbackDraft(items[0], 0)
      activeCheckSubTab[0] = 'warning'
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
    activeTab.value = 'report'
    scrollIntoCard('event-record-card')
    if (props.event) {
      eventStage[props.event.id] = 'S5'
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
    activeTab.value = 'report'
    scrollIntoCard('event-record-card')
    if (props.event) {
      eventStage[props.event.id] = 'S5'
      eventAssistantAction[props.event.id] = 'needs_manual_close'
    }
  }
})

// ============ 助手卡片联动：渐进展开子模块 ============
const cardToSection = {
  diagnosis: 'situation',
  snapshot: 'situation',
  guide: 'check',
  warning: 'check',
  report: 'report'
}
watch(() => eventAssistantAction[props.event?.id], (action) => {
  if (!action || !props.event) return
  stopStream()

  if (action === 'open_summary') {
    unlockSituationTab('summary')
    return
  }

  if (action === 'open_data') {
    unlockSituationTab('data')
    return
  }

  if (action === 'open_trend') {
    unlockSituationTab('data')
    return
  }

  if (action === 'open_workload') {
    unlockSituationTab('workload')
    return
  }

  if (action === 'view_ai') {
    unlockSituationTab('summary')
    return
  }

  // 激活第一个排查项
  if (action === 'check_activate_first') {
    activeTab.value = 'check-0'
    const items = product.value?.check?.checkItems
    if (items && items.length > 0 && items[0].status === 'pending') {
      items[0].status = 'active'
      ensureFeedbackDraft(items[0], 0)
      activeCheckSubTab[0] = 'warning'
      checkCardsExpanded[0] = true
    }
    return
  }

  // 标记为误报：折叠 AI 分析，展开事件记录
  if (action === 'false_alarm_closed') {
    aiExpanded.value = false
    showReportCard.value = true
    reportExpanded.value = true
    needsManualClose.value = false
    isFalseAlarm.value = true
    activeTab.value = 'report'
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

  if (section === 'check') {
    const items = product.value?.check?.checkItems || []
    let targetIdx = 0
    for (let i = 0; i < items.length; i++) {
      if (isCheckVisible(i)) { targetIdx = i; break }
    }
    activeTab.value = 'check-' + targetIdx
  } else if (section === 'repair') {
    const items = product.value?.check?.checkItems || []
    let targetIdx = 0
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'done-abnormal') { targetIdx = i; break }
    }
    activeTab.value = 'repair-' + targetIdx
  } else {
    activeTab.value = section
  }
  reportExpanded.value = (section === 'report')
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
  item.feedbackNotes = rawText || item.feedbackNotes
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
    if (activeIdx >= 0) { markNormal(activeIdx); return }
    // 没有 active 排查项了，检查是否全部完成
    checkAllDone()
    return
  }
  if (action === 'chip_open_feedback') {
    const activeIdx = items.findIndex(i => i.status === 'active')
    if (activeIdx < 0) return
    // 切到当前排查项
    activeTab.value = 'check-' + activeIdx
    activeCheckSubTab[activeIdx] = 'steps'
    // 展开"现场备注"和"提交反馈"区域
    setTimeout(() => {
      const el = document.getElementById('check-feedback-' + activeIdx)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
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
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  border-left: 1px solid var(--border-primary);
}

/* 返回悬浮按钮 */
.back-float {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 20;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s;
}
.back-float:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

/* 任务卡片轨道 */
.task-card-rail {
  display: flex;
  align-items: stretch;
  gap: 0;
  overflow-x: auto;
  padding: 54px 8px 14px 42px;
  flex-shrink: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.55), var(--bg-panel));
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.task-card-rail:hover { scrollbar-color: var(--border-primary) transparent; }
.task-card-rail::-webkit-scrollbar { height: 4px; }
.task-card-rail::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
.task-card-rail:hover::-webkit-scrollbar-thumb { background: var(--border-primary); }
.task-card-chip {
  --chip-accent: var(--accent);
  position: relative;
  flex: 0 0 172px;
  min-height: 74px;
  margin-left: -18px;
  padding: 12px 12px 10px 16px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: 1fr auto;
  gap: 8px 10px;
  border: 1px solid rgba(22, 119, 255, 0.12);
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(247,248,250,0.94));
  color: var(--text-primary);
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(25, 42, 70, 0.07);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  z-index: calc(1 + var(--stack-i));
  text-align: left;
}
.task-card-chip:first-child { margin-left: 0; }
.task-card-chip::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  border-radius: 16px 0 0 16px;
  background: var(--chip-accent);
  opacity: 0.72;
}
.task-card-chip:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--chip-accent) 38%, var(--border-primary));
  box-shadow: 0 14px 30px rgba(25, 42, 70, 0.12);
}
.task-card-chip.active {
  flex-basis: 208px;
  transform: translateY(-8px);
  border-color: color-mix(in srgb, var(--chip-accent) 58%, var(--border-primary));
  box-shadow: 0 18px 36px rgba(22, 119, 255, 0.18);
}
.task-check { --chip-accent: #1677ff; }
.task-repair { --chip-accent: #ff7d00; }
.task-report { --chip-accent: #00b42a; }
.task-card-index {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--chip-accent) 11%, #fff);
  color: var(--chip-accent);
  font-size: 0.78rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.task-card-main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.task-card-kicker {
  color: var(--text-muted);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}
.task-card-title {
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.28;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-card-state {
  grid-column: 2;
  justify-self: start;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--chip-accent) 10%, #fff);
  color: var(--chip-accent);
  font-size: 0.75rem;
  font-weight: 650;
}
.status-abnormal { --chip-accent: var(--danger); }
.status-active { --chip-accent: var(--accent); }
.status-done { --chip-accent: var(--success); }
.status-pending { --chip-accent: #8a95a6; }

.prod-body-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 0 18px 22px;
}

/* ============ Drawer Body ============ */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 24px;
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
.stage-panel { max-width: 100%; }
.situation-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 14px;
  background: var(--bg-hover);
  border: 1px solid var(--border-secondary);
  border-radius: 20px;
  overflow-x: auto;
}
.situation-tab {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.situation-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.5); }
.situation-tab.active {
  background: var(--bg-surface);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.situation-panel {
  min-height: 120px;
  font-size: 0.92rem;
}
.situation-tabs {
  margin-left: 2px;
}


/* 大卡内部子 tab */
.detail-sub-tabs {
  display: inline-flex;
  gap: 3px;
  padding: 2px;
  margin-bottom: 14px;
  background: var(--bg-hover);
  border: 1px solid var(--border-secondary);
  border-radius: 16px;
  overflow-x: auto;
}
.detail-sub-tab {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.detail-sub-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.5); }
.detail-sub-tab.active {
  background: var(--bg-surface);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.detail-sub-panel { min-height: 120px; }
.empty-sub-panel {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
  background: var(--bg-panel);
  border: 1px dashed var(--border-secondary);
  border-radius: 6px;
}

.overview-summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
}
.overview-section {
  min-height: auto;
  padding: 14px;
  border: 1px solid var(--border-secondary);
  border-radius: 16px;
  background: rgba(255,255,255,0.82);
  box-shadow: 0 8px 22px rgba(25, 42, 70, 0.06);
}
.section-heading {
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.3;
  font-weight: 760;
}
.event-info-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  border: 1px solid var(--border-secondary);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-surface);
}
.event-info-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-secondary);
  border-right: 1px solid var(--border-secondary);
}
.event-info-row:nth-child(2n) { border-right: 0; }
.event-info-row:nth-last-child(-n + 2) { border-bottom: 0; }
.event-info-label {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}
.event-info-value {
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.6;
  font-weight: 620;
}
.event-info-narrative {
  margin: 12px 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.75;
}
.conclusion-stack {
  display: grid;
  gap: 10px;
}
.conclusion-block {
  padding: 11px 13px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-secondary);
}
.conclusion-top-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
}
.conclusion-main .conclusion-label { margin-bottom: 4px; }
.confidence-ring-wrap { flex-shrink: 0; }
.confidence-ring-sm { width: 68px; height: 68px; }
.confidence-ring-sm .confidence-ring-inner { width: 48px; height: 48px; }
.conclusion-label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}
.conclusion-value {
  color: var(--text-primary);
  font-size: 1.03rem;
  line-height: 1.45;
  font-weight: 760;
}
.confidence-row {
  display: grid;
  gap: 10px;
  align-items: center;
}
.confidence-ring {
  margin: 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(var(--accent) var(--confidence-deg), var(--bg-panel) 0deg);
  box-shadow: inset 0 0 0 1px var(--border-secondary), 0 6px 14px rgba(22,119,255,0.10);
}
.confidence-ring-inner {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-secondary);
}
.confidence-value {
  color: var(--accent);
  font-size: 1.15rem;
  line-height: 1;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.suggestion-block {
  padding: 11px 13px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-secondary);
}
.suggestion-block p {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.92rem;
  line-height: 1.75;
}
@media (max-width: 900px) {
  .event-info-list { grid-template-columns: 1fr; }
  .event-info-row,
  .event-info-row:nth-child(2n) { border-right: 0; }
  .event-info-row:nth-last-child(-n + 2) { border-bottom: 1px solid var(--border-secondary); }
  .event-info-row:last-child { border-bottom: 0; }
  .conclusion-top-row { grid-template-columns: 1fr; }
  .confidence-ring-wrap { justify-self: center; }
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
.sc-desc {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}
.sc-flag {
  font-size: var(--font-xs);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1.4;
}
.sc-flag-over { background: var(--danger-bg); color: var(--danger); }
.sc-flag-warn { background: var(--warning-bg, rgba(255,125,0,0.08)); color: var(--warning); }

.sensor-card-h.sc-alert {
  border-left: 3px solid var(--danger);
}

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
.ci-warning { font-size: var(--font-sm); padding: 10px 12px; background: rgba(250,173,20,0.08); border-left: 3px solid var(--warning); border-radius: 0 4px 4px 0; margin-bottom: 12px; }
.ci-warning-label { font-weight: 700; color: var(--warning); display: block; margin-bottom: 6px; font-size: var(--font-base); }
.ci-warning-list { margin: 0; padding-left: 18px; color: var(--text-secondary); line-height: 1.7; }
.ci-warning-list li { margin-bottom: 4px; }
.ci-warning-list li::marker { color: var(--warning); }
.check-warning-focus {
  padding-bottom: 14px;
}
.ci-warning-confirm {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(250,173,20,0.28);
}
.ci-confirm-btn {
  min-height: 34px;
  padding: 0 16px;
  border: 1px solid var(--warning);
  border-radius: 18px;
  background: rgba(250,173,20,0.12);
  color: var(--warning);
  font-size: var(--font-sm);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.16s ease;
}
.ci-confirm-btn:hover {
  background: var(--warning);
  color: #fff;
  box-shadow: 0 8px 18px rgba(255,125,0,0.18);
}
.repair-warning-panel {
  width: 100%;
  box-sizing: border-box;
  min-height: 120px;
  padding: 14px 16px;
  border-radius: 0 10px 10px 0;
}
.repair-warning-list {
  font-size: var(--font-sm);
  line-height: 1.75;
}
.ci-steps-label { font-size: var(--font-sm); font-weight: 700; color: var(--warning); margin-bottom: 8px; }
.check-step-focus-panel { display: grid; gap: 10px; }
.check-step-dots-bar { display: flex; justify-content: center; padding: 2px 0 6px; }
.check-step-dots { display: flex; gap: 8px; align-items: center; }
.check-step-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border-primary); transition: all 0.2s; flex-shrink: 0; }
.check-step-dot.active { width: 12px; height: 12px; background: var(--accent); box-shadow: 0 0 0 4px rgba(22,119,255,0.16); }
.check-step-dot.done { background: var(--accent); opacity: 0.5; }
.check-step-title { font-size: 15px; font-weight: 760; color: var(--text-primary); line-height: 1.35; }

.check-step-list { display: grid; gap: 2px; }
.ci-step-details { margin: 0; padding-left: 18px; font-size: 14px; color: var(--text-secondary); line-height: 1.7; }
.ci-step-details li { margin-bottom: 6px; }
.ci-detail-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.ci-detail-with-feedback { padding-right: 4px; }
.ci-detail-text { flex: 1 1 auto; min-width: 0; }
.ci-detail-feedback { display: inline-flex; flex: 0 0 auto; flex-wrap: wrap; gap: 5px; align-items: center; }
.ci-step-diagram {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--bg-panel);
  border: 1px solid var(--border-secondary);
  border-radius: 4px;
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.ci-step-diagram img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}
.ci-actions { display: flex; gap: 12px; justify-content: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-primary); }
.check-step-actions { justify-content: flex-end; margin-top: 8px; }
.ci-action-btn { font-size: 14px; padding: 9px 26px; border-radius: 20px; border: 2px solid; cursor: pointer; font-weight: 600; transition: all 0.2s; background: var(--bg-surface); }
.ci-action-btn:disabled { opacity: 0.4; cursor: not-allowed; border-color: var(--border-primary); color: var(--text-muted); }
.ci-action-secondary { color: var(--text-secondary); border-color: var(--border-primary); }
.ci-action-secondary:hover:not(:disabled) { color: var(--text-primary); background: var(--bg-hover); }
.ci-action-feedback { color: var(--accent); border-color: var(--accent); }
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
  padding: 2px 7px;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12px;
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
  .check-step-grid { grid-template-columns: 1fr; }
}
@media (max-width: 860px) {
  .check-step-grid { grid-template-columns: 1fr; }
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
.repair-flow-panel { display: grid; gap: 14px; }
.repair-section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.repair-section-desc { margin: 4px 0 0; color: var(--text-muted); font-size: 12.5px; line-height: 1.6; }
.repair-count { flex-shrink: 0; padding: 4px 9px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); font-size: 12px; font-weight: 700; }
.repair-parts-panel { padding: 14px; border: 1px solid var(--border-secondary); border-radius: 12px; background: var(--bg-surface); box-shadow: 0 4px 14px rgba(25,42,70,0.04); }
.repair-parts-table-wrap { margin-top: 10px; overflow-x: auto; border: 1px solid var(--border-secondary); border-radius: 10px; }
.repair-parts-table { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 12.5px; }
.repair-parts-table th { text-align: left; padding: 9px 10px; color: var(--text-muted); font-weight: 700; background: var(--bg-panel); border-bottom: 1px solid var(--border-secondary); }
.repair-parts-table td { padding: 10px; color: var(--text-secondary); border-bottom: 1px solid var(--border-secondary); line-height: 1.55; }
.repair-parts-table tr:last-child td { border-bottom: 0; }
.repair-parts-table td:first-child { color: var(--text-primary); font-weight: 650; }
.repair-step-list { display: grid; gap: 10px; }
.repair-step-card { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 12px; border: 1px solid var(--border-secondary); border-radius: 12px; background: var(--bg-surface); }
.repair-step-index { width: 28px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: var(--accent-bg); color: var(--accent); font-weight: 800; font-size: 13px; }
.repair-step-title { color: var(--text-primary); font-weight: 700; font-size: 13.5px; margin-bottom: 6px; }
.repair-step-details { margin: 0; padding-left: 16px; color: var(--text-secondary); font-size: 12.5px; line-height: 1.65; }
.repair-step-details li { margin-bottom: 2px; }
.repair-step-result { margin-top: 8px; padding: 7px 9px; border-radius: 8px; background: var(--success-bg); color: var(--success); font-size: 12.5px; font-weight: 650; }
.repair-accept-panel { border-left: 0; }
.repair-accept-grid { display: grid; gap: 10px; }
.repair-accept-row { display: grid; grid-template-columns: minmax(120px, 0.8fr) minmax(160px, 1fr) minmax(160px, 1fr); gap: 10px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--success) 20%, var(--border-secondary)); border-radius: 10px; background: var(--success-bg); align-items: center; }
.accept-name { color: var(--text-primary); font-weight: 700; font-size: 13px; }
.accept-req { color: var(--success); font-weight: 700; font-size: 12.5px; }
.accept-method { color: var(--text-secondary); font-size: 12.5px; line-height: 1.5; }
.repair-actions-right { justify-content: flex-end; }
.ra-primary { color: var(--accent); border-color: var(--accent); background: var(--bg-surface); }
.ra-primary:hover { background: var(--accent-bg); transform: translateY(-1px); }
@media (max-width: 900px) { .repair-accept-row { grid-template-columns: 1fr; } }

/* 示例图放大遮罩 */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: fadeIn .2s;
}
.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 示例图 hover 提示 */
.ci-step-diagram img { cursor: zoom-in; }
.ci-step-diagram img:hover { opacity: 0.85; }
</style>
