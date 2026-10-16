<template>
  <div class="p2-device-page">
    <div class="p2-device-head">
      <BackButton label="返回船舶态势" @click="$emit('back')"/><div class="device-heading"><span class="p2-eyebrow">设备态势</span><h2>{{ deviceName }}</h2></div>
      <div v-if="isMainEngine" class="p2-device-status"><span><i></i>航行中</span></div>
    </div>
    <div class="p2-tab-row" role="tablist" aria-label="设备层内容">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
    </div>
    <div ref="deviceScroll" class="p2-device-scroll">
      <template v-if="activeTab === 'data'"><slot name="data" /></template>
      <DeviceIssueBrowser v-else-if="activeTab==='related'" :device-id="deviceId" :initial-type="relatedType" :initial-state="relatedState" @overview="activeTab='overview'"/><template v-else-if="!isMainEngine">
        <template v-if="activeTab==='overview'"><section class="p2-panel device-basic-overview"><h4>当前判断</h4><p>{{ otherOverview.conclusion }}</p><h4>依据与推断</h4><p>{{ otherOverview.basis }}</p><h4>下一步建议</h4><p>{{ otherOverview.next }}</p><button class="p2-secondary" @click="activeTab='data'">查看传感器数据</button></section></template>
        <section v-else-if="activeTab==='history' && otherHistory.length" class="p2-panel"><h3>动态记录</h3><button v-for="task in otherHistory" :key="task.id" class="p2-attention-card human" @click="openTodo(task.id)"><strong>{{ task.initialTitle }}</strong><p>{{ store.isTaskHandled(task.id)?'本轮处理记录已提交，可回看现场反馈、执行和验收结果。':task.stages[store.progress[task.id]].summary }}</p><span>{{ store.isTaskHandled(task.id)?'已处理':'跟进中' }}</span></button></section><section v-else class="p2-panel"><h3>{{ tabs.find(t=>t.id===activeTab)?.label }}</h3><p>{{ '当前没有可回查的处置动态。检查、指派及实际处理提交后，将在这里保留相应记录。' }}</p><button class="p2-link-button" @click="activeTab='overview'">返回健康概览</button></section>
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
        </div>
      </template>
      <template v-else-if="activeTab === 'history'">
        <SituationReport v-if="historyDetail" :title="historyDetail.title" :status="historyDetail.status" :meta="historyDetail.date + ' ' + historyDetail.time + ' · ' + historyDetail.source" tone="ai" :conclusion="historyDetail.conclusion" :recommendation="historyDetail.recommendation" :sections="historyDetail.sections" back-label="返回动态记录" @back="historyDetailId = null">
          <template #actions><template v-if="historyDetail.type === 'maintenance' && historyDetail.target"><button type="button" class="p2-link-button" @click="openTodo(historyDetail.target)">回看来源待办 →</button><button v-if="store.isTaskHandled(historyDetail.target)" type="button" class="p2-link-button" @click="openObservation(historyDetail.target)">查看效果观察 →</button></template></template>
        </SituationReport>
        <template v-else>
          <section v-if="closedIssues.length" class="p2-panel"><h3>已闭环事项</h3><CaptainIssueRow v-for="item in closedIssues" :key="item.id" :item="item" :show-device="false" @open="openTodo($event.id)"/></section>
          <div class="p2-history-head"><strong>动态记录</strong><FormSelect v-model="historyCategory" :options="historyCategories.map(i=>({value:i.id,label:i.label}))" placeholder="" aria-label="动态记录类型"/></div>
          <div class="p2-history-list"><button v-for="record in shownHistory" :key="record.id" type="button" class="p2-history-record" @click="openHistoryRecord(record)"><time>{{ record.date }}<small>{{ record.time }}</small></time><div><span class="p2-history-kind">{{ historyCategories.find(category => category.id === record.type)?.label }}</span><h3>{{ record.title }}</h3><p>{{ record.summary }}</p><small>{{ record.source }}</small></div><span class="p2-history-record-end">{{ record.status }}<b>{{ historyEntryLabel(record.type) }} →</b></span></button></div>
          <div v-if="!shownHistory.length" class="p2-empty">暂无{{ historyCategories.find(category => category.id === historyCategory)?.label }}。实际维护记录在现场作业提交并确认后生成。</div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import {isTrackingDossier,trackingPath} from '@/utils/trackingNavigation'
import {issueDetailPath} from '@/utils/maintenanceNavigation'
import {computed,nextTick,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRouter,useRoute} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {workbenchIssues,issueCatalog} from '@/mock/captainWorkbench'
import profiles from '@/mock/deviceOverviewProfiles.json'
import {deviceHistory,historyCategories} from '@/mock/phase2History'
import {operationAssessment} from '@/mock/phase2SituationContent'
import BackButton from '@/components/BackButton.vue'
import CaptainIssueRow from '@/components/CaptainIssueRow.vue'
import DeviceIssueBrowser from '@/components/DeviceIssueBrowser.vue'
import FormSelect from '@/components/forms/FormSelect.vue'
import SituationReport from '@/components/SituationReport.vue'
const props=defineProps({deviceName:{type:String,default:'主机'},deviceId:{type:String,default:'main-engine-1'}})
defineEmits(['select-sensor','back'])
const route=useRoute(),router=useRouter(),store=usePhase2DemoStore()
const tabs=[{id:'overview',label:'健康概览'},{id:'data',label:'传感器数据'},{id:'history',label:'动态记录'},{id:'related',label:'相关事项'}]
const activeTab=ref('overview'),relatedType=ref(''),relatedState=ref('待决策'),deviceScroll=ref(null),historyCategory=ref('all'),historyDetailId=ref(null)
const isMainEngine=computed(()=>props.deviceId==='main-engine-1')
const closedIssues=computed(()=>workbenchIssues(store).filter(i=>i.deviceId===props.deviceId&&i.state==='已闭环'))
const activeTodoCount=computed(()=>workbenchIssues(store).filter(i=>i.deviceId===props.deviceId&&i.state==='已派发').length)
const otherHistory=computed(()=>store.visibleTodos.filter(t=>t.deviceId===props.deviceId))
const otherOverview=computed(()=>({...profiles[props.deviceId]||{conclusion:'当前已取得部分运行指标，暂无需要决策的异动。',basis:'研判仅覆盖已采集指标，缺少连续趋势与现场核验，不据此确认所有部位正常。',next:'查看传感器数据并按巡检规程核对现场。'},...(props.deviceId==='air-compressor'&&store.todoCreated['air-delivery']?{next:'查看已派发的检查任务，了解现场反馈和当前进展，沿原任务继续处理。'}:{})}))
const historyRecords=computed(()=>deviceHistory(store))
const shownHistory=computed(()=>historyRecords.value.filter(item=>(item.deviceId||store.cases[item.target]?.deviceId||'main-engine-1')===props.deviceId&&(historyCategory.value==='all'||item.type===historyCategory.value)))
const historyDetail=computed(()=>historyRecords.value.find(item=>item.id===historyDetailId.value))
const runningAssessment=computed(()=>operationAssessment(store)),overviewAnalysis=computed(()=>runningAssessment.value.summary)
watch(()=>props.deviceId,()=>{activeTab.value='overview';historyDetailId.value=null;relatedType.value=''})
watch(activeTab,()=>{store.attentionInFocus=false;store.regularMaintenanceInFocus=false;store.clearObservationFocus();historyDetailId.value=null})
onUnmounted(()=>{store.clearObservationFocus();store.regularMaintenanceInFocus=false})
let listScroll=0
async function openMaintenanceDetail(id='maintenance'){listScroll=deviceScroll.value?.scrollTop||0;router.push({path:'/situation/maintenance/'+encodeURIComponent(id),query:{from:activeTab.value==='history'?'history':'device',device:props.deviceId,category:historyCategory.value,type:relatedType.value,state:relatedState.value,scroll:String(listScroll)}})}
async function showMaintenanceList(){await showRelated('维保建议')}
async function showAttentionList(){await showRelated('异动跟踪')}
async function showRelated(type='',state='待决策'){activeTab.value='related';relatedType.value=type;relatedState.value=state;store.attentionInFocus=false;await nextTick();if(deviceScroll.value)deviceScroll.value.scrollTop=listScroll}
function openObservation(id){listScroll=deviceScroll.value?.scrollTop||0;router.push('/situation/attention/'+encodeURIComponent(id))}
function openItem(id){if(isTrackingDossier(id)){router.push({path:trackingPath(id),query:{from:activeTab.value==='history'?'history':'device',device:props.deviceId,category:historyCategory.value,type:relatedType.value,state:relatedState.value,scroll:String(deviceScroll.value?.scrollTop||0)}});return}if(issueCatalog.some(i=>i.id===id)&&!store.todoCreated[id]){router.push(issueDetailPath(id));return}if(['stable','vibration-trend'].includes(id)){activeTab.value='data';store.attentionInFocus=false;store.deviceDataTopic=id;store.sendR02Message('device',id==='stable'?'泵出口压力有波动，要处理吗？':'机体振动小幅变化，是设备退化吗？',id);return}if(store.isTaskHandled(id)){openObservation(id);return}if(id==='fault'){openTodo(id);return}if(id==='maintenance'){openMaintenanceDetail(id);return}openObservation(id)}
function openTodo(id){store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
function historyEntryLabel(type){return ({event:'打开关联待办',attention:'查看异动跟踪材料',recommendation:'查看维保建议',maintenance:'查看维护记录',review:'查看回顾报告'})[type]||'查看记录'}
async function restoreMaintenanceContext(query){activeTab.value=query.restoreTab==='history'?'history':'related';historyCategory.value=query.category||'all';relatedType.value=query.type||'';relatedState.value=query.state||'待决策';await nextTick();if(deviceScroll.value)deviceScroll.value.scrollTop=Number(query.scroll)||0}
function openHistoryRecord(record){if(record.type==='event'&&record.target){openTodo(record.target);return}if(record.type==='attention'&&record.target){openItem(record.target);return}if(record.type==='recommendation'&&record.target){openMaintenanceDetail(record.target);return}historyDetailId.value=record.id}
onMounted(()=>{if(route.query.restoreDevice===props.deviceId)restoreMaintenanceContext(route.query)})
defineExpose({openItem,openObservation,showAttentionList,showMaintenanceList,showRelated,restoreMaintenanceContext})
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

<style scoped>
.p2-overview-layout{display:block}.p2-overview-layout>.p2-panel{max-width:none}.p2-device-scroll>.captain-issues{min-height:350px}
</style>

<style scoped>.device-heading{flex:1;min-width:0}.p2-device-head{justify-content:flex-start}.p2-device-head h2{margin:0}.p2-device-scroll{min-width:0}.p2-health-meta{row-gap:6px}.p2-health-scope{overflow-wrap:break-word}</style>
