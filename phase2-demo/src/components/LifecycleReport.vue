<template><section class="lc-report"><header v-if="showDownload"><button type="button" @click="downloadReportMarkdown(report)">下载</button></header><p v-if="report.updatedAt" class="report-update">已更新 {{report.revisions?.length}} 次 · 更新于 {{timeText(report.updatedAt)}}</p><MarkdownContent :content="reportMarkdown(report)"/><details v-if="report.revisions?.length" class="report-history"><summary>原稿与修订记录</summary><section v-for="(revision,index) in report.revisions" :key="revision.id"><h3>第 {{index+1}} 次{{revision.kind==='regenerate'?'重新整理':'补充'}}前的版本 · {{timeText(revision.at)}}</h3><p>更新内容：{{revision.text}}</p><MarkdownContent :content="revision.before.markdown"/></section></details></section></template>
<script setup>
import {reportMarkdown} from '../workflow/reportPresentation.js'
import {downloadReportMarkdown} from '../workflow/downloadReport.js'
import MarkdownContent from './MarkdownContent.vue'
import {timeText} from '../workflow/eventLifecycle'
defineProps({report:{type:Object,required:true},showDownload:{type:Boolean,default:true}})
</script>

<style scoped>.lc-report>header{justify-content:flex-end}.report-update,.report-history{font-size:12px;color:#8390a0}.report-history{border-top:1px solid #e5e9ee;margin-top:25px;padding-top:15px}.report-history summary{cursor:pointer}.report-history section{margin:20px 0;border-left:2px solid #e4e7eb;padding-left:15px}</style>
