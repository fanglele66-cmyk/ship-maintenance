<template><div class="markdown-content" v-html="html" /></template>
<script setup>
import {computed} from 'vue'
const props=defineProps({content:{type:String,default:''},highlights:{type:Array,default:()=>[]}})
const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const inline=text=>{
 let value=escape(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
 for(const item of props.highlights){
  if(!item.text||!['warning','success','danger'].includes(item.tone))continue
  value=value.split(escape(item.text)).join(`<mark class="highlight-${item.tone}">${escape(item.text)}</mark>`)
 }
 return value
}
const html=computed(()=>props.content.trim().split(/\n\s*\n/).map(block=>{
 const lines=block.split('\n')
 if(lines.every(line=>/^[-*] /.test(line)))return '<ul>'+lines.map(line=>'<li>'+inline(line.slice(2))+'</li>').join('')+'</ul>'
 const heading=block.match(/^(#{1,4}) (.+)$/)
 if(heading)return '<h'+(heading[1].length+1)+'>'+inline(heading[2])+'</h'+(heading[1].length+1)+'>'
 return '<p>'+lines.map(inline).join('<br>')+'</p>'
}).join(''))
</script>
<style scoped>
.markdown-content{font-size:var(--wb-body);line-height:1.9;color:#445870;overflow-wrap:anywhere}.markdown-content :deep(p){margin:12px 0}.markdown-content :deep(strong){font-weight:600;color:#30445d}.markdown-content :deep(ul){padding-left:22px;margin:12px 0}.markdown-content :deep(li){padding-left:3px;margin:8px 0}.markdown-content :deep(h2),.markdown-content :deep(h3),.markdown-content :deep(h4),.markdown-content :deep(h5){font-size:calc(var(--wb-body) + 1px);margin:18px 0 8px;font-weight:600;color:#30445d}
.markdown-content :deep(mark){background:none;font-weight:600}.markdown-content :deep(.highlight-warning){color:#a36411}.markdown-content :deep(.highlight-success){color:#228154}.markdown-content :deep(.highlight-danger){color:#c13e3e}
</style>
