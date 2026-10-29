<template>
 <div v-if="compact" class="lc-operation-compact">
  <section v-for="(item,i) in step.substeps?.length?step.substeps:[step]" :key="i">
   <h4 v-if="step.substeps?.length">{{i+1}}. {{item.label}}</h4>
   <div><p>{{compactRepairText(item.guide)}} <span v-if="item.checks?.length" class="lc-operation-checks">{{item.checks.filter(check=>!check.startsWith('已提交依据：')).map(compactRepairText).join(' ')}}</span></p></div>
  </section>
 </div>
 <div v-else class="lc-operation-details">
  <p>{{step.guide}}</p>
  <ol v-if="step.checks?.length"><li v-for="check in step.checks" :key="check">{{check}}</li></ol>
  <section v-for="(substep,i) in step.substeps||[]" :key="i" class="lc-operation"><h4>{{i+1}}. {{substep.label}}</h4><p>{{substep.guide}}</p><ol><li v-for="check in substep.checks||[]" :key="check">{{check}}</li></ol><p v-if="substep.recordHint" class="lc-operation-record">记录要求：{{substep.recordHint}}</p></section>
 </div>
</template>
<script setup>
import {compactRepairText} from '../workflow/repairDisplay'
defineProps({step:{type:Object,required:true},compact:Boolean})
</script>
<style scoped>
.lc-operation-details{font-size:13px;line-height:1.8}.lc-operation-details>p{margin:0 0 10px}.lc-operation-details ol{padding-left:22px}.lc-operation{border-left:2px solid #e9dfce;padding:2px 0 2px 14px;margin:15px 0}.lc-operation h4{font-size:13px;font-weight:600;margin:0 0 6px}.lc-operation p{margin:5px 0}.lc-operation-record{color:#8291a3;font-size:12px;white-space:pre-wrap}
.lc-operation-compact{font-size:13px;line-height:1.6}.lc-operation-compact>section{display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #edf0f4}.lc-operation-compact>section:last-child{border:0}.lc-operation-compact h4{flex:0 0 170px;font-size:13px;line-height:1.6;font-weight:600;margin:0}.lc-operation-compact section>div{min-width:0;flex:1}.lc-operation-compact p{margin:0;line-height:1.6}.lc-operation-compact .lc-operation-checks{margin-top:4px;color:#65778a}@media(max-width:1200px){.lc-operation-compact>section{display:block}.lc-operation-compact h4{margin-bottom:4px}}
</style>
