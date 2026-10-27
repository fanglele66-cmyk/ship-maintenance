// Retained prototype history explains why C4 starts at the captain's next
// decision. Only the sampling facts are source evidence; people, timestamps
// and workflow actions below are a demonstration, not real ship receipts.
const eventId='real-health-c4-baseline'
const trackId='real-health-c4-baseline-track'
const origin={isSimulation:true,dataOrigin:'prototype-reference',source:'流程演示补全'}
const feedback=[
 {label:'复核四缸月度相对变化',result:'趋势资料已复核',note:'按已有同刻配对采样复核：5 月相对偏差 +4.79°C，6 月 −6.44°C，7、8 月分别为 −2.58、−2.53°C。6 月样本较少，8 月有效样本截至 08-07；这是缸间相对变化，不能写成四缸绝对温度持续下降。',...origin},
 {label:'核对工况、调整及测温依据',result:'解释范围与资料缺项已记录',note:'现有负荷、燃油及调整资料尚不足以完整解释跨月变化，独立测温校验原始记录仍待补充。当前未取得支持四缸探头、喷油器或排气阀失效的检验依据，不登记已经维修或故障已排除。',...origin},
]
const summary='首轮趋势与背景核实已回交，四缸相对基线变化保留；原因解释及独立校验仍有缺项，等待轮机长确认下一步处置。'
const decision='按首轮已覆盖的采样复核和资料核对范围结束本次核实，保留工况、调整及独立校验缺项；提交轮机长决定确认解释、安排专项维保或继续观察，尚未开展维修及修后效果观察。'
const record=(key,kind,title,at,actor,text,assessment='')=>({
 id:`${eventId}:reference:${key}`,eventId,taskId:eventId,rootId:trackId,
 kind,title,label:title,at,storyAt:at,actor,text,assessment,processRound:1,...origin,
})
const c4Reference={
 id:'real-health-c4-baseline:prior-process',eventId,trackId,at:'2026-08-12 14:20:00',actor:'李建国（大管轮）',
 status:'review',summary,decision,feedback,...origin,
 records:[
  record('assignment','assignment','首轮派发：核实四缸基线与运行背景','2026-08-12 12:15:00','陈志远（轮机长）',
   '指定李建国（大管轮）复核四缸 5—8 月相对排温变化及六缸同刻采样，核对负荷、燃油、喷油器/排气阀调整与测温维护资料。分别提交能够解释的范围、尚缺依据及进一步检查需求。',
   '本轮安排资料与非侵入核实；拆检、校验或换件须根据核实结果另行明确范围和条件。'),
  record('feedback','feedback','首轮核实反馈：趋势保留，解释依据仍待补充','2026-08-12 14:10:00','李建国（大管轮）',
   feedback.map(item=>`${item.label}：${item.result}。${item.note}`).join('\n\n')),
  record('analysis','analysis','首轮反馈后的研判：明确剩余检查需求','2026-08-12 14:15:00','智能机舱研判',
   '月度统计可以追溯，但同转速筛选不能代替负荷、燃油和独立测温核验。其他缸的变化也会影响参照均值，现有反馈尚不能将相对下移归因于具体部件。',
   '建议先补独立测温与运行调整依据，再按新增证据决定燃烧平衡专项检查范围。当前形成的是待轮机长确认的检查需求，不代表已经维保或验收通过。'),
  record('handoff','decision','首轮核实回交：等待轮机长处置决策','2026-08-12 14:20:00','李建国（大管轮）',decision,summary),
 ],
}

function freeze(value){
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}
 return value
}
export const trackingProcessReferences=freeze([c4Reference])

// Only the root event and its health-track view receive this prior process.
// Maintenance tasks retain their own independent execution history.
export function trackingProcessReference(id){
 const reference=trackingProcessReferences.find(item=>item.eventId===id||item.trackId===id)
 return reference?JSON.parse(JSON.stringify(reference)):null
}
