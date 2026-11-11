<template>
 <section class="manual-evidence" aria-label="上报测点资料">
  <h3>{{report.kind==='health-tracking'?'跟踪关联测点':report.kind==='periodic'?'检测关联测点':'上报测点'}}</h3><p>{{report.systems.join('、')}} · {{timeText(report.start)}} — {{timeText(report.end)}}</p>
  <div class="evidence-scroll"><table><thead><tr><th>传感器</th><th>样本数</th><th>窗口内记录范围</th></tr></thead><tbody><tr v-for="sensor in report.sensors" :key="sensor.id"><td>{{sensor.name}}</td><td>{{evidence(sensor.id)?.sampleCount??values(sensor.id).length}}</td><td>{{range(sensor)}}</td></tr></tbody></table></div>
  <div v-if="detailed" class="evidence-trends">
   <h3>测点趋势</h3>
   <section v-for="sensor in report.sensors" :key="sensor.id" class="evidence-trend" :aria-label="sensor.name+'趋势图'">
    <header><strong>{{sensor.name}}</strong><span>{{sensor.unit}}</span></header>
    <ObservationTrend :series="trendSeries(sensor)" />
   </section>
  </div>
  <small>数据来源：设备时序记录。统计覆盖所选窗口；趋势显示该窗口内保存的测点数据。</small>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import {timeText} from '../workflow/eventLifecycle.js'
import {timelineText} from '../workflow/demoTimeline.js'
import ObservationTrend from './ObservationTrend.vue'
const props=defineProps({report:{type:Object,required:true},detailed:Boolean})
const samples=computed(()=>Object.fromEntries(props.report.sensors.map(sensor=>[sensor.id,(props.report.evidence?.find(c=>c.channelId===sensor.id)?.trendData||[]).filter(p=>Number.isFinite(p.timestamp)&&p.timestamp>=Date.parse(props.report.start)&&p.timestamp<=Date.parse(props.report.end)).sort((a,b)=>a.timestamp-b.timestamp)])))
const evidence=id=>props.report.evidence?.find(c=>c.channelId===id)
const values=id=>samples.value[id].map(p=>p.value).filter(Number.isFinite)
const trendSeries=sensor=>({name:sensor.name,unit:sensor.unit,labels:samples.value[sensor.id].map(p=>timelineText(p.timestamp)),values:samples.value[sensor.id].map(p=>Number.isFinite(p.value)?p.value:null)})
function range(sensor){const data=values(sensor.id),saved=evidence(sensor.id);if(saved?.sampleCount&&Number.isFinite(saved.min)&&Number.isFinite(saved.max))return `${saved.min.toFixed(2)} — ${saved.max.toFixed(2)} ${sensor.unit}`;return data.length?`${Math.min(...data).toFixed(2)} — ${Math.max(...data).toFixed(2)} ${sensor.unit}`:'该时间段暂无采样'}
</script>
<style scoped>
.manual-evidence{margin:20px 0;font-size:14px}.manual-evidence h3{margin:0 0 8px}.manual-evidence p,.manual-evidence small{color:#758397;line-height:1.7}.evidence-scroll{overflow:auto}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #e6ebf1}th{background:#f6f8fa;font-weight:500}
.evidence-trends{margin:20px 0}.evidence-trend{border:1px solid #e6ebf1;border-radius:8px;padding:16px 20px 10px;margin:12px 0;min-width:0}.evidence-trend header{display:flex;gap:12px;align-items:baseline;margin-bottom:8px;color:#3f5065}.evidence-trend header span{font-size:12px;color:#758397}
</style>
