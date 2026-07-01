<template>
  <div class="detail-page" v-if="event">
    <!-- 头部固定信息卡 -->
    <div class="header-card">
      <!-- 第一行：标题 + 等级 + 时间 -->
      <div class="hc-row1">
        <h1 class="hc-title">{{ event.title }}</h1>
        <div class="hc-tags">
          <span class="level-badge" :class="levelClass">{{ levelLabel }}</span>
          <span class="time-badge">{{ event.createdAt }}</span>
        </div>
      </div>

      <!-- 第二行：来源 + 描述 -->
      <div class="hc-row2">
        <div class="hc-source">来源：<b>{{ sourceLabel }}</b></div>
        <p class="hc-desc">{{ event.description }}</p>
      </div>

      <!-- 进度条：4步 圆点连线 -->
      <div class="progress-bar">
        <template v-for="(node, i) in STAGE_NODES" :key="i">
          <div class="pb-node" :class="{ done: i < event.stageIndex, active: i === event.stageIndex }">
            <span class="pb-dot"></span>
            <span class="pb-lbl">{{ node }}</span>
          </div>
          <span v-if="i < STAGE_NODES.length - 1" class="pb-line" :class="{ done: i < event.stageIndex }"></span>
        </template>
      </div>
    </div>

    <!-- Tab 导航栏 -->
    <div class="tab-nav">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab-btn"
        :class="{ active: currentTab === t.key }"
        @click="currentTab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- ============ AI分析 Tab ============ -->
    <div v-if="currentTab === 'ai'" class="tab-content ai-tab">
      <!-- 结论与建议 -->
      <section class="sec-card">
        <h3 class="sec-title"><Icon icon="mdi:lightbulb-on" /> 结论与建议</h3>
        <div class="sec-body conclusion-text">
          <p>{{ event.aiAnalysis?.conclusion || 'AI正在分析中…' }}</p>
          <p>根据当前传感器快照及历史趋势，{{ event.aiAnalysis?.conclusion || '系统检测到异常信号' }}。</p>
          <table class="compare-table" v-if="aiDataCompare.length">
            <tr><th>指标</th><th>原始数据</th><th>阈值</th><th>偏差值</th></tr>
            <tr v-for="(row, i) in aiDataCompare" :key="i">
              <td>{{ row.name }}</td><td class="mono">{{ row.actual }}</td><td class="mono">{{ row.threshold }}</td><td class="mono" :class="row.devClass">{{ row.deviation }}</td>
            </tr>
          </table>
        </div>
      </section>

      <!-- 数据分析 -->
      <section class="sec-card">
        <h3 class="sec-title"><Icon icon="mdi:chart-box-outline" /> 数据分析</h3>
        <div class="data-grid">
          <div class="dg-block" v-for="(block, i) in aiDataBlocks" :key="i">
            <h4 class="dg-head">{{ block.title }}</h4>
            <ul class="dg-list">
              <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
            </ul>
          </div>
        </div>
        <!-- 趋势图 -->
        <v-chart class="trend-chart" :option="aiTrendOption" autoresize />
        <div class="chart-caption">图表说明：{{ event.aiAnalysis?.chartCaption || '当前传感器读数偏离正常范围（' + normalRangeText + '）。趋势持续走低，建议立即排查。' }}</div>
      </section>

      <!-- 可疑原因 -->
      <section class="sec-card">
        <h3 class="sec-title"><Icon icon="mdi:magnify-scan" /> 可疑原因</h3>
        <div class="cause-cards">
          <div class="cc-card" v-for="(c, i) in causeCards" :key="i" :class="c.level">
            <span class="cc-num">#{{ c.num }}</span>
            <h4 class="cc-title">{{ c.title }}</h4>
            <ul class="cc-list">
              <li v-for="(item, j) in c.items" :key="j">{{ item }}</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 工程机理分析 -->
      <section class="sec-card" v-if="event.aiAnalysis?.mechanism">
        <h3 class="sec-title"><Icon icon="mdi:cog" /> 工程机理分析</h3>
        <div class="mech-text">
          <p v-for="(p, i) in event.aiAnalysis.mechanism" :key="i">{{ p }}</p>
        </div>
      </section>

      <!-- 相似案例推荐 -->
      <section class="sec-card similar-section">
        <h3 class="sec-title"><Icon icon="mdi:history" /> 相似案例推荐</h3>
        <table class="similar-table">
          <thead><tr><th>案例编号</th><th>概况</th><th>处理措施</th><th>参考链接</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in similarCases" :key="i">
              <td class="mono">{{ s.id }}</td><td>{{ s.summary }}</td><td>{{ s.action }}</td><td><a href="#" class="link-a">{{ s.ref }}</a></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- ============ 待办事项 Tab ============ -->
    <div v-if="currentTab === 'todo'" class="tab-content todo-tab">
      <!-- 排查建议方案组 -->
      <div v-for="(group, gi) in todoGroups" :key="gi" class="todo-group">
        <div class="tg-header" :class="{ collapsed: !group.expanded }" @click="toggleGroup(gi)">
          <span class="tg-num">{{ gi + 1 }}</span>
          <span class="tg-title">{{ group.title }}</span>
          <div class="tg-actions">
            <button class="tg-btn done" title="标记完成"><Icon icon="mdi:check-circle" /> 已完成</button>
            <button class="tg-btn expand" title="展开详情"><Icon icon="mdi:arrow-down-circle" /> 展开</button>
          </div>
        </div>
        <div v-if="group.expanded" class="tg-body">
          <div class="todo-item" v-for="(item, ii) in group.items" :key="ii">
            <div class="ti-row1">
              <span class="ti-icon" :class="item.type">{{ item.iconNum }}</span>
              <span class="ti-title">{{ item.title }}</span>
              <div class="ti-meta">
                <span class="ti-type" :class="item.type">{{ typeLabel(item.type) }}</span>
                <select class="ti-select" v-model="item.statusVal"><option value="">操作∨</option><option value="done">已完成</option></select>
                <span class="ti-count">▲ {{ item.count || '' }}</span>
              </div>
            </div>
            <div class="ti-detail">
              <p v-if="item.detail">{{ item.detail }}</p>
              <div v-if="item.images" class="ti-images">
                <div class="ti-img-placeholder" v-for="_ in Math.min(item.images, 2)" :key="_"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 排查反馈弹窗（右侧浮出） -->
      <transition name="slide-r">
        <div v-if="showFeedbackModal" class="feedback-modal">
          <div class="fb-header">
            <h4>{{ feedbackType === 'inspection' ? '排查反馈' : '维修反馈' }}</h4>
            <button @click="showFeedbackModal = false"><Icon icon="mdi:close" /></button>
          </div>
          <div class="fb-form">
            <div class="fb-field"><label>标题</label><input v-model="fbForm.title" readonly /></div>
            <div class="fb-field"><label>结果描述</label><textarea v-model="fbForm.resultDesc" placeholder="请描述结果或处理情况…" /></div>
            <div class="fb-field"><label>图片</label>
              <div class="fb-img-area">
                <div class="img-up"><Icon icon="mdi:image-plus" /><span>拍照</span></div>
                <div class="img-up"><Icon icon="mdi:plus" /><span>添加</span></div>
              </div>
            </div>
            <button class="fb-submit" @click="submitFeedback">提交</button>
          </div>
        </div>
      </transition>
    </div>

    <!-- ============ 事件日志 Tab ============ -->
    <div v-if="currentTab === 'log'" class="tab-content log-tab">
      <div class="log-layout">
        <!-- 左侧时间线 -->
        <div class="timeline-col">
          <div class="tl-item" v-for="(l, i) in event.logs" :key="i">
            <div class="tl-time">{{ l.time }}</div>
            <div class="tl-bubble" :class="[l.stage]">
              <div class="tl-tag-row">
                <span v-if="l.tag" :class="['tag-pill', l.tag]">{{ l.tag }}</span>
              </div>
              <div class="tl-title">{{ l.title }}</div>
              <p class="tl-content">{{ l.content }}</p>
              <div class="tl-actions">
                <a href="#" class="la-link" @click.prevent="openQuickFeedback(l)">快速反馈</a>
                <a href="#" class="la-link">导出</a>
                <a href="#" class="la-link" @click.prevent="addLogNote(l)">补录说明</a>
                <a href="#" class="la-link">支持标尺预览</a>
              </div>
            </div>
          </div>
        </div>
        <!-- 右侧快速反馈区 -->
        <aside class="quick-fb-area" v-if="quickFeedbackOpen">
          <div class="qf-header">
            <h4>快速反馈</h4>
            <button @click="quickFeedbackOpen=false"><Icon icon="mdi:close" /></button>
          </div>
          <div class="qf-form">
            <div class="qf-field"><label>判断结论</label>
              <select><option>选择异常类型</option><option>已解决</option><option>部分解决</option><option>临时处理</option></select>
            </div>
            <div class="qf-field"><label>备注</label><textarea placeholder="【必填】描述发现的问题或采取的措施…" rows="5"></textarea></div>
            <div class="qf-field"><label>图片</label>
              <div class="qf-imgs"><div class="img-up-sm"><Icon icon="mdi:camera" /></div><div class="img-up-sm"><Icon icon="mdi:plus" /></div></div>
            </div>
            <button class="qf-submit">提交反馈</button>
          </div>
        </aside>
      </div>

      <!-- 助手入口（右侧悬浮） -->
      <div class="assistant-trigger" v-if="currentTab==='log' && !assistantOpen" @click="assistantOpen=true">
        <Icon icon="mdi:robot" />
      </div>
    </div>

    <!-- 全局悬浮助手按钮 -->
    <button class="fab-assistant" @click="assistantOpen = true" v-if="!assistantOpen">
      <span class="fab-inner">●</span>
    </button>
    <AssistantPanel v-model:visible="assistantOpen" :event-id="event.id" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { useRepairStore } from '@/stores/repairStore'
import AssistantPanel from '@/components/AssistantPanel.vue'
import { STAGE_NODES } from '@/mock'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const route = useRoute()
const router = useRouter()
const repairStore = useRepairStore()

const tabs = [
  { key: 'ai', label: 'AI分析' },
  { key: 'todo', label: '待办事项' },
  { key: 'log', label: '事件日志' },
]
const currentTab = ref('ai')
const assistantOpen = ref(false)

// ---- 当前事件 ----
const event = computed(() => repairStore.currentEvent)

watch(() => route.params.id, (id) => {
  if (id) repairStore.selectEvent(id)
}, { immediate: true })

// ---- Header helpers ----
const levelClass = computed(() => event.value?.priority === 'high' ? 'danger' : event.value?.priority === 'medium' ? 'warning' : 'info')
const levelLabel = computed(() => ({ high: '高', medium: '中', low: '低' })[event.value?.priority] || '-')
const sourceLabel = computed(() => ({ ai_detection: 'AI检测', inspection: '巡检发现', crew_report: '船员上报' })[event.value?.source] || event.value?.source || '-')

// ---- AI分析 Tab 数据 ----
const aiDataCompare = computed(() => {
  const snap = event.value?.aiAnalysis?.snapshot || []
  return snap.map(s => ({
    name: s.name, actual: `${s.value}${s.unit}`, threshold: `${s.range[0]}~${s.range[1]}`,
    deviation: ((s.value - s.range[1]) / (s.range[1] - s.range[0]) * 100).toFixed(1) + '%',
    devClass: s.status === 'danger' ? 'dev-warn' : '',
  }))
})

const normalRangeText = computed(() => {
  const s = event.value?.aiAnalysis?.snapshot?.[0]
  return s ? `${s.range[0]}~${s.range[1]} ${s.unit}` : '正常范围'
})

const aiDataBlocks = computed(() => [
  { title: '#1-1 主机燃油压力(核心参数)', items: ['主机燃油喷射压力偏低', '当前低于阈值下限约7~10 bar范围', '趋势显示持续下降', '可能原因：喷油嘴磨损或油路堵塞'] },
  { title: '#1-2 排气温度偏高', items: ['排气温度超出正常上限', '可能与燃烧不完全相关', '检查进气量和喷油正时'] },
  { title: 'M# M# · 主机转速', items: ['波动：±10 RPM', '不稳定', '需关注'] },
])

const causeCards = computed(() => [
  { num: '1-1', title: '喷油器故障可能性高', level: 'high',
    items: ['喷油器针阀磨损导致回油量增加', '喷油压力不足，雾化质量下降', '缸内燃烧不充分，功率下降'] },
  { num: '1-2', title: '燃油管路问题', level: 'medium',
    items: ['燃油滤网堵塞导致供油不畅', '燃油中含水或杂质超标', '高压油泵柱塞偶件磨损'] },
  { num: '1-3', title: '增压系统问题', level: 'medium',
    items: ['增压器效率下降', '扫气压力低', '燃烧恶化'] },
])

const similarCases = ref([
  { id: 'CASE-2025-0892', summary: '主机燃油压力低·类似工况', action: '更换喷油器组件', ref: '查看详情 →' },
  { id: 'CASE-2025-0614', summary: '喷油器故障·同机型', action: '清洗燃油系统', ref: '查看详情 →' },
  { id: 'CASE-2024-1203', summary: '燃油滤网堵塞', action: '更换滤芯', ref: '查看详情 →' },
])

// 趋势图
const aitrendData = computed(() => {
  const data = []
  for (let i = 23; i >= 0; i--) {
    const h = new Date(Date.now() - i * 3600000).getHours().toString().padStart(2, '0') + ':00'
    // 模拟下降趋势
    const base = 7.8 - i * 0.04 + (Math.random() * 0.15 - 0.075)
    data.push({ time: h, value: Math.max(base, 6.9).toFixed(2) })
  }
  return data
})
const aitrendOption = computed(() => ({
  backgroundColor: 'transparent',
  grid: { left: 48, right: 16, top: 30, bottom: 28 },
  tooltip: { trigger: 'axis', backgroundColor: '#152A47', borderColor: '#243B58', textStyle: { color: '#E0ECF8', fontSize: 11 } },
  xAxis: { type: 'category', data: aitrendData.value.map(p => p.time), axisLine: { lineStyle: { color: '#1E3A5F' } }, axisLabel: { color: '#4A6A8A', fontSize: 10 } },
  yAxis: { type: 'value', min: 6.5, max: 8.5, splitLine: { lineStyle: { color: '#111E34' } }, axisLabel: { color: '#4A6A8A', fontSize: 10 } },
  series: [{
    name: '压力(MPa)', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
    data: aitrendData.value.map(p => parseFloat(p.value)),
    lineStyle: { width: 2.5, color: '#1890FF' },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: 'rgba(24,144,255,0.18)' }, { offset: 1, color: 'rgba(24,144,255,0.02)' }] } },
    markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: '#FF4D4F', width: 1.5 },
      data: [{ yAxis: 7.35, label: { formatter: '下限 7.35 MPa', color: '#FF4D4F', fontSize: 10 } }] },
  }],
}))

// ---- 待办事项 Tab 数据 ----
const todoGroups = ref([
  {
    title: '召回排元故障排查方案',
    expanded: true,
    items: [
      {
        type: 'check', iconNum: '1', title: '目视检查外观及连接状态', statusVal: '', count: null,
        detail: '重点确认：①检查高压油管接头是否松动渗漏；②检查回油管是否堵塞；③确认供油电磁阀工作状态。',
        images: 2,
      },
      {
        type: 'check', iconNum: '2', title: '替换喷油器试运行', statusVal: '', count: null,
        detail: '更换疑似故障的喷油器后进行试运行观察。',
        images: 0,
      },
      {
        type: 'measure', iconNum: '3', title: '测量燃油喷射压力', statusVal: '', count: null,
        detail: '使用专用测量设备在怠速和负载两种工况下分别测量实际喷油压力，对比厂家标准值。',
        images: 2,
      },
    ],
  },
  {
    title: '后续故障排查推荐方案',
    expanded: true,
    items: [
      { type: 'measure', iconNum: '', title: '压力传感器校准排查方案', statusVal: '', count: null, detail: '', images: 0 },
      { type: 'measure', iconNum: '', title: '系统管路逐级排查方案', statusVal: '', count: null, detail: '', images: 0 },
    ],
  },
])

function toggleGroup(idx) { todoGroups.value[idx].expanded = !todoGroups.value[idx].expanded }
function typeLabel(t) { return t === 'check' ? '排查项' : '维修项' }

// 反馈弹窗
const showFeedbackModal = ref(false)
const feedbackType = ref('inspection')
const fbForm = reactive({ title: '', resultDesc: '' })
function openQuickFeedback(logItem) {
  feedbackType.value = 'inspection'
  fbForm.title = logItem?.title || ''
  fbForm.resultDesc = ''
  showFeedbackModal.value = true
}
function addLogNote(logItem) { /* TODO */ }
function submitFeedback() { showFeedbackModal.value = false }

// 日志快速反馈
const quickFeedbackOpen = ref(false)
</script>

<style scoped>
.detail-page { padding: 14px; height: 100%; overflow-y: auto; background: #060d17; position: relative; }

/* ====== 头部卡 ====== */
.header-card {
  background: linear-gradient(135deg, #0d1e38 0%, #0a1628 100%);
  border: 1px solid #1a3050; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px;
}
.hc-row1 { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.hc-title { font-size: 17px; font-weight: 800; color: #fff; margin: 0; letter-spacing: 0.3px; }
.hc-tags { display: flex; align-items: center; gap: 10px; }
.level-badge { font-size: 11px; padding: 2px 10px; border-radius: 4px; font-weight: 700; }
.level-badge.danger { background: rgba(255,77,79,0.2); color: #FF4D4F; }
.level-badge.warning { background: rgba(250,173,20,0.2); color: #FAAD14; }
.level-badge.info { background: rgba(24,144,255,0.2); color: #1890FF; }
.time-badge { font-size: 12px; color: #4A6A8A; font-family: 'Consolas', monospace; }
.hc-row2 { display: flex; gap: 24px; margin-top: 10px; align-items: flex-start; }
.hc-source { font-size: 12px; color: #8BAAC0; white-space: nowrap; flex-shrink: 0; }
.hc-source b { color: #B0C4D8; }
.hc-desc { font-size: 13px; color: #8BAAC0; line-height: 1.55; margin: 0; flex: 1; }

/* 进度条 */
.progress-bar {
  display: flex; align-items: center; justify-content: center;
  margin-top: 16px; padding-top: 14px; border-top: 1px solid #162940;
}
.pb-node { display: flex; flex-direction: column; align-items: center; z-index: 1; }
.pb-dot { width: 18px; height: 18px; border-radius: 50%; background: #162940; border: 2.5px solid #2A4566; transition: all 0.25s; }
.pb-node.done .pb-dot { background: #52C41A; border-color: #52C41A; box-shadow: 0 0 8px rgba(82,196,26,0.35); }
.pb-node.done .pb-dot::after { content:'✓'; color:#fff; font-size:10px; font-weight:900; }
.pb-node.active .pb-dot { background: #1890FF; border-color: #1890FF; animation: pbPulse 1.6s infinite; }
@keyframes pbPulse { 0%,100%{box-shadow:0 0 0 0 rgba(24,144,255,0.6);} 50%{box-shadow:0 0 0 7px rgba(24,144,255,0);} }
.pb-lbl { font-size: 11px; color: #4A6A8A; margin-top: 5px; font-weight: 600; }
.pb-node.done .pb-lbl { color: #52C41A; }
.pb-node.active .pb-lbl { color: #1890FF; }
.pb-line { width: 56px; height: 2px; background: #162940; margin: 0 -4px; margin-bottom: 22px; }
.pb-line.done { background: #52C41A; }

/* ====== Tab 导航 ====== */
.tab-nav { display: flex; gap: 0; margin-bottom: 14px; background: #0a1224; border-radius: 8px; overflow: hidden; border: 1px solid #162940; }
.tab-btn { flex: 1; padding: 11px 0; background: transparent; border: none; color: #5A7A92; font-size: 13px; font-weight: 650; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; }
.tab-btn:hover { color: #B0C4D8; background: rgba(24,144,255,0.04); }
.tab-btn.active { color: #1890FF; border-bottom-color: #1890FF; background: rgba(24,144,255,0.07); }

/* ====== 内容区域 ====== */
.tab-content { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from{opacity:0;transform:translateY(4px);} to{opacity:1;transform:translateY(0);} }

/* --- AI分析 --- */
.sec-card { background: #0d1b2e; border: 1px solid #162940; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px; }
.sec-title { font-size: 14px; font-weight: 700; color: #E0ECF8; margin: 0 0 12px; display: flex; align-items: center; gap: 6px; }
.sec-title svg { color: #1890FF; font-size: 17px; }
.conclusion-text p { font-size: 13px; color: #8BAAC0; line-height: 1.75; margin: 6px 0; }

.compare-table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
.compare-table th { background: #080f1a; color: #5A7A92; padding: 7px 10px; text-align: left; font-weight: 600; }
.compare-table td { padding: 7px 10px; border-bottom: 1px solid #111e34; color: #B0C4D8; }
.compare-table .mono { font-family: 'Consolas', monospace; }
.compare-table .dev-warn { color: #FAAD14; font-weight: 700; }

.data-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin: 12px 0; }
.dg-block { background: #080f1a; border-radius: 6px; padding: 12px 14px; }
.dg-head { font-size: 12px; font-weight: 700; color: #1890FF; margin: 0 0 8px; }
.dg-list { list-style: none; padding: 0; margin: 0; }
.dg-list li { font-size: 12px; color: #8BAAC0; padding: 3px 0; padding-left: 12px; position: relative; }
.dg-list li::before { content:'•'; position:absolute; left:0; color: #3A5A7A; }

.trend-chart { height: 200px; margin: 14px 0; }
.chart-caption { font-size: 11px; color: #4A6A8A; padding: 6px 10px; background: #080f1a; border-radius: 4px; border-left: 3px solid #1890FF; }

/* 可疑原因卡片 */
.cause-cards { display: flex; flex-direction: column; gap: 8px; }
.cc-card { background: #080f1a; border-radius: 6px; padding: 12px 14px; border-left: 3px solid #3A5A7A; }
.cc-card.high { border-left-color: #FF4D4F; }
.cc-card.medium { border-left-color: #FAAD14; }
.cc-num { font-size: 11px; font-weight: 800; color: #4A6A8A; }
.cc-title { font-size: 13px; font-weight: 700; color: #E0ECF8; margin: 4px 0 8px; }
.cc-list { list-style: none; padding: 0; margin: 0; }
.cc-list li { font-size: 12px; color: #8BAAC0; padding: 2px 0 2px 14px; position: relative; line-height: 1.45; }
.cc-list li::before { content:'▸'; position:absolute; left:0; color: #3A5A7A; font-size: 10px; }

.mech-text p { font-size: 13px; color: #8BAAC0; line-height: 1.7; margin: 5px 0; }

/* 相似案例 */
.similar-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.similar-table th { background: #080f1a; color: #5A7A92; padding: 8px 10px; text-align: left; font-weight: 600; }
.similar-table td { padding: 8px 10px; border-bottom: 1px solid #111e34; color: #B0C4D8; }
.link-a { color: #1890FF; text-decoration: none; }
.link-a:hover { text-decoration: underline; }

/* --- 待办事项 --- */
.todo-group { margin-bottom: 10px; }
.tg-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #0d1b2e; border: 1px solid #162940; border-radius: 6px; cursor: pointer; user-select: none; }
.tg-num { width: 22px; height: 22px; border-radius: 50%; background: #1890FF; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.tg-title { flex: 1; font-size: 13px; font-weight: 700; color: #E0ECF8; }
.tg-actions { display: flex; gap: 6px; }
.tg-btn { padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 3px; border: 1px solid #243B58; background: transparent; color: #5A7A92; }
.tg-btn.done { border-color: #52C41A; color: #52C41A; }
.tg-btn.expand { border-color: #1890FF; color: #1890FF; }

.tg-body { padding: 8px 0 0; display: flex; flex-direction: column; gap: 6px; }
.todo-item { background: #080f1a; border-radius: 6px; padding: 12px 14px; }
.ti-row1 { display: flex; align-items: center; gap: 10px; }
.ti-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0; }
.ti-icon.check { background: #1890FF; }
.ti-icon.measure { background: #FAAD14; }
.ti-title { flex: 1; font-size: 13px; font-weight: 600; color: #E0ECF8; }
.ti-meta { display: flex; align-items: center; gap: 8px; }
.ti-type { font-size: 10px; padding: 1px 7px; border-radius: 3px; font-weight: 600; }
.ti-type.check { background: rgba(24,144,255,0.15); color: #1890FF; }
.ti-type.measure { background: rgba(250,173,20,0.15); color: #FAAD14; }
.ti-select { font-size: 11px; background: #0c1420; border: 1px solid #1E3A5F; color: #8BAAC0; border-radius: 4px; padding: 2px 6px; }
.ti-count { font-size: 10px; color: #3A5A7A; }
.ti-detail { margin-top: 8px; }
.ti-detail p { font-size: 12px; color: #6888A8; line-height: 1.5; margin: 0 0 6px; }
.ti-images { display: flex; gap: 6px; }
.ti-img-placeholder { width: 72px; height: 48px; background: #0c1420; border: 1px dashed #1E3A5F; border-radius: 4px; }

/* 反馈弹窗 */
.feedback-modal { position: fixed; top: 56px; right: 18px; bottom: 28px; width: 340px; z-index: 80; background: #0d1b2e; border: 1px solid #243B58; border-radius: 10px; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.fb-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #162940; }
.fb-header h4 { margin: 0; font-size: 14px; color: #E0ECF8; }
.fb-header button { background: none; border: none; color: #5A7A92; font-size: 18px; cursor: pointer; }
.fb-form { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.fb-field label { display: block; font-size: 11px; color: #5A7A92; margin-bottom: 4px; font-weight: 600; }
.fb-field input, .fb-field textarea { width: 100%; background: #080f1a; border: 1px solid #1E3A5F; border-radius: 5px; color: #E0ECF8; padding: 8px 10px; font-size: 12px; resize: vertical; }
.fb-img-area { display: flex; gap: 8px; }
.img-up, .img-up-sm { width: 64px; height: 48px; background: #0a1020; border: 1px dashed #243B58; border-radius: 5px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #4A6A8A; font-size: 10px; cursor: pointer; }
.img-up-sm { width: 44px; height: 36px; }
.fb-submit { padding: 10px; border-radius: 6px; background: #E74C3C; color: #fff; border: none; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: auto; }

.slide-r-enter-active, .slide-r-leave-active { transition: transform 0.25s, opacity 0.25s; }
.slide-r-enter-from, .slide-r-leave-to { transform: translateX(100%); opacity: 0; }

/* --- 事件日志 --- */
.log-layout { display: grid; grid-template-columns: 1fr 300px; gap: 14px; }
.timeline-col { display: flex; flex-direction: column; gap: 10px; }
.tl-item { display: flex; gap: 12px; }
.tl-time { font-size: 11px; color: #1890FF; font-family: 'Consolas', monospace; width: 54px; flex-shrink: 0; padding-top: 2px; }
.tl-bubble { flex: 1; background: #0d1b2e; border: 1px solid #162940; border-radius: 8px; padding: 12px 14px; }
.tl-tag-row { display: flex; gap: 6px; margin-bottom: 6px; }
.tag-pill { font-size: 10px; padding: 1px 8px; border-radius: 3px; font-weight: 600; }
.tag-pill.研究 { background: rgba(114,137,218,0.2); color: #7289DA; }
.tag-pill.已完成 { background: rgba(82,196,26,0.15); color: #52C41A; }
.tag-pill.待处理 { background: rgba(250,173,20,0.15); color: #FAAD14; }
.tl-title { font-size: 13px; font-weight: 700; color: #E0ECF8; margin: 0 0 4px; }
.tl-content { font-size: 12px; color: #8BAAC0; line-height: 1.5; margin: 0; }
.tl-actions { display: flex; gap: 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #111e34; }
.la-link { font-size: 11px; color: #1890FF; text-decoration: none; cursor: pointer; }
.la-link:hover { text-decoration: underline; }

/* 右侧快速反馈 */
.quick-fb-area { background: #0d1b2e; border: 1px solid #243B58; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; }
.qf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.qf-header h4 { margin: 0; font-size: 13px; color: #E0ECF8; }
.qf-header button { background: none; border: none; color: #5A7A92; cursor: pointer; font-size: 16px; }
.qf-form { flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.qf-field label { display: block; font-size: 11px; color: #5A7A92; margin-bottom: 3px; font-weight: 600; }
.qf-field select, .qf-field textarea { width: 100%; background: #080f1a; border: 1px solid #1E3A5F; border-radius: 5px; color: #E0ECF8; padding: 7px 9px; font-size: 12px; resize: none; }
.qf-imgs { display: flex; gap: 6px; }
.qf-submit { padding: 9px; border-radius: 6px; background: #E74C3C; color: #fff; border: none; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: auto; }

/* 助手触发 */
.assistant-trigger { position: fixed; bottom: 32px; right: 96px; z-index: 74; }
.assistant-trigger > span:first-child { display: flex; width: 42px; height: 42px; border-radius: 50%; background: #1890FF; color: #fff; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; box-shadow: 0 4px 16px rgba(24,144,255,0.4); transition: transform 0.15s; }
.assistant-trigger > span:first-child:hover { transform: scale(1.1); }

/* 全局悬浮助手 */
.fab-assistant { position: fixed; bottom: 28px; right: 28px; width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg,#1890FF,#0072E5); border: none; cursor: pointer; z-index: 76; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(24,144,255,0.45); transition: transform 0.2s; }
.fab-assistant:hover { transform: scale(1.08); }
.fab-inner { font-size: 20px; color: #fff; }
</style>
