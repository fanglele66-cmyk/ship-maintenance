<template>
 <main class="issues-page">
  <header class="issues-page-head">
   <div><h2>事件</h2><p>从研判、派发到执行与后续观测，保留完整事件记录。</p></div>
   <div class="directory-count"><strong>{{ rows.length }}</strong><span>项事件</span><i></i><span>{{ closedCount }} 项已闭环</span></div>
  </header>
  <section class="issues-browser" aria-label="事件目录">
   <IssueFilterToolbar>
    <label>设备<FormSelect v-model="device" :options="deviceOptions" placeholder="" aria-label="事件设备"/></label>
    <label>事件类型<FormSelect v-model="type" :options="typeOptions" placeholder="" aria-label="事件类型"/></label>
    <label>事件状态<FormSelect v-model="status" :options="eventStatusOptions" placeholder="" aria-label="事件状态"/></label>
    <button v-if="hasFilters" class="clear-filters" @click="clearFilters">清除筛选</button>
   </IssueFilterToolbar>
   <div ref="scrollRef" class="issues-scroll">
    <p class="result-count">共 {{ filtered.length }} 项<span>已闭环事件及完整处置记录保留在这里。</span></p>
    <div class="event-cards">
     <article v-for="item in visible" :key="item.id" class="event-card" :data-event-id="item.id">
      <div class="card-meta"><span class="event-type" :class="'rank-'+item.rank">{{item.type}}</span><span class="event-device">{{item.device}}</span></div>
      <button class="card-title" @click="open(item)">{{item.title}}<span aria-hidden="true">›</span></button>
      <p class="card-summary">{{item.summary}}</p>
      <dl class="event-progress">
       <div><dt>事件状态</dt><dd :class="{closed:item.eventState==='已闭环'}">{{item.eventState}}</dd></div>
       <div v-if="item.stage"><dt>当前记录</dt><dd>{{item.stage}}</dd></div>
       <div v-if="item.taskOwner"><dt>负责人</dt><dd>{{item.taskOwner}}</dd></div>
      </dl>
      <p class="progress-note">{{item.reference?'核实、复核与闭环签认过程可回查':item.progressNote}}</p>
      <p v-if="item.continuation" class="continuation">{{item.continuation}}</p>
      <footer class="card-footer">
       <span class="event-time">{{item.firstObserved || '保留原事件记录'}}</span>
       <div><button v-if="item.actionTaskId" class="task-link" @click="openTask(item)">查看待办</button><button class="detail-link" @click="open(item)">{{item.eventState==='已闭环'?'回看处置记录':'查看事件'}}<span aria-hidden="true"> ›</span></button></div>
      </footer>
     </article>
    </div>
    <div v-if="!filtered.length" class="empty"><strong>{{hasFilters?'没有符合筛选条件的事件':'当前没有事件记录'}}</strong><p>{{hasFilters?'可调整设备、类型或进度，已完成的事件记录仍会保留。':'后续报警、预警和异动跟踪将在这里汇集。'}}</p><button v-if="hasFilters" class="p2-secondary" @click="clearFilters">清除筛选</button></div>
    <button v-if="visible.length<filtered.length" class="load-more" @click="batch++">加载更多</button>
    <p v-else-if="filtered.length" class="list-end">已显示全部符合条件的事件</p>
   </div>
  </section>
 </main>
</template>
<script setup>
import {computed,ref,watch,onActivated,onDeactivated,nextTick} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {issueTypes,issueBatch} from '@/mock/captainWorkbench'
import {eventDirectoryRows,eventDirectoryDeviceOptions,filterEventDirectory,eventStatusOptions} from '@/mock/eventDirectory'
import {inSituationScope} from '@/mock/situationScope'
import FormSelect from '@/components/forms/FormSelect.vue'
import IssueFilterToolbar from '@/components/IssueFilterToolbar.vue'

const route=useRoute(),router=useRouter(),store=usePhase2DemoStore()
const device=ref(''),type=ref(''),status=ref(''),batch=ref(1),scrollRef=ref(null)
let savedScroll=0
const rows=computed(()=>eventDirectoryRows(store).filter(item=>route.query.scope!=='engines'||inSituationScope(item)))
const deviceOptions=computed(()=>eventDirectoryDeviceOptions(rows.value))
const typeOptions=[{value:'',label:'全部类型'},...issueTypes.map(value=>({value,label:value}))]
const filtered=computed(()=>filterEventDirectory(rows.value,{device:device.value,type:type.value,status:status.value}))
const visible=computed(()=>issueBatch(filtered.value,batch.value))
const closedCount=computed(()=>rows.value.filter(item=>item.eventState==='已闭环').length)
const hasFilters=computed(()=>Boolean(device.value||type.value||status.value))
watch([device,type,status],()=>{batch.value=1;savedScroll=0;if(scrollRef.value)scrollRef.value.scrollTop=0})
function clearFilters(){device.value='';type.value='';status.value=''}
function readFilters(){
 device.value=typeof route.query.device==='string'?route.query.device:''
 type.value=typeof route.query.type==='string'?route.query.type:''
 const legacy=route.query.state==='待决策'?'待决策':route.query.state==='已闭环'?'已闭环':route.query.state?'处置中':''
 status.value=eventStatusOptions.some(option=>option.value===route.query.status)?route.query.status:legacy
}
watch(()=>route.fullPath,()=>{if(route.path==='/issues')readFilters()})
onActivated(async()=>{readFilters();if(route.query.resume!=='1'){batch.value=1;savedScroll=0}await nextTick();if(scrollRef.value)scrollRef.value.scrollTop=savedScroll})
onDeactivated(()=>{if(scrollRef.value)savedScroll=scrollRef.value.scrollTop})
function context(){return {from:'issues',device:device.value,type:type.value,status:status.value,...(route.query.scope?{scope:route.query.scope}:{})}}
function open(item){savedScroll=scrollRef.value?.scrollTop||0;router.push({path:'/situation/issue/'+item.id,query:{...context(),...(item.eventState==='已闭环'?{tab:'处置记录'}:{})}})}
function openTask(item){if(!item.actionTaskId)return;savedScroll=scrollRef.value?.scrollTop||0;store.selectTodo(item.actionTaskId);router.push({path:'/event',query:{...context(),todo:item.actionTaskId}})}
</script>
<style scoped>
.issues-page{height:100%;width:100%;flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;padding:22px 24px 16px;background:#f3f5f8;box-sizing:border-box;overflow:hidden}
.issues-page-head{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:0 0 20px;flex-shrink:0}.issues-page-head h2{font-size:22px;font-weight:600;margin:0 0 7px;color:#202020}.issues-page-head p{font-size:13px;margin:0;color:#778397}.directory-count{display:flex;align-items:baseline;gap:7px;font-size:13px;color:#718094;white-space:nowrap}.directory-count strong{color:#263951;font-size:26px;font-weight:600}.directory-count i{height:14px;width:1px;background:#d4dce6;margin:0 7px}
.issues-browser{width:100%;background:#fff;border:1px solid #e6ebf2;border-radius:8px;flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}.clear-filters{border:0;background:none;color:#386eae;font:inherit;font-size:13px;cursor:pointer;padding:6px 0}.issues-scroll{padding:0 22px;overflow:auto;flex:1;min-height:0;min-width:0;scrollbar-gutter:stable}.result-count{display:flex;justify-content:space-between;gap:20px;color:#52647b;font-size:13px;margin:18px 0}.result-count span{color:#8a94a5;font-size:12px}
.event-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.event-card{border:1px solid #dfe6ef;border-radius:8px;padding:18px 18px 0;min-width:0;display:flex;flex-direction:column;background:#fff;transition:border-color .16s,box-shadow .16s}.event-card:hover{border-color:#b9cbe1;box-shadow:0 3px 12px #26395109}.card-meta{display:flex;align-items:center;gap:10px;font-size:12px;color:#718094}.event-type{padding:3px 8px;border-radius:4px;font-weight:500;line-height:1.5}.rank-0{color:#b93838;background:#fff0ef}.rank-1{color:#a56816;background:#fff5e5}.rank-2{color:#356fa4;background:#edf5fc}.history-mark{margin-left:auto;color:#8a94a5}.card-title{display:flex;align-items:start;justify-content:space-between;text-align:left;padding:0;margin:13px 0 0;border:0;background:none;color:#263951;font:inherit;font-size:16px;font-weight:600;line-height:1.65;cursor:pointer;gap:14px}.card-title:hover{color:#106bff}.card-title span{font-size:21px;color:#8a9bb1;font-weight:400;line-height:1.2}.card-summary{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;color:#68798e;line-height:1.75;margin:8px 0 16px;min-height:45px}.event-progress{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;padding:13px 0;border-top:1px solid #edf0f5;margin:0}.event-progress>div{display:flex;gap:12px;min-width:0;font-size:12px;line-height:1.7}.event-progress dt{color:#8a94a5;white-space:nowrap}.event-progress dd{margin:0;color:#3e536e;overflow-wrap:anywhere}.event-progress dd.closed{color:#39815e}.progress-note{font-size:12px;color:#7c8ba0;margin:0 0 12px}.continuation{font-size:12px;color:#5f7691;background:#f4f7fb;border-radius:4px;padding:9px 10px;margin:0 0 14px;line-height:1.6}.card-footer{margin-top:auto;border-top:1px solid #edf0f5;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:49px;font-size:12px}.event-time{color:#8a94a5;overflow-wrap:anywhere}.card-footer>div{display:flex;align-items:center;gap:16px;flex-shrink:0}.card-footer button{border:0;background:none;font:inherit;cursor:pointer;padding:8px 0}.task-link{color:#6c7f98}.detail-link{color:#286ab3}.card-footer button:hover{text-decoration:underline}.card-title:focus-visible,.card-footer button:focus-visible{outline:2px solid #106bff;outline-offset:4px;border-radius:3px}
.empty{padding:48px 0;color:#718094;font-size:14px;line-height:1.8}.empty strong{color:#445870;font-weight:500}.empty button{margin:12px 12px 0 0}.load-more{width:100%;border:0;background:#fff;padding:18px;color:#286ab3;cursor:pointer;font:inherit;font-size:13px}.load-more:hover{background:#f6f8fc}.list-end{text-align:center;color:#8a94a5;font-size:12px;padding:16px;margin:0}
@media(min-width:1650px){.event-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1000px){.issues-page{padding:16px}.issues-scroll{padding:0 16px}.event-cards{grid-template-columns:1fr}.result-count span{max-width:65%;text-align:right}.directory-count{display:none}}@media(max-width:560px){.issues-page{padding:12px}.issues-page-head p{line-height:1.7}.event-progress{grid-template-columns:1fr}.card-footer{align-items:start;padding:10px 0}.card-footer>div{gap:10px}.card-footer button{padding:0}.result-count span{display:none}}
</style>
