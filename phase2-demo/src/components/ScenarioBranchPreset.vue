<template>
 <details v-if="options.length&&!readOnly" class="branch-preset">
  <summary>填写本阶段处理结果</summary>
  <p>按本轮实际情况选择结果，再补充检查依据、时间与未完成项。填入内容供核对，提交后才保存和推进。</p>
  <div><select v-model="choice" aria-label="处理结果"><option value="">请选择处理结果</option><option v-for="option in options" :key="option.id" :value="option.id">{{option.label}}</option></select><button class="p2-secondary" :disabled="!choice" @click="apply">填入反馈</button></div>
  <p v-if="notice" role="status">{{notice}}</p>
  <p v-if="executionNext"><b>提交后的处理安排：</b>{{executionNext.message}}</p>
 </details>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {feedbackPresets,executionPresetOptions,executionPreset,realExecutionContent} from '@/mock/realScenarioPresets'
const props=defineProps({scenario:String}),store=usePhase2DemoStore(),choice=ref(''),notice=ref('')
const item=computed(()=>store.cases[props.scenario]),stage=computed(()=>item.value?.stages[store.activeStage[props.scenario]])
const readOnly=computed(()=>store.isTaskHandled(props.scenario)||store.activeStage[props.scenario]<store.progress[props.scenario])
const options=computed(()=>!item.value?.realCaseId?[]:stage.value?.kind==='check'?feedbackPresets(item.value,stage.value):stage.value?.kind==='work'?executionPresetOptions:[])
const executionNext=computed(()=>stage.value?.kind==='work'&&choice.value?realExecutionContent(item.value,choice.value,stage.value):null)
watch(()=>props.scenario+':'+stage.value?.id,()=>{choice.value='';notice.value=''})
function apply(){
 const id=props.scenario,s=stage.value
 if(readOnly.value)return
 if(s.kind==='check'){
  const preset=options.value.find(option=>option.id===choice.value);if(!preset)return
  if(store.checkAssessments[id]?.stageId===s.id)store.decideCheck(id,'retry')
  preset.records.forEach((record,i)=>{store.taskResults[id+':'+s.id+':'+i]=record.result;store.taskNotes[id+':'+s.id+':'+i]=record.note})
  store.detailTab=s.label+'步骤'
 }else{
  const values=executionPreset(item.value,s,choice.value);if(!values)return
  store.requestExecutionRecord(id);const form=store.executionInquiry(id);if(!form)return
  store.updateExecutionRecord(id,form.id,{...form.values,...values,scenarioPreset:choice.value})
  s.tasks.forEach((_,i)=>{store.taskResults[id+':'+s.id+':'+i]=values['task'+i];store.taskNotes[id+':'+s.id+':'+i]=values['note'+i]})
  store.detailTab='验收确认'
 }
 notice.value='已填入待提交内容。请补齐具体发现、实际措施及依据；原始船端记录保持独立，尚未保存本轮结果。'
}
</script>
<style scoped>
.branch-preset{flex:none;border:1px solid #ded4c3;border-radius:6px;background:#fcfaf6;padding:12px 16px;margin:10px 0;color:#56616b;font-size:13px;line-height:1.7}.branch-preset summary{cursor:pointer;font-weight:600;color:#80642d}.branch-preset p{margin:8px 0}.branch-preset>div{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.branch-preset select{max-width:100%;min-width:240px;padding:8px;border:1px solid #ddd4c4;border-radius:4px;background:white;font:inherit}.branch-preset button:disabled{opacity:.5}
</style>
