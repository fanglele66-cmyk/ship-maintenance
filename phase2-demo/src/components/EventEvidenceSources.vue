<template>
  <section class="event-evidence-sources" aria-label="资料来源与数据窗口">
    <div class="source-window"><span>{{ brief.evidenceCutoff?'采样截至':brief.temporalScope==='post-repair-followup'?'临修后资料日期':'资料日期' }}</span><strong>{{ brief.evidenceCutoff||brief.discovery.at }}</strong></div>
    <h3>来源资料</h3>
    <div class="source-documents"><details v-for="source in brief.sources.filter(item=>item.kind!=='数据分析记录')" :key="source.id" class="source-document"><summary><span class="source-kind">{{ source.kind }}</span><strong>{{ source.title }}</strong><time>{{ source.date }}</time></summary><p>{{ source.summary }}</p><dl v-if="source.records?.length" class="source-records"><div v-for="record in source.records" :key="record.label"><dt>{{record.label}}</dt><dd>{{record.value}}</dd></div></dl></details></div>
  </section>
</template>
<script setup>
defineProps({brief:{type:Object,required:true}})
</script>
<style scoped>
.event-evidence-sources{padding-top:18px;font-size:13px;line-height:1.75;color:#687b92;min-width:0}.source-window{background:#f7f9fc;border:1px solid #e3e9f1;border-radius:7px;padding:13px 16px}.source-window>span{font-size:12px;color:#8a96a5;margin-right:14px}.source-window strong{font-weight:500;color:#415b79;font-variant-numeric:tabular-nums}.source-window p{margin:5px 0 0;font-size:12px;color:#8c806b}.event-evidence-sources h3{font-size:14px;color:#3c516d;margin:18px 0 9px}.source-documents{border-top:1px solid #e4eaf1}.source-document{border-bottom:1px solid #e4eaf1}.source-document summary{display:flex;align-items:baseline;gap:8px 12px;flex-wrap:wrap;cursor:pointer;padding:11px 4px;list-style:none}.source-document summary:before{content:'›';color:#a58b60;font-size:16px;width:10px;flex:none;line-height:1}.source-document[open] summary:before{content:'⌄'}.source-document summary strong{font-size:13px;font-weight:500;color:#465e79;min-width:0;overflow-wrap:anywhere}.source-kind{font-size:10px;color:#8e9bae;padding:1px 5px;background:#f3f6fa;border-radius:3px}.source-document time{margin-left:auto;font-size:11px;color:#8996a7;font-variant-numeric:tabular-nums}.source-document p{margin:0 0 12px;padding-left:26px;font-size:12px;color:#77869a}.source-document summary:focus-visible{outline:2px solid #b29360;outline-offset:2px}.source-document summary::-webkit-details-marker{display:none}
@media(max-width:600px){.source-document time{margin-left:26px;flex-basis:100%}.source-window strong{display:block;margin-top:3px}}
.source-records{margin:0 0 14px 26px;border-top:1px solid #edf0f5}.source-records>div{display:grid;grid-template-columns:minmax(100px,160px) minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #edf0f5}.source-records dt{color:#8190a3}.source-records dd{margin:0;color:#405772;white-space:pre-line;overflow-wrap:anywhere}@media(max-width:600px){.source-records>div{grid-template-columns:1fr;gap:3px}}
</style>
