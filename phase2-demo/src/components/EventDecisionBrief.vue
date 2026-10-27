<template>
  <section class="event-decision-brief" aria-label="事件研判摘要">
    <div class="brief-origin"><span>{{ brief.discovery.label }}</span><time>{{ brief.discovery.at }}</time></div>
    <section class="brief-conclusion"><h3>{{ eventType==='异动跟踪'?'跟踪现象':'异常现象' }}</h3><p>{{ brief.discovery.text }}</p><p class="brief-judgement">{{ brief.conclusion }}</p></section>
    <div class="brief-decisions">
      <section><h3>决策要点</h3><p>{{ brief.captainDecision }}</p></section>
      <section><h3>派发依据</h3><p>{{ brief.dispatchReason }}</p></section>
    </div>
  </section>
</template>

<script setup>
defineProps({brief:{type:Object,required:true},eventType:{type:String,default:''}})
</script>

<style scoped>
.event-decision-brief{min-width:0;color:#52637a;font-size:14px;line-height:1.75;padding-top:18px}
.brief-origin{display:flex;align-items:center;justify-content:space-between;gap:8px 20px;flex-wrap:wrap;color:#8a7960;font-size:12px}
.brief-origin time{color:#8490a0;font-variant-numeric:tabular-nums}
.event-decision-brief h3{font-size:14px;line-height:1.5;color:#33465f;margin:0 0 7px;font-weight:600}
.event-decision-brief p{margin:0}.brief-conclusion{margin:12px 0 16px;padding:15px 18px;background:#faf8f3;border:1px solid #ebe4d7;border-radius:7px}.brief-conclusion .brief-judgement{margin-top:7px;color:#374c67}
 .brief-decisions{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:24px 0}.brief-decisions section{padding:0;border:0;background:transparent}.brief-decisions h3{font-size:18px;margin-bottom:12px;color:#5e4929}.brief-decisions section+section h3{color:#33465f}.brief-decisions p{font-size:16px;line-height:1.9;color:#3c4f68}
@media(max-width:900px){.brief-decisions{grid-template-columns:1fr;gap:20px}.brief-decisions p{font-size:15px}}
@media(max-width:600px){.brief-conclusion{padding:12px}.event-decision-brief{font-size:13px}}
</style>
