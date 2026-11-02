<template><div class="lc-operation-details" :class="{'lc-operation-compact':compact,'has-substeps':step.substeps?.length>1}">
 <p v-if="step.guide&&(!compact||!step.substeps?.length)">{{step.guide}}</p>
 <ol v-if="step.checks?.length" class="instruction-list"><li v-for="(check,j) in step.checks" :key="j"><span class="instruction-number">{{number}}.{{j+1}}</span><span>{{check}}</span></li></ol>
 <section v-for="(part,i) in step.substeps||[]" :key="i" class="substep"><h4>{{number}}.{{i+1}} {{part.label}}</h4><p v-if="!compact||!part.checks?.length">{{part.guide}}</p><ol class="instruction-list"><li v-for="(check,j) in part.checks||[]" :key="j"><span class="instruction-number">{{number}}.{{i+1}}.{{j+1}}</span><span>{{check}}</span></li></ol><details v-if="compact&&(part.recordHint||part.guide&&part.checks?.length)" class="operation-context"><summary>说明与回交要求</summary><p v-if="part.checks?.length">{{part.guide}}</p><RecordGuidance v-if="part.recordHint" :text="part.recordHint"/></details><RecordGuidance v-else-if="part.recordHint" :text="part.recordHint"/></section>
</div></template>
<script setup>
import RecordGuidance from './RecordGuidance.vue'
defineProps({step:{type:Object,required:true},compact:Boolean,number:{type:[Number,String],default:1}})
</script>
<style scoped>
.lc-operation-details{font-size:13px;line-height:1.85}.lc-operation-details>p{margin:0 0 10px}.instruction-list{list-style:none!important;padding:0!important;margin:8px 0}.instruction-list>li{display:flex!important;align-items:baseline;gap:10px;padding:3px 0!important;border:0!important}.instruction-number{flex:none;min-width:25px;font-size:11px;color:#a08048;font-variant-numeric:tabular-nums}.substep{border-left:2px solid #e9dfce;padding-left:14px;margin:14px 0}.substep h4{font-size:13px;font-weight:600;margin:0 0 5px}.substep p{margin:4px 0}.lc-operation-compact{line-height:1.7}
</style>

<style scoped>
.lc-operation-compact .substep{margin:8px 0;padding-left:10px}.operation-context{font-size:12px;color:#8390a0;margin-top:4px}.operation-context summary{color:#9b8254;cursor:pointer}.operation-context p{margin:6px 0}@media(min-width:1101px){.lc-operation-compact.has-substeps{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}.lc-operation-compact.has-substeps>p,.lc-operation-compact.has-substeps>.instruction-list{grid-column:1/-1}}
</style>
