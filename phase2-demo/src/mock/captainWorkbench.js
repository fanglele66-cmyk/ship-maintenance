import {workflowIssues,historicalDecisions} from './fourStoryWorkflow.js'
import {issueTypeNames,maintenanceChildIds,maintenanceRecommendations,isTrackingContainer,parentIssueId} from './issueRelationships.js'
export const issueCatalog=[...workflowIssues,...historicalDecisions.filter(item=>!item.parentIssueId).map(item=>({...item,rank:issueTypeNames.indexOf(item.type),summary:item.reason,evidence:item.facts,limit:item.outcome,history:true,action:'查看记录'}))]
export function issueState(store,id){
 const item=store.cases?.[id],children=maintenanceRecommendations(store,id)
 const disposition=store.trackingDispositions?.[id]
 if(disposition?.status==='closed')return {state:'已闭环',taskId:null,decisionId:id}
 if(disposition)return {state:disposition.status==='observing'?'专项观察中':'待轮机长确认',taskId:null,decisionId:id}
 const assigned=children.find(child=>child.state==='已派发'&&store.eventStatus?.[child.id]!=='closed')
 const pending=children.find(child=>child.state==='待决策')
 if(assigned)return {state:'已派发',taskId:assigned.id,decisionId:assigned.id}
 if(pending)return {state:'待决策',taskId:null,decisionId:pending.id}
 if(!isTrackingContainer(id)&&store.todoCreated?.[id]&&!store.completedTasks?.[id]&&store.eventStatus?.[id]!=='closed')return {state:'已派发',taskId:id,decisionId:id}
 if(item?.trackingOnly&&(isTrackingContainer(id)||store.completedTasks?.[id]?.action==='finish-tracking'))return {state:store.completedTasks?.[id]?'待轮机长确认':children.some(child=>child.state==='已记录决定')?'已记录决定':'跟踪中',taskId:null,decisionId:id}
 return {state:store.eventStatus?.[id]==='closed'?'已闭环':store.ignoredSuggestions?.[id]?'已记录决定':'待决策',taskId:store.todoCreated?.[id]?id:null,decisionId:id}
}
// Public event status is deliberately independent of the executable task phase.
export function publicEventState(state){return state==='已闭环'?'已闭环':state==='待决策'?'待决策':'处置中'}
export function workbenchIssues(store){
 const rows=issueCatalog.filter(item=>!item.latent||store.unlockedRecommendations?.[item.id]||store.todoCreated?.[item.id]||store.ignoredSuggestions?.[item.id]||maintenanceRecommendations(store,item.id).length).map(item=>{
  const state=item.history?{state:'已闭环',taskId:null,decisionId:null}:issueState(store,item.id)
  const contextId=state.taskId||state.decisionId||maintenanceChildIds(item.id).find(id=>store.completedTasks?.[id]||store.ignoredSuggestions?.[id])||item.id
  return {...item,...state,eventState:publicEventState(state.state),maintenanceRecommendations:maintenanceRecommendations(store,item.id),updatedAt:store.eventUpdatedAt?.[contextId]||item.at,decisionReason:store.ignoredSuggestions?.[contextId]?.reason,owner:store.assignments?.[contextId]?.owner||item.actor,stage:store.completedTasks?.[contextId]?.title||(store.todoCreated?.[contextId]?store.cases?.[contextId]?.stages[store.progress?.[contextId]]?.label:undefined)}
 })
 return sortIssues(rows)
}
export function captainDeviceSignal(store,deviceId){
 const rows=workbenchIssues(store).filter(i=>i.deviceId===deviceId&&['待决策','已派发'].includes(i.state))
 return rows.some(i=>i.rank<=1)?'danger':rows.length?'warning':'normal'
}
export function captainAnalysis(store,deviceIds){
 const rows=workbenchIssues(store).filter(item=>!item.history&&(!deviceIds||deviceIds.includes(item.deviceId)))
 const pending=rows.filter(item=>item.state==='待决策'),assigned=rows.filter(item=>item.state==='已派发')
 const brief=rows.map(item=>'- **'+item.title+'**：'+item.state+(item.stage?' · '+item.stage:'')).join('\n')
 return `### 健康态势分析\n\n当前有 ${pending.length} 项待决策、${assigned.length} 项已派发。二缸报警、控制空气预警与异动跟踪按各自证据推进；维保建议在健康趋势观测中形成。\n\n${brief}\n\n### 建议\n\n优先核对报警和低压预警的现场依据；一缸与四缸基线变化需结合工况、历史调整和测温校验解释，专项检查分别评估必要性与条件。已有任务沿原事项跟进。\n\n一缸与四缸采用同刻六缸月度资料分别跟踪；后续建议及执行记录归入该跟踪，不重复计为独立事件。`
}

// Completion of hands-on work is distinct from closure after observation.
export function isIssueClosed(store,id){const root=parentIssueId(id);return issueState(store,root).state==='已闭环'}
export function activeWorkbenchIssues(store){return workbenchIssues(store).filter(i=>i.eventState!=='已闭环')}

export const issueDevices=[{value:'main-engine-1',label:'主机'},{value:'aux-engine-1',label:'1号辅机'},{value:'aux-engine-2',label:'2号辅机'},{value:'aux-engine-3',label:'3号辅机'}]
export const issueTypes=[...issueTypeNames]
const deviceOrder=Object.fromEntries(issueDevices.map((d,index)=>[d.value,index]))
export function sortIssues(rows,{stateFirst=false}={}){
 const stateOrder={'待决策':0,'已派发':1}
 const timestamp=item=>{const value=Date.parse(item.updatedAt||'');return Number.isFinite(value)?value:0}
 return [...rows].sort((a,b)=>(stateFirst?(stateOrder[a.state]??2)-(stateOrder[b.state]??2):0)||a.rank-b.rank||(deviceOrder[a.deviceId]??99)-(deviceOrder[b.deviceId]??99)||timestamp(b)-timestamp(a))
}
export function filterIssueRows(rows,{state='',device='',type=''}={}){return sortIssues(rows.filter(i=>['待决策','已派发'].includes(i.state)&&(!state||i.state===state)&&(!device||i.deviceId===device)&&(!type||i.type===type)),{stateFirst:true})}
export function issueBatch(rows,batch=1){return rows.slice(0,Math.max(1,batch)*10)}
