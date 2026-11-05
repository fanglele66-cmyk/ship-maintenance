<template>
 <section class="manual-evidence" aria-label="上报测点资料">
  <h3>上报测点</h3><p>{{report.systems.join('、')}} · {{timeText(report.start)}} — {{timeText(report.end)}}</p>
  <div class="evidence-scroll"><table><thead><tr><th>传感器</th><th>样本数</th><th>窗口内记录范围</th></tr></thead><tbody><tr v-for="sensor in report.sensors" :key="sensor.id"><td>{{sensor.name}}</td><td>{{values(sensor.id).length}}</td><td>{{range(sensor)}}</td></tr></tbody></table></div>
  <template v-if="detailed&&rows.length">
   <h3>采样明细</h3>
   <div class="evidence-scroll sample-scroll" tabindex="0" role="region" aria-label="采样明细"><table class="sample-table"><thead><tr><th scope="col">采样时间</th><th v-for="sensor in report.sensors" :key="sensor.id" scope="col">{{sensor.name}}<small>{{sensor.unit}}</small></th></tr></thead><tbody><tr v-for="row in visibleRows" :key="row.timestamp"><th scope="row">{{sampleTime(row.timestamp)}}</th><td v-for="sensor in report.sensors" :key="sensor.id">{{row.values[sensor.id]??'—'}}</td></tr></tbody></table></div>
   <nav class="sample-pagination" aria-label="采样明细分页"><span>共 {{rows.length}} 个采样时刻 · 缺测以 — 表示</span><div><button type="button" :disabled="page===0" aria-label="上一页采样" @click="page--">上一页</button><span>{{page+1}} / {{pageCount}}</span><button type="button" :disabled="page>=pageCount-1" aria-label="下一页采样" @click="page++">下一页</button></div></nav>
  </template>
  <small>采样来源：原型采样记录；未覆盖的时间段需补充原始趋势或现场读数。</small>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {timeText} from '../workflow/eventLifecycle.js'
const props=defineProps({report:{type:Object,required:true},detailed:Boolean})
const samples=computed(()=>Object.fromEntries(props.report.sensors.map(sensor=>[sensor.id,(props.report.evidence?.find(c=>c.channelId===sensor.id)?.trendData||[]).filter(p=>Number.isFinite(p.timestamp)&&Number.isFinite(p.value)&&p.timestamp>=Date.parse(props.report.start)&&p.timestamp<=Date.parse(props.report.end))])))
const values=id=>samples.value[id].map(p=>p.value)
const rows=computed(()=>{const indexed=new Map();for(const sensor of props.report.sensors)for(const point of samples.value[sensor.id]){if(!indexed.has(point.timestamp))indexed.set(point.timestamp,{timestamp:point.timestamp,values:{}});indexed.get(point.timestamp).values[sensor.id]=point.value}return [...indexed.values()].sort((a,b)=>a.timestamp-b.timestamp)})
const page=ref(0),pageSize=20,pageCount=computed(()=>Math.max(1,Math.ceil(rows.value.length/pageSize))),visibleRows=computed(()=>rows.value.slice(page.value*pageSize,(page.value+1)*pageSize))
watch(()=>props.report,()=>{page.value=0},{deep:true})
function sampleTime(timestamp){const date=new Date(timestamp);return date.toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})+(date.getMilliseconds()?'.'+String(date.getMilliseconds()).padStart(3,'0'):'')}
function range(sensor){const data=values(sensor.id);return data.length?`${Math.min(...data).toFixed(2)} — ${Math.max(...data).toFixed(2)} ${sensor.unit}`:'该时间段暂无采样'}
</script>
<style scoped>
.manual-evidence{margin:20px 0;font-size:14px}.manual-evidence h3{margin:0 0 8px}.manual-evidence p,.manual-evidence small{color:#758397;line-height:1.7}.evidence-scroll{overflow:auto}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #e6ebf1}th{background:#f6f8fa;font-weight:500}
.sample-scroll{max-height:520px;border:1px solid #e6ebf1;border-radius:6px;margin:12px 0}.sample-scroll:focus-visible{outline:2px solid #b3945a;outline-offset:2px}.sample-table{margin:0;font-variant-numeric:tabular-nums}.sample-table th,.sample-table td{white-space:nowrap;min-width:130px}.sample-table thead th{position:sticky;top:0;z-index:1}.sample-table th small{display:block;font-size:12px;font-weight:400}.sample-table tbody th{background:white;font-weight:400;min-width:190px}.sample-table tbody tr:nth-child(even)>*{background:#fafbfd}.sample-pagination,.sample-pagination>div{display:flex;align-items:center;gap:12px}.sample-pagination{justify-content:space-between;flex-wrap:wrap;margin:12px 0 18px;font-size:12px;color:#758397}.sample-pagination button{font-size:12px}.sample-pagination button:disabled{opacity:.4;cursor:default}
</style>
