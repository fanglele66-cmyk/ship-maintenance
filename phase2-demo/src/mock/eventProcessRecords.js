import {storyTimeline} from './storyRecords.js'
import {workbenchIssues} from './captainWorkbench.js'
import {closedEventReference} from './closedEventReferences.js'
import {maintenanceChildIds} from './issueRelationships.js'
import {eventBriefingFor} from './eventBriefings.js'

const phases={source:'发现',sample:'发现',analysis:'研判',recommendation:'研判',assignment:'派发',feedback:'执行反馈',execution:'执行反馈',acceptance:'验收与观察',observation:'验收与观察',decision:'处置决定',closure:'闭环'}
export function eventProcessRecords(store,id){
 const reference=closedEventReference(id)
 if(reference)return {reference,records:reference.records.map(item=>({...item,dataOrigin:reference.dataOrigin}))}
 const issue=workbenchIssues(store).find(item=>item.id===id)
 if(!issue)return {reference:null,records:[]}
 const brief=eventBriefingFor(id)
 const timeline=storyTimeline(store,id),ids=[id,...maintenanceChildIds(id)]
 const original=timeline.filter(item=>item.kind==='source'||item.kind==='sample'&&String(item.id).includes(':origin:'))
 const records=(original.length?original:[{id:id+':discovery',kind:'source',label:'发现与起始依据',at:store.cases?.[id]?.firstObserved||issue.at||'',text:issue.evidence?.join('；')||issue.summary,actor:'智能机舱监测'}])
  .map(item=>({...item,title:brief?.discovery.label||item.label||item.title,actor:brief?.discovery.kind==='ship-alarm'?'船端报警系统':'智能机舱监测',text:brief?.discovery.text||item.text,phase:'发现',role:'assistant'}))
 records.push({id:id+':analysis',kind:'analysis',phase:'研判',title:'起始研判与判断边界',actor:'智能机舱研判',role:'assistant',text:issue.summary,assessment:issue.limit})
 const sourceIds=new Set(original.map(item=>item.id)),actions=timeline.filter(item=>!sourceIds.has(item.id))
 // Retain older saved assignments even when a journal entry was not stored.
 for(const taskId of ids){
  if(!actions.some(item=>item.taskId===taskId&&item.kind==='assignment'))(store.assignmentRecords?.[taskId]||[]).forEach((record,index)=>actions.push({id:taskId+':saved-assignment:'+index,kind:'assignment',taskId,label:'已保存的派发记录',at:record.at,actor:record.assignedBy,text:`${record.owner}负责${record.type}；${record.scope}；计划：${record.due}`}))
 }
 records.push(...actions.map(item=>({...item,title:item.label||item.title,phase:phases[item.kind]||'处置记录',role:['analysis','recommendation'].includes(item.kind)||String(item.actor).includes('AI')?'assistant':'user'})))
 return {reference:null,records}
}
