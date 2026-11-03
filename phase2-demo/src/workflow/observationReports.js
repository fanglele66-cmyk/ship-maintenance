import {observationTaskFor} from './observationContext.js'
const copy=value=>JSON.parse(JSON.stringify(value))
export function observationIntervention(plan,channels,now){
 if(!plan?.triggerSignal||!Number.isFinite(Number(plan.triggerValue))||!['above','below'].includes(plan.triggerOperator))return null
 const channel=channels.find(c=>c.name===plan.triggerSignal||c.channelId===plan.triggerSignal)
 const start=Math.max(now-15*60000,Date.parse(plan.confirmedAt)||0)
 const points=[...new Map((channel?.trendData||[]).filter(p=>Number.isFinite(p.value)&&p.timestamp<=now&&p.timestamp>start).map(p=>[p.timestamp,p])).values()].sort((a,b)=>a.timestamp-b.timestamp).slice(-3)
 const match=p=>plan.triggerOperator==='above'?p.value>Number(plan.triggerValue):p.value<Number(plan.triggerValue)
 if(points.length!==3||!points.every(match))return null
 return {reason:`${channel.name}连续3个有效采样${plan.triggerOperator==='above'?'高于':'低于'} ${plan.triggerValue} ${channel.unit||''}`,channelId:channel.channelId,points:copy(points),at:new Date(now).toISOString()}
}
export function finishObservation(event,phase,now,{intervention}={}){
 const id='observation-report-'+phase.id
 if(event.reports.some(r=>r.id===id))return
 const task=observationTaskFor(event,phase),at=new Date(now).toISOString(),snapshot=copy({plan:phase.observationPlan||event.observationPlan||null,windowStart:phase.at,windowEnd:at,dueAt:phase.observationDueAt,observation:task?.observation||null,intervention:intervention||null})
 const windows=[...(snapshot.observation?.records||[]),...(snapshot.observation?.pending?[snapshot.observation.pending]:[])].filter(w=>Date.parse(w.windowEnd)>Date.parse(phase.at)&&Date.parse(w.windowStart)<now)
 const available=windows.some(w=>w.sampleCount>0),covered=windows.length&&windows.every(w=>w.covered)
 const summary=intervention?`触发提前介入：${intervention.reason}。请轮机长审阅实际证据并安排后续工作。`:!available?'本轮观察已到期，未取得有效采样；证据不足，不能判断恢复或修复成功。':!covered?'本轮观察已到期，存在缺测或覆盖不足；请结合可比工况核对，不能据此判定恢复。':'本轮观察已到期，采样覆盖已记录；是否恢复仍需结合可比工况、异常表现与已实施措施判断。'
 const report={id,eventId:event.id,eventNumber:event.number,title:event.title+' · 观察报告',kind:'观察报告',owner:'系统观察',at,summary,observationSnapshot:snapshot,markdown:`# ${event.title} · 观察报告\n\n## 本轮结论与边界\n\n${summary}\n\n## 汇报窗口\n\n${phase.at} — ${at}\n\n计划汇报时间：${phase.observationDueAt}\n\n## 观察依据\n\n${windows.map(w=>`${w.windowStart} — ${w.windowEnd}：有效采样 ${w.sampleCount||0} 条；${w.description||w.summary||'完整覆盖情况见保存的采样快照。'}`).join('\n\n')||'没有有效采样窗口。'}\n\n## 后续处理\n\n由轮机长判断继续观察、安排人员工作或确认结束；系统不自动认定修复。`}
 report.markdown+='\n\n## 可比工况与数据来源\n\n'+(snapshot.observation?.conditions?.reason||'未取得适用工况证据，不能认定效果已验证。')+'\n\n'+(snapshot.observation?.source||'来源未单列，以保存的采样快照为准。')+'\n\n## 信号采样记录\n\n'+(windows.flatMap(w=>(w.channels||[]).map(c=>`${c.name}：${c.value??'未取得'} ${c.unit||''}；有效采样 ${c.sampleCount||0} 条；最近采样 ${c.lastAt||'未取得'}；${c.covered?'窗口覆盖达到采样间隔要求':'覆盖不足'}`)).join('\n\n')||'没有信号采样记录。')
 event.reports.push(report);phase.observationReportId=id;phase.reportId=id;phase.observationWaiting=false;phase.observationReview=true;phase.observationCompletedAt=at;phase.intervention=intervention||null
 event.status='待决策';event.unread.captain=true
}
