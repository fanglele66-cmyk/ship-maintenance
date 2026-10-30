<template>
 <section class="lc-effect-observation">
  <header><h2>{{verification?'核实后继续观察':'处理后效果观察'}}</h2><span>{{task.observationEndedAt?'本轮观察已留存':'自动采样中'}}</span></header>
  <div class="lc-effect-meta"><span>第{{task.round}}轮{{verification?'排查':task.kind==='maintenance'?'维保':'维修'}} · {{task.owner}}</span><span>开始：{{timeText(observationStart(task))}}<template v-if="!task.observationEndedAt"> · 下次汇总：{{timeText(observation?.nextUpdateAt)}}</template></span></div>
  <p class="lc-effect-condition" :class="{pending:!observation?.conditions?.eligible}"><strong>观察条件 · {{policy.label}}一个周期</strong><br/>{{observation?.conditions?.reason||'等待传感器与运行工况记录。'}}</p><div class="lc-effect-metrics"><span v-for="(name,i) in config.names" :key="name"><i :style="{background:colors[i]}"/>{{name}} <b>{{windows.at(-1)?.values?.[i]??'—'}}</b> {{config.units[i]}}</span></div>
  <div ref="chartEl" class="lc-effect-chart" role="img" :aria-label="'第'+task.round+(verification?'轮核实后':'轮处理后')+'传感器观测趋势'"/>
  <p v-if="!windows.some(w=>w.sampleCount)" class="lc-effect-status">{{verification?'等待核实后首批采样，已提交的排查报告可在“阶段报告”中查看。':'等待处理后首批采样，已提交的作业报告可在“阶段报告”中查看。'}}</p>
  <p v-else class="lc-effect-status">已保留 {{observation?.records.length||0}} 个{{policy.label}}观察窗口。{{missingNames.length?'未取得：'+missingNames.join('、')+'。':''}}{{verification?'本轮暂未处置，结合现场核实记录判断变化是否持续、扩大、恢复或复发。':'结合运行工况、原异常与现场复测记录判断处理效果。'}}</p>
  <details v-if="windows.length" class="lc-effect-records"><summary>观察记录 · {{windows.length}} 个窗口</summary><div v-for="window in windows" :key="window.id"><time>{{timeText(window.windowStart)}} — {{timeText(window.windowEnd)}}</time><p>{{config.names.map((name,i)=>name+' '+(window.values[i]??'未取得')+' '+config.units[i]).join('；')}}</p><small>{{window.complete?'已汇总':'当前窗口'}} · {{window.sampleCount}} 条采样{{window.complete&&!window.covered?' · 存在未覆盖时段':''}}</small></div></details>
  <details v-if="task.observationHistory?.length" class="lc-effect-records"><summary>周期调整前的观察记录</summary><template v-for="history in task.observationHistory" :key="history.changedAt"><div v-for="record in history.records" :key="record.id"><time>{{timeText(record.windowStart)}} — {{timeText(record.windowEnd)}}</time><p>{{record.channels?.map(c=>c.name+' '+(c.value??'未取得')+' '+c.unit).join('；')}}</p><small>原周期 {{history.intervalMs/3600000}} 小时 · 保留原始记录，不计作完整的一周观察窗口</small></div></template></details>
 </section>
</template>
<script setup>
import {computed,ref,watch,onMounted,onUnmounted,onActivated,onDeactivated,nextTick} from 'vue'
import * as echarts from 'echarts'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {timeText} from '../workflow/eventLifecycle'
import {observationSettings} from '../workflow/lifecycleObservation'
import {observationStart,isVerificationObservation,observationPolicy} from '../workflow/observationContext'
const props=defineProps({event:{type:Object,required:true},task:{type:Object,required:true}})
const policy=computed(()=>observationPolicy(props.event))
const verification=computed(()=>isVerificationObservation(props.task))
const observation=computed(()=>props.task.observation),config=computed(()=>observationSettings(props.event)||{names:[],units:[]})
const windows=computed(()=>[...(observation.value?.records||[]),...(observation.value?.pending?[observation.value.pending]:[])])
const missingNames=computed(()=>config.value.names.filter((name,i)=>!Number.isFinite(windows.value.at(-1)?.values?.[i])))
const store=useEventLifecycleStore(),chartEl=ref(),colors=['#3985e9','#29a59d'];let chart,observer,timer
const samples=computed(()=>observation.value?.samples||[])
function startSampling(){clearInterval(timer);store.refreshObservations();timer=setInterval(()=>store.refreshObservations(),2000)}
function stopSampling(){clearInterval(timer)}
function render(){
 if(!chart)return
 const units=[...new Set(config.value.units)],start=Math.max(Date.parse(observationStart(props.task)),samples.value[0]?.[0]?.timestamp||0),end=Date.parse(observation.value?.checkedAt)||Date.now()
 const span=Math.max(120000,Math.ceil((end-start)/120000)*120000)
 chart.setOption({animation:false,color:colors,tooltip:{trigger:'axis',confine:true},grid:{left:45,right:units.length>1?45:20,top:25,bottom:30},xAxis:{type:'time',min:start,max:start+span,axisLabel:{fontSize:10,hideOverlap:true,formatter:value=>props.event.tracking?new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}):new Date(value).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',...((Date.parse(observation.value?.checkedAt)-Date.parse(observationStart(props.task)))<600000?{second:'2-digit'}:{}),hour12:false})},splitNumber:5},yAxis:units.map((unit,i)=>({type:'value',name:unit,position:i?'right':'left',axisLabel:{fontSize:10},splitLine:{show:!i,lineStyle:{color:'#edf1f6',type:'dashed'}}})),series:config.value.names.map((name,i)=>({name,type:'line',yAxisIndex:units.indexOf(config.value.units[i]),connectNulls:false,showSymbol:false,symbolSize:5,data:samples.value[i]?.length?samples.value[i].map(p=>[p.timestamp,p.value]):windows.value.flatMap(w=>{const c=w.channels?.[i],end=Date.parse(w.windowEnd);if(!c?.lastAt||!Number.isFinite(c.value))return [[end,null]];const point=[Date.parse(c.lastAt),c.value];return !c.covered&&point[0]<end?[point,[end,null]]:[point]})}))},true)
}
onMounted(()=>{startSampling();chart=echarts.init(chartEl.value,null,{renderer:'svg'});render();observer=new ResizeObserver(()=>chart?.resize());observer.observe(chartEl.value)})
watch(()=>observation.value,()=>nextTick(render),{deep:true})
onActivated(()=>{startSampling();nextTick(()=>chart?.resize())})
onDeactivated(stopSampling)
onUnmounted(()=>{stopSampling();observer?.disconnect();chart?.dispose()})
</script>
<style scoped>
.lc-effect-condition{font-size:12px;line-height:1.7;padding:10px 12px;background:#f4f8f7;border-radius:6px;color:#45645b}.lc-effect-condition.pending{background:#fff8ec;color:#8b693b}

.lc-effect-observation{border:1px solid #e2e9f1;border-radius:7px;padding:14px 16px}.lc-effect-observation>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.lc-effect-observation h2{margin:0!important;font-size:19px}.lc-effect-observation header>span{font-size:12px;color:#9b7a43}.lc-effect-meta{display:flex;gap:8px 20px;flex-wrap:wrap;margin:10px 0;color:#8493a5;font-size:12px}.lc-effect-metrics{display:flex;gap:10px 22px;flex-wrap:wrap;font-size:12px;color:#72859b}.lc-effect-metrics i{display:inline-block;width:10px;height:3px;vertical-align:middle;margin-right:6px}.lc-effect-metrics b{color:#334d68;font-size:15px;margin-left:5px}.lc-effect-chart{height:205px;width:100%}.lc-effect-status{font-size:12px;line-height:1.6!important;color:#7b8c9f;margin:8px 0 0!important}.lc-effect-records{font-size:12px;color:#647a91;margin-top:12px}.lc-effect-records summary{cursor:pointer;color:#997941}.lc-effect-records>div{padding:10px 0;border-top:1px solid #edf1f5}.lc-effect-records p{margin:4px 0}.lc-effect-records small{color:#8998aa}
</style>
