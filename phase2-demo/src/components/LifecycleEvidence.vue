<template>
 <section class="lc-evidence">
  <EventEvidenceSources :brief="event.brief"/>
  <h3>测点采样记录</h3>
  <div class="lc-evidence-table" tabindex="0" aria-label="测点采样记录">
   <table><thead><tr><th>测点</th><th>记录数值</th><th>采样时间</th></tr></thead><tbody><tr v-for="s in snapshots" :key="s.name"><th>{{s.name}}</th><td>{{s.value}} {{s.unit}}</td><td>{{s.at}}</td></tr></tbody></table>
  </div>
  <h3>原始观测趋势 <small>{{series.length}} 组测点 · 展开查看</small></h3>
  <details v-for="(s,i) in series" :key="s.name" class="lc-source-series" @toggle="toggleSeries(i,$event)">
   <summary><strong>{{s.name}} <small>{{s.unit}}</small></strong><time>{{s.labels[0]}} — {{s.labels.at(-1)}}</time></summary>
   <template v-if="opened.has(i)"><ObservationTrend :series="s"/><details class="lc-sample-records"><summary>采样明细 · {{s.labels.length}} 条</summary><div class="lc-evidence-table" tabindex="0" :aria-label="s.name+'采样明细'"><table><thead><tr><th>采样时间</th><th>数值</th><th>单位</th></tr></thead><tbody><tr v-for="(at,j) in s.labels" :key="j"><td>{{at}}</td><td>{{Number.isFinite(s.values[j])?s.values[j]:'—'}}</td><td>{{s.unit}}</td></tr></tbody></table></div></details></template>
  </details>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {workflowDossiers} from '../mock/fourStoryWorkflow'
import EventEvidenceSources from './EventEvidenceSources.vue'
import ObservationTrend from './ObservationTrend.vue'
const props=defineProps({event:{type:Object,required:true}}),opened=ref(new Set())
// Use the same original event window as the previous evidence page, not later repair data.
const series=computed(()=>workflowDossiers[props.event.id]?.series||[])
const snapshots=computed(()=>series.value.flatMap(s=>{const i=s.values.findLastIndex(Number.isFinite);return i<0?[]:[{name:s.name,value:s.values[i],unit:s.unit,at:s.labels[i]}]}))
function toggleSeries(i,event){const next=new Set(opened.value);event.target.open?next.add(i):next.delete(i);opened.value=next}
watch(()=>props.event.id,()=>opened.value=new Set())
</script>
<style scoped>
.lc-evidence h3{margin:26px 0 12px}.lc-evidence h3 small{font-size:12px;font-weight:400;color:#8493a6;margin-left:10px}.lc-evidence-table{overflow:auto;max-height:360px;border:1px solid #e4eaf1;border-radius:5px}.lc-evidence table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}.lc-evidence th,.lc-evidence td{padding:11px 14px;border-bottom:1px solid #e9edf4;white-space:nowrap;font-weight:400}.lc-evidence thead{background:#f6f8fb;color:#75869b}.lc-source-series{border-bottom:1px solid #e5eaf1}.lc-source-series>summary{display:flex;align-items:center;gap:12px;padding:15px 3px;cursor:pointer;list-style:none}.lc-source-series>summary:before{content:'›';color:#ab8b58}.lc-source-series[open]>summary:before{content:'⌄'}.lc-source-series strong{font-weight:500}.lc-source-series time{margin-left:auto;color:#8493a6;font-size:12px}.lc-sample-records{margin:8px 0 18px}.lc-sample-records>summary{cursor:pointer;padding:8px 0;color:#9b7b43;font-size:13px}@media(max-width:700px){.lc-source-series>summary{flex-wrap:wrap}.lc-source-series time{margin-left:22px;width:100%}}
</style>
