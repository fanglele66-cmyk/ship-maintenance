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
<style scoped>
.p2-timeline-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px}
.p2-timeline-heading>b{flex-basis:100%;min-width:0;overflow-wrap:break-word}
.p2-timeline-heading time,.p2-timeline-heading>span{font-size:12px;color:#7c8797}
.p2-attention-timeline p{white-space:pre-line;overflow-wrap:break-word}
</style>
