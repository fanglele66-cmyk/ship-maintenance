import history from './baselineHistory.json' with {type:'json'}
const commonSource={id:'baseline-readings',title:'六缸排温与主机转速原始采样',date:history.source.firstSample+'—'+history.source.lastSample,kind:'传感器采样',summary:'按原时标保留六缸排温、转速及相关通道。月度统计筛选主机转速 102–104 RPM、六缸排温 250–500°C，共 120,798 条同刻配对记录。'}
export const cylinderOneBrief={
 id:'real-tracking-exhaust-baseline',title:'一缸排温长期基线抬升跟踪',baselineCylinder:1,
 evidenceCutoff:'2026-08-12 11:39:59',
 discovery:{kind:'ai-data-analysis',label:'AI长期基线分析发现',at:'2026-08-12 12:00',text:'AI复核一缸排温的月度缸间偏差：年初接近其余五缸均值，4 月后相对偏高并延续至 8 月。该变化跨越多个航次，应核对热平衡、测温通道及期间调整记录。'},
 conclusion:'一缸相对其余五缸均值的排温偏差，由 1—3 月的 −1.31～+1.40°C，抬升至 4—8 月的 +6.36～+8.93°C，形成持续的基线变化。尚不能仅凭趋势区分燃烧分配变化、测温偏移或已知固有差异。',
 facts:[
  {label:'年初相对基线',value:'−1.31～+1.40',unit:'°C',at:'2026-01—03',meaning:'一缸减去同刻其余五缸均值，再按月平均；年初围绕零偏差变化。',sourceIds:['baseline-readings']},
  {label:'4—8 月相对偏差',value:'+6.36～+8.93',unit:'°C',at:'2026-04—08',meaning:'4 月开始相对其余五缸均值明显抬升，连续数月保持偏高；8 月为已覆盖样本。',sourceIds:['baseline-readings']},
  {label:'较其他缸最高值',value:'+2.21 / +4.42',unit:'°C',at:'2026-07 / 08',meaning:'按每个时刻的其余五缸最高值比较，月均偏差到 7 月才转为正；不能说一缸从年初起始终最高。',sourceIds:['baseline-readings']},
  {label:'8 月 4 日同窗复核',value:'+10.61',unit:'°C',at:'2026-08-04 17:00:14—22:59:49',meaning:'一缸均温 380.33°C，其余五缸均温 369.72°C；该 6 小时未呈持续加速升温，不能与月度基线抬升混为短时恶化。',sourceIds:['baseline-report']},
 ],
 captainDecision:'决定是否安排一缸热平衡与测温基线核实，指定负责人补充 4—7 月调整和校验记录；依据核实结果决定沿用已知基线、修正测量偏差或开展专项检查。',
 dispatchBrief:{goal:'查明一缸月度排温偏差抬升能否由既有热平衡、测温或运行调整解释。',expectedFeedback:'提交月度工况对照、测温通道核对及期间喷油器/排气阀/负荷平衡调整记录；区分已解释变化与尚需专项检查的方向。'},
 dispatchReason:'同刻缸间比较已降低共同升温的影响，但无法替代负荷、燃油、Pmax 和测温校验记录。需要现场信息决定是否保持观察或形成进一步检查需求，避免把长期差异直接写成部件故障。',
 tasks:[
  {title:'核对月度工况与历史调整',detail:'对照 1—8 月转速、负荷、燃油及航行条件，核查 4—7 月喷油器、排气阀、Pmax 平衡和测温通道调整记录。'},
  {title:'核实排温通道与燃烧平衡',detail:'核对一缸探头位置、连接、独立校验与六缸同刻读数；在批准条件下补充 Pmax、压缩压力、烟色及喷射响应资料。'},
  {title:'提交基线解释与后续范围',detail:'分别登记已知固有差异、测温偏移、运行影响和仍需核实项；只有检查证据支持时，提出对应喷油或排气机构检查。'},
 ],
 branches:[
  {condition:'历史记录能够解释变化，测温核对一致',next:'由轮机长确认变化解释与适用工况，闭环本次异动事件，设备继续常规健康监测。'},
  {condition:'存在通道差异或燃烧平衡异常线索',next:'形成校验或专项维保建议，轮机长确认责任人、范围与计划窗口后生成关联任务并闭环本事件；实际作业与验收由维保任务继续。'},
  {condition:'历史调整或独立核验资料不足',next:'保存观察期限、关注指标、负责人及下次判断条件。提交观察结果后，由轮机长重新决定闭环、维保或延长观察。'},
 ],
 sources:[commonSource,{id:'baseline-report',title:'一缸温度异常轮机长确认问题清单',date:'2026-08-04 / 月度复核至 08-12',kind:'轮机长确认问题清单',summary:'原问题清单及配图，含 1—8 月三种缸间比较方法和现场确认项目。',records:[{label:'原观测时段',value:'2026-08-04 17:00:14—22:59:49，1,179 个样本'},{label:'一缸排温',value:'375.2–385.9°C；均值 380.33°C'},{label:'其余五缸均温',value:'369.72°C'},{label:'需轮机长确认',value:'历史排温差异；4—7 月喷油器、排气阀、Pmax 平衡及温度传感器校验情况'}]}],
 boundary:'同转速筛选不等于负荷和燃油条件完全一致。扫气温差长期稳定，冷却水与活塞油未支持一缸同步恶化；趋势成立不等于故障确诊。',
}

export const cylinderFourBrief={
 id:'real-health-c4-baseline',title:'四缸排温相对基线下移跟踪',baselineCylinder:4,
 evidenceCutoff:'2026-08-12 11:39:59',
 discovery:{kind:'ai-data-analysis',label:'AI长期基线分析发现',at:'2026-08-12 12:00',text:'AI对六缸同刻采样进行月度复核，发现四缸与其余五缸的相对排温关系在 6 月发生下移，7—8 月仍未回到 3—5 月的相对水平。需核对是否与负荷分配、燃油及测温通道变化有关。'},
 conclusion:'四缸相对其余五缸均值由 5 月 +4.79°C 降至 6 月 −6.44°C，月间下移 11.23°C；7、8 月分别为 −2.58、−2.53°C。绝对排温并非持续下降，需核实相对基线变化原因，再评估是否提前检查。',
 facts:[
  {label:'3—5 月相对基线',value:'+4.79～+5.06',unit:'°C',at:'2026-03—05',meaning:'四缸高于同刻其余五缸均值约 5°C，形成可对照的历史相对水平。',sourceIds:['baseline-readings']},
  {label:'5→6 月偏差变化',value:'−11.23',unit:'°C',at:'2026-05→06',meaning:'相对偏差从 +4.79°C 变为 −6.44°C；这是缸间差变化，不是四缸绝对排温下降 11.23°C。',sourceIds:['baseline-readings']},
  {label:'7 / 8 月相对偏差',value:'−2.58 / −2.53',unit:'°C',at:'2026-07 / 08',meaning:'较 6 月有所回升，但仍处在其他缸均值以下，尚未恢复至 3—5 月相对水平。',sourceIds:['baseline-readings']},
  {label:'月度有效样本',value:'4,789 / 12,235',unit:'条',at:'2026-06 / 08',meaning:'各月覆盖不同；6 月样本较少，8 月最后有效样本为 08-07。需结合负荷与燃油分布确认可比性。',sourceIds:['baseline-readings']},
 ],
 captainDecision:'确认是否派发四缸测温与燃烧平衡检查评估，要求先核对月度工况和历史调整，再明确检查必要性、备件与停机窗口；不依据相对降温直接批准换件。',
 dispatchBrief:{goal:'评估四缸相对基线下移是否需要提前开展测温校验或燃烧平衡检查。',expectedFeedback:'提交工况可比性、历史调整、测温通道及燃烧平衡资料；分别说明提前检查依据和实施条件。'},
 dispatchReason:'变化已跨月持续，单次读数恢复不足以解释；同一时期其他缸也可能变化，因此必须结合六缸热平衡及独立校验，决定属于基线重建、通道处理还是局部设备检查。',
 tasks:[
  {title:'核实相对下移与历史调整',detail:'核对 5—8 月负荷、燃油和各缸调整记录，确认变化时段及各月采样覆盖；不单独用一缸作为不变参照。'},
  {title:'评估测温与燃烧检查范围',detail:'先查四缸排温通道，结合 Pmax、压缩压力、喷射响应和排气阀检查记录判断是否需要专项处理。'},
  {title:'核对实施条件与验收安排',detail:'明确校验仪、探头或配套密封备料、批准范围及停机隔离窗口；验收保留同工况六缸数据和仍未解释的偏差。'},
 ],
 branches:[
  {condition:'有专项检查依据，需要推动维保',next:'形成维保建议，确认责任人、范围、计划窗口与条件安排后闭环本事件；关联维保任务独立执行并保留结果。'},
  {condition:'有检查必要但条件不具备',next:'保留待安排需求，落实校验设备、备件或停机窗口，继续月度跟踪。'},
  {condition:'已有合理基线解释',next:'轮机长确认解释与依据后闭环本次异动事件，常规健康监测继续；不强制修正至零温差。'},
  {condition:'原因或影响仍不明确',next:'提交观察期限、关注指标、负责人及下次判断条件。补充观察结果后重新确认处置。'},
 ],
 sources:[commonSource],
 boundary:'该变化由同刻数据库记录重新计算，并无四缸部件失效或维修完成记录。其他缸的变化会影响参照均值，必须结合工况、校验与现场检查判断原因。',
}

export const baselineBriefings={
 [cylinderOneBrief.id]:cylinderOneBrief,[cylinderFourBrief.id]:cylinderFourBrief,
 'real-maintenance-c4-baseline':{...cylinderFourBrief,id:'real-maintenance-c4-baseline',parentIssueId:cylinderFourBrief.id,title:'四缸测温与燃烧平衡检查评估'},
 'real-maintenance-c1-baseline':{...cylinderOneBrief,id:'real-maintenance-c1-baseline',parentIssueId:cylinderOneBrief.id,title:'一缸测温与燃烧平衡专项检查'},
}
