import {baselineBriefings} from './baselineBriefings.js'
// Curated historical measurements and source excerpts, checked 2026-10-23.
// A briefing describes the evidence available at its decision point. It is not
// a live detector result. Full provenance and cutoff decisions are documented
// in docs/event-content-evidence.md; source measurements remain unchanged.
const alarm = {
 id:'real-alarm-0430',title:'二缸排温偏差伴流量活塞报警，需要核实喷射控制与实际供油',
 evidenceCutoff:'2026-04-30 23:33:00',
 discovery:{kind:'ship-alarm',label:'船端报警 → AI关联研判',at:'2026-04-30 23:27 / 23:33',text:'船端先记录排温偏差及 SLOW DOWN，随后出现二缸流量活塞报警。AI关联同段转速、各缸排温与喷射控制资料，帮助明确现场核实重点。'},
 conclusion:'二缸排温与其余气缸明显分离，且伴随流量活塞报警，需优先核实二缸喷射控制及实际供油；当前证据尚不能确定具体失效部件。',
 facts:[
  {label:'船端报警时序',value:'23:27 → 23:33',unit:'',at:'2026-04-30',meaning:'先出现排温偏差及 SLOW DOWN，6分钟后记录二缸流量活塞报警。',sourceIds:['alarm-log']},
  {label:'二缸排气温度',value:80.4,unit:'°C',at:'2026-04-30 23:32:54',meaning:'该点位于流量活塞报警记录前6秒，保留采样与报警的时间差。',sourceIds:['alarm-readings'],sampleIds:[127128],sensorIds:['DC0009']},
  {label:'其余五缸排气温度',value:'316.9–352.2',unit:'°C',at:'2026-04-30 23:32:54',meaning:'与二缸使用同一采样时刻比较，支持单缸燃烧或喷射响应异常方向。',sourceIds:['alarm-readings'],sampleIds:[127128],sensorIds:['DC0008','DC0010','DC0011','DC0012','DC0013']},
  {label:'同刻主机转速',value:76.1,unit:'RPM',at:'2026-04-30 23:32:54',meaning:'处于重新启动后的运行段，不能直接套用稳定巡航的排温区间。',sourceIds:['alarm-readings'],sampleIds:[127128],sensorIds:['DC0001']},
 ],
 captainDecision:'确认当前运行限制与现场检查条件，指定人员核对报警、二缸喷射控制指令和反馈；在定位前，不直接批准更换某个部件。',
 dispatchBrief:{goal:'核实二缸喷射控制及供油状态，为确定后续排查与处置范围提供依据。',expectedFeedback:'提交与报警时刻对应的现场发现、已查范围及未确认项，说明进一步检查的条件。'},
 dispatchReason:'已有船端报警和明确的单缸差异，继续只看趋势无法确认执行机构、反馈链路还是供油问题，需要把系统信号与现场发现对应起来。',
 tasks:[
  {title:'核对报警与二缸 ICU 指令、反馈',detail:'核对23:27及23:33报警记录，保存流量活塞反馈、ICV控制、ICU连接与液压执行状态；分别记录发现异常、未见异常和无法确认的项目。'},
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
 boundary:'排温差异支持二缸异常方向，但不能单独区分电气控制、反馈或液压执行故障；当前判断不包含后续拆检结论。',
}

const warning = {
 id:'real-warning-0523',title:'控制空气双测点持续低压，需核实供气和减压环节',
 evidenceCutoff:'2026-05-23 21:28:40',
 discovery:{kind:'ai-data-analysis',label:'AI数据分析发现',at:'2026-05-23 21:28:40',text:'AI结合连续低压规则、两个压力测点和同段运行工况形成预警：主测点连续5次低于0.58 MPa，安全测点同步下降。'},
 conclusion:'控制空气双测点在稳定运行段同步下降，低压事实有相互印证；应先现场核实供气、减压与泄漏情况，尚不能锁定故障部件。',
 facts:[
  {label:'控制空气进口压力',value:'0.67 → 0.57',unit:'MPa',at:'2026-05-23 20:58:40–21:28:40',meaning:'30分钟内主测点下降0.10 MPa；当前末值低于本次规则的0.58 MPa门槛。',sourceIds:['warning-readings','warning-rule'],sampleIds:[825588,825685],sensorIds:['DC0006']},
  {label:'安全测点压力',value:'0.64 → 0.54',unit:'MPa',at:'2026-05-23 20:58:40–21:28:40',meaning:'安全测点同期下降0.10 MPa，支持系统压力共同变化，仍需现场表计核对。',sourceIds:['warning-readings'],sampleIds:[825588,825685],sensorIds:['DC0007']},
  {label:'连续低压记录',value:5,unit:'个采样点',at:'2026-05-23 21:27:34–21:28:40',meaning:'主测点5点均为0.57 MPa、安全测点均为0.54 MPa；符合连续5次低于0.58 MPa的配置规则。',sourceIds:['warning-readings','warning-rule'],sampleIds:[825681,825682,825683,825684,825685],sensorIds:['DC0006','DC0007']},
  {label:'主机运行工况',value:'102.0–104.4',unit:'RPM',at:'2026-05-23 20:58:40–21:28:40',meaning:'该窗口98个采样时刻；燃油指令37.7%–39.8%，未见启停或明显负荷突变。',sourceIds:['warning-readings'],sensorIds:['DC0001','DC0058']},
 ],
 captainDecision:'确认是否立即安排人员核对现场压力、用气操作和减压阀状态；同时明确现场检查条件、负责人及反馈要求。',
 dispatchBrief:{goal:'核实现场低压与用气背景，判断是否需要进一步排查供气、减压或泄漏环节。',expectedFeedback:'提交带时刻的现场压力及用气记录，说明低压是否成立、工况能否解释及未确认项。'},
 dispatchReason:'两路低压与稳定运行背景相互印证，已不宜仅凭单点误差解释；现场反馈才能区分供气波动、减压失稳与管路泄漏，并判断下一步处置。',
 tasks:[
  {title:'核对压力测点与发生时刻',detail:'核对主测点、安全测点及现场表计的位置、读数与时间，记录一致、读数差异或无法确认。'},
  {title:'核对用气操作和运行工况',detail:'确认发生窗口是否存在杂用空气集中使用、阀门操作或工况切换；解释必须覆盖原低压窗口。'},
  {title:'按核实结果检查供气与减压环节',detail:'低压仍成立时，沿原事件核查供气条件、减压阀出口与调节状态、管路及接头漏气情况；保存已查和未查范围。'},
 ],
 branches:[
  {condition:'现场一致，且可比工况下低压仍存在',next:'进入原因排查，依据实际发现选择供气、减压或泄漏方向，再确定处置措施。'},
  {condition:'读数不一致或资料不足',next:'继续核对测点与时序，保留当前预警，不把资料缺失当作误报。'},
  {condition:'工况解释有完整依据',next:'由轮机长记录本次核实决定；后续压力回升本身不能倒推原低压没有发生。'},
 ],
 sources:[
  {id:'warning-rule',title:'控制空气连续低压规则与触发记录',date:'2026-05-23 21:28:40',kind:'规则触发记录',summary:'连续低压规则配置与触发记录。',records:[{label:'触发时间',value:'2026-05-23 21:28:40'},{label:'触发测点',value:'0302 / DC0006 · 主机控制空气进口压力'},{label:'关联测点',value:'0303 / DC0007 · 主机控制空气进口压力（安全）'},{label:'规则条件',value:'0302 连续 5 次检测到数值 <0.58 MPa'}]},
  {id:'warning-readings',title:'控制空气双测点与运行工况记录',date:'2026-05-23 20:58:40–21:28:40',kind:'传感器采样',summary:'98个采样时刻，包含双路压力、主机与增压器转速、燃油指令。'},
 ],
 boundary:'压力变化需要与现场表计和用气背景核对；模型信号或后续压力回升均不能替代原因确认及维修完成记录。',
}

export const eventBriefings = {[alarm.id]:alarm,[warning.id]:warning,...baselineBriefings}
export function eventBriefingFor(id){return eventBriefings[String(id||'').replace(/-replay$/,'')]||null}
