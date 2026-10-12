<template>
  <div class="p2-situation-report">
    <header class="p2-report-heading">
      <BackButton :label="backLabel" @click="$emit('back')" />
      <div class="p2-report-heading-content">
        <div class="p2-report-title-row"><h3 class="p2-attention-detail-title">{{ title }}</h3><span class="p2-attention-status" :class="tone">{{ status }}</span></div>
        <p v-if="meta" class="p2-report-meta">{{ meta }}</p>
      </div>
    </header>
    <nav v-if="tabbed" class="maintenance-dossier-tabs" role="tablist" :aria-label="title + '详情内容'">
      <button v-for="tab in detailTabs" :key="tab.id" type="button" role="tab" :aria-selected="detailTab === tab.id" :class="{active:detailTab === tab.id}" @click="detailTab=tab.id">{{ tab.label }}</button>
    </nav>
    <article :key="detailTab" class="p2-technical-report p2-unified-report" :class="{'maintenance-dossier-body':tabbed}" :role="tabbed ? 'tabpanel' : undefined">
      <template v-if="!tabbed || detailTab === 'overview'">
      <section class="p2-report-lead">
        <h4>当前结论</h4>
        <p>{{ conclusion }}</p>
        <p v-if="recommendation" class="p2-report-advice"><b>建议</b>{{ recommendation }}</p>
        <slot name="actions" />
      </section>
      </template>
      <SituationTimeline v-if="!tabbed && timeline.length && timelineFirst" :entries="timeline" :expanded="timelineExpanded" />
      <template v-if="!tabbed || detailTab === 'evidence'">
      <template v-for="(section,index) in sections" :key="section.title">
        <details v-if="tabbed" class="maintenance-evidence-section" :open="index === 0">
          <summary>{{ section.title }}</summary>
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
        </details>
        <section v-else><h4>{{ section.title }}</h4><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></section>
      </template>
      </template>
      <SituationTimeline v-if="timeline.length && (tabbed ? detailTab === 'history' : !timelineFirst)" :entries="timeline" :expanded="timelineExpanded" />
      <p v-if="tabbed && detailTab === 'history' && !timeline.length" class="maintenance-empty">暂无跟踪记录。</p>
      <section v-if="arrangement.length && (!tabbed || detailTab === 'overview')" class="p2-report-arrangement">
        <h4>当前安排与关联</h4>
        <dl><div v-for="item in arrangement" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.text }}</dd></div></dl>
      </section>
    </article>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import SituationTimeline from './SituationTimeline.vue'
import BackButton from './BackButton.vue'
const props = defineProps({ tabbed:Boolean, detailTabs:{type:Array,default:()=>[{id:'overview',label:'事项概览'},{id:'evidence',label:'变化证据'},{id:'history',label:'跟踪记录'}]}, title:String, status:String, tone:String, meta:String, conclusion:String, recommendation:String, backLabel:{type:String,default:'返回列表'}, sections:{type:Array,default:()=>[]}, timeline:{type:Array,default:()=>[]}, timelineFirst:Boolean, timelineExpanded:Boolean, arrangement:{type:Array,default:()=>[]} })
const detailTab=ref('overview')
watch(()=>props.title,()=>{detailTab.value='overview'})
defineEmits(['back'])
</script>

<style scoped>
.maintenance-dossier-tabs{display:flex;gap:28px;border-bottom:1px solid #e7e9ed;margin:0 0 20px;flex-shrink:0}
.maintenance-dossier-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:12px 0;color:#6e7786;font-size:14px;cursor:pointer}
.maintenance-dossier-tabs button.active{color:#9c8860;border-bottom-color:#9c8860;font-weight:600}
.maintenance-dossier-body{max-width:960px;font-size:14px;line-height:1.8}
.maintenance-dossier-body section{padding:18px 0}
.maintenance-dossier-body section:first-child{padding-top:0}
.maintenance-dossier-body h4{font-size:15px}
.maintenance-evidence-section{border-bottom:1px solid #e7e9ed;padding:18px 0}.maintenance-evidence-section summary{cursor:pointer;font-size:15px;font-weight:600;color:#303744}.maintenance-evidence-section p{margin:12px 0;color:#5c6573}
.maintenance-empty{color:#7b8492;padding:20px 0}
</style>
