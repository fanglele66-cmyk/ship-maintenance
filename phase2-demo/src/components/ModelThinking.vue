<template>
 <details v-if="text?.trim()" class="model-thinking" :open="status==='streaming'&&!answerStarted">
  <summary>思考过程<small v-if="status==='streaming'&&!answerStarted">正在思考…</small><small v-else-if="status==='interrupted'||status==='error'">已中断</small></summary>
  <p class="model-thinking-text">{{text}}</p>
 </details>
</template>
<script setup>
defineProps({text:{type:String,default:''},status:String,answerStarted:Boolean})
</script>
<style scoped>
.model-thinking{margin:8px 0 12px;color:#819082;font-size:12px;line-height:1.75}.model-thinking summary{cursor:pointer;color:#718374}.model-thinking summary small{margin-left:8px;font-size:11px;color:#98a298}.model-thinking-text{white-space:pre-wrap;overflow-wrap:anywhere;padding:6px 0 6px 12px;margin:6px 0 0;border-left:2px solid #dce5dd;max-height:280px;overflow:auto}
</style>
