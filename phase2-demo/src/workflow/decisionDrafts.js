const clone=value=>JSON.parse(JSON.stringify(value))
export function observationPlanDraft(event,now=Date.now()){
 const previous=event.observationPlan,interval=event.tracking?7*86400000:2*3600000
 return {triggerOperator:previous?.triggerOperator||'above',triggerSignal:previous?.triggerSignal||'',triggerValue:previous?.triggerValue??'',purpose:previous?.purpose||`核对「${event.title}」相关变化是否持续、恢复或复发`,signals:previous?.signals||event.brief?.facts?.map(f=>f.label).join('、')||'原事件相关测点',conditions:previous?.conditions||'使用可比负荷和运行状态；工况不一致单独说明',limits:previous?.limits||'只解释实际覆盖窗口；缺测不能认定恢复或正常',dueAt:new Date(now+interval).toLocaleString('sv-SE').slice(0,16).replace(' ','T'),trigger:previous?.trigger||'出现与原事件相关的新报警或经人工确认的持续恶化',version:(previous?.version||0)+1}
}
export function validateObservationPlan(plan,now=Date.now()){
 if(!plan||!(Date.parse(plan.dueAt)>now))throw Error('请选择未来的计划汇报时间。')
 if(plan.triggerSignal&&(plan.triggerValue==null||String(plan.triggerValue).trim()===''||!Number.isFinite(Number(plan.triggerValue))||!['above','below'].includes(plan.triggerOperator)))throw Error('请为提前介入信号填写有效数值阈值和触发关系。')
 return clone({...plan,dueAt:new Date(plan.dueAt).toISOString(),confirmedAt:new Date(now).toISOString()})
}
export function closureDraft(event){
 const reports=event.reports.filter(r=>!r.linkedSource&&r.kind!=='闭环报告')
 return {conclusion:event.closeReason||reports.at(-1)?.summary||event.brief?.conclusion||'',evidence:reports.length?reports.map(r=>`${r.title}（${r.at}）：${r.summary}`).join('\n'):event.brief?.discovery?.label+'；'+(event.brief?.boundary||'尚无执行报告，需核对结束依据'),process:event.decisions.filter(d=>d.action!=='shore').map(d=>`${d.at}：${d.reason}`).join('\n')||'尚无人员执行安排。',boundary:event.observationPlan?.limits||'仅针对本事件及已核实范围；未验证部分不认定恢复正常。'}
}
export function validateClosureDraft(draft){if(!draft||!['conclusion','evidence','process','boundary'].every(k=>draft[k]?.trim()))throw Error('请核对闭环结论、依据、处置过程和未验证边界。');return clone(draft)}
export function shoreSituationDraft(event){return {situation:event.brief?.conclusion||event.title,actions:event.decisions.filter(d=>d.action!=='shore').map(d=>d.reason).join('\n')||'尚未安排人员执行。',uncertainty:event.reports.at(-1)?.summary||event.brief?.boundary||'待现场核实。',support:event.phase==='closed'?'保留本次处置与闭环资料，供岸端知悉。':'按船端当前安排继续处理；本次记录供岸端知悉。'}}
