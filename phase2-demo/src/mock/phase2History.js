import {parentIssueId,isMaintenanceWorkflow,maintenanceChildIds} from './issueRelationships.js'
import {operationAssessment} from './phase2SituationContent'
import {workflowCases,deviceStoryAssessment,healthTracks} from './fourStoryWorkflow'
import {storyTimeline} from './storyRecords'

export const historyCategories=[{id:'all',label:'全部记录'},{id:'maintenance',label:'实际维护记录'},{id:'event',label:'检查与处置事件'},{id:'attention',label:'历史异动跟踪'},{id:'recommendation',label:'维保建议记录'},{id:'review',label:'每日健康回顾'}]
const timestamp=value=>{const parts=String(value||'2026-10-15 08:00').replace('T',' ').split(' ');return {date:parts[0],time:parts[1]||''}}
export function deviceHistory(store){
 const records=[]
 for(const track of healthTracks.filter(track=>track.realCaseId||store.unlockedRecommendations[track.requestId]||store.todoCreated[track.requestId]||maintenanceChildIds(track.requestId).some(id=>store.unlockedRecommendations[id]||store.todoCreated[id]))){
  const timeline=storyTimeline(store,track.id),latest=timeline.at(-1),state=store.healthUpdates?.[track.id]
  const current=track.id==='aux2-health'?deviceStoryAssessment(store,track.deviceId).conclusion:state?.conclusion||track.conclusion
  records.push({id:'health-'+track.id,trackId:track.id,type:'attention',deviceId:track.deviceId,...timestamp(latest?.at),title:track.title,status:state?.recommendationId?'已关联提前评估':state?.taskComplete?'核实已结束，持续跟踪':track.status,source:track.id,target:track.requestId||track.recommendationId,summary:current,conclusion:current,recommendation:state?.recommendationId?'回查原趋势、现场核实及本次提前建议；原计划仍保留。':state?.taskComplete?'原健康记录继续，没有新需求时不重复派单。':track.next,timeline,sections:[{title:'来源与解释范围',paragraphs:['原始观测、人员反馈、当时判断和任务决定沿同一来源留存。事件时间与操作登记时间分别记录；不能以核实任务结束代替健康恢复。']}]})
 }
 for(const item of store.visibleTodos){
  const id=item.id,stage=item.stages[store.progress[id]],decision=store.completedTasks[id],assignment=store.assignments[id]
  const feedback=store.stageHistory[id]||[]
  records.push({id:'event-'+id,type:isMaintenanceWorkflow(id)?'maintenance':'event',parentIssueId:parentIssueId(id),taskId:id,...timestamp(store.eventUpdatedAt[id]),title:item.initialTitle,status:decision?'本次已结束':store.isTaskHandled(id)?'已处理，后续观察':stage.label,source:item.source,target:parentIssueId(id),summary:decision?.reason||stage.summary,conclusion:decision?.reason||stage.summary,recommendation:decision?(item.trackingOnly?'核实结束后原健康跟踪继续。':'来源与本次决定保留。'):'查看原待办的实际反馈和当前安排。',sections:[{title:'来源与本次要求',paragraphs:[item.source,assignment?.scope||item.report.human]},{title:'已提交反馈',paragraphs:feedback.flatMap(entry=>(entry.records||[]).map(record=>record.label+'：'+record.result+'；'+(record.note||'未附备注')))}]})
  for(const [index,execution] of (store.executionRecords[id]||[]).entries()){
   records.push({id:'work-'+id+'-'+index,type:'maintenance',...timestamp(execution.values.executedAt),title:item.device+' · 实际执行记录',status:execution.values.completion==='completed'?'作业已完成':'进展已保存',source:execution.executor+' · 人员确认',target:id,summary:execution.values.measures,conclusion:execution.values.acceptance,recommendation:execution.values.verification==='unresolved'?'原异常仍存在，沿原事件重新排查。':execution.values.verification==='pending'?'现场验收尚待完成。':'持续效果另由可比观察验证，人工确认后闭环。',sections:[{title:'本轮实际范围',paragraphs:execution.scope},{title:'实际措施与验收',paragraphs:[execution.values.measures,execution.values.acceptance]},{title:'记录来源',paragraphs:[execution.executor+' · '+execution.values.executedAt,'人员确认于 '+execution.confirmedAt]}]})
  }
 }
 const advice=workflowCases['real-maintenance-c4-baseline'],adviceId=advice.id
 records.push({id:'recommendation-maintenance',type:'recommendation',...timestamp(advice.firstObserved),title:advice.initialTitle,status:store.completedTasks[adviceId]?'已留存评估结果':store.todoCreated[adviceId]?'已关联待办':store.ignoredSuggestions[adviceId]?'已记录决定':'待决策',source:advice.source,target:parentIssueId(adviceId),taskId:adviceId,parentIssueId:parentIssueId(adviceId),summary:advice.report.conclusion,conclusion:advice.report.conclusion,recommendation:advice.report.human,sections:[{title:'依据与原计划',paragraphs:[advice.report.basis]},{title:'处理边界',paragraphs:[advice.report.system]}]})
 for(const [index,decision] of store.suggestionDecisions.entries())records.push({id:'decision-'+decision.id+(index?'-'+index:''),type:isMaintenanceWorkflow(decision.id)?'recommendation':'attention',parentIssueId:parentIssueId(decision.id),taskId:decision.id,...timestamp(decision.at),target:parentIssueId(decision.id),title:'已记录决定：'+store.cases[decision.id].initialTitle,status:'已记录决定',source:decision.actor,summary:decision.reason,conclusion:decision.reason,recommendation:'本次不采纳的依据保留，原计划与来源记录不删除。',sections:[{title:'人员决定',paragraphs:[decision.reason,decision.actor+' · '+decision.at]}]})
 for(const [id,entries] of Object.entries(store.assignmentRecords))entries.forEach((entry,index)=>records.push({id:'assignment-'+id+'-'+index,type:isMaintenanceWorkflow(id)?'maintenance':'event',parentIssueId:parentIssueId(id),taskId:id,...timestamp(entry.at),target:parentIssueId(id),title:store.cases[id].initialTitle+' · 任务指派',status:'已指派',source:entry.assignedBy,summary:entry.owner+' · '+entry.type,conclusion:entry.scope,recommendation:'计划：'+entry.due,sections:[{title:'人员与本次要求',paragraphs:[entry.assignedBy+'指定'+entry.owner,entry.scope,'计划：'+entry.due]}]}))
 const review=operationAssessment(store)
 records.push({id:'review-today',type:'review',...timestamp(review.completedAt),title:'主机每日健康回顾',status:'可回查报告',source:'AI设备健康分析',summary:review.conclusion,conclusion:review.conclusion,recommendation:review.recommendation,sections:review.sections})
 for(const deviceId of ['aux-engine-1','aux-engine-2','aux-engine-3']){
  if(deviceId==='aux-engine-2'){
   const byDate=new Map((store.dailyHealthReports||[]).map(entry=>[entry.date,entry]))
   for(const entry of byDate.values()){
    const report=entry.report
    records.push({id:'review-aux-engine-2-'+entry.date,type:'review',deviceId,...timestamp(entry.at),title:'2号辅机每日健康回顾',status:'按日留存报告',source:'AI设备健康分析',summary:report.conclusion,conclusion:report.conclusion,recommendation:report.next,sections:[{title:'当日分析依据',paragraphs:[report.basis]},{title:'当日边界与下一步',paragraphs:[report.next,'该报告保留当日已取得的材料；后续节点另日留存，不回写成当日已知。']}]})
   }
   if(byDate.size)continue
  }
  const report=deviceStoryAssessment(store,deviceId),state=deviceId==='aux-engine-2'?store.healthUpdates?.['aux2-health']:null
  const at=state?.laterNodes?.at(-1)?.at||'2026-10-15 08:00'
  records.push({id:'review-'+deviceId,type:'review',deviceId,...timestamp(at),title:deviceId.replace('aux-engine-','')+'号辅机每日健康回顾',status:'可回查报告',source:'AI设备健康分析',summary:report.conclusion,conclusion:report.conclusion,recommendation:report.next,sections:[{title:'变化与分析依据',paragraphs:[report.basis]},{title:'判断边界与后续',paragraphs:[deviceId==='aux-engine-3'?'备用试运行只覆盖所记录负荷与时长，不代表所有负荷的能力。':deviceId==='aux-engine-2'?'现场核实、长期趋势与实际维护分别留痕。温度偏移不能转换为寿命损失，作业完成不能代替持续改善。':'已覆盖片段无持续变化不等于所有部位已验证。',report.next]}]})
 }
 return records.sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time))
}
