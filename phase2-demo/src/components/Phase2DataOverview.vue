<template>
  <section class="p2-data-overview"><BaselineTrend :scenario="observationParents[scenario]||scenario"/>
    <div class="p2-data-title"><strong>数据观测</strong><div v-if="sensors.length>3" class="p2-sensor-pages"><button :disabled="page===0" @click="page--" aria-label="上一组传感器">‹</button><span>{{ page+1 }} / {{ Math.ceil(sensors.length/3) }}</span><button :disabled="page>=Math.ceil(sensors.length/3)-1" @click="page++" aria-label="下一组传感器">›</button></div></div>
    <div class="p2-sensor-tabs" role="tablist" aria-label="监测参数">
      <button v-for="s in visibleSensors" :key="s.id" role="tab" :aria-selected="selected.includes(s.id)" :class="{active:selected.includes(s.id)}" @click="selectSensor(s.id)">
        <span class="p2-sensor-name"><span>{{ s.nameEn }}</span><i v-if="multi" :class="{checked:selected.includes(s.id)}">{{ selected.includes(s.id)?'✓':'' }}</i></span>
        <strong>{{ s.nameCn }}</strong><span class="p2-sensor-value">{{ s.value }} <small>{{ s.unit }}</small></span><small>{{ s.normalRange }}</small>
      </button>
    </div>
    <div class="p2-trend-panel">
      <div class="p2-trend-controls"><label class="p2-trend-switch"><input type="checkbox" v-model="multi" @change="changeMode" /><span></span>多选视图</label><div class="p2-time-tabs" role="group" aria-label="观测时间范围"><button v-for="range in ranges" :key="range" :aria-pressed="hours===range" :class="{active:hours===range}" @click="hours=range">{{ range }}H</button></div></div>
      <div class="p2-time-window"><span>{{ historical?.dataRole==='baseline-source-history'?'基线核实原始采样窗':historical?.dataRole==='source-event-history'?'来源事件时间窗':'观测时间窗' }}</span><time>{{ timeWindowLabel }}</time></div>
      <div class="p2-trend-legend"><span v-for="s in selectedSensors" :key="s.id"><i :style="{background:color(s.id)}"></i>{{ s.nameCn }} · {{ s.unit }}</span></div>
      <div ref="chartEl" class="p2-event-chart" aria-label="所选传感器时间趋势图" :data-range-hours="hours" :data-point-count="windowData.series.map(s=>s.count).join(',')"></div>
    </div>
  </section>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import BaselineTrend from './BaselineTrend.vue'
import {observationParents} from '@/mock/issueRelationships'
import * as echarts from 'echarts'
import { scenarioSensors } from '@/mock/phase2Content'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import {taskObservationData,taskObservationWindow,taskObservationRanges,normalizeObservationHours,observationTime,formatObservationTime} from '@/mock/taskObservationData'
const props=defineProps({scenario:{type:String,required:true},stage:{type:String,default:'event'}})
const store=usePhase2DemoStore(),historical=computed(()=>taskObservationData(props.scenario))
const sensors=computed(()=>historical.value?.sensors||scenarioSensors(props.scenario,props.stage))
const saved=store.dataViews[props.scenario]||{}
const page=ref(saved.page||0),multi=ref(Boolean(saved.multi)),selected=ref(saved.selected||[sensors.value[0]?.id]),hours=ref(normalizeObservationHours(saved.hours))
const visibleSensors=computed(()=>sensors.value.slice(page.value*3,page.value*3+3))
const selectedSensors=computed(()=>{const matches=sensors.value.filter(s=>selected.value.includes(s.id));return matches.length?matches:sensors.value.slice(0,1)})
const ranges=taskObservationRanges,palette=['#2384FF','#24A59A','#F5A648','#9475DE','#D46287','#71849A']
const dataEnd=computed(()=>historical.value?.end||Math.max(...sensors.value.flatMap(s=>s.trendData.map(p=>observationTime(p.time))).filter(Number.isFinite))||observationTime('2026-10-07 10:30:00'))
const windowData=computed(()=>{
 const end=Number.isFinite(dataEnd.value)?dataEnd.value:observationTime('2026-10-07 10:30:00')
 const input=selectedSensors.value.map(sensor=>({...sensor,trendData:sensor.trendData.map((point,index)=>Number.isFinite(observationTime(point.time))?point:{...point,time:formatObservationTime(end-(sensor.trendData.length-1-index)*(props.scenario==='fault'?3600000:(props.scenario==='maintenance'?168:72)*3600000/Math.max(1,sensor.trendData.length-1)))})}))
 return taskObservationWindow(input,end,hours.value)
})
const timeWindowLabel=computed(()=>formatObservationTime(windowData.value.start)+' — '+formatObservationTime(windowData.value.end))
const chartEl=ref(null);let chart=null,observer=null
function color(id){return palette[sensors.value.findIndex(s=>s.id===id)%palette.length]}
function selectSensor(id){if(!multi.value)selected.value=[id];else if(selected.value.includes(id)){if(selected.value.length>1)selected.value=selected.value.filter(value=>value!==id)}else selected.value.push(id)}
function changeMode(){if(!multi.value)selected.value=[selectedSensors.value[0]?.id]}
function render(){
 if(!chart)return
 const {start,end,series}=windowData.value,units=[...new Set(series.map(s=>s.unit))]
 chart.setOption({animation:false,color:series.map(s=>color(s.id)),grid:{left:54,right:Math.max(22,(units.length-1)*48),top:30,bottom:34},
  tooltip:{trigger:'axis',confine:true,axisPointer:{type:'line'},valueFormatter:value=>Number.isFinite(value)?String(value):'—'},
  xAxis:{type:'time',min:start,max:end,axisLine:{lineStyle:{color:'#DDE5F0'}},axisTick:{show:false},axisLabel:{color:'#8C96A6',fontSize:11,hideOverlap:true,formatter:value=>formatObservationTime(value).slice(11,16)},splitLine:{show:true,lineStyle:{color:'#EDF1F6',type:'dashed'}}},
  yAxis:units.map((unit,index)=>({type:'value',name:unit,scale:true,position:index===0?'left':'right',offset:index>1?(index-1)*45:0,axisLabel:{color:'#8C96A6',fontSize:10},nameTextStyle:{color:'#718095',fontSize:11},splitLine:{show:index===0,lineStyle:{color:'#E4EAF2',type:'dashed'}}})),
  series:series.map(s=>({name:s.nameCn,type:'line',yAxisIndex:units.indexOf(s.unit),smooth:false,connectNulls:false,showSymbol:false,lineStyle:{width:2.5},emphasis:{focus:'series'},data:s.data}))},true)
}
watch(()=>props.scenario,()=>{const previous=store.dataViews[props.scenario]||{};page.value=previous.page||0;multi.value=Boolean(previous.multi);selected.value=previous.selected||[sensors.value[0]?.id];hours.value=normalizeObservationHours(previous.hours)})
watch([windowData,multi],()=>nextTick(render),{deep:true})
onMounted(()=>{chart=echarts.init(chartEl.value);observer=new ResizeObserver(()=>chart?.resize());observer.observe(chartEl.value);render()})
onUnmounted(()=>{store.dataViews[props.scenario]={page:page.value,multi:multi.value,selected:[...selected.value],hours:hours.value};observer?.disconnect();chart?.dispose()})
</script>
<style scoped>
.p2-data-overview{display:flex;flex-direction:column;min-height:0;height:100%;gap:12px;padding:16px 18px;background:#fff;border:1px solid #e4e7ed;border-radius:8px}.p2-data-title{display:flex;justify-content:space-between;align-items:center;color:#19213d;font-size:16px}.p2-sensor-pages{display:flex;align-items:center;gap:9px;font-size:12px;color:#8791a0}.p2-sensor-pages button{width:30px;height:29px;border:1px solid #dfe5ee;background:white;border-radius:5px;color:#427dc5;cursor:pointer}.p2-sensor-pages button:disabled{opacity:.3}.p2-sensor-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.p2-sensor-tabs button{display:flex;flex-direction:column;gap:5px;min-width:0;border:1px solid #e4e7ed;border-radius:7px;background:#fff;padding:10px 12px;text-align:left;cursor:pointer;color:#19213d;font:inherit}.p2-sensor-tabs button.active{border-color:#106bff;background:#f6faff}.p2-sensor-name{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:#858d9c}.p2-sensor-name>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.p2-sensor-name i{font-style:normal;width:15px;height:15px;border:1px solid #cbd4df;border-radius:3px;flex:none;line-height:14px;text-align:center}.p2-sensor-name i.checked{background:#106bff;color:white;border-color:#106bff}.p2-sensor-tabs strong{font-size:13px;font-weight:600}.p2-sensor-value{font-size:19px;font-weight:600;color:#106bff}.p2-sensor-value small{font-size:11px}.p2-sensor-tabs button>small{font-size:10px;color:#8b94a2}.p2-trend-panel{display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid #e4e7ed;border-radius:7px;padding:12px}.p2-trend-controls{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.p2-trend-switch{display:flex;align-items:center;gap:7px;font-size:12px;color:#526077;cursor:pointer}.p2-trend-switch input{position:absolute;opacity:0;width:1px;height:1px}.p2-trend-switch>span{width:31px;height:18px;background:#cad2dc;border-radius:12px;position:relative}.p2-trend-switch>span:after{content:'';position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:white}.p2-trend-switch input:checked+span{background:#106bff}.p2-trend-switch input:checked+span:after{left:16px}.p2-trend-switch input:focus-visible+span{outline:2px solid #106bff;outline-offset:2px}.p2-time-tabs{display:flex;gap:4px}.p2-time-tabs button{border:1px solid #e2e7ee;background:white;border-radius:4px;padding:5px 8px;color:#6c788b;font-size:11px;cursor:pointer}.p2-time-tabs button.active{color:#106bff;background:#edf5ff;border-color:#106bff}.p2-trend-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:#738198;padding-top:12px}.p2-trend-legend span{display:flex;align-items:center;gap:5px}.p2-trend-legend i{width:14px;height:3px;border-radius:3px}.p2-event-chart{flex:1;min-height:150px}.p2-time-window{display:flex;gap:8px 12px;flex-wrap:wrap;padding-top:10px;color:#8b94a2;font-size:11px}.p2-time-window time{font-variant-numeric:tabular-nums;color:#64748b}
</style>
