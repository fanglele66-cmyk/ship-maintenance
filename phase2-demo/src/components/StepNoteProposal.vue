<template>
 <div class="step-note-message">
  <ModelThinking :text="message.reasoning" :status="message.status" :answer-started="!!response.text"/>
  <p v-if="response.text" :class="{'step-note-receipt':response.kind==='receipt'}" :role="response.kind==='receipt'?'status':undefined"><template v-if="response.kind==='receipt'"><template v-for="(part,index) in receiptParts" :key="index"><strong v-if="part==='下一步'" class="step-note-next">{{part}}</strong><template v-else>{{part}}</template></template></template><template v-else>{{response.text}}</template></p>
  <section v-if="response.kind==='draft'" class="step-note-proposal" :aria-label="`第 ${message.stepIndex+1} 步备注草稿`">
   <strong>本步骤备注草稿</strong>
   <p class="step-note-content">{{operationalText(response.note)}}</p>
   <small v-if="message.appliedAt||message.supersededAt" class="step-note-adoption">{{message.appliedAt?'已采用到本步骤':'已有更新草稿'}}</small>
  </section>
  <section v-if="message.status==='streaming'" class="step-note-progress" role="status" aria-live="polite" aria-busy="true"><p class="step-progress-running"><span class="step-progress-spinner" aria-hidden="true"/>正在生成回复…</p></section>
  <KnowledgeReferences v-if="message.status==='complete'" :sources="message.sources"/>
 </div>
</template>
<script setup>
import {computed} from 'vue'
import {operationalText} from '../workflow/operationalText.js'
import ModelThinking from './ModelThinking.vue'
import KnowledgeReferences from './KnowledgeReferences.vue'
const props=defineProps({message:{type:Object,required:true},disabled:Boolean})
defineEmits(['apply','revise'])
const response=computed(()=>props.message.response||{kind:'question',text:props.message.text||''})
const receiptParts=computed(()=>(response.value.text||'').split(/(下一步)/g))
</script>
<style scoped>
.step-note-message>p{margin:0 0 8px;white-space:pre-wrap}.step-note-message>p:last-child{margin-bottom:0}.step-note-proposal{margin-top:10px;padding-top:10px;border-top:1px solid #d9e7dc}.step-note-proposal>strong{font-size:12px;color:#54705d;font-weight:600}.step-note-content{margin:8px 0 12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75}.step-note-actions{display:flex;flex-wrap:wrap;gap:9px}.step-note-message .step-note-actions button{min-height:36px;font-size:13px;padding:8px 12px;background:#fff;border:1px solid #b5cbb9;border-radius:6px;color:#41624c;cursor:pointer}.step-note-actions button:first-child{background:#eef5ef}.step-note-actions button:disabled{opacity:.55;cursor:default}.step-note-receipt{color:#456a50}.step-note-next{display:inline-block;font-size:15px;font-weight:600;line-height:1.5;padding:1px 5px;border-radius:4px;background:#fff0c9;color:#a45d08;border:1px solid #efd59f}
.step-note-progress,.step-note-progress-history{margin-top:12px;font-size:12px;line-height:1.65;color:#758a7b}.step-progress-running{display:flex;align-items:center;gap:7px;margin:0 0 6px;color:#526f5a}.step-note-progress ol,.step-note-progress-history ol{padding-left:19px;margin:7px 0 0}.step-note-progress li,.step-note-progress-history li{padding:2px 0;overflow-wrap:anywhere}.step-note-progress .current{color:#45664d}.step-note-progress-history summary{cursor:pointer;color:#65806c}.step-progress-spinner{display:inline-block;width:11px;height:11px;border:2px solid #d5e4d8;border-top-color:#779c82;border-radius:50%;animation:step-progress-spin .9s linear infinite}@keyframes step-progress-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.step-progress-spinner{animation:none}}
</style>
