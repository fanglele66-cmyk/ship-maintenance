<template>
  <img v-if="src" :src="src" :alt="photo.name" @error="error='照片无法显示'" v-show="!error"/>
  <span v-if="error" class="photo-status" role="alert">{{error}}</span>
  <span v-else-if="!src" class="photo-status" role="status">读取照片…</span>
</template>
<script setup>
import {onMounted, ref, watch} from 'vue'
import {readStepPhoto} from '../services/stepPhotoFiles.js'

const props = defineProps({photo: {type: Object, required: true}})
const emit = defineEmits(['ready'])
const src = ref(props.photo.dataUrl || ''), error = ref('')
onMounted(() => watch(() => [props.photo.id, props.photo.dataUrl], async (_, __, cleanup) => {
  let disposed = false, objectUrl = ''
  cleanup(() => {
    disposed = true
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  })
  src.value = props.photo.dataUrl || ''
  emit('ready',src.value)
  error.value = ''
  if (src.value) return
  try {
    const blob = await readStepPhoto(props.photo)
    if (disposed) return
    objectUrl = URL.createObjectURL(blob)
    src.value = objectUrl
    emit('ready',objectUrl)
  } catch (e) {
    if (!disposed) error.value = e.message || '照片读取失败。'
  }
}, {immediate: true}))
</script>
<style scoped>
.photo-status { display: block; padding: 5px; font-size: 11px; color: var(--ui-muted, #687767); }
</style>
