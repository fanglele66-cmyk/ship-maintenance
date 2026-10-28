<template><main class="lc-report-page"><header><button @click="router.push({path:'/situation',query:{view:'reports'}})">← 返回首页报告</button><span>{{report?.kind||'报告'}}</span></header><article v-if="report"><LifecycleReport :report="report"/></article><article v-else-if="!route.params.reportId"><h1>报告</h1><div v-for="r in [dailyReport,...store.reports]" :key="r.id" class="lc-board-row"><div><small>{{r.kind}}</small><h3>{{r.title}}</h3></div><button @click="router.push('/reports/'+r.id)">查看详情 →</button></div></article><p v-else>该报告不存在，或当前身份无权查看。</p></main></template>
<script setup>
import {computed} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {useSensorStore} from '../stores/sensorStore'
import {navigationChronology} from '../workflow/navigationChronology'
import LifecycleReport from '../components/LifecycleReport.vue'
const route=useRoute(),router=useRouter(),store=useEventLifecycleStore(),sensors=useSensorStore()
const dailyReport=computed(()=>({id:'navigation-24h',kind:'工况报告',at:new Date(sensors.sampledAt).toISOString(),title:'长航碧玉 · 24小时工况态势报告',markdown:navigationChronology(sensors,Math.floor(sensors.sampledAt/3600000)*3600000).markdown}))
const report=computed(()=>route.params.reportId==='navigation-24h'?dailyReport.value:store.reports.find(r=>r.id===route.params.reportId))
</script>
