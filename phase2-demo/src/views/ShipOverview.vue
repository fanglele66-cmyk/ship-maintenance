<template>
 <div class="captain-workbench">
  <section class="captain-twin">
   <header><strong>长航碧玉</strong><span class="ship-scope">主机 · 辅机态势</span><button type="button" class="daily-report-entry" @click="openReports"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 2.5h7l3 3v12H5zM12 2.5V6h3M8 9h4M8 12h4M8 15h3"/></svg>日检报告</button></header>
   <div ref="twinRef" class="twin-viewport">
    <div class="twin-scene" :style="sceneStyle">
     <img src="/ship-situation-engines.png" alt="船舶俯视态势图，设备入口位置为示意" decoding="async" fetchpriority="high" width="941" height="1672"/>
     <button v-for="device in devices" :key="device.id" class="twin-device" :style="{left:positions[device.id].x,top:positions[device.id].y}" :aria-label="'查看'+device.name+'设备详情'" @click="emit('selectDevice',device)">
      <span class="twin-device-copy"><span class="twin-device-name"><i :class="device.signal" aria-hidden="true"/>{{device.name}}</span><span class="twin-device-hint">查看设备详情</span></span>
      <svg class="twin-device-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
     </button>
    </div>
    <section class="twin-running" aria-label="船舶运行动态">
     <dl>
      <div><dt>航速</dt><dd>{{formatReading('ship-speed')}} <small>kn</small></dd></div>
      <div><dt>主机转速</dt><dd>{{formatReading('s-012')}} <small>rpm</small></dd></div>
      <div><dt>主机负荷</dt><dd>{{formatReading('main-load')}} <small>%</small></dd></div>
      <div><dt>辅机运行</dt><dd>{{runningAuxiliaries}} <small>/ {{auxiliaryRpmPoints.length}} 台</small></dd></div>
     </dl>
     <div class="twin-running-meta"><time :datetime="sampleTimeIso">数据更新于 {{sampleTimeLabel}}</time></div>
    </section>
   </div>
  </section>
  <div class="captain-right">
   <section class="captain-analysis">
    <ModuleHeader title="健康态势分析"><div class="analysis-period"><span class="analysis-window">分析时间窗 {{analysisWindow.label}}</span><div class="analysis-hours" aria-label="分析时长"><button v-for="hours in [12,24]" :key="hours" type="button" :aria-pressed="analysisHours===hours" :class="{active:analysisHours===hours}" @click="analysisHours=hours">{{hours}}小时</button></div></div></ModuleHeader>
    <div class="captain-analysis-body"><StreamingMarkdown :content="markdown" :highlights="['证据未齐','冷却系统','主机'].map(text=>({text,tone:'warning'}))"/></div>
   </section>
   <CaptainIssueList :device-ids="situationDeviceIds" :device-options="situationDeviceOptions"/>
  </div>
  <ShipDailyReportDrawer v-if="reportsOpen" :reports="dailyReports" @close="reportsOpen=false" @open-events="reportsOpen=false;router.push('/issues')"/>
 </div>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRouter} from 'vue-router'
import {useElementSize} from '@vueuse/core'
import {useDeviceStore} from '@/stores/deviceStore'
import {useSensorStore} from '@/stores/sensorStore'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {captainDeviceSignal} from '@/mock/captainWorkbench'
import {eventDirectoryRows} from '@/mock/eventDirectory'
import {overviewAnalysisWindow} from '@/mock/overviewAnalysisWindow'
import {periodReadings,shipDailyReports} from '@/mock/shipDailyReports'
import {situationDeviceIds,situationDeviceOptions,situationPositions as positions} from '@/mock/situationScope'
import ModuleHeader from '@/components/ModuleHeader.vue'
import StreamingMarkdown from '@/components/StreamingMarkdown.vue'
import CaptainIssueList from '@/components/CaptainIssueList.vue'
import ShipDailyReportDrawer from '@/components/ShipDailyReportDrawer.vue'
const emit=defineEmits(['selectDevice','selectItem']),store=usePhase2DemoStore(),deviceStore=useDeviceStore(),twinRef=ref(null)
const sensorStore=useSensorStore()
const router=useRouter(),analysisHours=ref(24),reportsOpen=ref(false),dailyReports=ref([])
function openReports(){dailyReports.value=shipDailyReports(sensorStore,sensorStore.sampledAt);reportsOpen.value=true}
function formatReading(id){const point=sensorStore.allSensors.find(s=>s.id===id);return point?Number(point.value).toFixed(1):'—'}
const auxiliaryRpmPoints=computed(()=>sensorStore.allSensors.filter(s=>s.deviceId.startsWith('aux-engine-')&&s.unit==='rpm'))
const runningAuxiliaries=computed(()=>auxiliaryRpmPoints.value.filter(s=>s.value>0).length)
const sampleTimeIso=computed(()=>new Date(sensorStore.sampledAt).toISOString())
const sampleTimeLabel=computed(()=>new Date(sensorStore.sampledAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}))
const {width,height}=useElementSize(twinRef)
const sceneStyle=computed(()=>{const scale=Math.max(width.value/941,height.value/1672);return {height:1672*scale+'px',width:941*scale+'px'}})
const devices=computed(()=>{
 const main=deviceStore.devices.find(d=>d.id==='main-engine-1')
 const auxiliary=deviceStore.devices.filter(d=>d.id.startsWith('aux-engine-'))
 const signals=auxiliary.map(d=>captainDeviceSignal(store,d.id))
 const signal=signals.includes('danger')?'danger':signals.includes('warning')?'warning':'normal'
 return [...(main?[{...main,signal:captainDeviceSignal(store,main.id)}]:[]),{id:'aux-system',name:'辅机',system:'辅机系统',signal}]
})
const analysisWindow=computed(()=>overviewAnalysisWindow(Math.floor(sensorStore.sampledAt/1800000)*1800000,analysisHours.value))
const markdown=computed(()=>{
 const range=analysisWindow.value,readings=periodReadings(sensorStore,range.start,range.end)
 const rpm=readings.find(item=>item.id==='s-012'),load=readings.find(item=>item.id==='main-load')
 const rows=eventDirectoryRows(store).filter(item=>situationDeviceIds.includes(item.deviceId)&&item.eventState!=='已闭环')
 const pending=rows.filter(item=>item.eventState==='待决策').length
 const brief=rows.map(item=>`- **${item.title}**：${item.eventState}`).join('\n')
 return `最近 ${range.hours} 小时，主机转速 ${rpm?.min??'—'}–${rpm?.max??'—'} rpm，负荷 ${load?.min??'—'}–${load?.max??'—'}%。运行读数按本时间窗统计，既有事件保留原发生时间与处置记录。\n\n### 未闭环事件持续跟进\n\n当前 ${pending} 项待决策、${rows.length-pending} 项处置中。跨窗口事件继续跟进，不计作本时段新发生。\n\n${brief||'当前没有未闭环事件。'}\n\n### 建议\n\n优先核对待决策事件的现场依据，处置中的事件沿已有任务推进；维保建议随异动跟踪形成，验收与闭环结果回写原事件。`
})
</script>
<style scoped>
.captain-workbench{display:grid;grid-template-columns:clamp(280px,28vw,480px) minmax(0,1fr);gap:16px;height:100%;min-height:0;background:#f3f5f8}.captain-twin{display:flex;flex-direction:column;min-height:0;background:#001b30;border-radius:8px;overflow:hidden}.captain-twin header{display:flex;align-items:center;gap:12px;color:#e0eef7;padding:18px 20px;border-bottom:1px solid #16364a;font-size:15px}.captain-twin header span{font-size:12px;color:#91b1c5}.twin-viewport{flex:1;min-height:0;position:relative;display:flex;justify-content:center;align-items:center;overflow:hidden}.twin-scene{position:relative;flex:none}.twin-scene img{width:100%;height:100%;object-fit:contain}.twin-device{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:9px;padding:10px 16px;border:1px solid #38627b;border-radius:6px;background:#092639eF;color:#e9f4fb;font:inherit;font-size:15px;cursor:pointer;white-space:nowrap}.twin-device:hover,.twin-device:focus-visible{border-color:#89d7f2;outline:2px solid #89d7f255;outline-offset:2px}.twin-device i{width:8px;height:8px;border-radius:50%;background:#47ad72}.twin-device i.danger{background:#e15c55}.twin-device i.warning{background:#e6a444}.captain-right{display:grid;grid-template-rows:auto minmax(0,1fr);gap:16px;min-width:0;min-height:0}.captain-analysis{background:white;border-radius:8px;padding:18px 22px;max-height:44vh;overflow:auto}.captain-analysis header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.captain-analysis header strong{font-size:17px;font-weight:600;color:#202020}.captain-analysis time{font-size:12px;color:#7c8797;white-space:nowrap}.captain-analysis :deep(.markdown-content){font-size:14px;line-height:1.75}.captain-analysis :deep(h4:first-child){margin-top:0}.captain-analysis :deep(h4){margin:12px 0 4px}.captain-analysis :deep(p){margin:4px 0 9px}@media(max-width:1100px){.captain-workbench{grid-template-columns:minmax(250px,29%) minmax(0,1fr);gap:12px}.captain-analysis{padding:16px;max-height:46vh}.captain-right{gap:12px}}@media(max-width:760px){.captain-workbench{display:flex;flex-direction:column;height:auto;overflow:auto}.captain-twin{height:500px;flex:none}.captain-right{display:flex;flex-direction:column}.captain-analysis{max-height:none}.captain-right :deep(.captain-issues){min-height:400px}}
</style>

<style scoped>
.captain-workbench{width:100%;min-width:0}.captain-twin{min-width:0}.captain-analysis-body{max-width:76em}.captain-analysis header{flex-wrap:wrap;row-gap:4px}.captain-analysis header strong{line-height:1.5}.captain-analysis time{margin-left:auto}.captain-right :deep(.issue-row){overflow-wrap:break-word}.captain-right :deep(.issue-meta){flex-wrap:wrap;row-gap:4px}
</style>

<style scoped>.captain-analysis{padding:0}.captain-analysis-body{padding:0 22px 14px}@media(max-width:1100px){.captain-analysis-body{padding:0 16px 12px}}</style>

<style scoped>.captain-analysis :deep(.module-header){margin-bottom:0}</style>
<style scoped>.analysis-window{font-size:12px;line-height:1.6;color:#7c8797;font-variant-numeric:tabular-nums}@media(max-width:760px){.analysis-window{font-size:11px}}</style>
<style scoped>.twin-scene img{display:block}</style>
<style scoped>
.twin-device{width:164px;min-height:66px;padding:11px 14px;box-sizing:border-box;justify-content:space-between;gap:12px;text-align:left;background:rgba(19,57,78,.68);color:#f1f8fc;border:1px solid rgba(177,222,242,.5);border-radius:8px;backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);box-shadow:inset 0 1px 0 #d6f1ff1f,0 4px 16px #00132340;transition:background-color .15s,border-color .15s,box-shadow .15s}
.twin-device-copy{display:flex;flex-direction:column;gap:5px}
.twin-device-name{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:600;line-height:20px}
.twin-device-hint{padding-left:16px;font-size:12px;line-height:16px;color:#c3dae7}
.twin-device i{flex:none;box-shadow:0 0 0 3px #47ad7215}
.twin-device i.danger{box-shadow:0 0 0 3px #e15c5515}
.twin-device i.warning{box-shadow:0 0 0 3px #e6a44415}
.twin-device-arrow{width:18px;height:18px;flex:none;stroke:#d0eafa;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.twin-device:hover{background:rgba(32,80,105,.82);border-color:#a1d8ee;box-shadow:inset 0 1px 0 #d6f1ff2b,0 5px 20px #00132355}
.twin-device:focus-visible{outline:3px solid #80d7f5;outline-offset:3px;border-color:#bde8fa}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.twin-device{background:#15394f}.twin-device:hover{background:#205069}}
@media(max-width:760px),(max-height:650px){.twin-device{width:150px;min-height:50px;padding:7px 12px}.twin-device-copy{gap:3px}.twin-device-name{font-size:15px;line-height:18px}.twin-device-hint{font-size:11px;line-height:14px}}
@media(prefers-reduced-motion:reduce){.twin-device{transition:none}}
</style>
<style scoped>
.twin-running{position:absolute;top:12px;left:12px;right:12px;z-index:2;padding:12px 10px 9px;border:1px solid #b1def23b;border-radius:8px;background:rgba(12,42,62,.68);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#f1f8fc;box-shadow:inset 0 1px 0 #d6f1ff12;pointer-events:none}
.twin-running dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}
.twin-running dl>div{min-width:0}.twin-running dt{font-size:13px;line-height:20px;color:#b8d1e1;white-space:nowrap}
.twin-running dd{margin:4px 0 0;font-size:18px;line-height:26px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.twin-running small{font-size:12px;font-weight:400;color:#c5dbe8}
.twin-running-meta{margin-top:10px;padding-top:8px;border-top:1px solid #b1def21f;font-size:12px;line-height:18px;color:#b8d1e1}
@media(min-width:761px) and (max-width:1100px){.twin-running{left:8px;right:8px;padding:12px}.twin-running dl{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}}
@media(max-width:400px){.twin-running dl{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.twin-running{background:#123348}}
</style>
<style scoped>
.captain-twin header{gap:10px;flex-wrap:wrap}.captain-twin header strong{white-space:nowrap}.captain-twin .ship-scope{font-size:11px}.daily-report-entry{margin-left:auto;display:flex;align-items:center;gap:5px;border:1px solid #5d859a70;border-radius:5px;background:#193e52a6;color:#d3e5ef;font:inherit;font-size:11px;white-space:nowrap;padding:6px 8px;cursor:pointer}.daily-report-entry svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}.daily-report-entry:hover{background:#2b5269}.daily-report-entry:focus-visible{outline:2px solid #9ad6ee;outline-offset:3px}.analysis-period{display:flex;align-items:center;justify-content:flex-end;gap:14px;flex-wrap:wrap}.analysis-hours{display:flex;border:1px solid #e3e7ed;border-radius:5px;overflow:hidden;flex:none}.analysis-hours button{padding:4px 9px;font:inherit;font-size:11px;border:0;background:#fff;color:#8591a1;cursor:pointer}.analysis-hours button.active{background:#f6f1e8;color:#92723a}.analysis-hours button:focus-visible{outline:2px solid #b29360;outline-offset:-2px}@media(max-width:1600px) and (min-width:761px){.captain-twin .ship-scope{display:none}}@media(max-width:760px){.analysis-period{justify-content:flex-start;gap:6px}.captain-twin header{padding:16px}.daily-report-entry{font-size:12px}}
</style>
