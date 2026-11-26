<template>
 <section class="lc-report">
  <header v-if="showDownload"><ReportDownloadButton  :report="report"/></header>
  <p v-if="report.updatedAt" class="report-update">已更新 {{report.revisions?.length}} 次 · 更新于 {{timeText(report.updatedAt)}}</p>
  <MarkdownContent :content="reportMarkdown(report)"/>
  <section v-if="photoGroups.length" class="report-step-photos" aria-label="本轮提交的现场照片">
   <h3>本轮现场照片</h3>
   <div v-for="group in photoGroups" :key="group.stepIndex" class="report-photo-group">
    <h4>第 {{group.stepIndex+1}} 步 · {{group.label}}</h4>
    <StepPhotoGallery :photos="group.photos"/>
   </div>
  </section>
  <details v-if="report.revisions?.length" class="report-history"><summary>原稿与修订记录</summary><section v-for="(revision,index) in report.revisions" :key="revision.id"><h3>第 {{index+1}} 次{{revision.kind==='regenerate'?'重新整理':'补充'}}前的版本 · {{timeText(revision.at)}}</h3><p>更新内容：{{revision.text}}</p><MarkdownContent :content="revision.before.markdown"/></section></details>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import StepPhotoGallery from './StepPhotoGallery.vue'
import {reportPhotoEntries} from '../workflow/stepPhotoEvidence.js'
import {reportMarkdown} from '../workflow/reportPresentation.js'
import ReportDownloadButton from './ReportDownloadButton.vue'
import MarkdownContent from './MarkdownContent.vue'
import {timeText} from '../workflow/eventLifecycle'
const props=defineProps({report:{type:Object,required:true},showDownload:{type:Boolean,default:true}})
const photoGroups=computed(()=>{
 const groups=new Map()
 for(const photo of reportPhotoEntries(props.report.submissionSnapshot?.records||[])){
  const {index,label}=photo.uses[0]
  if(!groups.has(index))groups.set(index,{stepIndex:index,label,photos:[]})
  groups.get(index).photos.push(photo)
 }
 return [...groups.values()]
})
</script>
<style scoped>
.lc-report>header{justify-content:flex-end}.report-update,.report-history{font-size:12px;color:#8390a0}.report-history{border-top:1px solid #e5e9ee;margin-top:25px;padding-top:15px}.report-history summary{cursor:pointer}.report-history section{margin:20px 0;border-left:2px solid #e4e7eb;padding-left:15px}
.report-step-photos{margin-top:20px;padding-top:14px;border-top:1px solid #e5e9ee}.report-step-photos h3{margin:0 0 10px;font-size:14px;font-weight:600;color:#30445d}.report-photo-group{margin-bottom:12px}.report-photo-group h4{margin:0 0 8px;font-size:12px;font-weight:500;color:#627588}
</style>
