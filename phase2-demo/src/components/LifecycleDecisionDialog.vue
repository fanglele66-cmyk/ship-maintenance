<template>
 <Teleport to="body"><dialog ref="dialog" class="decision-dialog" :class="{'shore-dialog':action==='shore'}" aria-labelledby="decision-title" @click="outside" @cancel.prevent="close" @close="visible=false">
  <header><div><small>{{event.title}}</small><h2 id="decision-title">{{archive?'上报岸基报告':action==='shore'?'上报岸基':'轮机长决策'}}</h2></div><button type="button" aria-label="关闭决策弹窗" @click="close">×</button></header>
  <div class="decision-dialog-body"><LifecycleReport v-if="archive" :report="archive.syncedReport"/><LifecycleActionForm v-else-if="visible" :event="event" :show-basis="false" @submitted="submitted" @plan="showPlan"/></div>
 </dialog></Teleport>
</template>
<script setup>
import {computed,ref,watch,nextTick} from 'vue'
import LifecycleActionForm from './LifecycleActionForm.vue'
import LifecycleReport from './LifecycleReport.vue'
import {people} from '../workflow/eventLifecycle'
const props=defineProps({event:{type:Object,required:true}}),emit=defineEmits(['submitted','plan'])
const dialog=ref(null),visible=ref(false),archive=ref(null),action=computed(()=>props.event.decisionDraft?.action)
function open(selected){archive.value=null;props.event.decisionDraft||={action:'',reason:'',owner:people.engineer,dispatcher:people.captain,deadline:'',maintenancePlanId:'',window:''};if(selected)props.event.decisionDraft.action=selected;visible.value=true;nextTick(()=>!dialog.value?.open&&dialog.value?.showModal())}
function showReport(id){archive.value=props.event.shore.find(s=>s.id===id);visible.value=true;nextTick(()=>!dialog.value?.open&&dialog.value?.showModal())}
function close(){dialog.value?.close();visible.value=false;if(props.event.decisionDraft){delete props.event.decisionDraft.closureDraft;delete props.event.decisionDraft.observationPlan;props.event.decisionDraft.action=''}}
function outside(e){if(e.target===dialog.value){const r=dialog.value.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}}
function showPlan(action){close();emit('plan',action)}
function submitted(action){close();emit('submitted',action)}
watch(()=>props.event.id,close)
defineExpose({open,showReport})
</script>
<style scoped>
.decision-dialog :deep(.decision-choice-bar){display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.decision-dialog :deep(.decision-plan-link){margin-bottom:8px;padding:9px 11px;border:1px solid #ded6c5;border-radius:5px;font-size:12px;color:#92733f;background:#fffaf1;cursor:pointer}
.decision-dialog{margin:auto;inset:0;font-size:14px}.decision-dialog :deep(.decision-options label){flex-direction:row}.decision-dialog :deep(.lc-primary){border-radius:5px;border:1px solid #282a27;font:inherit;font-size:13px;cursor:pointer;line-height:1.5}.decision-dialog :deep(.lc-primary:disabled){opacity:.5;cursor:default}.decision-dialog :deep(button:focus-visible){outline:2px solid #b3945a;outline-offset:3px}
.decision-dialog{width:min(860px,calc(100vw - 40px));max-height:86vh;padding:0;border:1px solid #dfe2dd;border-radius:12px;color:#3c5067;background:#fff;box-shadow:0 24px 80px #17252d33}.decision-dialog::backdrop{background:#17252d70;backdrop-filter:blur(3px)}.decision-dialog>header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e8e9e4;background:#faf9f5}.decision-dialog h2{font-size:20px;margin:6px 0 0}.decision-dialog small{font-size:12px;color:#8492a3}.decision-dialog header button{border:0;background:transparent;color:#788596;font-size:26px;cursor:pointer}.decision-dialog-body{padding:24px;max-height:calc(86vh - 100px);overflow:auto}.decision-dialog :deep(.lc-form){margin:0}.decision-dialog :deep(.lc-plan-preview){grid-column:1/-1}.decision-dialog :deep(textarea){box-sizing:border-box}.decision-dialog :deep(.decision-options){grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;border:0;padding:0;margin:0 0 8px}.decision-dialog :deep(.decision-options legend){font-size:12px;color:#8995a4;margin-bottom:12px}.decision-dialog :deep(.decision-options label){display:flex;align-items:center;gap:7px;padding:10px 14px;border:1px solid #dedfd7;border-radius:7px;cursor:pointer;font-size:13px;background:#fff}.decision-dialog :deep(.decision-options label.selected){border-color:#bca574;background:#f8f3e9;color:#8c6b35}.decision-dialog :deep(.decision-options input){width:auto;accent-color:#a2834a}.decision-dialog :deep(.shore-editor){grid-column:1/-1}.decision-dialog :deep(.shore-editor textarea){min-height:72px;resize:vertical;font-size:13px;line-height:1.8}.decision-dialog :deep(.shore-title){font-size:14px;font-weight:600;color:#5f7182}
.decision-dialog.shore-dialog{width:min(640px,calc(100vw - 40px))}.shore-dialog :deep(.decision-choice-bar){display:none}.shore-dialog :deep(.shore-editor){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.shore-dialog :deep(.shore-editor>p),.shore-dialog :deep(.shore-editor>label:first-of-type),.shore-dialog :deep(.shore-editor>label:last-of-type){grid-column:1/-1}.shore-dialog :deep(.shore-editor>p){margin:0}.shore-dialog :deep(.shore-editor textarea){height:64px;min-height:64px}.shore-dialog .decision-dialog-body{padding:18px 24px}
@media(max-width:600px){.decision-dialog-body{padding:16px}.decision-dialog>header{padding:16px}.decision-dialog :deep(.lc-form){grid-template-columns:1fr}}
</style>
