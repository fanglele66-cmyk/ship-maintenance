<template>
  <details class="p2-scene-details" :open="message.expanded ?? (daily ? false : expanded)">
    <summary><h3>{{ message.title }}</h3><p v-if="daily" class="p2-push-preview">{{ message.paragraphs?.[0]?.text }}</p><span v-if="daily" class="p2-push-toggle"></span></summary>
    <div v-for="(paragraph,i) in message.paragraphs" :key="i" class="p2-dialog-paragraph"><b>{{ paragraph.label }}</b><p>{{ paragraph.text }}</p></div>
    <p v-if="message.question" class="p2-dialog-question">{{ message.question }}</p>
  </details>
  <div v-if="message.actions?.length" class="p2-demo-actions"><button v-for="action in message.actions" :key="action.id" type="button" @click="$emit('action',action.id)">{{ action.label }} →</button></div>
</template>
<script setup>
defineProps({message:{type:Object,required:true},daily:Boolean,expanded:Boolean})
defineEmits(['action'])
</script>
