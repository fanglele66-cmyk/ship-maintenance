<template>
  <span class="status-badge" :style="badgeStyle">
    <span v-if="dot" class="dot" :style="{ background: meta.color }" :class="{ pulse: pulse }"></span>
    <Icon v-if="icon" :icon="meta.icon" class="ic" />
    <span class="lbl">{{ meta.label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import {
  DEVICE_STATUS_META, EVENT_STATUS_META, PRIORITY_META, SOURCE_META
} from '@/mock'

const props = defineProps({
  type: { type: String, required: true }, // device | event | priority | source
  value: { type: String, required: true },
  dot: { type: Boolean, default: true },
  icon: { type: Boolean, default: false },
  pulse: { type: Boolean, default: false },
  plain: { type: Boolean, default: false } // 无背景，仅文字+点
})

const META_MAP = {
  device: DEVICE_STATUS_META,
  event: EVENT_STATUS_META,
  priority: PRIORITY_META,
  source: SOURCE_META
}

const meta = computed(() => META_MAP[props.type]?.[props.value] || { label: props.value, color: '#8BAAC0' })

const badgeStyle = computed(() => {
  if (props.plain) return { color: meta.value.color, background: 'transparent' }
  return {
    color: meta.value.color,
    background: meta.value.color + '20',
    borderColor: meta.value.color + '55'
  }
})
</script>

<style scoped>
.status-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 4px;
  font-size: 12px; font-weight: 600; line-height: 1.5;
  border: 1px solid transparent; white-space: nowrap;
}
.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot.pulse { animation: dot-pulse 1.4s ease-in-out infinite; }
.ic { font-size: 13px; }
@keyframes dot-pulse {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  50% { box-shadow: 0 0 0 4px transparent; opacity: 0.6; }
}
</style>
