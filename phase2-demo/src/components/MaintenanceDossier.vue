<template>
  <SituationReport :key="model.id" v-bind="model.report" tabbed timeline-first timeline-expanded back-label="返回维保计划" @back="$emit('back')">
    <template #actions>
      <button v-for="action in model.actions" :key="action.id" type="button" class="p2-link-button" @click="$emit('action', action.id)">{{ action.label }}</button>
    </template>
  </SituationReport>
</template>
<script setup>
import SituationReport from './SituationReport.vue'
defineProps({ model: { type: Object, required: true } })
defineEmits(['back', 'action'])
</script>
