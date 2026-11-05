<template>
 <div class="step-note-message">
  <p v-if="response.text" :class="{'step-note-receipt':response.kind==='receipt'}" :role="response.kind==='receipt'?'status':undefined">{{response.text}}</p>
  <section v-if="response.kind==='draft'" class="step-note-proposal" :aria-label="`第 ${message.stepIndex+1} 步备注草稿`">
   <strong>本步骤备注草稿</strong>
   <p class="step-note-content">{{response.note}}</p>
   <div class="step-note-actions">
    <button type="button" :disabled="disabled||!!message.appliedAt||!!message.supersededAt" @click="$emit('apply',message.id)">{{message.appliedAt?'已采用到本步骤':message.supersededAt?'已有更新草稿':'采用到本步骤'}}</button>
    <button type="button" :disabled="disabled" @click="$emit('revise',message)">继续修改</button>
   </div>
  </section>
  <p v-if="message.status==='streaming'" class="step-note-progress" role="status">{{message.progress||'正在结合本步骤记录整理…'}}</p>
 </div>
</template>
<script setup>
import {computed} from 'vue'
const props=defineProps({message:{type:Object,required:true},disabled:Boolean})
defineEmits(['apply','revise'])
const response=computed(()=>props.message.response||{kind:'question',text:props.message.text||''})
</script>
<style scoped>
.step-note-message>p{margin:0 0 8px;white-space:pre-wrap}.step-note-message>p:last-child{margin-bottom:0}.step-note-proposal{margin-top:10px;padding-top:10px;border-top:1px solid #d9e7dc}.step-note-proposal>strong{font-size:12px;color:#54705d;font-weight:600}.step-note-content{margin:8px 0 12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75}.step-note-actions{display:flex;flex-wrap:wrap;gap:8px}.step-note-actions button{font-size:12px;padding:6px 9px;background:#fff;border:1px solid #b5cbb9;border-radius:6px;color:#41624c;cursor:pointer}.step-note-actions button:first-child{background:#eef5ef}.step-note-actions button:disabled{opacity:.55;cursor:default}.step-note-progress{font-size:12px;color:#78907e}.step-note-receipt{color:#456a50}
</style>
