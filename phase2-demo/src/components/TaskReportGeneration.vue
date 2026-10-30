<template>
 <section class="task-report-generation" aria-live="polite" :aria-busy="task.status==='reporting'">
  <h2>{{task.status==='reporting'?'AI 正在生成本轮报告':'报告生成未完成'}}</h2>
  <p role="status">{{task.status==='reporting'?task.reportGeneration.progress?.label:task.reportGeneration.error}}</p>
  <p class="lc-muted">原始反馈已保存，完整报告生成后交轮机长审阅。</p>
  <MarkdownContent v-if="preview" :content="preview"/>
  <button v-if="task.status==='report-error'&&store.state.role==='engineer'" class="lc-primary" @click="retry">重新生成报告</button>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import MarkdownContent from './MarkdownContent.vue'
import {generatedPreview} from '../workflow/generatedReport'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
const props=defineProps({event:Object,task:Object}),emit=defineEmits(['submitted']),store=useEventLifecycleStore()
const preview=computed(()=>generatedPreview(props.task.reportGeneration?.patch))
async function retry(){try{await store.submit(props.event.id,props.task.id);emit('submitted')}catch{ /* Error and partial content remain in the persisted generation state. */ }}
</script>
<style scoped>
.task-report-generation{padding:18px 22px;background:#faf9f5;border:1px solid #e8e1d5;border-radius:8px;margin:14px 0;color:#65768a}.task-report-generation h2{font-size:16px;margin:0 0 8px;color:#80683d}.task-report-generation>p{font-size:13px}.task-report-generation :deep(.markdown-content){font-size:14px;line-height:1.8}
</style>
