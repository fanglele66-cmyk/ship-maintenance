<template>
  <section v-if="record?.plan" class="tracking-task p2-panel p2-pad-single">
    <header><h3>第 {{record.observationRound}} 轮专项观察</h3><span>{{store.assignments[taskId]?.owner}}</span></header>
    <dl class="plan"><div><dt>观察期限</dt><dd>{{record.plan.deadline.replace('T',' ')}}</dd></div><div><dt>关注指标</dt><dd>{{record.plan.metrics}}</dd></div><div><dt>下次判断条件</dt><dd>{{record.plan.criteria}}</dd></div></dl>
    <details v-if="verifications.length||history.length" class="prior-records" open><summary>已提交资料 · {{history.length}} 轮观察</summary>
      <article v-for="verification in verifications" :key="verification.id"><h4>{{verification.title}}</h4><p>{{verification.reason}}</p><ul><li v-for="(item,index) in verification.records" :key="index"><strong>{{item.label}}：{{item.result}}</strong><p v-if="item.note">{{item.note}}</p></li></ul><small>{{verification.actor}} · {{verification.at}}</small></article>
      <article v-for="(item,index) in history" :key="index"><h4>第 {{item.round||index+1}} 轮观察记录</h4><p>{{item.findings}}</p><small>{{item.actor}} · {{item.observedAt.replace('T',' ')}}</small></article>
    </details>
    <form v-if="active" class="increment-form" @submit.prevent="submit"><h3>本轮新增观察</h3><p>依据本轮关注指标补充新增资料，既有核实与观察记录继续保留。</p><label>实际观察时间 <em>*</em><input type="datetime-local" v-model="draft.observedAt" required/></label><label>新增观察记录与依据 <em>*</em><textarea v-model="draft.findings" required rows="5" placeholder="记录本轮新增读数、工况与资料来源，说明判断条件的覆盖情况和仍需确认项。"/></label><p v-if="error" role="alert" class="error">{{error}}</p><button class="p2-primary" type="submit">提交增量观察，交轮机长确认</button></form>
    <div v-else class="submitted"><h3>观察资料已提交</h3><p>本轮任务已完成，等待轮机长确认事件下一步处置。</p><button class="p2-primary" @click="router.push({path:'/situation/issue/'+parentId,query:{tab:'事件概览'}})">返回事件确认处置 →</button></div>
  </section>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {parentIssueId,maintenanceChildIds} from '@/mock/issueRelationships'
import {trackingProcessReference} from '@/mock/trackingProcessReferences'
const props=defineProps({taskId:{type:String,required:true}}),store=usePhase2DemoStore(),router=useRouter(),error=ref('')
const parentId=computed(()=>parentIssueId(props.taskId)),record=computed(()=>store.trackingDispositions[parentId.value]),history=computed(()=>record.value?.observationHistory||[])
const verifications=computed(()=>{
 const reference=trackingProcessReference(parentId.value)
 const retained=reference?[{id:reference.id,title:'首轮核实与回交记录',reason:reference.decision,records:reference.feedback,actor:reference.actor,at:reference.at}]:[]
 const submitted=[parentId.value,...maintenanceChildIds(parentId.value)].filter(id=>store.completedTasks[id]&&store.checkAssessments[id]).map(id=>({...store.completedTasks[id],id,title:store.cases[id].initialTitle,records:store.checkAssessments[id].records}))
 return [...retained,...submitted]
})
const active=computed(()=>record.value?.status==='observing'&&!store.isTaskHandled(props.taskId))
const draft=computed(()=>store.trackingObservationDrafts[props.taskId]||(store.trackingObservationDrafts[props.taskId]={observedAt:'',findings:''}))
function submit(){const result=store.submitTrackingObservation(parentId.value,draft.value);error.value=result.ok?'':result.error}
</script>
<style scoped>
.tracking-task{color:#43576e;line-height:1.7}.tracking-task header{display:flex;align-items:center;justify-content:space-between;gap:16px}.tracking-task h3{font-size:17px;margin:8px 0}.tracking-task h4{font-size:14px;margin:0}.plan{padding:14px 18px;background:#faf8f3;border:1px solid #e8dfd0;border-radius:6px}.plan>div{display:grid;grid-template-columns:100px 1fr;gap:14px;padding:7px 0}dt{color:#8b744a}dd{margin:0;white-space:pre-wrap}.prior-records{border:1px solid #e3e8ef;border-radius:6px;padding:16px;margin:20px 0}.prior-records summary{cursor:pointer;font-weight:600}.prior-records article{padding:16px 0;border-bottom:1px solid #e9edf2}.prior-records article:last-child{border:0;padding-bottom:0}.prior-records p{white-space:pre-wrap}.prior-records small{color:#8090a2}.increment-form{margin-top:22px}.increment-form label{display:block;margin:15px 0}.increment-form input,.increment-form textarea{display:block;width:100%;max-width:100%;box-sizing:border-box;padding:10px;margin-top:6px;border:1px solid #d9e1eb;border-radius:5px;color:inherit;font:inherit}.increment-form input{max-width:330px}.increment-form em,.error{color:#b7473e}.submitted{padding:20px 0}@media(max-width:600px){.plan>div{grid-template-columns:1fr;gap:2px}.tracking-task header{display:block}}
</style>
