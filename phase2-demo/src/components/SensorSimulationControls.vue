<template>
 <div class="simulation-controls">
  <span>数据更新于 {{timeLabel}}</span>
  <details>
   <summary>刷新设置</summary>
   <form @submit.prevent="apply">
    <strong>数据刷新设置</strong>
    <label><span>自动刷新</span><input v-model="enabled" type="checkbox"/></label>
    <label><span>更新周期（秒）</span><input v-model.number="intervalSeconds" type="number" min="5" max="300" required/></label>
    <label><span>波动强度</span><select v-model.number="strength"><option :value="0.5">轻微（0.5倍）</option><option :value="1">常规（1倍）</option><option :value="2">明显（2倍）</option></select></label>
    <button type="submit">应用配置</button>
   </form>
  </details>
 </div>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useSensorStore} from '@/stores/sensorStore'
const store=useSensorStore()
const enabled=ref(store.simulationConfig.enabled),intervalSeconds=ref(store.simulationConfig.intervalSeconds),strength=ref(store.simulationConfig.strength)
const timeLabel=computed(()=>new Date(store.sampledAt).toLocaleTimeString('zh-CN',{hour12:false}))
function apply(event){store.configureSimulation({enabled:enabled.value,intervalSeconds:intervalSeconds.value,strength:strength.value});event.target.closest('details').open=false}
</script>
<style scoped>
.simulation-controls{display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:6px 0 12px;color:#7b8798;font-size:12px;position:relative;flex-wrap:wrap}
summary{cursor:pointer;color:#936821;list-style:none}summary:focus-visible{outline:2px solid #936821}
form{position:absolute;right:0;top:32px;width:320px;padding:18px;background:#fff;border:1px solid #e4e9f0;border-radius:8px;box-shadow:0 8px 24px #23364d18;z-index:20;color:#33465e;box-sizing:border-box}
strong{display:block;margin-bottom:14px;font-size:14px}label{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0}input[type=number],select{width:130px;padding:6px;border:1px solid #dce3ec;border-radius:4px;font:inherit}p{line-height:1.7;color:#7b8798}button{background:#252525;border:0;color:#fff;border-radius:5px;padding:8px 14px;cursor:pointer;font:inherit}
</style>
