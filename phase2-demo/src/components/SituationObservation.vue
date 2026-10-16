<template>
  <div class="p2-situation-observation">
    <div class="p2-attention-detail-head"><button class="p2-link-button" type="button" @click="$emit('back')">← 返回异动跟踪</button><span class="p2-attention-status" :class="result.type==='archive'?'ended':result.type==='reinspect'?'human':'ai'">{{ result.type==='archive'?'观察已结束':result.type==='reinspect'?'需人工复查':'AI 效果观察' }}</span></div>
    <h3 class="p2-attention-detail-title">{{ title }}</h3>
    <p class="p2-report-meta">来源事件 {{ store.caseMaterials[scenario]?.sourceId }} · <button class="p2-link-button" type="button" @click="openEvent">回看人工处理记录 →</button></p>
    <p v-if="store.eventStatus[scenario]==='closed'" class="p2-pad-conclusion">本轮已人工确认闭环，观察与实际措施保留。</p>
    <InquiryMessage v-if="!store.executionObservationReady(scenario)" :message="supplementForm" @submit-inquiry="submitSupplement"/>
    <nav class="p2-observation-tabs" aria-label="效果观察内容"><button v-for="tab in ['今日观测','观察时间线']" :key="tab" type="button" :class="{active:activeTab===tab}" @click="activeTab=tab">{{ tab }}</button></nav>
    <Phase2Observation v-if="activeTab==='今日观测'&&store.executionObservationReady(scenario)" :scenario="scenario" />
    <section v-else class="p2-observation-timeline">
      <div class="p2-section-title">每日效果记录 · 第 {{ store.observationRounds[scenario] }} 轮</div>
      <div v-for="(record,index) in store.observationRecords[scenario]" :key="index" class="p2-observation-record"><b>{{ record.label }}</b><p>{{ recordText(record) }}</p><p>{{ record.note }}</p></div>
      <template v-for="round in store.observationHistory[scenario]" :key="round.round"><div class="p2-section-title">第 {{ round.round }} 轮 · 已返回现场复查</div><div v-for="(record,index) in round.records" :key="index" class="p2-observation-record"><b>{{ record.label }}</b><p>{{ recordText(record) }}；{{ record.note }}</p></div></template>
    </section>
    <div v-if="result.type==='reinspect'||result.type==='extend'" class="p2-observation-actions"><button v-if="result.type==='reinspect'" class="p2-primary" type="button" @click="reinspect">确认{{ scenario==='maintenance'?'重新检查':'重新排查' }} →</button><button v-else class="p2-primary" type="button" @click="store.extendObservation(scenario)">按建议延长跟踪24小时 →</button></div>
    <div v-else-if="store.executionObservationReady(scenario)&&store.eventStatus[scenario]!=='closed'" class="p2-observation-actions"><button v-if="result.type==='continue'" class="p2-secondary" @click="store.reviewObservation(scenario)">查看后续可比观测节点</button><button v-if="result.type==='archive'" class="p2-primary" @click="store.completeObservation(scenario)">确认闭环并归档</button></div>
    <InquiryMessage v-if="store.executionObservationReady(scenario)&&store.eventStatus[scenario]!=='closed'" :message="phenomenonForm" @submit-inquiry="submitPhenomenon"/>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { observationConfig } from '@/mock/phase2Observation'
import Phase2Observation from '@/components/Phase2Observation.vue'
import AttentionAction from '@/components/AttentionAction.vue'
import InquiryMessage from '@/components/messages/InquiryMessage.vue'
const props=defineProps({scenario:String})
defineEmits(['back'])
const store=usePhase2DemoStore(),router=useRouter(),activeTab=ref('今日观测')
const result=computed(()=>store.getObservationResult(props.scenario))
const title=computed(()=>store.cases[props.scenario]?.stages.find(stage=>stage.kind==='observe')?.title||'处理后效果观察')
const supplementError=ref('')
const supplementForm=computed(()=>({id:'observation-supplement-'+props.scenario,status:'pending',text:'补充处理后可比记录',hint:'填写实际已取得的测点与工况，当前缺少数据不作改善判断。',submitError:supplementError.value,fields:[...observationConfig[props.scenario].names.map((name,i)=>({key:'value'+i,label:name+'（'+observationConfig[props.scenario].units[i]+'）',type:'number',required:true})),{key:'conditions',label:'可比工况与测量时间',type:'text',required:true},{key:'note',label:'记录来源与说明',type:'textarea',required:true}],values:{},submitLabel:'保存可比记录'}))
const phenomenonForm=computed(()=>({id:'observation-phenomenon-'+props.scenario,status:'pending',text:'补充观察中的现场情况',fields:[{key:'status',label:'情况',type:'select',required:true,options:[{value:'abnormal',label:'原异常复现'},{value:'incomplete',label:'数据不足或不可比'}]},{key:'note',label:'实际现象与时间',type:'textarea',required:true}],values:{},submitLabel:'保存并更新判断'}))
function submitSupplement(payload){supplementError.value=store.supplementObservation(props.scenario,payload.values)?'':'请核对记录内容与当前任务状态。'}
function submitPhenomenon(payload){store.recordObservationEvidence(props.scenario,payload.values.status,payload.values.note)}
function recordText(record){return record.values?record.values.map((value,index)=>observationConfig[props.scenario].names[index]+' '+value+' '+observationConfig[props.scenario].units[index]).join(' · '):'待补齐同工况记录'}
function openEvent(){store.selectTodo(props.scenario);router.push({path:'/event',query:{todo:props.scenario}})}
function reinspect(){store.reopenTodo(props.scenario);openEvent()}
</script>
