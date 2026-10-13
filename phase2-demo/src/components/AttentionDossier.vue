<template>
  <div class="attention-dossier">
    <header class="dossier-header">
      <BackButton label="返回主机概览" @click="$emit('back')" />
      <template v-if="dossier"><div><p class="dossier-context">异动跟踪档案 · {{ dossier.device }}</p><h2>{{ dossier.title }}</h2></div><span class="p2-state-tag" :class="dossier.closure ? 'green' : dossier.action.required || dossier.action.linked ? 'amber' : 'blue'">{{ dossier.action.phase }}</span></template>
    </header>
    <template v-if="dossier">
      <div class="dossier-meta"><span>首次记录：{{ dossier.first }}</span><span>最近更新：{{ dossier.updated }}</span></div>
      <nav class="dossier-tabs" role="tablist" aria-label="异动跟踪档案内容"><button v-for="tab in tabs" :key="tab" type="button" role="tab" :aria-selected="activeTab===tab" :class="{active:activeTab===tab}" @click="activeTab=tab">{{ tab }}</button></nav>
      <main class="dossier-body" role="tabpanel" :aria-label="activeTab">
        <template v-if="activeTab==='事项概览'">
          <section v-if="dossier.closure" class="dossier-section dossier-closure"><h3>事项已结束</h3><dl class="dossier-facts"><div><dt>结束原因</dt><dd>{{ dossier.closure.reason }}</dd></div><div><dt>结束时间</dt><dd>{{ dossier.closure.at }}</dd></div></dl><p>{{ dossier.closure.summary }}</p><p class="dossier-limit">{{ dossier.closure.boundary }}</p></section>
          <section class="dossier-section"><h3>{{ dossier.closure ? '结束前后的变化' : '最新判断' }}</h3><p v-if="!dossier.closure" class="dossier-conclusion">{{ dossier.conclusion }}</p><p><b>最近分析变化：</b>{{ dossier.analysisChange }}</p><p class="dossier-limit">最后有效分析：{{ dossier.analysisAt }}。留言时间不等于重新分析时间。</p><p class="dossier-limit">判断范围：依据当前已覆盖指标与已提交信息，不代表未覆盖部位正常，也不直接预测故障时间。</p></section>
          <TaskAssignment v-if="scenario==='drift' && !store.isTaskHandled(scenario)" :key="scenario" :scenario="scenario" /><AttentionAction v-else :key="scenario" :scenario="scenario" compact in-conversation @request-inquiry="$emit('request-inquiry')" />
          <div v-if="dossier.observation?.type==='extend'" class="dossier-observation-action"><button class="p2-primary" @click="store.extendObservation(scenario)">按建议延长观察24小时</button></div>
          <div v-if="dossier.observation?.type==='reinspect'" class="dossier-observation-action"><button class="p2-primary" @click="reinspect">确认返回原事件复查</button></div>
          <section class="dossier-section"><h3>{{dossier.closure?'为何曾经关注':'为何关注'}}</h3><p>{{ dossier.background }}</p><p class="dossier-limit">持续性、发展方向和关联证据共同支撑关注；未触发报警本身不是建档依据。</p></section>
          <section class="dossier-section"><h3>后续跟踪安排</h3><dl class="dossier-facts"><div><dt>观察重点</dt><dd>{{ dossier.tracking.focus }}</dd></div><div><dt>复核安排</dt><dd>{{ dossier.tracking.next }}</dd></div><div><dt>人员介入条件</dt><dd>{{ dossier.tracking.intervention }}</dd></div><div><dt>数据限制</dt><dd>{{ dossier.tracking.limit }}</dd></div></dl></section>
          <section v-if="latest" class="dossier-section dossier-latest"><h3>最近关键进展</h3><b>{{ latest.label }}</b><small>{{ latest.at }} · {{ latest.actor }}</small><p>{{ latest.text }}</p></section>
          <section v-if="store.todoCreated[scenario]" class="dossier-section"><h3>关联事件</h3><p>{{ store.cases[scenario].initialTitle }} · {{ store.cases[scenario].stages[store.progress[scenario]].label }}</p><button class="p2-link-button" @click="openEvent">进入原事件 →</button></section>
        </template>
        <template v-else-if="activeTab==='变化证据'">
          <section v-if="dossier.closure" class="dossier-section"><h3>支持结束的判断依据</h3><p v-for="basis in dossier.closure.basis" :key="basis">{{ basis }}</p><dl class="dossier-facts"><div><dt>观察范围与覆盖</dt><dd>{{ dossier.closure.coverage }}</dd></div><div><dt>判断限制</dt><dd>{{ dossier.closure.limit }}</dd></div></dl></section>
          <section class="dossier-section"><h3>本次分析范围</h3><dl class="dossier-facts"><div><dt>有效分析记录</dt><dd>{{ dossier.analysisAt }}</dd></div><div><dt>涉及指标</dt><dd>{{ dossier.charts.map(chart=>chart.name).join('、') }}</dd></div><div><dt>数据时段与可用性</dt><dd>2026/10/06–10/12，稳定运行片段；采样间隔1分钟，近24小时有效覆盖率98.6%。缺失及非可比工况数据不参与比较。</dd></div></dl></section>
          <section class="dossier-section">
            <div class="dossier-section-head"><h3>关键指标变化</h3><select v-model="chartIndex" aria-label="选择变化指标"><option v-for="(chart,i) in dossier.charts" :key="chart.name" :value="i">{{ chart.name }}</option></select></div>
            <p>{{ currentChart.reference }}</p>
            <div v-if="currentChart.qualitative" class="dossier-range"><div v-for="(label,i) in currentChart.labels" :key="label"><span>{{ label }}</span><p>{{ currentChart.states[i] }}</p></div></div>
            <div v-else-if="currentChart.rangeOnly" class="dossier-range"><div v-for="(label,i) in currentChart.labels" :key="label"><span>{{ label }}</span><b>{{ currentChart.ranges[i] }} {{ i===1 ? '' : currentChart.unit }}</b></div></div>
            <template v-else><svg class="dossier-chart" viewBox="0 0 660 220" role="img" :aria-label="currentChart.name+'观测趋势'"><g v-for="tick in chartTicks" :key="tick.value"><line x1="60" :y1="tick.y" x2="625" :y2="tick.y" stroke="#e7ebf0" stroke-dasharray="4 4" /><text x="48" :y="tick.y+4" text-anchor="end">{{ tick.value }}</text></g><text x="16" y="18">{{ currentChart.unit }}</text><polyline v-for="(segment,i) in segments" :key="i" :points="segment" fill="none" stroke="#8b7852" stroke-width="2.5" /><g v-for="point in chartPoints" :key="point.label"><circle :cx="point.x" :cy="point.y" r="4" fill="#8b7852" /><text :x="point.x" :y="point.y-12" text-anchor="middle">{{ point.value }}</text></g><text v-for="(label,i) in currentChart.labels" :key="label+i" :x="x(i)" y="208" text-anchor="middle">{{ label }}</text></svg><p class="dossier-chart-note">仅展示已有观测节点，节点连线不代表连续采样或未来预测；缺失记录不插值。</p></template>
          </section>
          <section class="dossier-section"><h3>多参考比较</h3><div class="dossier-table-wrap"><table class="dossier-table"><thead><tr><th>比较参考</th><th>本次结果</th><th>适用性与限制</th></tr></thead><tbody><tr v-for="row in dossier.comparisonRows" :key="row.name"><th>{{ row.name }}</th><td>{{ row.result }}</td><td>{{ row.scope }}</td></tr></tbody></table></div><p class="dossier-limit">各组比较分别保留，不合成统一健康分数，也不将历史表现默认视为健康基线。</p></section>
          <section class="dossier-section"><h3>工况与维护背景</h3><dl class="dossier-facts"><div><dt>运行工况</dt><dd>{{ dossier.context.conditions }}</dd></div><div><dt>相关维护</dt><dd>{{ dossier.context.maintenance }}</dd></div></dl></section>
          <section class="dossier-section"><h3>现场核实与补充证据</h3><template v-if="dossier.feedback"><b>结构化核实已提交 · {{ dossier.feedback.at }}</b><p>现场排温：{{ dossier.feedback.reading }}°C</p><p>运行工况：{{ dossier.feedback.conditions }}</p><p>现场现象：{{ dossier.feedback.phenomenon }}</p></template><p v-else>尚未在本档案提交结构化现场核实信息。关联事件中的检查结果仍由原事件保留。</p><p v-if="dossier.notes.length">另有 {{ dossier.notes.length }} 条人员留言，已登记在跟踪记录中；尚不作为已核实事实。</p></section>
          <details v-for="section in dossier.report.sections" :key="section.title" class="dossier-evidence-detail"><summary>{{ section.title }}</summary><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></details>
          <section class="dossier-section"><h3>依据来源</h3><dl class="dossier-facts"><div v-for="source in dossier.sources" :key="source.label"><dt>{{ source.label }}</dt><dd>{{ source.text }}<button v-if="source.event" type="button" class="p2-link-button" @click="openEvent">进入原事件</button></dd></div></dl></section>
        </template>
        <template v-else>
          <p class="dossier-chart-note">保留建档、观察更新和人员反馈；最新摘要更新不覆盖历史记录。</p>
          <p class="dossier-chart-note">业务留言、核实、人员决定及分析更新进入记录；普通追问保留在右侧对话。各类来源分别保留，不把留言视为确认执行。</p>
          <div class="dossier-record-list"><details v-for="(record,i) in dossier.records" :key="record.id || scenario+i" class="dossier-record"><summary><span class="dossier-record-dot"></span><span><b>{{ record.label }}</b><small>{{ record.at }} · {{ record.actor }}</small></span></summary><p><b>{{ record.type==='note'?'留言原文：':'本次新增：' }}</b>{{ record.text }}</p><p v-if="record.closure"><b>观察范围与覆盖：</b>{{ record.closure.coverage }}</p><p v-if="record.closure" class="dossier-limit">{{ record.closure.limit }} {{ record.closure.boundary }}</p><p v-if="record.assessment"><b>{{ record.type==='note'?'记录性质：':'当时判断／安排：' }}</b>{{ record.assessment }}</p></details></div>
        </template>
      </main>
    </template>
    <div v-else class="p2-empty">未找到该异动跟踪档案，请返回列表选择现有事项。</div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { attentionDossier } from '@/mock/attentionDossier'
import AttentionAction from './AttentionAction.vue'
import TaskAssignment from './TaskAssignment.vue'
import BackButton from './BackButton.vue'
const props=defineProps({scenario:String})
defineEmits(['back','request-inquiry'])
const store=usePhase2DemoStore(),router=useRouter(),activeTab=ref('事项概览'),chartIndex=ref(0)
const tabs=['事项概览','变化证据','跟踪记录']
const dossier=computed(()=>attentionDossier(store,props.scenario)),latest=computed(()=>dossier.value?.records.at(-1))
const currentChart=computed(()=>dossier.value?.charts[chartIndex.value]||dossier.value?.charts[0])
watch(()=>props.scenario,()=>{activeTab.value='事项概览';chartIndex.value=0})
const bounds=computed(()=>{const actual=currentChart.value?.values.filter(v=>v!==null)||[];const values=actual.length?actual:[0];const min=Math.min(...values),max=Math.max(...values),padding=Math.max((max-min)*.25,Math.abs(max)*.002,.01);return {min:min-padding,max:max+padding}})
function x(i){const n=currentChart.value.labels.length;return n===1?342:80+i*525/(n-1)}
function y(value){return 174-(value-bounds.value.min)*140/(bounds.value.max-bounds.value.min)}
const chartPoints=computed(()=>currentChart.value?.values.flatMap((value,i)=>value===null?[]:[{x:x(i),y:y(value),value,label:currentChart.value.labels[i]}])||[])
const segments=computed(()=>{const parts=[];let part=[];currentChart.value?.values.forEach((value,i)=>{if(value===null){if(part.length)parts.push(part.join(' '));part=[]}else part.push(`${x(i)},${y(value)}`)});if(part.length)parts.push(part.join(' '));return parts})
const chartTicks=computed(()=>[0,.5,1].map(r=>{const value=bounds.value.min+(bounds.value.max-bounds.value.min)*r;return {value:Number(value.toFixed(3)),y:y(value)}}))
function openEvent(){store.selectTodo(props.scenario);router.push({path:'/event',query:{todo:props.scenario}})}
function reinspect(){store.reopenTodo(props.scenario);openEvent()}
</script>
<style scoped>
.dossier-facts{margin:0;display:grid;gap:12px}.dossier-facts>div{display:grid;grid-template-columns:130px minmax(0,1fr);gap:16px}.dossier-facts dt{color:#7a818d}.dossier-facts dd{margin:0;overflow-wrap:anywhere}.dossier-table-wrap{overflow:auto}.dossier-table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.7;text-align:left}.dossier-table th,.dossier-table td{padding:12px 10px;border-bottom:1px solid #e7e9ed;vertical-align:top}.dossier-table th{font-weight:500;color:#50596a}.dossier-table tbody th{width:22%}.dossier-table thead{background:#f7f8fa}.dossier-facts dd button{display:block;margin-top:8px}@media(max-width:768px){.dossier-facts>div{grid-template-columns:1fr;gap:3px}.dossier-table{min-width:540px}}
.attention-dossier{height:100%;display:flex;flex-direction:column;min-height:0;color:#303744}.dossier-header{display:flex;align-items:center;gap:14px;padding:20px 22px 10px;flex-shrink:0}.dossier-header>div{flex:1;min-width:0}.dossier-header h2{font-size:20px;margin:4px 0;line-height:1.4}.dossier-context{font-size:12px;color:#777e89;margin:0}.dossier-meta{display:flex;flex-wrap:wrap;gap:18px;padding:0 22px 18px;font-size:11px;color:#848995}.dossier-tabs{display:flex;gap:28px;margin:0 22px;border-bottom:1px solid #e7e9ed;flex-shrink:0}.dossier-tabs button{border:0;border-bottom:2px solid transparent;background:none;padding:12px 0;cursor:pointer;color:#7a808c;font-size:14px}.dossier-tabs button.active{border-color:#9c8860;color:#776444;font-weight:600}.dossier-body{flex:1;min-height:0;overflow:auto;padding:4px 22px 24px}.dossier-section{padding:18px 0;border-bottom:1px solid #edf0f3;font-size:13px;line-height:1.75}.dossier-section h3{font-size:14px;margin:0 0 10px}.dossier-section p{margin:7px 0}.dossier-conclusion{font-size:15px;color:#303846}.dossier-limit,.dossier-chart-note{font-size:12px;color:#7a818d;line-height:1.7}.dossier-latest small{display:block;color:#8b919c;margin-top:4px}.dossier-section-head{display:flex;justify-content:space-between;gap:16px;align-items:center}.dossier-section-head select{max-width:55%;padding:7px;border:1px solid #dfe3e9;border-radius:5px;background:#fff;font-size:12px}.dossier-chart{width:100%;height:auto;min-height:160px;max-height:270px}.dossier-chart text{font:11px sans-serif;fill:#6b7482}.dossier-evidence-detail,.dossier-record{border-bottom:1px solid #e7e9ed;padding:15px 0;font-size:13px;line-height:1.7}.dossier-evidence-detail summary,.dossier-record summary{cursor:pointer;color:#455064}.dossier-record summary{display:flex;align-items:center;gap:12px;list-style:none}.dossier-record summary:after{content:'展开';font-size:11px;color:#9097a2;margin-left:auto}.dossier-record[open] summary:after{content:'收起'}.dossier-record small{display:block;font-size:11px;color:#858d99;margin-top:4px}.dossier-record-dot{width:7px;height:7px;border-radius:50%;background:#a4916d;flex-shrink:0}.dossier-record p{margin:10px 0 0 19px;color:#596477}.dossier-range{display:flex;flex-wrap:wrap;gap:24px;padding:22px 0}.dossier-range span{display:block;font-size:12px;color:#7a818d}.dossier-range b{display:block;margin-top:8px;font-size:16px}.dossier-observation-action{padding-bottom:10px}button:focus-visible,summary:focus-visible,select:focus-visible{outline:2px solid #a4916d;outline-offset:3px}@media(max-width:768px){.dossier-header{padding:16px 14px 10px;flex-wrap:wrap}.dossier-header h2{font-size:17px}.dossier-meta{padding:0 14px 12px;gap:8px}.dossier-tabs{margin:0 14px;gap:20px}.dossier-body{padding:4px 14px 20px}}
</style>
