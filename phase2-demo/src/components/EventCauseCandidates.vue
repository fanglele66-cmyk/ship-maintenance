<template>
  <section v-if="context?.candidates" class="cause-panel" aria-label="候选原因研判">
    <header><h3>候选原因研判</h3><span>高／中／低为核查优先级，非已确认故障</span></header>
    <p class="cause-conclusion">{{ context.conclusion }}</p>
    <p class="cause-context">{{ context.navigation }} {{ context.conditions }}</p>
    <div class="cause-table-wrap"><table><thead><tr><th scope="col">候选原因</th><th scope="col">多源关联依据</th><th scope="col">可能影响</th></tr></thead><tbody><tr v-for="(row,i) in context.candidates" :key="row.cause"><th scope="row"><span class="cause-level" :class="'level-'+i">{{ row.level }}</span>{{ row.cause }}</th><td>{{ row.basis }}</td><td>{{ row.impact }}</td></tr></tbody></table></div>
    <p class="cause-boundary">依据：事件发生时记录与原始采样。{{ context.boundary }}</p>
  </section>
</template>
<script setup>
import {computed} from 'vue'
import {eventAssessmentContext} from '../workflow/eventAssessmentContext.js'
const props=defineProps({eventId:{type:String,required:true}})
const context=computed(()=>eventAssessmentContext[props.eventId])
</script>
<style scoped>
.cause-panel{margin-top:20px;padding:18px;border:1px solid #e4e7eb;border-radius:7px;background:#fff;color:#52637a}.cause-panel header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}.cause-panel h3{font-size:15px;color:#33465f;margin:0}.cause-panel header>span,.cause-boundary{font-size:11px;color:#7d8795}.cause-conclusion{font-size:14px;font-weight:600;color:#3b4e63;line-height:1.7;margin:12px 0 5px}.cause-context{font-size:12px;line-height:1.8;margin:0 0 15px;color:#6b7a8d}.cause-table-wrap{overflow-x:auto;border:1px solid #e6e8eb;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.85;table-layout:fixed}thead{background:#f7f5ef;color:#806a46}th,td{padding:13px 15px;text-align:left;vertical-align:top;border-bottom:1px solid #e9edf1}th+th,td{border-left:1px solid #edf0f3}thead th{font-weight:600}thead th:first-child{width:25%}thead th:nth-child(2){width:43%}tbody th{color:#3c5067;font-weight:500}tbody tr:last-child>*{border-bottom:0}.cause-level{display:inline-block;margin-right:9px;border-radius:4px;padding:0 6px;font-size:11px;font-weight:600;white-space:nowrap}.level-0{color:#986d2c;background:#f8efdf}.level-1{color:#577da2;background:#edf3f9}.level-2{color:#598576;background:#eef5f1}.cause-boundary{line-height:1.8;margin:10px 0 0}@media(max-width:760px){.cause-panel{padding:12px}.cause-table-wrap table{min-width:640px}.cause-panel header>span{font-size:10px}.cause-conclusion{font-size:13px}th,td{padding:10px}}
</style>
