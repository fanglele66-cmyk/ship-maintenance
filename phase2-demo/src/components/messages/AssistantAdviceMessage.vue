<template>
 <section class="assistant-advice" :class="{'is-current-advice':message.currentAdvice,'is-streaming':streaming}" :data-streaming="streaming" aria-label="AI检修助手建议" aria-live="off" :aria-busy="streaming">
  <div class="assistant-advice-label"><span aria-hidden="true">✦</span>AI检修助手建议</div>
  <details v-if="!streaming && (message.detailsMarkdown || message.basis?.length)" class="assistant-advice-basis assistant-thinking">
   <summary><span>{{message.basisLabel||'分析依据'}}</span><span class="assistant-basis-chevron" aria-hidden="true">⌄</span></summary>
   <div class="assistant-basis-content">
    <MarkdownContent v-if="message.detailsMarkdown" :content="message.detailsMarkdown" />
    <dl v-else><template v-for="(row,index) in message.basis" :key="index"><dt>{{row.label}}</dt><dd>{{row.text}}</dd></template></dl>
    <p v-if="message.boundary" class="assistant-advice-boundary">{{message.boundary}}</p>
   </div>
  </details>
  <p v-if="message.analysis" class="assistant-advice-analysis">{{visibleAnalysis}}</p>
  <div v-if="visibleRecommendation" class="assistant-advice-next"><strong>建议您</strong><p>{{visibleRecommendation}}</p></div>
  <button v-if="!streaming && message.currentAdvice && !message.historical && message.actionLabel" type="button" class="assistant-advice-action" @click="$emit('action','workflow:focus')">{{message.actionLabel}} <span aria-hidden="true">↓</span></button>
 </section>
</template>
<script>
// Reopening an existing conversation must not replay its presentation animation.
const mountedAdviceIds = new Set()
</script>
<script setup>
import {computed,onMounted,onUnmounted,ref} from 'vue'
import MarkdownContent from '../MarkdownContent.vue'
const props=defineProps({message:{type:Object,required:true}})
const emit=defineEmits(['action','stream-progress','stream-complete'])
const streaming=ref(false),visibleCharacters=ref(0)
const analysisCharacters=computed(()=>Array.from(props.message.analysis || ''))
const recommendationCharacters=computed(()=>Array.from(props.message.recommendation || ''))
const visibleAnalysis=computed(()=>streaming.value?analysisCharacters.value.slice(0,visibleCharacters.value).join(''):props.message.analysis || '')
const visibleRecommendation=computed(()=>streaming.value?recommendationCharacters.value.slice(0,Math.max(0,visibleCharacters.value-analysisCharacters.value.length)).join(''):props.message.recommendation || '')
let animationFrame=null,deadlineTimer=null,finished=false
function clearAnimation(){if(animationFrame!==null)cancelAnimationFrame(animationFrame);if(deadlineTimer!==null)clearTimeout(deadlineTimer);animationFrame=null;deadlineTimer=null}
function progress(){emit('stream-progress',{messageId:props.message.id,visibleCharacters:visibleCharacters.value,totalCharacters:analysisCharacters.value.length+recommendationCharacters.value.length})}
function finish(){
 if(finished)return
 finished=true;clearAnimation();visibleCharacters.value=analysisCharacters.value.length+recommendationCharacters.value.length;streaming.value=false
 progress();emit('stream-complete',{messageId:props.message.id})
}
onMounted(()=>{
 const id=props.message.id,seen=id && mountedAdviceIds.has(id)
 if(id)mountedAdviceIds.add(id)
 if(!props.message.animate || seen)return
 const total=analysisCharacters.value.length+recommendationCharacters.value.length
 const reduceMotion=typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches
 if(!total || reduceMotion || typeof requestAnimationFrame!=='function'){finish();return}
 streaming.value=true
 const duration=Math.min(1800,Math.max(400,total*12)),started=performance.now()
 const tick=now=>{
  const elapsed=now-started
  visibleCharacters.value=Math.min(total,Math.floor(total*elapsed/duration))
  if(elapsed>=duration){finish();return}
  progress();animationFrame=requestAnimationFrame(tick)
 }
 progress();animationFrame=requestAnimationFrame(tick);deadlineTimer=setTimeout(finish,duration)
})
onUnmounted(clearAnimation)
</script>
<style scoped>
.assistant-advice .assistant-thinking{font-size:12px!important;line-height:1.65;color:#788391;margin:0 0 12px!important}
.assistant-advice .assistant-thinking>summary{display:flex;align-items:center;gap:8px;justify-content:space-between;list-style:none;font-size:12px!important;font-weight:400;color:#788391;padding:5px 0!important;border:0!important;cursor:pointer}
.assistant-thinking>summary::-webkit-details-marker{display:none}
.assistant-thinking>summary:focus-visible{outline:2px solid #b7935a;outline-offset:3px}
.assistant-thinking[open] .assistant-basis-chevron{transform:rotate(180deg)}
.assistant-advice .assistant-thinking .assistant-basis-content{font-size:12px;line-height:1.65;color:#788391;border-left:1px solid #e1e5e9;padding-left:12px;margin:8px 0 10px}
.assistant-advice .assistant-thinking :deep(.markdown-content){--wb-body:12px;font-size:12px!important;line-height:1.65;color:inherit}
.assistant-advice .assistant-thinking :deep(.markdown-content :is(p,li,h2,h3,h4,h5,strong)),.assistant-thinking :is(dt,dd){font-size:12px!important;line-height:1.65!important;color:inherit}
.assistant-thinking :deep(.markdown-content :is(h2,h3,h4,h5)){font-weight:500;margin:12px 0 5px!important}
.assistant-thinking :deep(.markdown-content :is(p,ul)){margin:6px 0}
.assistant-thinking :deep(.markdown-content li){margin:4px 0}
.assistant-thinking :deep(.markdown-content strong){font-weight:500}
</style>
