<template>
 <section v-if="sources?.length" class="knowledge-references" aria-label="参考资料">
  <span>参考资料</span>
  <a v-for="reference in references" :key="reference.id" :href="appUrl(reference.href)"><small v-if="reference.citations.length">[{{reference.citations.join('、')}}]</small> {{reference.title}} <b aria-hidden="true">↗</b></a>
  <a v-if="!references.length" href="#/knowledge">在知识库中查阅 ↗</a>
 </section>
</template>
<script setup>
import {appUrl} from '../services/appUrl.js'
import {computed} from 'vue'
import {knowledgeDocs} from '../mock/knowledge.js'
import {knowledgeReferences} from '../workflow/knowledgeReferences.js'
const props=defineProps({sources:{type:Array,default:()=>[]}})
const references=computed(()=>knowledgeReferences(props.sources,knowledgeDocs))
</script>
<style scoped>
.knowledge-references{display:grid;gap:7px;margin:12px 0;font-size:12px;line-height:1.65}.knowledge-references>span{color:#8997a6;font-size:11px}.knowledge-references a{color:#7c6746;text-decoration:none;overflow-wrap:anywhere}.knowledge-references a:hover{text-decoration:underline}.knowledge-references small{color:#8d9aaa}.knowledge-references b{font-weight:400;margin-left:3px}.knowledge-references a:focus-visible{outline:2px solid #b49a6d;outline-offset:3px}
</style>
