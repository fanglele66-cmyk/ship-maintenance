import {compactRepair} from './compactRepair.js'
import {followupRepair} from './followupRounds.js'
import fixtures from './fourStoryFixtures.json' with { type: 'json' }
import {realWorkflowCases,assessRealCase} from './realCaseAdapter.js'
import {healthTrackingSources,trackingContainerCases} from './healthTrackingSources.js'
import {isMaintenanceWorkflow,parentIssueId,issueTypeNames,maintenanceRecommendations,observationParents} from './issueRelationships.js'
import {closedEventReference} from './closedEventReferences.js'
import {trackingProcessReference} from './trackingProcessReferences.js'
import {trackingDispositionSummary,buildObservationTask} from './trackingDisposition.js'
const allCases=[...fixtures.cases.map(item=>({...item,latent:true,legacyScenario:true})),...realWorkflowCases,...trackingContainerCases].map(item=>
  isMaintenanceWorkflow(item)?{...item,cardType:'异动跟踪',workflowKind:'maintenance',parentIssueId:parentIssueId(item.id)}:item)

for(const [id,parent] of Object.entries(observationParents)){const source=allCases.find(item=>item.id===parent);if(source)allCases.push(buildObservationTask(source,id))}

import {healthStoryMarkdown,storyTimeline} from './storyRecords.js'

// Fixtures describe product scenarios, not a diagnostic or maintenance rule engine.
export const workflowCases = Object.fromEntries(allCases.map(item => [item.id, item]))
export const workflowIds = Object.keys(workflowCases)
export const healthTracks = healthTrackingSources
export const historicalDecisions = fixtures.history.map(item=>item.type==='维保建议'
  ?{...item,type:'异动跟踪',recordKind:'maintenance-decision',parentIssueId:'bearing-health'}:item)
export const isWorkflow = id => Boolean(workflowCases[id])
const types = issueTypeNames
export const workflowIssues = allCases.filter(item=>parentIssueId(item.id)===item.id).map(item => ({
  id: item.id, deviceId: item.deviceId, device: item.device.split(' · ')[0], type: item.cardType,
  rank: types.indexOf(item.cardType), title: item.initialTitle, summary: item.report.conclusion,latent:Boolean(item.latent),
  isTrackingContainer:Boolean(item.isTrackingContainer), sourceCaseId:item.sourceCaseId,
  sourceEventId:item.sourceEventId, relatedIssueIds:item.relatedIssueIds||[],
  action: '查看详情', evidence: item.stages[0].evidence, limit: item.decisionLimit||(item.cardType==='报警事件'?'报警表明测点越限，尚不能确定唯一根因；现场读数与采集状态仍需核对。':item.cardType==='预警事件'?'综合预警需要现场印证，尚不能直接确定部件故障或维修范围。':item.trackingOnly?'长期偏离不等于当前故障或剩余寿命下降结论；本次仅补充现场信息，不要求拆机。':'提前评估不等于批准换件；原周期计划保持有效，实际处理范围待确认。'),
}))

export const workflowDossiers = Object.fromEntries(allCases.map(item => [item.id, {
  conclusion: item.report.conclusion, recommendation: item.report.human, discovery:item.discovery, evidenceSources:item.evidenceSources||[],
  snapshots: (item.snapshots||[]).map(([name,value,reference,meaning]) => ({name,value,reference,meaning,source:item.source+' · 发生时记录'})),
  series: item.series||[],
  steps: [
    {title:'已有事实',fact:item.report.basis,inference:item.report.conclusion},
    {title:'当前判断边界',fact:'尚未提交的现场结果不属于已确认事实。',inference:item.report.human},
    ...(item.trackingOnly?[{title:'长期跟踪与本次核实',fact:item.realCaseId?'月度配对采样、历史调整与本轮基线核实保留在同一记录。':'首次、重复、持续三个节点保留在同一健康记录。',inference:'核实任务结束后原健康跟踪继续，不直接转入拆机维修。'}]:[]),
  ],
  comparisons: item.cause?.rows.map(row=>({direction:row.name,support:row.cause+'；'+row.effect,missing:row.check+'尚需实际反馈'})) || [
    {direction:item.trackingOnly?'工况或测量因素':'提前处理的必要性',support:item.report.basis,missing:item.report.human},
    {direction:item.trackingOnly?'设备健康变化':'实际作业条件',support:'现有资料尚不足以直接确定部件处置。',missing:item.trackingOnly?'现场读数、工况与近期维护记录':'实际检查、备件与窗口条件'},
  ],
  plan: item.plan||[],
}]))
for(const history of historicalDecisions)workflowDossiers[history.id]={conclusion:history.reason,recommendation:history.outcome,snapshots:[],series:[],steps:history.facts.map(fact=>({title:'已留存记录',fact,inference:history.outcome})),comparisons:[],plan:[]}

// Text is scenario content; submitted evidence is appended rather than replaced by a scripted finding.
export function assessmentMarkdown(assessment) {
  if(!assessment)return ''
  const records=(assessment.records||[]).map(record=>`- **${record.label}：${record.result}**${record.note?'。'+record.note:'。尚无补充读数或现象，不能扩大结论。'}`).join('\n')
  return `### ${assessment.round?'第'+assessment.round+'轮已提交判断':'本轮判断'}\n\n${assessment.message}\n\n### 已提交的现场信息\n\n${records}`
}
function executionSummary(execution){
  if(!execution)return ''
  const values=execution.values
  return values.completion!=='completed'?'本轮处置尚未完成，继续落实剩余工作。':values.verification==='unresolved'?'作业已完成，原异常仍存在，需沿原任务复查。':values.verification!=='resolved'?'执行记录已保存，验收结果尚待确认。':values.comparable!=='available'?'现场验收已提交，尚缺可比记录，需补齐处理后观察资料。':'现场验收已提交，进入修复观察，持续效果待确认。'
}
export function storyDossier(store,id){
  const item=workflowCases[id],base=workflowDossiers[id]||{},content=item?.pageContent||{}
  const reference=closedEventReference(id)
  if(reference){
    const overviewMarkdown=`### 闭环结果\n\n${reference.result}\n\n### 本次处置范围\n\n${reference.scope}\n\n核实采集时间与负荷工况、修正比较口径、完成现场反馈和人工签认。未拆检或更换部件。`
    return {...base,reference,timeline:storyTimeline(store,id),overviewMarkdown,currentMarkdown:overviewMarkdown,
      analysisMarkdown:`### 起始问题\n\n原排温比较存在偏离，但工况与采集时刻尚未对齐。\n\n### 现场核实后的判断\n\n${base.conclusion}\n\n### 处置结束依据\n\n本轮核实要求完成，原判断的可比性问题已有说明，人工确认本次预警不成立。该结论不要求先做维修，也不代表整机全面健康。`,
      evidenceMarkdown:`### 已留存记录\n\n${base.steps?.map(step=>'- '+step.fact).join('\n')}\n\n### 核实与签认材料\n\n${reference.acceptance.basis}\n\n${reference.closure.followup}`,hasUpdate:false}
  }
  const assessment=store.checkAssessments?.[id],decision=store.completedTasks?.[id]
  const execution=store.executionRecords?.[id]?.at(-1)
  const observation=store.observationRecords?.[id]?.length?store.getObservationResult?.(id):null
  const executionState=store.eventStatus?.[id]==='closed'?'本轮已人工确认结束，执行与观察记录已归档。':observation?.title||executionSummary(execution)
  let update=assessmentMarkdown(assessment)
  if(execution)update+=`\n\n### 实际措施与验证\n\n${[...new Set([execution.values.measures,execution.values.acceptance].filter(Boolean))].join('\n\n')}\n\n${executionState}`
  if(store.ignoredSuggestions?.[id]&&!store.todoCreated?.[id])update+=`\n\n### 本次决定\n\n${store.ignoredSuggestions[id].reason}。原来源记录与周期计划继续保留。`
  if(decision)update+=`\n\n### 已记录的决定\n\n${decision.reason}\n\n${item?.trackingOnly?'本次核实任务结束，原健康记录继续；不代表故障或寿命结论。':isMaintenanceWorkflow(item)?'原周期项目保留，已做与未做的范围分别登记。':'来源、现场反馈和本次确认保留。'}`
  const overview=content.overview||`### 当前结论\n\n${base.conclusion||''}\n\n### 建议\n\n${base.recommendation||''}`
  const analysis=content.analysis||base.steps?.map(step=>`### ${step.title}\n\n${step.fact}\n\n${step.inference}`).join('\n\n')||''
  let series=base.series
  if(id==='aux-health'){
    const later=store.healthUpdates?.['aux2-health']?.laterNodes?.filter(node=>node.readings)||[]
    series=base.series.map((entry,index)=>({...entry,labels:[...entry.labels,...later.map(node=>node.at)],values:[...entry.values,...later.map(node=>index===0?node.readings.temperature:node.readings.others)]}))
  }
  if(id==='aux-health'&&(store.healthUpdates?.['aux2-health']||assessment))update=healthStoryMarkdown(store,id)
  const recommendations=maintenanceRecommendations(store,id)
  if(item?.isTrackingContainer){
    const updates=recommendations.map(child=>{
      const dossier=storyDossier(store,child.id)
      return `### 观测形成的建议：${child.initialTitle}\n\n${dossier.currentMarkdown}`
    })
    if(updates.length)update=updates.join('\n\n')
  }
  // The overview summarizes state; analysis interprets evidence; the timeline owns raw receipts.
  const summaries=item?.isTrackingContainer?recommendations.map(child=>storyDossier(store,child.id).overviewSummary).filter(Boolean):[]
  const disposition=store.trackingDispositions?.[id]
  if(disposition)update=`### 当前处置结论\n\n${trackingDispositionSummary(disposition)}\n\n${disposition.reason||disposition.recommendation?.reason||''}`+(disposition.plan?`\n\n### 专项观察安排\n\n负责人：${disposition.plan.owner}\n\n关注指标：${disposition.plan.metrics}\n\n复核期限：${disposition.plan.deadline.replace('T',' ')}\n\n下次判断条件：${disposition.plan.criteria}`:'')+(disposition.observationResult?`\n\n### 最新观察反馈\n\n${disposition.observationResult.findings}`:'')
  const prior=trackingProcessReference(id)
  const priorFindings=prior?`### 首轮核实回交 · ${prior.at}\n\n${prior.feedback.map(entry=>`- **${entry.label}：${entry.result}**。${entry.note}`).join('\n\n')}`:''
  if(prior&&disposition?.status==='review'&&!disposition.observationResult)update+='\n\n'+priorFindings
  const overviewSummary=trackingDispositionSummary(disposition)||summaries.join('；')||(store.eventStatus?.[id]==='closed'?'本轮已确认结束，处置结果与签认记录已归档。':execution?observation?.title||executionSummary(execution):decision?'本轮核实已结束，后续安排已记录。':assessment?'现场反馈已提交，最新研判与后续安排已更新。':store.ignoredSuggestions?.[id]?'本次建议已登记决定，原健康跟踪继续保留。':'')
  const judgement=assessment?.message?`### 现场反馈后的研判\n\n${assessment.message}`:priorFindings
  const childAnalysis=item?.isTrackingContainer?recommendations.map(child=>{const childAssessment=store.checkAssessments?.[child.id];return childAssessment?`### ${child.initialTitle}\n\n${childAssessment.message}`:''}).filter(Boolean).join('\n\n'):''
  return {...base,series,overviewSummary,maintenanceRecommendations:recommendations,timeline:storyTimeline(store,id),overviewMarkdown:item?.realCaseId?(overviewSummary?`### 当前处置状态\n\n${overviewSummary}`:overview):update?update+'\n\n### 起始依据\n\n'+(item?.report?.basis||base.conclusion):overview,analysisMarkdown:[judgement,childAnalysis,analysis].filter(Boolean).join('\n\n'),evidenceMarkdown:content.evidence||'来源资料及实际反馈按记录保留。',hasUpdate:Boolean(update),currentMarkdown:update||overview}
}
export function stageReport(store,id,stage){
  const item=store.cases?.[id]||workflowCases[id]
  const index=item.stages.findIndex(entry=>entry.id===stage.id)
  const content=stage.markdown||`### 本阶段判断

${stage.summary}

### 依据

${stage.evidence?.join('；')||item?.report?.basis||''}

### 下一步

${stage.judgement||item?.report?.human||''}`
  const history=(store.stageHistory?.[id]||[]).filter(entry=>item.stages.findIndex(current=>current.id===entry.stageId)>=0&&item.stages.findIndex(current=>current.id===entry.stageId)<=index)
  const assessment=history.at(-1)||(store.checkAssessments?.[id]?.stageId===stage.id?store.checkAssessments[id]:null)
  const finding=assessment?assessmentMarkdown(assessment):''
  const scope=stage.kind==='work'?`### 本轮处置范围与验证目标

${stage.title}。范围来自已提交的检查发现；未见异常与尚未确认的项目不自动纳入维修。

${(stage.workDetails?.acceptance||item.workDetails?.acceptance||[]).map(text=>'- '+text).join('\n')}

作业完成、现场验收、后续效果是三份记录。验收仍异常时接续原事件；缺可比数据时先补记录。`:''
  return [finding,content,scope].filter(Boolean).join('\n\n')
}

export function choicesFor(stage,index) { return stage.tasks[index]?.options || ['发现异常','未见异常','无法确认'] }
export function assessWorkflow(id,stage,feedback) {
  const invalid = !Array.isArray(feedback) || feedback.length !== stage.tasks.length || feedback.some((entry,i)=>entry.label!==stage.tasks[i].label || !choicesFor(stage,i).includes(entry.result))
  if(invalid)return {valid:false,advance:false,message:'请完整记录本轮各项目的实际结果。'}
  const values=feedback.map(entry=>entry.result)
  const common={valid:true,records:feedback.map(entry=>({...entry,attachments:[...(entry.attachments||[])]}))}
  if(workflowCases[id]?.realCaseId)return assessRealCase(workflowCases[id],{...stage,id:stage.baseStageId||stage.id},feedback)
  if((stage.baseStageId||stage.id)==='investigate') {
    const packages=stage.tasks.filter((_,i)=>values[i]==='发现异常').map(task=>task.package)
    const unknown=stage.tasks.filter((_,i)=>values[i]==='无法确认').map(task=>task.label)
    const meanings=id==='fault'?[
      ['滤器异常支持供冷通路受限，与温升和流量下降方向相符；尚不能仅凭附着物确定成分或全部原因。','本轮滤器未见异常，降低这一候选方向的优先级；不能据此排除全部供冷问题。','滤器方向尚缺实际检查，保留为未确认，不能填成正常。'],
      ['调节动作异常支持调节环节影响冷却能力；需保留阀型、工况与适用检查记录。','本轮未见温控阀异常，当前不纳入该项维修；仍以实际覆盖的动作范围解释。','调节方向未确认，现有滤器发现不能代替它。'],
    ]:[
      ['过滤段异常支持局部压损增加，需要对应处理；上游压力变化仍要单独解释。','本轮过滤段未见异常，不能直接开出滤芯更换；继续核对供给与其他通路。','过滤段资料不足，压差只是派生量，尚不能指定损坏部件。'],
      ['上游供油或调节异常支持供给侧影响；具体处置依实际发现，不能由压力直接指定泵故障。','本轮上游方向未见异常，不自动证明整个供油系统正常。','上游方向仍有检查限制，不能由过滤段异常代填结论。'],
    ]
    const explanation=values.map((value,i)=>`- **${stage.tasks[i].label}**：${meanings[i][value==='发现异常'?0:value==='未见异常'?1:2]}`).join('\n')
    return {...common,advance:packages.length>0,packages,unknown,
      title:packages.length?'按实际发现确定处置范围':'本轮尚未定位处置对象',
      message:`${packages.length?`已保存${packages.length}项异常发现，将生成对应处置与验收。`:'本轮反馈已保存。未见异常或无法确认都是有效结果，不要求改选异常。'}\n\n${explanation}\n\n${packages.length?'下一步按已支持的范围处置，未确认方向继续留存；验收仍异常时沿原事件重新研判。':'当前尚未定位处置对象。请记录新线索或补充受限项目，不把尚缺的原因解释写成已修复。'}`,
      actions:packages.length?[]:['retry','supplement']}
  }
  if(id==='main-warning') {
    const confirmed=values[0]==='现场与系统一致' && values[1]==='工况可比，偏离仍存在'
    return {...common,advance:confirmed,title:confirmed?'现场反馈支持当前预警':'预警依据仍需核对',
      message:confirmed?'现场反馈支持当前供油变化，已提交的工况背景仍不足以解释。确认的是供油状态变化，不是滤器堵塞或轴承损伤；沿原预警接续过滤段与上游供油原因排查。压差共享原始压力测量，不重复计为独立证据。':values[1]==='工况变化可以解释'?'已保存工况解释，需核对它是否足以说明发生窗口。当前恢复不代表此前误报；可补充明确依据后确认本次预警不成立并留档，也可继续核实。':'读数不一致或资料不足不能自动证明预警不成立。请核对同刻测点、映射与仪表来源；已取得的材料先保存，缺项不写成设备正常。',
      actions:confirmed?[]:['retry','end-warning']}
  }
  if(id==='aux-health') {
    const complete=values[0]!=='无法确认' && values[1]!=='无法确认'
    const interpretation=values[0]==='现场与系统一致'?'本次反馈支持现场显示与平台对应，但若同源，不能视为感温元件已校准。背景仅按本轮提交范围留存，备注原文不自动转成已核实因果；没有具体部件检验，不将排温偏移写成损坏。':values[0]==='读数不一致'?'现场与平台存在差异，原趋势可信度需要先核对测点、时间与测量来源；不能继续把原+9°C作为已证实衰减。':'现场读数仍有缺项，现有证据不能确认或排除局部状态变化。'
    return {...common,advance:false,title:'现场信息已纳入原健康记录',message:interpretation+(values[1]==='条件受限，已记录限制'?' 运行背景仍有受限项，后续只能作条件性比较；缺失背景不写成已排除。':values[1]==='无法确认'?' 运行背景尚不清楚，保留解释缺口。':'')+(complete?'本次核实可按实际完成范围结束，原健康记录继续比较可比负荷下的3号缸排温。没有新需求时不重复派单，也不自动安排拆机或换件。':'已取得的信息与限制均保存，可继续补充，或说明限制后结束本次人工核实；不把无法确认写成正常。'),actions:['retry','finish-tracking']}
  }
  const supported=values[0]==='有提前处理依据',ready=values[1]==='条件具备'
  return {...common,advance:supported&&ready,title:supported?(ready?'提前依据与作业条件已记录':'提前处理待安排'):'本次提前必要性尚未确认',
    message:supported&&ready?'依据与条件已记录，接续已确认范围的保养或换件；原计划保留并关联实际执行。':values[0]==='暂无提前处理必要'?'本轮未取得提前处理必要性，可记录依据后结束评估。原周期计划保持有效。':supported?'已记录提前处理依据，但条件尚未满足。保留待安排，补足窗口或备件等条件后继续，不认定作业完成。':'评估结果已保存，尚未确认提前必要性。可继续补充资料；本次决定不取消原周期计划。',
    actions:supported&&ready?[]:['retry','end-maintenance']}
}

export function composeRepair(caseData,keys,round=1) {
  const packages=keys.map(key=>caseData.packages[key]).filter(Boolean)
  const title=packages.map(item=>item.title).join('及')
  const compact=caseData.realCaseId?compactRepair(caseData,keys):null
  const tasks=compact?.tasks||packages.flatMap(item=>item.tasks)
  const detail=compact?.workDetails||{preparation:packages.flatMap(item=>item.preparation),parts:packages.flatMap(item=>item.parts),acceptance:packages.flatMap(item=>item.acceptance)}
  // Older workflows keep their own acceptance fallback; real tasks carry methods
  // and named checkpoints through every selected package combination.
  if(!compact&&packages.every(item=>item.acceptanceRows?.length))detail.acceptanceRows=packages.flatMap(item=>item.acceptanceRows.map(row=>({...row,name:packages.length>1?item.title+' · '+row.name:row.name})))
  const repair={title,tasks,evidence:packages.map(item=>'已确认处置范围：'+item.title),workDetails:detail,
    ...(caseData.realCaseId?{markdown:`### 执行目标\n\n${title}。按本轮检查发现及获批范围实施，分别登记实际措施与用料。\n\n### 作业安排\n\n${tasks.map(task=>'- **'+task.label+'**：'+task.guide).join('\n')}\n\n### 提交成果\n\n提交隔离与复装维修作业单、实际领用及旧新件记录、现场测试和未完成项目。`}:{}),
  }
  return round>1?followupRepair(caseData,{...repair,packageKeys:keys},round):repair
}

export function workflowReply(store,id,text) {
  const item=store.cases[id],stage=item.stages[store.activeStage[id]],result=store.checkAssessments[id]
  if(item.realCaseId)return (result?assessmentMarkdown(result)+'\n\n':'')+stageReport(store,id,stage)
  if(/原计划|周期|取消/.test(text)&&['maintenance','aux-maintenance'].includes(id))return '### 原计划与本次建议\n\n本次只决定是否提前开展相关项目，不取消原周期计划。实际执行后按部位与完成范围登记，未做的项目继续保留，不自动重置整个周期。'
  if(result&&/核实|结束|后续|跟踪|依据|结果|为什么|发现|下一步/.test(text))return assessmentMarkdown(result)
  if(/核实|结束|后续|跟踪/.test(text)&&id==='aux-health')return '### 本次核实与长期变化\n\n核实用于补齐测点、时间、实际读数与运行背景，不要求先确认某个部件损坏。完成后可结束本次待办，原健康链继续。\n\n### 后续判断\n\n同源显示一致不等于校准；偏移稳定也不等于恢复。后续发展结合实际反馈、相关计划与窗口评估，没有新需求时不重复派单。'
  if(stage.kind==='work')return `当前处理范围：${stage.title}。请分别记录各项目实际措施，再在执行记录中区分作业完成与原异常是否解决；若仍存在，沿原事件继续排查。`
  return stageReport(store,id,stage)
}

export function deviceStoryAssessment(store,deviceId){
  const current=allCases.filter(item=>item.realCaseId&&item.deviceId===deviceId&&parentIssueId(item.id)===item.id)
  if(current.length){
    const context={cases:store.cases||workflowCases,unlockedRecommendations:store.unlockedRecommendations,
      todoCreated:store.todoCreated,ignoredSuggestions:store.ignoredSuggestions,completedTasks:store.completedTasks,
      executionRecords:store.executionRecords,eventStatus:store.eventStatus,checkAssessments:store.checkAssessments}
    const active=current.filter(item=>item.isTrackingContainer?maintenanceRecommendations(context,item.id).some(child=>['待决策','已派发'].includes(child.state)):store.eventStatus?.[item.id]!=='closed'&&!store.ignoredSuggestions?.[item.id])
    const details=current.map(item=>{
      const child=item.isTrackingContainer?maintenanceRecommendations(context,item.id).at(-1):null
      const id=child?.id||item.id,execution=store.executionRecords?.[id]?.at(-1)
      const actual=execution?`实际措施：${execution.values.measures}；验收记录：${execution.values.acceptance}；持续效果按可比观测另行判断。`:''
      return item.initialTitle+'：'+(actual||store.completedTasks?.[id]?.reason||store.ignoredSuggestions?.[id]?.reason||store.checkAssessments?.[id]?.message||item.report.conclusion)
    })
    return {conclusion:active.length?'当前展示 二缸报警、控制空气预警、一缸长期基线抬升及四缸相对基线下移，维保建议作为跟踪内的阶段性结果，按发生窗口与本轮反馈分别判断。':'本轮事项均已有决定或闭环，来源资料与处理记录保留。',basis:details.join('\n\n'),next:'优先核对报警与预警的现场依据；长期基线先核实工况与测温，维保建议分别评估必要性与条件。四缸专项检查作为原健康跟踪的阶段结果。'}
  }

  if(deviceId==='main-engine-1'){
    const cooling=store.completedTasks?.fault?'冷却报警已有结束决定，依据仍可回查。':store.isTaskHandled('fault')?'冷却处置已提交，仍需验证后续效果。':'冷却温升与流量下降共同支持优先核实冷却能力。'
    const warning=store.completedTasks?.['main-warning']?'润滑预警已有本次结束决定，依据保留。':store.todoCreated['main-warning']?'润滑供油预警已派发，查看核实结果及当前原因排查。':'润滑供油压力下降伴过滤段压损增加，需及时核实当前供油变化。'
    return {conclusion:`主机的当前运行问题应与长期健康线索分开理解。${cooling}${warning}目前没有证据把两项变化归为共同根因；原3号缸排温仅保留为健康线索。`,basis:'冷却资料记录淡水出口92.4°C与海水支路68.2 m³/h，是跨回路关联；润滑资料记录滤后0.31→0.24 MPa、上游0.34→0.31 MPa，压差0.03→0.07 MPa由同刻压力计算，不能重复视为独立证明。各记录按自身发生时间与已提交现场反馈解读；温度、趋势或作业完成都不能直接证明具体部件损坏或持续恢复。',next:store.todoCreated.fault?'查看原冷却任务的实际发现与验证，同时跟进润滑预警的现场核实；已有事项不重复派发。轴承提前评估与主机3号缸健康记录分别保留。':'先了解冷却报警的当前影响及排查范围，并安排润滑预警的及时核实；两项都需要按实际现场情况决定处置，不能等一种问题完成后才了解另一种。'}
  }
  if(['aux-system','aux-engine-1','aux-engine-2','aux-engine-3'].includes(deviceId))return {conclusion:'本设备暂无本轮待处理事项。',basis:'可查看设备测点、运行资料与既有处理记录。',next:'按实际设备资料和原计划查看运行状态。'}
  if(deviceId==='aux-system')return {conclusion:'辅机侧的主要变化集中在2号机，现有记录未显示为三台机组的共同问题。1、2号运行，3号备用；运行评价与备用可用性不能共用一段结论。',basis:'1号已覆盖的运行片段没有持续扩大变化；2号3号缸在负荷65%—67%、约750 rpm下从404升至409°C，其他缸约399—400°C。3号最近只有约30%负荷、30分钟试运行记录，不能代表更高负荷或更长运行能力。',next:'先查看2号机的长期变化及当前核实进展，再按各机资料了解情况。1号维持原记录，3号按备用分工核对试运行资料。'}
  if(deviceId==='aux-engine-2'){
    const state=store.healthUpdates?.['aux2-health'],later=state?.laterNodes?.at(-1),assessment=store.checkAssessments?.['aux-health']
    const execution=store.executionRecords?.['aux-maintenance']?.at(-1),observation=store.observationRecords?.['aux-maintenance']?.at(-1)
    const conclusion=execution?`本轮相关检查与实际措施已有人员记录。${execution.values.measures} ${execution.values.verification==='unresolved'?'原问题仍存在，继续解释原因。':observation?.values?`最新可比片段3号缸${observation.values[0]}°C、其他缸中位数${observation.values[1]}°C，需结合覆盖范围评价持续效果。`:'持续效果尚需可比运行记录验证。'}`:later?`${later.values}。${later.judgement}`:state?.taskComplete?'本次现场核实已结束，原3号缸排温健康记录继续；核实完成不等于部件故障已确定或健康已经恢复。':'3号缸在可比负荷下持续高于本机历史，偏移从+4°C扩大到+9°C。需要补齐现场信息，暂不据此安排拆机或换件。'
    return {conclusion,basis:`本机历史参考400°C，9月28日／10月2日／10月14日为404／406／409°C，其他缸中位数399／400／400°C；负荷65%—67%、约750 rpm、增压空气39—40°C。温度与偏移共享来源，不能重复计为独立证明。${assessment?' 已提交的现场分析：'+assessment.message:' 测点校验及完整燃油／维护背景尚待补充，同源显示相符不能视为校准。'}`,next:execution?'回查实际检查与措施，对照原排温记录评价效果；未做的季度项目保留。':state?.recommendationId?'查看累积趋势、已补反馈与原季度项目为何支持提前评估；具体检查决定是否维护，不预定换件。':state?.taskComplete?'继续比较同口径趋势，没有新信息需求时不重复派单；偏移稳定不等于恢复，持续发展再结合相关计划评估。':store.todoCreated['aux-health']?'沿原核实待办补充实际读数与背景，完成本次信息补充后原趋势继续。':'查看3号缸偏移的分析与核实范围，决定是否安排当班人员补充信息。'}
  }
  return deviceId==='aux-engine-1'?{conclusion:'已覆盖的运行片段未见持续扩大变化，目前没有需要轮机长决策的新事项。单次轻微偏移仍保留原记录，不据此推断健康衰减。',basis:'1号运行约750 rpm、近期负荷61%—64%。曾有一个相近条件片段高于本机历史约3°C，后续尚无支持持续发展的证据；没有事项不等于所有部位已验证。',next:'继续比较可比窗口；若变化再次出现并持续，再评价是否需要现场信息。维持原计划，可回查传感器和已有记录。'}:{conclusion:'3号辅机当前备用，现有资料支持最近一次试运行完成，不能据此宣称所有负荷下能力均已验证。',basis:'10月10日记录覆盖启动、建压与约30%负荷下30分钟试运行，未记录异常；尚无更高负荷及更长时间的资料。备用转速0属于状态背景，不作为运行健康证据。',next:'下一次切换准备时按原计划核对试运行与当班记录；如需承担更高负荷，先核对相应试运行资料。'}
}
