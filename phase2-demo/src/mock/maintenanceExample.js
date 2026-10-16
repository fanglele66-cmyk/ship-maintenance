import {cruiseMotion} from './cruiseMotion.js'
// Real-extracted point baselines are allowed by the user. History, findings and reports below are fictional demo records.
export const maintenanceExample={
 id:'injector-3-cleaning',sourceEventId:'drift',sourceAttentionId:'drift',deviceId:'main-engine-1',device:'主机 · 3#缸喷油器',
 title:'主机3号缸喷油器提前清洁与复校建议',
 provenance:'真实CSV提取中心值：DC0010 361.8°C、DC0009 357.025°C；展示保留1位小数。后续升温、派工及现场取证为演示构造。',
 conclusion:'3号缸排温偏差在可比片段中反复出现并扩大。已确认的取证记录显示喷嘴积炭、喷雾状态检查不符合所引用的设备要求，支持审阅喷油器清洁与复校安排；不直接决定换件。',
 recommendation:'建议轮机长审阅3号缸喷油器清洁与复校措施的合理性，并在原问题事件中安排实施。前置取证已确认，实施时间、人员及作业条件仍需明确。',
 limitation:'排温偏差本身不能定位喷油器问题。部件判断引用已确认的检查报告，不代表其他原因已全部排除；维护后的实际效果仍需有效监测验证。',
 snapshots:[
  {name:'排温变化',value:'361.8 → 371.8 °C',reference:'前后可比运行记录',meaning:'与同时段2号缸对照差4.8 → 14.8°C；对照记录357.0 → 357.0°C',source:'DC0010／DC0009 · s-005／s-046；非全部缸平均'},
  {name:'部件取证',value:'已确认',reference:'喷嘴观察＋状态检查报告',meaning:'积炭及喷雾状态检查记录支持维护评估，不是维护已执行',source:'原3号缸事件 · 人员确认'},
  {name:'作业安排',value:'待轮机长决定',reference:'实际实施时间尚未安排',meaning:'前置证据与执行条件分开，不推测靠港窗口',source:'人员安排；尚未取得正式计划'}
 ],
 series:[{name:'3号缸排温',unit:'°C',labels:['前次可比记录','本次可比记录'],values:[361.8,371.8],scope:'可比运行记录；参考值361.8°C'},{name:'2号缸对照排温',unit:'°C',labels:['前次可比记录','本次可比记录'],values:[357,357],scope:'可比运行记录；参考值357.025°C，展示357.0°C，不代表其余缸均值'}],
 steps:[{title:'持续观察形成关注',fact:'多个可比片段反复偏离，后续差值4.8→14.8°C。',inference:'先建立同一跟踪档案，未凭温度变化直接定位部件。'},{title:'派工取得部件证据',fact:'轮机长已派工；读数比对、喷嘴积炭和状态检查记录已确认。',inference:'新增现场材料支持针对喷油器提出维护评估，不把机外观察当作部件确诊。'},{title:'从取证接续维护建议',fact:'尚无本次清洁／复校的执行记录；原计划未取得。',inference:'建议清洁与复校，由轮机长审阅安排；不直接批准换件、不编造提前小时数。'}],
 comparisons:[{direction:'维护必要性',support:'持续排温变化＋已确认的喷嘴观察及状态检查记录',missing:'轮机长审阅具体措施及判断范围，不等于还未取得前置证据'},{direction:'实施条件',support:'原问题事件保留前置取证',missing:'实际时间、人员、停机隔离、许可和资源安排'},{direction:'效果验证',support:'保留处理前排温与对照差记录',missing:'实际维护及复校记录，处理后有效可比监测'}],
 origins:[
  {id:'injector-origin-watch',label:'反复偏差 · 持续关注',at:'前置跟踪',actor:'AI健康分析',text:'3号缸可比排温偏差反复出现；建立同一档案持续比较。',assessment:'温度偏差不足以定位具体部件。'},
  {id:'injector-origin-request',label:'偏差扩大 · 派工取证',at:'前置派工',actor:'轮机长',text:'新增可比记录显示偏差扩大，派李建国核对读数、工况并提交现场证据。',assessment:'人工介入来自新增证据，不是重复建档。'},
  {id:'injector-origin-confirmed',label:'现场证据 · 已确认',at:'取证完成',actor:'李建国（大管轮）',text:'已确认读数比对、喷嘴积炭及喷雾状态检查记录。材料保留于原3号缸事件。',assessment:'状态检查支持清洁与复校建议；没有本次维护执行记录。'},
  {id:'injector-origin-advice',label:'提出维保建议 · 待审阅',at:'取证确认后',actor:'AI维保建议',text:'综合连续监测与部件证据，提出清洁与复校建议，交轮机长决定安排。',assessment:'执行条件另行确认，不决定换件。'}
 ],
 plan:{id:'injector-plan-unavailable',device:'主机 · 3#缸喷油器',title:'3号缸喷油器已有安排',currentHours:null,dueHours:null,remainingHours:null,window:null,status:'未取得',basis:'尚未取得正式周期计划，不能给出精确提前小时数。',note:'作业条件由人员在原事件中确认；不推测靠港或工单。'}
}
export const maintenancePointBasis={third:cruiseMotion.sourceCenters[cruiseMotion.channels.indexOf('DC0010')],second:cruiseMotion.sourceCenters[cruiseMotion.channels.indexOf('DC0009')],period:cruiseMotion.sourcePeriod}
export function seedMaintenanceEvidence(core){
 if(core.logs.drift.some(m=>m.id==='injector-demo-evidence'))return true
 // Do not overwrite a user-started or already executed event with fixture history.
 if(core.todoCreated.drift||core.logs.drift.some(m=>m.kind==='feedbackRecord')||core.executionRecords.drift?.length)return false
 core.todoCreated.drift=true
 core.progress.drift=core.cases.drift.stages.findIndex(s=>s.kind==='work')
 core.activeStage.drift=core.progress.drift
 const at='2026/10/12 09:30'
 core.assignments.drift={owner:'李建国（大管轮）',assignedBy:'陈志远（轮机长）',type:'前置现场取证',scope:'核对3号缸排温与工况，确认喷油器部件检查记录；本次尚未安排维护。',due:'前置取证已完成',at}
 core.assignmentRecords.drift=[{...core.assignments.drift,id:'injector-demo-assignment'}]
 core.taskActors.drift='李建国（大管轮）'
 const checks=[{stageId:'check',title:'现场核实反馈已确认',task:core.cases.drift.stages.find(s=>s.id==='check').title,records:[{label:'现场读数与工况',result:'现场与系统一致',note:'可比片段，已核对现场记录。'},{label:'现场现象',result:'已完成观察',note:'不凭机外观察直接定位喷油器。'}]},
 {stageId:'investigate',title:'喷油器部件取证已确认',task:core.cases.drift.stages.find(s=>s.id==='investigate').title,records:[{label:'喷嘴观察及状态检查',result:'喷嘴积炭，喷雾状态未达到报告引用的设备要求',note:'检查报告；校验压力及厂家限值尚未取得。'},{label:'其他候选方向',result:'已记录核对范围，未全部排除',note:'保留未覆盖的问题。'}]}]
 checks.forEach((m,i)=>{core.logs.drift.push({id:i===1?'injector-demo-evidence':'injector-demo-reading',role:'assistant',kind:'feedbackRecord',actor:'李建国（大管轮）',submittedAt:at,at,provenance:'演示构造',...m});m.records.forEach((r,n)=>{core.taskResults[`drift:${m.stageId}:${n}`]=r.result;core.taskNotes[`drift:${m.stageId}:${n}`]=r.note})})
 core.logs.drift.push({id:'injector-demo-advice',role:'assistant',text:'前置取证已确认，形成喷油器清洁与复校建议，等待轮机长审阅安排；本次尚未执行维护。',at})
 return true
}
