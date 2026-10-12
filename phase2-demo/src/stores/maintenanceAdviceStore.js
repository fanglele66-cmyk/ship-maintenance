import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { usePhase2DemoStore } from './phase2DemoStore'

export const useMaintenanceAdviceStore=defineStore('maintenance-advice',()=>{
 const core=usePhase2DemoStore(),decision=ref(null),records=ref([]),chatMessages=ref([]),sequence=ref(0)
 const sufficient=computed(()=>core.progress.maintenance>=2)
 const status=computed(()=>core.isTaskHandled('maintenance')?'已实际执行':decision.value==='defer'?'暂不采纳':decision.value==='execute'?'已采纳 · 待执行':core.todoCreated.maintenance?'检查事件已关联':'待确认开展检查')
 function nextOrder(){return ++sequence.value}
 function record(label,text,userText=label){
  const at=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})
  records.value.push({id:`maintenance-decision-${records.value.length+1}`,label,text,at,userText,userOrder:nextOrder(),order:nextOrder()})
  core.logs.maintenance.push({role:'assistant',text:`${label}：${text}`,at})
 }
 function decide(type,reason=''){
  if(core.isTaskHandled('maintenance'))return false
  if(type==='check'){
   if(core.todoCreated.maintenance)return false
   core.createTodo('maintenance');core.progress.maintenance=Math.max(core.progress.maintenance,core.cases.maintenance.stages.findIndex(stage=>stage.id==='check'));core.activeStage.maintenance=core.progress.maintenance;decision.value='check'
   record('确认开展检查','已关联本问题的检查事件；确认检查不代表确认磨损或同意换件。')
  }else if(type==='execute'){
   if(!sufficient.value || decision.value==='execute')return false
   if(!core.todoCreated.maintenance)core.createTodo('maintenance')
   const workIndex=core.cases.maintenance.stages.findIndex(stage=>stage.kind==='work');core.progress.maintenance=Math.max(core.progress.maintenance,workIndex);core.activeStage.maintenance=core.progress.maintenance
   decision.value='execute';record('采纳并安排执行','在原问题事件中接续实际维护；没有自动完成工单、修改周期或确认现场已经执行。')
  }else if(type==='defer'){
   if(!sufficient.value || !reason.trim())return false
   decision.value='defer';record('暂不采纳',reason.trim()+'；建议档案保留，不代表设备已恢复正常，也不撤销已有事件。','暂不采纳：'+reason.trim())
  }else return false
  return true
 }
 function supplement(text){if(!text.trim())return false;record('补充信息',text.trim()+'；人员补充尚未经核实，不自动创建事件或推进执行。','补充信息：'+text.trim());return true}
 watch(()=>core.logs.maintenance.length,length=>{if(length===0){decision.value=null;records.value=[];chatMessages.value=[];sequence.value=0}}, {flush:'sync'})
 return {decision,records,chatMessages,nextOrder,sufficient,status,decide,supplement}
})
