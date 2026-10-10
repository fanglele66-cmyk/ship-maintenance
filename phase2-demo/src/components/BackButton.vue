<template>
  <button type="button" class="wb-back-button" :aria-label="label" :title="label">
    <img :src="backArrow" alt="" aria-hidden="true" />
  </button>
</template>

<script setup>
import backArrow from '@/assets/figma/back-arrow.svg'
defineProps({ label: { type: String, required: true } })
</script>

<style scoped>
.wb-back-button { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; padding: 4px; border: 1px solid #ebeef5; border-radius: 8px; background: #fff; cursor: pointer; transition: background .15s, border-color .15s; }
.wb-back-button img { display: block; }
.wb-back-button:hover { background: #f8f5f0; border-color: #cbb58e; }
.wb-back-button:active { background: #eee6d9; }
.wb-back-button:focus-visible { outline: 2px solid #b7935a; outline-offset: 3px; }
</style>
