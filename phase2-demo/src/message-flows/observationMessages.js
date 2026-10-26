import {observationScene} from '@/mock/phase2Observation'

// An observation query belongs to the original event, not to its old decision form.
export function observationMessages(store,id,messages=[]){
 const item=store.cases[id]
 if(!item)return []
 const records=store.observationRecords[id]||[],round=store.observationRounds[id]||1
 const closed=store.eventStatus[id]==='closed',execution=store.executionRecords[id]?.at(-1)
 const result=records.flatMap((record,index)=>{
  const scene=observationScene(id,records.slice(0,index+1),store.observationTargets[id])
  const feedback=record.reviewChoice?[record.label,record.values?.map((value,i)=>value==null?null:(item.observation.names[i]+' '+value+' '+item.observation.units[i])).filter(Boolean).join('；'),record.note].filter(Boolean).join('\n'):['abnormal','incomplete'].includes(record.status)?record.note:`查看${item.device}${record.label}的效果及下一步安排`
  return [{id:`observation-query:${id}:${round}:${index}`,role:'user',text:feedback,at:record.recordedAt?new Date(record.recordedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):record.label},
   {id:`observation-answer:${id}:${round}:${index}`,role:'assistant',kind:'scene',...scene,at:record.label,expanded:!closed&&index===records.length-1,paragraphs:[...(!index&&execution?[{label:'本轮实际措施',text:execution.values.measures},{label:'现场验收记录',text:execution.values.acceptance}]:[]),...scene.paragraphs]}]
 })
 if(closed)result.push({id:`observation-close-query:${id}:${round}`,role:'user',text:'确认本轮观察无新异常，闭环归档'},
  {id:`observation-close-answer:${id}:${round}`,role:'assistant',kind:'scene',expanded:true,title:'本轮已确认闭环',paragraphs:[{label:'结束依据',text:'本轮实际措施、现场验收与已覆盖的可比观察已关联保留，人工确认后结束本次跟进。'},{label:'后续记录',text:'原事件与设备健康来源继续可查。新情况应记录具体时间、工况和现象，不能将本轮结果泛化为所有工况均正常。'}]})
 return [...result,...messages.filter(message=>message.observationContext&&(message.observationRound==null||message.observationRound===round)&&(!message.text||!records.some(record=>record.note===message.text)))]
}
