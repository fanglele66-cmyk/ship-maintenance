<template><section class="lc-report"><header><span>{{report.kind}} · {{timeText(report.at)}}</span><button type="button" @click="download">下载 Markdown</button></header><MarkdownContent :content="report.markdown"/></section></template>
<script setup>
import MarkdownContent from './MarkdownContent.vue'
import {timeText} from '../workflow/eventLifecycle'
const props=defineProps({report:{type:Object,required:true}})
function download(){const url=URL.createObjectURL(new Blob([props.report.markdown],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=props.report.title.replace(/[\\/:*?"<>|]/g,'-')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
</script>
