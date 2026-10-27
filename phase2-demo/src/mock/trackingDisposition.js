import {baselineMaintenanceWorkFor,baselineMaintenanceBriefFor,baselineMaintenanceStageMarkdown,baselineTaskSets} from './baselineTaskContent.js'
import baselineHistory from './baselineHistory.json' with {type:'json'}

export const c1MaintenanceId='real-maintenance-c1-baseline'
export function buildC1Maintenance(source){
  const copy=value=>JSON.parse(JSON.stringify(value))
  const work=baselineMaintenanceWorkFor(1),brief=baselineMaintenanceBriefFor(1)
  const title='一缸测温与燃烧平衡专项检查'
  const stage=(id,label,kind,tasks=[])=>{const entry={id,label,kind,title:kind==='work'?work.title:label,summary:kind==='intro'?brief.objective:kind==='observe'?brief.observation:brief.check,tasks,evidence:copy(source.stages[0].evidence),action:kind==='check'?'提交本轮反馈':kind==='work'?'提交执行与验收':'查看下一阶段'};return {...entry,markdown:baselineMaintenanceStageMarkdown(1,entry,source.report.conclusion)}}
  return {...copy(source),id:c1MaintenanceId,initialTitle:title,eventTitle:title,eventId:c1MaintenanceId,parentIssueId:source.id,latent:true,trackingOnly:false,realType:'maintenance',workflowKind:'maintenance',handoffTask:true,baselineCylinder:1,
    taskScope:work.title+'：核实月度变化与调整、校验测温链路、对照六缸燃烧及排气资料；按检查依据实施获批措施，提交实际用料、复装签认和同工况复测，交接后续观察与未完成项。',
    stages:[stage('intro','任务概览','intro'),stage('check','作业条件核对','check',JSON.parse(JSON.stringify(baselineTaskSets.maintenance).replaceAll('四缸','一缸'))),stage('service','专项检查与维护','work',work.tasks),stage('observe','效果观察','observe'),stage('closed','任务归档','closed')],workDetails:work,packages:{},plan:[],
    pageContent:{...copy(source.pageContent),overview:baselineMaintenanceStageMarkdown(1,{kind:'intro'},source.report.conclusion)},
    report:{...copy(source.report),human:brief.deliverables},
    observation:{...copy(source.observation),names:['一缸排温相对其余五缸均值偏差'],units:['°C'],before:[Number(baselineHistory.months.at(-1).cylinders[0].deltaPeers.toFixed(2))],samples:[],abnormal:[],days:2,basis:brief.observation},
  }
}

export function trackingDispositionSummary(record){
  if(!record)return ''
  if(record.status==='closed')return record.choice==='maintenance'?'维保安排已确认，本次异动事件已闭环。关联维保任务独立执行，检查、验收与结果保留关联。':'变化解释已由轮机长确认，本次异动事件已闭环，设备继续常规健康监测。'
  if(record.status==='observing')return `专项观察中，计划于 ${record.plan.deadline.replace('T',' ')} 复核；关注 ${record.plan.metrics}。到期后由人员提交结果并确认下一步。`
  if(record.status==='review')return record.observationResult?'观察结果已提交，待轮机长确认变化解释、维保安排或继续观察。':record.priorProcessId?'首轮核实已回交，待轮机长再次决策：确认变化解释、安排专项维保或补证并继续观察。':'核实任务已完成，待轮机长确认变化解释、维保安排或继续观察。'
  if(record.status==='recommendation')return '维保建议已形成，待轮机长确认责任人、实施范围与计划窗口。'
  return '核实任务已完成，待轮机长确认事件处置结论。'
}

export function buildObservationTask(source,id){
  const item=JSON.parse(JSON.stringify(source))
  const title=source.initialTitle.replace(/核实|跟踪/g,'')+'专项观察'
  return {...item,id,initialTitle:title,eventTitle:title,eventId:id,parentIssueId:source.id,latent:true,trackingOnly:false,isTrackingContainer:false,workflowKind:'tracking-observation',cardType:'异动跟踪 · 专项观察任务',taskScope:'按轮机长确认的观察期限、关注指标和判断条件，补充本轮观察资料。',
    stages:[{id:'tracking-observation',label:'增量观察',kind:'tracking-observation',title,summary:'保留既有核实与观察资料，仅补充本轮新增记录。',tasks:[],evidence:[],markdown:'### 专项观察任务\n\n按本轮观察计划补充新的工况、读数与现场依据；已提交记录继续保留。'}, {id:'observe',label:'已提交',kind:'observe',tasks:[]},{id:'closed',label:'任务归档',kind:'closed',tasks:[]}],
    observation:{...item.observation,samples:[]},
  }
}
