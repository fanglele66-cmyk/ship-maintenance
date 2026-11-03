<template>
 <section class="initial-information">
  <dl class="initial-source"><div><dt>来源</dt><dd>{{brief.discovery?.label||'原始事件资料'}}</dd></div><div><dt>发现时间</dt><dd>{{brief.discovery?.at||event.createdAt||'未记录'}}</dd></div><div><dt>数据窗口</dt><dd>{{times.dataWindow}}</dd></div><div><dt>AI 生成时间</dt><dd>{{times.generatedAt}}</dd></div></dl>
  <details open><summary>AI 分析与依据</summary><EventDecisionBrief :brief="brief" :event-type="event.type" :show-decisions="false"/><h3>关键数据</h3><div class="lc-fact-grid"><div v-for="fact in brief.facts" :key="fact.label"><small>{{fact.label}}</small><b>{{fact.value}} {{fact.unit}}</b><p>{{fact.meaning}}</p></div></div></details>
  <section><h3>建议安排</h3><ol><li v-for="task in brief.tasks" :key="task.title"><strong>{{task.title}}</strong>：{{task.detail}}</li></ol><p>{{brief.boundary}}</p></section>
 </section>
</template>
<script setup>import {computed} from 'vue';import EventDecisionBrief from './EventDecisionBrief.vue';import {initialInformationTimes} from '../workflow/initialInformationTimes.js';const props=defineProps({event:Object});const brief=computed(()=>props.event.brief||{}),times=computed(()=>initialInformationTimes(props.event))</script>
<style scoped>.initial-source{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:8px 0 16px;margin-top:0;border-bottom:1px solid #e2e7ec}.initial-source dt{color:#687887;font-size:13px;margin-bottom:4px}.initial-source dd{margin:0}.initial-information>details{margin:24px 0}.initial-information summary{font-size:18px;font-weight:600;cursor:pointer}.initial-information li{margin:12px 0;line-height:1.75}@media(max-width:760px){.initial-source{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.initial-source{grid-template-columns:1fr}}</style>
