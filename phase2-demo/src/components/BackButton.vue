<template>
  <button type="button" class="wb-back-button" :aria-label="label" :title="label">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>
  </button>
</template>

<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<style scoped>
.wb-back-button { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; padding: 4px; border: 1px solid #ebeef5; border-radius: 8px; background: #fff; cursor: pointer; transition: background .15s, border-color .15s; }
.wb-back-button svg { display: block; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.wb-back-button:hover { background: #f8f5f0; border-color: #cbb58e; }
.wb-back-button:active { background: #eee6d9; }
.wb-back-button:focus-visible { outline: 2px solid #b7935a; outline-offset: 3px; }
</style>
