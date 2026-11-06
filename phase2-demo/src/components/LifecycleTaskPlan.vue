<template>
 <section v-if="plan" class="lc-pending-plan" :aria-busy="busy">
  <header><small v-if="busy">AI 正在整理建议…</small><div class="lc-plan-actions"><button type="button" :disabled="plan.status!=='ready'" @click="$emit('edit')">通过对话修改任务</button></div></header>
  <p v-if="sourceReport" class="lc-plan-source">任务依据：{{sourceReport.title}}</p>
  <p v-if="busy" class="lc-plan-progress" role="status">{{plan.source==='preset'?'预设复查步骤已列出，AI 正结合实际作业与观察记录整理新版，完成后更新。':plan.status==='updating'?'正在按对话要求修改任务，完成后更新步骤。':'正在依据已有结果生成后续步骤…'}}</p>
  <div v-if="plan.error" class="lc-plan-error" role="alert"><p>{{plan.error}}{{plan.source==='preset'?' 预设任务已保留，可核对后派发或重新生成。':''}}</p><button type="button" @click="retry">重新生成任务</button></div>
  <LifecycleTaskRecords v-if="plan.steps.length" :key="plan.key+':'+plan.version" :event="event" :task="plan" :show-feedback="false"/>
  <details v-if="plan.sources?.length"><summary>参考资料 · {{plan.sources.length}} 处</summary><p v-for="s in plan.sources" :key="s.id">[{{s.id}}] {{s.title}} · {{s.file}} L{{s.startLine}}—{{s.endLine}}</p></details>
  <details v-if="plan.editHistory?.length" class="lc-edit-history"><summary>任务修改记录 · {{plan.editHistory.length}} 次</summary><section v-for="(edit,i) in plan.editHistory" :key="i"><strong>第 {{i+1}} 次修改</strong><p>{{edit.text}}</p><p>{{edit.summary}}</p><details><summary>查看修改前任务</summary><LifecycleTaskRecords :event="event" :task="{...plan,steps:edit.before.steps}" :show-feedback="false"/></details></section></details>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import LifecycleTaskRecords from './LifecycleTaskRecords.vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
const props=defineProps({event:{type:Object,required:true}})
defineEmits(['edit'])
const store=useEventLifecycleStore(),plan=computed(()=>props.event.pendingPlan),busy=computed(()=>['pending','generating','updating'].includes(plan.value?.status)),sourceReport=computed(()=>props.event.reports.find(r=>r.id===plan.value?.sourceReportId))
function retry(){void store.prepareTaskPlan(props.event.id,{retry:true}).catch(()=>{})}
</script>
<style scoped>
.lc-pending-plan>header{display:flex;align-items:center;justify-content:space-between;gap:16px}.lc-pending-plan small,.lc-plan-note{color:#8996a5;font-size:12px}.lc-pending-plan button{border:1px solid #d9c6a6;background:#fffaf1;color:#94733f;border-radius:5px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px}.lc-pending-plan button:disabled{opacity:.5;cursor:wait}.lc-pending-plan>.task-records-wizard{margin-top:12px}.lc-pending-plan>section h3{font-size:14px}.lc-pending-plan>section p{white-space:pre-line}.lc-plan-progress{font-size:12px;color:#957441}.lc-plan-error{background:#fcf5ec;padding:12px;font-size:12px;color:#9e6b39}.lc-pending-plan details{font-size:12px;color:#8795a6;overflow-wrap:anywhere}.lc-pending-plan summary{cursor:pointer}@media(max-width:700px){.lc-pending-plan>header{align-items:flex-start;flex-direction:column}}
</style>
<style scoped>
.lc-plan-actions{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
</style>
