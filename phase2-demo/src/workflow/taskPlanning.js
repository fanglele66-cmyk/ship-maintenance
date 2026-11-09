import {carryForwardSteps} from './taskExecution.js'
import {dispatchAction} from './lifecycleDecisions.js'
import {groupRepairSteps} from './repairStepGroups.js'
import {verifyTaskEdit} from './taskEdits.js'
import {c4FollowupSteps} from './stepAssistScenarios.js'

export function taskPlanKey(event){
 const report=event.reports.at(-1),text=JSON.stringify([event.phase,event.phases.at(-1)?.id,event.currentTask,report?.id,report?.markdown])
 let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)
 return `${event.id}:${hash>>>0}:${dispatchAction(event)||'none'}`
}
export function ensurePlanDraft(event,seed){
 const action=dispatchAction(event)
 if(!action)return null
 const key=taskPlanKey(event)
 const prior=event.tasks?.find(task=>task.id===event.currentTask)
 const c4Followup=(event.sourceEventId||event.id)==='real-health-c4-baseline'&&event.phase==='decision'&&action==='investigate'&&event.tasks.length===1&&prior?.kind==='investigation'&&prior.status==='submitted'
 const cached=event.pendingPlan?.key===key&&event.pendingPlan.action===action
 // Upgrade only the untouched initial placeholder; preserve generated/edited plans.
 if(cached&&!(c4Followup&&event.pendingPlan.status==='pending'&&!event.pendingPlan.steps.length&&!event.pendingPlan.version&&!event.pendingPlan.source))return event.pendingPlan
 if(c4Followup)seed={...seed,steps:JSON.parse(JSON.stringify(c4FollowupSteps)),scope:'承接首轮四缸相对基线下移待核实事项，核对测温连接及独立校验，补查历史调整与燃烧资料。',rationale:'首轮月度相对变化已记录，独立测温校验及部分调整资料仍缺失，先确认测量链路与已查范围。'}
 const needsModel=!c4Followup&&((action==='investigate'&&event.phase!=='reminder')||action==='recheck'||(!!event.manualReport&&action==='repair'))
 const savedScope=event.decisionDraft?.action===action?event.decisionDraft.reason?.trim():''
 const preset=action==='recheck'||c4Followup
 event.pendingPlan={key,action,version:0,status:needsModel?'pending':'ready',source:preset?'preset':needsModel?'':'existing',scope:needsModel&&!preset?'':savedScope||seed.scope,rationale:seed.rationale,steps:needsModel&&!preset?[]:seed.steps,procedureVersion:seed.procedureVersion,sourceReportId:event.reports.at(-1)?.id||null,usage:null,sources:[],error:''}
 // A saved choice from an earlier gate must not survive a changed decision branch.
 if(event.decisionDraft&&event.decisionDraft.action!==action&&['investigate','repair','maintenance','recheck'].includes(event.decisionDraft.action)){event.decisionDraft.action='';event.decisionDraft.reason=''}
 return event.pendingPlan
}
export function normalizeTaskPlan(value,action){
 const text=(v,label,max=3000)=>{if(typeof v!=='string'||v.trim().length<2||v.length>max)throw Error(`任务${label}不完整，请重新生成。`);return v.trim()}
 const scope=text(value?.scope,'范围'),rationale=text(value?.rationale,'依据')
 const work=['repair','maintenance'].includes(action),max=work?12:4
 if(!Array.isArray(value?.steps)||value.steps.length<1||value.steps.length>max)throw Error(work?'维修操作明细需包含 1—12 项，合并后最多 4 个反馈步骤。':'排查任务需包含 1—4 个完整步骤。')
 const options=['investigate','recheck'].includes(action)?['发现异常','未见异常','无法确认']:['已完成','未完成','不适用']
 const normalizeStep=(step,child=false)=>{
  const grouped=!child&&['repair','maintenance'].includes(action)&&Array.isArray(step.substeps)&&step.substeps.length>0&&step.substeps.length<=12
  if(!Array.isArray(step.checks)||(!step.checks.length&&!grouped)||step.checks.length>6)throw Error('每个任务步骤都需要具体检查要求。')
  return {label:text(step.label,'步骤标题',120),guide:text(step.guide,'步骤说明',1800),checks:step.checks.map(v=>text(v,'检查要求',1200)),recordHint:text(step.recordHint,'回交要求',grouped?16000:1200),options:[...options],...(grouped?{substeps:step.substeps.map(s=>normalizeStep(s,true))}:{})}
 }
 const steps=value.steps.map(s=>normalizeStep(s))
 if(work&&steps.reduce((total,step)=>total+(step.substeps?.length||1),0)>12)throw Error('维修作业子项合计最多 12 项，请合并重复准备、隔离与复装要求后重新生成。')
 return {scope,rationale,steps:['repair','maintenance'].includes(action)?groupRepairSteps(steps).map(({sourceIndices,...step})=>step):steps}
}
export function acceptTaskPlan(event,expected,result){
 const draft=event.pendingPlan
 if(!draft||taskPlanKey(event)!==expected.key||draft.key!==expected.key||draft.version!==expected.version||draft.action!==dispatchAction(event))throw Error('事件或待派任务已有变化，本次生成结果未覆盖当前任务。')
 const edit=expected.editText?verifyTaskEdit(expected.plan,expected.editText,result,draft.action):null
 const patch=edit?.plan||normalizeTaskPlan(result.plan,draft.action)
 if(draft.action==='repair'){const missing=carryForwardSteps(event).filter(step=>!patch.steps.some(next=>next.label===step.label||next.substeps?.some(child=>child.label===step.label)));if(missing.length)throw Error('上轮未执行项目必须保留：'+missing.map(s=>s.label).join('、')+'。如需取消，应先由轮机长终止未执行部分。')}
 if(edit)draft.editHistory=[...(draft.editHistory||[]),{at:new Date().toISOString(),text:expected.editText,before:JSON.parse(JSON.stringify(expected.plan)),after:JSON.parse(JSON.stringify(patch)),summary:edit.editSummary}]
 Object.assign(draft,patch,{status:'ready',source:edit?.source||'model',version:draft.version+1,error:'',preview:null,generatedAt:new Date().toISOString(),usage:result.usage,sources:result.sources||[]})
 return draft
}
export const planTabLabel=action=>({investigate:'AI排查建议',repair:'AI维修建议',maintenance:'AI维保建议',recheck:'AI复查建议'}[action]||'AI任务建议')
