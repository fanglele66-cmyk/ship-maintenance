<template>
  <div class="p2-device-page">
    <div class="p2-device-head">
      <div><span class="p2-eyebrow">设备态势</span><h2>{{ deviceName }}</h2></div>
      <div v-if="isMainEngine" class="p2-device-status"><span><i></i>航行中</span><span>关注事项 <b>{{ attentionCount }}</b></span><span>当前待办 <b>{{ activeTodoCount }}</b></span></div>
    </div>
    <div class="p2-tab-row" role="tablist" aria-label="设备层内容">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}<span v-if="tab.id === 'attention' && attentionCount">{{ attentionCount }}</span><span v-if="isMainEngine && tab.id === 'maintenance' && maintenanceCount">{{ maintenanceCount }}</span><span v-if="isMainEngine && tab.id === 'todo' && activeTodoCount">{{ activeTodoCount }}</span></button>
    </div>
    <div ref="deviceScroll" class="p2-device-scroll">
      <template v-if="activeTab === 'data'"><slot name="data" /></template>
      <template v-else-if="!isMainEngine">
        <template v-if="activeTab==='overview'"><section class="p2-panel device-basic-overview"><h3>设备运行概况</h3><div class="device-metric-strip"><div v-for="metric in otherDevice?.metrics" :key="metric.label"><span>{{ metric.label }}</span><strong>{{ metric.value }} <small>{{ metric.unit }}</small></strong></div></div><h4>当前判断</h4><p>{{ otherOverview.conclusion }}</p><h4>依据与推断</h4><p>{{ otherOverview.basis }}</p><h4>下一步建议</h4><p>{{ otherOverview.next }}</p><button class="p2-secondary" @click="activeTab='data'">查看传感器数据</button></section><section class="p2-panel"><h3>值得关注</h3><p>{{ otherOverview.limit }}</p><button v-for="task in otherTasks" :key="task.id" class="p2-secondary" @click="openTodo(task.id)">查看{{ task.initialTitle }}</button></section></template>
        <section v-else-if="activeTab==='history' && otherHistory.length" class="p2-panel"><h3>设备动态</h3><button v-for="task in otherHistory" :key="task.id" class="p2-attention-card human" @click="openTodo(task.id)"><strong>{{ task.initialTitle }}</strong><p>{{ store.isTaskHandled(task.id)?'本轮处理记录已提交，可回看现场反馈、执行和验收结果。':task.stages[store.progress[task.id]].summary }}</p><span>{{ store.isTaskHandled(task.id)?'已处理':'跟进中' }}</span></button></section><section v-else-if="activeTab==='todo' && otherTasks.length" class="p2-panel"><h3>当前待办</h3><button v-for="task in otherTasks" :key="task.id" class="p2-attention-card human" @click="openTodo(task.id)"><strong>{{ task.initialTitle }}</strong><p>{{ task.stages[store.progress[task.id]].summary }}</p><div class="p2-card-foot"><span>{{ store.assignments[task.id]?.owner }}</span><span>{{ task.stages[store.progress[task.id]].label }}</span></div></button></section><section v-else class="p2-panel"><h3>{{ tabs.find(t=>t.id===activeTab)?.label }}</h3><p>{{ activeTab==='todo'?'当前没有已建立的待办。新的现场异常应先补充证据，由轮机长判断是否安排检查。':activeTab==='maintenance'?'当前没有新增维保建议。仍应按设备说明书及既有维保安排执行，不因建议为空而跳过周期保养。':'当前没有可回查的处置动态。检查、指派及实际处理提交后，将在这里保留相应记录。' }}</p><button class="p2-link-button" @click="activeTab='overview'">返回设备概览</button></section>
      </template>
      <template v-else-if="activeTab === 'overview'">
        <div class="p2-overview-layout">
        <div class="p2-panel">
          <div class="p2-section-title">设备健康研判</div>
          <div class="p2-health-meta"><span>分析完成 {{ runningAssessment.completedAt }}</span><span>数据截止 {{ runningAssessment.dataCutoff }}</span><span>{{ runningAssessment.analysisRange }}</span></div>
          <p class="p2-health-scope">{{ runningAssessment.conditions }} · {{ runningAssessment.coverage }}</p>
          <p class="p2-health-scope">已结合当前运行工况、可比历史片段与现场反馈进行研判。</p>
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
          <div class="p2-section-title">值得关注</div><p v-if="!overviewItems.length" class="p2-health-scope">当前没有待决策建议。已安排的事项可在“当前待办”中跟进。</p><div class="p2-overview-list">
            <button v-for="item in overviewItems" :key="item.id" type="button" class="p2-overview-item" @click="openItem(item.id)">
              <span class="p2-overview-item-main"><span class="p2-overview-type">{{ item.type }}</span><b>{{ item.title }}</b><small>{{ item.text }}</small></span>
              <span class="p2-state-tag" :class="item.priority<=2?'amber':'blue'">{{ item.tag }}</span>
            </button>
          </div>
        </div>
        </div>
      </template>
      <template v-else-if="activeTab === 'maintenance'">
          <div class="p2-history-head"><strong>维保建议</strong><div class="p2-maintenance-tools"><select v-model="adviceFilter" aria-label="维保建议筛选"><option value="pending">待处理建议</option><option value="all">全部建议</option></select><button class="p2-secondary" @click="openRegularPlan">查看已有维保安排 →</button></div></div>
          <div class="p2-attention-list"><button v-for="item in visibleAdvice" :key="item.id" type="button" class="p2-attention-card human" @click="openMaintenanceDetail(item.id)"><div class="p2-card-top"><span class="p2-attention-status human">{{ advice.status }}</span></div><strong>{{ item.title }}</strong><p>{{ store.isTaskHandled('maintenance') ? store.getObservationResult('maintenance').text : item.short }}</p><p class="p2-card-action"><b>当前需要你：</b>{{ advice.decision==='defer'?'暂不采纳原因已记录，可回看建议档案。':store.todoCreated.maintenance?'在原问题事件中继续检查或执行。':'确认是否开展检查，先补齐现场证据。' }}</p><div class="p2-card-foot"><span>{{ item.device }} · {{ advice.records.at(-1)?.at || '本日 · 计划评估（演示）' }}</span><span>查看建议详情 →</span></div></button></div>
          <div v-if="!visibleAdvice.length" class="p2-empty">当前没有待处理的维保建议，可切换“全部建议”回看已记录的决定及执行情况。</div>
      </template>
      <template v-else-if="activeTab === 'history'">
        <SituationReport v-if="historyDetail" :title="historyDetail.title" :status="historyDetail.status" :meta="historyDetail.date + ' ' + historyDetail.time + ' · ' + historyDetail.source" tone="ai" :conclusion="historyDetail.conclusion" :recommendation="historyDetail.recommendation" :sections="historyDetail.sections" back-label="返回设备动态" @back="historyDetailId = null">
          <template #actions><template v-if="historyDetail.type === 'maintenance' && historyDetail.target"><button type="button" class="p2-link-button" @click="openTodo(historyDetail.target)">回看来源待办 →</button><button v-if="store.isTaskHandled(historyDetail.target)" type="button" class="p2-link-button" @click="openObservation(historyDetail.target)">查看效果观察 →</button></template></template>
        </SituationReport>
        <template v-else>
          <div class="p2-history-head"><strong>设备动态</strong><select v-model="historyCategory" aria-label="履历记录类型"><option v-for="category in historyCategories" :key="category.id" :value="category.id">{{ category.label }}</option></select></div>
          <div class="p2-history-list"><button v-for="record in shownHistory" :key="record.id" type="button" class="p2-history-record" @click="openHistoryRecord(record)"><time>{{ record.date }}<small>{{ record.time }}</small></time><div><span class="p2-history-kind">{{ historyCategories.find(category => category.id === record.type)?.label }}</span><h3>{{ record.title }}</h3><p>{{ record.summary }}</p><small>{{ record.source }}</small></div><span class="p2-history-record-end">{{ record.status }}<b>{{ historyEntryLabel(record.type) }} →</b></span></button></div>
          <div v-if="!shownHistory.length" class="p2-empty">暂无{{ historyCategories.find(category => category.id === historyCategory)?.label }}。实际维护记录在现场作业提交并确认后生成。</div>
        </template>
      </template>
      <template v-else>
        <div class="p2-list-intro"><strong>当前待办</strong><span>{{ activeTodoCount }} 项正在跟进</span></div><div v-if="!shownEvents.length" class="p2-empty">当前没有待处理任务，已完成的记录可在设备动态中回看。</div>
        <article v-for="event in shownEvents" :key="event.id" class="p2-panel p2-related-event">
          <header><div><small>{{event.eventId}}</small><h3>{{event.title}}</h3></div><span class="p2-state-tag" :class="event.ended?'green':'blue'">{{event.status}}</span></header>
          <dl><div><dt>触发来源</dt><dd>{{event.trigger}}</dd></div><div><dt>负责人</dt><dd>{{ store.assignments[event.id]?.owner }}</dd></div><div><dt>当前阶段</dt><dd>{{event.stage}}</dd></div><div><dt>处理进展</dt><dd>{{event.processing}}</dd></div><div><dt>最近更新</dt><dd>{{event.updatedAt}}</dd></div><div v-if="event.source"><dt>关联来源</dt><dd>{{event.source.title}}</dd></div></dl>
          <p class="p2-event-action">{{event.action}}</p>
          <div class="p2-related-actions"><button v-if="event.source" class="p2-secondary" @click="openItem(event.source.id)">查看来源{{event.source.type}}</button><button v-if="event.handled" class="p2-secondary" @click="openObservation(event.id)">查看效果观察</button><button class="p2-primary" @click="openTodo(event.id)">进入待办</button></div>
        </article>
      </template>
    </div>
  </div>
</template>

<script setup>
import profiles from '@/mock/deviceOverviewProfiles.json'
import { useDeviceStore } from '@/stores/deviceStore'
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
const deviceStore=useDeviceStore()
const otherHistory=computed(()=>store.visibleTodos.filter(t=>t.deviceId===props.deviceId))
const otherTasks=computed(()=>store.visibleTodos.filter(t=>t.deviceId===props.deviceId&&!store.isTaskHandled(t.id)))
const otherDevice=computed(()=>deviceStore.getDeviceById(props.deviceId))
const otherOverview=computed(()=>profiles[props.deviceId]||{conclusion:'当前已取得部分运行指标，暂无已建立的关注事项。',basis:'当前判断仅覆盖已采集指标，缺少连续趋势和现场核验结果，不据此确认设备所有部位正常。',next:'先查看传感器数据并按巡检规程核对现场；出现持续变化后再判断是否安排检查。',limit:'暂无待决策建议，继续执行原有巡检与维保安排。'})
watch(()=>props.deviceId,()=>{activeTab.value='overview';historyDetailId.value=null})
const advice=useMaintenanceAdviceStore(),adviceFilter=ref('pending')
const visibleAdvice=computed(()=>store.attention.filter(item=>item.tab==='maintenance' && (adviceFilter.value==='all' || (!store.isTaskHandled(item.id)&&advice.decision!=='defer'))))
const tabs = [{ id: 'overview', label: '设备概览' }, { id: 'data', label: '传感器数据' }, { id: 'maintenance', label: '维保建议' }, { id: 'todo', label: '当前待办' }, { id: 'history', label: '设备动态' }]
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
  if (!wasList) { activeTab.value='overview'; await nextTick() }
  router.push('/situation/attention/' + encodeURIComponent(id))
}
async function showAttentionList() {
  activeTab.value='overview'
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
const shownEvents=computed(()=>relatedTodos.value.filter(event=>!store.cases[event.id]?.deviceId&&!store.isTaskHandled(event.id)))
const endedEventCount=computed(()=>relatedTodos.value.filter(event=>event.ended).length)
const todoCount = computed(() => relatedTodos.value.length)
const activeTodoCount=computed(()=>shownEvents.value.length)
const attentionCount=computed(()=>['drift','maintenance'].filter(id=>!store.todoCreated[id]&&!store.ignoredSuggestions[id]).length)
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
const overviewItems=computed(()=>overviewActions(store,advice).filter(item=>['drift','maintenance'].includes(item.id)&&!store.todoCreated[item.id]&&!store.ignoredSuggestions[item.id]&&!store.isTaskHandled(item.id)))
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
function openTodo(id) { store.selectTodo(id); router.push({path:'/event',query:{todo:id}}) }
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
.device-metric-strip{display:flex;gap:36px;margin:18px 0 24px}.device-metric-strip span{display:block;color:#7d8999;font-size:13px}.device-metric-strip strong{display:block;font-size:24px;margin-top:8px}.device-metric-strip small{font-size:13px}.p2-panel>p{font-size:14px;line-height:1.9;color:#53647a}
.device-basic-overview h3{font-size:17px;margin:0 0 18px}.device-basic-overview h4{font-size:14px;font-weight:600;margin:22px 0 8px}.device-basic-overview p{margin:0 0 12px;line-height:1.9}.device-basic-overview .device-metric-strip{margin:14px 0 24px}
</style>
