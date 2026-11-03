<template>
 <main class="lc-report-page" :class="{'lc-report-index':!route.params.reportId}">
  <header><button @click="goBack">← {{route.params.reportId?'返回全部报告':'返回首页'}}</button><span>{{report?.kind||'报告中心'}}</span></header>
  <article v-if="report"><div class="report-event-index"><RouterLink :to="{path:'/situation/issue/'+report.eventId,query:report.kind==='上报岸基报告'?{shore:report.id}:{}}">← 返回所属事件：{{store.state.events[report.eventId]?.title}} · {{report.eventNumber}}</RouterLink><p v-if="report.status">{{report.status}}</p><details v-if="report.includedReports?.length"><summary>本次收录 {{report.includedReports.length}} 份报告 · 查看原报告索引</summary><p>下列链接查看当前原报告；本页正文保留上报时的版本。</p><ul><li v-for="source in report.includedReports" :key="source.id"><RouterLink :to="'/reports/'+source.id">{{source.title}} ↗</RouterLink><RouterLink :to="'/situation/issue/'+source.eventId"> 所属事件 ↗</RouterLink></li></ul></details></div><LifecycleReport :report="report"/></article>
  <section v-else-if="!route.params.reportId" class="lc-report-library">
   <div class="lc-library-heading"><div><h1>全部报告</h1><p>按事件归集排查、维修、维保、观察、闭环及上报岸基报告。</p></div><span>{{filtered.length}} 份报告</span></div>
   <div class="lc-report-filters"><nav aria-label="报告类型"><button v-for="name in kinds" :key="name" :class="{active:kind===name}" :aria-pressed="kind===name" @click="kind=name">{{name}}</button></nav><label><span>搜索报告</span><input v-model="search" type="search" placeholder="搜索事件名称或编号" aria-label="搜索事件名称或编号"/></label></div>
   <div class="lc-report-cards"><article v-for="r in filtered" :key="r.id" class="lc-report-card" role="link" tabindex="0" :aria-label="r.title" @click="open(r)" @keydown.enter.self="open(r)">
    <div class="lc-report-card-meta"><span :class="'report-type-'+category(r)">{{r.kind}}</span><small>{{r.eventNumber||'—'}}</small></div>
    <h2>{{r.title}}</h2><p>{{r.summary}}</p><dl><dt>所属事件</dt><dd><RouterLink :to="'/situation/issue/'+r.eventId" @click.stop>{{store.state.events[r.eventId]?.title||'—'}} ↗</RouterLink></dd><dt>负责人</dt><dd>{{r.owner}}</dd></dl>
    <footer><time>{{timeText(r.at)}}</time><button @click.stop="open(r)">查看详情 →</button></footer>
   </article></div>
   <div v-if="!filtered.length" class="lc-report-empty"><strong>没有符合条件的报告</strong><p>可调整报告类型，或输入事件名称、编号重新查找。</p><button @click="kind='全部';search=''">清除筛选</button></div>
  </section>
  <p v-else>该报告不存在，或当前身份无权查看。</p>
 </main>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import LifecycleReport from '../components/LifecycleReport.vue'
import {timeText} from '../workflow/eventLifecycle'
const route=useRoute(),router=useRouter(),store=useEventLifecycleStore()
const kinds=computed(()=>['全部','排查','维修','维保','观察','闭环',...(store.state.role==='captain'?['上报岸基']:[])]),kind=ref(kinds.value.includes(route.query.kind)?route.query.kind:'全部'),search=ref(String(route.query.q||''))
watch(()=>[route.path,route.query.kind,route.query.q,store.state.role],()=>{if(route.path==='/reports'){kind.value=kinds.value.includes(route.query.kind)?route.query.kind:'全部';search.value=String(route.query.q||'')}})
const allReports=computed(()=>[...store.reports.filter(r=>r.kind!=='工况报告'),...store.shoreReports].sort((a,b)=>String(b.at).localeCompare(String(a.at))))
const report=computed(()=>allReports.value.find(r=>r.id===route.params.reportId&&r.kind!=='工况报告'))
const category=r=>kinds.value.find(k=>k!=='全部'&&r.kind.startsWith(k))||r.kind
const filtered=computed(()=>allReports.value.filter(r=>{
 const text=[r.title,r.eventNumber,store.state.events[r.eventId]?.title].filter(Boolean).join(' ').toLocaleLowerCase()
 return (kind.value==='全部'||category(r)===kind.value)&&text.includes(search.value.trim().toLocaleLowerCase())
}))
const filterQuery=()=>({...(kind.value==='全部'?{}:{kind:kind.value}),...(search.value?{q:search.value}:{})})
function open(r){router.push({path:'/reports/'+r.id,query:filterQuery()})}
function goBack(){router.push(route.params.reportId?{path:'/reports',query:filterQuery()}:{path:'/situation'})}
</script>
<style scoped>
.report-event-index{margin-bottom:20px;padding:16px 20px;background:#faf8f2;border-radius:7px;font-size:14px;line-height:1.8}.report-event-index a,.lc-report-card dd a{color:#8a6c3d;text-decoration:none}.report-event-index a:hover,.lc-report-card dd a:hover{text-decoration:underline}.report-event-index summary{cursor:pointer}.report-event-index li{margin:7px 0}

.lc-report-index>header{max-width:none}.lc-report-library{padding:24px;background:white;border-radius:8px}.lc-library-heading{display:flex;justify-content:space-between;align-items:center;gap:15px}.lc-library-heading h1{font-size:24px;margin:0;color:#2d4056}.lc-library-heading p{font-size:13px;color:#7d8da0;margin:8px 0 0}.lc-library-heading>span{color:#8593a4;font-size:13px;white-space:nowrap}.lc-report-filters{margin:22px 0;display:flex;justify-content:space-between;gap:15px;align-items:center;border-bottom:1px solid #e7edf4;padding-bottom:16px}.lc-report-filters nav{display:flex;gap:8px;flex-wrap:wrap}.lc-report-filters button,.lc-report-empty button{border:1px solid #e0e6ee;border-radius:5px;background:white;color:#6a7d92;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer}.lc-report-filters button.active{background:#faf5e9;border-color:#cbb183;color:#91703d}.lc-report-filters label{display:flex;align-items:center;gap:10px;font-size:12px;color:#8390a2}.lc-report-filters input{width:260px;max-width:100%;border:1px solid #dfe6ef;border-radius:5px;padding:9px 12px;font:inherit;font-size:13px;color:#45607a}.lc-report-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.lc-report-card{min-width:0;border:1px solid #dfe6ef;border-radius:7px;padding:18px 18px 0;display:flex;flex-direction:column;cursor:pointer;transition:border-color .15s,box-shadow .15s}.lc-report-card:hover{border-color:#c3a97c;box-shadow:0 3px 12px #283c5410}.lc-report-card:focus-visible{outline:2px solid #b69760;outline-offset:3px}.lc-report-card-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.lc-report-card-meta>span{background:#edf3fb;color:#5379a4;border-radius:4px;padding:3px 7px;font-size:12px}.lc-report-card-meta .report-type-维修{color:#a57736;background:#fcf4e6}.lc-report-card-meta .report-type-维保{color:#6972a4;background:#f0f0fa}.lc-report-card-meta .report-type-闭环{color:#50876e;background:#edf7f1}.lc-report-card-meta small{font-size:11px;color:#8a97a7}.lc-report-card h2{font-size:16px;line-height:1.65;color:#30465e;margin:15px 0 8px}.lc-report-card>p{font-size:13px;color:#75869a;line-height:1.75;margin:0 0 14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.lc-report-card dl{display:grid;grid-template-columns:60px 1fr;gap:8px 12px;font-size:12px;line-height:1.6;margin:0 0 18px}.lc-report-card dt{color:#8d99a9}.lc-report-card dd{margin:0;color:#597087}.lc-report-card footer{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:46px;border-top:1px solid #edf1f6;font-size:12px;color:#8c99aa}.lc-report-card footer button{border:0;background:none;color:#a37c40;font:inherit;cursor:pointer;padding:8px 0}.lc-report-empty{text-align:center;padding:50px 0;color:#7c8da1}.lc-report-empty strong{color:#4d647d}.lc-report-empty p{font-size:13px}@media(max-width:1300px){.lc-report-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:850px){.lc-report-cards{grid-template-columns:1fr}.lc-report-filters{align-items:stretch;flex-direction:column}.lc-report-filters label{display:block}.lc-report-filters label span{display:none}.lc-report-filters input{width:100%}.lc-report-library{padding:16px}.lc-library-heading>span{display:none}}
</style>
