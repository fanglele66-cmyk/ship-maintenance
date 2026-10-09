<template>
  <details class="p2-report-history" :open="expanded">
    <summary>跟踪与处理记录 <span>{{ entries.length }} 个节点</span></summary>
    <ol class="p2-attention-timeline p2-evidence-timeline">
      <li v-for="(entry,index) in entries" :key="entry.label + index" :class="{done:entry.done,current:entry.current}">
        <i>{{ entry.done && !entry.current ? '✓' : index + 1 }}</i>
        <div><div class="p2-timeline-heading"><b>{{ entry.label }}</b><time v-if="entry.at">{{ entry.at }}</time><span v-if="entry.actor">{{ entry.actor }}</span></div><p>{{ entry.text }}</p><p v-if="entry.assessment" class="p2-timeline-assessment">{{ entry.assessment }}</p></div>
      </li>
    </ol>
  </details>
</template>
<script setup>
defineProps({entries:{type:Array,default:()=>[]},expanded:Boolean})
</script>
