<template>
  <div class="p2-situation-observation">
    <div class="p2-attention-detail-head"><button class="p2-link-button" type="button" @click="$emit('back')">← 返回关注事项</button><span class="p2-attention-status" :class="result.type==='archive'?'ended':result.type==='reinspect'?'human':'ai'">{{ result.type==='archive'?'观察已结束':result.type==='reinspect'?'需人工复查':'AI 效果观察' }}</span></div>
    <h3 class="p2-attention-detail-title">{{ title }}</h3>
    <p class="p2-report-meta">来源事件 {{ store.caseMaterials[scenario]?.sourceId }} · <button class="p2-link-button" type="button" @click="openEvent">回看人工处理记录 →</button></p>
    <nav class="p2-observation-tabs" aria-label="效果观察内容"><button v-for="tab in ['今日观测','观察时间线']" :key="tab" type="button" :class="{active:activeTab===tab}" @click="activeTab=tab">{{ tab }}</button></nav>
    <Phase2Observation v-if="activeTab==='今日观测'" :scenario="scenario" />
    <section v-else class="p2-observation-timeline">
      <div class="p2-section-title">每日效果记录 · 第 {{ store.observationRounds[scenario] }} 轮</div>
      <div v-for="(record,index) in store.observationRecords[scenario]" :key="index" class="p2-observation-record"><b>{{ record.label }}</b><p>{{ recordText(record) }}</p><p>{{ record.note }}</p></div>
      <template v-for="round in store.observationHistory[scenario]" :key="round.round"><div class="p2-section-title">第 {{ round.round }} 轮 · 已返回现场复查</div><div v-for="(record,index) in round.records" :key="index" class="p2-observation-record"><b>{{ record.label }}</b><p>{{ recordText(record) }}；{{ record.note }}</p></div></template>
    </section>
    <div v-if="result.type==='reinspect'||result.type==='extend'" class="p2-observation-actions"><button v-if="result.type==='reinspect'" class="p2-primary" type="button" @click="reinspect">确认{{ scenario==='maintenance'?'重新检查':'重新排查' }} →</button><button v-else class="p2-primary" type="button" @click="store.extendObservation(scenario)">按建议延长跟踪24小时 →</button></div>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { observationConfig } from '@/mock/phase2Observation'
import Phase2Observation from '@/components/Phase2Observation.vue'
const props=defineProps({scenario:String})
defineEmits(['back'])
const store=usePhase2DemoStore(),router=useRouter(),activeTab=ref('今日观测')
const result=computed(()=>store.getObservationResult(props.scenario))
const title=computed(()=>props.scenario==='fault'?'冷却系统处理后效果观察':props.scenario==='maintenance'?'1#缸轴承保养后效果观察':'3#缸排温处理后效果观察')
function recordText(record){return record.values?record.values.map((value,index)=>observationConfig[props.scenario].names[index]+' '+value+' '+observationConfig[props.scenario].units[index]).join(' · '):'待补齐同工况记录'}
function openEvent(){store.selectTodo(props.scenario);router.push('/event')}
function reinspect(){store.reopenTodo(props.scenario);openEvent()}
</script>
