<template>
  <div class="p2-situation-report">
    <header class="p2-report-heading">
      <BackButton :label="backLabel" @click="$emit('back')" />
      <div class="p2-report-heading-content">
        <div class="p2-report-title-row"><h3 class="p2-attention-detail-title">{{ title }}</h3><span class="p2-attention-status" :class="tone">{{ status }}</span></div>
        <p v-if="meta" class="p2-report-meta">{{ meta }}</p>
      </div>
    </header>
    <article class="p2-technical-report p2-unified-report">
      <section class="p2-report-lead">
        <h4>当前结论</h4>
        <p>{{ conclusion }}</p>
        <p v-if="recommendation" class="p2-report-advice"><b>建议</b>{{ recommendation }}</p>
        <slot name="actions" />
      </section>
      <SituationTimeline v-if="timeline.length && timelineFirst" :entries="timeline" :expanded="timelineExpanded" />
      <section v-for="section in sections" :key="section.title">
        <h4>{{ section.title }}</h4>
        <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      </section>
      <SituationTimeline v-if="timeline.length && !timelineFirst" :entries="timeline" :expanded="timelineExpanded" />
      <section v-if="arrangement.length" class="p2-report-arrangement">
        <h4>当前安排与关联</h4>
        <dl><div v-for="item in arrangement" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.text }}</dd></div></dl>
      </section>
    </article>
  </div>
</template>
<script setup>
import SituationTimeline from './SituationTimeline.vue'
import BackButton from './BackButton.vue'
defineProps({ title:String, status:String, tone:String, meta:String, conclusion:String, recommendation:String, backLabel:{type:String,default:'返回列表'}, sections:{type:Array,default:()=>[]}, timeline:{type:Array,default:()=>[]}, timelineFirst:Boolean, timelineExpanded:Boolean, arrangement:{type:Array,default:()=>[]} })
defineEmits(['back'])
</script>
