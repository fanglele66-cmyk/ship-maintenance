import additionalScenarios from './additionalScenarios.json'
// Local prototype branch configuration; not a real diagnostic model.
export const checkFeedbackRules={
 'fault:investigate':{options:[['发现异常','未见异常','无法确认'],['发现异常','未见异常','无法确认']],expected:['发现异常','未见异常'],pending:'本轮排查反馈已保存。两个部位均异常或尚未明确时，不能直接沿预设滤器清洗方案推进；请补充实际发现并继续排查。'},
 'drift:investigate':{options:[['发现异常','未见异常','无法确认'],['发现异常','未见异常','无法确认']],expected:['发现异常','未见异常'],pending:'排查反馈已保存，当前证据尚不足以选择预设喷油器处置方案，请继续补充实际发现。'},
 'drift:check':{options:[['现场与系统一致','读数不一致','无法确认'],['异响可复现','未见异常','无法确认']],expected:['现场与系统一致','异响可复现'],pending:'现场检查反馈已保存，当前尚不足以确立本示例的异常，继续核实；未见异常或无法确认同样保留为有效反馈。'},
 'maintenance:check':{options:[['发现轻微偏磨','未见异常','无法确认'],['间隙接近上限，备件可用','暂不具备条件','无法确认']],expected:['发现轻微偏磨','间隙接近上限，备件可用'],pending:'检查反馈已保存，当前尚不足以安排预设提前换件。保留实际结果，继续跟踪或补充作业条件。'}
}
for(const item of additionalScenarios)checkFeedbackRules[item.id+':investigate']={options:item.stages[1].tasks.map(()=>['发现异常','未见异常','无法确认']),pending:'现场反馈已保存。'}
export function checkChoices(eventId,stageId,index){return checkFeedbackRules[`${eventId}:${stageId}`]?.options[index]||['发现异常','未见异常','无法确认']}
export function assessCheckFeedback(eventId,stage,feedback){
 if(!Array.isArray(feedback)||feedback.length!==stage.tasks?.length||feedback.some((entry,i)=>entry.label!==stage.tasks[i].label||!checkChoices(eventId,stage.id,i).includes(entry.result)))return {valid:false,advance:false,message:'请完整填写各项实际检查结果后提交。'}
 const rule=checkFeedbackRules[`${eventId}:${stage.id}`]
 const advance=Boolean(rule && (!rule.expected || rule.expected.every((value,i)=>feedback[i].result===value)))
 return {valid:true,advance,message:advance?'本轮反馈已保存，按当前已支持的方案接续下一阶段。':rule?.pending||'本轮反馈已保存，尚无可用的下一阶段规则，请继续研判。'}
}
