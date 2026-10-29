<template>
 <section class="lc-effect-observation">
  <header><h2>处理后效果观察</h2><span>{{task.observationEndedAt?'本轮观察已留存':'自动观察中'}}</span></header>
  <div class="lc-effect-meta"><span>第{{task.round}}轮{{task.kind==='maintenance'?'维保':'维修'}} · {{task.owner}}</span><span>开始：{{timeText(task.submittedAt)}}<template v-if="!task.observationEndedAt"> · 下次汇总：{{timeText(observation?.nextUpdateAt)}}</template></span></div>
  <div class="lc-effect-metrics"><span v-for="(name,i) in config.names" :key="name"><i :style="{background:colors[i]}"/>{{name}} <b>{{windows.at(-1)?.values?.[i]??'—'}}</b> {{config.units[i]}}</span></div>
  <div ref="chartEl" class="lc-effect-chart" role="img" :aria-label="'第'+task.round+'轮处理后传感器观测趋势'"/>
  <p v-if="!windows.some(w=>w.sampleCount)" class="lc-effect-status">等待处理后首批采样，已提交的作业报告可在“阶段报告”中查看。</p>
  <p v-else class="lc-effect-status">已保留 {{observation?.records.length||0}} 个两小时观察窗口。{{missingNames.length?'未取得：'+missingNames.join('、')+'。':''}}结合运行工况、原异常与现场复测记录判断处理效果。</p>
  <details v-if="windows.length" class="lc-effect-records"><summary>观察记录 · {{windows.length}} 个窗口</summary><div v-for="window in windows" :key="window.id"><time>{{timeText(window.windowStart)}} — {{timeText(window.windowEnd)}}</time><p>{{config.names.map((name,i)=>name+' '+(window.values[i]??'未取得')+' '+config.units[i]).join('；')}}</p><small>{{window.complete?'已汇总':'当前窗口'}} · {{window.sampleCount}} 条采样{{window.complete&&!window.covered?' · 存在未覆盖时段':''}}</small></div></details>
 </section>
</template>
<script setup>
import {computed,ref,watch,onMounted,onUnmounted,nextTick} from 'vue'
import * as echarts from 'echarts'
import {timeText} from '../workflow/eventLifecycle'
import {observationSettings} from '../workflow/lifecycleObservation'
const props=defineProps({event:{type:Object,required:true},task:{type:Object,required:true}})
const observation=computed(()=>props.task.observation),config=computed(()=>observationSettings(props.event)||{names:[],units:[]})
const windows=computed(()=>[...(observation.value?.records||[]),...(observation.value?.pending?[observation.value.pending]:[])])
const missingNames=computed(()=>config.value.names.filter((name,i)=>!Number.isFinite(windows.value.at(-1)?.values?.[i])))
const chartEl=ref(),colors=['#3985e9','#29a59d'];let chart,observer
function render(){
 if(!chart)return
 const units=[...new Set(config.value.units)]
 chart.setOption({animation:false,color:colors,tooltip:{trigger:'axis',confine:true},grid:{left:45,right:units.length>1?45:20,top:25,bottom:30},xAxis:{type:'time',min:Date.parse(props.task.submittedAt),axisLabel:{fontSize:10,hideOverlap:true,formatter:value=>new Date(value).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',...((Date.parse(observation.value?.checkedAt)-Date.parse(props.task.submittedAt))<600000?{second:'2-digit'}:{}),hour12:false})},splitNumber:5},yAxis:units.map((unit,i)=>({type:'value',name:unit,position:i?'right':'left',axisLabel:{fontSize:10},splitLine:{show:!i,lineStyle:{color:'#edf1f6',type:'dashed'}}})),series:config.value.names.map((name,i)=>({name,type:'line',yAxisIndex:units.indexOf(config.value.units[i]),connectNulls:false,symbolSize:6,data:windows.value.flatMap(w=>{const c=w.channels?.[i],end=Date.parse(w.windowEnd);if(!c?.lastAt||!Number.isFinite(c.value))return [[end,null]];const point=[Date.parse(c.lastAt),c.value];return !c.covered&&point[0]<end?[point,[end,null]]:[point]})}))},true)
}
onMounted(()=>{chart=echarts.init(chartEl.value,null,{renderer:'svg'});render();observer=new ResizeObserver(()=>chart?.resize());observer.observe(chartEl.value)})
watch(windows,()=>nextTick(render),{deep:true})
onUnmounted(()=>{observer?.disconnect();chart?.dispose()})
</script>
<style scoped>
.lc-effect-observation{border:1px solid #e2e9f1;border-radius:7px;padding:14px 16px}.lc-effect-observation>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.lc-effect-observation h2{margin:0!important;font-size:19px}.lc-effect-observation header>span{font-size:12px;color:#9b7a43}.lc-effect-meta{display:flex;gap:8px 20px;flex-wrap:wrap;margin:10px 0;color:#8493a5;font-size:12px}.lc-effect-metrics{display:flex;gap:10px 22px;flex-wrap:wrap;font-size:12px;color:#72859b}.lc-effect-metrics i{display:inline-block;width:10px;height:3px;vertical-align:middle;margin-right:6px}.lc-effect-metrics b{color:#334d68;font-size:15px;margin-left:5px}.lc-effect-chart{height:205px;width:100%}.lc-effect-status{font-size:12px;line-height:1.6!important;color:#7b8c9f;margin:8px 0 0!important}.lc-effect-records{font-size:12px;color:#647a91;margin-top:12px}.lc-effect-records summary{cursor:pointer;color:#997941}.lc-effect-records>div{padding:10px 0;border-top:1px solid #edf1f5}.lc-effect-records p{margin:4px 0}.lc-effect-records small{color:#8998aa}
</style>
