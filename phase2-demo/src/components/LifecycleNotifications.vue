<template>
 <div class="lc-notifications"><button aria-label="通知中心" @click="open=!open"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><i v-if="store.unread"/></button>
  <section v-if="open" class="lc-notice-menu"><header>待处理通知 <button @click="open=false" aria-label="关闭通知">×</button></header><button v-for="e in unread" :key="e.id" @click="visit(e.id)"><strong>{{e.title}}</strong><small>{{e.status}}</small></button><p v-if="!unread.length">暂无未读通知</p></section>
  <aside v-if="toast" class="lc-notice-toast" role="status" aria-live="polite"><header><small>{{store.state.events[toast.eventId]?.type}} · {{store.state.events[toast.eventId]?.device}}</small><time>{{timeText(toast.at).slice(-5)}}</time><button aria-label="关闭提醒" @click="dismiss">×</button></header><strong>{{toast.title}}</strong><p>{{toast.text}}</p><button class="lc-notice-open" @click="visit(toast.eventId)">查看并处理 →</button><small v-if="queued>1" class="lc-notice-count">另有 {{queued-1}} 项提醒</small></aside>
 </div>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import {useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {timeText} from '../workflow/eventLifecycle'
const store=useEventLifecycleStore(),router=useRouter(),open=ref(false),dismissed=ref([])
try{dismissed.value=JSON.parse(sessionStorage.getItem('engine-room-dismissed-notices')||'[]')}catch{}
const unread=computed(()=>store.events.filter(e=>e.unread[store.state.role]))
const queue=computed(()=>store.notices.filter(n=>!dismissed.value.includes(n.id))),toast=computed(()=>queue.value[0]),queued=computed(()=>queue.value.length)
function dismiss(){if(toast.value){dismissed.value.push(toast.value.id);try{sessionStorage.setItem('engine-room-dismissed-notices',JSON.stringify(dismissed.value))}catch{}}}
function visit(id){dismiss();open.value=false;store.acknowledge(id);router.push({path:'/situation/issue/'+id,query:{from:'tasks'}})}
watch(()=>store.state.role,()=>open.value=false)
</script>
<style scoped>
.lc-notifications{position:relative}.lc-notifications>button{border:0;background:transparent;color:#7b8798;font-size:25px;position:relative;cursor:pointer;width:30px}.lc-notifications i{position:absolute;right:2px;top:2px;background:#d85855;width:6px;height:6px;border-radius:50%}
.lc-notice-menu{position:absolute;right:0;top:36px;width:320px;background:white;border:1px solid #e3e8f0;border-radius:7px;box-shadow:0 10px 30px #27344912;padding:15px;z-index:310}
.lc-notice-menu>button{display:flex;flex-direction:column;gap:7px;border:0;border-top:1px solid #edf0f5;padding:14px 0;background:white;text-align:left;width:100%;cursor:pointer;color:#425773}
.lc-notice-menu header{display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px}.lc-notice-menu header button{border:0;background:white;cursor:pointer}.lc-notifications small,.lc-notifications p{font-size:12px;color:#8593a5}
.lc-notice-toast{position:fixed;top:58px;right:18px;z-index:300;width:340px;max-width:calc(100vw - 40px);padding:18px;background:white;border:1px solid #e5e9f0;border-radius:7px;box-shadow:0 6px 24px #28394e17;color:#3c4d63;box-sizing:border-box;animation:notice-enter .22s ease-out}
.lc-notice-toast header{display:flex;align-items:center;gap:10px;margin-bottom:10px}.lc-notice-toast header small{color:#a28049}.lc-notice-toast time{margin-left:auto;color:#8d98a8;font-size:11px}.lc-notice-toast header button{background:none;border:0;color:#8d98a8;font-size:18px;cursor:pointer;padding:0 2px}
.lc-notice-toast strong{font-size:14px;font-weight:600;line-height:1.6}.lc-notice-toast p{line-height:1.75;margin:7px 0 10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.lc-notice-open{padding:4px 0;border:0;background:none;color:#a17c3e;font-size:12px;cursor:pointer}.lc-notice-count{float:right;margin-top:5px}
@keyframes notice-enter{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.lc-notice-toast{animation:none}}
</style>
