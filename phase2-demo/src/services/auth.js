import {reactive} from 'vue'
import {sessionHeaders,saveSession,clearSession} from './session.js'
export const auth=reactive({ready:false,user:null,deletedIds:[],error:''})
export async function accountRequest(path,body){
 const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{...sessionHeaders(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const data=await response.json()
 if(!response.ok)throw Object.assign(Error(data.error||'请求失败'),{status:response.status})
 return data
}
export async function loadAccount(){try{const result=await accountRequest('auth/me');Object.assign(auth,result,{error:''})}catch(e){auth.user=null;auth.error=e.message}finally{auth.ready=true}}
export async function login(username,password){const result=await accountRequest('auth/login',{username,password});saveSession(result.sessionToken);location.reload()}
export async function logout(){const {useEventLifecycleStore}=await import('../stores/eventLifecycleStore');await useEventLifecycleStore().flush();await accountRequest('auth/logout',{});clearSession();location.reload()}
export function pruneDeletedEvents(state){
 const removed=new Set(auth.deletedIds)
 let changed=true
 while(changed){changed=false;for(const event of Object.values(state.events||{}))if(removed.has(event.parentEventId)&&!removed.has(event.id)){removed.add(event.id);changed=true}}
 for(const id of removed)delete state.events[id]
 state.notices=(state.notices||[]).filter(n=>!removed.has(n.eventId))
 for(const event of Object.values(state.events||{}))if(event.observationEventIds)event.observationEventIds=event.observationEventIds.filter(id=>!removed.has(id))
 for(const event of Object.values(state.events||{}))for(const phase of event.phases||[])if(removed.has(phase.observationEventId))delete phase.observationEventId
 return [...removed]
}
