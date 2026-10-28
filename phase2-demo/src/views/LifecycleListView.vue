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
   <div  class="issues-scroll">
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
    <p v-if="filtered.length" class="list-end">已显示全部符合条件的事件</p>
   </div>
  </section>
 </main>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {historicalDecisions} from '../mock/fourStoryWorkflow'
import {currentTask,activeTask,timeText,stageNames} from '../workflow/eventLifecycle'
import FormSelect from '../components/forms/FormSelect.vue'
import IssueFilterToolbar from '../components/IssueFilterToolbar.vue'
const store=useEventLifecycleStore(),router=useRouter(),device=ref(''),type=ref(''),status=ref('')
const history=historicalDecisions.filter(e=>!e.parentIssueId).map(e=>({...e,rank:1,summary:e.reason,eventState:'已闭环',firstObserved:e.at,reference:true}))
const rows=computed(()=>[...store.events.map(e=>({...e,rank:['报警事件','预警事件','异动跟踪'].indexOf(e.type),summary:e.brief.conclusion,eventState:e.status,stage:stageNames[e.phase],taskOwner:currentTask(e)?.owner,progressNote:e.tasks.length?e.tasks.length+' 项关联任务 · '+e.tasks.filter(t=>t.status==='submitted').length+' 项已提交':'尚未建立人工执行任务',firstObserved:timeText(e.brief.discovery.at),actionTaskId:activeTask(e)?.id,continuation:['decision','review'].includes(e.phase)?'执行结果已回交，等待轮机长审阅报告并决定后续安排。':''})),...(store.state.role==='captain'?history:[])])
const deviceOptions=computed(()=>[{value:'',label:'全部设备'},...[...new Set(rows.value.map(e=>e.device))].map(value=>({value,label:value}))])
const typeOptions=[{value:'',label:'全部类型'},...['报警事件','预警事件','异动跟踪'].map(value=>({value,label:value}))]
const eventStatusOptions=[{value:'',label:'全部事件状态'},...['待决策','排查中','待处置决策','维修中','维保执行中','待结果处置','已闭环'].map(value=>({value,label:value}))]
const filtered=computed(()=>rows.value.filter(e=>(!device.value||e.device===device.value)&&(!type.value||e.type===type.value)&&(!status.value||e.eventState===status.value))),visible=filtered
const closedCount=computed(()=>rows.value.filter(e=>e.eventState==='已闭环').length),hasFilters=computed(()=>Boolean(device.value||type.value||status.value))
function clearFilters(){device.value='';type.value='';status.value=''}
function open(e){router.push({path:'/situation/issue/'+e.id,query:{from:'issues'}})}
function openTask(e){router.push({path:'/situation/issue/'+e.id,query:{from:'tasks'}})}
</script>
<style scoped>
.issues-page{height:100%;width:100%;flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;padding:22px 24px 16px;background:#f3f5f8;box-sizing:border-box;overflow:hidden}
.issues-page-head{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:0 0 20px;flex-shrink:0}.issues-page-head h2{font-size:var(--wb-title);font-weight:600;margin:0 0 7px;color:#202020}.issues-page-head p{font-size:var(--wb-body);margin:0;color:#778397}.directory-count{display:flex;align-items:baseline;gap:7px;font-size:var(--wb-body);color:#718094;white-space:nowrap}.directory-count strong{color:#263951;font-size:calc(var(--wb-title) + 4px);font-weight:600}.directory-count i{height:14px;width:1px;background:#d4dce6;margin:0 7px}
.issues-browser{width:100%;background:#fff;border:1px solid #e6ebf2;border-radius:8px;flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}.clear-filters{border:0;background:none;color:#386eae;font:inherit;font-size:var(--wb-body);cursor:pointer;padding:6px 0}.issues-scroll{padding:0 22px;overflow:auto;flex:1;min-height:0;min-width:0;scrollbar-gutter:stable}.result-count{display:flex;justify-content:space-between;gap:20px;color:#52647b;font-size:var(--wb-body);margin:18px 0}.result-count span{color:#8a94a5;font-size:var(--wb-label)}
.event-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.event-card{border:1px solid #dfe6ef;border-radius:8px;padding:18px 18px 0;min-width:0;display:flex;flex-direction:column;background:#fff;transition:border-color .16s,box-shadow .16s}.event-card:hover{border-color:#b9cbe1;box-shadow:0 3px 12px #26395109}.card-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:var(--wb-label);color:#718094}.event-type{padding:3px 8px;border-radius:4px;font-weight:500;line-height:1.5}.rank-0{color:#b93838;background:#fff0ef}.rank-1{color:#a56816;background:#fff5e5}.rank-2{color:#356fa4;background:#edf5fc}.history-mark{margin-left:auto;color:#8a94a5}.card-title{display:flex;align-items:start;justify-content:space-between;text-align:left;padding:0;margin:13px 0 0;border:0;background:none;color:#263951;font:inherit;font-size:calc(var(--wb-body) + 2px);font-weight:600;line-height:1.65;cursor:pointer;gap:14px}.card-title:hover{color:#106bff}.card-title span{font-size:21px;color:#8a9bb1;font-weight:400;line-height:1.2}.card-summary{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:var(--wb-body);color:#68798e;line-height:1.75;margin:8px 0 16px;min-height:45px}.event-progress{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;padding:13px 0;border-top:1px solid #edf0f5;margin:0}.event-progress>div{display:flex;gap:12px;min-width:0;font-size:var(--wb-label);line-height:1.7}.event-progress dt{color:#8a94a5;white-space:nowrap}.event-progress dd{margin:0;color:#3e536e;overflow-wrap:anywhere}.event-progress dd.closed{color:#39815e}.progress-note{font-size:var(--wb-label);color:#7c8ba0;margin:0 0 12px}.continuation{font-size:var(--wb-label);color:#5f7691;background:#f4f7fb;border-radius:4px;padding:9px 10px;margin:0 0 14px;line-height:1.6}.card-footer{flex-wrap:wrap;row-gap:6px;margin-top:auto;border-top:1px solid #edf0f5;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:49px;font-size:var(--wb-label)}.event-time{color:#8a94a5;overflow-wrap:anywhere}.card-footer>div{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;min-width:0}.card-footer button{border:0;background:none;font:inherit;cursor:pointer;padding:8px 0}.task-link{color:#6c7f98}.detail-link{color:#286ab3}.card-footer button:hover{text-decoration:underline}.card-title:focus-visible,.card-footer button:focus-visible{outline:2px solid #106bff;outline-offset:4px;border-radius:3px}
.empty{padding:48px 0;color:#718094;font-size:var(--wb-body);line-height:1.8}.empty strong{color:#445870;font-weight:500}.empty button{margin:12px 12px 0 0}.load-more{width:100%;border:0;background:#fff;padding:18px;color:#286ab3;cursor:pointer;font:inherit;font-size:var(--wb-body)}.load-more:hover{background:#f6f8fc}.list-end{text-align:center;color:#8a94a5;font-size:var(--wb-label);padding:16px;margin:0}
@media(min-width:1650px){.event-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1000px){.issues-page{padding:16px}.issues-scroll{padding:0 16px}.event-cards{grid-template-columns:1fr}.result-count span{max-width:65%;text-align:right}.directory-count{display:none}}@media(max-width:560px){.issues-page{padding:12px}.issues-page-head p{line-height:1.7}.event-progress{grid-template-columns:1fr}.card-footer{align-items:start;padding:10px 0}.card-footer>div{gap:10px}.card-footer button{padding:0}.result-count span{display:none}}
</style>
