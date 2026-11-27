import {observationScene} from '@/mock/phase2Observation'

// An observation query belongs to the original event, not to its old decision form.
export function observationMessages(store,id,messages=[]){
 const item=store.cases[id]
 if(!item)return []
 const records=store.observationRecords[id]||[],round=store.observationRounds[id]||1
 const closed=store.eventStatus[id]==='closed',execution=store.executionRecords[id]?.at(-1)
 const result=records.flatMap((record,index)=>{
  if(record.status==='closed-confirmed')return []
  const scene=observationScene(id,records.slice(0,index+1),store.observationTargets[id])
  const receipt=!index&&execution?[{label:'本轮实际措施',text:execution.values.measures},{label:'现场验收记录',text:execution.values.acceptance}]:[]
  const paragraphs=[...receipt,...scene.paragraphs]
  if(record.auto)return [{id:`observation-auto:${id}:${round}:${record.id}`,role:'assistant',kind:'scene',...scene,paragraphs,title:'自动观察 · '+record.label,markdown:[...receipt.map(p=>`**${p.label}**：${p.text}`),record.note,scene.paragraphs[0].text].join('\n\n'),at:new Date(record.windowEnd).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),expanded:!closed&&index===records.length-1}]
  const feedback=record.reviewChoice?[record.label,record.values?.map((value,i)=>value==null?null:(item.observation.names[i]+' '+value+' '+item.observation.units[i])).filter(Boolean).join('；'),record.note].filter(Boolean).join('\n'):['abnormal','incomplete'].includes(record.status)?record.note:`查看${item.device}${record.label}的效果及下一步安排`
  return [{id:`observation-query:${id}:${round}:${index}`,role:'user',text:feedback,at:record.recordedAt?new Date(record.recordedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):record.label},
   {id:`observation-answer:${id}:${round}:${index}`,role:'assistant',kind:'scene',...scene,at:record.label,expanded:!closed&&index===records.length-1,paragraphs}]
 })
 if(closed){
  const closure=records.findLast(record=>record.status==='closed-confirmed')
  if(closure)result.push({id:`observation-close-query:${id}:${round}`,role:'user',text:closure.note,actor:closure.actor,at:closure.recordedAt})
  result.push({id:`observation-close-answer:${id}:${round}`,role:'assistant',kind:'scene',expanded:true,title:'本轮已确认闭环',paragraphs:[{label:'结束依据',text:closure?.note||'本轮已经归档，可回查原事件处置记录。'}]})
 }
 return [...result,...messages.filter(message=>message.observationContext&&(message.observationRound==null||message.observationRound===round)&&(!message.text||!records.some(record=>record.note===message.text)))]
}
