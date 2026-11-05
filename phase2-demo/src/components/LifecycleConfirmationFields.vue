<template>
 <section class="confirmation-fields" v-if="['investigate','recheck','repair','maintenance','observe','close','false'].includes(action)">
  <label v-if="['investigate','recheck','repair','maintenance'].includes(action)">处理依据与安全实施前提（选填）<textarea v-model="draft.evidence" rows="2" placeholder="有需要补充的依据或实施条件时填写"/></label>
  <template v-if="action==='observe'&&draft.observationPlan">
   <label>观察目的<textarea v-model="draft.observationPlan.purpose" rows="2"/></label>
   <label>计划汇报时间<input v-model="draft.observationPlan.dueAt" type="datetime-local" required/></label>
   <label>关注信号或现象（选填）<textarea v-model="draft.observationPlan.signals" rows="2"/></label>
   <details><summary>补充观察条件（选填）</summary><label v-for="field in observationFields" :key="field.key">{{field.label}}<textarea v-model="draft.observationPlan[field.key]" rows="2"/></label><label>提前介入信号<select v-model="draft.observationPlan.triggerSignal"><option value="">不配置数值触发</option><option v-for="name in signals" :key="name">{{name}}</option></select></label><template v-if="draft.observationPlan.triggerSignal"><p class="lc-muted">近 15 分钟连续 3 个有效采样满足条件时提前汇报。</p><label>触发关系<select v-model="draft.observationPlan.triggerOperator"><option value="above">持续高于</option><option value="below">持续低于</option></select></label><label>阈值（信号原单位）<input type="number" step="any" required v-model="draft.observationPlan.triggerValue"/></label></template></details>
  </template>
  <template v-if="['close','false'].includes(action)&&draft.closureDraft"><details><summary>补充闭环说明（选填）</summary><label v-for="field in closureFields" :key="field.key">{{field.label}}<textarea v-model="draft.closureDraft[field.key]" rows="2"/></label></details><label v-if="hasUnfinishedWork">未完成事项的处置与承担人<textarea v-model="draft.remainingDisposition" rows="2" required placeholder="说明剩余工作的安排"/></label></template>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import {taskExecution} from '../workflow/taskExecution.js'
import {observationSettings} from '../workflow/lifecycleObservation.js'
const props=defineProps({event:Object,draft:Object,action:String})
const observationFields=[{key:'conditions',label:'可比工况'},{key:'limits',label:'覆盖限制'},{key:'trigger',label:'需要提前介入的情况'}]
const hasUnfinishedWork=computed(()=>{const task=props.event.tasks.find(t=>t.id===props.event.currentTask);return task&&task.status!=='terminated'&&taskExecution(task).incomplete})
const closureFields=[{key:'conclusion',label:'闭环结论'},{key:'evidence',label:'确认依据'},{key:'process',label:'处置过程'},{key:'boundary',label:'未验证边界'}]
const signals=computed(()=>observationSettings(props.event)?.names||[])
</script>
<style scoped>.confirmation-fields{grid-column:1/-1;display:grid;gap:16px;border-top:1px solid #e1e5e9;padding-top:16px}.confirmation-fields label{display:flex;flex-direction:column;gap:8px}.confirmation-fields .confirm-check{flex-direction:row;align-items:flex-start}.confirm-check input{width:auto;flex:none}.confirmation-fields textarea,.confirmation-fields select,.confirmation-fields input{font:inherit}.confirmation-fields h3,.confirmation-fields p{margin:0}.confirmation-fields details label{margin-top:12px}</style>
