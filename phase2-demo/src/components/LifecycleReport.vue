<template><section class="lc-report"><header><span>{{report.kind}} · {{timeText(report.at)}}</span><button type="button" @click="download">下载 Markdown</button></header><p v-if="report.updatedAt" class="report-update">已补充 {{report.revisions?.length}} 次 · 更新于 {{timeText(report.updatedAt)}}</p><MarkdownContent :content="report.markdown"/><details v-if="report.revisions?.length" class="report-history"><summary>原稿与修订记录</summary><section v-for="(revision,index) in report.revisions" :key="revision.id"><h3>第 {{index+1}} 次补充前的版本 · {{timeText(revision.at)}}</h3><p>补充原文：{{revision.text}}</p><MarkdownContent :content="revision.before.markdown"/></section></details></section></template>
<script setup>
import MarkdownContent from './MarkdownContent.vue'
import {timeText} from '../workflow/eventLifecycle'
const props=defineProps({report:{type:Object,required:true}})
function download(){const url=URL.createObjectURL(new Blob([props.report.markdown],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=props.report.title.replace(/[\\/:*?"<>|]/g,'-')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
</script>

<style scoped>.report-update,.report-history{font-size:12px;color:#8390a0}.report-history{border-top:1px solid #e5e9ee;margin-top:25px;padding-top:15px}.report-history summary{cursor:pointer}.report-history section{margin:20px 0;border-left:2px solid #e4e7eb;padding-left:15px}</style>
