import {guidedTask} from './taskGuidance.js'
import {baselineTaskSets,baselineDirections} from './baselineTaskContent.js'
import {buildC1Maintenance,c1MaintenanceId} from './trackingDisposition.js'
import data from './realCases.json' with {type:'json'}
import {observationPresets,realAssessmentContent} from './realScenarioPresets.js'
import {eventBriefingFor} from './eventBriefings.js'
import {taskPackages, maintenanceWork, assigneeBriefs, assigneeStageMarkdown} from './realTaskContent.js'

// Real measurements/document conclusions stay in the supplied dataset. This adapter
// supplies the local workflow fixtures; source measurements remain unchanged.
export const realCaseRecords = data.cases || []
const typeNames={alarm:'报警事件',warning:'预警事件',tracking:'异动跟踪',maintenance:'维保建议'}
export const simulationNotice='人工派发、核实、作业和结束步骤为补全演示；不证明真实检查、维修或永久更换已经发生。'
export const realCaseFor=id=>realCaseRecords.find(item=>item.id===(id===c1MaintenanceId?'real-tracking-exhaust-baseline':id)||item.id+'-replay'===id)
export const realCaseType=item=>item.viewId||Object.keys(typeNames).find(key=>typeNames[key]===item.type)||item.type
const clone=value=>JSON.parse(JSON.stringify(value))
const text=value=>typeof value==='string'?value:JSON.stringify(value||'')
const evidenceText=item=>(item.facts?.length?item.facts.map(f=>[f.label,f.value,f.unit,f.time].filter(v=>v!==undefined&&v!=='').join(' ')):[item.summary]).filter(Boolean)
export function realSeries(item){return (item.series||[]).map(series=>({name:series.name||series.label,unit:series.unit||'',labels:series.points?.map(p=>p.time)||series.labels||[],values:series.points?.map(p=>p.value)||series.values||[],scope:series.note||'原始记录，非设备通用阈值'}))}
export function realStageId(step,type){
 const key=step.stageId||step.id||''
 if(/decision|dispatch/.test(key))return 'intro'
 if(/investigate/.test(key))return 'investigate'
 if(/repair|work|service/.test(key))return type==='maintenance'?'service':'repair'
 if(/observe|later|return/.test(key))return 'observe'
 if(/finish|close/.test(key))return 'closed'
 if(/check|assess/.test(key))return 'check'
 return 'intro'
}
const findings=['发现异常','未见异常','无法确认']
const readings=['现场与系统一致','读数不一致','无法确认']
const task=(label,guide,options,packageKey)=>({label,guide,...(options?{options}:{}),...(packageKey?{package:packageKey}:{})})
function taskSet(type){
 if(type==='alarm')return [task('核查 C2 ICU 液压机构与反馈','对齐报警时序与喷射指令、流量活塞反馈，检查二缸喷射控制单元（ICU）的插接件、反馈线束和伺服油液压活塞；保存检查位置、动作及表面状态。',findings,'icv'),task('核查燃油供给与瞬态工况','对齐燃油轨压力、六缸排气温度与启停时刻，核对燃油供给泵、阀位、滤器压差和接头密封；标明实际检查段及未检查部位。',findings,'supply')]
 if(type==='warning')return [task('核对压力测点及时间对应','对照低压窗口的主机控制空气进口压力、主机控制空气进口压力（安全监测）及就地表计；注明位置、来源与时刻，两个进口测点不代表减压阀前后压力。',readings),task('核对工况及临时恢复解释','对照运行负荷、控制空气压力和操作记录，核对供气不足与工况切换的不同解释；不能由恢复片段倒推已修复。',['工况可比，偏离仍存在','工况变化可以解释','无法确认'])]
 return clone(baselineTaskSets[type])
}
function applyBriefing(item){
 const brief=eventBriefingFor(item.id)
 if(!brief)return item
 const facts=brief.facts.map(f=>`${f.label}：${f.value}${f.unit?' '+f.unit:''}。${f.meaning}`)
 item.baselineCylinder=brief.baselineCylinder
 item.source=brief.discovery.label
 item.discovery=brief.discovery
 item.decisionLimit=brief.boundary
 item.evidenceSources=brief.sources
 item.taskScope=brief.tasks.map(t=>t.title+'：'+t.detail).join('；')
 item.report={...item.report,basis:facts.join('；'),conclusion:brief.conclusion,human:brief.captainDecision+' '+brief.dispatchReason,system:brief.discovery.text}
 item.cause.mechanism=brief.conclusion
 const directions={
  alarm:[['二缸喷射控制与液压执行','二缸排温80.4°C，与其余五缸明显分离，并有流量活塞报警。','优先检查二缸喷射控制单元的插接件、反馈线束和伺服油液压活塞，将指令、反馈与实际动作对应。','核对喷射控制阀（ICV）指令、喷射控制单元（ICU）连接、流量活塞反馈及液压活塞检查记录。'],['共同燃油供给与运行切换','同刻其余五缸排温316.9–352.2°C，主机处于重新启动后的运行段。','共同供给与操纵变化应一并排查；其他缸响应不等于供给全通路已排除。','对齐燃油轨压力、各缸响应、启停与供给操作时刻。']],
  warning:[['减压环节调压异常','主机控制空气进口压力与主机控制空气进口压力（安全监测）均下降0.10 MPa，连续低压片段分别为0.57/0.54 MPa。','另测减压阀前后压力，检查阀芯、阀座、密封垫及弹簧的调压和回位状态；两个主机进口压力测点用于核对供气响应。','记录减压阀前后表计位置、压力、调节状态及两组阀使用情况。'],['用气变化、供气与管路泄漏','同期转速102.0–104.4 RPM，但杂用空气操作尚需核对。','用气增加、供气不足或泄漏都可能使两个进口压力测点下降；主机转速与燃油指令不能替代用气量及供给检查。','核对操作时间、空气瓶压力、供气过滤器、排水阀和管路接头，记录堵塞、积水及查漏位置。']],
  ...baselineDirections,
 }
 item.cause.rows=(directions[item.realType]||[]).map(([name,cause,effect,check])=>({name,level:'待核实',cause,effect,check}))
 item.snapshots=brief.facts.map(f=>[f.label,[f.value,f.unit].filter(Boolean).join(' '),f.at,f.meaning])
 item.pageContent={
  overview:`### 当前研判\n\n${brief.conclusion}\n\n### 决策要点\n\n${brief.captainDecision}\n\n### 派发依据\n\n${brief.dispatchReason}`,
  analysis:`### 发现过程\n\n${brief.discovery.text}\n\n### 关键数据与含义\n\n${facts.map(f=>'- '+f).join('\n')}\n\n### 现场核实范围\n\n${brief.tasks.map(t=>`- **${t.title}**：${t.detail}`).join('\n')}\n\n### 尚待确认\n\n${brief.boundary}`,
  evidence:`### 关联资料\n\n${brief.sources.map(s=>`- **${s.title}** · ${s.kind} · ${s.date}\n  ${s.summary}`).join('\n\n')}\n\n### 数据时间范围\n\n${brief.evidenceCutoff?'截至 '+brief.evidenceCutoff:'临修后跟踪资料，日期以各份记录为准'}；各测点按原采集时刻对照。`,
 }
 const execution=assigneeBriefs[item.realType]
 for(const stage of item.stages){
  if(stage.kind==='observe')stage.title=item.trackingOnly?'核实结果与后续跟踪':'处理后运行效果观察'
  stage.evidence=facts.slice(0,4)
  stage.summary=stage.kind==='intro'?execution.objective:stage.kind==='observe'?execution.observation:execution.check
  stage.markdown=assigneeStageMarkdown(item.realType,stage,brief.conclusion)
 }
 if(item.realType==='alarm')item.observation.basis='报警末点用于呈现当时缸间差异。处理后须在可比转速、负荷与喷射条件下比较各缸响应，并核对原报警是否反复；不能只凭绝对温差认定恢复。'
 return item
}
function buildCase(record){
 const replay=true
 const type=realCaseType(record),id=record.id,facts=evidenceText(record),limits=record.limits||record.notes||[]
 const source='传感器采样、船端报告与现场反馈'
 const stage=(id,label,kind,title,tasks=[])=>({id,label,kind,title,summary:title,evidence:facts.slice(0,4),tasks,action:kind==='check'?'提交本轮反馈':kind==='work'?'提交执行与验收':'查看下一阶段',markdown:`### ${title}\n\n${record.summary}\n\n### 记录边界\n\n${simulationNotice}\n\n${limits.map(x=>'- '+text(x)).join('\n')}`})
 const intro=stage('intro','任务概览','intro',record.title)
 const packages=taskPackages(type),service=maintenanceWork()
 let stages
 if(type==='alarm')stages=[intro,stage('investigate','原因排查','check','分别核实 C2 ICU 与供给方向',taskSet(type)),stage('repair','对应处置','work','只处理实际发现支持的范围')]
 else if(type==='warning')stages=[intro,stage('event','异常研判','check','核对低压事实与工况，确定排查方向',taskSet(type)),stage('investigate','原因排查','check','分别核查减压阀与控制空气供给',[task('核查空气减压阀状态','记录两组阀的使用状态与阀前后压力；在获准隔离条件下检查阀芯密封和调压动作，区分临时恢复与正式更换需求。',findings,'regulator'),task('核查控制空气供给及工况','分别记录主空气瓶、控制空气瓶和用气端压力，检查控制空气过滤器、排水阀及管路接头；对照用气和阀组切换时刻定位堵塞、积水或泄漏。',findings,'air')]),stage('repair','对应处置','work','记录核实后确认的范围')]
 else if(type==='tracking')stages=[intro,stage('check','基线核实','check','核实一缸月度工况与测温基线',taskSet(type))]
 else stages=[intro,stage('check','提前评估','check','分别判断后续检查必要性与作业条件',taskSet(type)),stage('service','检查与维护','work',service.title,service.tasks)]
 stages.push(stage('observe',type==='tracking'?'核实结束':'效果观察','observe',type==='tracking'?'本次核实结束，月度健康跟踪继续':'补充处理后可比资料，禁止复用历史采样冒充修后数据'),stage('closed','本轮结束','closed','本轮处理记录已保留，可回查处置与观察依据'))
 const series=realSeries(record),metricSeries=series.filter(s=>s.values.some(v=>Number.isFinite(v))).slice(0,2)
 const observation={days:1,names:metricSeries.map(s=>s.name),units:metricSeries.map(s=>s.unit),before:metricSeries.map(s=>s.values.find(v=>Number.isFinite(v))),samples:[],abnormal:metricSeries.map(s=>s.values.findLast(v=>Number.isFinite(v))),basis:'对比处理前后同工况记录，跟踪原异常是否恢复及持续稳定。'}
 const plan=type==='maintenance'?[{name:'原计划与后续检查',value:'四缸测温与燃烧平衡检查按原计划和本轮必要性评估安排',meaning:'评估相关检查、备件和窗口；未执行部分继续保留。'}]:[]
 const result={id,realCaseId:record.id,realType:type,realReplay:true,scenarioPreset:true,latent:false,deviceId:record.deviceId||'main-engine-1',device:record.device||'主机',cardType:type==='maintenance'?'异动跟踪':typeNames[type],workflowKind:type==='maintenance'?'maintenance':type,sourceEventId:record.sourceEventId,initialTitle:record.title,eventTitle:record.title,eventId:record.id,firstObserved:record.occurredAt||record.timeRange?.start,source,owner:'李建国（大管轮）',trackingOnly:type==='tracking',stages,packages,observation,plan,series,snapshots:(record.facts||[]).map(f=>[f.label,[f.value,f.unit].filter(v=>v!==undefined).join(' '),f.time||'原资料记录',f.context||'按来源解释，不扩大结论']),report:{conclusion:record.conclusion||record.summary,basis:facts.join('；'),human:type==='tracking'?'补齐月度工况、测温与调整记录，保留已核实范围和未确认项。':'先核实现场情况，再按批准范围处理，记录实际措施与验收结果。',system:'保留原采样、原文结论及来源',operation:'按适用船舶规程确认'},cause:{mechanism:record.conclusion||record.summary,rows:(type==='alarm'?['C2 ICU 控制与反馈','燃油供给及瞬态工况']:type==='tracking'?['月度运行与热平衡','测温基线与采样对应']:type==='maintenance'?['四缸测温与燃烧检查需求','校验、备料与作业条件']:['空气减压阀','控制空气供给与运行工况']).map(name=>({name,level:'待核实',cause:'依据当前案例资料与适用检查核对',effect:'解释原指标变化，不能替代其他方向结论',check:'按实际范围记录'}))},workDetails:type==='maintenance'?service:{preparation:[],parts:[],acceptance:[]},pageContent:{overview:`### 真实资料结论\n\n${record.conclusion||record.summary}\n\n### 来源与演示边界\n\n${record.provenanceSummary||simulationNotice}\n\n${simulationNotice}`,analysis:`### 资料依据\n\n${facts.map(x=>'- '+x).join('\n')}\n\n### 判断限制\n\n${limits.map(x=>'- '+text(x)).join('\n')}`,evidence:`### 来源\n\n${(record.evidence||[]).map(e=>'- '+e.path+(e.line?':'+e.line:'')+' · '+(e.note||'')).join('\n')}\n\n### 边界\n\n${simulationNotice}`}}
 if(replay){
  const first=record.steps?.[0]||{},initial=first.summary||'起始事实待资料确认'
  const boundary=type==='alarm'?'此时只确认报警与二缸变化，具体根因和处理结果尚待本轮核实。':type==='warning'?'此时只确认主机控制空气进口压力低的AI检测结果，根因、临时恢复与永久措施尚待核实。':type==='tracking'?'月度相对基线变化已见，热平衡和测温原因仍须核实。':'四缸相对基线持续下移；是否提前检查和实施条件仍待评估。'
  const initialTitle=type==='alarm'?'二缸报警与喷射控制核实':type==='warning'?'控制空气双测点低压核实':type==='tracking'?'一缸排温长期基线抬升跟踪':'四缸测温与燃烧平衡检查评估'
  result.initialTitle=initialTitle;result.eventTitle=initialTitle
  result.report={...result.report,conclusion:initial+' '+boundary,basis:initial}
  result.cause.mechanism=initial+' '+boundary
  result.snapshots=[['起始资料',initial,first.time||record.timeRange?.start,boundary]]
  result.pageContent={overview:'### 起始时点已知资料\n\n'+initial+'\n\n### 当前判断边界\n\n'+boundary,analysis:'### 起始证据与待核实事项\n\n'+initial+'\n\n'+boundary+'\n\n后续判断随本轮提交的反馈更新，保留检查依据、实际措施和未完成项。',evidence:'### 起始引用\n\n'+(first.evidence||[]).map(e=>'- '+e.path+(e.line?':'+e.line:'')).join('\n')+'\n\n原文档可能包含后续检验结论；初始事项不将后续事实倒填为当时已知。'}
  const date=String(first.time||'').match(/\d{4}-\d{2}-\d{2}/)?.[0],times=String(first.time||'').match(/\d{2}:\d{2}(?::\d{2})?/g)
  const cutoff=date&&times?.length?date+' '+(times.at(-1).length===5?times.at(-1)+':00':times.at(-1)):null
  if(cutoff){result.series=result.series.map(entry=>{const points=entry.labels.map((time,i)=>({time,value:entry.values[i]})).filter(p=>p.time.replace('T',' ')<=cutoff);return {...entry,labels:points.map(p=>p.time),values:points.map(p=>p.value)}}).filter(entry=>entry.values.length);result.realEvidenceCutoff=cutoff}
  for(const stage of result.stages){if(stage.id==='intro'){stage.title=initialTitle;stage.summary=initial}else if(stage.id==='event'){stage.title='根据本轮反馈确定待核实方向';stage.summary=stage.title}stage.evidence=[initial,boundary];stage.markdown='### '+stage.title+'\n\n'+initial+'\n\n### 本阶段边界\n\n'+boundary+'\n\n本阶段判断以已提交反馈为准，后续检查、作业与闭环按处理进度记录。'}
 }
 if(observationPresets[id])result.observation={...observationPresets[id],basis:'对比处理前后的同工况指标，结合观察窗口与现场反馈判断效果；异常反复时沿原事项复查，持续稳定后确认闭环。'}
 result.deviceId='main-engine-1';result.device='主机';result.firstObserved=record.steps?.[0]?.time||record.timeRange?.start
 return applyBriefing(result)
}
export const realWorkflowCases=realCaseRecords.map(record=>buildCase(record))
realWorkflowCases.push(buildC1Maintenance(realWorkflowCases.find(item=>item.id==='real-tracking-exhaust-baseline')))
for(const item of realWorkflowCases)for(const stage of item.stages)if(stage.kind==='check')stage.tasks=stage.tasks.map(guidedTask)
export const realHealthTracks=realWorkflowCases.filter(c=>c.trackingOnly).map(c=>({id:c.id+'-track',requestId:c.id,deviceId:c.deviceId,device:c.device,title:'一缸排温长期基线抬升跟踪',status:'待核实月度基线',conclusion:c.report.conclusion,next:c.report.human,realCaseId:c.realCaseId,nodes:(realCaseFor(c.id).steps||[]).filter(s=>!s.isSimulation&&(!c.realReplay||s.id===realCaseFor(c.id).steps?.[0]?.id)).map(s=>({label:s.title,at:s.time||realCaseFor(c.id).timeRange?.start,values:s.summary,context:'跨月同刻配对采样与工况筛选',judgement:s.result||''})),laterNodes:[]}))

export function assessRealCase(item,stage,feedback){
 return {...assessRealCaseFlow(item,stage,feedback),...realAssessmentContent(item,stage,feedback)}
}
function assessRealCaseFlow(item,stage,feedback){
 const values=feedback.map(entry=>entry.result),common={valid:true,records:clone(feedback)}
 if(stage.id==='investigate'){
  const packages=stage.tasks.filter((_,i)=>values[i]==='发现异常').map(t=>t.package),unknown=stage.tasks.filter((_,i)=>values[i]==='无法确认').map(t=>t.label)
  return {...common,advance:packages.length>0,packages,unknown,title:packages.length?'按本轮实际发现确定范围':'尚未定位可处置对象',message:packages.length?'仅将本轮选择发现异常的方向纳入处置。未见异常方向不维修，未知方向保留。检查发现和处置记录沿原事项留存。':'本轮结果有效并已保存；可以继续补充或登记线索，不能为推进流程强行填异常。',actions:packages.length?[]:['retry','supplement']}
 }
 if(item.realType==='warning'){
  const advance=values[0]==='现场与系统一致'&&values[1]==='工况可比，偏离仍存在'
  return {...common,advance,title:advance?'当前反馈支持接续排查':'当前预警依据仍需核对',message:advance?'沿原事项分别核查空气减压阀及控制空气供给；实际措施、是否临时恢复及永久完成情况必须由本轮提交的依据说明。':values[1]==='工况变化可以解释'?'核对解释是否覆盖发生窗口；当前恢复不能倒推过去误报。结束本轮需明确依据及仍未完成事项。':'读数差异或资料不足不证明误报；核对测点、同刻时序与工况，NF参考不作独立确认。',actions:advance?[]:['retry','end-warning']}
 }
 if(item.trackingOnly)return {...common,advance:false,title:'月度基线核实已纳入原记录',message:'保留月度可比范围、历史调整与通道核验；不能将温差直接等同部件故障。可继续补充，或记录限制后结束本轮核实，原健康跟踪继续。',actions:['retry','finish-tracking']}
 const advance=values[0]==='有提前处理依据'&&values[1]==='条件具备'
 return {...common,advance,title:advance?'必要性与作业条件已分别确认':'提前评估尚未满足推进条件',message:advance?'接续批准范围的检查；实际检查决定是否维护或换件。永久完成仍须有真实记录。':values[0]==='有提前处理依据'?'有检查依据但条件不足，保持待安排；不能写成无需维修或已执行。':'保存缺项或暂无提前必要的依据；可以继续补充或结束本次评估，原后续检查需求和未完成安排继续保留。',actions:advance?[]:['retry','end-maintenance']}
}
