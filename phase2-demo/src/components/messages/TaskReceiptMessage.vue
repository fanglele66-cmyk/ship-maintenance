<template>
  <article class="p2-task-receipt" :aria-label="message.title + '任务回执'">
    <header class="p2-task-receipt-head"><h3>{{ message.title }}</h3><span class="p2-task-receipt-status" :data-status="message.executionStatus">{{ labels[message.executionStatus] }}</span></header>
    <p class="p2-task-receipt-time">{{ message.completedAt }} · {{ message.triggerLabel || '定时执行' }}</p>
    <dl class="p2-task-receipt-facts"><div><dt>分析对象</dt><dd>{{ message.subject }}</dd></div><div><dt>分析范围</dt><dd>{{ message.analysisRange }}</dd></div></dl>
    <section><h4>本次结论</h4><p>{{ message.conclusion }}</p></section>
    <section v-if="message.change"><h4>较上次变化</h4><p>{{ message.change }}</p></section>
    <section class="p2-task-receipt-next"><h4>{{ message.requiresAction ? '需要你处理' : '当前安排' }}</h4><p>{{ message.arrangement }}</p></section>
    <p v-if="message.dataLimit" class="p2-task-receipt-limit">{{ message.dataLimit }}</p>
    <footer v-if="message.actions?.length"><button v-for="action in message.actions" :key="action.id" type="button" @click="$emit('action',action.id)">{{ action.label }}</button></footer>
  </article>
</template>
<script setup>
defineProps({message:{type:Object,required:true}})
defineEmits(['action'])
const labels={completed:'已完成',partial:'部分完成',failed:'未完成'}
</script>
