<template>
 <div class="captain-workbench">
  <section class="captain-twin">
   <header><strong>长航碧玉</strong><span class="ship-scope">主机 · 辅机态势</span></header>
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
  <div class="captain-right" aria-label="24小时运行与风险处置">
   <section class="captain-analysis">
    <ModuleHeader title="工况态势"><span class="analysis-window">近24小时 · AIS 航迹回放</span></ModuleHeader>
    <div class="lc-home-chronology"><section v-for="period in chronology.periods" :key="period.start" class="lc-home-period"><time>{{period.time}}</time><strong class="lc-operation-status" :class="'operation-'+period.tone">{{period.status}}</strong><p>{{period.detail}}</p><p class="lc-ais-line">AIS · {{period.ais}}</p><small class="lc-ais-position">时段末位置 {{period.position}}</small></section></div>
   </section>
   <LifecycleWorkbench ref="workbench" compact/>
  </div>
 </div>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useElementSize} from '@vueuse/core'
import {useDeviceStore} from '@/stores/deviceStore'
import {useSensorStore} from '@/stores/sensorStore'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {captainDeviceSignal} from '@/mock/captainWorkbench'



import {situationDeviceIds,situationDeviceOptions,situationPositions as positions} from '@/mock/situationScope'
import ModuleHeader from '@/components/ModuleHeader.vue'



import LifecycleWorkbench from '@/components/LifecycleWorkbench.vue'
import {navigationChronology} from '../workflow/navigationChronology'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
const lifecycle=useEventLifecycleStore(),workbench=ref(null)
const emit=defineEmits(['selectDevice','selectItem']),store=usePhase2DemoStore(),deviceStore=useDeviceStore(),twinRef=ref(null)
const sensorStore=useSensorStore()
function formatReading(id){const point=sensorStore.allSensors.find(s=>s.id===id);return point?Number(point.value).toFixed(1):'—'}
const auxiliaryRpmPoints=computed(()=>sensorStore.allSensors.filter(s=>s.deviceId.startsWith('aux-engine-')&&s.unit==='rpm'))
const runningAuxiliaries=computed(()=>auxiliaryRpmPoints.value.filter(s=>s.value>0).length)
const sampleTimeIso=computed(()=>new Date(sensorStore.sampledAt).toISOString())
const sampleTimeLabel=computed(()=>new Date(sensorStore.sampledAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}))
const chronology=computed(()=>navigationChronology(sensorStore,Math.floor(sensorStore.sampledAt/3600000)*3600000))
const {width,height}=useElementSize(twinRef)
const sceneStyle=computed(()=>{const scale=Math.max(width.value/941,height.value/1672);return {height:1672*scale+'px',width:941*scale+'px'}})
const devices=computed(()=>{
 const main=deviceStore.devices.find(d=>d.id==='main-engine-1')
 const auxiliary=deviceStore.devices.filter(d=>d.id.startsWith('aux-engine-'))
 const signals=auxiliary.map(d=>captainDeviceSignal(store,d.id))
 const signal=signals.includes('danger')?'danger':signals.includes('warning')?'warning':'normal'
 return [...(main?[{...main,signal:captainDeviceSignal(store,main.id)}]:[]),{id:'aux-system',name:'辅机',system:'辅机系统',signal}]
})
</script>
<style scoped>
.captain-workbench{display:grid;grid-template-columns:clamp(280px,28vw,480px) minmax(0,1fr);gap:16px;height:100%;min-height:0;background:#f3f5f8}.captain-twin{display:flex;flex-direction:column;min-height:0;background:#001b30;border-radius:8px;overflow:hidden}.captain-twin header{display:flex;align-items:center;gap:12px;color:#e0eef7;padding:18px 20px;border-bottom:1px solid #16364a;font-size:var(--wb-body)}.captain-twin header span{font-size:var(--wb-label);color:#91b1c5}.twin-viewport{flex:1;min-height:0;position:relative;display:flex;justify-content:center;align-items:center;overflow:hidden}.twin-scene{position:relative;flex:none}.twin-scene img{width:100%;height:100%;object-fit:contain}.twin-device{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:9px;padding:10px 16px;border:1px solid #38627b;border-radius:6px;background:#092639eF;color:#e9f4fb;font:inherit;font-size:var(--wb-body);cursor:pointer;white-space:nowrap}.twin-device:hover,.twin-device:focus-visible{border-color:#89d7f2;outline:2px solid #89d7f255;outline-offset:2px}.twin-device i{width:8px;height:8px;border-radius:50%;background:#47ad72}.twin-device i.danger{background:#e15c55}.twin-device i.warning{background:#e6a444}.captain-right{display:grid;grid-template-rows:auto minmax(0,1fr);gap:16px;min-width:0;min-height:0}.captain-analysis{background:white;border-radius:8px;padding:18px 22px;max-height:44vh;overflow:auto}.captain-analysis header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.captain-analysis header strong{font-size:calc(var(--wb-body) + 2px);font-weight:600;color:#202020}.captain-analysis time{font-size:var(--wb-label);color:#7c8797;white-space:nowrap}.captain-analysis :deep(.markdown-content){font-size:var(--wb-body);line-height:1.75}.captain-analysis :deep(h4:first-child){margin-top:0}.captain-analysis :deep(h4){font-size:calc(var(--wb-body) + 2px);line-height:1.5;margin:12px 0 4px}.captain-analysis :deep(p){margin:4px 0 9px}@media(max-width:1100px){.captain-workbench{grid-template-columns:minmax(250px,29%) minmax(0,1fr);gap:12px}.captain-analysis{padding:16px;max-height:46vh}.captain-right{gap:12px}}@media(max-width:760px){.captain-workbench{display:flex;flex-direction:column;height:auto;overflow:auto}.captain-twin{height:500px;flex:none}.captain-right{display:flex;flex-direction:column}.captain-analysis{max-height:none}.captain-right :deep(.captain-issues){min-height:400px}}
</style>

<style scoped>
.captain-workbench{width:100%;min-width:0}.captain-twin{min-width:0}.captain-analysis-body{max-width:76em}.captain-analysis header{flex-wrap:wrap;row-gap:4px}.captain-analysis header strong{line-height:1.5}.captain-analysis time{margin-left:auto}.captain-right :deep(.issue-row){overflow-wrap:break-word}.captain-right :deep(.issue-meta){flex-wrap:wrap;row-gap:4px}
</style>

<style scoped>.captain-analysis{padding:0}.captain-analysis-body{padding:0 22px 14px}@media(max-width:1100px){.captain-analysis-body{padding:0 16px 12px}}</style>

<style scoped>.captain-analysis :deep(.module-header){margin-bottom:0}</style>
<style scoped>
.captain-right{display:flex;flex-direction:column;overflow:auto}
.captain-analysis{flex:none;max-height:none;overflow:visible}
.captain-analysis :deep(.markdown-content){font-size:clamp(13px,calc(var(--wb-body) - 1px),16px);line-height:1.7}
.captain-analysis :deep(h4){font-size:clamp(14px,var(--wb-body),17px);line-height:1.5;margin:10px 0 4px}
.captain-analysis :deep(p),.captain-analysis :deep(li){margin-top:3px;margin-bottom:7px}
.captain-right :deep(.captain-issues){flex:none;max-height:none}
.captain-right :deep(.issue-list){overflow:visible}
.captain-workbench,.captain-right{scrollbar-width:none;-ms-overflow-style:none}
.captain-workbench::-webkit-scrollbar,.captain-right::-webkit-scrollbar{width:0;height:0;display:none}
</style>
<style scoped>.analysis-window{font-size:var(--wb-label);line-height:1.6;color:#7c8797;font-variant-numeric:tabular-nums}@media(max-width:760px){.analysis-window{font-size:var(--wb-label)}}</style>
<style scoped>.twin-scene img{display:block}</style>
<style scoped>
.twin-device{width:164px;min-height:66px;padding:11px 14px;box-sizing:border-box;justify-content:space-between;gap:12px;text-align:left;background:rgba(19,57,78,.68);color:#f1f8fc;border:1px solid rgba(177,222,242,.5);border-radius:8px;backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);box-shadow:inset 0 1px 0 #d6f1ff1f,0 4px 16px #00132340;transition:background-color .15s,border-color .15s,box-shadow .15s}
.twin-device-copy{display:flex;flex-direction:column;gap:5px}
.twin-device-name{display:flex;align-items:center;gap:8px;font-size:calc(var(--wb-body) + 2px);font-weight:600;line-height:1.4}
.twin-device-hint{padding-left:16px;font-size:var(--wb-label);line-height:1.5;color:#c3dae7}
.twin-device i{flex:none;box-shadow:0 0 0 3px #47ad7215}
.twin-device i.danger{box-shadow:0 0 0 3px #e15c5515}
.twin-device i.warning{box-shadow:0 0 0 3px #e6a44415}
.twin-device-arrow{width:18px;height:18px;flex:none;stroke:#d0eafa;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.twin-device:hover{background:rgba(32,80,105,.82);border-color:#a1d8ee;box-shadow:inset 0 1px 0 #d6f1ff2b,0 5px 20px #00132355}
.twin-device:focus-visible{outline:3px solid #80d7f5;outline-offset:3px;border-color:#bde8fa}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.twin-device{background:#15394f}.twin-device:hover{background:#205069}}
@media(max-width:760px),(max-height:650px){.twin-device{width:150px;min-height:50px;padding:7px 12px}.twin-device-copy{gap:3px}.twin-device-name{font-size:var(--wb-body);line-height:1.4}.twin-device-hint{font-size:var(--wb-label);line-height:1.5}}
@media(prefers-reduced-motion:reduce){.twin-device{transition:none}}
</style>
<style scoped>
.twin-running{position:absolute;top:12px;left:12px;right:12px;z-index:2;padding:12px 10px 9px;border:1px solid #b1def23b;border-radius:8px;background:rgba(12,42,62,.68);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#f1f8fc;box-shadow:inset 0 1px 0 #d6f1ff12;pointer-events:none}
.twin-running dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}
.twin-running dl>div{min-width:0}.twin-running dt{font-size:var(--wb-label);line-height:1.5;color:#b8d1e1;white-space:nowrap}
.twin-running dd{margin:4px 0 0;font-size:calc(var(--wb-body) + 4px);line-height:1.5;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.twin-running small{font-size:var(--wb-label);font-weight:400;color:#c5dbe8}
.twin-running-meta{margin-top:10px;padding-top:8px;border-top:1px solid #b1def21f;font-size:var(--wb-label);line-height:1.5;color:#b8d1e1}
@media(min-width:761px) and (max-width:1100px){.twin-running{left:8px;right:8px;padding:12px}.twin-running dl{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}}
@media(max-width:400px){.twin-running dl{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.twin-running{background:#123348}}
</style>
<style scoped>
.captain-twin header{gap:10px;flex-wrap:wrap}.captain-twin header strong{white-space:nowrap}.captain-twin .ship-scope{font-size:var(--wb-label)}@media(max-width:1600px) and (min-width:761px){.captain-twin .ship-scope{display:none}}@media(max-width:760px){.captain-twin header{padding:16px}}
</style>

<style scoped>
@media(min-width:761px){
.captain-workbench{height:100%;overflow:hidden;grid-template-columns:clamp(250px,25vw,420px) minmax(0,1fr);gap:12px}
.captain-right{display:grid;grid-template-rows:max-content minmax(0,1fr);align-content:start;overflow:hidden;gap:12px}
.captain-analysis{min-height:0;max-height:none;overflow:visible}
.captain-analysis-body{padding:0 18px 14px;max-width:none;font-size:clamp(14px,.65vw,16px);line-height:1.65}
.captain-analysis :deep(.module-header){padding:12px 18px;min-height:40px}
.analysis-overview{margin:0 0 10px!important}
.analysis-columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.analysis-columns h4{font-size:16px;margin:2px 0 8px}
.analysis-columns p{margin:0 0 10px}
.analysis-columns b{display:block;font-size:15px;font-weight:600}
.analysis-columns span{display:block;color:#627188}
.analysis-decision{border-top:1px solid #edf0f5;padding-top:9px;margin:0!important;font-size:14px}
.analysis-decision>b{color:#8b682d}
.captain-right :deep(.captain-issues){height:auto;min-height:0;align-self:start}
.captain-right :deep(.issue-list){overflow:visible;display:block;flex:0 0 auto}
.captain-right :deep(.issue-row){padding:14px 0;min-height:0}
.captain-right :deep(.issue-row strong){font-size:16px;line-height:1.45}
.captain-right :deep(.issue-row p){font-size:14px;line-height:1.5;margin-top:5px}
.captain-right :deep(.issue-meta){font-size:12px;margin-bottom:5px}
.captain-right :deep(.issue-type){padding:2px 6px}
.captain-right :deep(.issue-states button){font-size:13px;padding:8px 0}
.captain-right :deep(.captain-issues .module-header){padding:10px 18px;min-height:38px}
.captain-right :deep(.issue-more){min-height:32px;padding:6px;font-size:12px}
}
@media(min-width:761px) and (max-height:820px){
.captain-analysis-body{font-size:14px;line-height:1.5;padding-bottom:10px}
.analysis-columns b,.analysis-columns h4{font-size:14px}
.analysis-columns p{margin-bottom:6px}.analysis-columns{gap:16px}.analysis-decision{font-size:13px}
.captain-analysis :deep(.module-header){padding-top:8px;padding-bottom:8px}
.captain-right{gap:8px}
.captain-right :deep(.issue-row){padding:11px 0}
.captain-right :deep(.issue-row strong){font-size:15px}
.captain-right :deep(.issue-row p){font-size:13px}
}
@media(min-width:761px) and (max-width:1100px) and (max-height:820px){
.captain-right :deep(.issue-row){padding:7px 0}
.captain-right :deep(.issue-meta){font-size:11px;margin-bottom:3px}
.captain-right :deep(.issue-type){padding:1px 5px}
.captain-right :deep(.issue-row p){font-size:12px;margin-top:4px}
.captain-right :deep(.captain-issues .module-header){padding-top:8px;padding-bottom:8px}
}
</style>
