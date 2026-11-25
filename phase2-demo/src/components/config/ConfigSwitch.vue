<template>
  <button type="button" class="config-toggle" role="switch"
    :aria-label="label" :aria-checked="checked" :disabled="disabled" @click="$emit('toggle')">
    <span class="config-toggle-track" aria-hidden="true"></span>
    <span>{{ checked ? onText : offText }}</span>
  </button>
</template>

<script setup>
defineProps({
  checked: Boolean,
  label: { type: String, required: true },
  disabled: Boolean,
  onText: { type: String, default: '已启用' },
  offText: { type: String, default: '已停用' }
})
defineEmits(['toggle'])
</script>

<style scoped>
button.config-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0;
  color: var(--ui-ink);
  border: 0;
  border-radius: 5px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
.config-toggle-track {
  display: inline-flex;
  align-items: center;
  flex: none;
  width: 32px;
  height: 18px;
  box-sizing: border-box;
  padding: 2px;
  border-radius: 12px;
  background: #a8aca2;
}
.config-toggle-track::after {
  content: '';
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px #25292030;
}
.config-toggle[aria-checked=true] .config-toggle-track { background: var(--ui-accent); }
.config-toggle[aria-checked=true] .config-toggle-track::after { transform: translateX(14px); }
.config-toggle:hover:enabled .config-toggle-track { box-shadow: 0 0 0 2px var(--ui-warm); }
.config-toggle:disabled { opacity: .55; cursor: not-allowed; }
@media (prefers-reduced-motion: no-preference) {
  .config-toggle-track, .config-toggle-track::after { transition: background-color .15s ease, transform .15s ease; }
}
</style>
