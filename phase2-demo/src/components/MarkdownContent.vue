<template><div class="markdown-content" v-html="html" /></template>
<script setup>
import {computed} from 'vue'
import {renderMarkdown} from '../workflow/renderMarkdown.js'
const props=defineProps({content:{type:String,default:''},highlights:{type:Array,default:()=>[]}})
const html=computed(()=>renderMarkdown(props.content,props.highlights))
</script>
<style scoped>
.markdown-content{font-size:var(--wb-body);line-height:1.9;color:#445870;overflow-wrap:anywhere}.markdown-content :deep(p){margin:12px 0}.markdown-content :deep(strong){font-weight:600;color:#30445d}.markdown-content :deep(ul){padding-left:22px;margin:12px 0}.markdown-content :deep(li){padding-left:3px;margin:8px 0}.markdown-content :deep(h2),.markdown-content :deep(h3),.markdown-content :deep(h4),.markdown-content :deep(h5){font-size:calc(var(--wb-body) + 1px);margin:18px 0 8px;font-weight:600;color:#30445d}
.markdown-content :deep(mark){background:none;font-weight:600}.markdown-content :deep(.highlight-warning){color:#a36411}.markdown-content :deep(.highlight-success){color:#228154}.markdown-content :deep(.highlight-danger){color:#c13e3e}
</style>
