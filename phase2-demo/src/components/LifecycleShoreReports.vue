<template>
 <section class="shore-history" aria-label="本事件上报岸基报告">
  <header><h2>上报岸基报告</h2><p>保留每次上报时的内容，后续报告更新不会覆盖已上报版本。</p></header>
  <nav class="shore-versions" aria-label="历次上报记录"><button v-for="(record,index) in ordered" :key="record.id" :aria-pressed="current?.id===record.id" @click="selected=record.id">第 {{ordered.length-index}} 次 · {{timeText(record.at)}}</button></nav>
  <template v-if="current">
   <p class="shore-status">已上报岸基 · {{current.owner||'轮机长'}}</p>
   <details v-if="current.syncedReport?.includedReports?.length" class="shore-sources"><summary>本次收录 {{current.syncedReport.includedReports.length}} 份报告 · 原报告索引</summary><p>链接打开当前原报告；下方正文保留本次上报时的版本。</p><ul><li v-for="report in current.syncedReport.includedReports" :key="report.id"><RouterLink :to="'/reports/'+report.id">{{report.title}} ↗</RouterLink></li></ul></details>
   <LifecycleReport :report="{...shoreReportPresentation(current),at:current.at}"/>
  </template>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import LifecycleReport from './LifecycleReport.vue'
import {shoreReportPresentation} from '../workflow/shoreReports.js'
import {timeText} from '../workflow/eventLifecycle.js'
const props=defineProps({records:{type:Array,required:true},selectedId:{type:String,default:''}})
const selected=ref(props.selectedId),ordered=computed(()=>[...props.records].reverse())
const current=computed(()=>ordered.value.find(r=>r.id===selected.value)||ordered.value[0])
watch(()=>props.selectedId,value=>selected.value=value)
</script>
<style scoped>
.shore-history h2{font-size:20px;margin:4px 0 8px}.shore-history header>p{font-size:13px;color:#7c8b97}.shore-versions{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.shore-versions button{border:1px solid #e1e4dc;background:#fff;border-radius:5px;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer;color:#667980}.shore-versions button[aria-pressed=true]{background:#f6f1e7;border-color:#bda675;color:#836536}.shore-status{font-size:14px;padding:10px 12px;background:#faf8f2;border-radius:5px;color:#846c45}.shore-sources{font-size:14px;margin:16px 0;line-height:1.8}.shore-sources summary{cursor:pointer}.shore-sources a{color:#8a6c3d}.shore-sources li{margin:6px 0}
</style>
