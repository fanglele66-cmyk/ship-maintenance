<template>
 <section class="sensor-charts" aria-label="关联传感器趋势">
  <nav class="chart-tabs" role="tablist" aria-label="观察曲线分组">
   <button v-for="group in groups" :key="group.id" :id="'chart-tab-'+group.id" type="button" role="tab" :aria-selected="current?.id===group.id" :tabindex="current?.id===group.id?0:-1" aria-controls="observation-chart-panel" @click="selected=group.id" @keydown="moveTab($event,group.id)">{{group.title}}<small>{{group.channels.length}}</small></button>
  </nav>
  <div v-if="current" id="observation-chart-panel" role="tabpanel" :aria-labelledby="'chart-tab-'+current.id">
   <div v-show="hasData" ref="chartEl" class="sensor-chart" role="img" :aria-label="current.title+'观测曲线'"/>
   <p v-if="!hasData" class="chart-empty">{{pending?'观察窗口结束后显示本轮测点曲线。':'本组暂无有效观测采样。'}}</p>
   <div v-if="hasData" class="reading-summary"><span v-for="channel in current.channels" :key="channel.id">{{channel.name}} <strong>{{channel.value??'—'}}</strong> {{channel.unit}}</span></div>
   <p class="chart-hint">点击图例可显示或隐藏曲线；拖动下方滑块查看局部时段。{{current.id==='operating'?'转速与燃油指令分别使用左右坐标轴。':''}}</p>
  </div>
 </section>
</template>
<script setup>
import {computed,ref,watch,nextTick,onMounted,onUnmounted,onActivated} from 'vue'
import * as echarts from 'echarts'
import {observationChartGroups,observationChartOption} from '../workflow/observationChartGroups.js'
const props=defineProps({points:{type:Array,default:()=>[]},readings:{type:Array,default:()=>[]},start:String,end:String,pending:Boolean})
const groups=computed(()=>observationChartGroups(props.points,props.readings)),selected=ref(''),current=computed(()=>groups.value.find(g=>g.id===selected.value)||groups.value[0])
const option=computed(()=>current.value?observationChartOption(current.value,props.start,props.end):null)
const hasData=computed(()=>option.value?.series.some(s=>s.data.some(p=>p[1]!==null))),chartEl=ref(null)
let chart,observer
function render(){if(!chartEl.value||!option.value||!hasData.value)return;if(!chart)chart=echarts.init(chartEl.value,null,{renderer:'svg'});chart.resize();chart.setOption(option.value,true)}
async function moveTab(event,id){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=event.currentTarget.parentElement,index=groups.value.findIndex(g=>g.id===id),n=groups.value.length;selected.value=groups.value[event.key==='Home'?0:event.key==='End'?n-1:(index+(event.key==='ArrowRight'?1:-1)+n)%n].id;await nextTick();tabs?.querySelector('[aria-selected="true"]')?.focus()}
onMounted(()=>{render();observer=new ResizeObserver(()=>chart?.resize());if(chartEl.value)observer.observe(chartEl.value)})
watch([current,()=>props.start,()=>props.end],()=>nextTick(render),{deep:true})
onActivated(()=>nextTick(render))
onUnmounted(()=>{observer?.disconnect();chart?.dispose()})
</script>
<style scoped>
.chart-tabs{display:flex;gap:26px;flex-wrap:wrap;border-bottom:1px solid #e4eaf0;margin-bottom:18px}.sensor-charts .chart-tabs button[role=tab]{position:relative;border:0;border-bottom:2px solid transparent;background:transparent;color:#7b8c9c;border-radius:0;margin-bottom:-1px;padding:11px 1px;font:inherit;font-size:12px;cursor:pointer}.sensor-charts .chart-tabs button[role=tab][aria-selected=true]{border-bottom-color:#b3955c;color:#92703c;font-weight:600}.sensor-charts .chart-tabs button[role=tab]:hover{background:transparent;color:#92703c}.chart-tabs small{margin-left:7px;font-weight:400;color:#9aa6b1}.sensor-charts .chart-tabs button[role=tab]:focus-visible{outline:2px solid #b3955c;outline-offset:3px}.sensor-chart{height:340px;width:100%;min-width:0}.reading-summary{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:12px;color:#708397;margin:10px 0}.reading-summary strong{color:#41586d}.chart-hint,.chart-empty{font-size:12px;color:#8796a4;line-height:1.8}.chart-empty{padding:60px 20px;background:#f7f9fb;text-align:center;border-radius:6px}
</style>
