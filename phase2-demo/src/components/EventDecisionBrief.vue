<template>
  <section class="event-decision-brief" aria-label="事件研判摘要">
    <div class="brief-origin"><span>{{ brief.discovery.label }}</span><time>{{ brief.discovery.at }}</time></div>
    <section class="brief-conclusion"><h3>{{ eventType==='异动跟踪'?'跟踪现象':'异常现象' }}</h3><p>{{ brief.discovery.text }}</p><p class="brief-judgement">{{ brief.conclusion }}</p></section>
    <div class="brief-facts" aria-label="关键事实">
      <article v-for="fact in brief.facts" :key="fact.label" class="brief-fact"><span>{{ fact.label }}</span><strong>{{ fact.value }} <small>{{ fact.unit }}</small></strong><time>{{ fact.at }}</time><p>{{ fact.meaning }}</p></article>
    </div>
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
.brief-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:10px}.brief-fact{padding:11px 13px;border:1px solid #e4e9f0;border-radius:6px;min-width:0;background:#fbfcfe}.brief-fact>span{display:block;font-size:12px;color:#738297}.brief-fact strong{display:block;margin:3px 0;color:#2b435e;font-size:18px;font-weight:600;line-height:1.5;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.brief-fact strong small{font-size:11px;font-weight:400;color:#7d8a9b}.brief-fact time{font-size:11px;color:#8a96a5;display:block}.brief-fact p{font-size:12px;margin-top:5px;line-height:1.65;color:#78869a}
.brief-decisions{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:20px 0}.brief-decisions section+section{border-left:1px solid #e8ecf1;padding-left:22px}
@media(max-width:900px){.brief-decisions{grid-template-columns:1fr;gap:13px}.brief-decisions section+section{border-left:0;padding-left:0}}
@media(max-width:600px){.brief-facts{grid-template-columns:1fr 1fr;gap:7px}.brief-fact{padding:9px}.brief-fact strong{font-size:16px}.brief-conclusion{padding:12px}.event-decision-brief{font-size:13px}}
</style>
