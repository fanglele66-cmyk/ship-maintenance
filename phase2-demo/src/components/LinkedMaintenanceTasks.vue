<template>
 <section class="linked-maintenance" aria-label="关联维保任务">
  <p v-if="!tasks.length">尚未安排关联维保任务。</p>
  <article v-for="task in tasks" :key="task.id">
   <header><h3>{{task.initialTitle}}</h3><span>{{status(task.id)}}</span></header>
   <dl>
    <div><dt>负责人</dt><dd>{{assignment(task.id).owner||'待安排'}}</dd></div>
    <div><dt>计划窗口</dt><dd>{{assignment(task.id).due||'待确定'}}</dd></div>
    <div><dt>处理范围</dt><dd>{{assignment(task.id).scope||task.taskScope}}</dd></div>
    <div><dt>关联工单</dt><dd>{{orders.state(task.id).linked?`${orders.state(task.id).linked.id} · ${orders.state(task.id).linked.title}`:'尚未确认关联'}}</dd></div>
    <div v-if="orders.state(task.id).linked?.jobCardNo"><dt>维修作业单号</dt><dd>{{orders.state(task.id).linked.jobCardNo}}</dd></div>
   </dl>
   <section class="maintenance-results"><h4>处理记录</h4>
    <template v-if="store.executionRecords[task.id]?.length"><div v-for="(record,index) in store.executionRecords[task.id]" :key="index" class="execution-record"><b>第 {{record.round||index+1}} 轮 · {{record.values.executedAt.replace('T',' ')}}</b><p>{{record.values.measures}}</p><p>验收：{{record.values.acceptance}}</p><small>执行人：{{record.executor||record.values.executor||assignment(task.id).owner}}</small></div></template>
    <template v-else-if="workRecord(task.id)"><p v-for="step in workRecord(task.id).records||[]" :key="step.label">{{step.label}}：{{step.result}}{{step.note?'；'+step.note:''}}</p><p>作业反馈已提交，待验收。</p></template>
    <p v-else>{{store.checkAssessments[task.id]?.message||'已安排专项检查，尚未提交维修作业记录。'}}</p>
   </section>
   <button v-if="store.todoCreated[task.id]&&!store.isTaskHandled(task.id)" type="button" class="p2-secondary" @click="openTask(task.id)">处理维保任务</button>
  </article>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {useEventWorkOrderStore} from '@/stores/eventWorkOrderStore'
import {maintenanceRecommendations} from '@/mock/issueRelationships'
const props=defineProps({scenario:{type:String,required:true}}),store=usePhase2DemoStore(),orders=useEventWorkOrderStore(),router=useRouter()
const tasks=computed(()=>maintenanceRecommendations(store,props.scenario).filter(task=>store.todoCreated[task.id]||store.executionRecords[task.id]?.length))
function assignment(id){return store.assignments[id]||store.trackingDispositions[props.scenario]?.arrangement||{}}
function workRecord(id){return Object.entries(store.workStepRecords).filter(([key])=>key.startsWith(id+':')).at(-1)?.[1]}
function status(id){return store.eventStatus[id]==='closed'?'已闭环':store.isTaskHandled(id)?'验收完成':workRecord(id)?'待验收':'执行中'}
function openTask(id){store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
</script>
<style scoped>
.linked-maintenance{padding-top:16px;font-size:13px;line-height:1.75}.linked-maintenance article{padding:18px 0;border-bottom:1px solid #e4eaf1}.linked-maintenance header{display:flex;justify-content:space-between;gap:18px;align-items:center}.linked-maintenance h3{margin:0;font-size:16px;color:#2e4056}.linked-maintenance header>span{font-size:12px;color:#97713b}.linked-maintenance dl>div{display:grid;grid-template-columns:95px 1fr;gap:12px;margin:9px 0}.linked-maintenance dt{color:#8290a0}.linked-maintenance dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.maintenance-results{border-top:1px solid #e9edf3;padding-top:12px;margin-top:18px}.maintenance-results h4{margin:0 0 10px;font-size:14px}.maintenance-results p{white-space:pre-wrap}.execution-record{margin-bottom:16px}.execution-record small{color:#8190a0}
</style>
