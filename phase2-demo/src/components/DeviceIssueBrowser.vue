<template>
 <section class="device-issues">
  <IssueFilterToolbar>
   <label>事项类型<FormSelect v-model="type" :options="typeOptions" placeholder="" /></label>
   <label>事项状态<FormSelect v-model="state" :options="stateOptions" placeholder="" /></label>
  </IssueFilterToolbar>
  <div class="device-issue-content">
   <div v-if="deviceId==='main-engine-1' && (!type || type==='维保建议')" class="plan-entry"><strong>已有维保安排</strong><button class="p2-secondary" @click="router.push('/situation/maintenance/planned')">核对已有安排</button></div>
   <div v-for="item in rows" :key="item.id"><CaptainIssueRow :item="item" :show-device="false" :next-label="isTrackingDossier(item.id)?'查看跟踪档案':undefined" @open="open" /><button v-if="isTrackingDossier(item.id)&&store.todoCreated[item.id]" class="p2-link-button" style="margin:0 0 12px" @click="store.selectTodo(item.targetEventId||item.id);router.push({path:'/event',query:{todo:item.targetEventId||item.id}})">查看关联待办进展 →</button></div>
   <div v-if="!rows.length" class="empty"><strong>当前没有{{state}}的{{type || '事项'}}</strong><p>可切换事项类型或状态查看其他记录。</p><button class="p2-secondary" @click="$emit('overview')">查看健康概览</button></div>
  </div>
 </section>
</template>
<script setup>
import {isTrackingDossier} from '@/utils/trackingNavigation'
import {issueDetailPath} from '@/utils/maintenanceNavigation'
import {computed,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {issueTypes} from '@/mock/captainWorkbench'
import {deviceIssueRows,deviceIssueStates} from '@/mock/deviceIssueContext'
import CaptainIssueRow from './CaptainIssueRow.vue'
import FormSelect from './forms/FormSelect.vue'
import IssueFilterToolbar from './IssueFilterToolbar.vue'
const props=defineProps({deviceId:String,initialType:{type:String,default:''},initialState:{type:String,default:'待决策'}})
defineEmits(['overview'])
const router=useRouter(),store=usePhase2DemoStore(),type=ref(props.initialType),state=ref(props.initialState)
const typeOptions=[{value:'',label:'全部类型'},...issueTypes.map(value=>({value,label:value}))]
const stateOptions=deviceIssueStates.map(value=>({value,label:value}))
watch(()=>props.initialType,value=>{type.value=value});watch(()=>props.initialState,value=>{state.value=value})
watch(()=>props.deviceId,()=>{type.value='';state.value='待决策'})
const rows=computed(()=>deviceIssueRows(store,props.deviceId,type.value,state.value))
function open(item){if(!isTrackingDossier(item.id)&&(item.state==='已派发'||item.state==='已闭环')){store.selectTodo(item.targetEventId||item.id);router.push({path:'/event',query:{todo:item.targetEventId||item.id}})}else router.push({path:issueDetailPath(item.id),query:{from:'device',device:props.deviceId,type:type.value,state:state.value,scroll:String(document.querySelector('.p2-device-scroll')?.scrollTop||0)}})}
</script>
<style scoped>
.device-issues{background:white;border-radius:8px;min-height:240px;min-width:0;overflow:hidden}
.device-issue-content{padding:0 24px 22px;min-width:0}
.empty{padding:28px 0;color:#718094;font-size:14px;line-height:1.8}.empty strong{color:#445870;font-weight:500}
.plan-entry{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 0;color:#445870;font-size:14px;border-bottom:1px solid #edf0f5}.plan-entry strong{font-weight:500}
@media(max-width:900px){.device-issue-content{padding-left:16px;padding-right:16px}}
</style>
