<template>
 <section class="home-situation-assistant" aria-label="态势助手" @keydown.esc="$emit('close')">
  <header><strong>态势助手</strong><button type="button" aria-label="收起态势助手" @click="$emit('close')">收起 →</button></header>
  <label class="home-assistant-context">关注事件<select v-model="selected" aria-label="助手关注事件"><option v-for="item in store.events" :key="item.id" :value="item.id">{{item.title}}</option></select></label>
  <LifecycleAssistant v-if="event" :key="event.id" :event="event" @report="openEvent" @plan="openEvent" @submitted="openEvent"/>
  <p v-else class="home-assistant-empty">当前身份暂无参与的事件。</p>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import LifecycleAssistant from './LifecycleAssistant.vue'
const emit=defineEmits(['close']),store=useEventLifecycleStore(),router=useRouter(),selected=ref('')
watch(()=>store.events,events=>{if(!events.some(e=>e.id===selected.value))selected.value=events[0]?.id||''},{immediate:true})
const event=computed(()=>store.events.find(e=>e.id===selected.value))
function openEvent(){if(event.value){emit('close');router.push('/situation/issue/'+event.value.id)}}
</script>
<style scoped>
.home-situation-assistant{position:absolute;right:12px;top:12px;bottom:12px;width:min(420px,calc(100% - 24px));display:flex;flex-direction:column;z-index:50;background:white;border:1px solid #e1e5e8;border-radius:10px;box-shadow:-12px 4px 40px #263e521f;overflow:hidden}.home-situation-assistant>header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #eee}.home-situation-assistant>header button{border:0;background:none;color:#96723e;cursor:pointer}.home-assistant-context{display:grid;gap:8px;padding:12px 16px;font-size:12px;color:#7c8790}.home-assistant-context select{min-width:0;width:100%;padding:8px;border:1px solid #e1e5e8;border-radius:5px;color:#405369;background:white}.home-situation-assistant :deep(.lc-assistant){min-height:0;flex:1;width:auto;border:0;border-radius:0}.home-situation-assistant :deep(.lc-assistant>header){display:none}.home-assistant-empty{padding:16px;color:#7c8790}
</style>
