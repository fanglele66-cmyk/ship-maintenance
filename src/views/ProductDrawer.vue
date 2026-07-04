<template>
  <div class="product-drawer" v-if="event">
    <!-- Header: 返回 + 4 段阶段进度条 -->
    <div class="drawer-header">
      <button class="back-btn" @click="handleBack">← 返回列表</button>
      <div class="stage-progress">
        <div
          v-for="(s, idx) in stageOrder"
          :key="s.key"
          class="sp-item"
          :class="{
            done: idx < currentStageIdx,
            active: idx === currentStageIdx,
            pending: idx > currentStageIdx
          }"
        >
          <span class="sp-dot">{{ idx < currentStageIdx ? '✓' : (idx + 1) }}</span>
          <span class="sp-label">{{ s.label }}</span>
          <span v-if="idx < stageOrder.length - 1" class="sp-line"></span>
          <span
            v-if="idx === currentStageIdx && streaming.section === sectionMap[s.key]"
            class="sp-cursor"
          ></span>
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
          <!-- ① 结论与建议（始终先出） -->
          <div class="block reveal-block" :class="{ revealed: revealedSubs.ai_conclusion }">
            <div class="block-title">结论与建议</div>
            <div class="verdict">
              <div class="verdict-row"><span class="verdict-label">判定结论</span></div>
              <div class="verdict-text">{{ product.ai.verdict }}</div>
            </div>
            <div class="snapshot-mini">
              <div class="snapshot-mini-title">事发时数据快照</div>
              <div class="snapshot-mini-time">📅 {{ formatTime(event.snapshot?.snapshotTime || event.createdAt) }}</div>
              <ul class="snapshot-mini-list">
                <li v-for="(s, i) in event.snapshot?.sensors || []" :key="i">
                  <span class="sm-name">{{ s.name }}</span>
                  <span class="sm-val" :class="s.status">{{ s.value }}{{ s.unit }}</span>
                </li>
              </ul>
            </div>
            <div class="data-line"><span class="data-label">数据：</span>{{ product.ai.dataLine }}</div>
            <div class="advice-line"><span class="advice-label">建议：</span>{{ product.ai.advice }}</div>
          </div>

          <!-- ② 数据分析指标卡（snapshot 触发） -->
          <div v-if="revealedSubs.ai_data" class="block reveal-block revealed">
            <div class="block-title">数据分析</div>
            <div class="metric-grid">
              <div v-for="(m, i) in product.ai.metrics" :key="i" class="metric">
                <div class="metric-name">{{ m.name }}</div>
                <div class="metric-trend" :class="m.trend">
                  {{ m.trend === 'up' ? '↗' : m.trend === 'down' ? '↘' : '→' }} {{ m.trendLabel }}
                </div>
                <div class="metric-range">范围 {{ m.range }}</div>
                <div class="metric-row">
                  <span class="metric-current">{{ m.current }}</span><span class="metric-unit">{{ m.unit }}</span>
                </div>
                <div class="metric-analyze">{{ m.analyze }}</div>
              </div>
            </div>
          </div>

          <!-- ③ 趋势图（snapshot 触发 + 加载动画） -->
          <div v-if="revealedSubs.ai_trend" class="block reveal-block revealed">
            <div class="block-title">趋势图</div>
            <div class="trend-meta">事发前 24h · {{ event.snapshot?.sensors?.[0]?.name || '出口温度' }}</div>
            <!-- 加载骨架 -->
            <div v-if="!revealedSubs.ai_trend_loaded" class="trend-skeleton">
              <div class="trend-skel-pulse"></div>
              <span class="trend-skel-text">正在加载趋势数据…</span>
            </div>
            <!-- 实际图表 -->
            <svg v-else class="trend-svg" viewBox="0 0 600 140" preserveAspectRatio="none">
              <line v-for="y in 4" :key="'g'+y" :x1="0" :y1="y*30" :x2="600" :y2="y*30" stroke="var(--border-secondary)" stroke-width="1" />
              <line :x1="0" :y1="40" :x2="600" :y2="40" stroke="var(--danger)" stroke-width="1" stroke-dasharray="4 4" />
              <text x="595" y="36" text-anchor="end" font-size="10" fill="var(--danger)">阈值 85°C</text>
              <polyline v-if="trendPoints" :points="trendPoints" fill="none" stroke="var(--accent)" stroke-width="2" />
              <circle v-for="(p, i) in alertPoints" :key="'a'+i" :cx="p.x" :cy="p.y" r="3.5" fill="var(--danger)" stroke="var(--bg-surface)" stroke-width="1.5" />
            </svg>
            <div class="trend-legend">
              <span class="lg-item"><span class="lg-dot" style="background:var(--accent)"></span>实测值</span>
              <span class="lg-item"><span class="lg-dot" style="background:var(--danger)"></span>超阈值点</span>
            </div>
          </div>

          <!-- ④ 工程机理分析（diagnosis 触发） -->
          <div v-if="revealedSubs.ai_mechanism" class="block reveal-block revealed">
            <div class="block-title">工程机理分析</div>
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

          <!-- ⑤ 可能原因（diagnosis 触发） -->
          <div v-if="revealedSubs.ai_reasons" class="block reveal-block revealed">
            <div class="block-title">可能的原因与后果</div>
            <div class="reason-table">
              <div class="rt-row rt-head"><span class="rt-col rt-fault">候选故障</span><span class="rt-col rt-cause">可能原因</span><span class="rt-col rt-effect">直接后果</span></div>
              <div v-for="(r, i) in product.ai.reasons" :key="i" class="rt-row">
                <span class="rt-col rt-fault"><span class="rt-prob" :class="r.prob">{{ r.probLabel }}</span>{{ r.fault }}</span>
                <span class="rt-col rt-cause">{{ r.cause }}</span>
                <span class="rt-col rt-effect">{{ r.effect }}</span>
              </div>
            </div>
          </div>

          <!-- 流式进行中提示 -->
          <div v-if="currentSection === 'ai' && streaming.section === 'ai'" class="stream-tip">
            <span class="cursor-blink">▍</span> AI 正在生成分析…
          </div>
        </div>
      </section>

      <!-- 🔍 排查方案 -->
      <section
        v-if="visibleSections.check"
        class="prod-card"
        :class="{
          'card-current': currentSection === 'check',
          'card-collapsed': !checkExpanded
        }"
      >
        <header class="prod-head" @click="checkExpanded = !checkExpanded">
          <span class="prod-icon">🔍</span>
          <div class="prod-titles">
            <div class="prod-title">
              排查方案
              <span v-if="currentSection === 'check' && streaming.section === 'check'" class="prod-gen">生成中</span>
            </div>
            <div class="prod-sub">针对 {{ product.check.steps.length }} 个排查项的标准处置流程</div>
          </div>
          <span class="prod-toggle">{{ checkExpanded ? '▼' : '▶' }}</span>
        </header>

        <div v-show="checkExpanded" class="prod-body">
          <!-- ① 注意事项 -->
          <div class="block warn-block">
            <div class="block-title">⚠️ 注意事项</div>
            <ol class="warn-list">
              <li v-for="(w, i) in product.check.warnings" :key="i">{{ w }}</li>
            </ol>
          </div>

          <!-- ② 排查步骤 1-N -->
          <div class="block">
            <div class="block-title">排查步骤</div>
            <div v-for="(step, i) in product.check.steps" :key="i" class="step">
              <div class="step-head">
                <span class="step-num">{{ i + 1 }}</span>
                <span class="step-title">{{ step.title }}</span>
              </div>
              <div class="step-target">目标：{{ step.target }}</div>
              <ul class="step-sub">
                <li v-for="(sub, j) in step.subs" :key="j">
                  <span class="sub-tag" :class="sub.tag">{{ sub.tagLabel }}</span>
                  <span class="sub-text">{{ sub.text }}</span>
                </li>
              </ul>
              <div class="step-photo">
                <div class="photo-placeholder">📷 上传排查现场照片</div>
              </div>
            </div>
          </div>

          <!-- ③ 排查项清单（可勾选） -->
          <div class="block">
            <div class="block-title">排查项清单</div>
            <div
              v-for="(item, idx) in product.check.checklist"
              :key="idx"
              class="check-item"
              :class="{ done: item.done }"
              @click="item.done = !item.done"
            >
              <span class="check-box">{{ item.done ? '☑' : '☐' }}</span>
              <span class="check-text">{{ item.text }}</span>
              <span v-if="item.flag === 'abnormal'" class="check-flag">异常</span>
            </div>
          </div>

          <!-- 流式进行中提示 -->
          <div v-if="currentSection === 'check' && streaming.section === 'check'" class="stream-tip">
            <span class="cursor-blink">▍</span> 正在生成排查方案…
          </div>
        </div>
      </section>

      <!-- 🔧 维修方案 -->
      <section
        v-if="visibleSections.repair"
        class="prod-card"
        :class="{
          'card-current': currentSection === 'repair',
          'card-collapsed': !repairExpanded
        }"
      >
        <header class="prod-head" @click="repairExpanded = !repairExpanded">
          <span class="prod-icon">🔧</span>
          <div class="prod-titles">
            <div class="prod-title">
              维修方案
              <span v-if="currentSection === 'repair' && streaming.section === 'repair'" class="prod-gen">生成中</span>
            </div>
            <div class="prod-sub">针对排查发现的 {{ product.repair.flows.length }} 项异常的标准处理流程</div>
          </div>
          <span class="prod-toggle">{{ repairExpanded ? '▼' : '▶' }}</span>
        </header>

        <div v-show="repairExpanded" class="prod-body">
          <!-- ① 前情提要 -->
          <div class="block recap-block">
            <div class="block-title">📋 前情提要</div>
            <div class="recap-text">{{ product.repair.recap }}</div>
          </div>

          <!-- ② 重要安全警告 -->
          <div class="block danger-block">
            <div class="block-title">🚨 重要安全警告</div>
            <ol class="danger-list">
              <li v-for="(w, i) in product.repair.safetyWarnings" :key="i">{{ w }}</li>
            </ol>
          </div>

          <!-- ③ 标准处理流程 1-N -->
          <div class="block">
            <div class="block-title">标准处理流程</div>
            <div v-for="(flow, i) in product.repair.flows" :key="i" class="flow">
              <div class="flow-head">
                <span class="flow-num">{{ i + 1 }}</span>
                <span class="flow-title">{{ flow.title }}</span>
                <span class="flow-target">针对：{{ flow.target }}</span>
              </div>
              <ol class="flow-steps">
                <li v-for="(s, j) in flow.steps" :key="j">{{ s }}</li>
              </ol>
              <div class="flow-result">预期结果：{{ flow.expectedResult }}</div>
            </div>
          </div>

          <!-- ④ 验收标准 -->
          <div class="block accept-block">
            <div class="block-title">✅ 验收标准</div>
            <ul class="accept-list">
              <li v-for="(a, i) in product.repair.acceptance" :key="i">
                <span class="accept-name">{{ a.name }}</span>
                <span class="accept-req">要求：{{ a.req }}</span>
                <span class="accept-method">方法：{{ a.method }}</span>
              </li>
            </ul>
          </div>

          <!-- 流式进行中提示 -->
          <div v-if="currentSection === 'repair' && streaming.section === 'repair'" class="stream-tip">
            <span class="cursor-blink">▍</span> 正在生成维修方案…
          </div>
        </div>
      </section>

      <!-- ✅ 维修报告 -->
      <section
        v-if="visibleSections.report"
        class="prod-card"
        :class="{
          'card-current': currentSection === 'report',
          'card-collapsed': !reportExpanded
        }"
      >
        <header class="prod-head" @click="reportExpanded = !reportExpanded">
          <span class="prod-icon">✅</span>
          <div class="prod-titles">
            <div class="prod-title">
              维修报告
              <span v-if="currentSection === 'report' && streaming.section === 'report'" class="prod-gen">生成中</span>
            </div>
            <div class="prod-sub">本事件已闭环 · 共耗时 {{ product.report.elapsed }}</div>
          </div>
          <span class="prod-toggle">{{ reportExpanded ? '▼' : '▶' }}</span>
        </header>

        <div v-show="reportExpanded" class="prod-body">
          <div class="report-summary">
            <div class="report-banner">
              <div class="report-banner-icon">✓</div>
              <div class="report-banner-text">维修完成 · 验收通过</div>
            </div>
            <div class="report-stat-grid">
              <div class="rs-item">
                <div class="rs-label">维修结果</div>
                <div class="rs-value success">已修复</div>
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
            <div class="report-footer">本报告由系统自动生成 · 维修完成后写入 · 仅供运维归档</div>
          </div>

          <!-- 流式进行中提示 -->
          <div v-if="currentSection === 'report' && streaming.section === 'report'" class="stream-tip">
            <span class="cursor-blink">▍</span> 正在生成维修报告…
          </div>
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

// ============ 阶段定义（4 段：S1 / S2 / S4 / S5）============
const stageOrder = [
  { key: 'S1', label: '事件关联' },
  { key: 'S2', label: '排查中' },
  { key: 'S4', label: '维修中' },
  { key: 'S5', label: '已闭环' }
]
// 阶段 → 主产物
const sectionMap = {
  S1: 'ai',
  S2: 'check',
  S4: 'repair',
  S5: 'report'
}

const eventStage = inject('eventStage', reactive({}))
const eventAssistantAction = inject('eventAssistantAction', reactive({}))

const currentStage = computed(() => eventStage[props.event?.id] || 'S1')
const currentStageIdx = computed(() => stageOrder.findIndex(s => s.key === currentStage.value))
const currentSection = computed(() => sectionMap[currentStage.value])

// 各产物可见性：S1 之后能看到 AI；S2 之后能看到排查；S4 之后能看到维修；S5 之后能看到报告
const visibleSections = computed(() => ({
  ai: currentStageIdx.value >= 0,
  check: currentStageIdx.value >= 1,
  repair: currentStageIdx.value >= 2,
  report: currentStageIdx.value >= 3
}))

// ============ 折叠状态 ============
const aiExpanded = ref(false)
const checkExpanded = ref(false)
const repairExpanded = ref(false)
const reportExpanded = ref(false)

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

// 趋势图：把 trendData 转成 SVG 坐标点
const trendPoints = computed(() => {
  const data = props.event?.snapshot?.trendData
  if (!data || !data.length) return ''
  const W = 600, H = 140, PAD = 8
  const maxV = 100
  const minV = 60
  return data.map((d, i) => {
    const x = (i / (data.length - 1)) * (W - 2 * PAD) + PAD
    const y = H - PAD - ((d.value - minV) / (maxV - minV)) * (H - 2 * PAD)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})
const alertPoints = computed(() => {
  const data = props.event?.snapshot?.trendData
  if (!data) return []
  const W = 600, H = 140, PAD = 8
  const maxV = 100, minV = 60
  return data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * (W - 2 * PAD) + PAD
      const y = H - PAD - ((d.value - minV) / (maxV - minV)) * (H - 2 * PAD)
      return { x, y, v: d.value }
    })
    .filter(p => p.v > 85)
})

// ============ 详尽的产物数据生成 ============
function buildProduct(ev) {
  const title = ev.title || ''
  const sys = ev.system || '本系统'
  const priority = ev.priority || 'normal'
  const firstSensor = ev.snapshot?.sensors?.[0] || { name: '主参数', value: 0, unit: '' }

  // ========== 🧠 AI 初步分析 ==========
  const ai = {
    verdict: firstSensor.value > (firstSensor.threshold || 0)
      ? `${firstSensor.name}达到 ${firstSensor.value}${firstSensor.unit}，超过阈值 ${firstSensor.threshold}${firstSensor.unit}，系统已自动触发本次事件。`
      : `${title}已触发阈值告警，需结合多维数据综合判断。`,
    dataLine: `本次事件发生时，${firstSensor.name}为 ${firstSensor.value}${firstSensor.unit}，突破安全阈值 ${firstSensor.threshold}${firstSensor.unit}，且持续 12 分钟未见回落；同时关联的${(ev.snapshot?.sensors || []).slice(1, 3).map(s => s.name).join('、') || '辅助参数'}也呈现偏离。`,
    advice: `建议立即按"诊断-隔离-排查-维修-验收"流程处置，优先排查与${firstSensor.name}直接耦合的回路与执行机构，避免故障扩散。`,
    metrics: (ev.snapshot?.sensors || []).slice(0, 4).map((s, idx) => ({
      name: s.name,
      trend: s.status === 'over' ? 'up' : (idx === 1 ? 'down' : 'flat'),
      trendLabel: s.status === 'over' ? '上升' : (idx === 1 ? '下降' : '稳定'),
      range: s.range || `正常 ≤ ${s.threshold}${s.unit}`,
      current: s.value,
      unit: s.unit,
      analyze: s.status === 'over'
        ? `已超阈值 ${(((s.value - s.threshold) / s.threshold) * 100).toFixed(1)}%，需要紧急处理`
        : `处于正常区间，运行平稳`
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

  // ========== 🔍 排查方案 ==========
  const check = {
    warnings: [
      '作业前确保主机停机断电，相关阀门已关闭，安全标识已挂',
      '佩戴防护用具（护目镜、防烫手套），谨防烫伤与机械伤害',
      '记录所有原始数据后再行拆装，**不要直接调整温控阀**，先排查原因',
      '如需进入受限空间，必须办理《进入受限空间许可证》并落实气体检测'
    ],
    steps: [
      {
        title: '外观与渗漏检查',
        target: '排除明显的物理损伤与渗漏',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '目视检查相关管路外观、接头、焊缝' },
          { tag: 'must', tagLabel: '必查', text: '检查管路支架是否松动、有无异常振动痕迹' },
          { tag: 'suggest', tagLabel: '建议', text: '使用内窥镜检查管路内壁结垢与腐蚀情况' },
          { tag: 'photo', tagLabel: '拍照', text: '对异常部位多角度拍照留存' }
        ]
      },
      {
        title: '温度与流量分布测量',
        target: '定位异常热点与流量瓶颈',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '使用红外测温仪沿管路扫描，记录各点温度' },
          { tag: 'must', tagLabel: '必查', text: '比对进口/出口温度差，验证换热效率' },
          { tag: 'must', tagLabel: '必查', text: '使用超声波流量计复核实时流量' },
          { tag: 'data', tagLabel: '数据', text: '导出近 24h 趋势数据，与历史同期对比' }
        ]
      },
      {
        title: '关键部件拆检',
        target: '确认滤器、阀门、热交换面状态',
        subs: [
          { tag: 'must', tagLabel: '必查', text: '拆检冷却水滤器，观察滤芯脏污程度并拍照' },
          { tag: 'must', tagLabel: '必查', text: '测量淡水侧换热面温度，判断是否结垢' },
          { tag: 'suggest', tagLabel: '建议', text: '拆下温控阀检查阀芯是否卡滞、密封是否失效' },
          { tag: 'test', tagLabel: '送检', text: '提取油/水样送化验室检测' }
        ]
      }
    ],
    checklist: [
      { text: '外观与渗漏检查 — 完成度 100%', done: false, flag: 'normal' },
      { text: '温度与流量分布测量 — 完成度 100%', done: false, flag: 'normal' },
      { text: '冷却水滤器拆检 — 滤芯脏污严重（异常）', done: false, flag: 'abnormal' },
      { text: '淡水侧换热面温度测量 — 偏高 4.2°C（异常）', done: false, flag: 'abnormal' },
      { text: '温控阀拆检 — 阀芯轻微卡滞（异常）', done: false, flag: 'abnormal' },
      { text: '油/水样送检 — 报告已回传', done: false, flag: 'normal' }
    ]
  }

  // ========== 🔧 维修方案 ==========
  const repair = {
    recap: '排查阶段共发现 3 项关键异常：① 冷却水滤器脏污严重（压差 0.08MPa 超阈值）② 淡水侧换热面温度偏高 4.2°C，疑似结垢 ③ 温控阀阀芯轻微卡滞，开度受限。本方案针对上述 3 项异常分别给出处置流程。',
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
      { name: '冷却水出口温度', req: '≤ 85°C', method: '在线监测持续 1h' },
      { name: '冷却水流量', req: '≥ 80m³/h', method: '超声波流量计实测' },
      { name: '滤器压差', req: '≤ 0.03MPa', method: '压差计读数' },
      { name: '系统渗漏', req: '无可见渗漏', method: '目视 + 试压 0.6MPa 30min' },
      { name: '振动值', req: '≤ 4.5mm/s', method: '振动仪三向测量' }
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
  console.log('[ProductDrawer] watch fired', { eid, stage, oldEid, oldStage, propsEvent: props.event?.id })
  if (!eid) return

  const isStageChanged = oldStage !== undefined && oldStage !== stage
  const isEventChanged = eid !== oldEid

  // 切事件：重置所有折叠状态
  if (isEventChanged) {
    aiExpanded.value = false
    checkExpanded.value = false
    repairExpanded.value = false
    reportExpanded.value = false
    resetSubs()
  }

  // 阶段变化：折叠非当前产物
  if (isStageChanged) {
    const cur = sectionMap[stage]
    if (cur !== 'ai') aiExpanded.value = false
    if (cur !== 'check') checkExpanded.value = false
    if (cur !== 'repair') repairExpanded.value = false
    if (cur !== 'report') reportExpanded.value = false
  }

  // 当前阶段产物展开 + 渐进展示子内容
  if (isStageChanged || isEventChanged) {
    const cur = sectionMap[stage]

    // 展开卡片
    if (cur === 'ai') aiExpanded.value = true
    if (cur === 'check') checkExpanded.value = true
    if (cur === 'repair') repairExpanded.value = true
    if (cur === 'report') reportExpanded.value = true

    // 渐进展示子模块（事件切换时）
    if (isEventChanged && cur === 'ai') {
      revealSub('ai_conclusion', 50)
      revealSubsSequence(['ai_mechanism', 'ai_reasons'], 700, 120)
    }
    if (isEventChanged && cur === 'check') {
      revealSubsSequence(['check_warn', 'check_steps'], 100, 100)
    }

    // 脉冲
    if (isStageChanged) pulseInto(cur, 900)
  }
}, { immediate: true })

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
  const section = cardToSection[action]
  if (!section) return

  // 展开目标 section
  aiExpanded.value = (section === 'ai')
  checkExpanded.value = (section === 'check')
  repairExpanded.value = (section === 'repair')
  reportExpanded.value = (section === 'report')

  // 渐进展示子模块
  if (action === 'diagnosis') {
    revealedSubs.ai_conclusion = true
    revealSubsSequence(['ai_mechanism', 'ai_reasons'], 400, 150)
  }
  if (action === 'snapshot') {
    revealedSubs.ai_data = true
    revealSub('ai_trend', 600)
    // 趋势图加载模拟：600ms 出现 → 再 800ms 加载完成
    setTimeout(() => { revealedSubs.ai_trend_loaded = true }, 1400)
  }
  if (action === 'guide') {
    revealedSubs.check_steps = true
    revealSub('check_warn', 300)
  }
  if (action === 'warning') {
    revealedSubs.check_warn = true
  }
  if (action === 'repair') {
    // 从 check_done 进 S4
    revealSubsSequence(['repair_recap', 'repair_flows', 'repair_accept'], 200, 180)
  }
  if (action === 'report') {
    revealedSubs.report_content = true
  }

  pulseInto(section, 700)
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
  font-size: 13px;
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
  font-size: 11px;
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
  font-size: 12px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.prod-card.card-current .prod-title { color: var(--accent); }
.prod-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
.prod-gen {
  font-size: 10px;
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
  font-size: 12px;
  color: var(--text-muted);
}

.prod-body { padding: 14px; }

/* ============ 通用 block ============ */
.block { margin-bottom: 16px; }
.block:last-child { margin-bottom: 0; }
.block-title {
  font-size: 13px;
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
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}
.verdict-text {
  font-size: 13px;
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
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.snapshot-mini-time {
  font-size: 10px;
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
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.sm-name { color: var(--text-secondary); }
.sm-val { font-weight: 600; font-family: monospace; }
.sm-val.over { color: var(--danger); }
.sm-val.normal { color: var(--success); }

.data-line, .advice-line {
  font-size: 12px;
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
.metric-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.metric-trend {
  display: inline-block;
  font-size: 10px;
  margin: 2px 0;
  padding: 1px 5px;
  border-radius: 3px;
}
.metric-trend.up { background: var(--bg-surface)1f0; color: var(--danger); }
.metric-trend.down { background: var(--bg-surface)7e6; color: var(--warning); }
.metric-trend.flat { background: var(--success-bg); color: var(--success); }
.metric-range { font-size: 10px; color: var(--text-muted); margin: 2px 0 4px; }
.metric-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-bottom: 2px;
}
.metric-current { font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: monospace; }
.metric-unit { font-size: 10px; color: var(--text-secondary); }
.metric-analyze { font-size: 10px; color: var(--text-secondary); line-height: 1.4; }

/* 趋势图 */
.trend-meta { font-size: 11px; color: var(--text-muted); margin-bottom: 6px; }
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
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 6px;
  justify-content: center;
}
.lg-item { display: flex; align-items: center; gap: 4px; }
.lg-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

/* 工程机理 */
.mechanism { margin-bottom: 10px; }
.mech-label { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.mech-text { font-size: 12px; line-height: 1.7; color: var(--text-primary); }

.fault-match { background: var(--bg-hover); border: 1px solid var(--border-primary); border-radius: 6px; padding: 8px 10px; }
.fm-row {
  display: flex;
  align-items: center;
  font-size: 12px;
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
  font-size: 10px;
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
  font-size: 11px;
  border-bottom: 1px solid var(--border-primary);
}
.rt-row:last-child { border-bottom: none; }
.rt-row.rt-head { background: var(--bg-hover); font-weight: 600; color: var(--text-secondary); }
.rt-col { line-height: 1.5; }
.rt-fault { display: flex; align-items: center; gap: 4px; }
.rt-prob {
  font-size: 10px;
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
  font-size: 12px;
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
  font-size: 11px;
  font-weight: 600;
}
.step-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.step-target { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; }
.step-sub { list-style: none; padding: 0; margin: 0 0 8px; }
.step-sub li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.6;
  padding: 2px 0;
}
.sub-tag {
  font-size: 9px;
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
  font-size: 11px;
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
  font-size: 12px;
  user-select: none;
  transition: all 0.15s;
}
.check-item:hover { background: var(--accent-bg); }
.check-item.done { background: var(--success-bg); border-color: var(--success-bg-hover); }
.check-box { font-size: 14px; }
.check-item.done .check-box { color: var(--success); }
.check-item.done .check-text { text-decoration: line-through; color: var(--text-muted); }
.check-text { flex: 1; }
.check-flag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--bg-surface)1f0;
  color: var(--danger);
  font-weight: 600;
}

/* ============ 维修块 ============ */
.recap-block { background: rgba(22, 119, 255, 0.06); border-radius: 6px; padding: 10px 12px; }
.recap-block .block-title { border-left: none; padding-left: 0; color: var(--accent); }
.recap-text { font-size: 12px; line-height: 1.7; color: var(--text-primary); }

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
  font-size: 11px;
  font-weight: 600;
}
.flow-title { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
.flow-target { font-size: 11px; color: var(--danger); background: var(--bg-surface)1f0; padding: 1px 6px; border-radius: 3px; }
.flow-steps { margin: 6px 0; padding-left: 20px; font-size: 12px; line-height: 1.7; color: var(--text-primary); }
.flow-result {
  font-size: 11px;
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
  font-size: 11px;
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
.report-banner-text { font-size: 16px; font-weight: 600; }

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
.rs-label { font-size: 10px; color: var(--text-muted); }
.rs-value { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 2px; }
.rs-value.success { color: var(--success); }

.report-key {
  background: var(--bg-hover);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px 12px;
}
.rk-row { padding: 6px 0; border-bottom: 1px dashed var(--border-primary); font-size: 12px; }
.rk-row:last-child { border-bottom: none; }
.rk-label {
  display: inline-block;
  font-size: 10px;
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
  font-size: 10px;
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
  font-size: 11px;
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
  font-size: 11px;
  color: var(--text-muted);
  animation: skel-fade 1.5s ease-in-out infinite;
}

@keyframes skel-fade {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
</style>
