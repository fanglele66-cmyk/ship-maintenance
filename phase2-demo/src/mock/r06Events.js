// Read-only adapter: no event creation, closure or stage progression here.
export function relatedEvents(store){
 return store.visibleTodos.map(item=>{
  const id=item.id,stage=item.stages[store.progress[id]],ended=store.eventStatus?.[id]==='closed',handled=store.isTaskHandled(id)
  const source=item.source?null:id==='fault'?null:id==='drift'?{id,type:'关注事项',title:'主机3#缸排温偏离渐高'}:{id,type:'维保建议',title:'1#缸连杆轴承提前检查建议'}
  const observation=handled?store.getObservationResult(id):null
  let action=ended?'暂无需人工操作，可回看本事件的处理及观察记录。':handled?observation.type==='reinspect'?'处理后出现反复，请进入原事件核对新证据并按要求复查。':observation.type==='extend'?'本轮可比记录不足，请补充数据或现场信息，不能按正常处理。':'暂无需人工操作，继续效果观察。':stage?.tasks?.length?'需要你：'+stage.tasks.map(task=>task.label).join('；')+'。':id==='fault'?'需要你：在原事件核对现场温度、流量及运行工况，按当前要求检查冷却回路。':'下一步：'+(stage?.action||'现场检查')+'。请进入原事件核对证据、范围与安全要求。'
  if(!ended&&observation?.type==='archive')action='本轮效果观察已结束，恢复常规监测；事件仍未结束，其他要求以原事件为准。'
  return {id,eventId:item.eventId||'EVT-ME-'+({fault:'001',maintenance:'002',drift:'003'})[id],title:id==='drift'&&store.progress[id]>=2?item.eventTitle:item.initialTitle,source,
   trigger:item.source|| (id==='fault'?'AI故障检测':id==='drift'?'关注事项转检查':'维保建议确认推进'),ended,status:ended?'已结束':'未结束',stage:ended?'事件已结束':handled?(observation?.type==='archive'?'本轮效果观察已结束':'效果观察'):stage?.label||'阶段未同步',handled,
   processing:ended?'原事件已明确结束':handled?'人工处理已完成 · '+(observation?.type==='archive'?'本轮观察已结束':'效果观察中'):'待完成当前阶段要求',action,updatedAt:store.eventUpdatedAt?.[id]||'更新时间未同步'}
 })
}
export function eventQuestionReply(store,text){
 if(/为什么|为何/.test(text)&&/3#|3号/.test(text)&&/没有|没出/.test(text))return store.todoCreated.drift?'3#缸已经关联 EVT-ME-003，请在关联事件列表进入原事件继续处理，原关注档案仍保留。':'3#缸当前只有关注及核实要求，尚未确认开展检查，因此没有对应事件。可进入原关注档案补齐核实；普通留言或核实提交不自动建立事件。'
 if(/结束|关闭|清洗.*完成|处理.*完成/.test(text))return '人工处理完成、本轮效果观察结束和事件结束是不同状态。设备页只读取原事件是否结束；观察结束或退出详情不会自动关闭事件。请在关联事件中查看原记录，实际处理后可查看效果观察。'
 if(/又建|重复|另一张/.test(text))return '同一问题已有事件时继续使用原事件。关注档案和维保建议保留来源关联，不因确认维护再复制另一条事件。'
 if(/继续处理.*冷却|冷却.*继续处理/.test(text))return '请在关联事件列表进入 EVT-ME-001，按原事件当前阶段继续检查或处置；设备页不提供重复处理表单。'
 return null
}
