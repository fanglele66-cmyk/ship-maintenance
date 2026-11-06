<template>
 <section class="task-records-wizard" :aria-label="showFeedback?'逐步查看执行记录':'逐步查看任务步骤'">
  <nav class="lc-stepper" role="tablist" :aria-label="showFeedback?'执行记录步骤':'任务步骤'" @keydown="moveTab">
   <button v-for="(step,i) in task.steps" :id="tabId(i)" :key="i" :title="step.label" type="button" role="tab" :aria-controls="panelId" :aria-selected="index===i" :tabindex="index===i?0:-1" :class="{active:index===i,complete:showFeedback&&isTaskStepComplete(step,records[i])}" @click="index=i"><span>{{i+1}}</span>{{taskStepLabel(step,kind,i)}}</button>
  </nav>
  <section v-if="step" :id="panelId" class="task-record-panel" role="tabpanel" :aria-labelledby="tabId(index)">
   <LifecycleStepInstructions :event="event" :task="task" :number="index+1" :step="step" :compact="!investigation"/>
   <RecordGuidance v-if="investigation&&!step.substeps?.length" :text="step.recordHint"/>
   <dl v-if="showFeedback" class="record-feedback"><div><dt>{{investigation?'检查结果':'作业反馈'}}</dt><dd>{{record?.result||'尚未填写'}}</dd></div><div v-if="record?.executionStatus"><dt>实际执行情况</dt><dd>{{record.executionStatus}}</dd></div><div><dt>备注</dt><dd>{{record?.note||'未填写备注'}}</dd></div></dl>
  </section>
 </section>
</template>
<script setup>
import {computed,ref,watch,nextTick,useId} from 'vue'
import LifecycleStepInstructions from './LifecycleStepInstructions.vue'
import RecordGuidance from './RecordGuidance.vue'
import {isTaskStepComplete} from '../workflow/taskStepCompletion.js'
import {taskStepLabel} from '../workflow/taskStepPresentation.js'
const props=defineProps({event:{type:Object,required:true},task:{type:Object,required:true},records:{type:Array,default:()=>[]},showFeedback:{type:Boolean,default:true}})
const index=ref(0),step=computed(()=>props.task.steps[index.value]),record=computed(()=>props.records[index.value])
const kind=computed(()=>props.task.kind||props.task.action),investigation=computed(()=>['investigation','investigate','recheck'].includes(kind.value))
const instanceId=useId(),panelId=computed(()=>`task-record-panel-${props.task.id||instanceId}`),tabId=i=>`task-record-tab-${props.task.id||instanceId}-${i}`
watch(()=>props.task.id,()=>{index.value=0})
watch(()=>props.task.steps.length,count=>{index.value=Math.min(index.value,Math.max(0,count-1))})
async function moveTab(event){
 const count=props.task.steps.length;if(!count||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
 event.preventDefault();index.value=event.key==='Home'?0:event.key==='End'?count-1:(index.value+(event.key==='ArrowRight'?1:-1)+count)%count
 const list=event.currentTarget;await nextTick();list.querySelectorAll('[role=tab]')[index.value]?.focus()
}
</script>
<style scoped>
.task-records-wizard{min-width:0}.lc-stepper{display:flex;gap:8px;overflow-x:auto;border-bottom:1px solid #e7edf4;padding:10px 0}.lc-stepper button{display:flex;flex:1 0 130px;align-items:center;gap:8px;font-size:12px;text-align:left;min-height:42px}.lc-stepper button span{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:11px}.task-record-panel{padding-top:12px}.record-feedback{display:flex;flex-direction:column;gap:12px;margin:16px 0 0;padding:14px;background:#f6f8fa;font-size:13px;line-height:1.7}.record-feedback dt{color:#718091;margin-bottom:4px}.record-feedback dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#40596d}
</style>
