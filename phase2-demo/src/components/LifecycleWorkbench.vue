<template>
 <section class="lc-board compact" aria-label="值得关注">
  <header><h2>值得关注</h2></header>
  <nav class="lc-tabs" aria-label="值得关注分类"><button v-for="name in boardTabs" :key="name" :class="{active:tab===name}" @click="tab=name">{{name}} <small v-if="name==='待决策'&&captain">{{store.pending.length}}</small></button></nav>
  <div v-if="tab==='报告'" class="lc-board-list"><article v-for="report in reports" :key="report.id" class="lc-board-row lc-clickable" role="link" tabindex="0" :aria-label="report.title" @click="router.push('/reports/'+report.id)" @keydown.enter.self="router.push('/reports/'+report.id)"><div><small>{{report.kind}} · {{report.owner}} · {{timeText(report.at)}}</small><h3>{{report.title}}</h3><p>{{report.summary}}</p></div><button @click.stop="router.push('/reports/'+report.id)">查看详情 →</button></article></div>
  <div v-else class="lc-board-list"><article v-for="e in events" :key="e.id" class="lc-board-row lc-clickable" role="link" tabindex="0" :aria-label="e.title" @click="openEvent(e)" @keydown.enter.self="openEvent(e)"><div><small><i v-if="e.unread[store.state.role]" class="lc-unread"/>{{e.device}} · <span class="lc-type" :class="'type-'+typeRank(e.type)">{{e.type}}</span> · {{e.status}} · {{e.number}}</small><h3>{{e.title}}</h3><p>{{rowSummary(e)}}</p></div><button @click.stop="openEvent(e)">查看详情 →</button></article><p v-if="!events.length" class="lc-empty">{{tab==='待决策'?(captain?'当前没有待决策事项。':'风险提醒由轮机长决策，已分派任务请查看“我的任务”。'):captain?'当前没有处置中的事件。':'当前没有待执行任务。'}}</p></div>
  <footer class="lc-board-footer"><button @click="router.push(tab==='报告'?'/reports':'/event')">{{tab==='报告'?'查看全部报告':'查看全部待办'}} →</button></footer>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useRouter,useRoute} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {currentTask,timeText,activeTask} from '../workflow/eventLifecycle'
const store=useEventLifecycleStore(),router=useRouter(),route=useRoute(),captain=computed(()=>store.state.role==='captain')
const tab=ref(route.query.view==='reports'?'报告':captain.value?'待决策':'我的任务')
const boardTabs=computed(()=>captain.value?['待决策','处置中','报告']:['我的任务','报告'])
const events=computed(()=>tab.value==='待决策'?store.pending:captain.value?store.events.filter(e=>!['reminder','closed'].includes(e.phase)):store.events.filter(e=>activeTask(e)))
const reports=computed(()=>store.reports.filter(r=>r.kind!=='工况报告'))
const typeRank=type=>['报警事件','预警事件','异动跟踪'].indexOf(type)
function openEvent(e){if(!captain.value&&activeTask(e)){router.push('/tasks/'+activeTask(e).id);return}router.push({path:'/situation/issue/'+e.id,query:{from:'workbench'}})}
function rowSummary(e){const t=currentTask(e);return e.phase==='reminder'?e.brief.conclusion:e.reports.at(-1)?.summary||t.owner+' · 要求 '+timeText(t.deadline)+' 前完成 · '+t.draft.records.filter(r=>r.result).length+' / '+t.steps.length+' 项已填写'}
watch(()=>store.state.role,()=>tab.value=captain.value?'待决策':'我的任务')
watch(()=>route.query.view,value=>{if(value==='reports')tab.value='报告'},{immediate:true})
</script>
