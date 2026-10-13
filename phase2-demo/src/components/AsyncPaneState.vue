<template><div class="async-pane" :role="error?'alert':'status'"><p>{{error?'内容暂时无法加载，请重试。':'正在加载内容…'}}</p><button v-if="error" type="button" @click="retry">重新加载</button></div></template>
<script setup>
defineProps({error:Error})
function retry(){const url=new URL(location.href);url.searchParams.set('__refresh',Date.now().toString(36));location.replace(url.href)}
</script>
<style scoped>.async-pane{min-height:160px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#6b7b91;font-size:14px}.async-pane button{padding:8px 16px;border:1px solid #b49359;border-radius:5px;background:white;color:#936821;cursor:pointer;font:inherit}</style>
