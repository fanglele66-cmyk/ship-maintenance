<template>
 <section v-if="tracks.length" class="health-tracks">
  <article v-for="track in tracks" :key="track.id">
   <header><div><small>{{track.device}}</small><h3>{{track.title}}</h3></div><span>{{store.healthUpdates[track.id]?.taskComplete?'核实已结束 · 持续跟踪':track.status}}</span></header>
   <p>{{summary(track)}}</p>
   <SituationTimeline :entries="storyTimeline(store,track.id)"/>
   <footer><p>{{trackingNext(track)}}</p>
    <button v-if="track.requestId&&!store.todoCreated[track.requestId]&&!detail" class="p2-secondary" @click="openIssue(track.requestId)">查看现场核实建议</button>
    <button v-if="track.recommendationId&&!detail" class="p2-secondary" @click="openIssue(track.recommendationId)">查看关联维保建议</button>
    <button v-if="store.healthUpdates[track.id]?.recommendationId && requestId!==store.healthUpdates[track.id].recommendationId" class="p2-secondary" @click="openIssue(store.healthUpdates[track.id].recommendationId)">查看本跟踪形成的维保建议</button>
    <button v-if="track.laterNodes&&store.healthUpdates[track.id]?.taskComplete&&(store.healthUpdates[track.id]?.laterNodes?.length||0)<track.laterNodes.length" class="p2-secondary" @click="store.advanceHealthTrack(track.id)">查看后续可比节点</button>
   </footer>
  </article>
 </section>
</template>
<script setup>
import SituationTimeline from './SituationTimeline.vue'
import {storyTimeline} from '@/mock/storyRecords'
import {computed} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {healthTracks,workflowCases} from '@/mock/fourStoryWorkflow'
import {matchesSituationDevice} from '@/mock/situationScope'
const props=defineProps({deviceId:String,requestId:String,detail:Boolean,excludeRequestIds:{type:Array,default:()=>[]}}),store=usePhase2DemoStore(),router=useRouter()
const tracks=computed(()=>healthTracks.filter(track=>props.requestId?track.requestId===props.requestId||track.recommendationId===props.requestId||store.healthUpdates[track.id]?.recommendationId===props.requestId:matchesSituationDevice(track,props.deviceId)&&![track.requestId,track.recommendationId,store.healthUpdates[track.id]?.recommendationId].some(id=>id&&props.excludeRequestIds.includes(id))))
function openIssue(id){router.push({path:'/situation/issue/'+id,query:{from:'device',device:props.deviceId||workflowCases[id]?.deviceId||'main-engine-1'}})}
function trackingNext(track){const state=store.healthUpdates[track.id];if(state?.recommendationId)return props.requestId===state.recommendationId?'原核实与本次提前建议同源保留，原季度计划未完成的项目继续有效。':'原核实已结束，当前另有相关提前检查建议；可查看来源与本次安排。';return state?.taskComplete?'本次核实结束，原健康记录继续；没有新的信息需求时不重复派单。':track.next}
function summary(track){const recommendation=track.recommendationId||store.healthUpdates[track.id]?.recommendationId;if(recommendation){const decision=store.completedTasks[recommendation],execution=store.executionRecords[recommendation]?.at(-1);if(decision)return '本次提前评估已结束：'+decision.reason+' 原计划和健康来源保留。';if(execution)return '本次实际措施已记录：'+execution.values.measures+'；验收：'+execution.values.acceptance+'。持续效果独立跟踪。';if(store.checkAssessments[recommendation]?.advance)return '本次评估已取得提前处理依据和安排条件，实际执行尚待人员提交；原健康记录继续。'}return store.healthUpdates[track.id]?.conclusion||track.conclusion}
</script>
<style scoped>
.health-tracks{min-width:0}.health-tracks article{background:white;border:0;border-top:1px solid #e6e9ee;border-radius:0;padding:18px 0;margin:16px 0;color:#445870;font-size:14px;line-height:1.8}.health-tracks header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.health-tracks h3{font-size:15px;color:#202020;margin:2px 0 8px}.health-tracks small,.health-tracks header>span{font-size:12px;color:#778598}.health-tracks p{margin:8px 0;overflow-wrap:break-word}.health-tracks details{margin:14px 0}.health-tracks summary{cursor:pointer;color:#936821}.health-tracks ol{padding-left:24px;margin:16px 0}.health-tracks li{padding:4px 0 12px 8px;border-left:1px solid #e3ddd2;list-style:none}.health-tracks li>b{display:block;color:#202020}.health-tracks li>strong{font-weight:500}.track-feedback{padding:14px 0;border-top:1px solid #e6e9ee}.track-feedback h4{margin:0}.health-tracks footer{border-top:1px solid #edf0f4;padding-top:10px}.health-tracks footer button{margin-top:8px}@media(max-width:900px){.health-tracks header{flex-wrap:wrap}}
</style>
