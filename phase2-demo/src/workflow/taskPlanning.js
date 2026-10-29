import {dispatchAction} from './lifecycleDecisions.js'
import {groupRepairSteps} from './repairStepGroups.js'
import {verifyTaskEdit} from './taskEdits.js'

export function taskPlanKey(event){
 const report=event.reports.at(-1),text=JSON.stringify([event.phase,event.phases.at(-1)?.id,event.currentTask,report?.id,report?.markdown])
 let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)
 return `${event.id}:${hash>>>0}:${dispatchAction(event)||'none'}`
}
export function ensurePlanDraft(event,seed){
 const action=dispatchAction(event)
 if(!action)return null
 const key=taskPlanKey(event)
 if(event.pendingPlan?.key===key&&event.pendingPlan.action===action)return event.pendingPlan
 const needsModel=(action==='investigate'&&event.phase!=='reminder')||action==='recheck'
 const savedScope=event.decisionDraft?.action===action?event.decisionDraft.reason?.trim():''
 const preset=action==='recheck'
 event.pendingPlan={key,action,version:0,status:needsModel?'pending':'ready',source:preset?'preset':needsModel?'':'existing',scope:needsModel&&!preset?'':savedScope||seed.scope,rationale:seed.rationale,steps:needsModel&&!preset?[]:seed.steps,procedureVersion:seed.procedureVersion,sourceReportId:event.reports.at(-1)?.id||null,usage:null,sources:[],error:''}
 // A saved choice from an earlier gate must not survive a changed decision branch.
 if(event.decisionDraft){event.decisionDraft.action='';event.decisionDraft.reason=''}
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
 return {scope,rationale,steps:['repair','maintenance'].includes(action)?groupRepairSteps(steps).map(({sourceIndices,...step})=>step):steps}
}
export function acceptTaskPlan(event,expected,result){
 const draft=event.pendingPlan
 if(!draft||taskPlanKey(event)!==expected.key||draft.key!==expected.key||draft.version!==expected.version||draft.action!==dispatchAction(event))throw Error('事件或待派任务已有变化，本次生成结果未覆盖当前任务。')
 const edit=expected.editText?verifyTaskEdit(expected.plan,expected.editText,result,draft.action):null
 const patch=edit?.plan||normalizeTaskPlan(result.plan,draft.action)
 if(edit)draft.editHistory=[...(draft.editHistory||[]),{at:new Date().toISOString(),text:expected.editText,before:JSON.parse(JSON.stringify(expected.plan)),after:JSON.parse(JSON.stringify(patch)),summary:edit.editSummary}]
 Object.assign(draft,patch,{status:'ready',source:edit?.source||'model',version:draft.version+1,error:'',preview:null,generatedAt:new Date().toISOString(),usage:result.usage,sources:result.sources||[]})
 return draft
}
export const planTabLabel=action=>({investigate:'待派发排查',repair:'待派发维修',maintenance:'待派发维保',recheck:'复查任务'}[action]||'待派任务')
