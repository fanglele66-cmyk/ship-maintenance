import additionalScenarios from './additionalScenarios.json'
import {workflowCases} from './fourStoryWorkflow.js'
// 二期演示只保留四条可讲完整的故事。数值用于产品交互模拟，不作为船舶运行判断依据。
export const attentionItems = [
  {
    id: 'maintenance', device: '主机 · 1#缸连杆轴承', title: '主机1#缸连杆轴承建议提前维保',
    kind: '预测性维保', tone: 'blue', tab: 'maintenance',
    short: '距周期检修约140运行小时；轴承振动持续上行，建议利用本航次靠港窗口先检查。',
    evidence: ['累计运行 1,860 h；周期检修节点 2,000 h', '近7日轴承振动由 2.1 升至 3.0 mm/s；系统尚未触发振动报警', '下一靠港窗口约在48小时后，可评估是否安排检查'],
    judgement: '目前不能直接判定必须换件。先核对实际磨损和备件条件，再决定是否提前保养。',
    question: '需要我建立一条“提前维保检查”待办，供轮机员现场确认吗？请回复“确认建立待办”。'
  },
  {
    id: 'stable', device: '主机 · 海水冷却泵', title: '海水冷却泵出口压力轻微波动',
    kind: '普通运行数据', tone: 'blue', tab: 'data',
    short: '连续样本波动未扩大，流量与水温无同步恶化，由系统继续跟踪。',
    evidence: ['出口压力在0.38–0.41 MPa间小幅波动，连续样本未扩大', '流量与冷却水温没有同步恶化', '系统安排连续三次同工况比对'],
    judgement: '当前证据不足以形成异常事件，也没有明确检修动作。',
    question: '我会继续比较同工况数据，有新的观测结果时会主动推送；目前无需人工介入。'
  },
  {
    id:'cyl4-watch', device:'主机 · 4#缸', title:'主机4#缸排温相对偏差反复出现',
    kind:'持续监测', tone:'blue', tab:'attention',
    short:'与此前不同的相对偏差在多个可比片段中反复出现，暂未扩大；系统继续比较，当前无需操作。',
    evidence:['多个独立可比片段反复出现，区别于单次波动','与此前可比表现不同，尚未继续扩大','长期及维护后参考未取得，不确诊部件故障'],
    judgement:'值得持续跟踪，但不直接要求检查或换件。',
    question:'我会继续比较本缸历史与缸间差异；重要新证据出现时再提出具体要求。'
  },
  {
    id: 'drift', device: '主机 · 3#缸', title: '主机3#缸排温偏离渐高',
    kind: '持续监测', tone: 'yellow', tab: 'attention',
    short: '初期多个可比片段反复偏离，后续偏差扩大并出现波动变化，需要现场核实。',
    evidence: ['初期多个独立可比片段反复呈现相对偏差，与此前表现不同', '后续新增片段偏差扩大并出现波动变化', '暂无确认根因；需要现场补证'],
    judgement: '先观察偏差是否继续扩大；若出现新事实，再请船员补充现场证据。',
    question: '目前先由系统持续跟踪；如果偏差继续扩大，我会主动请你核对现场读数和可复现现象。'
  },
  {
    id: 'cyl2-ended', device: '主机 · 2#缸', title: '主机2#缸排温偏差观察已结束',
    kind: '持续监测', tone: 'blue', tab: 'attention',
    short: '原反复偏差在后续有效可比片段中收敛，未再反复出现；本轮观察结束，没有检修执行。',
    evidence: ['最初反复偏差与此前表现不同，形成关注依据', '后续有效可比片段中原偏差收敛，未再反复出现', '没有新增相关异常证据；本轮没有检查或维修'],
    judgement: '变化幅度未持续扩大，且与其余缸差值稳定收敛；本轮专项观察结束，不生成待办。',
    question: '本轮观察已结束，恢复常规监测。如后续再次出现持续偏离或现场异响，可重新发起关注。'
  },
  {
    id: 'vibration-trend', device: '主机 · 机体振动', title: '主机机体振动轻微波动',
    kind: '普通运行数据', tone: 'blue', tab: 'data',
    short: 'X向振动小幅变化后持平，尚无独立建档依据；保留为普通运行数据。',
    evidence: ['X向采集值近三轮：2.7 → 2.8 → 2.8 mm/s', 'Y向读数未见同步抬升', '暂未出现持续单向变化或现场异常反馈'],
    judgement: '单点变化幅度有限，且未见关联方向同步抬升；证据不足以要求人工检查，继续自动跟踪。',
    question: '目前由系统继续比较同工况趋势，无需建立待办。如有机体异响或振动手感变化，请补充现场现象。'
  }
]

export const maintenancePlans = [{
  id: 'main-engine-bearing-overhaul',
  device: '主机 · 1#缸连杆轴承',
  title: '1#缸连杆轴承周期检修',
  kind: '常规维保计划',
  currentHours: 1860,
  dueHours: 2000,
  remainingHours: 140,
  window: '下一靠港窗口约48小时后',
  basis: '按设备周期计划，累计运行达到2,000 h时安排检修。当前累计1,860 h，剩余约140 h。',
  status: '计划内',
  note: '这是周期计划条目。提前维保建议需经人工确认后，才会建立独立待办任务链。'
}]

export const scenarioCases = {
  maintenance: {
    id: 'maintenance', cardType: '异动跟踪', workflowKind: 'maintenance', parentIssueId: 'bearing-health', initialTitle: '主机1#缸连杆轴承提前维保', device: '主机 · 1#缸连杆轴承', priority: '建议提前',
    stages: [
      { id: 'overview', label: '建议速览', kind: 'overview', title: '建议在靠港窗口前确认轴承磨损', summary: '振动缓升与剩余运行小时数共同提示提前检查价值；系统尚未触发振动报警。', evidence: ['运行 1,860 / 2,000 h', '振动 2.1 → 3.0 mm/s，近7日约上升43%', '约48小时后有靠港检修窗口'], judgement: '先检查实际磨损；若磨损可见且备件齐备，再把计划检修提前。', action: '进入提前检查', reply: '先检查轴瓦表面、间隙与润滑情况。检查结论决定是否提前保养。' },
      { id: 'check', label: '检查', kind: 'check', title: '确认是否具备提前维保依据', summary: '核实轴瓦磨损、间隙和备件状态，判断是否具备提前保养条件。', evidence: ['需在安全停机与隔离后执行', '备件清单：1#缸连杆轴承轴瓦一套'], tasks: [{ label: '查看轴瓦表面磨损', guide: '记录拉伤、剥落或偏磨情况。' }, { label: '测量轴承间隙并核对备件', guide: '记录间隙测量值与备件状态。' }], judgement: '现场见轻微偏磨，间隙接近计划检修上限，备件可用；具备提前处理依据。', action: '提交检查并安排保养', reply: '已记录轻微偏磨及备件可用。建议在本次靠港窗口提前更换轴瓦。' },
      { id: 'service', label: '保养换件', kind: 'work', title: '提前更换1#缸连杆轴承轴瓦', summary: '核对作业准备、执行换件并记录复测结果。', evidence: ['关联船管工单：以人员确认的选择为准', '更换轴瓦一套，复核间隙并记录润滑状态'], tasks: [{ label: '停机隔离并复核备件', guide: '核对作业许可与轴瓦型号。' }, { label: '更换轴瓦并复测间隙', guide: '记录更换与复测结果。' }], judgement: '更换后需观察振动是否回到处理前的稳定区间。', action: '提交保养并完成处理', reply: '保养与验收记录已保存，本轮人工任务已处理。设备态势将持续跟踪振动与轴承温度，案例材料按事件来源自动汇集。' },
      { id: 'observe', label: '效果观察', kind: 'observe', title: '换件后的48小时观察窗口', summary: '对照最初振动缓升的证据，验证提前维保是否有效。', evidence: ['振动由换件前 3.0 回落至 2.2 mm/s', '轴承温度保持 62–65°C', '同工况连续48小时未再次抬升'], judgement: '原先关注的振动趋势已回落并稳定，可确认本次提前保养有效。', action: '确认闭环归档', reply: '观察窗口已完成；振动与温度均稳定，本次提前维保闭环。' },
      { id: 'closed', label: '完整闭环', kind: 'closed', title: '提前维保已闭环', summary: '从趋势建议、人工检查、换件到效果观察的证据已接续归档。', evidence: ['触发：振动缓升 + 计划检修临近', '现场：轴瓦轻微偏磨', '处理：提前更换轴瓦', '效果：振动回落且48小时稳定'], judgement: '如后续振动重新上升，可从本次记录继续追踪。' }
    ]
  },
  drift: {
    id: 'drift', cardType: '异动跟踪', initialTitle: '主机3#缸排温偏离检查', eventTitle: '主机3#缸排温异常', device: '主机 · 3#缸', priority: '关注核实',
    stages: [
      { id: 'attention', label: '任务概览', kind: 'overview', title: '偏差扩大后的现场证据请求', summary: '系统发现排温偏差从8°C扩大到10°C，伴轻微波动；仍未达到450°C告警线。', evidence: ['同工况相对差 8 → 10°C', '当前排温 432°C；AMS告警线 450°C', '系统无法仅凭该数据确认真实异常'], judgement: '请轮机员检查异响、振动与仪表读数，确认是否需要响应。', action: '进入现场检查', reply: '请核对现场仪表读数，并补充异响与振动是否可复现。' },
      { id: 'check', label: '检查', kind: 'check', title: '辅助确认异动是否真实且需要响应', summary: '先确认排温偏差是否真实、是否需要响应。', evidence: ['先核对现场仪表与采集值', '再查看3#缸附近是否有可复现异响'], tasks: [{ label: '核对现场排温读数', guide: '对比现场仪表与系统采集值。' }, { label: '观察3#缸异响与振动', guide: '记录现场现象能否复现。' }], judgement: '现场仪表与系统一致，轻微异响可复现；异动真实，建议确立异常事件。', action: '确认异常并形成事件', reply: '现场读数一致且异响可复现，已确认主机3#缸排温异常需要响应。接下来结合候选原因安排排查。' },
      { id: 'event', label: '事件概览', kind: 'overview', title: '主机3#缸排温异常已确立', summary: '由先前异动跟踪与现场检查接续形成，保留了8→10°C及异响证据。', evidence: ['来源：持续监测异动跟踪', '确立依据：现场仪表一致 + 异响可复现', '事件响应：安排针对性排查'], judgement: '喷油器雾化不良可能性较高，排气阀密封不良次之；现场仪表核对已降低测点偏差的可能性。', action: '进入排查', reply: '请先排查喷油器雾化与回油，再核对排气阀密封。' },
      { id: 'investigate', label: '排查', kind: 'check', title: '排查导致排温异常的原因', summary: '已确认排温异常，接下来缩小根因范围。', evidence: ['作业前停机隔离与高压油管泄压', '结合异常缸与相邻缸同工况对比'], tasks: [{ label: '校验3#缸喷油器雾化', guide: '检查喷孔积炭及喷雾形态。' }, { label: '检查排气阀密封', guide: '记录密封检查结果。' }], judgement: '喷油器喷孔积炭与现象吻合，排气阀未见异常；建议检修喷油器。', action: '提交排查并进入维修', reply: '根因范围收敛到喷油器雾化不良，进入维修处理。' },
      { id: 'repair', label: '维修', kind: 'work', title: '清洁并校验3#缸喷油器', summary: '记录维修准备、喷油器处理与复装校验结果。', evidence: ['备件：喷嘴组件一套（备用）', '作业：拆检、清洁或更换喷嘴、校验喷雾形态'], tasks: [{ label: '拆检喷油器并处理积炭', guide: '记录拆检发现和处理内容。' }, { label: '复装后校验喷雾与密封', guide: '记录复装校验结果。' }], judgement: '维修完成后仍需看同工况排温偏差和异响是否消失。', action: '提交维修并完成处理', reply: '喷油器处理与验收已记录，本轮人工任务已处理。排温差与异响的持续效果在设备态势中自动跟踪。' },
      { id: 'observe', label: '效果观察', kind: 'observe', title: '维修后的24小时观察窗口', summary: '用最初的排温差与现场异响作为相同的验证口径。', evidence: ['同工况排温相对差 10 → 3°C', '3#缸异响未再复现', '24小时内排温维持稳定'], judgement: '处置效果与根因判断一致，可闭环。', action: '确认闭环归档', reply: '排温偏差和异响均已收束，事件完成观察并归档。' },
      { id: 'closed', label: '完整闭环', kind: 'closed', title: '异动跟踪接续事件并闭环', summary: '状态关注、人工检查、事件确立、排查、维修、效果观察共用同一证据链。', evidence: ['关注：8→10°C', '检查：仪表一致、异响可复现', '排查：喷油器积炭', '维修及观察：偏差回落至3°C'], judgement: '案例材料已自动汇集并关联来源事件，待岸端审阅。' }
    ]
  },
  fault: {
    id: 'fault', cardType: '报警事件', initialTitle: '主机冷却水温异常偏高', device: '主机 · 冷却系统', priority: '立即处理',
    stages: [
      { id: 'event', label: '事件概览', kind: 'overview', title: '主机冷却水温异常偏高', summary: '冷却水出口温度92.4°C，超过85°C阈值，已触发故障告警。', evidence: ['出口温度 92.4°C；上限 85°C', '冷却水流量 68.2 m³/h；要求 ≥80 m³/h', '进口温度 48.7°C，基本稳定'], judgement: '流量下降与温升同步出现，海水滤器堵塞可能性较高；优先核对滤器压差和脏污。', action: '进入排查', reply: '建议先检查海水滤器压差和滤芯情况。' },
      { id: 'investigate', label: '排查', kind: 'check', title: '定位冷却水温升原因', summary: '已确定故障现象，继续排查导致温升的原因。', evidence: ['按照主机负荷和安全条件安排检查', '复核现场仪表与系统读数，并记录阀位和压差'], tasks: [{ label: '检查海水滤器压差与滤芯', guide: '记录滤器压差和滤芯脏污情况。' }, { label: '检查温控阀动作', guide: '记录温控阀动作情况。' }], judgement: '滤器堵塞导致流量不足，与出口温升吻合。', action: '提交排查并进入维修', reply: '原因指向海水滤器堵塞，建议清洗滤器并复测流量。' },
      { id: 'repair', label: '维修', kind: 'work', title: '清洗海水滤器并恢复流量', summary: '记录隔离、清洗、复装和复测。', evidence: ['滤芯可清洗，备用密封圈一套', '复测流量目标 ≥80 m³/h'], tasks: [{ label: '隔离并清洗海水滤器', guide: '记录隔离与清洗完成情况。' }, { label: '复装并复测流量', guide: '记录复装与流量复测结果。' }], judgement: '作业完成后仍需观察温度与流量稳定性。', action: '提交维修并完成处理', reply: '滤器清洗与复测已保存，本轮人工任务已处理。设备态势接续24小时效果观察，案例材料按来源事件自动整理。' },
      { id: 'observe', label: '效果观察', kind: 'observe', title: '闭环前24小时观察窗口', summary: '对照处理前温度与流量，在同工况下持续确认维修效果。', evidence: ['流量 68.2 → 86.5 m³/h', '出口温度 92.4 → 79.1°C', '同工况连续24小时无再次升高'], judgement: '流量与温度均恢复并稳定，可以确认闭环；若再次升温，应延长观察并重新排查。', action: '确认闭环归档', reply: '观察窗口已完成，流量和温度稳定，本次故障可闭环。' },
      { id: 'closed', label: '完整闭环', kind: 'closed', title: '主机冷却水故障已闭环', summary: '故障告警、原因排查、清洗处置和效果观察均已记录。', evidence: ['告警：92.4°C', '根因：海水滤器堵塞', '处置：清洗滤器', '观察：24小时温度与流量稳定'], judgement: '处置与观测材料自动关联来源事件，待岸端审阅。' }
    ]
  }
}

for (const scenario of additionalScenarios) scenarioCases[scenario.id] = scenario
Object.assign(scenarioCases, workflowCases)
