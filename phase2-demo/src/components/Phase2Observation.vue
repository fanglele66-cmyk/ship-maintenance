<template>
  <section class="p2-observation">
    <header><strong>修复观察结果</strong><span v-if="store.cases[scenario]?.realCaseId">{{records.filter(record=>record.values).length}} 条测量记录</span><span v-else>第 {{ store.observationRounds[scenario] }} 轮 · {{ last?.day*24||0 }} / {{ target*24 }} 小时</span></header>
    <div class="observation-metrics"><span v-for="(name,i) in config.names" :key="name"><i :style="{background:colors[i]}"></i>{{ name }} <b>{{ latestMeasurement?.values?.[i] ?? '—' }}</b> {{ config.units[i] }}</span></div>
    <div ref="chartEl" class="observation-chart" role="img" :aria-label="config.names.join('与')+'处理前后每日观测趋势'"></div>
    <div class="observation-update"><span>{{ last?.label||'等待修复观察记录' }}</span></div>
    <div class="observation-advice" :class="result.type"><strong>观察结论 · {{ result.title }}</strong><p>{{ result.text }}</p><small>{{ config.basis }}</small></div>
  </section>
</template>
<script setup>
import {computed,ref,onMounted,onUnmounted,watch,nextTick} from 'vue'
import * as echarts from 'echarts'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {observationConfig} from '@/mock/phase2Observation'
const props=defineProps({scenario:String,readOnly:Boolean}),store=usePhase2DemoStore()
const config=computed(()=>observationConfig[props.scenario]),records=computed(()=>store.observationRecords[props.scenario]),last=computed(()=>records.value.at(-1)),target=computed(()=>store.observationTargets[props.scenario]),result=computed(()=>{
 const report=store.getObservationResult(props.scenario)
 return store.eventStatus[props.scenario]==='closed'?{...report,title:'本轮效果观察已闭环',text:report.text.replace('请结合现场情况确认是否闭环，观测达标不自动代替人工确认。','人工闭环确认已记录，本轮实际措施与观测依据可在设备动态回查。')}:report
})
const chartEl=ref(null),colors=['#287ff0','#21a396'];let chart,observer
const latestMeasurement=computed(()=>records.value.findLast(record=>record.values))
function render(){if(!chart)return;const c=config.value;chart.setOption({animation:false,color:colors,tooltip:{trigger:'axis',confine:true},grid:{left:45,right:48,top:25,bottom:25},xAxis:{type:'category',data:['处理前',...records.value.map(r=>r.label)],axisTick:{show:false},axisLine:{lineStyle:{color:'#d8e2ee'}},axisLabel:{fontSize:11,color:'#78889b'}},yAxis:c.units.map((unit,i)=>({type:'value',name:unit,scale:true,position:i?'right':'left',nameTextStyle:{color:colors[i],fontSize:10},axisLabel:{fontSize:10,color:'#78889b'},splitLine:{show:!i,lineStyle:{color:'#edf1f6',type:'dashed'}}})),series:c.names.map((name,i)=>({name,type:'line',yAxisIndex:i,data:[c.before[i],...records.value.map(r=>r.values?.[i]??null)],symbolSize:6,smooth:false,lineStyle:{width:2.5}}))},true)}
watch(records,()=>nextTick(render),{deep:true})
onMounted(()=>{chart=echarts.init(chartEl.value);observer=new ResizeObserver(()=>chart.resize());observer.observe(chartEl.value);render()})
onUnmounted(()=>{observer?.disconnect();chart?.dispose()})
</script>
<style scoped>
.p2-observation{display:flex;flex-direction:column;flex:1;min-height:0;background:white;border:1px solid #e4eaf1;border-radius:8px;padding:16px 18px;overflow:auto}.p2-observation header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex:none;font-size:14px;color:#263a55}.p2-observation header>span,.p2-observation small{font-size:11px;color:#8491a2}.observation-metrics{display:flex;gap:22px;font-size:11px;color:#708098;margin-top:12px}.observation-metrics i{display:inline-block;width:12px;height:3px;margin-right:6px;vertical-align:middle}.observation-metrics b{font-size:15px;color:#34445b;margin-left:5px}.observation-chart{flex:1;min-height:140px}.observation-update{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:12px;color:#75849a}.observation-update button{font-size:12px;padding:7px 12px}.observation-records{border-top:1px solid #eaf0f6;padding-top:10px}.observation-records header button{padding:6px 10px;font-size:11px}.observation-row{display:grid;grid-template-columns:60px 1fr;gap:4px 12px;padding:8px 0;border-bottom:1px solid #edf1f6;font-size:11px;color:#62738a}.observation-row b{grid-row:span 2;color:#40536f}.observation-row em{font-style:normal;color:#26a186}.observation-row em.abnormal{color:#ce6060}.observation-row em.incomplete{color:#c18b35}.observation-advice{background:#f2f7ff;border-radius:6px;padding:10px 12px;margin-top:10px;color:#3e5574;font-size:12px;flex:none}.observation-advice.archive{background:#f1f9f5}.observation-advice.reinspect{background:#fff3f1}.observation-advice p{line-height:1.6;margin:5px 0}.observation-advice small{display:block;line-height:1.6}
</style>
