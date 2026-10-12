import { healthReview } from './r05Overview.js'
// Situation reports and companion summaries share the same mock evidence.
// Values are scenario data; no equipment-specific limits are inferred here.
function latestValues(store, id, fallback) {
  return store.observationRecords[id].filter(record => record.values).at(-1)?.values || fallback
}

function followUp(store, id) {
  const result = store.getObservationResult(id)
  const names = { fault: '冷却系统', drift: '3#缸', maintenance: '轴承' }
  if (result.type === 'archive') return `${names[id]}连续观测已满足本轮收束条件，恢复常规监测。`
  if (result.type === 'reinspect') return `${names[id]}处理后出现反复，需要人工复查新证据。`
  if (result.type === 'extend') return `${names[id]}本日可比数据不足，建议延长观察并补齐记录。`
  return `${names[id]}人工处理已完成，持续效果仍由 AI 跟踪。`
}

export function operationAssessment(store) {
  const coolingDone=store.isTaskHandled('fault'),driftDone=store.isTaskHandled('drift'),bearingDone=store.isTaskHandled('maintenance')
  const conclusion=coolingDone?'主机冷却系统已提交处置与验收，研判重点转为同负荷下温度、流量是否持续恢复。其余局部变化需独立验证，不能因为一项任务完成而将整台主机判为恢复正常。':'主机当前同时存在冷却回路异常、单缸排温偏离和轴承振动缓升。温升与流量下降指向冷却能力受限，优先级最高；单缸相对偏差和局部振动变化仍需各自的现场证据，当前不足以判为同一原因。'
  const basis='冷却水出口92.4℃、进口48.7℃，温差43.7℃，流量68.2 m³/h低于80 m³/h参考下限，关联信号支持先核对供流与换热。3号缸在可比工况下相对差由8℃扩大至10℃，而轴承近7日振动2.1→3.0 mm/s、温度约65℃；局部变化的机理和时间尺度不同，尚无依据把二者直接归因于冷却回路。'
  const recommendation=(coolingDone?'先核对冷却系统处置后可比样本是否持续稳定。':'先进入当前待办，查看冷却回路的排查进展与现场反馈。')+(driftDone?'3号缸已有人工处理记录，复核后续效果。':store.todoCreated.drift?'3号缸沿已指派任务核对现场读数及可复现现象，避免重复建任务。':store.ignoredSuggestions.drift?'3号缸本次暂不检查的决定已保留，重新出现关联证据时再评估。':'再查看3号缸关注详情中的变化证据和核实建议，决定是否建立检查待办。')+(bearingDone?'轴承后续周期按实际作业范围核对。':'轴承先查看提前检查建议与靠港窗口的关系，原2,000 h周期计划仍保留；看清依据后再决定是否接受提前检查。')
  return {...healthReview, sections:[{title:'跨指标分析与判断边界',paragraphs:[basis]},{title:'当前处置与人员安排',paragraphs:[recommendation]},{title:'什么新证据会改变判断',paragraphs:['若温度与流量在相近负荷下同步恢复，冷却受限方向的支持程度会降低；若单缸排温偏差仍独立扩大，应转向局部燃烧、密封与测量链路的核验。轴承是否提前处理则以测点、润滑和实物检查结果为依据，不从振动增幅直接推断磨损量或剩余寿命。']}], summary:[{label:'综合判断',tone:'blue',text:conclusion},{label:'分析依据',tone:'gray',text:basis},{label:'安排建议',tone:'amber',text:recommendation}], readings:{fault:latestValues(store,'fault',[79.1,86.5]),drift:latestValues(store,'drift',[3,425]),bearing:latestValues(store,'maintenance',[2.2,64])}}

}

export const maintenanceProposalScene = {
  title:'维保提前建议',
  paragraphs:[
    {label:'当前判断',text:'1#缸连杆轴承值得提前检查，暂不直接决定换件。近7日振动持续上行，周期检修也已临近；温度没有同步明显抬升，现有数据还不能证明轴瓦磨损。'},
    {label:'时机与依据',text:'振动2.1→3.0 mm/s，增幅约43%；累计1,860 / 2,000 h，距周期节点约140 h。约48小时后的靠港窗口可评估提前检查，但仍需确认停机、人员与备件条件。'},
    {label:'待补现场证据',text:'先复核测点固定及润滑状态，再按设备规程检查间隙与轴瓦状态。若磨损证据与趋势吻合且作业条件具备，再决定提前保养；若未见异常，保留周期计划并继续趋势跟踪。'}
  ],
  question:'是否建立提前维保检查待办？确认后沿同一份趋势与计划材料接续现场检查。'
}

export function maintenanceAssessment(store, planned = false) {
  const handled = store.isTaskHandled('maintenance'), checked = store.progress.maintenance >= 2, created = store.todoCreated.maintenance
  const values = latestValues(store, 'maintenance', [2.2,64]), result = store.getObservationResult('maintenance')
  const conclusion = planned ? (handled ? '本周期已有提前保养执行记录，后续周期基准应结合实际作业范围和设备规程核对更新。' : '按2,000运行小时管理本部件周期检修，当前累计1,860 h、剩余约140 h；同时评估趋势触发的提前检查建议。') : handled ? `现场换件与验收已提交，最新振动${values[0]} mm/s、温度${values[1]}°C。${result.text}` : checked ? '现场已确认轴瓦轻微偏磨、间隙接近计划检修上限，且备件可用；趋势与实物证据相互支持，具备提前保养依据。' : created ? '提前维保检查待办已建立。现有趋势提示值得核验，是否换件仍需现场磨损、间隙和作业条件共同支持。' : '振动连续上行且临近周期检修，建议评估提前检查；当前证据不足以直接认定轴瓦磨损或决定换件。'
  const recommendation = planned ? (handled ? '依据实际执行时间、检查范围与作业反馈核对下一周期，保留原计划与本次提前执行的关联。' : '结合提前建议、停机窗口与备件安排确认执行时机；人员确认前保留原计划，避免重复建任务。') : handled ? (result.type==='archive' ? '恢复常规监测，保留趋势、现场检查与连续观察证据，核对后续周期安排。' : result.type==='reinspect' ? '返回现场核实新的振动或温度反复，结合润滑、装配及测点检查补齐证据。' : result.type==='extend' ? '补齐可比转速、负荷下的振动与温度记录，按效果建议延长观察。' : '继续按观察窗口比较同工况振动与温度；根据持续稳定、反复或数据不足分别收束、复查或补证。') : checked ? '按已确认的磨损与间隙结果落实提前保养，作业前确认隔离、备件及验收口径。' : '先核验测点、润滑与可见状态，再按设备规程补充间隙和轴瓦证据；检查结果支持后再确认提前保养。'
  const sections = planned ? [
    {title:'计划依据与时间口径',paragraphs:['本计划按累计运行小时推进：累计1,860 h、周期节点2,000 h，剩余约140 h。运行小时反映计划进度，约48小时后的靠港反映作业机会，两者不等同，也不能据此直接预测部件剩余寿命。','靠港并不自动代表具备执行条件。实际安排需核对停机与隔离条件、轮机人员、工具和备件，并按适用设备规程明确检查范围及验收要求。']},
    {title:'提前建议如何影响原计划',paragraphs:['同一轴承振动持续上行，触发对原计划执行时机的重新评估。提前建议补充状态证据，周期计划保留计划依据；只有现场证据支持且人员确认时，才沿关联待办执行，不重复建立另一条任务。',handled ? '本次提前保养已有实际作业及验收记录，应核对是否覆盖原周期项目。尚未执行的项目继续保留；下一周期基准按实际范围与设备规程确认，不能只因观察结束而自动视为全部项目完成。' : '若现场未见支持提前处理的异常，保留原周期计划并继续跟踪；若发现磨损或间隙问题，则记录提前执行原因及作业范围，便于后续核对周期安排。']},
    {title:'执行记录与持续效果',paragraphs:[handled ? `已关联本次实际换件与验收，处理后首测振动2.2 mm/s、温度64°C；持续观测当前结论为“${result.title}”。` : '当前计划信息不代表已经执行。实际检查、保养、换件及复测需由人员反馈确认后进入设备履历。','计划完成情况依据实际作业范围核对，处理效果依据态势中的连续记录验证；两类证据沿同一部件与来源事件保留。']}
  ] : [
    {title:'监测事实与计划依据',paragraphs:['近7日相近转速与负荷样本中，轴承振动由2.1升至3.0 mm/s，增幅约43%，呈连续缓升；轴承温度约65°C，未见同步明显抬升，系统尚未触发振动报警。这里关注的是趋势变化，不能把增幅当成磨损量或剩余寿命。','累计运行1,860 h，距2,000 h周期检修节点约140 h，约48小时后有靠港窗口。趋势变化与计划临近同时出现，使提前核验具有安排价值；具体执行时机仍需现场条件支持。']},
    {title:'AI 推理：为何建议提前检查',paragraphs:['振动连续上行提示运行状态可能发生变化，温度未同步明显上行使证据还不足以认定摩擦发热或严重损伤。间隙变化、润滑条件、载荷变化及测点固定都可能影响振动，现阶段需要用不同类型的证据区分这些解释。','因此建议先检查，再决定是否提前保养。若趋势在可比工况下持续存在，并取得偏磨、间隙或润滑异常等现场证据，提前执行的依据会增强；若复核后趋势源于测点或工况变化，应修正判断并保留常规计划。']},
    {title:'现场需要补齐哪些证据',paragraphs:['首先复核振动测点位置、固定状态、采集时间和对应转速/负荷，确认前后读数可比；同时核对供油、油温及适用的润滑检查记录，留意过滤器或曲轴箱中是否有异常磨屑证据。缺少的检查结果应保留为待补项，不能当成已排除。','按设备规程先完成可实施的外观及间隙检查；是否进一步打开检查轴瓦，应结合外部发现、趋势及规定要求决定。轴瓦表面状态、偏磨位置和间隙结果用于验证磨损解释，备件与作业条件用于确认能否执行；单凭振动缓升不直接安排拆检或换件。',checked ? '本次检查已反馈轴瓦轻微偏磨、间隙接近计划检修上限，备件可用。实物证据与趋势方向吻合，已由“建议核验”推进为“具备提前保养依据”；具体尺寸和限值仍以本机型规程及现场记录为准。' : '当前尚无已确认的轴瓦表面或间隙结果。建立检查待办只是同意补证，并不等于已经确认磨损或批准换件。']},
    {title:'人员决定与执行接续',paragraphs:[handled ? '实际换件、复装及验收已在来源待办中确认，作业记录进入设备履历；后续持续效果由态势接续。' : checked ? '人员依据现场偏磨、间隙和备件结果决定提前执行。作业过程需记录实际措施、复装检查与复测验收，确认后完成本轮人工处理。' : created ? '人员已同意建立提前维保检查待办；原趋势和周期依据随任务接续，检查结论补齐后再判断是否采取提前保养。' : '当前保留为提前维保建议。人员同意后建立检查待办；确认异常且具备执行条件时再保养，未见异常时保留检查结果并继续监测。','常规计划与提前建议针对同一部件，执行范围与时间需关联核对。提前执行不代表未经核对就重置全部周期项目，也不重复生成另一条任务。']},
    {title:'处理后如何验证原判断',paragraphs:[handled ? `处理前振动3.0 mm/s、温度约65°C，验收首测为2.2 mm/s、64°C；最新可比记录为${values[0]} mm/s、${values[1]}°C。${result.text}` : '若确认并完成保养，先记录振动和温度验收首测，再按48小时观察窗口比较相近转速、负荷下的每日表现。观察直接回应原来的振动缓升判断，而不是另设一套无关指标。','振动回落后持续稳定、温度未异常抬升且无新的现场异常，才支持本轮观察收束；若振动或温度出现反复，请求现场复查；若缺少同工况数据，先补证并按建议延长观察。一次首测改善不足以证明持续效果。']}
  ]
  return {conclusion,recommendation,sections}
}
