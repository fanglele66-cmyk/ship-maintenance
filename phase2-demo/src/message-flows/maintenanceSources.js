import config from './maintenance-advice.json'
import { resolveMessageFlow } from './resolveMessageFlow'

export function maintenanceMessageFlow(core,advice,planned=false,orderInfo=null) {
 const actions=planned?[{id:'maintenance:advice',label:'返回本部件建议'}]:[
  {id:'maintenance:ask:basis',label:'为什么建议提前检查？'},
  {id:'maintenance:ask:evidence',label:'需要补齐哪些证据？'},
  {id:'maintenance:ask:arrangement',label:'已有安排是否冲突？'},
  {id:'maintenance:supplement',label:'补充现场与安排信息'},
  ...(core.isTaskHandled('maintenance')?[{id:'maintenance:observation',label:'查看效果观察'}]:core.todoCreated.maintenance?[{id:'maintenance:event',label:'进入关联事件'}]:[{id:'maintenance:check',label:'确认开展检查'}]),
  ...(!core.isTaskHandled('maintenance')&&advice.sufficient&&advice.decision!=='execute'?[{id:'maintenance:execute',label:'采纳并安排执行'},{id:'maintenance:defer',label:'暂不采纳，记录原因'}]:[])
 ]
 const text=planned?'这里用于只读核对本部件周期安排及船管工单。候选通过接口演示返回，工单选择和确认集中在关联事件的准备页，不修改原工单内容。':core.isTaskHandled('maintenance')?'本次实际处理与验收已记录。你可以回看执行记录，并结合后续可比观测了解原振动变化是否恢复。':advice.decision==='defer'?'暂不采纳原因已保留，建议档案继续保留。这个决定不代表设备正常，也不撤销已有事件。':advice.decision==='execute'?'采纳决定已记录，请在原事件中接续维护安排和实际执行反馈；当前尚未确认已经执行。':advice.sufficient?'检查证据已补齐，现在需要评估是否采纳并安排执行。决定和执行结果会分别留存。':core.todoCreated.maintenance?'检查事件已关联。请在原事件中继续检查、补齐现场证据，不重复建立检查流程。':'当前建议先检查1#缸连杆轴承，再决定是否提前保养。振动持续上行，但现有证据还不足以确认轴瓦磨损。你可以先了解检查依据，或补充现场与靠港安排。'
 const sources={introduction:{role:'assistant',kind:'scene',title:planned?'已有安排 · 核对助手':'当前维保建议',paragraphs:[{label:planned?'只读核对':advice.status,text}],actions}}
 const entries=[...config.messages]
 if(!planned)for(const record of advice.records){
  const source=record.id,userSource=record.id+'-user'
  sources[userSource]={role:'user',text:record.userText || record.label,at:record.at,order:record.userOrder}
  entries.push({id:userSource,type:'text',source:userSource})
  sources[source]={role:'assistant',kind:'scene',title:record.label,at:record.at,order:record.order,paragraphs:[{label:'已记录',text:record.text}],actions:/确认开展检查|采纳并安排执行/.test(record.label)?[{id:'maintenance:event',label:'进入关联事件'}]:[]}
  entries.push({id:source,type:'report',source,expanded:true})
 }
 if(orderInfo?.syncedAt){
  sources.orderRead={role:'assistant',kind:'scene',title:'工单数据已读取',paragraphs:[{label:'来源',text:`${orderInfo.source}，取得 ${orderInfo.orders.length} 笔候选。选择与确认在事件准备页进行。`}],actions:core.todoCreated.maintenance?[{id:'maintenance:event',label:'进入关联事件'}]:[]}
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
 if(/冲突|计划|安排|工单|周期/.test(question) && orderInfo?.syncedAt)return {role:'assistant',text:`已从${orderInfo.source}取得 ${orderInfo.orders.length} 笔同部件候选。${orderInfo.linked?'当前关联 '+orderInfo.linked.id+' · '+orderInfo.linked.title:'AI 推荐工单仍待人员确认'}。请在事件准备页核对范围和窗口，确认或更换本次执行的工单；不会修改原工单内容。`}
 const text=/冲突|计划|安排|工单|周期/.test(question)?'当前周期安排为累计2,000 h检修，已运行1,860 h。提前建议和周期安排针对同一部件，需要核对范围和时间。真实工单与同步状态未取得，不能判断已安排或有无冲突；可以先补充现场安排。':/证据|检查|补齐|测点/.test(question)?'先核对振动测点固定、采集时间及转速负荷是否可比，补充润滑与外观情况，再按设备规程检查间隙及轴瓦状态。已关联事件时，在原事件中记录检查结果。':/为什么|依据|趋势|提前/.test(question)?'近7日振动由2.1升至3.0 mm/s，温度约65°C，距离周期检修约140 h。趋势与周期临近支持先检查，但不能单凭振动增幅确认轴瓦磨损或决定换件。':`你补充的信息可以通过“补充现场与安排信息”登记。当前${core.todoCreated.maintenance?'已有原问题事件，检查和实际执行在原事件接续':'尚需决定是否开展检查'}。普通留言不会自动完成核实、创建事件或确认执行。`
 return {role:'assistant',text}
}
