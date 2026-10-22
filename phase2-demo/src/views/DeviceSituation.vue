<template>
  <div class="p2-device-page device-situation">
    <div class="p2-device-head"><BackButton label="返回船舶态势" @click="$emit('back')"/><div class="device-heading"><span class="p2-eyebrow">设备态势</span><h2>{{ deviceName }}</h2></div><FormSelect v-if="deviceId==='aux-system'||deviceId.startsWith('aux-engine-')" :model-value="deviceId" :options="auxiliaryOptions" placeholder="" aria-label="选择辅机" @update:model-value="$emit('select-device',$event)"/><div v-if="isMainEngine" class="p2-device-status"><span><i></i>航行中</span></div></div>
    <div class="p2-tab-row" role="tablist" aria-label="设备层内容"><button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :aria-selected="activeTab===tab.id" :class="{active:activeTab===tab.id}" @click="activeTab=tab.id">{{ tab.label }}</button></div>
    <div ref="deviceScroll" class="p2-device-scroll" :class="{'device-data-content':activeTab==='data'}">
      <template v-if="activeTab==='data'"><slot name="data"/></template>
      <div v-else class="device-overview-content">
        <section class="device-assessment-summary" aria-label="设备健康研判"><header><h3>设备健康研判</h3><span v-if="isMainEngine">{{ runningAssessment.completedAt }} 分析</span></header><p>{{ assessmentConclusion }}</p><p class="assessment-next"><span>关注建议</span>{{ assessmentNext }}</p></section>
        <details class="p2-running-details device-assessment-detail"><summary><span>详细研判</span><small>分析依据、建议与判断边界</small></summary><div class="device-detailed-body"><div v-if="isMainEngine" class="assessment-context"><span>数据截止：{{ runningAssessment.dataCutoff }}</span><span>{{ runningAssessment.conditions }} · {{ runningAssessment.coverage }}</span></div><MarkdownContent :content="assessmentDetail"/><template v-if="isMainEngine"><section v-for="section in additionalSections" :key="section.title"><h4>{{ section.title }}</h4><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></section></template></div></details>
        <section class="overview-sensor-panel" aria-label="重点系统测点"><header class="overview-sensor-heading"><div><h3>重点系统测点</h3><span>{{ previewReadings.length }} 个测点 · 点击读数查看趋势</span></div><button type="button" class="overview-all-sensors" @click="openAllData">查看全部 {{ deviceReadings.length }} 个测点 <span aria-hidden="true">→</span></button></header><SensorBoard :readings="previewReadings" overview :show-heading="false" @select-sensor="openSensor"/></section>
      </div>
    </div>
  </div>
</template>
<script setup>
import {computed,onUnmounted,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {useSensorStore} from '@/stores/sensorStore'
import {operationAssessment} from '@/mock/phase2SituationContent'
import {deviceStoryAssessment} from '@/mock/fourStoryWorkflow'
import {overviewSensorReadings} from '@/mock/sensorLayout.js'
import {resolveIssueNavigation} from '@/mock/issueRelationships'
import BackButton from '@/components/BackButton.vue'
import FormSelect from '@/components/forms/FormSelect.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import SensorBoard from '@/components/SensorBoard.vue'
const props=defineProps({deviceName:{type:String,default:'主机'},deviceId:{type:String,default:'main-engine-1'}})
const emit=defineEmits(['select-sensor','select-device','open-data','back'])
const router=useRouter(),store=usePhase2DemoStore(),sensorStore=useSensorStore()
const tabs=[{id:'overview',label:'健康概览'},{id:'data',label:'传感器数据'}]
const activeTab=ref('overview'),deviceScroll=ref(null)
const isMainEngine=computed(()=>props.deviceId==='main-engine-1')
const auxiliaryOptions=[{value:'aux-system',label:'辅机整体'},{value:'aux-engine-1',label:'1号辅机'},{value:'aux-engine-2',label:'2号辅机'},{value:'aux-engine-3',label:'3号辅机'}]
const runningAssessment=computed(()=>operationAssessment(store))
const otherOverview=computed(()=>deviceStoryAssessment(store,props.deviceId))
const assessmentConclusion=computed(()=>overviewCopy(isMainEngine.value?runningAssessment.value.conclusion:otherOverview.value.conclusion))
const assessmentNext=computed(()=>{
  const recommendation=overviewCopy(isMainEngine.value?runningAssessment.value.recommendation:otherOverview.value.next)
  return recommendation.match(/^[^。！？]+[。！？]?/)?.[0]||recommendation
})
const assessmentDetail=computed(()=>overviewCopy(`### 分析依据\n\n${isMainEngine.value?runningAssessment.value.basis:otherOverview.value.basis}\n\n### 建议\n\n${isMainEngine.value?runningAssessment.value.recommendation:otherOverview.value.next}`))
const additionalSections=computed(()=>runningAssessment.value.sections.filter(section=>!['关联分析与判断边界','当前安排'].includes(section.title)))
const deviceReadings=computed(()=>sensorStore.allSensors.filter(sensor=>props.deviceId==='aux-system'?sensor.deviceId.startsWith('aux-engine-'):sensor.deviceId===props.deviceId))
const previewReadings=computed(()=>overviewSensorReadings(deviceReadings.value))
watch(()=>props.deviceId,()=>{activeTab.value='overview'})
watch(activeTab,()=>{store.attentionInFocus=false;store.regularMaintenanceInFocus=false;store.clearObservationFocus()})
onUnmounted(()=>{store.clearObservationFocus();store.regularMaintenanceInFocus=false})
function openAllData(){sensorStore.setSubsystem('全部');activeTab.value='data';emit('open-data')}
function openSensor(sensor){sensorStore.setSubsystem('全部');activeTab.value='data';emit('open-data');emit('select-sensor',sensor)}
function openItem(id){const target=resolveIssueNavigation(id);router.push({path:'/situation/issue/'+target.id,query:{from:'device',device:props.deviceId,...(target.tab?{tab:target.tab}:{}),...(target.recommendationId?{recommendation:target.recommendationId}:{})}})}
function openObservation(id){router.push('/situation/attention/'+encodeURIComponent(id))}
function showRelated(type='',state='待决策'){router.push({path:'/issues',query:{device:props.deviceId,...(type?{type}:{}),...(state?{state}:{})}})}
function showAttentionList(){showRelated('异动跟踪')}
function showMaintenanceList(){showRelated('异动跟踪')}
function overviewCopy(text){return String(text||'').replace(/本班/g,'当前运行片段').replace(/当班人员/g,'现场人员').replace(/当班记录/g,'运行记录').replace(/当班/g,'当前').replace(/班次/g,'运行时段').replace(/交接班|交班|交接/g,'运行记录').replace(/值班/g,'日常检查')}
defineExpose({openItem,openObservation,showAttentionList,showMaintenanceList,showRelated})
</script>
<style scoped>
.app-container.app-container .device-situation.p2-device-page{padding:12px 20px}
.device-situation .p2-device-head{min-height:40px;margin-bottom:5px;justify-content:flex-start;flex:none}.device-heading{flex:1;min-width:0}.device-heading .p2-eyebrow{font-size:10px;margin-bottom:2px}.device-heading h2{margin:0;font-size:20px}.device-situation .p2-tab-row{gap:24px}.device-situation .p2-device-scroll{min-width:0;padding:9px 0 2px;overflow:auto}
.device-overview-content{display:flex;flex-direction:column;gap:10px;min-width:0}.device-assessment-summary{padding:10px 13px;background:#faf9f6;border:1px solid #ebe6dc;border-radius:6px}.device-assessment-summary header{display:flex;align-items:center;justify-content:space-between;gap:10px}.device-assessment-summary h3{margin:0;font-size:13px;color:#354052;font-weight:600}.device-assessment-summary header>span{font-size:10px;color:#93989f}.device-assessment-summary>p{font-size:13px;line-height:1.6;color:#576477;margin:5px 0 0}
.device-assessment-summary .assessment-next{font-size:12px;color:#758091;margin-top:6px}.assessment-next>span{color:#8b7959;margin-right:8px;font-weight:500}.overview-sensor-panel{min-width:0;margin-top:2px}.overview-sensor-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px}.overview-sensor-heading>div{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.overview-sensor-heading h3{font-size:13px;color:#465265;margin:0;font-weight:600}.overview-sensor-heading span{font-size:11px;color:#8993a1}.overview-all-sensors{border:0;background:none;padding:3px 0;color:#8b7959;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}.overview-all-sensors span{margin-left:3px;color:inherit}.overview-all-sensors:hover{text-decoration:underline}.overview-all-sensors:focus-visible{outline:2px solid #a78a59;outline-offset:2px}
.device-situation .device-assessment-detail{margin:0;border:1px solid #e5e9ef;border-radius:6px;padding:0;background:#fff}.device-assessment-detail>summary{padding:8px 12px;font-size:12px;line-height:20px;cursor:pointer}.device-assessment-detail>summary small{font-size:10px;color:#8993a1;margin-left:14px}.device-detailed-body{padding:0 15px 16px;border-top:1px solid #eef1f5}.assessment-context{display:flex;flex-direction:column;gap:5px;padding-top:10px;font-size:11px;color:#8993a1}.device-detailed-body :deep(.markdown-content){font-size:13px;line-height:1.8}.device-detailed-body h4{font-size:13px}.device-detailed-body p{font-size:12px;line-height:1.8;color:#637085}
@media(min-width:1800px){.app-container.app-container .device-situation.p2-device-page{padding:16px 24px}.device-overview-content{gap:14px}.device-assessment-summary{padding:12px 15px}.device-assessment-summary>p{font-size:13px}.device-assessment-summary h3{font-size:14px}.overview-sensor-heading h3{font-size:13px}}
@media(max-width:760px){.app-container.app-container .device-situation.p2-device-page{padding:12px}.device-assessment-summary header{align-items:flex-start;flex-wrap:wrap;gap:3px}.device-assessment-summary>p{font-size:12px}.overview-sensor-heading{align-items:flex-start}.overview-sensor-heading>div{gap:3px}.overview-all-sensors{font-size:10px}.device-assessment-detail>summary small{display:block;margin-left:14px}.device-situation .p2-device-scroll{padding-bottom:12px}}
</style>
