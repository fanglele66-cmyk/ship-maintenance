<template>
 <main class="issues-page">
  <div class="issues-page-head"><BackButton label="返回船舶态势" @click="router.push('/situation')"/><h2>事项处置</h2></div>
  <section class="issues-browser">
   <IssueFilterToolbar>
    <label>设备<FormSelect v-model="device" :options="deviceOptions" placeholder=""/></label>
    <label>事项类型<FormSelect v-model="type" :options="typeOptions" placeholder=""/></label>
    <label>派发状态<FormSelect v-model="state" :options="stateOptions" placeholder=""/></label>
   </IssueFilterToolbar>
   <div ref="scrollRef" class="issues-scroll">
    <CaptainIssueRow v-for="item in visible" :key="item.id" :item="item" show-state @open="open"/>
    <div v-if="!filtered.length" class="empty"><strong>{{hasFilters?'没有符合筛选条件的事项':'当前没有未闭环事项'}}</strong><p>{{hasFilters?'可清除筛选条件，查看其他设备、事项类型或派发状态。':'已闭环记录保留在各设备的动态记录中，可返回态势查看设备情况。'}}</p><button v-if="hasFilters" class="p2-secondary" @click="clearFilters">清除筛选</button><button v-else class="p2-secondary" @click="router.push('/situation')">返回船舶态势</button></div>
    <button v-if="visible.length<filtered.length" class="load-more" @click="batch++">加载更多</button>
    <p v-else-if="filtered.length" class="list-end">已显示全部符合条件的事项</p>
   </div>
  </section>
 </main>
</template>
<script setup>
import {computed,ref,watch,onActivated,onDeactivated,nextTick} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {activeWorkbenchIssues,issueDevices,issueTypes,filterIssueRows,issueBatch} from '@/mock/captainWorkbench'
import FormSelect from '@/components/forms/FormSelect.vue'
import IssueFilterToolbar from '@/components/IssueFilterToolbar.vue'
import BackButton from '@/components/BackButton.vue'
import CaptainIssueRow from '@/components/CaptainIssueRow.vue'
const route=useRoute(),router=useRouter(),store=usePhase2DemoStore()
const state=ref(''),device=ref(''),type=ref(''),batch=ref(1),scrollRef=ref(null)
let savedScroll=0
const deviceOptions=[{value:'',label:'全部设备'},...issueDevices]
const typeOptions=[{value:'',label:'全部类型'},...issueTypes.map(value=>({value,label:value}))]
const stateOptions=[{value:'',label:'全部状态'},{value:'待决策',label:'待决策'},{value:'已派发',label:'已派发'}]
const filtered=computed(()=>filterIssueRows(activeWorkbenchIssues(store),{state:state.value,device:device.value,type:type.value}))
const visible=computed(()=>issueBatch(filtered.value,batch.value)),hasFilters=computed(()=>Boolean(device.value||type.value||state.value))
watch([state,device,type],()=>{batch.value=1;savedScroll=0;if(scrollRef.value)scrollRef.value.scrollTop=0})
function clearFilters(){state.value='';device.value='';type.value=''}
onActivated(async()=>{if(route.query.resume!=='1'){clearFilters();batch.value=1;savedScroll=0}await nextTick();if(scrollRef.value)scrollRef.value.scrollTop=savedScroll})
onDeactivated(()=>{if(scrollRef.value)savedScroll=scrollRef.value.scrollTop})
function open(item){savedScroll=scrollRef.value?.scrollTop||0;const context={from:'issues',state:state.value,device:device.value,type:type.value};if(item.state==='已派发'){store.selectTodo(item.id);router.push({path:'/event',query:{...context,todo:item.id}})}else router.push({path:'/situation/issue/'+item.id,query:context})}
</script>
<style scoped>
.issues-page{height:100%;width:100%;flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;padding:16px;background:#f3f5f8;box-sizing:border-box;overflow:hidden}
.issues-page-head{display:flex;gap:20px;align-items:center;padding:0 0 16px;flex-shrink:0}.issues-page-head h2{font-size:18px;font-weight:600;margin:0;color:#202020}
.issues-browser{width:100%;background:#fff;border-radius:8px;flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.issues-scroll{padding:0 24px;overflow:auto;flex:1;min-height:0;min-width:0;scrollbar-gutter:stable}
.empty{padding:48px 0;color:#718094;font-size:14px;line-height:1.8}.empty strong{color:#445870;font-weight:500}.empty button{margin:12px 12px 0 0}
.load-more{width:100%;border:0;background:#fff;padding:18px;color:#936821;cursor:pointer;font:inherit;font-size:13px}.load-more:hover{background:#faf9f6}.list-end{text-align:center;color:#8a94a5;font-size:12px;padding:14px}
@media(max-width:900px){.issues-scroll{padding:0 16px}}@media(max-width:560px){.issues-page{padding:12px}}
</style>
