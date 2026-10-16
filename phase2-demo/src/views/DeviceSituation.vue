<template>
  <div class="p2-device-page">
    <div class="p2-device-head">
      <BackButton label="返回船舶态势" @click="$emit('back')"/><div class="device-heading"><span class="p2-eyebrow">设备态势</span><h2>{{ deviceName }}</h2></div>
      <FormSelect v-if="deviceId==='aux-system'||deviceId.startsWith('aux-engine-')" :model-value="deviceId" :options="auxiliaryOptions" placeholder="" aria-label="选择辅机" @update:model-value="$emit('select-device',$event)"/>
      <div v-if="isMainEngine" class="p2-device-status"><span><i></i>航行中</span></div>
    </div>
    <div class="p2-tab-row" role="tablist" aria-label="设备层内容">
      <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
    </div>
    <div ref="deviceScroll" class="p2-device-scroll">
      <template v-if="activeTab === 'data'"><slot name="data" /></template>
      <DeviceIssueBrowser v-else-if="activeTab==='related'" :device-id="deviceId" :initial-type="relatedType" :initial-state="relatedState" @overview="activeTab='overview'"/><template v-else-if="activeTab==='overview'&&!isMainEngine">
        <section class="p2-panel device-basic-overview"><MarkdownContent :content="otherMarkdown"/><div class="overview-links"><button class="p2-secondary" @click="activeTab='data'">查看传感器数据</button><button class="p2-secondary" @click="showHealthHistory">查看健康跟踪记录</button></div></section>
      </template>
      <template v-else-if="activeTab === 'overview'">
        <div class="p2-overview-layout">
        <div class="p2-panel">
          <div class="p2-section-title">设备健康研判</div>
          <div class="p2-health-meta"><span>分析完成 {{ runningAssessment.completedAt }}</span><span>数据截止 {{ runningAssessment.dataCutoff }}</span><span>{{ runningAssessment.analysisRange }}</span></div>
          <p class="p2-health-scope">{{ runningAssessment.conditions }} · {{ runningAssessment.coverage }}</p>
          <MarkdownContent :content="mainMarkdown"/>
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
        <SituationReport v-if="historyDetail" :title="historyDetail.title" :status="historyDetail.status" :meta="historyDetail.date + ' ' + historyDetail.time + ' · ' + historyDetail.source" tone="ai" :conclusion="historyDetail.conclusion" :recommendation="historyDetail.recommendation" :sections="historyDetail.sections" :timeline="historyDetail.timeline||[]" :tabbed="Boolean(historyDetail.timeline?.length)" timeline-expanded back-label="返回动态记录" @back="historyDetailId = null">
          <template #actions>
            <template v-if="historyDetail.type==='attention'&&historyTrack">
              <button v-if="historyTrack.requestId&&!store.todoCreated[historyTrack.requestId]" type="button" class="p2-secondary" @click="openItem(historyTrack.requestId)">查看现场核实建议</button>
              <button v-if="historyTrack.requestId&&store.todoCreated[historyTrack.requestId]&&!store.completedTasks[historyTrack.requestId]" type="button" class="p2-secondary" @click="openTodo(historyTrack.requestId)">查看本次核实任务</button>
              <button v-if="historyTrack.laterNodes&&store.healthUpdates[historyTrack.id]?.taskComplete&&(store.healthUpdates[historyTrack.id]?.laterNodes?.length||0)<historyTrack.laterNodes.length" type="button" class="p2-secondary" @click="store.advanceHealthTrack(historyTrack.id)">查看后续可比节点</button>
              <button v-if="historyTrack.recommendationId||store.healthUpdates[historyTrack.id]?.recommendationId" type="button" class="p2-secondary" @click="openMaintenanceDetail(historyTrack.recommendationId||store.healthUpdates[historyTrack.id].recommendationId)">查看关联维保建议</button>
            </template>
            <template v-if="historyDetail.type==='maintenance'&&historyDetail.target"><button type="button" class="p2-link-button" @click="openTodo(historyDetail.target)">回看来源待办</button><button v-if="store.isTaskHandled(historyDetail.target)" type="button" class="p2-link-button" @click="openObservation(historyDetail.target)">查看效果观察</button></template>
          </template>
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
import {computed,nextTick,onUnmounted,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {workbenchIssues,issueCatalog} from '@/mock/captainWorkbench'
import profiles from '@/mock/deviceOverviewProfiles.json'
import {deviceHistory,historyCategories} from '@/mock/phase2History'
import {operationAssessment} from '@/mock/phase2SituationContent'
import {healthTracks,deviceStoryAssessment} from '@/mock/fourStoryWorkflow'
import {matchesSituationDevice} from '@/mock/situationScope'
import BackButton from '@/components/BackButton.vue'
import CaptainIssueRow from '@/components/CaptainIssueRow.vue'
import DeviceIssueBrowser from '@/components/DeviceIssueBrowser.vue'
import FormSelect from '@/components/forms/FormSelect.vue'
import SituationReport from '@/components/SituationReport.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
const props=defineProps({deviceName:{type:String,default:'主机'},deviceId:{type:String,default:'main-engine-1'}})
defineEmits(['select-sensor','select-device','back'])
const router=useRouter(),store=usePhase2DemoStore()
const tabs=[{id:'overview',label:'健康概览'},{id:'data',label:'传感器数据'},{id:'history',label:'动态记录'},{id:'related',label:'相关事项'}]
const activeTab=ref('overview'),relatedType=ref(''),relatedState=ref('待决策'),deviceScroll=ref(null),historyCategory=ref('all'),historyDetailId=ref(null)
const isMainEngine=computed(()=>props.deviceId==='main-engine-1')
const auxiliaryOptions=[{value:'aux-system',label:'辅机整体'},{value:'aux-engine-1',label:'1号辅机'},{value:'aux-engine-2',label:'2号辅机'},{value:'aux-engine-3',label:'3号辅机'}]
const closedIssues=computed(()=>workbenchIssues(store).filter(i=>i.deviceId===props.deviceId&&i.state==='已闭环'))
const activeTodoCount=computed(()=>workbenchIssues(store).filter(i=>i.deviceId===props.deviceId&&i.state==='已派发').length)
const otherHistory=computed(()=>store.visibleTodos.filter(t=>matchesSituationDevice(t,props.deviceId)))
const otherOverview=computed(()=>deviceStoryAssessment(store,props.deviceId))
const historyRecords=computed(()=>deviceHistory(store))
const shownHistory=computed(()=>historyRecords.value.filter(item=>matchesSituationDevice({deviceId:item.deviceId||store.cases[item.target]?.deviceId||'main-engine-1'},props.deviceId)&&(historyCategory.value==='all'||item.type===historyCategory.value)))
const historyDetail=computed(()=>historyRecords.value.find(item=>item.id===historyDetailId.value))
const historyTrack=computed(()=>healthTracks.find(track=>track.id===historyDetail.value?.trackId))
const runningAssessment=computed(()=>operationAssessment(store)),overviewAnalysis=computed(()=>runningAssessment.value.summary)
const otherMarkdown=computed(()=>`### 当前判断\n\n${otherOverview.value.conclusion}\n\n### 分析依据\n\n${otherOverview.value.basis}\n\n### 建议\n\n${otherOverview.value.next}`)
const mainMarkdown=computed(()=>`### 当前判断\n\n${runningAssessment.value.conclusion}\n\n### 分析依据\n\n${runningAssessment.value.basis}\n\n### 建议\n\n${runningAssessment.value.recommendation}`)
watch(()=>props.deviceId,()=>{activeTab.value='overview';historyDetailId.value=null;relatedType.value=''})
watch(activeTab,()=>{store.attentionInFocus=false;store.regularMaintenanceInFocus=false;store.clearObservationFocus();historyDetailId.value=null})
onUnmounted(()=>{store.clearObservationFocus();store.regularMaintenanceInFocus=false})
let listScroll=0
async function openMaintenanceDetail(id='maintenance'){listScroll=deviceScroll.value?.scrollTop||0;router.push('/situation/issue/'+encodeURIComponent(id))}
async function showMaintenanceList(){await showRelated('维保建议')}
async function showAttentionList(){await showRelated('异动跟踪')}
async function showRelated(type='',state='待决策'){activeTab.value='related';relatedType.value=type;relatedState.value=state;store.attentionInFocus=false;await nextTick();if(deviceScroll.value)deviceScroll.value.scrollTop=listScroll}
function openObservation(id){listScroll=deviceScroll.value?.scrollTop||0;router.push('/situation/attention/'+encodeURIComponent(id))}
function openItem(id){if(issueCatalog.some(item=>item.id===id)){openTodo(id);return}activeTab.value='data'}
function openTodo(id){if(!store.todoCreated[id]){router.push({path:'/situation/issue/'+id,query:{from:'device',device:props.deviceId}});return}store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
function showHealthHistory(){activeTab.value='history';historyCategory.value='attention'}
function historyEntryLabel(type){return ({event:'打开关联待办',attention:'查看异动跟踪材料',recommendation:'查看维保建议',maintenance:'查看维护记录',review:'查看回顾报告'})[type]||'查看记录'}
function openHistoryRecord(record){if(record.type==='event'&&record.target){openTodo(record.target);return}if(record.type==='attention'&&record.target&&!record.timeline){openItem(record.target);return}if(record.type==='recommendation'&&record.target){openMaintenanceDetail(record.target);return}historyDetailId.value=record.id}
defineExpose({openItem,openObservation,showAttentionList,showMaintenanceList,showRelated})
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
