import data from './realCases.json' with {type:'json'}
import {observationPresets} from './realScenarioPresets.js'

// Real measurements/document conclusions stay in the supplied dataset. This adapter
// supplies the local workflow fixtures; source measurements remain unchanged.
export const realCaseRecords = data.cases || []
const typeNames={alarm:'报警事件',warning:'预警事件',tracking:'异动跟踪',maintenance:'维保建议'}
export const simulationNotice='人工派发、核实、作业和结束步骤为补全演示；不证明真实检查、维修或永久更换已经发生。'
export const realCaseFor=id=>realCaseRecords.find(item=>item.id===id||item.id+'-replay'===id)
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
 if(type==='alarm')return [task('核查 C2 ICU 液压机构与反馈','对照0430原始时序、控制指令与反馈，分别核查 ICV 控制和 ICU 液压执行机构；保存本轮取得的现场或检验记录，不由信号单独推定卡阻。',findings,'icv'),task('核查燃油供给与瞬态工况','记录同刻压力、其他缸响应及工况变化，说明已排除和仍未确认的方向。',findings,'supply')]
 if(type==='warning')return [task('核对压力测点及时间对应','对照0523压力、控制空气与人员记录；注明采样来源与时刻，NF参考不作为独立确诊。',readings),task('核对工况及临时恢复解释','对照运行负荷、控制空气压力和操作记录，核对供气不足与工况切换的不同解释；不能由恢复片段倒推已修复。',['工况可比，偏离仍存在','工况变化可以解释','无法确认'])]
 if(type==='tracking')return [task('核对倒车试验同刻读数','对应0816倒车指令、转速和原采样时刻；同源显示一致不等于独立校准。',readings),task('记录倒车工况与可比范围','明确倒车、换向、低负荷片段及持续时间；不能直接用稳定航行基线判定部件故障。',['信息已记录','条件受限，已记录限制','无法确认'])]
 return [task('评估减压阀后续检查必要性','结合0523临时恢复、永久更换证据缺口及后续检查需求；不把临时恢复当永久修复。',['有提前处理依据','暂无提前处理必要','无法确认']),task('核对备件、隔离与作业窗口','记录减压阀规格、备件、隔离、人员和窗口；现有资料未确认的项目保持未知。',['条件具备','条件暂不具备','无法确认'])]
}
function packageFor(key,label){return {title:label,preparation:['按本机适用资料确认范围、隔离与许可。'],parts:[{name:label+'相关备件',amount:'按实际核实',use:'尚未核实规格及数量，不预设已领用或已更换'}],tasks:[task('记录'+label+'实际措施','填写实际范围、依据和未完成项。'),task('复核'+label+'与原指标','记录适用复测、工况和限制；不由当前恢复倒推唯一根因。')],acceptance:['本轮范围及实际措施有依据','原始指标与可比工况复核，长期效果另行观察']}}
function buildCase(record){
 const replay=true
 const type=realCaseType(record),id=record.id,facts=evidenceText(record),limits=record.limits||record.notes||[]
 const source='传感器采样、船端报告与现场反馈'
 const stage=(id,label,kind,title,tasks=[])=>({id,label,kind,title,summary:title,evidence:facts.slice(0,4),tasks,action:kind==='check'?'提交本轮反馈':kind==='work'?'提交执行与验收':'查看下一阶段',markdown:`### ${title}\n\n${record.summary}\n\n### 记录边界\n\n${simulationNotice}\n\n${limits.map(x=>'- '+text(x)).join('\n')}`})
 const intro=stage('intro','任务概览','intro',record.title)
 const packages=type==='alarm'?{icv:packageFor('icv','C2 ICU 核查后确认的范围'),supply:packageFor('supply','燃油供给核查后确认的范围')}:{regulator:packageFor('regulator','空气减压阀核查后确认的范围'),air:packageFor('air','控制空气供给核查后确认的范围')}
 let stages
 if(type==='alarm')stages=[intro,stage('investigate','原因排查','check','分别核实 C2 ICU 与供给方向',taskSet(type)),stage('repair','对应处置','work','只处理实际发现支持的范围')]
 else if(type==='warning')stages=[intro,stage('check','真实性核实','check','核对压力事实与发生工况',taskSet(type)),stage('event','异常研判','event','区分减压阀故障、临时恢复与未完成事项'),stage('investigate','原因排查','check','分别核查减压阀与控制空气供给',[task('核查空气减压阀状态','对照原文结论和适用检查，区分临时调整与永久更换。',findings,'regulator'),task('核查控制空气供给及工况','保留上下游压力、负荷和供给条件，不以一个部件结论代替全部通路检查。',findings,'air')]),stage('repair','对应处置','work','记录核实后确认的范围')]
 else if(type==='tracking')stages=[intro,stage('check','工况核实','check','核实倒车试验读数及可比范围',taskSet(type))]
 else stages=[intro,stage('check','提前评估','check','分别判断后续检查必要性与作业条件',taskSet(type)),stage('service','检查与维护','work','按真实检查决定维护及未完成项',[task('完成批准范围的减压阀检查','仅填写实际取得的检验资料；未见问题可以记录，无需臆造更换。'),task('记录实际维护与复查','未发生永久更换时明确未更换；备件、窗口和后续安排分别留存。')])]
 stages.push(stage('observe',type==='tracking'?'核实结束':'效果观察','observe',type==='tracking'?'本次核实结束，倒车工况记录继续':'补充处理后可比资料，禁止复用历史采样冒充修后数据'),stage('closed','本轮结束','closed','本轮处理记录已保留，可回查处置与观察依据'))
 const series=realSeries(record),metricSeries=series.filter(s=>s.values.some(v=>Number.isFinite(v))).slice(0,2)
 const observation={days:1,names:metricSeries.map(s=>s.name),units:metricSeries.map(s=>s.unit),before:metricSeries.map(s=>s.values.find(v=>Number.isFinite(v))),samples:[],abnormal:metricSeries.map(s=>s.values.findLast(v=>Number.isFinite(v))),basis:'对比处理前后同工况记录，跟踪原异常是否恢复及持续稳定。'}
 const plan=type==='maintenance'?[{name:'原计划与后续检查',value:'0523永久更换及后续安排尚缺实际完成证据',meaning:'评估相关检查、备件和窗口；未执行部分继续保留。'}]:[]
 const result={id,realCaseId:record.id,realType:type,realReplay:true,scenarioPreset:true,latent:false,deviceId:record.deviceId||'main-engine-1',device:record.device||'主机',cardType:type==='maintenance'?'异动跟踪':typeNames[type],workflowKind:type==='maintenance'?'maintenance':type,sourceEventId:record.sourceEventId,initialTitle:record.title,eventTitle:record.title,eventId:record.id,firstObserved:record.occurredAt||record.timeRange?.start,source,owner:'李建国（大管轮）',trackingOnly:type==='tracking',stages,packages,observation,plan,series,snapshots:(record.facts||[]).map(f=>[f.label,[f.value,f.unit].filter(v=>v!==undefined).join(' '),f.time||'原资料记录',f.context||'按来源解释，不扩大结论']),report:{conclusion:record.conclusion||record.summary,basis:facts.join('；'),human:type==='tracking'?'补齐倒车工况和读数；可以带限制结束核实，原记录继续。':'先核实现场情况，再按批准范围处理，记录实际措施与验收结果。',system:'保留原采样、原文结论及来源',operation:'按适用船舶规程确认'},cause:{mechanism:record.conclusion||record.summary,rows:(type==='alarm'?['C2 ICU 控制与反馈','燃油供给及瞬态工况']:type==='tracking'?['倒车／换向及起动工况','采样与指令时序']:type==='maintenance'?['减压阀永久检修需求','备件与作业条件']:['空气减压阀','控制空气供给与运行工况']).map(name=>({name,level:'待核实',cause:'依据当前案例资料与适用检查核对',effect:'解释原指标变化，不能替代其他方向结论',check:'按实际范围记录'}))},workDetails:{preparation:['核对本轮批准范围、适用资料、隔离和窗口'],parts:[],acceptance:['记录实际完成范围及未完成项','另外补充处理后可比数据，不复用历史片段']},pageContent:{overview:`### 真实资料结论\n\n${record.conclusion||record.summary}\n\n### 来源与演示边界\n\n${record.provenanceSummary||simulationNotice}\n\n${simulationNotice}`,analysis:`### 资料依据\n\n${facts.map(x=>'- '+x).join('\n')}\n\n### 判断限制\n\n${limits.map(x=>'- '+text(x)).join('\n')}`,evidence:`### 来源\n\n${(record.evidence||[]).map(e=>'- '+e.path+(e.line?':'+e.line:'')+' · '+(e.note||'')).join('\n')}\n\n### 边界\n\n${simulationNotice}`}}
 if(replay){
  const first=record.steps?.[0]||{},initial=first.summary||'起始事实待资料确认'
  const boundary=type==='alarm'?'此时只确认报警与二缸变化，具体根因和处理结果尚待本轮核实。':type==='warning'?'此时只确认双测点低压和规则触发，根因、临时恢复与永久措施尚待核实。':type==='tracking'?'负转与燃烧响应是已见信号；方向指令和操纵意图仍须人员核实。':'临时修复后的备件与检修需求已知；是否提前、作业条件及永久完成仍待评估。'
  const initialTitle=type==='alarm'?'0430｜二缸报警与喷射控制核实':type==='warning'?'0523｜控制空气双测点低压核实':type==='tracking'?'0816｜倒车时段负转与燃烧响应核实':'0523后续｜减压阀备件与检查条件评估'
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
 return result
}
export const realWorkflowCases=realCaseRecords.map(record=>buildCase(record))
export const realHealthTracks=realWorkflowCases.filter(c=>c.trackingOnly).map(c=>({id:c.id+'-track',requestId:c.id,deviceId:c.deviceId,device:c.device,title:'倒车试验同源跟踪记录',status:'待核实工况与读数',conclusion:c.report.conclusion,next:c.report.human,realCaseId:c.realCaseId,nodes:(realCaseFor(c.id).steps||[]).filter(s=>!s.isSimulation&&(!c.realReplay||s.id===realCaseFor(c.id).steps?.[0]?.id)).map(s=>({label:s.title,at:s.time||realCaseFor(c.id).timeRange?.start,values:s.summary,context:'发生时的采样与工况记录',judgement:s.result||''})),laterNodes:[]}))

export function assessRealCase(item,stage,feedback){
 const values=feedback.map(entry=>entry.result),common={valid:true,records:clone(feedback)}
 if(stage.id==='investigate'){
  const packages=stage.tasks.filter((_,i)=>values[i]==='发现异常').map(t=>t.package),unknown=stage.tasks.filter((_,i)=>values[i]==='无法确认').map(t=>t.label)
  return {...common,advance:packages.length>0,packages,unknown,title:packages.length?'按本轮实际发现确定范围':'尚未定位可处置对象',message:packages.length?'仅将本轮选择发现异常的方向纳入处置。未见异常方向不维修，未知方向保留。检查发现和处置记录沿原事项留存。':'本轮结果有效并已保存；可以继续补充或登记线索，不能为推进流程强行填异常。',actions:packages.length?[]:['retry','supplement']}
 }
 if(item.realType==='warning'){
  const advance=values[0]==='现场与系统一致'&&values[1]==='工况可比，偏离仍存在'
  return {...common,advance,title:advance?'当前反馈支持接续排查':'当前预警依据仍需核对',message:advance?'沿原事项分别核查空气减压阀及控制空气供给；实际措施、是否临时恢复及永久完成情况必须由本轮提交的依据说明。':values[1]==='工况变化可以解释'?'核对解释是否覆盖发生窗口；当前恢复不能倒推过去误报。结束本轮需明确依据及仍未完成事项。':'读数差异或资料不足不证明误报；核对测点、同刻时序与工况，NF参考不作独立确认。',actions:advance?[]:['retry','end-warning']}
 }
 if(item.trackingOnly)return {...common,advance:false,title:'倒车工况信息已纳入原记录',message:'保留实际读数、倒车/换向工况和未确认范围。与稳定航行不可比时不作部件故障推断；同源显示一致不等于校准。可继续补充，或记录限制后结束本轮核实，原记录继续。',actions:['retry','finish-tracking']}
 const advance=values[0]==='有提前处理依据'&&values[1]==='条件具备'
 return {...common,advance,title:advance?'必要性与作业条件已分别确认':'提前评估尚未满足推进条件',message:advance?'接续批准范围的检查；实际检查决定是否维护或换件。永久完成仍须有真实记录。':values[0]==='有提前处理依据'?'有检查依据但条件不足，保持待安排；不能写成无需维修或已执行。':'保存缺项或暂无提前必要的依据；可以继续补充或结束本次评估，原后续检查需求和未完成安排继续保留。',actions:advance?[]:['retry','end-maintenance']}
}
