import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { usePhase2DemoStore } from './phase2DemoStore'
import { fetchShipWorkOrders } from '@/services/shipWorkOrders'
export const useEventWorkOrderStore=defineStore('event-work-orders',()=>{
 const core=usePhase2DemoStore(),events=reactive({})
 function state(id){return events[id] ||= {orders:[],pendingId:null,linked:null,records:[],loading:false,error:'',syncedAt:null,source:''}}
 async function load(id){const current=state(id);if(current.loading || current.syncedAt)return;current.loading=true;current.error='';try{const response=await fetchShipWorkOrders(id);current.orders=response.orders;current.source=response.source;current.syncedAt=response.syncedAt;current.pendingId=response.orders[0]?.id || null}catch{current.error='读取工单失败，请重试。'}finally{current.loading=false}}
 function choose(id,orderId){const current=state(id);if(core.isTaskHandled(id)||!current.orders.some(order=>order.id===orderId))return false;current.pendingId=orderId;return true}
 function confirm(id){
  const current=state(id),order=current.orders.find(order=>order.id===current.pendingId)
  if(!core.todoCreated[id]||core.isTaskHandled(id)||!order||order.status!=='待执行'||current.linked?.id===order.id)return false
  const at=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),previousId=current.linked?.id
  current.linked=JSON.parse(JSON.stringify(order))
  current.records.push({id:`${id}-link-${current.records.length+1}`,at,orderId:order.id,title:order.title,previousId,action:previousId?'更换关联工单':'确认关联工单'})
  core.logs[id].push({role:'user',text:`确认关联工单 ${order.id} · ${order.title}`,at},{role:'assistant',text:`已将船管工单 ${order.id} 关联到本事件${previousId?'，替换此前关联 '+previousId:''}。原工单内容、计划及执行状态未修改，后续检查与实际执行在本事件接续。`,at})
  return true
 }
 watch(()=>Object.fromEntries(Object.entries(core.todoCreated)),created=>{for(const id of Object.keys(events))if(!created[id])delete events[id]},{flush:'sync'})
 return {events,state,load,choose,confirm}
})
