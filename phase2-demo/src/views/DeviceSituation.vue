<template>
  <div class="p2-device-page">
    <div class="p2-device-head">
      <div><span class="p2-eyebrow">设备态势</span><h2>{{ deviceName }}</h2></div>
      <div v-if="isMainEngine" class="p2-device-status"><span><i></i>航行中</span><span>关注事项 <b>{{ attentionCount }}</b></span><span>未处理待办 <b>{{ activeTodoCount }}</b></span></div>
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
          <div class="p2-section-title">运行研判</div>
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
          <div class="p2-section-title">设备关注与处置</div>
          <div class="p2-overview-list">
            <button v-for="item in overviewItems" :key="item.id" type="button" class="p2-overview-item" @click="openItem(item.id)">
              <span class="p2-overview-item-main"><b>{{ item.title }}</b><small>{{ item.text }}</small></span>
              <span class="p2-state-tag" :class="item.tone">{{ item.tag }}</span>
            </button>
          </div>
        </div>
        </div>
      </template>
      <template v-else-if="activeTab === 'attention'">

          <div class="p2-attention-category-tabs" role="tablist" aria-label="关注事项状态分类"><button v-for="category in attentionCategories" :key="category.id" type="button" role="tab" :aria-selected="attentionCategory === category.id" :class="[{ active: attentionCategory === category.id }, category.id]" @click="attentionCategory = category.id">{{ category.label }}<span>{{ attentionBuckets[category.id].length }}</span></button></div>
          <div class="p2-list-intro"><strong>{{ attentionCategories.find(item => item.id === attentionCategory)?.label }}</strong><span>按行动与阶段分类；同一事项可出现在两个入口，总数按事项去重</span></div>
          <div v-if="attentionList.length" class="p2-attention-list">
            <button v-for="item in attentionList" :key="item.id" class="p2-attention-card" :class="[item.tone, attentionStatusClass(item.id)]" @click="selectCard(item.id)"><div class="p2-card-top"><span class="p2-attention-status" :class="attentionStatusClass(item.id)">{{ attentionStatus(item.id) }}</span></div><strong>{{ item.title }}</strong><p>{{ store.isTaskHandled(item.id) ? store.getObservationResult(item.id).text : item.id === 'stable' && store.monitorStep.stable === 2 ? '三轮同工况数据均未扩大，系统已结束专项观察。' : item.id === 'drift' && store.todoCreated.drift ? '已关联人工检查待办，当前阶段：' + store.cases.drift.stages[store.progress.drift].label + '。' : item.id === 'drift' && store.attentionFeedback.drift ? '现场核实已提交，系统接续分析，不代表已排除故障。' : item.id === 'drift' && store.monitorStep.drift ? '排温相对差升至10°C并出现轻微波动，等待现场确认。' : item.short }}</p><p class="p2-card-action"><b>{{ store.attentionAction(item.id).required || store.attentionAction(item.id).linked ? '需要你：' : '当前安排：' }}</b>{{ store.attentionAction(item.id).text }}</p><div class="p2-card-foot"><span>{{ item.device }}</span><span>查看事项详情 →</span></div></button>
          </div>
          <div v-else class="p2-empty p2-attention-empty"><strong>{{ attentionCategory === 'human' ? '当前没有需要你处理的关注事项' : attentionCategory === 'ended' ? '当前没有已结束的事项' : attentionCategory === 'post' ? '当前没有处理后观察的事项' : '当前没有系统跟踪中的关注事项' }}</strong><p v-if="attentionCategory==='human'">没有待处理要求，不代表设备全部正常。</p><div v-if="attentionCategory==='human'"><button class="p2-link-button" @click="attentionCategory='ai'">系统跟踪中 {{ attentionBuckets.ai.length }} 项 →</button> · <button class="p2-link-button" @click="attentionCategory='post'">处理后观察 {{ attentionBuckets.post.length }} 项 →</button></div></div>
      </template>
      <template v-else-if="activeTab === 'maintenance'">
        <SituationReport v-if="maintenanceDetailId" :title="maintenanceDetailId === 'planned' ? regularPlan.title : selectedItem.title" :status="maintenanceDetailId === 'planned' ? '常规计划' : stateText('maintenance')" :tone="maintenanceDetailId === 'planned' ? 'ai' : store.todoCreated.maintenance ? 'transferred' : 'human'" :meta="regularPlan.device + ' · 周期计划 ' + regularPlan.currentHours.toLocaleString() + ' / ' + regularPlan.dueHours.toLocaleString() + ' h'" :conclusion="maintenanceConclusion" :recommendation="maintenanceRecommendation" :sections="maintenanceDetailId === 'planned' ? regularPlanReport : maintenanceReport" :timeline="maintenanceAssessmentData.timeline" :arrangement="maintenanceAssessmentData.arrangement" timeline-first timeline-expanded back-label="返回维保计划" @back="maintenanceDetailId = null">
          <template #actions><button v-if="maintenanceDetailId !== 'planned' && store.isTaskHandled('maintenance')" type="button" class="p2-link-button" @click="openObservation('maintenance')">查看态势效果观察 →</button><button v-if="maintenanceDetailId !== 'planned' && store.todoCreated.maintenance" type="button" class="p2-link-button" @click="openTodo('maintenance')">查看关联待办 · {{ store.cases.maintenance.stages[store.progress.maintenance].label }} →</button><button v-else-if="maintenanceDetailId === 'planned'" type="button" class="p2-link-button" @click="maintenanceDetailId='maintenance';store.regularMaintenanceInFocus=false;store.attentionInFocus=true;store.selectAttention('maintenance')">查看本部件提前维保建议 →</button></template>
        </SituationReport>
        <template v-else>
          <div class="p2-attention-category-tabs p2-maintenance-subtabs" role="tablist" aria-label="维保信息分类"><button type="button" role="tab" :aria-selected="maintenanceCategory==='early'" :class="{active:maintenanceCategory==='early'}" @click="maintenanceCategory='early'">提前维保建议<span>{{ shownItems.length }}</span></button><button type="button" role="tab" :aria-selected="maintenanceCategory==='planned'" :class="{active:maintenanceCategory==='planned'}" @click="maintenanceCategory='planned'">常规维保计划<span>{{ maintenancePlans.length }}</span></button></div>
          <div class="p2-list-intro"><strong>{{ maintenanceCategory === 'early' ? '提前维保建议' : '常规维保计划' }}</strong></div>
          <div class="p2-attention-list">
            <template v-if="maintenanceCategory==='early'"><button v-for="item in shownItems" :key="item.id" type="button" class="p2-attention-card human" @click="maintenanceDetailId=item.id;store.selectAttention(item.id);store.attentionInFocus=true"><div class="p2-card-top"><span class="p2-attention-status" :class="store.todoCreated.maintenance?'transferred':'human'">{{ stateText(item.id) }}</span></div><strong>{{ item.title }}</strong><p>{{ store.isTaskHandled('maintenance') ? store.getObservationResult('maintenance').text : item.short }}</p><div class="p2-card-foot"><span>{{ item.device }}</span><span>查看建议详情 →</span></div></button></template>
            <button v-else type="button" class="p2-attention-card" @click="openRegularPlan"><div class="p2-card-top"><span class="p2-attention-status ai">常规计划</span></div><strong>{{ regularPlan.title }}</strong><p>累计运行 {{ regularPlan.currentHours.toLocaleString() }} / {{ regularPlan.dueHours.toLocaleString() }} h，剩余约 {{ regularPlan.remainingHours }} h。{{ regularPlan.window }}。</p><div class="p2-card-foot"><span>{{ regularPlan.device }}</span><span>查看计划详情 →</span></div></button>
          </div>
        </template>
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
      <template v-else><div class="p2-list-intro"><strong>本设备待办</strong></div><div v-if="!todoCount" class="p2-empty">当前暂无待办</div><div v-for="todo in relatedTodos" :key="todo.id" class="p2-panel p2-todo-jump"><div><span class="p2-badge blue">{{ todo.id==='drift'&&store.progress.drift>=2?'故障/异常事件的排查与处置':todo.cardType }}</span><h3>{{ todo.id==='drift'&&store.progress.drift>=2?todo.eventTitle:todo.initialTitle }}</h3><p>{{ store.isTaskHandled(todo.id)?'已处理 · 现场措施与验收已提交':'未处理 · '+todo.stages[store.progress[todo.id]].label }}</p></div><div class="p2-related-actions"><button v-if="store.isTaskHandled(todo.id)" class="p2-secondary" @click="openObservation(todo.id)">查看效果观察 →</button><button class="p2-primary" @click="openTodo(todo.id)">{{ store.isTaskHandled(todo.id)?'回看处理记录':'查看待办' }} →</button></div></div></template>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { maintenancePlans } from '@/mock/phase2Scenarios'
import SituationReport from '@/components/SituationReport.vue'
import { deviceHistory, historyCategories } from '@/mock/phase2History'
import { operationAssessment } from '@/mock/phase2SituationContent'
import { maintenanceFollowup } from '@/mock/phase2Followup'
const props = defineProps({ deviceName: { type: String, default: '主机' }, deviceId: { type: String, default: 'main-engine-1' } })
defineEmits(['select-sensor'])
const router = useRouter()
const store = usePhase2DemoStore()
const tabs = [{ id: 'overview', label: '设备概览' }, { id: 'data', label: '传感器数据' }, { id: 'attention', label: '关注事项' }, { id: 'maintenance', label: '维保计划' }, { id: 'todo', label: '待办任务' }, { id: 'history', label: '设备履历' }]
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
defineExpose({ openItem, openObservation, showAttentionList })
onUnmounted(() => {store.clearObservationFocus();store.regularMaintenanceInFocus=false})
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
const relatedTodos = computed(() => store.visibleTodos)
const todoCount = computed(() => relatedTodos.value.length)
const activeTodoCount=computed(()=>relatedTodos.value.filter(todo=>!store.isTaskHandled(todo.id)).length)
const attentionCount=computed(()=>new Set(Object.values(attentionBuckets.value).flat().map(item=>item.id)).size)
const maintenanceCount=computed(()=>store.attention.filter(item=>item.tab==='maintenance').length + maintenancePlans.length)
const runningAssessment = computed(() => operationAssessment(store))
const overviewAnalysis = computed(() => runningAssessment.value.summary)
function observationSummary(id) {
  const values = runningAssessment.value.readings[id === 'maintenance' ? 'bearing' : id]
  const evidence = id === 'fault' ? `最新出口温度${values[0]}°C、流量${values[1]} m³/h` : id === 'drift' ? `最新排温差${values[0]}°C、排温${values[1]}°C` : `最新振动${values[0]} mm/s、温度${values[1]}°C`
  return evidence + '；' + store.getObservationResult(id).title + '。'
}
function observationTag(id) { return store.attentionAction(id).phase }
function observationTone(id) { return store.getObservationResult(id).type === 'archive' ? 'green' : store.getObservationResult(id).type === 'reinspect' ? 'amber' : 'blue' }
const overviewItems=computed(()=>[
  {id:'fault',title:'冷却系统 · 出口水温偏高',text:store.isTaskHandled('fault')?observationSummary('fault'):'出口水温92.4°C，高于85°C参考上限；流量68.2 m³/h，低于80 m³/h参考下限。',tag:store.isTaskHandled('fault')?observationTag('fault'):'待办未处理',tone:store.isTaskHandled('fault')?observationTone('fault'):'red'},
  {id:'drift',title:'3#缸 · 排温相对差',text:store.isTaskHandled('drift')?observationSummary('drift'):store.todoCreated.drift?`已关联待办，当前阶段：${store.cases.drift.stages[store.progress.drift].label}。`:store.monitorStep.drift?'相对差由8°C扩大至10°C，排温432°C；仍低于450°C AMS报警线。':'同工况相对差约8°C，排温428°C，系统持续比较变化。',tag:store.attentionAction('drift').phase,tone:store.isTaskHandled('drift')?observationTone('drift'):store.attentionAction('drift').required||store.attentionAction('drift').linked?'amber':'blue'},
  {id:'stable',title:'海水冷却泵 · 出口压力',text:store.monitorStep.stable>=2?'三轮同工况压力变化未扩大并收敛，已结束专项观察。':'出口压力0.38–0.41 MPa小幅波动；流量与水温未同步恶化。',tag:store.monitorStep.stable>=2?'已结束':'系统跟踪中',tone:store.monitorStep.stable>=2?'green':'blue'},
  {id:'cyl2-ended',title:'2#缸 · 排温波动观察',text:'三轮同工况读数420–421°C，缸间差值收敛至约0°C，已恢复常规监测。',tag:'已结束',tone:'green'},
  {id:'vibration-trend',title:'主机机体 · X向振动',text:'近三轮采集值2.7→2.8→2.8 mm/s，未形成持续上升，继续系统跟踪。',tag:'系统跟踪中',tone:'blue'},
  {id:'maintenance',title:'1#缸连杆轴承 · 振动趋势',text:store.isTaskHandled('maintenance')?observationSummary('maintenance'):'近7日振动2.1→3.0 mm/s；距周期检修约140 h，靠港窗口约48 h后。',tag:store.isTaskHandled('maintenance')?observationTag('maintenance'):store.todoCreated.maintenance?'待办未处理':'建议提前检查',tone:store.isTaskHandled('maintenance')?observationTone('maintenance'):store.todoCreated.maintenance?'blue':'amber'}
])
const maintenanceAssessmentData = computed(() => maintenanceFollowup(store, maintenanceDetailId.value === 'planned'))
const maintenanceConclusion = computed(() => maintenanceAssessmentData.value.conclusion)
const maintenanceRecommendation = computed(() => maintenanceAssessmentData.value.recommendation)
const regularPlanReport = computed(() => maintenanceFollowup(store, true).sections)
const maintenanceReport = computed(() => maintenanceFollowup(store).sections)
function attentionStatusClass(id) { const action=store.attentionAction(id); return action.phase==='已结束'?'ended':action.required||action.linked?'human':'ai' }
function attentionStatus(id) { return store.attentionAction(id).phase }
function selectCard(id) { openAttentionDetail(id) }
function openItem(id) { if (store.isTaskHandled(id)) {openObservation(id);return} if (id === 'fault') {openTodo(id);return} if(id !== 'maintenance'){openAttentionDetail(id);return} activeTab.value='maintenance'; setTimeout(()=>{store.selectAttention(id);maintenanceCategory.value='early';maintenanceDetailId.value=id;store.attentionInFocus=true},0) }
function openRegularPlan() { maintenanceDetailId.value = 'planned'; store.regularMaintenanceInFocus = true; store.selectAttention('maintenance'); store.attentionInFocus = true }
function historyEntryLabel(type) { return ({event:'打开关联待办',attention:'查看关注材料',recommendation:'查看维保建议',maintenance:'查看维护记录',review:'查看回顾报告'})[type] || '查看记录' }
async function openHistoryRecord(record) {
  if (record.type === 'event' && record.target) { openTodo(record.target); return }
  if (record.type === 'attention' && record.target) { openItem(record.target); return }
  if (record.type === 'recommendation' && record.target) {
    activeTab.value = 'maintenance'
    await nextTick()
    maintenanceCategory.value = 'early'
    maintenanceDetailId.value = record.target
    store.regularMaintenanceInFocus = false
    store.selectAttention(record.target)
    store.attentionInFocus = true
    return
  }
  historyDetailId.value = record.id
}
watch(maintenanceCategory, () => { if (activeTab.value === 'maintenance' && !maintenanceDetailId.value) { store.attentionInFocus = false; store.regularMaintenanceInFocus = false } })
function openTodo(id) { store.selectTodo(id); router.push('/event') }
function stateText(id) { if (id === 'maintenance' && store.isTaskHandled(id)) return '已处理 · '+(store.getObservationResult(id).type==='archive'?'观察已结束':'态势观察中'); if (id === 'maintenance' && store.todoCreated.maintenance) return store.cases.maintenance.stages[store.progress.maintenance].label === '完整闭环' ? '已闭环' : '已关联待办 · ' + store.cases.maintenance.stages[store.progress.maintenance].label; if(store.todoCreated[id]&&store.progress[id]===store.cases[id].stages.length-1)return '已闭环'; if (id === 'stable') return store.monitorStep.stable === 2 ? '已收束 · 未建待办' : '系统监测中'; if (id === 'drift') return store.todoCreated.drift ? '已形成待办' : store.monitorStep.drift ? '异动加剧' : '系统监测中'; return store.todoCreated.maintenance ? '已形成待办' : '待确认建议' }
</script>
