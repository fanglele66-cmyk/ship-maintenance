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
  const faultDone = store.isTaskHandled('fault'), driftDone = store.isTaskHandled('drift'), bearingDone = store.isTaskHandled('maintenance')
  const fault = latestValues(store, 'fault', [79.1, 86.5]), drift = latestValues(store, 'drift', [3, 425]), bearing = latestValues(store, 'maintenance', [2.2, 64])
  const driftDelta = store.monitorStep.drift ? 10 : 8, driftTemp = store.monitorStep.drift ? 432 : 428
  const coolingConclusion = faultDone ? followUp(store, 'fault') : '冷却水温升高与流量下降同时出现，冷却能力不足已由待办跟进。'
  const driftConclusion = driftDone ? followUp(store, 'drift') : store.todoCreated.drift && store.progress.drift >= 2 ? '3#缸异常已由现场证据确立，正在排查原因。' : store.todoCreated.drift ? '3#缸检查待办已建立，异常真实性仍待现场确认。' : store.attentionFeedback?.drift ? '3#缸现场核实已提交，系统继续分析，尚未确认或排除故障。' : store.monitorStep.drift ? '3#缸偏差扩大，需人工核实读数与现场现象。' : '3#缸相对排温偏高，现由 AI 持续跟踪。'
  const bearingConclusion = bearingDone ? followUp(store, 'maintenance') : store.progress.maintenance >= 2 ? '轴承检查已发现偏磨，提前保养依据已补齐。' : store.todoCreated.maintenance ? '轴承提前检查已获同意，是否保养仍取决于现场证据。' : '轴承振动缓升与周期临近共同支持提前检查建议。'
  const conclusion = `1号主机处于航行工况。${coolingConclusion}${driftConclusion}${bearingConclusion}`
  const next = []
  if (!faultDone) next.push('优先跟进冷却系统待办，由轮机员结合运行规程安排现场检查。')
  if (!driftDone) next.push(store.todoCreated.drift && store.progress.drift >= 2 ? '3#缸按关联待办核实喷油与气阀证据。' : !store.todoCreated.drift && store.attentionFeedback?.drift ? '3#缸本次核实要求已完成，接续系统跟踪。' : store.todoCreated.drift || store.monitorStep.drift ? '3#缸先核对现场仪表、异响是否可复现，再判断异常是否成立。' : '3#缸继续比较相近工况样本。')
  if (!bearingDone) next.push(store.progress.maintenance >= 2 ? '轴承按已确认检查结果安排提前保养。' : '轴承结合靠港条件先检查，再决定是否提前保养。')
  const handled = ['fault', 'drift', 'maintenance'].filter(id => store.isTaskHandled(id))
  if (handled.some(id => store.getObservationResult(id).type === 'reinspect')) next.push('处理后反复的事项优先请求现场复查。')
  if (handled.some(id => store.getObservationResult(id).type === 'extend')) next.push('缺少可比数据的事项补齐观测后再评估效果。')
  if (handled.some(id => store.getObservationResult(id).type === 'continue')) next.push('已处理事项继续同工况观察，避免以一次首测改善代替持续效果。')
  if (handled.length === 3 && handled.every(id => store.getObservationResult(id).type === 'archive')) next.push('本轮处理后观察均已收束，恢复常规监测并保留来源记录。')
  const recommendation = next.join('')
  const coolingEvidence = faultDone ? `冷却水出口温度${fault[0]}°C、流量${fault[1]} m³/h` : '冷却水出口温度92.4°C、流量68.2 m³/h'
  const driftEvidence = driftDone ? `3#缸排温差${drift[0]}°C、排温${drift[1]}°C` : `3#缸排温差${driftDelta}°C、排温${driftTemp}°C`
  const bearingEvidence = bearingDone ? `轴承振动${bearing[0]} mm/s、温度${bearing[1]}°C` : '轴承近7日振动2.1→3.0 mm/s，累计运行1,860 h'
  const basis = `${coolingEvidence}；${driftEvidence}；${bearingEvidence}。结论按各事项的连续监测与已确认现场反馈分别更新。`
  const coolingAnalysis = faultDone ? [
    `现场已提交滤器清洗及复装验收。处理前出口温度92.4°C、流量68.2 m³/h，处理后首测为79.1°C、86.5 m³/h；温度回落与流量恢复方向一致，支持本次处理改善了冷却侧供给条件。`,
    `最新可比记录为出口温度${fault[0]}°C、流量${fault[1]} m³/h。${store.getObservationResult('fault').text} 后续仍用这两个量的联合变化核对效果；若水温重新上行而流量又下降，应结合新现场证据复查。`
  ] : [
    '出口温度92.4°C、进口温度48.7°C，进出口温差43.7°C，同时流量降至68.2 m³/h。温升与供给减弱同时出现，比单独水温升高更支持冷却能力不足的判断；仍需在相近主机负荷下核对，避免把工况变化直接归为故障。',
    '排查宜优先核实海水滤器脏污及冷却侧通流情况，并结合换热器、温控阀现场结果区分阻力增加与换热效率下降。目前监测确定的是异常现象，具体堵塞部位尚不能仅凭温差或流量直接确认。'
  ]
  const driftAnalysis = driftDone ? [
    '前期现场仪表与采集读数一致，轻微异响可复现，异常因此确立；后续喷油器检查发现喷孔积炭，排气阀检查未见异常，原因范围才收敛至喷油器雾化问题。监测偏差、异常确立与根因检查是接续的不同证据。',
    `喷油器清洁、校验复装后，排温差由10°C回落至3°C。最新记录为差值${drift[0]}°C、排温${drift[1]}°C；效果判断同时核对原异响是否重现。${store.getObservationResult('drift').text}`
  ] : [
    `3#缸当前排温${driftTemp}°C，相对其余缸平均值高${driftDelta}°C。${store.monitorStep.drift ? '偏差由8°C扩大至10°C并出现轻微波动，变化比首次关注更明显。' : '现有偏差尚无现场异常反馈互证，需要继续比较相近转速与负荷样本。'} 单缸相对变化有助于识别与整体负荷升温不同的现象，但不能单独证明喷油器或气阀故障。`,
    store.todoCreated.drift && store.progress.drift >= 2 ? '现场读数与系统一致、异响可复现，已确立需要响应的异常。后续通过喷雾形态、积炭、回油及气阀密封等证据区分候选原因；异常成立不等于根因已确定。' : '当前排温仍低于案例既有的450°C AMS报警线，但未报警不能代替异常核实。人工补证先回答读数是否真实、现场现象能否复现；只有确认需要响应后，才在事件中排查原因。'
  ]
  return { conclusion, recommendation, basis, readings: {fault, drift, bearing},
    summary: [{label:'结论',tone:'blue',text:conclusion},{label:'建议',tone:'amber',text:recommendation},{label:'判断依据',tone:'gray',text:basis}],
    sections: [
      {title:'冷却系统：用温度与流量联合判断',paragraphs:coolingAnalysis},
      {title:'3#缸：先确认异常，再收敛原因',paragraphs:driftAnalysis},
      {title:'轴承：趋势与计划共同支持提前评估',paragraphs:bearingDone ? [`换件前振动3.0 mm/s、温度约65°C，验收首测为2.2 mm/s、64°C。最新记录为${bearing[0]} mm/s、${bearing[1]}°C；判断重点是回落能否在相近工况下持续保持，而非单次读数下降。`, store.getObservationResult('maintenance').text] : ['近7日振动从2.1升至3.0 mm/s，增幅约43%，温度约65°C且未同步明显上行。连续变化值得提前核验，但尚不能区分间隙、润滑、载荷或测点固定的影响，更不能由增幅直接推断剩余寿命。', store.progress.maintenance >= 2 ? '现场已确认轴瓦轻微偏磨、间隙接近计划检修上限及备件可用，提前建议获得了实物证据支持。后续按人员确认结果执行保养，持续效果仍回到原振动与温度口径验证。' : '累计运行1,860 h，距2,000 h周期节点约140 h。约48小时后的靠港是可评估的作业机会；先核验测点、润滑与可见检查结果，必要时按设备规程补充间隙及轴瓦检查，再决定是否提前保养。']},
      {title:'其余关注：比较连续证据，减少无效介入',paragraphs:[store.monitorStep.stable >= 2 ? '海水冷却泵压力波动末轮收敛至0.39–0.40 MPa，关联流量、水温未同步恶化，专项观察已收束。' : '海水冷却泵压力在0.38–0.41 MPa间小幅波动，关联流量与水温没有同步恶化。现阶段继续自动比较样本；若波动扩大并出现关联量变化，再请求现场核实。', '主机机体X向振动2.7→2.8→2.8 mm/s，Y向未同步抬升，尚无持续扩大证据；2#缸排温420→421→420°C、相对差1→1→0°C，已结束专项观察。这两项分别保持 AI 跟踪和观察已结束状态。']}
    ] }
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
