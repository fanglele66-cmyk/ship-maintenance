<template>
 <section class="lc-board compact" aria-label="值得关注">
  <header><h2>值得关注</h2></header>
  <nav class="lc-tabs" aria-label="值得关注分类"><button v-for="name in boardTabs" :key="name" :class="{active:tab===name}" @click="tab=name">{{name}} <small v-if="name==='待决策'&&captain">{{store.pending.length}}</small></button></nav>
  <div class="lc-board-list"><article v-for="item in boardItems" :key="item.id" class="lc-board-row lc-clickable" role="link" tabindex="0" :aria-label="item.title" @click="router.push(item.location)" @keydown.enter.self="router.push(item.location)"><div><small>{{item.device||store.state.events[item.eventId]?.device}} · <span class="lc-type" :class="'type-'+typeRank(item.eventType)">{{item.eventType}}</span> · {{item.kind==='decision'?decisionStage(store.state.events[item.eventId]):item.status}} · {{item.eventNumber}}</small><h3>{{item.kind==='task'?item.title:item.eventTitle}}</h3><p class="board-progress">{{workbenchDetails(store.state.events[item.eventId],item).join(' · ')}}</p><p>{{item.waiting?'等待原因：':''}}{{item.summary}}</p></div><button @click.stop="router.push(item.location)">{{item.actionLabel}} →</button></article><p v-if="!boardItems.length" class="lc-empty">当前没有{{tab}}事项。</p></div>
  <footer class="lc-board-footer"><button @click="router.push('/situation/todos')">查看全部待办 →</button></footer>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useRouter,useRoute} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {decisionStage,workbenchDetails,processingWorkItems} from '../workflow/workbenchDetails.js'
const store=useEventLifecycleStore(),router=useRouter(),route=useRoute(),captain=computed(()=>store.state.role==='captain')
const tab=ref(captain.value?'待决策':'我的任务')
const boardTabs=computed(()=>captain.value?['待决策','处置中']:['我的任务'])
const boardItems=computed(()=>tab.value==='处置中'?processingWorkItems(store.events):store.workItems.pending)
const typeRank=type=>['报警事件','预警事件','异动跟踪','效果观察'].indexOf(type)
watch(()=>store.state.role,()=>tab.value=captain.value?'待决策':'我的任务')
watch(()=>route.query.view,value=>{if(value==='reports')router.replace('/reports')},{immediate:true})
</script>
<style scoped>
.board-progress{color:#5c6f74!important;margin:7px 0!important;font-size:14px!important}
</style>
