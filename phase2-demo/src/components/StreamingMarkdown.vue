<template>
 <div class="streaming-markdown" :aria-busy="streaming">
  <div class="stream-reserve" aria-hidden="true"><MarkdownContent :content="content" :highlights="highlights" /></div>
  <div class="stream-visible" aria-hidden="true"><MarkdownContent :content="displayContent" :highlights="highlights" /><span v-if="streaming" class="stream-cursor"></span></div>
  <span class="stream-accessible" role="status">{{ streaming ? '正在生成分析' : content }}</span>
 </div>
</template>
<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import MarkdownContent from './MarkdownContent.vue'
const props=defineProps({content:{type:String,default:''},highlights:{type:Array,default:()=>[]}})
const visible=ref(''),streaming=ref(false)
let timer
const displayContent=computed(()=>{
 let value=visible.value
 // Hide an unfinished marker and close in-progress emphasis without showing syntax.
 if(value.endsWith('*')&&!value.endsWith('**'))value=value.slice(0,-1)
 if((value.match(/\*\*/g)||[]).length%2)value+='**'
 return value.replace(/(^|\n)#{1,3} ?$/,'$1')
})
watch(()=>props.content,value=>{
 clearInterval(timer)
 if(!value||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){visible.value=value;streaming.value=false;return}
 visible.value='';streaming.value=true
 const chars=Array.from(value),step=Math.max(3,Math.ceil(chars.length/85))
 let position=0
 timer=setInterval(()=>{
  position=Math.min(chars.length,position+step)
  visible.value=chars.slice(0,position).join('')
  if(position===chars.length){clearInterval(timer);streaming.value=false}
 },40)
},{immediate:true})
onBeforeUnmount(()=>clearInterval(timer))
</script>
<style scoped>
.streaming-markdown{position:relative}.stream-reserve{visibility:hidden;pointer-events:none}.stream-visible{position:absolute;inset:0}.stream-cursor{display:inline-block;width:2px;height:14px;background:#b49359;animation:stream-blink .8s steps(2,start) infinite}.stream-accessible{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}@keyframes stream-blink{to{opacity:0}}@media(prefers-reduced-motion:reduce){.stream-cursor{animation:none}}
</style>
