<template>
  <article v-if="dossier" class="tracking-dossier">
    <header class="tracking-head">
      <BackButton :label="returnLabel" @click="$emit('back',dossier.deviceId)" />
      <div><small>持续跟踪档案 · {{ dossier.device }} · {{ dossier.part }}</small><h2>{{ dossier.title }}</h2></div>
    </header>
    <div class="tracking-meta"><span>最早观测：{{ dossier.first }}</span><span>建立关注：{{ dossier.established }}</span><span>最近更新：{{ dossier.updated }}</span></div>
    <div class="tracking-state"><strong>{{ dossier.phase }}</strong><span>{{ dossier.direction }}</span><span>{{ dossier.taskState }}</span></div>
    <button v-if="dossier.required" class="action-reminder" @click="focusAction">需要人员配合：{{ dossier.reason }} <span>查看派工要求 ↓</span></button>
    <nav role="tablist" aria-label="异动跟踪详情"><button v-for="tab in tabs" :key="tab" role="tab" :aria-selected="active===tab" :class="{active:active===tab}" @click="active=tab">{{ tab }}</button></nav>
    <main ref="bodyRef">
      <div v-show="active==='跟踪概览'">
        <section class="trend-section">
          <div class="section-head"><h3>变化趋势与当前判断</h3><label>变化指标<select v-model="chartKey" aria-label="选择跟踪指标"><option v-for="chart in dossier.charts" :key="chart.key" :value="chart.key">{{ chart.name }}</option></select></label></div>
          <div class="trend-grid">
            <div class="chart-panel"><h4>{{ currentChart.name }}</h4><p>{{ currentChart.reference }}</p>
              <svg viewBox="0 0 660 235" role="img" :aria-label="currentChart.name+'变化趋势'">
                <g v-for="tick in layout.ticks" :key="tick.value"><line x1="70" :y1="tick.y" x2="610" :y2="tick.y" stroke="#e4e9ee" stroke-dasharray="4 4"/><text x="60" :y="tick.y+4" text-anchor="end">{{ tick.value }}</text></g>
                <text x="16" y="20">{{ currentChart.unit }}</text>
                <polyline v-for="(segment,i) in layout.segments" :key="i" :points="segment" fill="none" stroke="#9a7c48" stroke-width="3"/>
                <g v-for="point in layout.points" :key="point.label"><circle :cx="point.x" :cy="point.y" r="5" fill="#9a7c48"/><text :x="point.x" :y="point.y-12" text-anchor="middle">{{ point.value }}</text><text :x="point.x" y="211" text-anchor="middle">{{ point.label }}</text></g>
              </svg>
              <div class="chart-nodes"><button v-for="point in layout.points" :key="point.label" @click="inspectPoint(point)">{{ point.label }} · {{ point.value }} {{ currentChart.unit }}{{ point.recordId?' · 查看跟踪节点':' · 观测点' }}</button></div>
              <p v-if="selectedPoint" class="point-detail">{{ selectedPoint.label }}：{{ selectedPoint.value }} {{ currentChart.unit }}。{{ selectedPoint.recordId?'下方已展开对应判断。':'该点仅有观测数据，没有独立判断记录。' }}</p>
              <p class="limit">仅展示已有观测节点；连线不代表连续采样、平滑衰减或未来预测。{{ layout.timed?'按已有时间间隔展示。':'按已有时段顺序展示。' }}</p>
            </div>
            <aside class="current-assessment"><small>最近已有分析：{{ dossier.analysisAt }}</small><h4>{{ dossier.direction }}</h4><p>{{ dossier.conclusion }}</p><p class="limit">{{ dossier.analysisStatus }}</p><h4>比较条件</h4><p>{{ dossier.conditions }}</p><p class="limit">{{ dossier.limit }}</p>
              <p v-if="dossier.execution">实际措施：{{ dossier.execution.values.measures }}<br>实际执行时间：{{ dossier.execution.values.executedAt?.replace('T',' ') }}。此前趋势保留，处理后观测按独立指标查看。</p>
            </aside>
          </div>
        </section>
        <section class="process-section"><h3>跟踪过程</h3><p class="limit">关键发现、当时判断及人员成果按过程接续；观测点不等同于每次新增判断。</p>
          <details v-for="record in dossier.records" :key="record.id" :ref="el=>setRecordRef(record.id,el)" class="tracking-record" :open="expandedRecord===record.id">
            <summary><span class="record-dot"></span><div><small>{{ record.at }} · {{ record.actor }}</small><strong>{{ record.label }}</strong><p>{{ record.text }}</p></div></summary>
            <div class="record-content"><p><b>当时判断／安排：</b>{{ record.assessment }}</p><small>来源：{{ record.source }}</small><button v-if="record.event" class="p2-link-button" @click="openTask">回看原待办记录 →</button></div>
          </details>
        </section>
        <section ref="actionRef" class="tracking-action"><h3>当前跟踪与人员行动</h3>
          <template v-if="dossier.closure"><h4>事项已结束</h4><p>{{ dossier.closure.basis }}</p><p class="limit">{{ dossier.closure.limit }}</p></template>
          <template v-else><p><b>系统继续观察：</b>{{ dossier.tracking }}</p>
            <template v-if="dossier.required"><p><b>本次为什么需要人员：</b>{{ dossier.reason }}</p><p><b>需要核实：</b>{{ dossier.scope }}</p><p>反馈用于更新变化真实性的判断，再评估是否进一步检查。派工不表示已确认故障或同意维修。</p>
              <TaskAssignment :scenario="scenario" :allow-ignore="false" action-title="安排现场核实" action-label="安排现场核实并指派" :action-hint="dossier.scope" initial-type="现场核实" :initial-scope="dossier.scope"/>
            </template>
            <template v-else-if="dossier.task"><p><b>负责人：</b>{{ dossier.task.owner }} · {{ dossier.task.stage }}</p><p>{{ dossier.task.scope }}</p><p class="limit">核实、检查、执行及确认由关联待办承载；本档案继续保留变化及成果。</p></template>
            <p v-else>当前暂无需人员操作，系统继续比较；偏差扩大或新增相关证据时再评估人员介入。</p>
          </template>
          <button v-if="dossier.assigned" class="p2-primary" @click="openTask">进入关联待办</button>
        </section>
      </div>
      <div v-show="active==='分析与证据'">
        <section><h3>比较范围与工况</h3><p>{{ dossier.conditions }}</p><p>数据范围：{{ dossier.first }} — {{ dossier.analysisAt }}；保留原观测节点及分析记录。</p><p class="limit">{{ dossier.limit }}</p></section>
        <section v-for="part in dossier.sections" :key="part.title"><h3>{{ part.title }}</h3><p v-for="text in part.paragraphs" :key="text">{{ text }}</p></section>
        <section><h3>参考与依据来源</h3><p v-for="chart in dossier.charts" :key="chart.key">{{ chart.name }}：{{ chart.reference }}</p><p>来源：关联测点观测及事项跟踪记录。</p></section>
        <section><h3>人员反馈与实际措施</h3><p v-if="!confirmedRecords.length">尚未取得已确认的现场反馈或实际措施。待办预设检查文字不作为已经执行的证据。</p><div v-for="record in confirmedRecords" :key="record.id"><h4>{{ record.label }} · {{ record.at }}</h4><p>{{ record.text }}</p><p class="limit">{{ record.assessment }}</p><button v-if="record.event" class="p2-link-button" @click="openTask">查看原待办 →</button></div></section>
        <section v-if="dossier.closure"><h3>结束依据与范围</h3><p>{{ dossier.closure.basis }}</p><p>{{ dossier.closure.limit }}</p></section>
      </div>
    </main>
  </article>
  <div v-else class="p2-empty">未找到该跟踪档案。</div>
</template>
<script setup>
import {computed,ref,nextTick,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {trackingDossier} from '@/mock/trackingDossier'
import {businessMessage} from '@/utils/businessCopy'
import {trackingChartLayout} from '@/mock/trackingDossier'
import BackButton from './BackButton.vue'
import TaskAssignment from './TaskAssignment.vue'
const props=defineProps({scenario:String})
defineEmits(['back'])
const store=usePhase2DemoStore(),route=useRoute(),router=useRouter(),active=ref('跟踪概览'),chartKey=ref(props.scenario==='air-delivery'?'loading':'gap'),selectedPoint=ref(null),expandedRecord=ref(null),bodyRef=ref(null),actionRef=ref(null),recordRefs=new Map()
const tabs=['跟踪概览','分析与证据'],scrollByTab={}
watch(active,async(value,previous)=>{if(bodyRef.value)scrollByTab[previous]=bodyRef.value.scrollTop;await nextTick();if(bodyRef.value)bodyRef.value.scrollTop=scrollByTab[value]||0})
const dossier=computed(()=>businessMessage(trackingDossier(store,props.scenario)))
const currentChart=computed(()=>dossier.value?.charts.find(chart=>chart.key===chartKey.value)||dossier.value?.charts[0])
const layout=computed(()=>trackingChartLayout(currentChart.value))
const confirmedRecords=computed(()=>dossier.value.records.filter(r=>['feedback','execution'].includes(r.type)))
const returnLabel=computed(()=>route.query.returnTracking==='1'?'返回原待办':route.query.from==='issues'?'返回事项处置':route.query.from==='workbench'?'返回船舶态势':route.query.from==='history'?'返回动态记录':'返回'+(dossier.value?.device||'设备')+'相关事项')
watch(()=>props.scenario,()=>{active.value=tabs[0];chartKey.value=props.scenario==='air-delivery'?'loading':'gap';expandedRecord.value=null;selectedPoint.value=null;recordRefs.clear()})
watch(chartKey,()=>{selectedPoint.value=null})
function setRecordRef(id,el){if(el)recordRefs.set(id,el);else recordRefs.delete(id)}
async function inspectPoint(point){selectedPoint.value=point;if(!point.recordId)return;expandedRecord.value=point.recordId;await nextTick();recordRefs.get(point.recordId)?.scrollIntoView({block:'nearest',behavior:'smooth'})}
async function focusAction(){active.value=tabs[0];await nextTick();actionRef.value?.scrollIntoView({block:'nearest',behavior:'smooth'})}
function showSection(section){if(section==='decision')focusAction();else if(section==='证据资料'||section==='研判分析')active.value='分析与证据'}
defineExpose({showSection})
function openTask(){store.selectTodo(props.scenario);router.push({path:'/event',query:{...route.query,todo:props.scenario,returnDossier:'1',dossier:props.scenario}})}
</script>
<style scoped>
.tracking-dossier{height:100%;min-height:0;display:flex;flex-direction:column;color:#303744;background:white}.tracking-head{padding:20px 24px 8px;display:flex;align-items:center;gap:16px}.tracking-head h2{font-size:21px;margin:6px 0}.tracking-head small,.tracking-meta{color:#78818c;font-size:12px}.tracking-meta{padding:0 24px 12px;display:flex;flex-wrap:wrap;gap:14px}.demo-label{color:#947546}.tracking-state{display:flex;gap:16px;flex-wrap:wrap;padding:10px 24px;background:#f7f8fa;font-size:13px}.tracking-state span{color:#78818c}.action-reminder{margin:12px 24px 0;padding:10px 12px;border:1px solid #e8dcc7;background:#fbf8f2;color:#725f3e;text-align:left;font:inherit;font-size:13px;cursor:pointer;line-height:1.7}.action-reminder span{white-space:nowrap}.tracking-dossier nav{display:flex;gap:24px;padding:0 24px;border-bottom:1px solid #e7ebef;flex-shrink:0}.tracking-dossier nav button{background:none;border:0;border-bottom:2px solid transparent;padding:14px 0;font:inherit;color:#77828e;cursor:pointer}.tracking-dossier nav button.active{color:#846839;border-color:#a48b5b}.tracking-dossier main{flex:1;min-height:0;overflow:auto;padding:0 24px 28px}.tracking-dossier section{padding:20px 0;border-bottom:1px solid #e7ebef;font-size:14px;line-height:1.8}.tracking-dossier h3{font-size:16px;margin:0 0 12px}.tracking-dossier h4{font-size:14px;margin:12px 0 6px}.tracking-dossier p{margin:8px 0}.section-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center}.section-head label{font-size:12px;color:#77828e}.section-head select{display:block;margin-top:4px;max-width:100%;padding:8px;border:1px solid #dfe4e9;background:#fff;color:#445269;border-radius:5px}.trend-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:24px}.chart-panel{min-width:0}.chart-panel svg{width:100%;height:auto;max-height:300px;display:block}.chart-panel svg text{font:11px sans-serif;fill:#6b7482}.chart-nodes{display:flex;gap:6px;flex-wrap:wrap}.chart-nodes button{border:1px solid #e5ded1;border-radius:4px;background:#faf8f4;color:#7d6847;font:inherit;font-size:12px;padding:5px 8px;cursor:pointer}.limit{font-size:12px;color:#7c8692;line-height:1.7}.current-assessment{padding:10px 18px;background:#f7f9fb;border-radius:6px}.current-assessment small{color:#7c8692}.tracking-record{padding:14px 0;border-bottom:1px solid #edf0f3}.tracking-record summary{display:flex;gap:12px;list-style:none;cursor:pointer}.tracking-record summary small{display:block;color:#83909d;font-size:12px}.tracking-record summary strong{font-size:14px}.tracking-record summary p{font-size:13px;margin:4px 0}.tracking-record summary:after{content:'展开';font-size:12px;color:#83909d;margin-left:auto;flex-shrink:0}.tracking-record[open] summary:after{content:'收起'}.record-dot{width:7px;height:7px;background:#a48b5b;border-radius:50%;margin-top:10px;flex-shrink:0}.record-content{padding:8px 0 0 19px;font-size:13px}.record-content small{display:block;color:#83909d}.point-detail{font-size:12px;color:#7d6847}button:focus-visible,summary:focus-visible,select:focus-visible{outline:2px solid #a48b5b;outline-offset:3px}@media(max-width:1100px){.trend-grid{grid-template-columns:1fr}}@media(max-width:600px){.tracking-head{flex-wrap:wrap;padding:16px}.tracking-head h2{font-size:18px}.tracking-meta,.tracking-state{padding-left:16px;padding-right:16px}.action-reminder{margin-left:16px;margin-right:16px}.tracking-dossier nav{padding:0 16px}.tracking-dossier main{padding:0 16px 24px}}
</style>
