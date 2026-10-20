import {isIssueClosed} from './captainWorkbench.js'
import {parentIssueId} from './issueRelationships.js'
// Read-only adapter: no event creation, closure or stage progression here.
export function relatedEvents(store){
 const groups=new Map()
 for(const item of store.visibleTodos){const root=parentIssueId(item.id);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(item)}
 return [...groups].map(([root,items])=>{
  const item=[...items].reverse().find(entry=>!store.isTaskHandled(entry.id))||items.at(-1)
  const id=item.id,origin=store.cases[root]||item,stage=item.stages[store.progress[id]],ended=isIssueClosed(store,root),handled=store.isTaskHandled(id)
  const source=origin.cardType==='报警事件'?null:{id:root,type:origin.cardType,title:origin.initialTitle}
  const observation=handled?store.getObservationResult(id):null
  let action=ended?'暂无需人工操作，可回看本事件的处理及观察记录。':handled?observation.type==='reinspect'?'处理后出现反复，请进入原事件核对新证据并按要求复查。':observation.type==='extend'?'本轮可比记录不足，请补充数据或现场信息，不能按正常处理。':'暂无需人工操作，继续效果观察。':stage?.tasks?.length?'需要你：'+stage.tasks.map(task=>task.label).join('；')+'。':id==='fault'?'需要你：在原事件核对现场温度、流量及运行工况，按当前要求检查冷却回路。':'下一步：'+(stage?.action||'现场检查')+'。请进入原事件核对证据、范围与安全要求。'
  if(!ended&&observation?.type==='archive')action='本轮观测已达到窗口，仍待人工确认闭环。'
  if(store.completedTasks?.[id])action=store.completedTasks[id].reason
  return {id:root,taskId:id,taskIds:items.map(entry=>entry.id),eventId:origin.eventId||'EVT-ME-'+({fault:'001',maintenance:'002',drift:'003'})[id],title:origin.initialTitle,source,
   trigger:item.source|| (id==='fault'?'AI故障检测':id==='drift'?'异动跟踪转检查':'健康趋势内的维保评估'),ended,status:ended?'已结束':'未结束',stage:ended?'事件已结束':origin.trackingOnly&&store.completedTasks?.[id]?'健康趋势观测':handled?(observation?.type==='archive'?'本轮效果观察已结束':'效果观察'):stage?.label||'阶段未同步',handled,
   processing:ended?'本次记录已结束，来源仍可回查':origin.trackingOnly&&store.completedTasks?.[id]?'本次人工任务结束 · 健康趋势继续':handled?'人工处理已完成 · '+(observation?.type==='archive'?'待确认闭环':'效果观察中'):'待完成当前阶段要求',action,updatedAt:store.eventUpdatedAt?.[id]||'更新时间未同步'}
 })
}
export function eventQuestionReply(store,text){
 if(/为什么|为何/.test(text)&&/3#|3号/.test(text)&&/没有|没出/.test(text))return store.todoCreated.drift?'3#缸已经关联 EVT-ME-003，请在关联事件列表进入原事件继续处理，原异动跟踪档案仍保留。':'3#缸当前只有关注及核实要求，尚未确认开展检查，因此没有对应事件。可进入原异动跟踪档案补齐核实；普通留言或核实提交不自动建立事件。'
 if(/结束|关闭|清洗.*完成|处理.*完成/.test(text))return '人工处理完成、本轮效果观察结束和事件结束是不同状态。设备页只读取原事件是否结束；观察结束或退出详情不会自动关闭事件。请在关联事件中查看原记录，实际处理后可查看效果观察。'
 if(/又建|重复|另一张/.test(text))return '同一问题已有事件时继续使用原事件。异动跟踪档案和维保建议保留来源关联，不因确认维护再复制另一条事件。'
 if(/继续处理.*冷却|冷却.*继续处理/.test(text))return '请在关联事件列表进入 EVT-ME-001，按原事件当前阶段继续检查或处置；设备页不提供重复处理表单。'
 return null
}
