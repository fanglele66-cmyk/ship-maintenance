// Explicit prototype findings only. Free-form notes are not a diagnostic engine.
// Historical cases ground component names; every match still describes a simulated
// current finding, never proof that the historical or current ship was repaired.
const copy=value=>JSON.parse(JSON.stringify(value))
const step=(label,guide,checks)=>({label,shortLabel:label,guide,checks,recordHint:'记录本轮实际检查、措施、部件标识及维修作业单附件；未完成项目单列。'})
const part=(name,use)=>({name,amount:'按获批维修作业单核定',specification:'按本机图册、原件标识及适用维修作业单匹配',use})
const row=(name,req,method)=>({name,req,method})

const definitions=[
 {
  id:'c2-icu-piston-sticking',caseIds:['real-alarm-0430'],packageKey:'icv',recordLabel:/ICU|液压机构|间歇反馈/,
  marker:'二缸 ICU 伺服油液压活塞卡滞',title:'二缸 ICU 伺服油液压活塞卡滞处置',component:'二缸喷射控制单元（ICU）的伺服油液压活塞及配合孔',
  sourceKind:'historical-case-informed-simulation',sourceReference:'wiki_rt-flex50/concepts/长航碧玉主机2缸ICU伺服油液压活塞卡阻故障案例.md',
  steps:[
   step('检查并清洁二缸 ICU 液压活塞','对已确认卡滞的伺服油液压活塞及配合孔作维修作业单检查和清洁。',['确认停机、防起动及燃油、伺服油隔离卸压，记录 ICU 件号和拆前接口。','记录活塞动作、表面和污染位置；按本机维修作业单用认可清洁剂及无绒材料清洁活塞与配合孔，不打磨精密配合面。','复测清洁后的动作和回位，记录能否恢复；ICV 指令及反馈线束单独核对。']),
   step('按复验结果恢复或更换获批 ICU','清洁可恢复时复装原件；动作仍卡滞、检验不合格且更换获批时，安装适配 ICU。',['核对检验记录和批准范围，确认新旧总成标识及适配性；可恢复原件不默认报废。','按维修作业单恢复燃油、伺服油接口及插接件，拆装密封按维修作业单换新，执行人与复核人分别签认。','记录实际清洁或换件、用料、旧件去向；不因液压活塞卡滞联动更换 ICV 或燃油供给部件。']),
  ],
  parts:[part('ICU 接口配套密封件','本轮获批拆装复装使用；实际用量单独登记。'),part('适配二缸 ICU 总成','仅清洁后仍卡滞、检验不合格且总成更换获批时选用。'),part('认可清洁剂及无绒擦拭材料','清洁伺服油液压活塞及配合孔，材料按本机要求。')],
  acceptanceRows:[row('液压活塞动作','清洁复验或获批换件后，液压活塞动作和回位符合本机维修作业单要求。','记录处理前后检验、件号和复核签认，仍卡滞则验收不通过。'),row('喷射指令与反馈','获准试车中二缸喷射控制阀指令与流量活塞反馈对应，原报警未复现。','记录测试时刻、六缸排气温度、转速、负荷及报警窗口；持续效果另行观察。')],
 },
 {
  id:'control-air-reducer-seal',caseIds:['real-warning-0523'],packageKey:'regulator',recordLabel:/减压阀|临时密封|调压保持/,
  marker:'控制空气减压阀阀芯密封垫老化破损',title:'控制空气减压阀阀芯密封垫更换与调压复测',component:'待检控制空气减压阀的阀芯密封垫、阀芯及阀座',
  sourceKind:'historical-case-informed-simulation',sourceReference:'wiki_rt-flex50/concepts/长航碧玉30KG到8KG减压阀损坏故障案例.md',
  steps:[
   step('检查减压阀密封垫与配合面','在保持必要供气并隔离待检阀组后，检查老化破损密封垫、阀芯及阀座。',['记录两组阀编号、在用/备用状态，按批准程序切换并确认待检组隔离卸压。','留存密封垫老化破损照片，核对阀芯、阀座、弹簧和调压动作；按维修作业单清洁确认的阀内污物。','记录配合面是否可用，阀体或调压机构新增缺陷另行报告，不由密封垫损坏默认更换总成。']),
   step('更换获批配套密封垫并恢复调压','安装型号、材料和尺寸匹配且获批的阀芯密封垫，复装后按本船设定调压。',['核对配套密封件标识和实际领用，按维修作业单安装并检查密封；不使用不明材料自制替代件。','分别记录减压阀前后表计、控制空气瓶压力，以及主机控制空气进口压力和主机控制空气进口压力（安全监测）。','按获准用气及阀组切换工况复测压力保持和恢复；配套件未到位则保留未完成，临时措施须另行批准并记录限制。']),
  ],
  parts:[part('减压阀阀芯配套密封垫','本轮确认老化破损且更换获批后使用；不得用不明材料替代。'),part('减压阀拆装接口密封件','按实际拆装接口和维修作业单要求备料。'),part('认可清洁剂及无绒擦拭材料','清洁减压阀阀芯、阀座及阀内污物。')],
  acceptanceRows:[row('密封垫与阀芯回位','配套密封件安装符合维修作业单，所检接口无泄漏，阀芯及调压机构动作符合本机要求。','核对新旧件、阀组编号、密封/动作试验和双人复核记录。'),row('分段压力与用气恢复','按本船设定复核阀后和控制空气压力，获准用气及切换试验中原低压未复现。','另测阀前后压力并标位置；同步留存两个主机进口压力通道的本轮读数，不用历史 0.57/0.54 MPa 代替验收。')],
 },
 {
  id:'c1-injector-carbon',caseIds:['real-maintenance-c1-baseline'],packageKey:'baseline',recordLabel:/专项检查必要性|修后校验|剩余偏差/,
  marker:'一缸喷油器喷嘴积碳导致雾化不良',title:'一缸喷油器喷嘴清洁与雾化复验',component:'一缸喷油器喷嘴及拆装接口密封',
  sourceKind:'prototype-assumption',sourceReference:'演示假设；现有月度基线资料没有确认一缸喷嘴积碳或维修事实。',
  steps:[
   step('复核一缸喷油器喷嘴积碳与雾化检验','核对本轮喷油器编号、喷嘴积碳照片及获批的雾化、启喷和密封检验。',['独立测温及工况对照作为已完成检查附件保存；本轮仅将喷油器检验支持的范围纳入维护。','停机、防起动、燃油隔离卸压后按维修作业单拆检，保护喷嘴精密表面并记录旧件标识。','核对喷嘴积碳与雾化检验对应关系，缺少检验时保留待补，不以月度排温偏差代替喷油器检验。']),
   step('清洁一缸喷嘴并复验装复','按喷油器维修作业单清除喷嘴积碳，复验合格后装复原喷油器。',['使用本机认可的清洁方式与材料，保持喷孔及精密配合面尺寸，不自行扩孔或打磨。','复验雾化、启喷和密封；仍不合格时暂停装复，另提适配喷嘴或喷油器更换申请，获批后实施。','按维修作业单使用拆装配套密封并装复，记录实际用料和六缸同工况复测；不扩大到无检验支持的排气阀换件。']),
  ],
  parts:[part('一缸喷油器接口密封包','获批拆装喷油器时按维修作业单使用。'),part('喷油器认可清洁材料','按本机维修作业单清除确认的喷嘴积碳。'),part('适配一缸喷嘴或喷油器组件','仅清洁复验仍不合格且另获换件批准时选用。')],
  acceptanceRows:[row('喷油器雾化与密封','喷嘴清洁或获批换件后的雾化、启喷和密封检验符合本机维修作业单。','保存喷油器编号、检验设备、处理前后结果和复核签认；不虚填通用压力数值。'),row('喷油器复装与缸间响应','拆装接口无泄漏，按可比负荷、转速和燃油记录六缸排气温度。','保存复装维修作业单及同刻六缸记录，相对偏差按本轮依据解释，不要求强制回到零温差。')],
 },
 {
  id:'c4-temperature-terminal',caseIds:['real-maintenance-c4-baseline'],packageKey:'baseline',recordLabel:/专项检查必要性|修后校验|剩余偏差/,
  marker:'四缸排气温度探头接线端子松动',title:'四缸排气温度探头接线端子恢复与独立校验',component:'四缸排气温度探头接线端子及连接线',
  sourceKind:'prototype-assumption',sourceReference:'演示假设；现有月度基线资料没有确认四缸接线缺陷或维修事实。',
  steps:[
   step('检查四缸排温探头端子与连接线','核对四缸排气温度探头通道及本轮接线端子松动位置。',['按仪表维修作业单和批准窗口落实安全条件，记录探头、端子排及通道标识。','检查端子松动、极性、线材、屏蔽、绝缘及接点状态，保留照片与独立校验记录。','确认问题位于连接后再实施修复，探头或采集模块无检验缺陷时保留原件。']),
   step('恢复端子连接并独立校验','按仪表维修作业单恢复松动端子连接，复核极性与屏蔽后做独立校验。',['按维修作业单要求紧固连接，确认接点清洁；端子或导线损伤时才更换获批的适配端子或线材。','使用有效且独立的校验设备，记录设备编号、校验点及处理前后误差；不把平台与同源显示一致当作校验。','恢复防护和接线标识，采集六缸同刻排温及工况；本轮不安排喷油器、排气阀或整套温度模块更换。']),
  ],
  parts:[part('温度通道适配端子及连接线','仅检查确认端子或线材损伤且更换获批时使用；单纯松动紧固不消耗新探头。'),part('接线标识及认可接点清洁耗材','按本轮端子恢复及防护要求使用。')],
  acceptanceRows:[row('端子与信号连接','松动端子按维修作业单恢复，极性、线材及屏蔽符合原回路要求，防护与标识复位。','保存具体端子位置、处理前后照片及执行/复核签认。'),row('独立校验与读数对应','独立校验符合本机仪表要求，四缸信号与对应采集通道一致。','记录校验设备、校验点、误差及时间；保存六缸同刻排温与工况，不虚构固定恢复温度。')],
 },
]

function recordsOf(feedback){return Array.isArray(feedback)?feedback:Array.isArray(feedback?.records)?feedback.records:[]}
function explicitlyConfirms(note,marker){
 // A complete affirmative statement is required. A quoted/candidate marker or a
 // negated sentence such as “未现场确认” cannot activate a repair plan.
 return String(note||'').split(/[\n。；;]/).some(sentence=>{
  const match=sentence.trim().match(/^(?:现场确认|已确认原因)\s*[:：]\s*(.+)$/)
  return match?.[1]?.trim()===marker
 })
}
export function confirmedRepairFinding(item,feedback){
 const records=recordsOf(feedback)
 const definition=definitions.find(entry=>entry.caseIds.includes(item?.id))
 if(!definition)return null
 const record=records.find(entry=>['发现异常','有提前处理依据'].includes(entry.result)&&definition.recordLabel.test(entry.label||'')&&explicitlyConfirms(entry.note,definition.marker))
 if(!record)return null
 return {...copy(Object.fromEntries(Object.entries(definition).filter(([key])=>!['recordLabel','caseIds'].includes(key)))),cause:definition.marker,evidenceNote:record.note,evidenceLabel:record.label,packageKeys:[definition.packageKey],isSimulation:true,dataOrigin:'prototype-confirmed-finding'}
}

function directionTask(task,key){
 if(key==='icv')return /ICU|间歇反馈/.test(task.label)
 if(key==='regulator')return /减压阀|临时密封|调压保持/.test(task.label)
 return /修后校验|剩余偏差/.test(task.label)
}
export function applyConfirmedRepairFinding(item,repair,feedback){
 if(!repair)return repair
 const finding=confirmedRepairFinding(item,feedback)
 if(!finding)return repair
 if(repair.confirmedFinding?.id===finding.id&&repair.confirmedFinding.evidenceNote===finding.evidenceNote&&finding.steps.every(step=>repair.tasks?.some(task=>task.label===step.label)))return repair
 const records=recordsOf(feedback)
 if(records.some(entry=>/作业条件|停机窗口/.test(entry.label||'')&&['条件暂不具备','无法确认'].includes(entry.result)))return repair
 if(repair.packageKeys?.length&&!repair.packageKeys.includes(finding.packageKey))return repair
 const detail=repair.workDetails||item.workDetails||{},original=repair.tasks||[]
 const baseline=finding.packageKey==='baseline',repeat=(repair.round||1)>1
 let tasks
 if(baseline&&!repeat){
  // Keep handover/history and final restoration, but remove unrelated combustion
  // or measurement replacement directions from this confirmed maintenance plan.
  tasks=[...original.filter(task=>/批准范围与作业交接|月度变化与调整履历/.test(task.label)),...copy(finding.steps),...original.filter(task=>/恢复接口并进行同工况复测/.test(task.label))]
 }else{
  const target=original.findIndex(task=>directionTask(task,finding.packageKey))
  if(target<0)return repair
  tasks=original.flatMap((task,index)=>index===target?copy(finding.steps):[copy(task)])
 }
 const otherKeys=(repair.packageKeys||[]).filter(key=>key!==finding.packageKey)
 const multiple=otherKeys.length>0||(!baseline&&original.some(task=>finding.packageKey==='icv'?/燃油供给|供给处置/.test(task.label):/控制空气通路|通路问题/.test(task.label)))
 const replacedPartNames=new Set((item.packages?.[finding.packageKey]?.parts||[]).map(entry=>entry.name))
 const parts=multiple?[...copy((detail.parts||[]).filter(entry=>!replacedPartNames.has(entry.name))),...copy(finding.parts)]:copy(finding.parts)
 const acceptanceRows=baseline?[
  row('范围与原始资料','批准范围与本轮确认原因对应，实际完成项目及未完成项分别登记。','核对来源异动、本轮检查记录、作业许可和维修作业单。'),
  ...copy(finding.acceptanceRows),
  row('相对基线与后续跟踪','保留六缸同刻排气温度和运行条件，继续本轮对应气缸的效果观察。','提交复测时刻、转速、负荷和燃油资料；剩余偏差交回原跟踪。'),
 ]:[...copy(detail.acceptanceRows||[]),...copy(finding.acceptanceRows)]
 const findingTitle=(repeat?'第'+repair.round+'轮':'')+finding.title
 const title=multiple?repair.title+'；'+findingTitle:findingTitle
 return {...repair,title,tasks,confirmedFinding:copy(finding),
  evidence:[...(repair.evidence||[]),'本轮明确反馈：'+finding.evidenceNote],
  workDetails:{...copy(detail),preparation:[...(detail.preparation||[]),'核对本轮明确原因及获批范围：'+finding.component+'；以下作业为本轮计划，实际措施另行记录。'],parts:[...new Map(parts.map(entry=>[entry.name,entry])).values()],acceptanceRows,acceptance:acceptanceRows.map(entry=>entry.name+'：'+entry.req)},
  markdown:`### 本轮具体处置\n\n${title}\n\n已提交原因：${finding.cause}。检查与作业限于本轮获批范围，实际执行和验收另行填写。\n\n### 作业步骤\n\n${tasks.map(task=>'- **'+task.label+'**：'+task.guide).join('\n')}`,
 }
}
