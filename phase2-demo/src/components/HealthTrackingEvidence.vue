<template>
 <section class="tracking-evidence" aria-label="长期异动跟踪依据">
  <h3>{{candidate.name}} · 健康基线跟踪</h3>
  <p>{{timeText(candidate.start)}} — {{timeText(candidate.end)}} · {{candidate.validWindows}}个可比运行窗口</p>
  <dl><div v-for="metric in metrics" :key="metric.label"><dt>{{metric.label}}</dt><dd>{{metric.value}}</dd></div></dl>
  <ObservationSensorCharts :readings="readings" :start="candidate.start" :end="candidate.end"/>
  <p>基线按转速区间固定；累计偏离显示输入历史中实际覆盖的7天/30天窗口。持续偏离需结合现场记录核实。</p>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import ObservationSensorCharts from './ObservationSensorCharts.vue'
import {timeText} from '../workflow/eventLifecycle.js'
const props=defineProps({report:{type:Object,required:true}}),candidate=computed(()=>props.report.candidate)
const format=value=>Number.isFinite(value)?Number(value.toFixed(2)):'—'
const metrics=computed(()=>[{label:'点位健康分',value:format(candidate.value.latest.health_score)},{label:'标准化残差',value:format(candidate.value.latest.z)+' σ'},{label:'EWMA |z|',value:format(candidate.value.latest.ewma)+' σ'},{label:'偏离方向',value:candidate.value.direction}])
const readings=computed(()=>[
 ['raw_value',candidate.value.name,candidate.value.unit,'原始值与健康基线'],['baseline_median','固定健康基线',candidate.value.unit,'原始值与健康基线'],
 ['z','标准化残差 z','σ','残差与EWMA'],['ewma','EWMA |z|','σ','残差与EWMA'],
 ['cusum_7d_area','7天累计偏离','σ·天','累计偏离面积'],['cusum_30d_area','30天累计偏离','σ·天','累计偏离面积'],
 ['health_score','点位健康分','分','健康分变化']
].map(([key,name,unit,subsystem])=>({channelId:key,name,unit,subsystem,value:format(candidate.value.latest[key]),trendData:candidate.value.series.map(p=>({timestamp:p.timestamp,value:p[key]}))})))
</script>
<style scoped>
.tracking-evidence{color:#60778b}.tracking-evidence h3{font-size:16px;color:#41596e}.tracking-evidence p{font-size:12px;line-height:1.8;color:#8898a6}.tracking-evidence dl{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:20px 0}.tracking-evidence dt{font-size:12px;color:#8b9aa7}.tracking-evidence dd{font-size:19px;color:#496273;margin:8px 0 0}
</style>
