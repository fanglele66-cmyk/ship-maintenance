<template>
 <main class="statistics">
  <div class="dashboard">
   <header class="page-head">
    <div class="identity">
     <BackButton label="返回船舶态势" @click="$router.push('/situation')"/>
     <h1>事件统计看板</h1>
    </div>
    <div class="period">
     <nav class="segmented" aria-label="统计周期">
      <button v-for="range in ranges" type="button" :key="range.days" :aria-pressed="days === range.days" @click="days=range.days">{{ range.label }}</button>
     </nav>
     <span>{{ fullDate(stats.start) }} — {{ fullDate(stats.now) }}</span>
    </div>
   </header>

   <div class="metrics">
    <button v-for="metric in metrics" type="button" :key="metric.key" class="metric" :aria-pressed="filter===metric.key" @click="toggleFilter(metric.key)">
     <span>{{ metric.label }}</span><strong>{{ stats[metric.total] }}<small>起</small></strong>
    </button>
   </div>

   <div class="panels">
    <section class="panel">
     <header><h2>事件趋势</h2><div class="legend"><span><i class="added"/>新增</span><span><i class="handled"/>处置</span></div></header>
     <div class="trend" aria-label="分时段新增与处置事件数量">
      <div v-for="bucket in stats.trend" :key="bucket.from" class="bucket" :title="bucketTitle(bucket)" :aria-label="bucketTitle(bucket)">
       <div class="bars" aria-hidden="true"><div v-for="key in ['added','handled']" :key="key" class="bar" :class="key" :style="{height:(bucket[key]/peak*76)+'%'}"><span v-if="bucket[key]">{{ bucket[key] }}</span></div></div>
       <time>{{ bucket.label }}</time>
      </div>
     </div>
    </section>
    <section class="panel">
     <header><h2>事件类型分布</h2></header>
     <div v-for="type in stats.types" :key="type.label" class="type-row">
      <span>{{ type.label }}</span><div class="track"><i :data-type="type.label" :style="{width:percentage(type.count)+'%'}"/></div><b>{{ type.count }}</b><small>{{ percentage(type.count) }}%</small>
     </div>
    </section>
   </div>

   <section class="panel">
    <header><h2>设备事件统计</h2></header>
    <div v-if="stats.devices.length" class="scroll-table"><table><thead><tr><th>设备</th><th>事件总数</th><th v-for="type in statisticEventTypes" :key="type">{{ type }}</th></tr></thead>
     <tbody><tr v-for="group in stats.devices" :key="group.key"><th scope="row">{{ group.device }}<small v-if="group.identifier" class="number">{{ group.identifier }}</small></th><td>{{ group.count }}</td><td v-for="type in statisticEventTypes" :key="type">{{ group.types[type] }}</td></tr></tbody>
    </table></div>
    <p v-else class="empty">暂无设备事件。</p>
   </section>

   <section class="panel">
    <header><div class="heading"><h2>事件明细</h2><span class="caption">{{ visibleRows.length }} 起</span></div><button v-if="activeMetric" class="filter-chip" type="button" @click="filter=''">{{ activeMetric.label }} ×</button></header>
    <div v-if="visibleRows.length" class="scroll-table"><table><thead><tr><th>事件</th><th>设备</th><th>报警类型</th><th>当前状态</th><th>最近记录</th></tr></thead>
     <tbody><tr v-for="row in visibleRows" :key="row.id">
      <td><RouterLink class="event-link" :to="{path:'/situation/issue/'+row.id,query:{from:'statistics'}}">{{ row.title }}</RouterLink><small class="number">{{ row.number }}</small></td>
      <td>{{ row.device || row.deviceId || '未登记' }}</td>
      <td><i class="dot" :data-type="row.type"/>{{ row.type }}</td><td>{{ row.state }}</td><td>{{ dateTime(row.latest) }}</td>
     </tr></tbody></table></div>
    <p v-else class="empty">所选范围内暂无{{ activeMetric?.label || '相关事件' }}记录。</p>
   </section>
  </div>
 </main>
</template>

<script setup>
import {computed, ref} from 'vue'
import {useNow} from '@vueuse/core'
import BackButton from '../components/BackButton.vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore.js'
import {shortDate, situationStatistics, statisticEventTypes} from '../workflow/situationStatistics.js'

const store = useEventLifecycleStore()
const days = ref(30), filter = ref('')
const clock = useNow({interval:60000})
const ranges = [{days:7,label:'近7天'}, {days:30,label:'近30天'}, {days:90,label:'近90天'}, {days:0,label:'全部'}]
const stats = computed(() => situationStatistics(store.events, days.value, Math.max(clock.value.getTime(), Date.now()), store.state.role))
const metrics = computed(() => [
 {key:'isNew',total:'added',label:'新增事件'},
 {key:'handled',total:'handled',label:'已处置事件'},
 {key:'isClosed',total:'closed',label:'已闭环事件'},
 {key:'pending',total:'pending',label:stats.value.pendingLabel},
])
const activeMetric = computed(() => metrics.value.find(m => m.key === filter.value))
const visibleRows = computed(() => stats.value.rows.filter(r => !filter.value || r[filter.value]))
const peak = computed(() => Math.max(1, ...stats.value.trend.map(b => Math.max(b.added,b.handled))))
function toggleFilter(key) { filter.value = filter.value===key ? '' : key }
function percentage(count) { return stats.value.rows.length ? Math.round(100*count/stats.value.rows.length) : 0 }
const fullDate = at => new Date(at).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})
const dateTime = at => new Date(at).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16)
const bucketTitle = b => shortDate(b.from)+' 至 '+shortDate(b.until-1)+'，新增 '+b.added+' 起，处置 '+b.handled+' 起'
</script>

<style scoped>
.statistics{--ink:#273331;--muted:#667670;--line:#e4e5de;--paper:#fff;--gold:#947440;--olive:#42766b;box-sizing:border-box;flex:1;min-width:0;overflow:auto;background:#f4f5f3;color:var(--ink);padding:clamp(14px,2vw,32px)}
.dashboard{max-width:1600px;margin:0 auto;display:grid;gap:16px}.page-head,.identity,.period,.heading,.legend,.legend span,.panel>header{display:flex;align-items:center;gap:12px}.page-head,.panel>header{justify-content:space-between}.page-head{margin-bottom:4px;flex-wrap:wrap}.period{align-items:flex-end;flex-direction:column;gap:5px}.period>span,.caption,.number,.type-row small{color:var(--muted);font-size:12px}
h1,h2,p{margin:0}h1{font-size:clamp(21px,1.7vw,29px);line-height:1.4}h2{font-size:16px;font-weight:650;line-height:1.5}.segmented{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--line);border-radius:7px;background:#f3f3ef}.segmented button,.filter-chip{padding:5px 10px;border:1px solid transparent;border-radius:5px;background:transparent;color:#60675e}.segmented button[aria-pressed=true],.filter-chip{color:#795d34;background:#fff;border-color:#d9d7cb}.statistics button{font:inherit;font-size:13px;cursor:pointer}.statistics :is(button,a):focus-visible{outline:2px solid #977542;outline-offset:3px}
.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric,.panel{border:1px solid var(--line);border-radius:8px;background:var(--paper)}.metric{display:flex;align-items:flex-start;flex-direction:column;padding:16px 18px;text-align:left;color:var(--ink)}.metric>span:first-child{font-size:14px;font-weight:600}.metric:hover,.metric[aria-pressed=true]{border-color:#b79e71;background:#fcfaf6}.metric strong{font-variant-numeric:tabular-nums;font-size:32px;line-height:1.15;margin:7px 0}.metric small{font-size:12px;color:var(--muted);font-weight:400;margin-left:6px}
.panels{display:grid;grid-template-columns:1.45fr 1fr;gap:16px}.panel{padding:18px 20px;min-width:0}.panel>header{margin-bottom:15px;gap:8px;flex-wrap:wrap}.caption{line-height:1.6}.legend{font-size:12px;color:var(--muted)}.legend span{gap:5px}.legend i,.dot{display:inline-block;width:8px;height:8px;border-radius:2px}.added{background:var(--gold)}.handled{background:var(--olive)}.trend{display:flex;align-items:stretch;gap:4px}.bucket{flex:1;min-width:0;text-align:center}.bars{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:91px;border-bottom:1px solid #cfd3c8;background:repeating-linear-gradient(to top,transparent 0 28px,#f0f1eb 29px 30px)}.bar{position:relative;min-height:1px;flex:1;max-width:18px;border-radius:3px 3px 0 0}.bar span{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:11px;color:#46554b}.bucket time{font-size:11px;color:var(--muted);display:inline-block;margin-top:4px}
.type-row{display:grid;grid-template-columns:4.3em minmax(28px,1fr) 25px 38px;align-items:center;gap:9px;margin-top:13px;font-size:13px}.type-row b,.type-row small{text-align:right;font-variant-numeric:tabular-nums}.track{height:7px;background:#f1f1ed;border-radius:4px;overflow:hidden}.track i{display:block;height:100%;border-radius:4px}[data-type="报警"]{background:#b4534d}[data-type="预警"]{background:#aa761e}[data-type="异动跟踪"]{background:#477aa9}[data-type="效果观察"]{background:#478261}.dot{border-radius:50%;margin-right:6px}
.scroll-table{overflow:auto}.statistics table{border-collapse:collapse;width:100%;text-align:left;font-size:13px}.statistics th,.statistics td{padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap}.statistics thead th{background:#f6f7f3;color:#68736b;font-weight:500}.statistics tbody tr:last-child>*{border-bottom:0}.statistics tbody th{font-weight:600}.event-link{color:#55482f;font-weight:600;text-decoration:none}.event-link:hover{text-decoration:underline}.number{display:block;font-size:11px;margin-top:3px}.empty{padding:14px 4px;color:var(--muted);font-size:13px}
@media(max-width:880px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.panels{grid-template-columns:minmax(0,1fr)}}
@media(max-width:560px){.statistics{padding:10px}.dashboard{gap:10px}.panel,.metric{padding:12px}.period{align-items:flex-start}.metrics{gap:8px}.bucket time{font-size:9px}.trend{gap:1px}.legend{gap:7px}.statistics th,.statistics td{padding:8px}.metric strong{font-size:27px}}
</style>
