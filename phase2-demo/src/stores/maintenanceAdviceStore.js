import {defineStore} from 'pinia'
import {computed,ref,watch,nextTick} from 'vue'
import {usePhase2DemoStore} from './phase2DemoStore'
import {maintenanceExample,seedMaintenanceEvidence} from '@/mock/maintenanceExample'
export const useMaintenanceAdviceStore=defineStore('maintenance-advice',()=>{
 const core=usePhase2DemoStore(),decision=ref(null),records=ref([]),chatMessages=ref([]),sequence=ref(0),demoEnabled=ref(false)
 const sourceEventId=maintenanceExample.sourceEventId,adviceId=maintenanceExample.id
 const sufficient=computed(()=>core.logs[sourceEventId].some(m=>m.id==='injector-demo-evidence')||core.logs[sourceEventId].some(m=>m.kind==='feedbackRecord'&&m.task===core.cases[sourceEventId].stages.find(s=>s.id==='investigate').title&&m.records?.some(r=>/喷嘴积炭/.test(r.result)&&/喷雾状态未达到/.test(r.result))))
 const executed=computed(()=>core.executionRecords[sourceEventId]?.at(-1)?.values.completion==='completed')
 const status=computed(()=>executed.value?'实际执行已记录':decision.value==='defer'?'暂不采纳':decision.value==='execute'?'已采纳 · 待执行':sufficient.value?'取证已确认 · 待审阅安排':'前置取证待确认')
 function enableExample(){demoEnabled.value=true;seedMaintenanceEvidence(core)}
 function nextOrder(){return ++sequence.value}
 function record(label,text,userText=label){const at=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'});records.value.push({id:`${adviceId}-decision-${records.value.length+1}`,label,text,at,userText,userOrder:nextOrder(),order:nextOrder()});core.logs[sourceEventId].push({role:'assistant',text:`${label}：${text}`,at})}
 function decide(type,reason=''){
  if(executed.value)return false
  if(type==='check')return false // the new example never creates a second inspection event
  if(type==='execute'){
   if(!sufficient.value||decision.value==='execute'||!core.todoCreated[sourceEventId])return false
   decision.value='execute';record('采纳并安排执行','在原3号缸事件中接续喷油器清洁与复校；不创建另一事件，不决定换件，不修改工单，不认定已执行。')
  }else if(type==='defer'){
   if(!reason.trim()||decision.value==='defer')return false
   decision.value='defer';record('暂不采纳',reason.trim()+'；保留建议、前置证据及原事件，不代表设备已恢复正常，不撤销既有任务。','暂不采纳：'+reason.trim())
  }else return false
  core.suggestionDecisions.push({id:adviceId,type,reason:reason.trim(),at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})})
  return true
 }
 function supplement(text){if(!text.trim())return false;record('补充信息',text.trim()+'；尚未经核实，不自动完成取证或执行。','补充信息：'+text.trim());return true}
 watch(()=>core.logs[sourceEventId].length,length=>{if(length===0){decision.value=null;records.value=[];chatMessages.value=[];sequence.value=0;if(demoEnabled.value)nextTick(()=>seedMaintenanceEvidence(core))}},{flush:'sync'})
 return {sourceEventId,adviceId,decision,records,chatMessages,nextOrder,sufficient,status,decide,supplement,enableExample}
})
