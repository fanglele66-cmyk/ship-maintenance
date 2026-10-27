import {baselineProfiles,baselineFeedback,baselineAssessment} from './baselineScenarioContent.js'
// Interaction drafts are simulated; imported evidence is never overwritten.
export const observationPresets = {
 'real-alarm-0430': {names:['二缸排气温度','一缸排气温度'],units:['°C','°C'],before:[80.4,347.5],samples:[[260,258],[261,259]],abnormal:[180,259],days:1},
 'real-warning-0523': {names:['控制空气进口压力','控制空气进口压力（安全）'],units:['MPa','MPa'],before:[0.57,0.54],samples:[[0.67,0.64],[0.67,0.64]],abnormal:[0.57,0.54],days:1},
 'real-maintenance-c4-baseline': {names:['四缸排温相对其余五缸均值偏差'],units:['°C'],before:[-6.44],samples:[[-2.4],[-2.6]],abnormal:[-6.44],days:2},
}
const profiles = {
 alarm:{scope:'C2 ICU 控制与液压执行、燃油供给',evidence:'二缸排温及流量活塞报警、指令与动作反馈',observe:'同工况二缸与其他缸排温、喷射反馈及原报警是否反复',recheck:'分别复核 ICV 电控、ICU 液压执行和燃油供给，不能由排温变化单独指定更换对象'},
 warning:{scope:'空气减压阀及控制空气供给',evidence:'主机控制空气进口压力及主机控制空气进口压力（安全监测）、同刻转速与供气状态',observe:'主机控制空气进口压力、主机控制空气进口压力（安全监测）、负荷与供气条件，以及低压是否反复',recheck:'复核减压阀调压与密封、另行记录的上下游分段压力及切换操作，区分临时恢复和持续恢复'},
 ...baselineProfiles,
}
const profileFor=item=>item?.handoffTask?JSON.parse(JSON.stringify(profiles.maintenance).replaceAll('四缸','一缸')):profiles[item?.realType]||profiles.tracking
const shown=records=>records.map(record=>record.label+'：'+record.result).join('；')
function caseFeedback(item,stage,index,value){
 if(stage.round>1){
  const task=stage.tasks[index],scope=task.label
  if(value==='无法确认'||value==='条件暂不具备')return `第${stage.round}轮${scope}：前轮资料已对照，但本次复发片段或检查条件仍未齐，保留缺项及补查安排，不复用首轮发现作为本轮结论。`
  if(value==='未见异常'||value==='暂无提前处理必要')return `第${stage.round}轮${scope}：已复核前轮措施与本次覆盖范围，尚未取得支持该方向新增处置的证据，保留未检查项目。`
  return `第${stage.round}轮${scope}：已对照前轮实际措施、修后首测与复发条件，按本轮检查结果登记${value}；具体部位、维修作业单及复测资料随记录留存，不能据选项预定更换件。`
 }
 if(stage.id==='investigate'){
  const notes=item.realType==='alarm'?[
   {
    '发现异常':'二缸 ICU 拆检记录显示伺服油液压活塞动作卡滞，喷射指令与执行反馈不一致；本轮将 ICU 液压执行范围纳入处置。ICV 电控与液压机构分开记录，未将所有控制链路归为同一故障。',
    '未见异常':'已核对二缸 ICV 指令、ICU 动作及复位反馈，本次检查未发现对应异常；本轮不安排 ICU 更换。保留报警时段与当前检查的工况差别，异常复现时再核对动态响应。',
    '无法确认':'已有二缸报警和喷射指令记录，但缺少 ICU 行程反馈与液压活塞现场检验；暂不能区分控制侧与液压执行侧。下一步取得同刻动作反馈，并在允许条件下完成机构检查。',
   },
   {
    '发现异常':'二缸喷射响应未随指令同步恢复，供给侧和瞬态过程仍有异常线索；将燃油压力、供给状态与喷射恢复时序纳入本轮核查处置。尚无证据指定供给通路中的某一阀件损坏。',
    '未见异常':'已核对燃油供给压力、同刻其他缸响应及负荷变化，检查范围内未见可解释二缸报警的供给异常；本轮不安排供给侧维修，未检查通路继续保留。',
    '无法确认':'燃油供给侧缺少与报警同刻的压力和操作记录，不能用恢复后的读数排除瞬态供给变化；保留该方向，先补齐报警前后压力及其他缸响应时序。',
   },
  ]:[
   {
    '发现异常':'单组空气减压阀调压动作卡滞，拆检记录有阀芯密封垫老化；低压与调压、密封异常方向一致，本轮纳入减压阀处置。临时恢复措施与永久更换分别登记，不能由 NF 变化单独确诊。',
    '未见异常':'本次检查减压阀调压动作、密封及复位未见异常；暂不安排减压阀维修。保留原主机控制空气进口压力及主机控制空气进口压力（安全监测）的低压记录，继续对照供给压力、切换和用气时序，不能以当前动作正常否定历史低压。',
    '无法确认':'减压阀当前可以调压，但缺少低压发生时的动作记录和内部密封检查，不能确认是否存在间歇卡滞；先补动作测试及适用检查条件，暂不指定更换。',
   },
   {
    '发现异常':'控制空气供给压力与低压窗口存在不同步恢复，供气或切换方向仍有异常线索；本轮纳入上下游压力和供给通路核查。尚未定位具体泄漏点或损坏件，不扩大到全部空气系统维修。',
    '未见异常':'已核对供给侧压力、运行负荷及供气切换，检查范围内未发现持续供气不足；本轮不安排供给侧维修。减压阀方向按独立检查结果处理，不能相互替代结论。',
    '无法确认':'供给侧缺少低压窗口的上游压力或切换记录，先补齐主空气瓶、减压阀前后和控制空气瓶压力、用气及切换时间，再确定是否纳入处置。',
   },
  ]
  return notes[index]?.[value]
 }
 if(item.realType==='warning')return index===0?{
  '现场与系统一致':'本轮选择现场与系统一致；提交前补齐主机控制空气进口压力、主机控制空气进口压力（安全监测）对应的现场表计位置、时刻、实际读数与来源。原平台连续低压片段分别为0.57 MPa、0.54 MPa，不能自动填写为现场测量；同源显示一致不等于独立校准。',
  '读数不一致':'现场仪表与平台主机控制空气进口压力、主机控制空气进口压力（安全监测）的低压片段尚未对应，先区分时间差、位置差和实际读数差；暂不认定误报。两测点均为主机进口压力，不能按减压阀两侧理解。',
  '无法确认':'原主机控制空气进口压力与主机控制空气进口压力（安全监测）低压记录完整，但缺少发生窗口的现场仪表读数或来源；当前不能确认现场与平台一致。补齐同刻现场记录后再判断，原双测点低压保留。',
 }[value]:{
  '工况可比，偏离仍存在':'已核对 21:27:34 至 21:28:40 的连续低压片段，所属30分钟窗口主机转速为102.0–104.4 RPM；主机控制空气进口压力及主机控制空气进口压力（安全监测）同期下降，但转速范围不能代替用气操作核实。本轮保留低压方向，继续核查减压阀、供给和切换情况。',
  '工况变化可以解释':'操作反馈记录了供气切换及随后的压力恢复，与本轮核对的低压片段对应；按短时供气工况影响保留解释。结束核实前确认操作起止覆盖完整，当前恢复不代表永久修复。',
  '无法确认':'低压片段转速较稳定，但供气切换、阀组操作与负荷记录不齐；仅凭转速不能排除供气工况影响。下一步补齐操作时刻和上下游压力，暂不归因为某一部件。',
 }[value]
 return baselineFeedback(item,index,value)
}
export function feedbackPresets(item,stage){
 if(!item?.realCaseId||stage?.kind!=='check')return []
 const combinations=stage.tasks.reduce((rows,task)=>rows.flatMap(row=>(task.options||['发现异常','未见异常','无法确认']).map(value=>[...row,value])),[[]])
 return combinations.map((values,index)=>({id:String(index),label:values.join(' / '),records:stage.tasks.map((task,i)=>({label:task.label,result:values[i],attachments:[],note:caseFeedback(item,stage,i,values[i]),isSimulation:true,sourceCaseId:item.realCaseId}))}))
}
// Copy only: validity, advance, packages and actions remain owned by the adapter.
export function realAssessmentContent(item,stage,feedback){
 if(!item?.realCaseId||stage?.kind!=='check')return {}
 const values=feedback.map(entry=>entry.result),[first,second]=values,p=profileFor(item)
 if(item.realType==='maintenance'&&stage.round>1){
  const supported=first==='有提前处理依据',ready=second==='条件具备'
  const submitted=feedback.map(record=>`${record.label}：${record.result}。${record.note||'尚未附本轮具体检验或条件记录，不能扩大为部件结论。'}`).join('\n\n')
  const next=supported&&ready?'本轮已提交新增检查依据及实施条件，接续本轮获批范围的补充检查或返工；实际措施以新增检验为准，已完成且无新疑点的前轮项目不重复拆换。':supported?'补齐本次窗口、仪器或备料缺项后再实施；前轮条件不能自动视为本轮仍具备。':first==='暂无提前处理必要'?'保留本轮未取得新增处置依据的范围，说明复发的解释与未覆盖项后决定是否结束本次复查，原计划和未完成需求继续保留。':'继续补充本次复发片段、独立检验和剩余项目，必要性尚未确认，不沿用首轮结论安排新作业。'
  return {title:`第${stage.round}轮${supported&&ready?'复查依据与作业条件已提交':supported?'复查需求待落实条件':'复查依据继续核实'}`,message:`本轮对照前轮实际措施、验收及本次复发资料重新判断，前轮完成记录保持独立。\n\n${submitted}\n\n下一步：${next}`}
 }
 if(stage.id==='investigate'){
  const names=value=>stage.tasks.filter((_,index)=>values[index]===value).map(task=>task.label)
  const found=names('发现异常'),normal=names('未见异常'),unknown=names('无法确认')
  const scope=[found.length?`本轮发现支持 ${found.join('、')} 的处置范围。按具体检查证据确定措施，不能由异常选项直接推定需换件。`:'本轮尚未取得支持维修范围的异常发现。',normal.length?`${normal.join('、')}在已检查范围内未见异常，本轮不安排该方向维修。`:'',unknown.length?`${unknown.join('、')}仍未确认；保留缺项及待核实安排，不按正常排除。`:''].filter(Boolean).join('\n\n')
  return {title:found.length?(unknown.length?'按已确认范围处置，缺项继续核实':'检查发现已分流，进入对应处置'):(unknown.length?'检查条件或证据未齐，继续核实':'已查范围未见异常，暂不形成维修'),message:scope+'\n\n下一步：'+(found.length?`进入对应处置，逐项记录实际措施、未完成项和 ${p.evidence} 的复测结果；验收与持续观察分别确认。`:`补充 ${p.evidence} 和未覆盖检查范围；有新线索可登记后继续本轮排查，不能为推进流程填写不存在的异常。`)}
 }
 if(item.realType==='warning'){
  const reading={
   '现场与系统一致':'现场与平台同刻读数一致，支持继续使用该压力事实；仍须区分独立仪表与同源显示。',
   '读数不一致':'读数存在差异，先核对主机控制空气进口压力与主机控制空气进口压力（安全监测）的位置、单位、时间与来源；原双测点低压保留，暂不认定误报。',
   '无法确认':'测点读数的现场对应关系尚未确认，原低压记录不能被当前缺项否定。',
  }[first]
  const condition={
   '工况可比，偏离仍存在':'工况反馈认为偏离仍存在；测点核对也通过后，才具备接续原因排查的条件。',
   '工况变化可以解释':'已有工况解释，需要核对是否覆盖两个控制空气进口压力测点低压的整个发生窗口；恢复片段不能代替这一核对。',
   '无法确认':'发生窗口的负荷、供气切换或操作情况仍不齐，当前不能区分真实供气偏离与工况影响。',
  }[second]
  const advance=first==='现场与系统一致'&&second==='工况可比，偏离仍存在'
  const title=advance?'低压事实与可比条件已核实，接续原因排查':first==='读数不一致'?'先核对压力读数差异，保留原低压':first==='无法确认'?'现场对应未确认，先补压力核对':second==='工况变化可以解释'?'已有工况解释，核对发生窗口后决定':'压力事实已核对，工况信息仍需补齐'
  const next=advance?'沿本事件分别核查空气减压阀与控制空气供给。NF 变化提供线索，故障部位及措施须由现场检查支持。':first==='现场与系统一致'&&second==='工况变化可以解释'?'补充操作时间和解释范围；覆盖完整且人员确认后可结束本次核实。若覆盖不足，继续补充，不能把当前恢复写成永久修复。':'继续补齐读数对应与工况资料。确需结束本轮时，记录核对范围、缺项和后续负责人，不能将资料不足写成预警不成立。'
  return {title,message:reading+'\n\n'+condition+'\n\n下一步：'+next}
 }
 return baselineAssessment(item,feedback)
}
export const executionPresetOptions=[
 {id:'complete',label:'作业与验收完成 → 效果观察'},
 {id:'partial',label:'仅完成部分 → 保留本轮工作'},
 {id:'unresolved',label:'作业完成但仍异常 → 返回排查／评估'},
 {id:'pending',label:'作业完成但未验收 → 补验收'},
 {id:'missing',label:'验收通过但缺可比资料 → 补观察记录'},
]
export function realExecutionContent(item,key,stage){
 if(!item?.realCaseId)return {}
 const p=profileFor(item),scope=stage?.title||p.scope
 return {
  partial:{title:'执行进展已保存，继续完成剩余工作',message:`${scope}仅完成部分。保留各项进展，补充受限条件、剩余范围和安排；本轮未完成验收，不进入效果观察。`},
  pending:{title:'作业记录已保存，补齐现场验收',message:`已记录本轮作业，${p.evidence} 的现场复测尚未完成。补齐复测时刻、工况和结果，再确认本次范围是否通过；现在不作改善结论。`},
  unresolved:{title:'复查仍有异常，沿原事件返回核实',message:`保存本轮措施和复测结果，${p.recheck}。返回排查或评估后保留前轮记录，不重复扩大已经排除的维修范围。`},
  missing:{title:'本次验收已记录，等待可比观察资料',message:`本次范围验收通过，处理后可比资料尚缺。补齐 ${p.observe} 的测量时刻与工况；单次验收不能代替持续效果，也不自动闭环。`},
  complete:{title:'执行与验收已记录，进入效果观察',message:`以本轮执行时间为分界，继续核对 ${p.observe}。记录覆盖目标窗口且未见原异常反复后，由人员确认闭环；未纳入本轮的需求继续保留。`},
 }[key]||{}
}
export function executionPreset(item,stage,key){
 if(!item?.realCaseId||stage?.kind!=='work'||!executionPresetOptions.some(option=>option.id===key))return null
 const partial=key==='partial',p=profileFor(item),now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16)
 if(stage.round>1){
  const measures=`第${stage.round}轮按本次批准范围完成复查后的处置，已将返工、新增作业及未完成项与前轮记录逐项对应；旧新件、实际领用与复装记录另行留存。`
  const acceptance=key==='unresolved'?'本轮复测仍出现原异常，已保存复发工况与本轮措施，继续原因排查。':key==='pending'||partial?'本轮尚缺完整现场验收，保留剩余作业和需补的复测条件。':`本轮获批范围的复装及功能复核已完成，已保留 ${p.observe} 的复测资料；持续效果另行观察。`
  return {...Object.fromEntries(stage.tasks.flatMap((task,index)=>[['task'+index,partial&&index===stage.tasks.length-1?'待补充':'已完成'],['note'+index,`第${stage.round}轮 ${task.label}：按本轮实际范围填写，前轮记录保持独立。`]])),equipment:item.device,executedAt:local,measures:partial?'本轮部分工作已记录，剩余作业与验收待补。':measures,acceptance,completion:partial?'partial':'completed',verification:key==='unresolved'?'unresolved':key==='pending'||partial?'pending':'resolved',comparable:key==='complete'?'available':'missing',isSimulation:true,sourceCaseId:item.realCaseId}
 }
 const baseMeasures=item.realType==='alarm'?(stage.title.includes('ICU')?'按本轮检查结果记录二缸 ICU 液压活塞清洁、连接修复或获批换件的实际项目，完成接口复装与动作测试；具体措施和用料以维修作业单为准。':'完成供给侧检查和本轮确认的供给响应处理，未安排二缸 ICU 更换。')+(stage.title.includes('ICU')&&stage.title.includes('燃油')?'同时完成已确认的燃油供给状态及喷射响应核对。':''):item.realType==='warning'?(stage.title.includes('减压阀')?'按本轮阀组检查结果记录阀芯清洁、配套密封处理或获批总成更换，完成装复与压力测试；实际临时措施、正式措施及未完成项分别登记。':'完成控制空气供给侧检查与压力响应处理，减压阀未纳入本轮维修。'): '完成获批范围的四缸测温链路校验、燃烧平衡检查与六缸同工况复测；实际措施、未执行项目和未解释偏差分别记录。'
 const cylinderText=text=>item.realType==='maintenance'&&(item.baselineCylinder===1||item.handoffTask)?text.replaceAll('四缸','一缸'):text
 const measures=cylinderText(baseMeasures)+(item.realType==='warning'&&stage.tasks.some(task=>task.label==='处理过滤、积水或已定位泄漏')?' 已完成控制空气分段压力核对、放残与接口检查；实际发现和用料沿供气通路分别登记。':'')
 const restored=cylinderText(item.realType==='maintenance'?'四缸本次测温与燃烧检查范围已完成复核，实际拆装部位恢复；六缸同刻读数、转速、负荷与燃油资料已留存，未把相对零温差作为验收要求。':item.realType==='alarm'?'本轮拆装或检查接口未见泄漏，二缸喷射指令与反馈对应；本次测试未见原报警再次触发，已留存六缸排温与转速、负荷记录。仍需观察运行中复发情况。':'本轮阀组或供气通路验收选择通过；提交前填写主机控制空气进口压力、主机控制空气进口压力（安全监测）的本轮实际读数，并附另行测量的上下游压力、用气及切换记录。按本船设定核对，不把历史平台读数当作本轮复测；临时恢复与永久措施分别登记，持续稳定性另行观察。')
 const recurrence=cylinderText(item.realType==='maintenance'?'四缸测温或燃烧检查的原异常线索仍有反复，相对偏差尚未取得完整解释，需沿原跟踪继续核实。':item.realType==='alarm'?'复测中二缸原报警或喷射反馈异常仍有反复，暂不能确认本轮措施解决问题。':'复测中主机控制空气进口压力及主机控制空气进口压力（安全监测）低压或调压异常仍有反复，暂不能确认本轮措施解决问题。')
 const acceptance=partial?'本轮只记录已完成部分，未完成项与验收待补；不将部分复测写成整项验收通过。':key==='unresolved'?recurrence+`保留 ${p.evidence}，沿原事件返回核实。`:key==='pending'?`作业已完成，但 ${p.evidence} 的现场复测未完成，验收保持待补。`:restored+(key==='missing'?'尚缺处理后同工况连续记录，本次验收不代替持续效果。':'已确认可补充后续同工况观测，闭环仍需独立确认。')
 const noteFor=task=>task.feedback||( /复核|复查/.test(task.label)?key==='pending'?'本项已完成作业范围与原指标的资料核对；现场验收复测尚未完成，不视为验收通过。':partial?'本项记录与原指标已核对，整项作业仍有后续步骤未完成，不能据此确认整体验收。':acceptance:task.label.includes('ICU')?'二缸 ICU 检查及实际处理范围已记录，清洁、连接修复或换件按本轮维修作业单分别登记，复装接口已核对。':task.label.includes('减压阀')?item.realType==='maintenance'?'已完成减压阀动作和密封检查，维护范围单独登记；未把检查写成永久更换。':'已登记减压阀阀芯、密封与调压机构的实际处理和装复记录，临时或正式措施按本轮维修作业单分别留存。':task.label.includes('燃油')?'已核对燃油供给状态与喷射指令、响应关系，本轮只处理已确认范围。':'已完成本轮批准的供给通路或维护检查，未纳入范围的项目继续保留。')
 return {...Object.fromEntries(stage.tasks.flatMap((task,index)=>[['task'+index,partial&&index===stage.tasks.length-1?'待补充':'已完成'],['note'+index,partial&&index===stage.tasks.length-1?task.label+'尚未完成；本次作业窗口内未取得完整复测，保留剩余检查并继续安排。':noteFor(task)]])),equipment:item.device,executedAt:local,
  measures:partial?`已完成前序检查和处置记录；${stage.tasks.at(-1)?.label||'剩余工作'}尚未完成，当前只保存进展，不确认整项作业完成。`:measures,acceptance,
  completion:partial?'partial':'completed',verification:key==='unresolved'?'unresolved':key==='pending'||partial?'pending':'resolved',comparable:key==='complete'?'available':'missing',isSimulation:true,sourceCaseId:item.realCaseId,
 }
}
export function realObservationContent(item,type,targetDays){
 if(!item?.realCaseId)return {}
 const p=profileFor(item),window=Number.isFinite(targetDays)?`${targetDays*24} 小时`:'目标'
 return {
  continue:{title:'已有记录，继续核对持续效果',text:`当前记录尚不足以确认 ${window} 观察窗口持续稳定。继续比较 ${p.observe}；逐次注明时间和可比工况，单点恢复不能作为闭环依据。`,next:'补充后续同工况节点；异常反复时转入原事件复查。'},
  extend:{title:'可比资料不足，延长并补齐观察',text:`本轮缺少完整的 ${p.observe} 记录，暂不判断持续效果。说明缺失时段或不可比条件，确认延长后补齐资料；延长安排本身不产生新采样。`,next:'记录缺项和补充安排，再确认延长观察；已有记录保留。'},
  reinspect:{title:'原异常反复，返回同一事件复查',text:`观察中已记录原异常反复，当前不满足闭环条件。${p.recheck}；将异常时刻、工况和前轮措施交回核实，保留本轮观察。`,next:'确认返回排查或评估，前轮记录留存，新一轮独立记录措施与效果。'},
  archive:{title:'观察窗口已覆盖，待人工确认闭环',text:`本轮 ${window} 观察记录已覆盖，已提交资料中未见原异常反复。核对 ${p.observe} 及现场意见后决定闭环；这只结束本轮处理，不代表设备全部健康或未执行需求已完成。`,next:'由人员确认本轮闭环；事件保留执行、验收、观察和未完成需求。'},
 }[type]||{}
}
export function decisionPreset(item,action,assessment){
 if(!item?.realCaseId)return ''
 const records=assessment?.records||[],background=item.initialTitle+(records.length?'；'+shown(records):''),[first,second]=records.map(record=>record.result)
 const endWarning=first==='现场与系统一致'&&second==='工况变化可以解释'?'按工况解释申请结束本次核实；确认解释覆盖两个控制空气进口压力测点低压发生窗口，保留操作时间与原采样。当前恢复不等于永久修复。':'按已核对范围申请结束本轮核实，保留读数差异、缺项及后续安排；不将资料不足或读数不符写成预警误报。'
 const endMaintenance=first==='暂无提前处理必要'?'本轮不提前处理，保留对应气缸周期检查与月度基线跟踪；说明已核实资料如何支持当前安排。':first==='有提前处理依据'?'提前检查需求仍在，受限条件与后续安排继续保留；结束的是本次评估，不填写已执行或无需检修。':'必要性仍未确认，保留缺项与后续核实安排；不因资料不足取消原计划或填写维护已完成。'
 const directions={
  'false-alarm':'申请按误报核实结果结束本次报警。提交前填写具体通道、核对时间、独立核验及判定依据；现有报警与二缸变化本身不支持误报结论，原记录保留。',
  ignore:`本轮不采纳新增人工任务，保留 ${profileFor(item).evidence} 与原跟踪。提交时写明不采纳依据、继续关注内容和再次安排条件；不等于原信号消失或故障已排除。`,
  supplement:`登记新线索，补充来源、发生时刻及与 ${profileFor(item).evidence} 的关联；未核实线索不直接转为维修范围。`,
  'end-warning':endWarning,
  'finish-tracking':first==='现场与系统一致'&&second==='信息已记录'?'本轮月度数据、测温与历史调整已核对，明确解释与未确认范围后结束人工核实，原基线跟踪继续；不直接形成部件更换。':'按已核实范围结束本轮核实，保留未覆盖月份、待补工况和校验记录；原基线跟踪继续，不把原因未知认定为正常。',
  'end-maintenance':endMaintenance,
 }
 return directions[action]?background+'。'+directions[action]:''
}
export function scenarioStatus(store,item){
 const id=item.id
 if(store.eventStatus?.[id]==='closed')return store.completedTasks?.[id]?.title||'本轮已确认闭环'
 if(store.ignoredSuggestions?.[id])return '已记录本次不采纳决定'
 if(store.eventStatus?.[id]==='observing')return '现场工作已提交，持续效果待跟进'
 if(store.todoCreated?.[id])return store.checkAssessments?.[id]?.title||item.stages[store.progress[id]]?.label||'已派发'
 return '待决策'
}
