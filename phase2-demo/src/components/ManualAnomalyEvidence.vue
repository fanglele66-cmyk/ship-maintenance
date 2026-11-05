<template>
 <section class="manual-evidence" aria-label="上报测点资料">
  <h3>上报测点</h3><p>{{report.systems.join('、')}} · {{timeText(report.start)}} — {{timeText(report.end)}}</p>
  <div class="evidence-scroll"><table><thead><tr><th>传感器</th><th>样本数</th><th>窗口内记录范围</th></tr></thead><tbody><tr v-for="sensor in report.sensors" :key="sensor.id"><td>{{sensor.name}}</td><td>{{values(sensor.id).length}}</td><td>{{range(sensor)}}</td></tr></tbody></table></div>
  <small>采样来源：原型采样记录；未覆盖的时间段需补充原始趋势或现场读数。</small>
 </section>
</template>
<script setup>
import {timeText} from '../workflow/eventLifecycle.js'
const props=defineProps({report:{type:Object,required:true}})
const values=id=>(props.report.evidence?.find(c=>c.channelId===id)?.trendData||[]).map(p=>p.value).filter(Number.isFinite)
function range(sensor){const data=values(sensor.id);return data.length?`${Math.min(...data).toFixed(2)} — ${Math.max(...data).toFixed(2)} ${sensor.unit}`:'该时间段暂无采样'}
</script>
<style scoped>
.manual-evidence{margin:20px 0;font-size:14px}.manual-evidence h3{margin:0 0 8px}.manual-evidence p,.manual-evidence small{color:#758397;line-height:1.7}.evidence-scroll{overflow:auto}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #e6ebf1}th{background:#f6f8fa;font-weight:500}
</style>
