<template>
 <ElPopover v-model:visible="opened" trigger="click" placement="bottom-end" :width="360" :teleported="true">
  <template #reference><button class="notification-bell" type="button" aria-label="通知中心" :aria-expanded="opened"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i v-if="unread" /></button></template>
  <section class="notification-panel" aria-label="通知中心">
   <header><strong>通知</strong><button type="button" aria-label="关闭通知中心" @click="opened=false">×</button></header>
   <button v-if="arrived" class="notification-item" @click="openIssue"><span class="notification-meta">{{story.type}} · {{story.device}}<time>{{arrivedAt}}</time></span><strong>{{story.title}}</strong><p>{{story.summary}}</p><span class="notification-action">{{actionLabel}}</span></button>
   <p v-else class="notification-empty">暂无新通知</p>
  </section>
 </ElPopover>
 <Teleport to="body"><Transition name="notification-slide"><section v-if="toastVisible" class="notification-toast" role="status" aria-live="polite"><button class="notification-dismiss" type="button" aria-label="关闭新事项提醒" @click="toastVisible=false">×</button><button class="notification-item" @click="openIssue"><span class="notification-meta">{{story.type}} · {{story.device}}<time>{{arrivedAt}}</time></span><strong>{{story.title}}</strong><p>{{story.summary}}</p><span class="notification-action">{{actionLabel}}</span></button></section></Transition></Teleport>
</template>
<script setup>
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {ElPopover} from 'element-plus'
import 'element-plus/es/components/popover/style/css'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import story from '@/mock/notificationStory.json'
const router=useRouter(),store=usePhase2DemoStore(),opened=ref(false),arrived=ref(false),unread=ref(false),toastVisible=ref(false),arrivedAt=ref('')
const decided=computed(()=>Boolean(store.todoCreated[story.issueId]||store.ignoredSuggestions[story.issueId]))
const actionLabel=computed(()=>store.todoCreated[story.issueId]?'查看进展':store.ignoredSuggestions[story.issueId]?'查看决定':'查看并处理')
watch(opened,value=>{if(value){unread.value=false;toastVisible.value=false}})
watch(decided,value=>{if(value){unread.value=false;toastVisible.value=false}})
let timer
onMounted(()=>{timer=setTimeout(()=>{if(decided.value)return;arrived.value=true;arrivedAt.value=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});unread.value=!opened.value;toastVisible.value=!opened.value},story.delayMs)})
onUnmounted(()=>clearTimeout(timer))
function openIssue(){opened.value=false;unread.value=false;toastVisible.value=false;if(store.todoCreated[story.issueId]){store.selectTodo(story.issueId);router.push({path:'/event',query:{todo:story.issueId}})}else router.push({path:'/situation/issue/'+story.issueId,query:{from:'workbench'}})}
</script>
<style scoped>
.notification-bell{position:relative;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:6px;background:transparent;color:#6c7183;cursor:pointer}.notification-bell:hover{background:#f5f5f3;color:#846336}.notification-bell svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.notification-bell i{position:absolute;right:6px;top:5px;width:6px;height:6px;border:2px solid white;border-radius:50%;background:#c84e46}
.notification-panel{color:#1d2129}.notification-panel header{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 12px;border-bottom:1px solid #e3e6ea}.notification-panel header strong{font-size:15px}.notification-panel header button,.notification-dismiss{border:0;background:none;color:#9195a2;font-size:22px;line-height:24px;cursor:pointer;width:28px;height:28px}
.notification-item{display:block;width:100%;padding:16px 4px;text-align:left;border:0;background:white;font:inherit;color:#1d2129;cursor:pointer}.notification-item:hover{background:#faf9f6}.notification-meta{display:flex;align-items:center;gap:12px;color:#a56816;font-size:12px;line-height:1.6}.notification-meta time{margin-left:auto;color:#9195a2;font-size:12px}.notification-item>strong{display:block;font-size:15px;font-weight:600;line-height:1.6;margin:6px 0}.notification-item p{font-size:13px;line-height:1.7;color:#6c7183;margin:0 0 10px;overflow-wrap:break-word}.notification-action{font-size:13px;color:#846336}.notification-empty{font-size:13px;color:#9195a2;padding:20px 4px}.notification-toast{position:fixed;top:58px;right:20px;width:360px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 16px 0;border:1px solid #e3e6ea;border-radius:8px;background:white;box-shadow:0 6px 24px #1d212914;z-index:2001}.notification-toast .notification-item{padding-top:18px}.notification-toast .notification-meta{padding-right:24px}.notification-dismiss{position:absolute;right:10px;top:9px;z-index:1}.notification-slide-enter-active,.notification-slide-leave-active{transition:opacity .18s,transform .18s}.notification-slide-enter-from,.notification-slide-leave-to{opacity:0;transform:translateY(-8px)}.notification-bell:focus-visible,.notification-item:focus-visible,.notification-dismiss:focus-visible{outline:2px solid #b7935a;outline-offset:2px}@media(prefers-reduced-motion:reduce){.notification-slide-enter-active,.notification-slide-leave-active{transition:none}}
</style>
