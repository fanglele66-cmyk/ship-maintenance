<template><div class="captain-workbench"><section class="captain-twin"><header><strong>远洋6号</strong><span>设备态势</span></header><div ref="twinRef" class="twin-viewport"><div class="twin-scene" :style="sceneStyle"><img src="/ship-twin-vertical.png" alt="船舶数字孪生俯视图" decoding="async" fetchpriority="high" width="941" height="1672"/><button v-for="device in devices" :key="device.id" class="twin-device" :style="{left:positions[device.id].x,top:positions[device.id].y}" :aria-label="'查看'+device.name+'设备概览'" @click="emit('selectDevice',device)"><i :class="device.signal"/><span>{{device.name}}</span></button></div></div></section><div class="captain-right"><section class="captain-analysis"><ModuleHeader title="AI船舶态势分析"><time :datetime="updatedAt.toISOString()">更新于 {{updateLabel}}</time></ModuleHeader><div class="captain-analysis-body"><StreamingMarkdown :content="markdown" :highlights="['证据未齐','冷却系统','主机'].map(text=>({text,tone:'warning'}))"/></div></section><CaptainIssueList/></div></div></template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useElementSize} from '@vueuse/core'
import {useDeviceStore} from '@/stores/deviceStore'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {captainAnalysis,captainDeviceSignal} from '@/mock/captainWorkbench'
import ModuleHeader from '@/components/ModuleHeader.vue'
import StreamingMarkdown from '@/components/StreamingMarkdown.vue'
import CaptainIssueList from '@/components/CaptainIssueList.vue'
const emit=defineEmits(['selectDevice','selectItem']),store=usePhase2DemoStore(),deviceStore=useDeviceStore(),twinRef=ref(null)
const {width,height}=useElementSize(twinRef)
const sceneStyle=computed(()=>{const h=height.value;return {height:h+'px',width:h*941/1672+'px'}})
const positions={'main-engine-1':{x:'50%',y:'66%'},'steering-gear':{x:'58%',y:'84%'},'air-compressor':{x:'40%',y:'49%'},boiler:{x:'59%',y:'39%'}}
const devices=computed(()=>deviceStore.devices.filter(d=>positions[d.id]).map(d=>({...d,signal:captainDeviceSignal(store,d.id)})))
const markdown=computed(()=>captainAnalysis(store)),updatedAt=ref(new Date())
watch(markdown,()=>{updatedAt.value=new Date()})
const updateLabel=computed(()=>updatedAt.value.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}))
</script>
<style scoped>
.captain-workbench{display:grid;grid-template-columns:clamp(280px,28vw,480px) minmax(0,1fr);gap:16px;height:100%;min-height:0;background:#f3f5f8}.captain-twin{display:flex;flex-direction:column;min-height:0;background:#001b30;border-radius:8px;overflow:hidden}.captain-twin header{display:flex;align-items:center;gap:12px;color:#e0eef7;padding:18px 20px;border-bottom:1px solid #16364a;font-size:15px}.captain-twin header span{font-size:12px;color:#91b1c5}.twin-viewport{flex:1;min-height:0;position:relative;display:flex;justify-content:center;align-items:center;overflow:hidden}.twin-scene{position:relative;flex:none}.twin-scene img{width:100%;height:100%;object-fit:contain}.twin-device{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:9px;padding:10px 16px;border:1px solid #38627b;border-radius:6px;background:#092639eF;color:#e9f4fb;font:inherit;font-size:15px;cursor:pointer;white-space:nowrap}.twin-device:hover,.twin-device:focus-visible{border-color:#89d7f2;outline:2px solid #89d7f255;outline-offset:2px}.twin-device i{width:8px;height:8px;border-radius:50%;background:#47ad72}.twin-device i.danger{background:#e15c55}.twin-device i.warning{background:#e6a444}.captain-right{display:grid;grid-template-rows:auto minmax(0,1fr);gap:16px;min-width:0;min-height:0}.captain-analysis{background:white;border-radius:8px;padding:18px 22px;max-height:44vh;overflow:auto}.captain-analysis header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.captain-analysis header strong{font-size:17px;font-weight:600;color:#202020}.captain-analysis time{font-size:12px;color:#7c8797;white-space:nowrap}.captain-analysis :deep(.markdown-content){font-size:14px;line-height:1.75}.captain-analysis :deep(h4:first-child){margin-top:0}.captain-analysis :deep(h4){margin:12px 0 4px}.captain-analysis :deep(p){margin:4px 0 9px}@media(max-width:1100px){.captain-workbench{grid-template-columns:minmax(250px,29%) minmax(0,1fr);gap:12px}.captain-analysis{padding:16px;max-height:46vh}.captain-right{gap:12px}}@media(max-width:760px){.captain-workbench{display:flex;flex-direction:column;height:auto;overflow:auto}.captain-twin{height:500px;flex:none}.captain-right{display:flex;flex-direction:column}.captain-analysis{max-height:none}.captain-right :deep(.captain-issues){min-height:400px}}
</style>

<style scoped>
.captain-workbench{width:100%;min-width:0}.captain-twin{min-width:0}.captain-analysis-body{max-width:76em}.captain-analysis header{flex-wrap:wrap;row-gap:4px}.captain-analysis header strong{line-height:1.5}.captain-analysis time{margin-left:auto}.captain-right :deep(.issue-row){overflow-wrap:break-word}.captain-right :deep(.issue-meta){flex-wrap:wrap;row-gap:4px}
</style>

<style scoped>.captain-analysis{padding:0}.captain-analysis-body{padding:0 22px 14px}@media(max-width:1100px){.captain-analysis-body{padding:0 16px 12px}}</style>

<style scoped>.captain-analysis :deep(.module-header){margin-bottom:0}</style>
