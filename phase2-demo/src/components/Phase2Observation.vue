<template>
  <section class="p2-observation">
    <header><strong>修复观察结果</strong><span>{{automatic?`${records.filter(record=>record.auto).length} 个两小时汇总 · 连续完整覆盖 ${result.coveredHours||0} / ${target*24} 小时`:`${records.filter(record=>record.values).length} 条测量记录 · ${last?.day*24||0} / ${target*24} 小时`}}</span></header>
    <div class="observation-metrics"><span v-for="(name,i) in config.names" :key="name"><i :style="{background:colors[i]}"></i>{{ name }} <b>{{ latestValues?.[i] ?? '—' }}</b> {{ config.units[i] }}</span></div>
    <div ref="chartEl" class="observation-chart" role="img" :aria-label="'第'+roundView.round+'轮'+config.names.join('与')+'修复观察趋势'"></div>
    <div v-if="!automatic" class="observation-update"><span>{{last?.label||'等待修复观察记录'}}</span></div>
    <div class="observation-advice" :class="result.type"><strong>观察结论 · {{ result.title }}</strong><p>{{ result.text }}</p></div>
  </section>
</template>
<script setup>
import {computed,ref,onMounted,onUnmounted,watch,nextTick} from 'vue'
import * as echarts from 'echarts'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {observationConfig} from '@/mock/phase2Observation'
import {observationRoundViews} from '@/mock/observationRounds'
const props=defineProps({scenario:String,readOnly:Boolean,round:{type:Object,default:null}}),store=usePhase2DemoStore()
const roundView=computed(()=>props.round||observationRoundViews(store,props.scenario).at(-1))
const config=computed(()=>roundView.value.config||observationConfig[props.scenario]),records=computed(()=>roundView.value.records),last=computed(()=>records.value.at(-1)),target=computed(()=>roundView.value.target),result=computed(()=>roundView.value.result)
const chartEl=ref(null),colors=['#287ff0','#21a396'];let chart,observer
const latestMeasurement=computed(()=>records.value.findLast(record=>record.values))
const automatic=computed(()=>roundView.value.automatic)
const automaticWindows=computed(()=>[...records.value.filter(record=>record.auto),...(automatic.value?.pending?[automatic.value.pending]:[])])
const latestValues=computed(()=>automatic.value?automaticWindows.value.at(-1)?.values:latestMeasurement.value?.values)
function automaticPoints(index){return automaticWindows.value.flatMap(record=>{
 const channel=record.channels?.[index],end=Date.parse(record.windowEnd)
 if(!channel?.lastAt||!Number.isFinite(channel.value))return [[end,null]]
 const point=[Date.parse(channel.lastAt),channel.value]
 return !channel.covered&&point[0]<end?[point,[end,null]]:[point]
})}
function render(){
 if(!chart)return
 const c=config.value,before=automatic.value?null:roundView.value.before
 const sharedAxis=Boolean(automatic.value)&&new Set(c.units).size===1
 const units=sharedAxis?[c.units[0]]:c.units
 chart.setOption({animation:false,color:colors,tooltip:{trigger:'axis',confine:true},grid:{left:45,right:sharedAxis?22:48,top:25,bottom:35},
  xAxis:automatic.value?{type:'time',min:Date.parse(automatic.value.executedAt),splitNumber:6,minInterval:60000,axisLabel:{hideOverlap:true,fontSize:11,color:'#78889b',formatter:value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}}:{type:'category',data:[...(before?[roundView.value.beforeLabel]:[]),...records.value.map(r=>r.label)],axisTick:{show:false},axisLine:{lineStyle:{color:'#d8e2ee'}},axisLabel:{fontSize:11,color:'#78889b'}},
  yAxis:units.map((unit,i)=>({type:'value',name:unit,scale:!automatic.value,position:i?'right':'left',nameTextStyle:{color:sharedAxis?'#78889b':colors[i],fontSize:10},axisLabel:{fontSize:10,color:'#78889b'},splitLine:{show:!i,lineStyle:{color:'#edf1f6',type:'dashed'}}})),
  series:c.names.map((name,i)=>({name,type:'line',yAxisIndex:sharedAxis?0:i,data:automatic.value?automaticPoints(i):[...(before?[before[i]]:[]),...records.value.map(r=>r.values?.[i]??null)],connectNulls:false,symbolSize:6,smooth:false,lineStyle:{width:2.5}}))},true)
}
watch(roundView,()=>nextTick(render),{deep:true})
function resizeChart(){
 const element=chartEl.value
 if(!element?.clientWidth||!element.clientHeight)return
 if(!chart){chart=echarts.init(element);render()}else chart.resize()
}
onMounted(()=>{observer=new ResizeObserver(resizeChart);observer.observe(chartEl.value);resizeChart()})
onUnmounted(()=>{observer?.disconnect();chart?.dispose()})
</script>
<style scoped>
.observation-metrics{flex-wrap:wrap}.p2-observation header{flex-wrap:wrap}
.p2-observation{display:flex;flex-direction:column;flex:1;min-height:0;background:white;border:1px solid #e4eaf1;border-radius:8px;padding:16px 18px;overflow:auto}.p2-observation header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex:none;font-size:14px;color:#263a55}.p2-observation header>span,.p2-observation small{font-size:11px;color:#8491a2}.observation-metrics{display:flex;gap:22px;font-size:11px;color:#708098;margin-top:12px}.observation-metrics i{display:inline-block;width:12px;height:3px;margin-right:6px;vertical-align:middle}.observation-metrics b{font-size:15px;color:#34445b;margin-left:5px}.observation-chart{flex:1;min-height:140px}.observation-update{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:12px;color:#75849a}.observation-update button{font-size:12px;padding:7px 12px}.observation-records{border-top:1px solid #eaf0f6;padding-top:10px}.observation-records header button{padding:6px 10px;font-size:11px}.observation-row{display:grid;grid-template-columns:60px 1fr;gap:4px 12px;padding:8px 0;border-bottom:1px solid #edf1f6;font-size:11px;color:#62738a}.observation-row b{grid-row:span 2;color:#40536f}.observation-row em{font-style:normal;color:#26a186}.observation-row em.abnormal{color:#ce6060}.observation-row em.incomplete{color:#c18b35}.observation-advice{background:#f2f7ff;border-radius:6px;padding:10px 12px;margin-top:10px;color:#3e5574;font-size:12px;flex:none}.observation-advice.archive{background:#f1f9f5}.observation-advice.reinspect{background:#fff3f1}.observation-advice p{line-height:1.6;margin:5px 0}.observation-advice small{display:block;line-height:1.6}
</style>
