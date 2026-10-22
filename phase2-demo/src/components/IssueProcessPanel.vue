<template>
 <section class="issue-process-panel" aria-label="事件完整处置过程">
  <header class="process-intro"><strong>{{ process.reference?.label || '本事件人机处置记录' }}</strong><p>{{process.reference?.boundary || '按实际来源和已提交的行动依次展示；尚未发生的派发、执行或闭环不会提前补入。'}}</p></header>
  <article v-for="(record,index) in process.records" :key="record.id" class="process-record" :data-process-phase="record.phase">
   <div class="process-phase"><span>{{String(index+1).padStart(2,'0')}}</span><strong>{{record.phase}}</strong><time>{{record.at || '起始研判'}}</time></div>
   <p class="process-actor">{{record.actor}}</p>
   <MessageRenderer :message="{id:record.id,role:record.role,kind:record.role==='assistant'?'scene':undefined,title:record.title,text:record.text,markdown:record.role==='assistant'?record.text:undefined,expanded:true}" expanded/>
   <p v-if="record.role==='user'" class="process-action-title">{{record.title}}</p>
   <MessageRenderer v-if="record.assessment" :message="{id:record.id+':assessment',role:'assistant',kind:'scene',title:'依据本步反馈的判断',markdown:record.assessment,expanded:true}" expanded/>
  </article>
  <p v-if="!process.records.length" class="process-empty">尚无已提交的处置记录。</p>
  <button class="process-ask" type="button" @click="$emit('ask')">询问本事件的依据与后续安排</button>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {eventProcessRecords} from '@/mock/eventProcessRecords'
import MessageRenderer from './messages/MessageRenderer.vue'
const props=defineProps({issueId:String}),store=usePhase2DemoStore()
const process=computed(()=>eventProcessRecords(store,props.issueId))
defineEmits(['ask'])
</script>
<style scoped>
.issue-process-panel{flex:1;min-height:0;overflow:auto;padding:14px 14px 20px;scrollbar-gutter:stable;background:#fafbfe}.process-intro{padding:12px;border:1px solid #dce5f1;background:#f1f6fc;border-radius:7px;margin-bottom:18px}.process-intro strong{font-size:13px;color:#345777}.process-intro p{font-size:12px;line-height:1.75;color:#6c7c91;margin:6px 0 0}.process-record{padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #e3e9f2}.process-phase{display:flex;align-items:center;gap:8px;color:#54708f;font-size:12px}.process-phase>span{font:11px ui-monospace,monospace;color:#7d94ae}.process-phase time{margin-left:auto;color:#8b99ac;font-size:10px}.process-actor{font-size:11px;color:#8190a3;margin:9px 0}.process-action-title{font-size:11px;color:#788aa0;margin:0 0 8px;text-align:right}.process-record :deep(.p2-message){margin-top:9px}.process-record :deep(.p2-bubble){min-width:0}.process-record :deep(.p2-message.user){display:flex;justify-content:flex-end}.process-record :deep(.markdown-content){font-size:13px}.process-record :deep(.p2-scene-details h3){font-size:13px}.process-ask{width:100%;padding:11px;border:1px solid #cbd9ea;border-radius:6px;background:#fff;color:#356b9f;font:inherit;font-size:12px;cursor:pointer}.process-empty{color:#8190a3;font-size:13px}
</style>
