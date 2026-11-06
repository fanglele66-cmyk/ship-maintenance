<template><div class="lc-operation-details" :class="{'lc-operation-compact':compact,'has-substeps':displayStep.substeps?.length>1,'paged-operations':paginate}">
 <p v-if="displayStep.guide&&(!compact||!displayStep.substeps?.length)">{{displayStep.guide}}</p>
 <ol v-if="displayStep.checks?.length" class="instruction-list"><li v-for="(check,j) in checksFor(displayStep)" :key="j"><span class="instruction-number">{{number}}.{{j+1}}</span><span>{{check}}</span></li></ol>
 <RecordGuidance v-if="compact&&!displayStep.substeps?.length&&displayStep.recordHint" :text="displayStep.recordHint"/>
 <TaskReferenceImages v-if="!displayStep.substeps?.length" :images="references()"/>
 <nav v-if="pageCount>1" class="operation-pages" aria-label="本步骤作业子项"><span>本步骤共 {{displayStep.substeps.length}} 项</span><div><button v-for="page in pageCount" :key="page" type="button" :aria-pressed="operationPage===page-1" @click="operationPage=page-1">{{(page-1)*2+1===Math.min(page*2,displayStep.substeps.length)?(page-1)*2+1:(page-1)*2+1+'–'+Math.min(page*2,displayStep.substeps.length)}} 项</button></div><small>逐组查看，共同回交本步骤结果</small></nav>
 <section v-for="{part,i} in visibleParts" :key="i" class="substep"><h4>{{number}}.{{i+1}} {{part.label}}</h4><p v-if="part.guide&&!checksFor(part).includes(part.guide)">{{part.guide}}</p>
  <ol class="instruction-list"><li v-for="(check,j) in checksFor(part)" :key="j"><span class="instruction-number">{{number}}.{{i+1}}.{{j+1}}</span><span>{{check}}</span></li></ol>
  <RecordGuidance v-if="part.recordHint" :text="part.recordHint"/><TaskReferenceImages :images="references(part,i)"/>
 </section>
</div></template>
<script setup>
import {computed,ref,watch} from 'vue'
import RecordGuidance from './RecordGuidance.vue'
import TaskReferenceImages from './TaskReferenceImages.vue'
import {getTaskReferenceImages} from '../workflow/taskReferenceImages.js'
import {repairStepForDisplay} from '../workflow/repairPreparation.js'
const props=defineProps({event:Object,task:Object,step:{type:Object,required:true},compact:Boolean,paginate:Boolean,number:{type:[Number,String],default:1}})
const operationPage=ref(0)
const displayStep=computed(()=>repairStepForDisplay({event:props.event,task:props.task,step:props.step}))
const pageCount=computed(()=>props.paginate?Math.ceil((displayStep.value.substeps?.length||0)/2):1)
const visibleParts=computed(()=>{const parts=(displayStep.value.substeps||[]).map((part,i)=>({part,i}));return props.paginate?parts.slice(operationPage.value*2,operationPage.value*2+2):parts})
watch(()=>props.step,()=>operationPage.value=0)
const checksFor=part=>[...new Set((part.checks||[]).filter(Boolean))]
const references=(part,partIndex)=>{const originalIndex=props.step.substeps?.indexOf(part);return getTaskReferenceImages({event:props.event,task:props.task,step:props.step,part,stepIndex:Number(props.number)-1,partIndex:originalIndex>=0?originalIndex:partIndex})}
</script>
<style scoped>
.lc-operation-details{font-size:13px;line-height:1.75}.lc-operation-details>p{margin:0 0 8px}.instruction-list{list-style:none!important;padding:0!important;margin:6px 0}.instruction-list>li{display:flex!important;align-items:baseline;gap:10px;padding:2px 0!important;border:0!important}.instruction-number{flex:none;min-width:25px;font-size:11px;color:#a08048;font-variant-numeric:tabular-nums}.substep{min-width:0;border-left:2px solid #e9dfce;padding-left:12px;margin:10px 0}.substep h4{font-size:13px;font-weight:600;margin:0 0 5px}.substep p{margin:4px 0}.lc-operation-compact{line-height:1.65}.lc-operation-compact .substep{margin:6px 0;padding-left:10px}.operation-context{font-size:12px;color:#718091;margin-top:4px}.operation-context summary{color:#9b8254;cursor:pointer}.operation-context p{margin:6px 0}.operation-pages{display:flex;align-items:center;gap:12px;grid-column:1/-1;flex-wrap:wrap;margin:4px 0 6px;font-size:12px;color:#7e8b96}.operation-pages>div{display:flex;gap:6px}.operation-pages button{font:inherit;border:1px solid #deddd5;background:#fff;padding:3px 10px;border-radius:4px;color:#6d7378;cursor:pointer}.operation-pages button[aria-pressed=true]{background:#f7f2e7;border-color:#c5ad7a;color:#8a6c37}.operation-pages small{font-size:11px}
@media(min-width:1101px){.lc-operation-compact.has-substeps{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px}.lc-operation-compact.has-substeps>p,.lc-operation-compact.has-substeps>.instruction-list{grid-column:1/-1}}
.paged-operations :deep(.task-reference-images){margin:8px 0 4px}.paged-operations :deep(.reference-grid){flex-wrap:nowrap}.paged-operations :deep(.reference-card){flex-shrink:1}.paged-operations :deep(.reference-preview){height:120px}.paged-operations :deep(.reference-card figcaption){padding:7px 10px}
@media(max-width:700px){.paged-operations :deep(.reference-grid){flex-wrap:wrap}}
</style>

<style scoped>
@media(min-width:1101px){.paged-operations :deep(.reference-focus){font-size:11px;line-height:1.55}.paged-operations :deep(.reference-card figcaption){padding:6px 9px}.paged-operations .substep{margin:3px 0}.paged-operations .operation-pages{margin:2px 0 4px}}
</style>
