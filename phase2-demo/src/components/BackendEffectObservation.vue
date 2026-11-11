<template>
 <section class="database-observation" aria-label="设备效果观察">
  <header><h2>效果观察</h2><span>{{report?'报告已回交':phase.observationError?'等待重试':'观察中'}}</span></header>
  <p>观察窗口：{{timeText(phase.at)}} — {{timeText(phase.observationDueAt)}}</p>
  <p v-if="!report" class="observation-notice">{{phase.observationError?'观察报告暂未生成，系统将自动重试。':'到达计划汇报时间后，自动汇总相关系统全部测点并生成报告。'}}</p>
  <p v-else class="observation-notice">{{report.summary}}</p>
  <h3>关联传感器 <small>{{points.length}} 项</small></h3>
  <ObservationSensorCharts :points="points" :readings="report?.observationSnapshot?.sensors||[]" :start="phase.at" :end="phase.observationDueAt" :pending="!report"/>
  <small>观察结果交轮机长确认后，再决定继续观察、复查或闭环。</small>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import {reportSensors} from '../workflow/manualAnomaly.js'
import {timeText} from '../workflow/eventLifecycle.js'
import ObservationSensorCharts from './ObservationSensorCharts.vue'
const props=defineProps({event:{type:Object,required:true},phase:{type:Object,required:true}})
const report=computed(()=>props.event.reports.find(r=>r.id===props.phase.observationReportId))
const points=computed(()=>{const scope=props.event.sensorScope||{};return reportSensors(scope.deviceId).filter(s=>scope.systems?.includes(s.subsystem)||scope.sensorIds?.includes(s.id)||['DC0001','DC0058'].includes(s.pointCode))})
</script>
<style scoped>
.database-observation{border:1px solid #e2e9f1;border-radius:7px;padding:20px;color:#445870}.database-observation header{display:flex;align-items:center;justify-content:space-between}.database-observation h2{font-size:20px;margin:0}.database-observation h3{font-size:14px;margin:22px 0 10px}.database-observation small,.database-observation header span{color:#8997a5;font-size:12px}.database-observation p{font-size:13px;line-height:1.8}.observation-notice{background:#f5f7f3;padding:12px 14px;border-radius:6px}.database-observation table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}.database-observation th,.database-observation td{text-align:left;padding:10px 12px;border-bottom:1px solid #e8edf2}.database-observation th{font-weight:500;background:#f7f9fb}
</style>
