import {maintenanceReview} from '@/mock/maintenanceReview'
import config from './maintenance-advice.json'
import { resolveMessageFlow } from './resolveMessageFlow'

export function maintenanceMessageFlow(core,advice,planned=false,orderInfo=null) {
 const actions=planned?[{id:'maintenance:advice',label:'返回本部件建议'}]:[
  {id:'maintenance:ask:basis',label:'为什么建议清洁与复校？'},
  {id:'maintenance:ask:evidence',label:'前置取证有哪些？'},
  {id:'maintenance:ask:arrangement',label:'已有安排是否冲突？'},
  {id:'maintenance:supplement',label:'补充现场与安排信息'},
  ...(core.isTaskHandled(advice.sourceEventId)?[{id:'maintenance:observation',label:'查看效果观察'}]:core.todoCreated[advice.sourceEventId]?[{id:'maintenance:event',label:'进入关联事件'}]:[]),
  ...(!core.isTaskHandled(advice.sourceEventId)&&advice.sufficient&&advice.decision!=='execute'?[{id:'maintenance:execute',label:'采纳并安排执行'},{id:'maintenance:defer',label:'暂不采纳，记录原因'}]:[])
 ]
 const text=planned?'正式计划与工单尚未取得，不推测作业窗口。':advice.decision==='defer'?'暂不采纳原因已保留，原事件与证据保留。':advice.decision==='execute'?'采纳决定已记录，在原3号缸事件接续安排；尚不代表执行完成。':'已确认的前置证据支持清洁与复校评估，由轮机长审阅安排。'
 const review=maintenanceReview(core,advice,orderInfo||{})
 const sources={introduction:{role:'assistant',kind:'scene',title:planned?'已有安排 · 核对助手':'首次审阅 · 建议摘要',paragraphs:planned?[{label:'只读核对',text}]:[{label:review.status,text:advice.decision==='defer'?text:review.recommendation},{label:'判断边界',text:review.limitation}],actions}}
 const entries=[...config.messages]
 if(!planned)for(const record of advice.records){
  const source=record.id,userSource=record.id+'-user'
  sources[userSource]={role:'user',text:record.userText || record.label,at:record.at,order:record.userOrder}
  entries.push({id:userSource,type:'text',source:userSource})
  sources[source]={role:'assistant',kind:'scene',title:record.label,at:record.at,order:record.order,paragraphs:[{label:'已记录',text:record.text}],actions:/确认开展检查|采纳并安排执行/.test(record.label)?[{id:'maintenance:event',label:'进入关联事件'}]:[]}
  entries.push({id:source,type:'report',source,expanded:true})
 }
 if(!planned)for(const record of review.decisions.filter(item=>item.source!=='维保建议决定')){
  const source='maintenance-review-'+record.id+'-'+record.at
  sources[source]={role:'assistant',kind:'scene',title:record.label,at:record.at,paragraphs:[{label:record.source,text:record.text}],actions:core.todoCreated[advice.sourceEventId]?[{id:'maintenance:event',label:'进入关联事件'}]:[]}
  entries.push({id:source,type:'report',source,expanded:true})
 }
 if(orderInfo?.syncedAt){
  sources.orderRead={role:'assistant',kind:'scene',title:'工单数据已读取',paragraphs:[{label:'来源',text:`${orderInfo.source}，取得 ${orderInfo.orders.length} 笔候选。选择与确认在事件准备页进行。`}],actions:core.todoCreated[advice.sourceEventId]?[{id:'maintenance:event',label:'进入关联事件'}]:[]}
  entries.push({id:'maintenance-orders-read',type:'notice',source:'orderRead',expanded:true})
  for(const record of orderInfo.records){
   const source=record.id
   sources[source]={role:'assistant',kind:'scene',title:record.action,at:record.at,paragraphs:[{label:'关联结果',text:`${record.orderId} · ${record.title}${record.previousId?'；替换此前关联 '+record.previousId:''}。只记录工单选择，不修改原工单内容，不代表现场已经执行。`}],actions:[{id:'maintenance:event',label:'进入关联事件'}]}
   entries.push({id:source,type:'report',source,expanded:true})
  }
 }
 return resolveMessageFlow({...config,messages:entries},sources)
}
export function maintenanceReply(core,question,orderInfo=null) {
 const text=/冲突|计划|安排|工单|周期/.test(question)?'尚未取得3号缸喷油器的正式周期计划和工单，也没有靠港窗口数据。实施时间、人员、停机隔离与许可需由轮机长确认，不能判断已有安排是否冲突。':/证据|检查|取证|测点/.test(question)?'原3号缸事件保留前置派工与确认的检查记录：现场读数与系统比对、喷嘴积炭观察以及喷雾状态检查报告。部件证据支持维护评估，不代表其他原因全部排除；后续补充仍在原事件留存。':/为什么|依据|趋势|提前/.test(question)?'3号缸排温观测记录361.8→371.8°C，与2号缸对照差4.8→14.8°C。排温变化本身不能定位部件；结合已确认的喷嘴积炭与状态检查报告，建议清洁与复校。尚不能据此直接决定换件，也不编造提前运行小时数。':'补充的信息会单独登记，普通留言不确认取证或执行。在原3号缸事件继续安排，不重复建立事件。'
 return {role:'assistant',text}
}
