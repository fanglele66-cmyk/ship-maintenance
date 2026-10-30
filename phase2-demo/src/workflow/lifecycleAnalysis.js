// User-facing evidence summaries. These describe source records and submitted
// findings; they do not claim access to hidden model reasoning or new readings.
import {hasAbnormalFindings,confirmedTracking,trackingNotSupported} from './lifecycleDecisions.js'
import {isVerificationReview} from './observationContext.js'
const context = {
 'real-alarm-0430': {
  comparison:'先对齐 23:27 的排温偏差、SLOW DOWN 与 23:33 的二缸流量活塞报警。二缸排温和其他气缸应使用同一采样时刻，并保留重新启动的工况背景。',
  branches:'分别核查喷射控制指令与反馈、电缆插接件和伺服油液压活塞动作，再核对共同燃油供给。单缸温差支持检查方向，不能单独代替 ICU 或 ICV 的部件检验。',
  match:/卡滞/,
  interpretation:'现场记录的液压活塞卡滞与二缸喷射执行响应异常方向相符。应把卡滞位置、动作检查和指令/反馈记录对应起来；若插接件和供给通路未见异常，本轮处理范围可集中于已发现卡滞的液压机构。',
  action:'建议由轮机长批准清洁及动作复验范围；清洁复验仍不合格时，再依据批准内容换装适配 ICU，记录接口、密封、喷射指令与反馈复测。未有检查依据的 ICV 和供给部件不随同换件。',
  retest:'核对二缸指令与流量活塞反馈、接口密封、原报警是否复现，并记录同刻六缸排温、转速和试验工况。'
 },
 'real-warning-0523': {
  comparison:'主机控制空气进口压力连续 5 次低于 0.58 MPa，安全监测通道同期下降。两个通道都是主机进口压力，不能用两者之差代替减压阀前后压降。',
  branches:'先把两个进口压力通道与就地表计按时刻对应，核对空气瓶压力和集中用气记录，再检查减压阀阀芯密封、调压动作、过滤器及管路接头。',
  match:/密封.*(破损|老化)|阀芯.*(破损|老化)/,
  interpretation:'现场提交的减压阀密封缺陷为低压变化提供了具体检查对象。将密封检查结果与阀前后表计、供气和用气记录结合判断；若其他供给检查未见异常，可优先处理已定位的密封部位。',
  action:'建议批准隔离卸压、更换经检查确认失效的适配密封件、复装及调压检查。处理对象和材料应对应本轮检查记录，复测压力保持并与两个进口压力通道同步对照。',
  retest:'记录减压阀前后就地压力、主机控制空气进口压力及安全监测压力、调压动作、泄漏检查和压力保持结果，采用本机规定的设定要求。'
 },
 'real-tracking-exhaust-baseline': {
  comparison:'比较一缸与其余五缸同刻均值的月度相对偏差，同时核对负荷、燃油、最高燃烧压力及期间调整。单次温度正常不能否定跨月相对抬升。',
  branches:'先排除探头、端子和采集链路偏移，再核对独立测温、燃烧平衡及喷油器检验。只有资料和现场检查对应时，才确定专项维保对象。',
  match:/积碳|雾化不良/,
  interpretation:'提交的喷嘴积碳、雾化不良记录为一缸燃烧差异提供了现场依据。需要与独立测温及同工况比较一起保留；既有趋势不能单独证明喷油器或排气阀均有故障。',
  action:'建议关联一缸专项维保单，按已提交的喷油器检验结果批准清洁与复验范围。雾化、启喷及密封检验合格后装复，并保留六缸同工况响应；排气阀是否处理另依据其检查结果。',
  retest:'保留独立测温、喷油器清洁前后检验、接口密封及六缸同工况记录。完成本轮作业后，月度相对排温仍继续跟踪。'
 },
 'real-health-c4-baseline': {
  comparison:'四缸相对其余五缸均值在 5—6 月间下移，后续月份仍偏低；这与绝对排温持续下降不是同一个判断。首轮已核实范围和未解释部分应延续保留。',
  branches:'核对四缸探头端子、极性、屏蔽和独立校验，再与燃油分配、最高燃烧压力及调整履历交叉比较，区分测量链路问题与真实燃烧变化。',
  match:/端子.*松动|连接.*松动/,
  interpretation:'现场记录的探头端子松动及独立校验异常支持优先处理测量连接。该发现解释的是已查测温链路，不能由此认定喷油器或排气阀存在缺陷，也不能推定未检查部件均正常。',
  action:'建议关联四缸维保单，批准恢复端子连接、核对极性与屏蔽、独立校验和通道对应复核。保留处理前后读数，后续用同工况记录判断相对偏差变化。',
  retest:'核对端子连接、极性与屏蔽、独立校验和同工况测量稳定性，保留原始月度趋势与处理前后记录。'
 }
}
const nonempty = values => values.filter(Boolean).join('\n\n')
const evidenceText = task => [task.summary,...(task.records||[]).map(r=>r.note)].filter(Boolean).join('；')
const isAbnormal = r => /发现异常|读数不一致|偏离仍存在/.test(r.result)
const isUnknown = r => /无法确认|受限|未完成/.test(r.result)
function findings(task){
 const records=task.records||[],abnormal=records.filter(isAbnormal),unknown=records.filter(isUnknown),unnoted=records.filter(r=>isAbnormal(r)&&!r.note?.trim())
 return {abnormal,unknown,unnoted,records}
}
export function trackingAssessment(event,task){
 if(!event.tracking||task?.kind!=='investigation')return null
 const subject=event.id==='real-health-c4-baseline'?'四缸相对排温基线下移':'一缸相对排温基线抬升'
 if(trackingNotSupported(event,task))return {
  scope:`本轮核实结论不支持“${subject}”。原月度相对偏差记录保留，按执行人提交的比较条件与核实理由重新评估原提醒。`,
  interpretation:'核对同转速、同负荷的六缸对比、测温来源和期间调整记录，说明原相对变化由什么解释，以及本轮结论适用的时间与工况范围。现场读数对应不等同于跨月基线变化已经证实。',
  next:'若本轮依据已足以解释原提醒，可说明依据后闭环；仍需看变化是否再次出现，可继续观察。仅在比较口径或关键记录仍有缺口时选择继续排查，不据此安排部件维修。'
 }
 if(confirmedTracking(event,task))return {
  scope:`本轮现场与系统对应，背景信息已记录，支持继续跟踪${subject}；这与确认部件故障是两类判断。`,
  interpretation:'将同工况六缸相对变化与测温校验、负荷分配和调整记录对应，明确适合提前执行的维保项目；不从排温偏差直接推定喷油器或排气阀损坏。',
  next:'可选择适用维保计划和靠港时间提前执行；若本轮暂不处置，可记录依据后继续观察。'
 }
 return {
  scope:`本轮已回交${subject}的核实资料。原相对变化记录保留，是否属于该缸自身基线变化及其解释仍需结合本轮结论判断；尚缺的比较条件和原因依据继续留存。`,
  interpretation:context[event.id]?.comparison+' 对照本轮已取得的工况、调整与测温记录，指出哪些变化已有解释、哪些比较条件仍缺失。',
  next:'若现有资料不足以解释原变化，可围绕同工况六缸对比、独立测温或调整记录补充核实；若已有充分解释，可说明依据后闭环，也可选择继续观察。'
 }
}
export function reportAnalysis(event,task){
 const c=context[event.id],f=findings(task),isCheck=task.kind==='investigation',text=evidenceText(task),tracking=trackingAssessment(event,task)
 const scope=isCheck
  ? (tracking?tracking.scope:f.abnormal.length?`现场结果中 ${f.abnormal.length} 项登记异常或持续偏离：${f.abnormal.map(r=>r.label+'（'+r.result+'）').join('；')}。`:'本轮检查尚未定位原报警／预警的具体原因；需对照已查项目、报警是否再现及剩余线索判断下一步。')
  : `本轮 ${f.records.length} 项作业中，${f.records.filter(r=>r.result==='已完成').length} 项已完成，${f.records.filter(r=>r.result==='未完成').length} 项未完成，${f.records.filter(r=>r.result==='不适用').length} 项不适用。逐项完成状态与总结果一起作为回交依据。`
 const interpretation=isCheck?(c?.match.test(text)&&f.abnormal.length?c.interpretation:tracking?.interpretation||c?.branches):`将本轮措施与批准范围逐项对应，再核对复测条件和剩余问题。${c?.retest||''}“已完成”表示该项工作被登记完成，设备恢复与闭环仍需轮机长结合复测记录确认。`
 const missing=nonempty([
  f.unknown.length?`仍需落实：${f.unknown.map(r=>r.label+'（'+r.result+'）').join('；')}。这些项目不能视为已检查通过。`: '逐项结果未登记未完成或无法确认事项；这一状态仅覆盖本轮提交范围。',
  f.unnoted.length?`以下异常项未填写单项备注：${f.unnoted.map(r=>r.label).join('、')}。应从总论或附件确认具体部位与检查依据，派发维修前核清具体部位，未核准部分不得施工。`:'',
  task.attachments?.length?`本轮关联 ${task.attachments.length} 份附件，按文件名保留索引；附件有效性由审阅人核对。`:'本轮未关联附件；分析依据为已提交的文字记录，未增加未上传的照片或检测读数。'
 ])
 const next=isCheck?(f.abnormal.length&&!confirmedTracking(event,task)?'本轮记录了具体异常表现，先核对问题部位及处理依据；需要维修时，选择派发维修并审阅 AI 建议，未定位的部件不随同换件。':tracking?.next||(task.purpose==='recheck'?'本轮复查未记录原异常再现，结合观察和复测依据决定闭环；仍有待核实事项时再明确复查范围。':'本轮检查尚未定位原因。原报警／预警仍有疑点时可选择继续排查，AI 再据已查范围与剩余线索整理建议；原现象已回落时也可继续观察或说明依据后闭环。')):'对照本轮实际措施、处理后采样和现场复测，决定闭环、继续观察或派发复查。未完成项与异常再现情况应纳入后续安排。'
 return `### 证据与范围核对\n\n${scope}\n\n### ${isCheck?'原因解释与检查方向':'措施对应与复测判断'}\n\n${interpretation}\n\n### 待核实事项\n\n${missing}\n\n### 建议处置\n\n${next}${isCheck?' 轮机长也可说明暂不处置的依据，选择核实后继续观察，跟踪变化是否持续、扩大、恢复或复发。':''}`
}
export function reportAnalysisSummary(event,task){
 const f=findings(task)
 if(event.tracking&&task.kind==='investigation')return `${trackingAssessment(event,task).scope} 本轮提交结论：${task.summary}`
 if(task.kind==='investigation')return `本轮排查已回交${f.records.length}项结果，${f.abnormal.length}项登记异常或持续偏离${f.unknown.length?'，'+f.unknown.length+'项仍待核实':''}。${task.summary} 建议对照具体检查依据确认下一步范围。`
 return `本轮已提交${f.records.filter(r=>r.result==='已完成').length}/${f.records.length}项完成记录。${task.summary} ${f.unknown.length?'仍有未完成项目，请明确接续安排。':'请核对复测条件、剩余事项及设备安全影响后决定闭环。'}`
}
const briefChecks={
 'real-alarm-0430':'区分二缸喷射指令、反馈与液压动作，核对已定位的卡滞部位及燃油供给检查结果。',
 'real-warning-0523':'核对进口压力与现场表计，确认减压阀密封、调压及供给通路的检查结果。',
 'real-tracking-exhaust-baseline':'核对一缸相对排温抬升是否在同工况下仍成立，结合独立测温、负荷分配与调整记录解释变化。',
 'real-health-c4-baseline':'核对四缸相对基线下移是否成立，区分该缸自身变化、其他缸参照均值变化和工况筛选影响。'
}
export function decisionAnalysisItems(event,task,report){
 if(trackingNotSupported(event,task)){const assessment=trackingAssessment(event,task);return [{label:'本轮趋势判断',text:assessment.scope},{label:'本轮提交结论',text:task.summary},{label:'建议处置',text:assessment.next}]}
 if(confirmedTracking(event,task))return [{label:'异动已核实',text:'本轮现场与系统一致，背景信息已记录，支持异动成立。可选择适用维保计划和靠港时间提前执行；具体部件原因仍以现场检查为准。'},{label:'本轮提交结论',text:task.summary}]
 if(!report?.analysisMarkdown)return [{label:'本轮判断',text:report?.analysis||event.brief.conclusion}]
 return report.analysisMarkdown.split(/(?:^|\n)### /).filter(Boolean).map(section=>{
  const [label,...lines]=section.split('\n');return {label,text:lines.filter(Boolean).join(' ')}
 }).filter(item=>item.label!=='待核实事项')
}
export function decisionBasis(event,action){
 if(event.phase==='reminder')return {points:event.brief.captainDecision,reason:event.brief.dispatchReason}
 const task=event.tasks.find(t=>t.id===event.currentTask),report=event.reports.findLast(r=>r.taskId===task?.id)
 const check=briefChecks[event.id]||'核对实际发现、处理范围与复测条件。'
 const sentences=report?.summary?.split(/(?<=[。！？])/).filter(Boolean)||[]
 const conclusion=event.tracking?report?.summary||task?.summary||'':(task?.kind==='investigation'?sentences[0]:sentences.findLast(sentence=>/复测|稳定|原报警|原低压|偏差|恢复/.test(sentence)))||sentences[0]||''
 const source=report?`第${task.round}轮${report.kind}已回交。${conclusion}`:task?.status==='assigned'?`${task.owner}正在执行本轮任务，报告尚未回交。`:'以原始提醒及已有轮次记录为依据。'
 const points={
  observe:'结合现场核实结果，说明暂不处置的依据与后续关注点；持续跟踪变化是否扩大、恢复或复发，观察期内可重新决定下一步。',
  investigate:`${check} 针对剩余缺口安排补查，指定负责人和回交时限。`,
  repair:'按排查确认的具体部位批准维修，明确隔离、材料和复测要求；未定位的部件不随同换件。',
  maintenance:'选择适用维保计划和靠港检修窗口，提前派发给轮机员按计划执行，汇报后审阅闭环。',
  shore:'明确需要岸基提供的技术、备件或计划支持，附上关联报告及船上当前措施。',
  close:event.tracking?'对照原相对排温变化与本轮核实结论，说明提醒是否已得到解释、仍有哪些限制和后续跟踪安排；无需把未发生的维修写入闭环依据。':'核对原报警／预警、本轮检查及实际措施是否对应，说明结束依据与后续监测安排；未实施维修时如实保留。',
  recheck:isVerificationReview(event)?'根据已核实范围和持续观察记录，复查变化是否持续、扩大、恢复或复发；本轮暂未处置，不预设维修已完成。':'根据维修结果、剩余事项和处理后趋势复查，记录原异常是否再现；复查任务可提前审阅并通过对话修改。'
 }[action]||(isVerificationReview(event)?'对照排查报告与观察变化，有处理依据可派发维修，需要补证可派发复查；原异常回落且无复发可确认闭环，也可继续观察。':event.phase==='review'?'对照作业报告、处理后采样与现场复测，确认原异常是否再现，决定闭环或派发复查。':trackingAssessment(event,task)?.next||(hasAbnormalFindings(task)?'本轮已有异常，优先核对处理范围并维修；若决定暂不处置，可说明依据后继续观察。':'本轮尚未定位原报警／预警的具体原因，可针对剩余线索继续排查，或说明依据后继续观察；有结束依据时人工闭环。'))
 return {points,reason:source}
}
function timestamp(value){
 const text=String(value||'').replace(' ','T')
 return Date.parse(/Z$|[+-]\d\d:\d\d$/.test(text)?text:text+'+08:00')
}
export function adviceDetails(event,message,role){
 const c=context[event.id],cutoff=timestamp(message.at)
 // Historical advice only sees records available by the message timestamp.
 const task=[...event.tasks].reverse().find(t=>timestamp(t.assignedAt)<=cutoff)
 const submitted=task?.status==='submitted'&&timestamp(task.submittedAt)<=cutoff
 const facts=event.brief.facts.map(f=>`- **${f.label}：${f.value}${f.unit?' '+f.unit:''}**。${f.meaning}（${f.at||event.brief.discovery.at}）`).join('\n')
 const sources=event.brief.sources.map(s=>`- ${s.title} · ${s.date} · ${s.kind}`).join('\n')
 const taskContent=task?`本轮责任人：${task.owner}；安排范围：${task.scope}\n\n`+(submitted?`已提交的现场结论：${task.summary}\n\n${task.records.map(r=>`- **${r.label}：${r.result}**。${r.note||'未填写单项备注；以本轮结论和已有材料核对。'}`).join('\n')}`:`尚未收到本轮执行报告，以下为要求取得的检查信息：\n\n${task.steps.map(s=>`- **${s.label}**：${s.guide||s.recordHint||'提交该项实际结果和检查范围。'}`).join('\n')}`):'当前依据来自提醒发生窗口，尚无本轮现场排查结果。优先安排现场核实，反馈应对应具体部位、方法与发生时刻。'
 return `### 1. 提醒的原始依据\n\n${event.brief.discovery.text}\n\n${facts}\n\n### 2. 对齐工况与比较条件\n\n${c?.comparison||event.brief.boundary}\n\n### 3. ${submitted?'现场反馈如何支持判断':'需要区分的检查方向'}\n\n${submitted?reportAnalysis(event,task).replaceAll('### ','#### '):c?.branches||event.brief.conclusion}\n\n### 4. 本轮任务与证据状态\n\n${taskContent}\n\n### 5. 建议动作及交回条件\n\n${message.recommendation}\n\n${role==='engineer'?'按批准范围记录实际结果；无法确认的项目注明缺口，报告提交后等待轮机长处置。':'审阅记录后确认范围与安全影响；继续排查或安排作业时指定负责人和完成时限。'}\n\n### 6. 来源与判断边界\n\n${sources}\n\n${event.brief.boundary}`
}

