import {realCaseFor} from './realCaseAdapter.js'
import fixtures from './fourStoryFixtures.json' with {type:'json'}
import {healthTrackingSources} from './healthTrackingSources.js'
import {parentIssueId,maintenanceChildIds} from './issueRelationships.js'
import {closedEventReference} from './closedEventReferences.js'

// Original samples and user actions are separate immutable sources. Project them
// into a single chronology; never rewrite an earlier sample with today's answer.
export function sourceTrack(id,store){
 const root=parentIssueId(id)
 return healthTrackingSources.find(track=>track.id===root||track.requestId===root||track.recommendationId===id||store?.healthUpdates?.[track.id]?.recommendationId===id)
}
export function storyDate(id,store){
 const real=realCaseFor(id);if(real)return new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})
 const track=sourceTrack(id,store),latest=track&&store.healthUpdates?.[track.id]?.laterNodes?.at(-1)
 if(id==='aux-maintenance')return '2026-10-24 09:00'
 if(id==='main-warning')return '2026-10-16 08:00'
 return latest?.at||'2026-10-15 09:20'
}
export function storyTimeline(store,id,{taskOnly=false}={}){
 const reference=closedEventReference(id)
 if(reference)return reference.records.map(item=>({...item,label:item.title,done:true,source:reference.label,isSimulation:true,dataOrigin:reference.dataOrigin}))
 const realTrack=sourceTrack(id,store),realId=realTrack?.realCaseId?(realTrack.sourceCaseId||realTrack.requestId):id,real=realCaseFor(realId)
 if(real){
  const entries=(store.storyJournal||[]).filter(entry=>taskOnly?entry.taskId===id:entry.taskId===realId||entry.rootId===realTrack?.id).map(entry=>({...entry,label:entry.title,at:entry.storyAt||'来源未记录具体时刻',done:true}))
  const first=real.steps?.[0]
  return [...(!taskOnly&&first?[{id:realId+':initial-source',kind:'source',label:first.title,at:first.time||'来源未记录具体时刻',text:first.summary,assessment:first.result||'',actor:'原始采样／来源文献',isSimulation:false,done:true}]:[]),...entries]
 }
 const track=sourceTrack(id,store),root=track?.id||id
 const original=!taskOnly&&track?track.nodes.map((node,index)=>({id:`${root}:origin:${index}`,kind:'sample',label:node.label,at:node.at||originalDate(node.label),text:node.values+'；'+node.context,assessment:node.judgement,actor:'AI设备健康分析',order:index-100,done:true})):[]
 const children=maintenanceChildIds(id)
 const historical=!taskOnly?fixtures.history.filter(item=>parentIssueId(item.id)!==item.id&&parentIssueId(item.id)===(track?.requestId||id)).map(item=>({
   id:item.id,kind:'decision',label:item.title,at:item.at,text:item.reason,
   assessment:item.outcome,actor:item.actor,done:true,source:'已留存的历史决定',
 })): []
 const actions=(store.storyJournal||[]).filter(entry=>taskOnly?entry.taskId===id&&!['sample','recommendation'].includes(entry.kind):entry.rootId===root||entry.taskId===id||children.includes(entry.taskId)).map(entry=>({...entry,label:entry.title,at:entry.storyAt,done:true}))
 // Older callers may not hold a journal. Later samples are still available.
 const later=!taskOnly&&track?(store.healthUpdates?.[track.id]?.laterNodes||[]).filter(node=>!actions.some(entry=>entry.sampleKey===node.label)).map((node,index)=>({id:`${root}:later:${index}`,label:node.label,at:node.at,text:node.values+'；'+node.context,assessment:node.judgement,actor:'AI设备健康分析',order:index+100,done:true})):[]
 return [...original,...historical,...actions,...later].sort((a,b)=>normalizeDate(a.at).localeCompare(normalizeDate(b.at))||(a.order||0)-(b.order||0))
}
function originalDate(label){const match=label.match(/(\d{1,2})月(\d{1,2})日/);return match?`2026-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')} 08:00`:'2026-09-20 08:00'}
function normalizeDate(value){return String(value||'').replaceAll('/','-').replace('T',' ')}
export function healthStoryMarkdown(store,id){
 const track=sourceTrack(id,store);if(!track)return ''
 const state=store.healthUpdates?.[track.id]||{},latest=state.laterNodes?.at(-1)
 const assessment=store.checkAssessments?.[track.requestId]
 const feedback=assessment?.records||state.feedback||[]
 const recommendationId=state.recommendationId||track.recommendationId
 const work=recommendationId&&store.executionRecords?.[recommendationId]?.at(-1)
 const observation=recommendationId&&store.observationRecords?.[recommendationId]?.at(-1)
 const metrics=store.cases?.[recommendationId]?.observation
 const readings=observation?.values?.map((value,index)=>`${metrics?.names?.[index]||'指标'+(index+1)} ${value}${metrics?.units?.[index]||''}`).join('、')
 const current=work?`${work.values.executedAt.replace('T',' ')}，实际措施：${work.values.measures}。验收：${work.values.acceptance}。${work.values.completion!=='completed'?'本轮作业未完成，原范围继续。':work.values.verification==='unresolved'?'原问题仍存在，接续原任务评估。':work.values.verification!=='resolved'?'本轮验收尚未完成。':observation?.values?`最新可比节点${readings}；结合本次范围评价持续效果，原健康链保留。`:'现场验收已记录，持续效果待可比数据。'}`:latest?`${latest.at}，${latest.values}。${latest.judgement}`:assessment?.message||track.conclusion
 const task=state.taskComplete?`**任务状态：本次人工核实已结束**。原健康链继续，不代表设备已恢复。\n\n人员记录：${state.decision}`:track.requestId&&store.todoCreated?.[track.requestId]?`已派发给${store.assignments?.[track.requestId]?.owner||'原负责人'}，等待或补充现场核实；不重复派单。`:track.next
 const next=state.recommendationId?'结合累积趋势查看相关提前维保评估。原季度项目仍有效；检查决定本次实际范围，不预定换件。':state.taskComplete?'继续按相同测点、可比负荷比较；稳定偏移不等于恢复。出现新的信息需求时再安排现场补充。':track.next
 return `### 当前健康判断\n\n${current}\n\n### 已取得的现场信息\n\n${feedback.length?feedback.map(entry=>`- **${entry.label}：${entry.result}**。${entry.note||'未附补充说明，不能扩大解释。'}`).join('\n'):'尚未提交现场核实记录，现有读数只作为趋势资料。'}\n\n### 本次人工任务与后续\n\n${task}\n\n${next}\n\n### 解释边界\n\n温度与相对偏移共享原始测量；同源显示一致不等于校准。人员原文保留，未取得的燃油、负荷或维护背景仍为缺项。趋势发展不直接证明某部件损坏或剩余寿命。`
}
export function storyRevision(store,id){
 const track=sourceTrack(id,store)
 const children=maintenanceChildIds(id)
 return (store.storyJournal||[]).filter(entry=>entry.taskId===id||children.includes(entry.taskId)||track&&entry.rootId===track.id).at(-1)?.id||'origin'
}
