import {baselineBriefings} from './baselineBriefings.js'
// Curated historical measurements and source excerpts, checked 2026-10-23.
// A briefing describes the evidence available at its decision point. It is not
// a live detector result. Full provenance and cutoff decisions are documented
// in docs/event-content-evidence.md; source measurements remain unchanged.
const alarm = {
 id:'real-alarm-0430',title:'二缸排温偏差伴流量活塞报警，需要核实喷射控制与实际供油',
 evidenceCutoff:'2026-04-30 23:33:00',
 discovery:{kind:'ship-alarm',label:'船端报警 → AI关联研判',at:'2026-04-30 23:27 / 23:33',text:'船端先记录排温偏差及 SLOW DOWN，随后出现二缸流量活塞报警。AI关联同段转速、各缸排温与喷射控制资料，帮助明确现场核实重点。'},
 conclusion:'二缸排气温度与其余气缸明显分离，且伴随流量活塞报警。优先检查二缸喷射控制单元的电缆插接件、流量活塞反馈和伺服油液压活塞动作，并同步核对燃油供给滤器、燃油轨压力与启停时序。',
 facts:[
  {label:'船端报警时序',value:'23:27 → 23:33',unit:'',at:'2026-04-30',meaning:'先出现排温偏差及 SLOW DOWN，6分钟后记录二缸流量活塞报警。',sourceIds:['alarm-log']},
  {label:'二缸排气温度',value:80.4,unit:'°C',at:'2026-04-30 23:32:54',meaning:'该点位于流量活塞报警记录前6秒，保留采样与报警的时间差。',sourceIds:['alarm-readings'],sampleIds:[127128],sensorIds:['DC0009']},
  {label:'其余五缸排气温度',value:'316.9–352.2',unit:'°C',at:'2026-04-30 23:32:54',meaning:'与二缸使用同一采样时刻比较，支持单缸燃烧或喷射响应异常方向。',sourceIds:['alarm-readings'],sampleIds:[127128],sensorIds:['DC0008','DC0010','DC0011','DC0012','DC0013']},
  {label:'同刻主机转速',value:76.1,unit:'RPM',at:'2026-04-30 23:32:54',meaning:'处于重新启动后的运行段，不能直接套用稳定巡航的排温区间。',sourceIds:['alarm-readings'],sampleIds:[127128],sensorIds:['DC0001']},
 ],
 captainDecision:'指定人员核对二缸喷射控制单元、反馈线束与燃油供给滤器，确认停机隔离和现场检查条件。依据插接件检查、活塞动作或供给压降结果，批准对应清洁、连接修复或换件项目。',
 dispatchBrief:{goal:'核实二缸喷射控制及供油状态，为确定后续排查与处置范围提供依据。',expectedFeedback:'提交与报警时刻对应的现场发现、已查范围及未确认项，说明进一步检查的条件。'},
 dispatchReason:'已有船端报警和明确的单缸差异，继续只看趋势无法确认执行机构、反馈链路还是供油问题，需要把系统信号与现场发现对应起来。',
 tasks:[
  {title:'核对报警与二缸 ICU 指令、反馈',detail:'核对23:27及23:33报警记录，分别保存喷射控制单元（ICU）的连接与液压执行状态、喷射控制阀（ICV）的指令及流量活塞反馈；分别记录发现异常、未见异常和无法确认的项目。'},
  {title:'核查燃油供给和运行背景',detail:'对齐同刻燃油轨压力、其他气缸响应与启停记录，说明共同供给问题或操纵变化能否解释二缸差异。'},
  {title:'明确允许的处理范围',detail:'将实际发现、作业条件和仍需补充的资料交由轮机长确认；运行限制下无法完成的项目保留在原事件中。'},
 ],
 branches:[
  {condition:'现场发现明确异常',next:'按已证实的部位确定处置范围，提交实际措施与验收，再进入效果观察。'},
  {condition:'未定位或证据不足',next:'保留检查结果与运行限制，继续补充核实；不为推进流程预定拆检或换件。'},
  {condition:'报警与采集记录存在差异',next:'先核对时间、测点和报警依据，由轮机长确认本次判断；原报警记录保留。'},
 ],
 sources:[
  {id:'alarm-log',title:'二缸报警发生记录',date:'2026-04-30 23:13–23:33',kind:'船端报告',summary:'报警与主机操作记录摘录。',records:[{label:'2026-04-30 23:13',value:'主机停车等待上引水'},{label:'2026-04-30 23:21',value:'主机启动'},{label:'2026-04-30 23:27',value:'主机排温偏差报警，触发 SLOW DOWN'},{label:'2026-04-30 23:33',value:'主机 2#缸流量活塞报警'}]},
  {id:'alarm-readings',title:'二缸与其余气缸同刻运行记录',date:'2026-04-30 23:21:02–23:32:54',kind:'传感器采样',summary:'采集设备：长航碧玉主机。记录内容：主机转速、各缸排温及冷却温度；按各测点原采样时刻列示。'},
 ],
 boundary:'先对齐二缸喷射控制阀指令、流量活塞反馈与排气温度，再检查控制线束和伺服油液压活塞。燃油供给滤器、供油泵与阀位另行核查；具体维修对象以本轮现场检验为依据。',
}

const warning = {
 id:'real-warning-0523',title:'控制空气双测点持续低压，需核实供气和减压环节',
 evidenceCutoff:'2026-05-23 21:28:40',
 discovery:{kind:'ai-data-analysis',label:'AI检测发现',at:'2026-05-23 21:28:40',text:'AI检测发现主机控制空气进口压力连续5次低于0.58 MPa，主机控制空气进口压力（安全监测）同期下降。结合主机转速与燃油指令，建议现场核对两项进口压力，并检查空气减压阀、供气过滤器和管路接头。'},
 conclusion:'主机控制空气进口压力与主机控制空气进口压力（安全监测）同期下降。优先核对主空气瓶和控制空气瓶压力，检查两组空气减压阀的阀芯密封与调压动作，再沿控制空气过滤器、排水阀和管路接头查漏。',
 facts:[
  {label:'主机控制空气进口压力',value:'0.67 → 0.57',unit:'MPa',at:'2026-05-23 20:58:40–21:28:40',meaning:'主机控制空气进口压力在30分钟内下降0.10 MPa；AI检测到末值低于0.58 MPa。现场复核减压阀前后压力及供气状态，验收按本船设定要求执行。',sourceIds:['warning-readings','warning-rule'],sampleIds:[825588,825685],sensorIds:['DC0006']},
  {label:'主机控制空气进口压力（安全监测）',value:'0.64 → 0.54',unit:'MPa',at:'2026-05-23 20:58:40–21:28:40',meaning:'主机控制空气进口压力（安全监测）同期下降0.10 MPa。它与主机控制空气进口压力均位于主机进口监测位置；减压阀前后压力另用对应表计采集。',sourceIds:['warning-readings'],sampleIds:[825588,825685],sensorIds:['DC0007']},
  {label:'连续低压记录',value:5,unit:'个采样点',at:'2026-05-23 21:27:34–21:28:40',meaning:'AI检测发现主机控制空气进口压力连续5点均为0.57 MPa，低于0.58 MPa；主机控制空气进口压力（安全监测）同期均为0.54 MPa。保留发生时刻，供现场表计和用气操作核对。',sourceIds:['warning-readings','warning-rule'],sampleIds:[825681,825682,825683,825684,825685],sensorIds:['DC0006','DC0007']},
  {label:'主机运行工况',value:'102.0–104.4',unit:'RPM',at:'2026-05-23 20:58:40–21:28:40',meaning:'该窗口98个采样时刻，燃油指令（FUEL INDEX U）为37.7%–39.8%；转速和燃油指令变化较小，实际负荷与用气操作仍需核对，不能把燃油指令当作实测负荷。',sourceIds:['warning-readings'],sensorIds:['DC0001','DC0058']},
 ],
 captainDecision:'确认是否立即安排人员核对现场压力、用气操作和减压阀状态；同时明确现场检查条件、负责人及反馈要求。',
 dispatchBrief:{goal:'核实现场低压与用气背景，判断是否需要进一步排查供气、减压或泄漏环节。',expectedFeedback:'提交带时刻的现场压力及用气记录，说明低压是否成立、工况能否解释及未确认项。'},
 dispatchReason:'两个控制空气进口压力测点同期下降，且转速、燃油指令变化较小；仍须对照现场表计和用气记录，区分测量偏差、供气波动、减压失稳与管路泄漏，再判断下一步处置。',
 tasks:[
  {title:'核对压力测点与发生时刻',detail:'分别核对主机控制空气进口压力、主机控制空气进口压力（安全监测）与就地压力表的位置、读数和时刻；另记减压阀前后表计读数。记录一致、读数差异或无法确认。'},
  {title:'核对用气操作和运行工况',detail:'确认发生窗口是否存在杂用空气集中使用、阀门操作或工况切换；解释必须覆盖原低压窗口。'},
  {title:'检查空气减压阀与控制空气供气通路',detail:'低压仍成立时，检查两组减压阀的阀芯、阀座、密封垫和调压弹簧；对控制空气过滤器、排水阀、管路接头分段查漏，记录需清洁或修复的具体位置。'},
 ],
 branches:[
  {condition:'现场一致，且可比工况下低压仍存在',next:'进入原因排查，依据实际发现选择供气、减压或泄漏方向，再确定处置措施。'},
  {condition:'读数不一致或资料不足',next:'继续核对测点与时序，保留当前预警，不把资料缺失当作误报。'},
  {condition:'工况解释有完整依据',next:'由轮机长记录本次核实决定；后续压力回升本身不能倒推原低压没有发生。'},
 ],
 sources:[
  {id:'warning-rule',title:'AI检测关联的控制空气低压记录',date:'2026-05-23 21:28:40',kind:'原始检测记录',summary:'AI检测发现连续低压，原始记录保留测点映射、时间与连续5次低于0.58 MPa的判据。',records:[{label:'检测时间',value:'2026-05-23 21:28:40'},{label:'检测测点',value:'0302 / DC0006 · 主机控制空气进口压力'},{label:'关联测点',value:'0303 / DC0007 · 主机控制空气进口压力（安全）'},{label:'原始判据',value:'0302 连续 5 次检测到数值 <0.58 MPa'}]},
  {id:'warning-readings',title:'控制空气进口压力双测点与运行工况记录',date:'2026-05-23 20:58:40–21:28:40',kind:'传感器采样',summary:'98个采样时刻，包含主机控制空气进口压力、主机控制空气进口压力（安全监测）、主机与增压器转速、燃油指令。'},
 ],
 boundary:'将主机控制空气进口压力、主机控制空气进口压力（安全监测）与独立就地表计对齐；减压阀压降使用阀前后表计另行计算。根据阀芯密封检查、滤器污染和管路查漏结果选择对应清洁或修复项目，完成后保存本轮复测。',
}

export const eventBriefings = {[alarm.id]:alarm,[warning.id]:warning,...baselineBriefings}
export function eventBriefingFor(id){return eventBriefings[String(id||'').replace(/-replay$/,'')]||null}
