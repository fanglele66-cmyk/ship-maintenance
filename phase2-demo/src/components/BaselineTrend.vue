<template>
 <section v-if="cylinder" class="baseline-trend" aria-label="月度基线对比">
  <header><div><small>长期健康趋势 · 2026 年</small><h3>{{cylinder===1?'一缸排温相对基线':'四缸排温相对基线'}}</h3></div><span>8 个月 · {{total.toLocaleString()}} 条配对采样</span></header>
  <p class="baseline-condition">{{history.source.condition}}</p>
  <div class="baseline-controls">
   <label>比较指标 <select v-model="metric" aria-label="比较指标"><option value="deltaPeers">相对其余五缸均值</option><option value="deltaMax">相对其余五缸逐时最高值</option><option value="mean">本缸排温均值</option></select></label>
   <label>参考月份 <select v-model="reference" aria-label="参考月份"><option v-for="m in months" :key="m.month" :value="m.month">{{m.month}}</option></select></label>
   <label>对比月份 <select v-model="current" aria-label="对比月份"><option v-for="m in months" :key="m.month" :value="m.month">{{m.month}}</option></select></label>
  </div>
  <div class="baseline-comparison">
   <div><small>{{reference}} · 参考</small><strong>{{format(value(reference))}} <em>°C</em></strong><span>{{month(reference).count.toLocaleString()}} 条</span></div>
   <div><small>{{current}} · 对比</small><strong>{{format(value(current))}} <em>°C</em></strong><span>{{month(current).count.toLocaleString()}} 条</span></div>
   <div><small>较参考月份变化</small><strong>{{signed(value(current)-value(reference))}} <em>°C</em></strong><span>{{metric==='mean'?'绝对温度均值变化':'缸间相对偏差变化'}}</span></div>
  </div>
  <svg class="baseline-chart" viewBox="0 0 900 230" role="img" :aria-label="`${cylinder}缸${metricLabel}月度曲线`">
   <text x="12" y="15" class="axis-label">°C</text>
   <g v-for="tick in ticks" :key="tick"><line x1="58" x2="858" :y1="y(tick)" :y2="y(tick)" :class="{zero:tick===0}"/><text x="46" :y="y(tick)+4" text-anchor="end" class="axis-label">{{tick.toFixed(0)}}</text></g>
   <polyline :points="points" fill="none" stroke="#aa843e" stroke-width="2.6"/>
   <g v-for="(m,index) in months" :key="m.month"><circle :cx="x(index)" :cy="y(value(m.month))" :r="m.month===current?6:4" :fill="m.month===current?'#244d69':'#aa843e'"><title>{{m.month}}：{{format(value(m.month))}}°C，{{m.count}}条；{{m.first}}—{{m.last}}</title></circle><text :x="x(index)" :y="y(value(m.month))-13" text-anchor="middle" class="point-label">{{format(value(m.month))}}</text><text :x="x(index)" y="217" text-anchor="middle" class="axis-label">{{Number(m.month.slice(-2))}} 月</text></g>
  </svg>
  <div class="baseline-coverage"><span>参考月覆盖：{{month(reference).first.slice(5)}} — {{month(reference).last.slice(5)}}</span><span>对比月覆盖：{{month(current).first.slice(5)}} — {{month(current).last.slice(5)}}</span></div>
  <p class="baseline-caption">{{metric==='deltaMax'?'先按每个时刻计算本缸与其他五缸最高值的差，再按月平均。':metric==='deltaPeers'?'先按每个时刻计算本缸与其他五缸均值的差，再按月平均。':'筛选后本缸原始排温的月度样本均值。'}} 各月样本等权，不插值；8 月有效数据截至 08-07，非整月结果。</p>
  <details><summary>统计范围与可比条件</summary><p>检索时间：{{history.source.requestedStart}} — {{history.source.requestedEnd}}。实际有效样本：{{history.source.firstSample}} — {{history.source.lastSample}}。</p><p>{{history.source.limitation}}</p></details>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import history from '@/mock/baselineHistory.json'
import {eventBriefingFor} from '@/mock/eventBriefings'
const props=defineProps({scenario:String})
const cylinder=computed(()=>eventBriefingFor(props.scenario)?.baselineCylinder)
const months=history.months,total=months.reduce((sum,m)=>sum+m.count,0)
const metric=ref('deltaPeers'),reference=ref('2026-03'),current=ref('2026-08')
watch(cylinder,c=>{reference.value=c===4?'2026-05':'2026-03';current.value='2026-08';metric.value='deltaPeers'},{immediate:true})
const month=id=>months.find(m=>m.month===id)
const value=id=>month(id).cylinders[(cylinder.value||1)-1][metric.value]
const format=v=>v.toFixed(2),signed=v=>(v>0?'+':'')+v.toFixed(2)
const metricLabel=computed(()=>({deltaPeers:'相对其余五缸均值',deltaMax:'相对逐时最高值',mean:'排温均值'})[metric.value])
const bounds=computed(()=>{const vs=months.map(m=>value(m.month));if(metric.value!=='mean')vs.push(0);const step=Math.max(...vs)-Math.min(...vs)>40?20:5;return {min:Math.floor((Math.min(...vs)-5)/step)*step,max:Math.ceil((Math.max(...vs)+5)/step)*step,step}})
const ticks=computed(()=>{const {min,max,step}=bounds.value;return Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+step*i)})
const x=i=>66+i*112,y=v=>185-(v-bounds.value.min)/(bounds.value.max-bounds.value.min)*150
const points=computed(()=>months.map((m,i)=>`${x(i)},${y(value(m.month))}`).join(' '))
</script>
<style scoped>
.baseline-trend{border:1px solid #e3e8ef;border-radius:8px;padding:20px;margin:16px 0 24px;background:#fff;color:#334b62}.baseline-trend header{display:flex;justify-content:space-between;align-items:center;gap:12px}.baseline-trend h3{margin:5px 0;font-size:18px}.baseline-trend header small{color:#92713b;font-size:12px}.baseline-trend header>span,.baseline-condition{color:#72849a;font-size:12px}.baseline-controls{display:flex;gap:18px;flex-wrap:wrap;margin:16px 0}.baseline-controls label{display:flex;align-items:center;gap:8px;font-size:13px}.baseline-controls select{border:1px solid #dce3ec;background:#fff;border-radius:5px;padding:7px 9px;color:#334b62;font:inherit}.baseline-comparison{display:grid;grid-template-columns:repeat(3,1fr);background:#f7f9fb;border-radius:6px}.baseline-comparison>div{padding:14px 18px;display:flex;gap:6px;flex-direction:column}.baseline-comparison small,.baseline-comparison span{font-size:12px;color:#718197}.baseline-comparison strong{font-size:23px;font-variant-numeric:tabular-nums;font-weight:600}.baseline-comparison em{font-size:12px;font-style:normal;font-weight:400}.baseline-chart{display:block;width:100%;max-height:280px;margin-top:12px;overflow:visible}.baseline-chart line{stroke:#e7edf3;stroke-dasharray:3 3}.baseline-chart line.zero{stroke:#9eacbc}.axis-label{font-size:12px;fill:#78899c}.point-label{font-size:13px;fill:#384d63;font-variant-numeric:tabular-nums}.baseline-coverage{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;font-size:11px;color:#7a889b}.baseline-caption,.baseline-trend details{font-size:12px;line-height:1.7;color:#718197}.baseline-trend details{border-top:1px solid #edf0f5;padding-top:10px}.baseline-trend summary{cursor:pointer;color:#92713b}@media(max-width:650px){.baseline-trend{padding:12px}.baseline-trend header{align-items:flex-start;flex-direction:column}.baseline-comparison>div{padding:10px 8px}.baseline-comparison strong{font-size:18px}.baseline-controls{gap:10px}}
</style>
