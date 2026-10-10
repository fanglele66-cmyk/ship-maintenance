<template>
  <div class="conversation-header-actions">
  <button class="conversation-history-trigger" type="button" aria-label="新建对话" title="新建对话" @click="create">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
  </button>
  <button ref="trigger" class="conversation-history-trigger" type="button" aria-label="查看历史消息" title="历史消息" :aria-expanded="opened" @click="open">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.5 8.2M3 4v6h6"/><path d="M12 7v5l3 2"/></svg>
  </button>
  </div>
  <section v-if="opened" class="conversation-history-panel" role="dialog" aria-label="历史对话" @keydown.esc.stop="close">
    <header><div><strong>历史对话</strong><small>当前智能体的对话</small></div><button ref="closeButton" type="button" aria-label="关闭历史消息" @click="close">✕</button></header>
    <div class="conversation-history-list">
      <button v-for="conversation in visibleConversations" :key="conversation.id" class="conversation-history-item" :class="{active:conversation.id===currentId}" type="button" :aria-current="conversation.id===currentId?'true':undefined" @click="select(conversation.id)">
        <div class="conversation-history-item-heading"><strong>{{ conversation.title }}</strong><span v-if="conversation.id===currentId">当前</span></div>
        <time>{{ formatTime(conversation.updatedAt) }}</time>
        <p>{{ preview(conversation) }}</p>
      </button>
    </div>
  </section>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { historyConversations } from '@/composables/useAgentConversations'
const props=defineProps({conversations:{type:Array,required:true},currentId:{type:String,required:true}})
const visibleConversations=computed(()=>historyConversations(props.conversations))
const emit=defineEmits(['select','new-conversation'])
const opened=ref(false),trigger=ref(null),closeButton=ref(null)
async function open(){opened.value=true;await nextTick();closeButton.value?.focus()}
async function close(){opened.value=false;await nextTick();trigger.value?.focus()}
function select(id){emit('select',id);close()}
function create(){emit('new-conversation');close()}
function preview(conversation){const message=conversation.messages.at(-1);return message?.text || message?.title || (message?.content || message?.raw || '').replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ') || '暂无消息'}
function formatTime(value){const date=new Date(value),today=new Date(); const day=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime(),start=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime(); const label=day===start?'今天':day===start-86400000?'昨天':`${date.getMonth()+1}月${date.getDate()}日`;return `${label} ${date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`}
watch(()=>props.currentId,()=>{opened.value=false})
</script>
<style>
.conversation-header-actions { display:flex; align-items:center; gap:4px; margin-left:auto; flex:none; }
.conversation-history-trigger { flex:none; width:32px; height:32px; display:grid; place-items:center; border:0; border-radius:8px; background:transparent; color:#6c7183; cursor:pointer; }
.conversation-history-trigger:hover { background:#f5f7fa; color:#947448; }
.conversation-history-trigger:focus-visible { outline:2px solid #b7935a; outline-offset:2px; }
.p2-restored-assistant,.kap-panel { position:relative; }
.conversation-history-panel { position:absolute; inset:0; z-index:20; display:flex; flex-direction:column; background:#fff; border-radius:inherit; overflow:hidden; color:#1d2129; }
.conversation-history-panel header { display:flex; align-items:center; justify-content:space-between; padding:16px; border-bottom:1px solid #ebeef5; }
.conversation-history-panel header strong { display:block; font-size:18px; line-height:28px; font-weight:600; }
.conversation-history-panel header small { font-size:12px; color:#9195a2; }
.conversation-history-panel header button { border:0; background:#f5f7fa; width:32px; height:32px; border-radius:8px; cursor:pointer; color:#6c7183; }
.conversation-history-list { flex:1; min-height:0; overflow:auto; padding:16px; }
.conversation-history-item { display:block; width:100%; margin:0 0 10px; padding:14px; border:1px solid #ebeef5; border-radius:8px; background:#fff; text-align:left; cursor:pointer; font:inherit; }
.conversation-history-item:hover { border-color:#cbb58e; }
.conversation-history-item.active { background:#faf8f3; border-color:#d8c4a2; }
.conversation-history-item-heading { display:flex; align-items:baseline; gap:8px; }
.conversation-history-item-heading strong { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; line-height:24px; color:#1d2129; }
.conversation-history-item-heading span { flex:none; font-size:11px; color:#947448; }
.conversation-history-item time { display:block; font-size:12px; color:#9195a2; margin:5px 0; }
.conversation-history-item p { margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#6c7183; font-size:13px; line-height:22px; }
</style>
