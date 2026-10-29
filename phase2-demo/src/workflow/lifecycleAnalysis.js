// User-facing evidence summaries. These describe source records and submitted
// findings; they do not claim access to hidden model reasoning or new readings.
import {hasAbnormalFindings} from './lifecycleDecisions.js'
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
export function reportAnalysis(event,task){
 const c=context[event.id],f=findings(task),isCheck=task.kind==='investigation',text=evidenceText(task)
 const scope=isCheck
  ? (f.abnormal.length?`现场结果中 ${f.abnormal.length} 项登记异常或持续偏离：${f.abnormal.map(r=>r.label+'（'+r.result+'）').join('；')}。`:'本轮未在逐项结果中登记明确异常部件，结论需结合实际备注与已检查范围审阅。')
  : `本轮 ${f.records.length} 项作业中，${f.records.filter(r=>r.result==='已完成').length} 项已完成，${f.records.filter(r=>r.result==='未完成').length} 项未完成，${f.records.filter(r=>r.result==='不适用').length} 项不适用。逐项完成状态与总结果一起作为回交依据。`
 const interpretation=isCheck?(c?.match.test(text)?c.interpretation:c?.branches):`将本轮措施与批准范围逐项对应，再核对复测条件和剩余问题。${c?.retest||''}“已完成”表示该项工作被登记完成，设备恢复与闭环仍需轮机长结合复测记录确认。`
 const missing=nonempty([
  f.unknown.length?`仍需落实：${f.unknown.map(r=>r.label+'（'+r.result+'）').join('；')}。这些项目不能视为已检查通过。`: '逐项结果未登记未完成或无法确认事项；这一状态仅覆盖本轮提交范围。',
  f.unnoted.length?`以下异常项未填写单项备注：${f.unnoted.map(r=>r.label).join('、')}。应从总论或附件确认具体部位与检查依据，派发维修前核清具体部位，未核准部分不得施工。`:'',
  task.attachments?.length?`本轮关联 ${task.attachments.length} 份附件，按文件名保留索引；附件有效性由审阅人核对。`:'本轮未关联附件；分析依据为已提交的文字记录，未增加未上传的照片或检测读数。'
 ])
 const next=isCheck?(f.abnormal.length?'本轮已登记异常，优先派发维修。维修前核对异常具体部位、隔离条件与批准范围，未定位的部件不随同换件。':task.purpose==='recheck'?'本轮复查未登记异常，结合处理后观察和复测依据决定闭环；仍有待核实事项时再次复查。':'本轮未登记异常，继续排查。AI 依据本轮已核实范围、排除项和剩余资料缺口预生成下一轮任务，避免重复相同检查。'):'对照本轮实际措施、处理后采样和现场复测，决定闭环或派发复查。未完成项与异常再现情况应纳入复查范围。'
 return `### 证据与范围核对\n\n${scope}\n\n### ${isCheck?'原因解释与检查方向':'措施对应与复测判断'}\n\n${interpretation}\n\n### 待核实事项\n\n${missing}\n\n### 建议处置\n\n${next}`
}
export function reportAnalysisSummary(event,task){
 const f=findings(task)
 if(task.kind==='investigation')return `本轮排查已回交${f.records.length}项结果，${f.abnormal.length}项登记异常或持续偏离${f.unknown.length?'，'+f.unknown.length+'项仍待核实':''}。${task.summary} 建议对照具体检查依据确认下一步范围。`
 return `本轮已提交${f.records.filter(r=>r.result==='已完成').length}/${f.records.length}项完成记录。${task.summary} ${f.unknown.length?'仍有未完成项目，请明确接续安排。':'请核对复测条件、剩余事项及设备安全影响后决定闭环。'}`
}
const briefChecks={
 'real-alarm-0430':'区分二缸喷射指令、反馈与液压动作，核对已定位的卡滞部位及燃油供给检查结果。',
 'real-warning-0523':'核对进口压力与现场表计，确认减压阀密封、调压及供给通路的检查结果。',
 'real-tracking-exhaust-baseline':'对照独立测温、月度工况与喷油器检验，明确一缸持续偏高的处理范围。',
 'real-health-c4-baseline':'对照端子连接、独立校验和调整履历，区分测温链路问题与真实燃烧变化。'
}
export function decisionAnalysisItems(event,task,report){
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
 const conclusion=(task?.kind==='investigation'?sentences[0]:sentences.findLast(sentence=>/复测|稳定|原报警|原低压|偏差|恢复/.test(sentence)))||sentences[0]||''
 const source=report?`第${task.round}轮${report.kind}已回交。${conclusion}`:task?.status==='assigned'?`${task.owner}正在执行本轮任务，报告尚未回交。`:'以原始提醒及已有轮次记录为依据。'
 const points={
  investigate:`${check} 针对剩余缺口安排补查，指定负责人和回交时限。`,
  repair:'按排查确认的具体部位批准维修，明确隔离、材料和复测要求；未定位的部件不随同换件。',
  maintenance:'将已确认的检查和处理范围关联到维保工单，落实负责人、靠港窗口及复测要求。',
  shore:'明确需要岸基提供的技术、备件或计划支持，附上关联报告及船上当前措施。',
  close:'核对原因、实际措施和复测结果是否对应，说明设备安全影响及后续监测安排。',
  recheck:'根据维修结果、剩余事项和处理后趋势复查，记录原异常是否再现；复查任务可提前审阅并通过对话修改。'
 }[action]||(event.phase==='review'?'对照作业报告、处理后采样与现场复测，确认原异常是否再现，决定闭环或派发复查。':hasAbnormalFindings(task)?'本轮已有异常，先维修。请审阅待派发维修任务，确认处理对象、隔离与复测要求。':'本轮未登记异常，继续排查。AI 根据已排除的问题点和剩余线索预生成后续任务，审阅后再派发。')
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

