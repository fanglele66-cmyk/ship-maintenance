<template>
  <div class="p2-device-page">
    <div class="p2-device-head">
      <div><span class="p2-eyebrow">设备态势</span><h2>{{ deviceName }}</h2></div>
      <div v-if="isMainEngine" class="p2-device-status"><span><i></i>航行中</span><span>关注事项 <b>{{ attentionCount }}</b></span><span>未结束事件 <b>{{ activeTodoCount }}</b></span></div>
    </div>
    <div class="p2-tab-row" role="tablist" aria-label="设备层内容">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}<span v-if="tab.id === 'attention' && attentionCount">{{ attentionCount }}</span><span v-if="tab.id === 'maintenance' && maintenanceCount">{{ maintenanceCount }}</span><span v-if="tab.id === 'todo' && activeTodoCount">{{ activeTodoCount }}</span></button>
    </div>
    <div ref="deviceScroll" class="p2-device-scroll">
      <template v-if="activeTab === 'data'"><slot name="data" /></template>
      <template v-else-if="!isMainEngine"><div class="p2-empty"><strong>{{ deviceName }}当前无新增关注事项</strong><p>设备数据可在“传感器数据”页签查看。</p></div></template>
      <template v-else-if="activeTab === 'overview'">
        <div class="p2-overview-layout">
        <div class="p2-panel">
          <div class="p2-section-title">设备健康研判</div>
          <div class="p2-health-meta"><span>分析完成 {{ runningAssessment.completedAt }}</span><span>数据截止 {{ runningAssessment.dataCutoff }}</span><span>{{ runningAssessment.analysisRange }}</span></div>
          <p class="p2-health-scope">{{ runningAssessment.conditions }} · {{ runningAssessment.coverage }}</p>
          <p class="p2-health-scope">当次分析结果；当前行动随后续业务进展更新，不由留言时间替代分析时间。</p>
          <div class="p2-overview-analysis">
            <p v-for="item in overviewAnalysis" :key="item.label"><span class="p2-analysis-tag" :class="item.tone">{{ item.label }}</span><span>{{ item.text }}</span></p>
          </div>
          <details class="p2-running-details">
            <summary><span>详细研判</span><small>查看关联证据与分析过程</small></summary>
            <article class="p2-technical-report">
              <section v-for="section in runningAssessment.sections" :key="section.title">
                <h4>{{ section.title }}</h4><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
              </section>
            </article>
          </details>
        </div>
        <div class="p2-panel">
          <div class="p2-section-title">设备关注与处置</div><p class="p2-health-scope">当前 {{ overviewItems.length }} 个业务入口 · 人员行动优先 · 已结束事项在历史中查看</p><p class="p2-health-scope">关注档案：当前 {{ attentionCount-attentionBuckets.ended.length }} 项 · 已结束 {{ attentionBuckets.ended.length }} 项（总数 {{ attentionCount }}）</p>
          <div class="p2-overview-list">
            <button v-for="item in overviewItems" :key="item.id" type="button" class="p2-overview-item" @click="openItem(item.id)">
              <span class="p2-overview-item-main"><span class="p2-overview-type">{{ item.type }}</span><b>{{ item.title }}</b><small>{{ item.text }}</small></span>
              <span class="p2-state-tag" :class="item.priority<=2?'amber':'blue'">{{ item.tag }}</span>
            </button>
          </div>
        </div>
        </div>
      </template>
      <template v-else-if="activeTab === 'attention'">

          <div class="p2-attention-category-tabs" role="tablist" aria-label="关注事项状态分类"><button v-for="category in attentionCategories" :key="category.id" type="button" role="tab" :aria-selected="attentionCategory === category.id" :class="[{ active: attentionCategory === category.id }, category.id]" @click="attentionCategory = category.id">{{ category.label }}<span>{{ attentionBuckets[category.id].length }}</span></button></div>
          <div class="p2-list-intro"><strong>{{ attentionCategories.find(item => item.id === attentionCategory)?.label }}</strong><span>按行动与阶段分类；同一事项可出现在两个入口，总数按事项去重</span></div>
          <div v-if="attentionList.length" class="p2-attention-list">
            <button v-for="item in attentionList" :key="item.id" class="p2-attention-card" :class="[item.tone, attentionStatusClass(item.id)]" @click="selectCard(item.id)"><div class="p2-card-top"><span class="p2-attention-status" :class="attentionStatusClass(item.id)">{{ attentionStatus(item.id) }}</span></div><strong>{{ item.title }}</strong><p v-if="endedInfo(item.id)">{{ endedInfo(item.id).reason }} · {{ endedInfo(item.id).at }}</p><p v-else>{{ store.isTaskHandled(item.id) ? store.getObservationResult(item.id).text : item.id === 'drift' && store.todoCreated.drift ? '已关联人工检查待办，当前阶段：' + store.cases.drift.stages[store.progress.drift].label + '。' : item.id === 'drift' && store.attentionFeedback.drift ? '现场核实已提交，后续分析尚未更新；不等于排除故障。' : item.id === 'drift' && store.monitorStep.drift ? '新的可比片段中偏差扩大，需要核对现场读数、工况和现象。' : item.short }}</p><p class="p2-card-action"><b>{{ store.attentionAction(item.id).required || store.attentionAction(item.id).linked ? '需要你：' : '当前安排：' }}</b>{{ store.attentionAction(item.id).text }}</p><div class="p2-card-foot"><span>{{ item.device }}</span><span>查看事项详情 →</span></div></button>
          </div>
          <div v-else class="p2-empty p2-attention-empty"><strong>{{ attentionCategory === 'human' ? '当前没有需要你处理的关注事项' : attentionCategory === 'ended' ? '当前没有已结束的事项' : attentionCategory === 'post' ? '当前没有处理后观察的事项' : '当前没有系统跟踪中的关注事项' }}</strong><p v-if="attentionCategory==='human'">没有待处理要求，不代表设备全部正常。</p><div v-if="attentionCategory==='human'"><button class="p2-link-button" @click="attentionCategory='ai'">系统跟踪中 {{ attentionBuckets.ai.length }} 项 →</button> · <button class="p2-link-button" @click="attentionCategory='post'">处理后观察 {{ attentionBuckets.post.length }} 项 →</button></div></div>
      </template>
      <template v-else-if="activeTab === 'maintenance'">
          <div class="p2-history-head"><strong>维保建议</strong><div class="p2-maintenance-tools"><select v-model="adviceFilter" aria-label="维保建议筛选"><option value="pending">待处理建议</option><option value="all">全部建议</option></select><button class="p2-secondary" @click="openRegularPlan">查看已有维保安排 →</button></div></div>
          <div class="p2-attention-list"><button v-for="item in visibleAdvice" :key="item.id" type="button" class="p2-attention-card human" @click="openMaintenanceDetail(item.id)"><div class="p2-card-top"><span class="p2-attention-status human">{{ advice.status }}</span></div><strong>{{ item.title }}</strong><p>{{ store.isTaskHandled('maintenance') ? store.getObservationResult('maintenance').text : item.short }}</p><p class="p2-card-action"><b>当前需要你：</b>{{ advice.decision==='defer'?'暂不采纳原因已记录，可回看建议档案。':store.todoCreated.maintenance?'在原问题事件中继续检查或执行。':'确认是否开展检查，先补齐现场证据。' }}</p><div class="p2-card-foot"><span>{{ item.device }} · {{ advice.records.at(-1)?.at || '本日 · 计划评估（演示）' }}</span><span>查看建议详情 →</span></div></button></div>
          <div v-if="!visibleAdvice.length" class="p2-empty">当前没有待处理的维保建议，可切换“全部建议”回看已记录的决定及执行情况。</div>
      </template>
      <template v-else-if="activeTab === 'history'">
        <SituationReport v-if="historyDetail" :title="historyDetail.title" :status="historyDetail.status" :meta="historyDetail.date + ' ' + historyDetail.time + ' · ' + historyDetail.source" tone="ai" :conclusion="historyDetail.conclusion" :recommendation="historyDetail.recommendation" :sections="historyDetail.sections" back-label="返回设备履历" @back="historyDetailId = null">
          <template #actions><template v-if="historyDetail.type === 'maintenance' && historyDetail.target"><button type="button" class="p2-link-button" @click="openTodo(historyDetail.target)">回看来源待办 →</button><button v-if="store.isTaskHandled(historyDetail.target)" type="button" class="p2-link-button" @click="openObservation(historyDetail.target)">查看效果观察 →</button></template></template>
        </SituationReport>
        <template v-else>
          <div class="p2-history-head"><strong>设备履历</strong><select v-model="historyCategory" aria-label="履历记录类型"><option v-for="category in historyCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></div>
          <div class="p2-history-list"><button v-for="record in shownHistory" :key="record.id" type="button" class="p2-history-record" @click="openHistoryRecord(record)"><time>{{ record.date }}<small>{{ record.time }}</small></time><div><span class="p2-history-kind">{{ historyCategories.find(category => category.id === record.type)?.label }}</span><h3>{{ record.title }}</h3><p>{{ record.summary }}</p><small>{{ record.source }}</small></div><span class="p2-history-record-end">{{ record.status }}<b>{{ historyEntryLabel(record.type) }} →</b></span></button></div>
          <div v-if="!shownHistory.length" class="p2-empty">暂无{{ historyCategories.find(category => category.id === historyCategory)?.label }}。实际维护记录在现场作业提交并确认后生成。</div>
        </template>
      </template>
      <template v-else>
        <div class="p2-list-intro"><strong>本设备关联事件</strong><span>未结束 {{ activeTodoCount }} 条 · 已结束 {{ endedEventCount }} 条；按事件去重</span></div>
        <div class="p2-event-filters" role="group" aria-label="关联事件筛选"><button v-for="filter in [{id:'active',label:'未结束'},{id:'ended',label:'已结束'},{id:'all',label:'全部'}]" :key="filter.id" type="button" :aria-pressed="eventFilter===filter.id" :class="{active:eventFilter===filter.id}" @click="eventFilter=filter.id">{{filter.label}} {{filter.id==='active'?activeTodoCount:filter.id==='ended'?endedEventCount:todoCount}}</button></div>
        <p class="p2-health-scope">事件状态由原事件提供；人工处理完成、观察结束和退出详情都不自动结束事件。</p>
        <div v-if="!shownEvents.length" class="p2-empty">{{eventFilter==='ended'?'当前没有已结束的关联事件':eventFilter==='active'?'当前没有未结束的关联事件':'当前没有关联事件'}}。关注及普通留言不自动形成事件。</div>
        <article v-for="event in shownEvents" :key="event.id" class="p2-panel p2-related-event">
          <header><div><small>{{event.eventId}}</small><h3>{{event.title}}</h3></div><span class="p2-state-tag" :class="event.ended?'green':'blue'">{{event.status}}</span></header>
          <dl><div><dt>触发来源</dt><dd>{{event.trigger}}</dd></div><div><dt>当前阶段</dt><dd>{{event.stage}}</dd></div><div><dt>处理进展</dt><dd>{{event.processing}}</dd></div><div><dt>最近更新</dt><dd>{{event.updatedAt}}</dd></div><div v-if="event.source"><dt>关联来源</dt><dd>{{event.source.title}}</dd></div></dl>
          <p class="p2-event-action">{{event.action}}</p>
          <div class="p2-related-actions"><button v-if="event.source" class="p2-secondary" @click="openItem(event.source.id)">查看来源{{event.source.type}}</button><button v-if="event.handled" class="p2-secondary" @click="openObservation(event.id)">查看效果观察</button><button class="p2-primary" @click="openTodo(event.id)">进入事件</button></div>
        </article>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useMaintenanceAdviceStore } from '@/stores/maintenanceAdviceStore'
import { attentionDossier } from '@/mock/attentionDossier'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { maintenancePlans } from '@/mock/phase2Scenarios'
import SituationReport from '@/components/SituationReport.vue'
import { deviceHistory, historyCategories } from '@/mock/phase2History'
import { overviewActions } from '@/mock/r05Overview'
import { relatedEvents } from '@/mock/r06Events'
import { operationAssessment } from '@/mock/phase2SituationContent'
import { maintenanceFollowup } from '@/mock/phase2Followup'
const props = defineProps({ deviceName: { type: String, default: '主机' }, deviceId: { type: String, default: 'main-engine-1' } })
defineEmits(['select-sensor'])
const router = useRouter()
const store = usePhase2DemoStore()
const advice=useMaintenanceAdviceStore(),adviceFilter=ref('pending')
const visibleAdvice=computed(()=>store.attention.filter(item=>item.tab==='maintenance' && (adviceFilter.value==='all' || (!store.isTaskHandled(item.id)&&advice.decision!=='defer'))))
const tabs = [{ id: 'overview', label: '设备概览' }, { id: 'data', label: '传感器数据' }, { id: 'attention', label: '关注事项' }, { id: 'maintenance', label: '维保建议' }, { id: 'todo', label: '关联事件' }, { id: 'history', label: '设备履历' }]
const activeTab = ref('overview')
const attentionCategory = ref('human')
const deviceScroll = ref(null)
let attentionScrollTop = 0
const maintenanceCategory = ref('early')
const maintenanceDetailId = ref(null)
const historyCategory = ref('all')
const historyDetailId = ref(null)
const historyRecords = computed(() => deviceHistory(store))
const shownHistory = computed(() => historyRecords.value.filter(item => historyCategory.value === 'all' || item.type === historyCategory.value))
const historyDetail = computed(() => historyRecords.value.find(item => item.id === historyDetailId.value))
const regularPlan = maintenancePlans[0]
const attentionCategories = [{ id: 'human', label: '待我处理' }, { id: 'ai', label: '系统跟踪中' }, { id: 'post', label: '处理后观察' }, { id: 'ended', label: '已结束' }]
watch(activeTab, value => {
  store.attentionInFocus = false
  store.regularMaintenanceInFocus = false
  // Every tab entry starts from its own list context. A previously selected
  // maintenance card must never leak into the attention report view.
  store.clearObservationFocus()
  maintenanceDetailId.value = null
  historyDetailId.value = null
  if (value === 'attention') {
    attentionCategory.value = 'human'
    const first = attentionBuckets.value.human[0]
    if(first && !store.isTaskHandled(first.id)) store.selectAttention(first.id)
    else store.attentionInFocus = false
  }
  if (value === 'maintenance') {
    maintenanceCategory.value = 'early'
    store.selectAttention('maintenance')
  }
}, { immediate: true })
const isMainEngine = computed(() => props.deviceId === 'main-engine-1')
const selectedId = computed(() => store.selectedAttentionId)
const selectedItem = computed(() => store.selectedAttention)
defineExpose({ openItem, openObservation, showAttentionList, showMaintenanceList })
onUnmounted(() => {store.clearObservationFocus();store.regularMaintenanceInFocus=false})
let maintenanceScrollTop=0
async function openMaintenanceDetail(id='maintenance') {
  if(activeTab.value==='maintenance')maintenanceScrollTop=deviceScroll.value?.scrollTop || 0
  else {activeTab.value='maintenance';await nextTick();maintenanceScrollTop=0}
  router.push('/situation/maintenance/'+encodeURIComponent(id))
}
async function showMaintenanceList(){activeTab.value='maintenance';store.attentionInFocus=false;store.regularMaintenanceInFocus=false;await nextTick();if(deviceScroll.value)deviceScroll.value.scrollTop=maintenanceScrollTop}
async function openObservation(id) { await openAttentionDetail(id) }
async function openAttentionDetail(id) {
  const wasList = activeTab.value === 'attention'
  attentionScrollTop = wasList ? deviceScroll.value?.scrollTop || 0 : 0
  if (!wasList) { activeTab.value='attention'; await nextTick() }
  router.push('/situation/attention/' + encodeURIComponent(id))
}
async function showAttentionList() {
  activeTab.value='attention'
  store.attentionInFocus=false
  await nextTick()
  if(deviceScroll.value) deviceScroll.value.scrollTop=attentionScrollTop
}
const shownItems = computed(() => store.attention.filter(item => item.tab === activeTab.value))
const attentionBuckets = computed(() => {
  const items = [...store.attention.filter(item => item.tab === 'attention' && !store.isTaskHandled(item.id)), ...store.effectObservations.map(item=>({id:item.id,title:(item.id==='drift'?item.eventTitle:item.initialTitle)+' · 效果观察',device:'主机',tone:'blue',short:store.getObservationResult(item.id).text}))]
  return { ai: items.filter(item => store.attentionAction(item.id).phase === '系统跟踪中'), human: items.filter(item => {const action=store.attentionAction(item.id);return action.required || action.linked}), post:items.filter(item=>store.attentionAction(item.id).phase==='处理后观察'), ended: items.filter(item => store.attentionAction(item.id).phase === '已结束') }
})
const attentionList = computed(() => attentionBuckets.value[attentionCategory.value] || [])
// Tabs share the device conversation. Only entering a concrete report changes focus.
watch(maintenanceDetailId, maintenanceId => {
  store.attentionInFocus = Boolean(maintenanceId)
  store.regularMaintenanceInFocus = maintenanceId === 'planned'
}, { flush: 'sync' })
const relatedTodos = computed(() => relatedEvents(store))
const eventFilter=ref('active')
const shownEvents=computed(()=>relatedTodos.value.filter(event=>eventFilter.value==='all'||(eventFilter.value==='ended'?event.ended:!event.ended)))
const endedEventCount=computed(()=>relatedTodos.value.filter(event=>event.ended).length)
const todoCount = computed(() => relatedTodos.value.length)
const activeTodoCount=computed(()=>relatedTodos.value.filter(event=>!event.ended).length)
const attentionCount=computed(()=>new Set(Object.values(attentionBuckets.value).flat().map(item=>item.id)).size)
const maintenanceCount=computed(()=>store.attention.filter(item=>item.tab==='maintenance').length)
const runningAssessment = computed(() => operationAssessment(store))
const overviewAnalysis = computed(() => runningAssessment.value.summary)
function observationSummary(id) {
  const values = runningAssessment.value.readings[id === 'maintenance' ? 'bearing' : id]
  const evidence = id === 'fault' ? `最新出口温度${values[0]}°C、流量${values[1]} m³/h` : id === 'drift' ? `最新排温差${values[0]}°C、排温${values[1]}°C` : `最新振动${values[0]} mm/s、温度${values[1]}°C`
  return evidence + '；' + store.getObservationResult(id).title + '。'
}
function observationTag(id) { return store.attentionAction(id).phase }
function observationTone(id) { return store.getObservationResult(id).type === 'archive' ? 'green' : store.getObservationResult(id).type === 'reinspect' ? 'amber' : 'blue' }
const overviewItems=computed(()=>overviewActions(store,advice))
const maintenanceAssessmentData = computed(() => maintenanceFollowup(store, maintenanceDetailId.value === 'planned'))
const maintenanceConclusion = computed(() => maintenanceAssessmentData.value.conclusion)
const maintenanceRecommendation = computed(() => maintenanceAssessmentData.value.recommendation)
const regularPlanReport = computed(() => maintenanceFollowup(store, true).sections)
const maintenanceReport = computed(() => maintenanceFollowup(store).sections)
function attentionStatusClass(id) { const action=store.attentionAction(id); return action.phase==='已结束'?'ended':action.required||action.linked?'human':'ai' }
function endedInfo(id) { return store.attentionAction(id).phase==='已结束' ? attentionDossier(store,id)?.closure : null }
function attentionStatus(id) { return store.attentionAction(id).phase }
function selectCard(id) { openAttentionDetail(id) }
function openItem(id) { if(['stable','vibration-trend'].includes(id)){activeTab.value='data';store.attentionInFocus=false;store.deviceDataTopic=id;store.sendR02Message('device',id==='stable'?'泵出口压力有波动，要处理吗？':'机体振动小幅变化，是设备退化吗？',id);return} if (store.isTaskHandled(id)) {openObservation(id);return} if (id === 'fault') {openTodo(id);return} if(id !== 'maintenance'){openAttentionDetail(id);return} openMaintenanceDetail(id) }
function openRegularPlan() { openMaintenanceDetail('planned') }
function historyEntryLabel(type) { return ({event:'打开关联待办',attention:'查看关注材料',recommendation:'查看维保建议',maintenance:'查看维护记录',review:'查看回顾报告'})[type] || '查看记录' }
async function openHistoryRecord(record) {
  if (record.type === 'event' && record.target) { openTodo(record.target); return }
  if (record.type === 'attention' && record.target) { openItem(record.target); return }
  if (record.type === 'recommendation' && record.target) { openMaintenanceDetail(record.target); return }
  historyDetailId.value = record.id
}
watch(maintenanceCategory, () => { if (activeTab.value === 'maintenance' && !maintenanceDetailId.value) { store.attentionInFocus = false; store.regularMaintenanceInFocus = false } })
function openTodo(id) { store.selectTodo(id); router.push('/event') }
function stateText(id) { if (id === 'maintenance' && store.isTaskHandled(id)) return '已处理 · '+(store.getObservationResult(id).type==='archive'?'观察已结束':'态势观察中'); if (id === 'maintenance' && store.todoCreated.maintenance) return store.cases.maintenance.stages[store.progress.maintenance].label === '完整闭环' ? '已闭环' : '已关联待办 · ' + store.cases.maintenance.stages[store.progress.maintenance].label; if(store.todoCreated[id]&&store.progress[id]===store.cases[id].stages.length-1)return '已闭环'; if (id === 'stable') return store.monitorStep.stable === 2 ? '已收束 · 未建待办' : '系统监测中'; if (id === 'drift') return store.todoCreated.drift ? '已形成待办' : store.monitorStep.drift ? '异动加剧' : '系统监测中'; return store.todoCreated.maintenance ? '已形成待办' : '待确认建议' }
</script>

<style scoped>
.p2-event-filters{display:flex;gap:8px;margin:12px 0}.p2-event-filters button{padding:7px 12px;border:1px solid #e5e9ef;border-radius:6px;background:#fff;color:#667085;cursor:pointer}.p2-event-filters button.active{background:#faf8f4;color:#8b7959;border-color:#d9ccb8}
.p2-related-event header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.p2-related-event header small{color:#8a94a5;font-size:12px}.p2-related-event h3{margin:4px 0 12px;font-size:15px}.p2-related-event dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin:8px 0;font-size:12px;line-height:1.7}.p2-related-event dl div{display:grid;grid-template-columns:65px minmax(0,1fr);gap:8px}.p2-related-event dt{color:#8a94a5}.p2-related-event dd{margin:0;color:#556172;overflow-wrap:anywhere}.p2-event-action{font-size:13px;line-height:1.8;color:#344054;margin:12px 0}.p2-related-event .p2-related-actions{justify-content:flex-end;flex-wrap:wrap}
@media(max-width:1024px){.p2-related-event dl{grid-template-columns:1fr}}
.p2-health-meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12px;color:#727c8b;margin:10px 0}
.p2-health-scope{font-size:12px;line-height:1.7;color:#727c8b;margin:6px 0 12px}
.p2-overview-type{display:block;font-size:11px;color:#8b7959;margin-bottom:3px}
.p2-maintenance-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
</style>
