import {taskRecommendation,eventSubject,shortSentence} from './contentRecommendations.js'
import {reportSections} from './generatedReport.js'
import {shiftTimelineContent} from './demoTimeline.js'
import {taskExecution} from './taskExecution.js'
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
 const subject=(event.sourceEventId||event.id)==='real-health-c4-baseline'?'四缸相对排温基线下移':'一缸相对排温基线抬升'
 if(trackingNotSupported(event,task))return {
  scope:`本轮核实结论不支持“${subject}”。原月度相对偏差记录保留，按执行人提交的比较条件与核实理由重新评估原提醒。`,
  interpretation:'本轮同工况核实未支持原趋势判断；该结论适用于已提交的比较时段，原月度记录仍保留。',
  next:taskRecommendation(event,task).next
 }
 if(confirmedTracking(event,task))return {
  scope:`本轮现场与系统对应，背景信息已记录，支持${subject}成立；尚未确认部件故障。`,
  interpretation:'本轮测温与系统记录对应，背景核实支持相对变化成立；尚无喷油器或排气阀损坏的检验结论。',
  next:taskRecommendation(event,task).next
 }
 return {
  scope:`本轮已回交${subject}核实资料，原因尚未确认。`,
  interpretation:`现有回交资料尚未将${subject}与测温偏移或运行调整对应，原因仍未定位，不能据此确定故障部件。`,
  next:taskRecommendation(event,task).next
 }
}
export function reportAnalysis(event,task){
 const c=shiftTimelineContent(context[event.sourceEventId||event.id],event.timeline),f=findings(task),isCheck=task.kind==='investigation',tracking=trackingAssessment(event,task),execution=taskExecution(task)
 const interpretation=isCheck?(c?.match.test(evidenceText(task))&&f.abnormal.length?c.interpretation:tracking?.interpretation||`本轮${f.abnormal.length?'登记'+f.abnormal.length+'项异常结果':'未登记异常结果'}，尚未形成${eventSubject(event).name}的部件定位依据。`):`本轮已登记完成${execution.completed.length}项、未完成${execution.outstanding.length}项。复测重点：${c?.retest||eventSubject(event).retest}`
 const missing=nonempty([
  execution.outstanding.length?'未执行项目：'+execution.outstanding.map(r=>r.label+'；'+r.reason).join('。')+'。':'未执行项目：无。',
  f.unknown.filter(r=>!execution.outstanding.some(o=>o.label===r.label)).length?'尚不能确认：'+f.unknown.filter(r=>!execution.outstanding.some(o=>o.label===r.label)).map(r=>r.label+'；'+(r.note||r.result)).join('。')+'。':'',
  f.unnoted.length?'缺少异常部位与检查读数：'+f.unnoted.map(r=>r.label).join('、')+'。':'',
  ...new Set((task.records||[]).filter(r=>!isUnknown(r)).flatMap(r=>String(r.note||'').split(/[。\n]/).filter(s=>/待补充|仍待|资料尚不足|资料不足|缺项|尚缺/.test(s)).slice(0,2)).map(s=>s+'。')),
  execution.summaryBlocked?'作业受阻：'+shortSentence(task.summary)+'。':''
 ])
 const parts={interpretation,unverified:missing,next:taskRecommendation(event,task).next}
 return reportSections.filter(([key])=>key!=='evidence').map(([key,label])=>`### ${label}\n\n${parts[key]}`).join('\n\n')
}
export function reportAnalysisSummary(event,task){
 const f=findings(task),execution=taskExecution(task)
 if(task.kind==='investigation')return `本轮已回交${f.records.length}项检查结果，${f.abnormal.length}项记录异常${f.unknown.length?'，'+f.unknown.length+'项仍待核实':''}。`
 return `本轮完成${execution.completed.length}项，未完成${execution.outstanding.length}项，不适用${execution.notApplicable.length}项。`
}
const briefChecks={
 'real-alarm-0430':'区分二缸喷射指令、反馈与液压动作，核对已定位的卡滞部位及燃油供给检查结果。',
 'real-warning-0523':'核对进口压力与现场表计，确认减压阀密封、调压及供给通路的检查结果。',
 'real-tracking-exhaust-baseline':'核对一缸相对排温抬升是否在同工况下仍成立，结合独立测温、负荷分配与调整记录解释变化。',
 'real-health-c4-baseline':'核对四缸相对基线下移是否成立，区分该缸自身变化、其他缸参照均值变化和工况筛选影响。'
}
export function decisionAnalysisItems(event,task,report){
 if(trackingNotSupported(event,task)){const assessment=trackingAssessment(event,task);return [{label:'本轮趋势判断',text:assessment.scope},{label:'本轮提交结论',text:task.summary},{label:'AI建议',text:assessment.next}]}
 if(confirmedTracking(event,task))return [{label:'本轮趋势判断',text:trackingAssessment(event,task).scope},{label:'AI建议',text:taskRecommendation(event,task).next}]
 if(!report?.analysisMarkdown)return [{label:'本轮判断',text:report?.analysis||event.brief.conclusion}]
 return report.analysisMarkdown.split(/(?:^|\n)### /).filter(Boolean).map(section=>{
  const [label,...lines]=section.split('\n');return {label:label.replace(/AI后续建议|建议处置|后续建议/,'AI建议').replace(/^(?:AI分析[（(]原因与措施判断[）)]|原因解释与措施判断)$/,'原因与措施判断'),text:lines.filter(Boolean).join(' ')}
 })
}
export function decisionBasis(event,action){
 if(event.phase==='reminder')return {points:event.brief.captainDecision,reason:event.brief.dispatchReason}
 const task=event.tasks.find(t=>t.id===event.currentTask)||event.observationSource?.task,report=event.reports.findLast(r=>r.taskId===task?.id)
 const check=event.type==='效果观察'?`对照${eventSubject(event).retest}在原异常窗口与本轮的同工况记录，确认变化是否消除。`:briefChecks[event.sourceEventId||event.id]||'核对实际发现、处理范围与复测条件。'
 const sentences=report?.summary?.split(/(?<=[。！？])/).filter(Boolean)||[]
 const conclusion=event.tracking?report?.summary||task?.summary||'':(task?.kind==='investigation'?sentences[0]:sentences.findLast(sentence=>/复测|稳定|原报警|原低压|偏差|恢复/.test(sentence)))||sentences[0]||''
 const source=report?`第${task.round}轮${report.kind}已回交。${conclusion}`:task?.status==='assigned'?`${task.owner}正在执行本轮任务，报告尚未回交。`:'以原始提醒及已有轮次记录为依据。'
 const points={
  wait:'保留原任务及已完成记录，写明受阻项目、原因和需要具备的条件；等待期间不重复催办。',
  resume:'确认备件、停机和作业许可等条件已具备，设置新的完成时限，在原任务上补充剩余反馈。',
  terminate:'说明终止未执行部分的依据、残余风险和后续安排；终止任务不等于事件闭环。',
  observe:`记录${eventSubject(event).name}的观察信号、适用工况与汇报时间。`,
  investigate:`${check} 针对剩余缺口安排补查，指定负责人和回交时限。`,
  repair:'按排查确认的具体部位批准维修，明确隔离、材料和复测要求；未定位的部件不随同换件。',
  maintenance:'确认本轮校验或保养项目、关联工单及靠港停机窗口。',
  shore:'明确需要岸基提供的技术、备件或计划支持，附上关联报告及船上当前措施。',
  close:event.tracking?'对照原相对排温变化与本轮核实结论，说明提醒是否已得到解释、仍有哪些限制和后续跟踪安排；无需把未发生的维修写入闭环依据。':'核对原报警／预警、本轮检查及实际措施是否对应，说明结束依据与后续监测安排；未实施维修时如实保留。',
  recheck:`复核${eventSubject(event).retest}，记录原异常是否再现。`
 }[action]||check
 return {points,reason:source}
}
function timestamp(value){
 const text=String(value||'').replace(' ','T')
 return Date.parse(/Z$|[+-]\d\d:\d\d$/.test(text)?text:text+'+08:00')
}
export function adviceDetails(event,message,role){
 const c=shiftTimelineContent(context[event.sourceEventId||event.id],event.timeline),cutoff=timestamp(message.at)
 const task=[...(event.tasks||[])].reverse().find(t=>timestamp(t.assignedAt)<=cutoff)
 const submitted=task?.status==='submitted'&&timestamp(task.submittedAt)<=cutoff
 const facts=(event.brief.facts||[]).slice(0,2).map(f=>`- ${f.label}：${f.value}${f.unit?' '+f.unit:''}（${f.at||event.brief.discovery.at}）`).join('\n')
 const records=submitted?(task.records||[]).filter(r=>isAbnormal(r)||isUnknown(r)).slice(0,2).map(r=>`- ${r.label}：${r.result}${r.note?'；'+shortSentence(r.note):''}`).join('\n'):''
 const sources=(event.brief.sources||[]).slice(0,2).map(s=>s.title+' · '+s.date).join('；')
 const gap=submitted?taskRecommendation(event,task).reason+'。':task?'本轮现场结果尚未提交。':'尚缺现场表计或独立校验记录。'
 return nonempty([c?.comparison,records||facts,'待核实：'+gap,sources?'来源：'+sources:''])
}
