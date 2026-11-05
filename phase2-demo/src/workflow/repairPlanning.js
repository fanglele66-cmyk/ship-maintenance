import {observationTasks} from './observationEvents.js'
import {isAbnormalResult} from './lifecycleDecisions.js'
import {groupRepairSteps} from './repairStepGroups.js'
import {isVerificationReview,observationTaskFor} from './observationContext.js'

export const repairProcedureVersion=3
const workOptions=['已完成','未完成','不适用']
const step=(label,guide,checks,recordHint)=>({label,guide,checks,recordHint,options:[...workOptions]})
const clone=value=>JSON.parse(JSON.stringify(value))

// These are work-card requirements, not completed work or manufacturer settings.
// Sources: wiki_rt-flex50/concepts/RT-flex故障排查方法论.md:111-137;
// 长航碧玉主机2缸ICU伺服油液压活塞卡阻故障案例.md:32-62.
export function detailedRepairSteps(event,methods=[]){
 const investigation=observationTasks(event).reverse().find(t=>t.kind==='investigation'&&t.status==='submitted')
 const findings=(investigation?.records||[]).filter(isAbnormalResult)
 const target=findings.map(r=>r.label).join('、')||'本轮报告中已确认并获批的部位'
 const evidence=findings.map(r=>`${r.label}：${r.note||r.result}`).join('；')
 const report=event.reports.findLast(r=>r.taskId===investigation?.id)
 const icu=/ICU|液压活塞/.test(evidence),air=/空气|减压|气路/.test(evidence)
 const supplies=icu?'适配本机型号、接口和序列号的 ICU 备用总成（换件获批后领用）、密封件、堵头、接油容器、无绒布和认可清洁剂':air?'适配损坏部位的减压阀维修包或总成、密封件、堵头、检漏用品和已校验压力表':'适配目标部位的备件、密封或接线材料、清洁用品和已校验独立测量工具'
 const start=[
  step('核对异常、批准范围与作业工单',`轮机长对照《${report?.title||'本轮排查报告'}》确认 ${target} 及批准范围。`,[
   `已提交依据：${evidence||'从报告核对异常位置、现象和检查方法。'}`,
   '标明允许清洁、连接修复、送修或换件的部位；未见异常或无法确认者不自动换件。',
   '核对本机作业卡版本、负责人、监护人、窗口与停止条件；缺工艺或超范围即暂停并回报。'
  ],'登记工单/作业卡号、批准范围与方式、执行/监护人；缺资料及未批准项单列。'),
  step('准备备件、耗材与检修工具',`按获批范围准备：${supplies}。`,[
   '核对图号、机型、数量、合格证明和包装；适配不明不得装机，备件已备不代表必须更换。',
   '备齐专用、已校验扭矩及测量工具；装配顺序、力矩、验收值依厂家规定，未提供参数不猜填。',
   '清洁备件、旧件、废料分区标识，做好防污染和接液；缺备件或专用工具记为受限。'
  ],'登记备件名称/图号/批号/数量、工具编号及校验、实际领用和缺件。'),
  step('落实停机隔离与零能量确认','取得许可，按本船程序与驾驶台协调停机；执行人与监护人共同确认隔离。',[
   '防意外启动，隔离控制电源及介质并锁定标识；登记隔离点和责任人。',
   icu?'燃油、伺服油分别隔离卸压；按厂家程序核实余压与温度，未确认安全不得松动高压连接。':air?'确认控制空气用户及备用气源；隔离待修支路、卸压并核实零压，不中断未获批停用的安全用气。':'现场核实电、气、液压与热能符合许可；不能以停机或画面零值替代。',
   '设置防护作业区及接液措施，登记隔离复核；隔离不明时停止拆卸。'
  ],'登记许可、隔离点、现场方法/读数、时刻及监护复核。'),
  step('标识连接并保存处理前状态','',[
   '标识插头、线束、管路、方向和紧固位置，拍照记录原状及异常；未拍摄不记附件。',
   '拆下件按位置编号并及时封堵敞口；检查密封面和连接件，登记实际发现，新增损坏先回报确认范围。',
   icu?'ICU 内部检修由 Wärtsilä 认可车间实施；船端按获批工单拆装、封存和送修，历史案例不替代本机工艺。':'仅按厂家允许层级拆装，无对应作业卡停止解体。'
  ],'登记部位、原接线/管路、旧件编号、处理前现象、实际附件及送修交接。')
 ]
 // Reuse the shared preparation/restoration cards instead of repeating them
 // inside execution. Keep case-specific requirements in the corresponding card.
 const preparationMethods=methods.filter(t=>/^(确认供气配置与隔离范围|确认作业范围与隔离标识)$/.test(t.label))
 const restorationMethods=methods.filter(t=>/^(恢复供气并复测压力响应|恢复系统并复测喷射响应)$/.test(t.label))
 const actions=methods.filter(t=>!preparationMethods.includes(t)&&!restorationMethods.includes(t))
 const merge=(base,items)=>({...base,guide:[base.guide,...items.map(t=>t.guide)].filter(Boolean).join(' '),checks:[...new Set([...base.checks,...items.flatMap(t=>t.checks||[])])],recordHint:[base.recordHint,...items.map(t=>t.recordHint)].filter(Boolean).join(' ')})
 start[2]=merge(start[2],preparationMethods)
 const middle=actions.length?actions.map(t=>step(t.label,t.guide,[...(t.checks||[]),icu?'ICU 内部清洁及精密偶件检修仅由厂家认可车间实施，不用砂纸；参数依适用作业卡。':'仅做获批且有现场依据的项目；新增换件由轮机长确认。'],t.recordHint||'登记实际部位、措施、用料、结果及未完成项。')):[
  step(icu?'按授权完成 ICU 修复或总成交接':air?'处理已确认的气路损坏部位':'实施已批准部位的修复',icu?'按批准方式送修或更换适配总成；取得认可车间检修记录后核对回装条件。':`按作业卡处理 ${target}，登记实际措施。`,[
   icu?'记录已提交的卡阻等现象；积碳、划痕及磨损原因须实际检验，不照搬案例。精密偶件禁用砂纸修磨。':air?'仅修复已确认异常的密封、阀件、滤器或接头，登记旧件状态；双测点低压不等于减压阀损坏。':'按批准方式修复连接、清洁、校准或换件，保留前后对照及独立验证方法。',
   '复用或换件依厂家判据及批准范围；不达标或缺工艺条件时记为未完成并上报。',
   '登记实装图号/序列号/数量、旧件去向；未换件、未实施及不适用项如实填写。'
  ],'提交实际措施、用料、厂家/车间检验单及剩余问题；已完成与拟实施分开。')
 ]
 const operations=[...start,...middle,
  step('复装连接并复核密封与防护','按作业卡恢复连接、方向、支撑和防护；关键连接由另一人复核。',[
   '核对密封件适配、方向、接口清洁及线束标识；按厂家顺序和力矩装配，登记实际值及依据。',
   '清点工具和旧件；确认堵头按要求移除、防护复位、泄漏监测及报警连接恢复。',
   '按批准程序恢复介质并检漏；复装或密封不合格即停止试验，保留隔离并回报。'
  ],'登记接口复核、实际力矩及作业卡、工具清点、密封试验和复核人。'),
  step('分阶段试验并核对原异常','取得试验许可；操作人员按本船及厂家程序执行许可工况，维修人员同步记录。',[
   icu?'对齐二缸喷射指令、流量活塞反馈、各缸排温及主机转速，记录原流量活塞报警或减速是否复现。':air?'记录阀前后实测压力、两个进口监测值及用气状态，核对调压稳定性、接头泄漏及低压报警复现。':'对齐目标部位独立测量、系统通道及工况，核对原异常与处理后变化。',
   '登记试验时间、阶段、读数单位、判据及持续时长；不同负荷或工况分别标注，不互相替代。',
   '泄漏、动作异常、原报警复现或条件不足时停止相应试验并上报，不填通过。'
  ],'登记试验条件、数据、原报警复现、判据、实际结果及未验证项。'),
  step('整理作业记录并交接效果观察','形成含实际处理、用料、复测证据及复查对象的本轮维修报告。',[
   '汇总批准范围及实际完成项，列出新增发现、未完成项、临时措施及责任人。',
   '关联实际照片、检验单、用料及试验数据，确认恢复运行状态和观察测点。',
   '交接观察时段、原报警及复现报告安排，再提交轮机长处置。'
  ],'登记实际措施、用料、复测结论、剩余事项、交接对象及观察要求。')]
 const restorationIndex=operations.findIndex(t=>t.label==='复装连接并复核密封与防护')
 operations[restorationIndex]=merge(operations[restorationIndex],restorationMethods)
 return groupRepairSteps(operations)
}

export function presetRecheckSteps(event){
 if(isVerificationReview(event)){
  const task=observationTaskFor(event),report=event.reports.findLast(r=>r.taskId===task?.id)
  return [
   step('复核现场核实范围与剩余疑点',`对照《${report?.title||'排查报告'}》及本轮观察记录，明确原异常、已核实范围与仍需确认的位置。`,['核对原始读数、采样时间和现场反馈，保留未确认事项。','本轮暂未维修，不填写维修完成或修复有效。'],'记录报告版本、复查对象和已有证据。'),
   step('核对同工况读数与异常变化','在许可条件下核对原异常测点、独立读数和相关运行状态。',['记录同刻转速、负荷与测点，区分持续、扩大、回落与复发。','核对报警复现及现场异常；读数不一致时检查测点对应和采集链路，不擅自维修。'],'记录时间、工况、测点、读数及异常发生位置。'),
   step('汇总复查结论与后续建议','将观察趋势与现场证据对应，交轮机长决定下一步。',['明确已定位的问题、未查范围与证据缺口。','有处理依据时建议维修；未见异常时说明验证范围与后续观察条件。'],'提交复查结论、证据和仍需确认事项。')
  ].map(s=>({...s,options:['发现异常','未见异常','无法确认']}))
 }
 const work=observationTasks(event).reverse().find(t=>t.kind!=='investigation'&&t.status==='submitted')
 const report=event.reports.findLast(r=>r.taskId===work?.id)
 const result=[
  step('核对维修记录与剩余事项',`对照《${report?.title||'本轮作业报告'}》核实实际处理：${report?.summary||work?.summary||'以已提交作业记录为准'}。`,['逐项核对实际处理部位、备件使用和试验记录，区分完成、未完成及不适用项目。','先列出报告中的剩余问题、缺少证据和限制条件，确定本次复查范围。'],'记录所依据的报告版本、已完成措施和待核实事项。'),
  step('复核处理部位与系统恢复状态','在许可的检查条件下复核维修部位及恢复状态。',['核实连接、防护、密封与泄漏情况；只记录现场已检查的项目。','对未完成项目登记原因；需要拆卸或再次维修时先回报轮机长，不在复查中擅自扩大处理。'],'记录具体位置、方法、发现及未检查范围。'),
  step('对齐修后数据与原异常','按本事件原异常测点核对处理后的采样与独立复测。',[`关注测点：${(event.brief.facts||[]).map(f=>f.label).join('、')}。`,'记录同刻转速、运行阶段及独立读数；在可比工况内比较，说明缺测或观察时长不足。','核对原报警是否再现及发生时刻；趋势改善本身不替代现场检查结论。'],'提交观察起止时间、测点/单位、工况、原报警复现情况及数据缺口。'),
  step('汇总复查结果并提出处置建议','逐项登记发现异常、未见异常或无法确认，将证据交轮机长判断。',['将原异常、实际措施和复查结果逐项对应；明确剩余风险及后续观察要求。','有异常时说明建议处理部位；无异常时说明已验证范围，证据不足时保留未确认项。'],'提交复查结论、验证范围、实际附件及后续建议。')
 ]
 return result.map(s=>({...s,options:['发现异常','未见异常','无法确认']}))
}

// Dispatched work cards are snapshots. Template upgrades must never replace
// their steps or clear feedback, including when the same task is resumed.
