import {defineStore} from 'pinia'
import {reactive,computed,watch} from 'vue'
import {createLifecycleState,visibleEvents,pendingDecision,activeTask,decide,submitTask,askAssistant,people} from '../workflow/eventLifecycle.js'
const storageKey='engine-room-captain-workflow-v1',roleKey='engine-room-current-role'
export const useEventLifecycleStore=defineStore('event-lifecycle',()=>{
 let initial=createLifecycleState()
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.version===1&&Object.keys(initial.events).every(id=>saved.events?.[id]))initial=saved;const role=sessionStorage.getItem(roleKey);if(['captain','engineer'].includes(role))initial.role=role}catch{}
 initial.notices||=[];initial.role||='captain'
 const state=reactive(initial)
 const snapshot=()=>JSON.stringify({version:1,events:state.events,notices:state.notices})
 let lastStored=snapshot()
 watch(()=>[state.events,state.notices],()=>{const value=snapshot();if(value!==lastStored)try{lastStored=value;localStorage.setItem(storageKey,value)}catch{}},{deep:true})
 // Each browser tab keeps its role; only shared workflow data crosses tabs.
 window.addEventListener('storage',event=>{
  if(event.key!==storageKey||!event.newValue)return
  try{const incoming=JSON.parse(event.newValue);if(incoming.version!==1||!Object.keys(state.events).every(id=>incoming.events?.[id]))return
   lastStored=JSON.stringify({version:1,events:incoming.events,notices:incoming.notices||[]});state.events=incoming.events;state.notices=incoming.notices||[]
  }catch{}
 })
 const events=computed(()=>visibleEvents(state)),pending=computed(()=>events.value.filter(pendingDecision)),tasks=computed(()=>events.value.filter(e=>activeTask(e))),reports=computed(()=>events.value.flatMap(e=>e.reports).sort((a,b)=>b.at.localeCompare(a.at)))
 const unread=computed(()=>events.value.filter(e=>e.unread[state.role]).length)
 const notices=computed(()=>state.notices.filter(n=>n.recipient===state.role&&!n.read))
 function setRole(role){if(['captain','engineer'].includes(role)){state.role=role;try{sessionStorage.setItem(roleKey,role)}catch{}}}
 function markRead(id){if(state.events[id])state.events[id].unread[state.role]=false}
 function acknowledge(id){markRead(id);state.notices.filter(n=>n.eventId===id&&n.recipient===state.role).forEach(n=>n.read=true)}
 return {state,events,pending,tasks,reports,unread,notices,people,setRole,markRead,acknowledge,decide:(id,f)=>{decide(state,id,f);acknowledge(id)},submit:(id)=>{const report=submitTask(state,id);acknowledge(id);return report},ask:(id,text)=>askAssistant(state,id,text)}
})
