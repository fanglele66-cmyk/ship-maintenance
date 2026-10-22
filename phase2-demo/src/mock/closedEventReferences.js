// This presentation fixture supplements an existing prototype history entry.
// It is not ship evidence and must never be merged into realCases.json.
const warningHistory = {
 id:'warning-history', dataOrigin:'prototype-reference', sourceRecord:'fourStoryFixtures.history.warning-history',
 label:'参考案例 · 处置回放',
 boundary:'原“本次预警核实不成立”的结论保留。以下派发、复核和签认细节用于补全处置回放，不作为真实船舶维修或闭环凭证。',
 scope:'主机排温预警 · 采集时间与负荷工况核对',
 result:'确认原比较混入负荷切换片段，本次预警不成立；未安排拆检或换件，保留原始快照并继续常规监测。',
 task:{owner:'李建国（大管轮）',assignedBy:'陈志远（轮机长）',at:'2026-10-09 14:10',scope:'核对主机排温采集时刻、负荷切换记录及就地显示，反馈可比范围与资料限制。',result:'现场核实已完成；本次未开展拆检或换件。'},
 feedback:{at:'2026-10-09 15:10',finding:'原比较包含负荷切换片段，现场显示与用于比较的采样时刻未完全对齐。',measure:'标注不可比片段，补充同口径核对说明，保留原预警和采集快照。'},
 acceptance:{actor:'陈志远（轮机长）',at:'2026-10-09 15:40',basis:'原始快照、负荷工况说明、现场核实及比较修正记录完整。',result:'本轮核实要求已完成，现有材料不再支持本次预警判断。'},
 closure:{actor:'陈志远（轮机长）',at:'2026-10-09 16:20',result:'确认本次预警核实不成立，结束本轮处置。',followup:'核实结论以采集时间与工况记录为依据，后续按常规监测；新的可比偏离另行研判。'},
 records:[
  {id:'ref-warning-discovery',kind:'source',phase:'发现',at:'2026-10-09 14:00',actor:'智能机舱监测',role:'assistant',title:'发现排温比较偏离',text:'主机排温比较出现偏离，已关联当时的采集快照和运行背景。当前先记录变化，不把单一排温偏离解释为部件故障。'},
  {id:'ref-warning-analysis',kind:'analysis',phase:'研判',at:'2026-10-09 14:03',actor:'智能机舱研判',role:'assistant',title:'先核对测量时刻与负荷切换',text:'原比较片段可能包含工况变化。需要先核对采集时间、现场记录和负荷，再判断是否仍存在可比工况下的偏离。',assessment:'建议安排现场核实；目前没有支持拆检、换件或故障定位的依据。'},
  {id:'ref-warning-assignment',kind:'assignment',phase:'派发',at:'2026-10-09 14:10',actor:'陈志远（轮机长）',role:'user',title:'确认派发现场核实任务',text:'安排李建国（大管轮）核对主机排温采集时刻、负荷切换记录及就地显示；本次范围只做资料与现场核实，完成后反馈可比范围和限制。',assessment:'已将负责人、核实范围和反馈要求关联到本事件。后续结果沿本次任务记录，不重复派发。'},
  {id:'ref-warning-feedback',kind:'feedback',phase:'执行反馈',at:'2026-10-09 14:45',actor:'李建国（大管轮）',role:'user',title:'提交现场与采集时刻核对结果',text:'已核对采集快照和负荷切换记录，原比较包含切换片段，现场显示与用于比较的采样时刻不完全一致。尚不能把不同工况的排温直接作同口径比较。',assessment:'反馈支持先修正比较范围。保留原片段作为来源，另行选取能够对齐时刻及负荷的记录；不删除原预警。'},
  {id:'ref-warning-execution',kind:'execution',phase:'执行反馈',at:'2026-10-09 15:10',actor:'李建国（大管轮）',role:'user',title:'完成同口径复核并说明实际范围',text:'已标注不可比的负荷切换片段，补充同口径核对说明。本次执行的是数据与现场核实，没有拆检、没有更换部件。',assessment:'剔除不可比片段后，现有材料不再支持原预警判断。结果仅限本次预警核实，不扩大为设备全部健康。'},
  {id:'ref-warning-acceptance',kind:'acceptance',phase:'验收与观察',at:'2026-10-09 15:40',actor:'陈志远（轮机长）',role:'user',title:'确认核实范围与资料完整性',text:'已审阅原始快照、工况说明、现场核实及比较修正记录。确认本次核实要求已完成，原始来源和判断变化均留存。',assessment:'核实任务已完成。本次未开展维修，核实结论以采集时间与工况记录为依据，后续按常规监测。'},
  {id:'ref-warning-observation',kind:'observation',phase:'验收与观察',at:'2026-10-09 16:00',actor:'智能机舱研判',role:'assistant',title:'复核结论与后续监测安排',text:'本轮材料支持“预警核实不成立”。本次未开展维修，原始排温仍按常规监测保留，有新的可比偏离时重新研判。',assessment:'建议结束本次预警核实，保留资料限制，由轮机长确认闭环。'},
  {id:'ref-warning-closure',kind:'closure',phase:'闭环',at:'2026-10-09 16:20',actor:'陈志远（轮机长）',role:'user',title:'确认本次预警闭环',text:'确认本次预警核实不成立，结束本轮处置；保留原始预警、工况差异、实际核实和确认依据，继续常规监测。',assessment:'本事件已闭环，关联核实任务移出待办。完整处置记录保留在事件目录，不代表其他部位或未来工况均已验证正常。'},
 ],
}
export function closedEventReference(id){return id==='warning-history'?warningHistory:null}
