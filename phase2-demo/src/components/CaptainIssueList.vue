<template><section class="captain-issues"><ModuleHeader :title="title"><FormSelect v-if="!deviceId" v-model="device" :options="[{value:'',label:'全部设备'},...issueDevices]" placeholder="" aria-label="事件设备范围"/></ModuleHeader><nav class="issue-states" aria-label="事件处理状态"><button v-for="value in ['待决策','处置中']" :key="value" :class="{active:state===value}" :aria-pressed="state===value" @click="state=value">{{value}}</button></nav><div class="issue-list"><CaptainIssueRow v-for="item in visible" :key="item.id" :item="item" :compact="compact" @open="open"/><div v-if="!filtered.length" class="issue-empty"><strong>{{emptyTitle}}</strong><p>{{emptyText}}</p><div><button v-if="alternateCount" class="text-link" @click="state=alternate">查看{{alternate}}事件</button><button class="text-link" @click="router.push('/event')">进入待办中心</button></div></div></div><button class="issue-more" @click="viewAll">查看全部事件</button></section></template>
<script setup>
import FormSelect from './forms/FormSelect.vue'
import ModuleHeader from './ModuleHeader.vue'
import CaptainIssueRow from './CaptainIssueRow.vue'
import {computed,ref} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {workbenchIssues,issueDevices as allIssueDevices} from '@/mock/captainWorkbench'
import {matchesSituationDevice} from '@/mock/situationScope'
const props=defineProps({compact:Boolean,deviceId:String,deviceIds:Array,deviceOptions:Array,types:Array,limit:{type:Number,default:5},title:{type:String,default:'事件处置'}})
const store=usePhase2DemoStore(),router=useRouter(),state=ref('待决策'),device=ref('')
const issueDevices=computed(()=>props.deviceOptions||allIssueDevices)
const rows=computed(()=>workbenchIssues(store).filter(i=>i.eventState!=='已闭环'&&(!props.deviceIds||props.deviceIds.includes(i.deviceId))&&(!props.deviceId||i.deviceId===props.deviceId)&&matchesSituationDevice(i,device.value)&&(!props.types||props.types.includes(i.type))))
const filtered=computed(()=>rows.value.filter(i=>i.eventState===state.value)),visible=computed(()=>filtered.value.slice(0,props.limit))
const alternate=computed(()=>state.value==='待决策'?'处置中':'待决策'),alternateCount=computed(()=>rows.value.filter(i=>i.eventState===alternate.value).length)
const emptyTitle=computed(()=>state.value==='待决策'?(alternateCount.value?'当前事件正在处置中':'当前没有待决策事件'):'当前没有处置中事件')
const emptyText=computed(()=>alternateCount.value?(state.value==='待决策'?'可查看事件处置记录，沿原任务跟进现场反馈。':'仍有事件等待决定，可先核对分析依据，再安排负责人。'):'暂无需要决策或正在处置的事件，已闭环记录保留在事件目录。')
function open(item){router.push({path:'/situation/issue/'+item.id,query:{from:'workbench'}})}
function viewAll(){router.push({path:'/issues',query:{...(props.deviceIds?{scope:'engines'}:{}),...(props.deviceId||device.value?{device:props.deviceId||device.value}:{})}})}
</script>
<style scoped>.captain-issues{display:flex;flex-direction:column;min-height:0;background:#fff;border-radius:8px;overflow:hidden}.text-link{border:0;background:transparent;color:#8b682d;font:inherit;font-size:13px;cursor:pointer;padding:5px 0}.text-link:hover{text-decoration:underline}.issue-states{display:flex;gap:24px;padding:0 22px;border-bottom:1px solid #e6ebf2}.issue-states button{border:0;background:none;padding:10px 0;font:inherit;font-size:14px;color:#738094;cursor:pointer}.issue-states button.active{color:#936821;border-bottom:2px solid #b49359}.issue-states span{margin-left:6px;font-size:12px}.issue-list{overflow:auto;min-height:0;flex:1;padding:0 22px}.issue-more{border:0;border-top:1px solid #edf0f5;background:#fff;padding:12px;cursor:pointer;color:#936821;font:inherit;font-size:13px}.issue-empty{padding:28px 0;color:#77869a;font-size:14px;line-height:1.8}.issue-empty strong{color:#445870;font-weight:500}.issue-empty p{margin:8px 0 14px}.issue-empty>div{display:flex;gap:24px;flex-wrap:wrap}@media(max-width:1100px){.issue-states,.issue-list{padding-left:16px;padding-right:16px}}</style>
<style scoped>
.captain-issues{align-self:start;width:100%;max-height:100%;box-sizing:border-box}
.captain-issues :deep(.module-header),.issue-states{flex-shrink:0}
.issue-list{flex:0 1 auto;scrollbar-gutter:stable}
.issue-more{flex:0 0 auto;min-height:44px;display:flex;align-items:center;justify-content:center}
</style>
