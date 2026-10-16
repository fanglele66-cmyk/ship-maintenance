import { attentionFollowup, maintenanceFollowup } from './phase2Followup.js'
import { r02Report, r02Telemetry } from './r02Stories.js'
import { attentionClosure } from './attentionClosure.js'
import { observationConfig } from './phase2Observation.js'

// Presentation adapter only. All samples remain demo evidence, not real telemetry.
export function attentionDossier(store, id) {
  const handled=store.isTaskHandled(id), item=store.attention.find(item=>item.id===id)
  if ((!item || item.tab!=='attention') && !handled) return null
  const action=store.attentionAction(id)
  const report=id==='maintenance'?maintenanceFollowup(store):id==='fault'?{conclusion:store.getObservationResult(id).text,sections:[],timeline:[],arrangement:[]}:attentionFollowup(store,id)
  const observation=handled?store.getObservationResult(id):null
  // Observation samples have one canonical source; do not repeat report-derived copies.
  const records=[...(report.timeline||[])].filter(record=>!handled || !/^(每日回顾 · 效果验证|建议更新 · 效果反复|补证请求 · 数据不足|当前效果建议)$/.test(record.label)).map(record=>record.label==='处理完成 · 转回观察'?{...record,assessment:'验收首测已有改善，进入处理后观察；单次首测不能确认长期稳定。',current:false}:record)
  if(handled) {
    for(const round of store.observationHistory[id]) for(const r of round.records) records.push({label:`第${round.round}轮 · ${r.label}`,at:r.label,actor:'处理后观察',text:r.note||'已记录观测',assessment:r.values?.join(' / ')||'缺少可比记录'})
    for(const r of store.observationRecords[id]) records.push({label:r.label,at:r.label,actor:['abnormal','incomplete'].includes(r.status)?'现场反馈':'AI 效果观察',text:r.note||'本次观测已记录',assessment:r.values?observationConfig[id].names.map((n,i)=>`${n} ${r.values[i]} ${observationConfig[id].units[i]}`).join('；'):'缺少完整可比记录'})
    if(observation.type==='archive') records.push({label:'本轮观察结束',at:records.at(-1)?.at||'观察窗口结束',actor:'系统',text:observation.text,assessment:'恢复常规监测，来源事件与工单不因此自动关闭。'})
  }
  const closure=attentionClosure(store,id,records)
  if(closure) {
    const terminal={id:`${id}-system-ended`,label:'系统确认事项结束',at:closure.at,actor:'系统',type:'closure',text:closure.summary,assessment:closure.basis.join(' '),closure}
    const previous=records.findIndex(record=>/^(本轮观察结束|观察结束|观察收束)$/.test(record.label))
    if(previous>=0)records.splice(previous,1,terminal)
    else records.push(terminal)
  }
  const analysisRecords=records.filter(record=>/AI|处理后观察|系统/.test(record.actor||''))
  const lastAnalysis=analysisRecords.at(-1)
  const notes=store.dossierNotes?.[id]||[]
  const feedbackIndex=records.findIndex(record=>record.label==='现场核实 · 已提交')
  const earlierNotes=notes.filter(note=>feedbackIndex>=0 && note.createdAt<=store.attentionFeedback[id]?.createdAt)
  if(feedbackIndex>=0)records.splice(feedbackIndex,0,...earlierNotes)
  records.push(...notes.filter(note=>!earlierNotes.includes(note)))
  let charts
  if(handled) {
    const config=observationConfig[id], observations=store.observationRecords[id]
    charts=config.names.map((name,i)=>({name,unit:config.units[i],labels:['处理前',...observations.map(r=>r.label)],values:[config.before[i],...observations.map(r=>r.values?.[i]??null)],reference:'处理前记录；处理后样本需在可比工况下比较'}))
  } else if(r02Report(store,id) || id==='drift') {
    const data=r02Telemetry[id]
    charts=[{name:`${id==='cyl4-watch'?'4':id==='cyl2-ended'?'2':'3'}#缸排温`,unit:'°C',labels:data.labels,values:data.values,reference:'转速94–96 rpm、负荷68%–72%的稳定运行片段'}, {name:'与其余缸均值的差值',unit:'°C',labels:data.labels,values:data.gaps,reference:'同时段其余缸排温均值；不作为通用故障阈值'}]
  } else if(id==='drift') {
    const progressed=store.monitorStep.drift>0
    charts=[{name:'3#缸排温',unit:'°C',labels:progressed?['首次发现','后续比较']:['首次发现'],values:progressed?[428,432]:[428],reference:'相近转速与负荷下的本缸前后记录'}, {name:'与其余缸均值的差值',unit:'°C',labels:progressed?['首次发现','后续比较']:['首次发现'],values:progressed?[8,10]:[8],reference:'同一时段其余缸的平均排温，不是通用健康阈值'}]
  } else if(id==='cyl2-ended') charts=[{name:'2#缸排温',unit:'°C',labels:['第1轮','第2轮','第3轮'],values:[420,421,420],reference:'相近工况下的连续三轮记录'},{name:'与其余缸均值的差值',unit:'°C',labels:['第1轮','第2轮','第3轮'],values:[1,1,0],reference:'同工况其余缸均值'}]
  else if(id==='vibration-trend') charts=[{name:'机体X向振动',unit:'mm/s',labels:['第1轮','第2轮','第3轮'],values:[2.7,2.8,2.8],reference:'相近工况下本测点历史；Y向仅有未同步抬升的文字记录'}]
  else charts=[{name:'泵出口压力范围',unit:'MPa',labels:['首次记录',...(store.monitorStep.stable>=1?['第2轮']:[]),...(store.monitorStep.stable>=2?['第3轮']:[])],values:[],ranges:[ '0.38–0.41',...(store.monitorStep.stable>=1?['未见扩大']:[]),...(store.monitorStep.stable>=2?['0.39–0.40']:[])],reference:'记录为区间，未取得连续采样曲线',rangeOnly:true}]
  const comparisonRows=[
    {name:'近期可比时段',result:charts[0]?.qualitative?'定性阶段说明：此前参考、反复出现与后续变化；原始采样未取得':charts[0]?.rangeOnly?'已有区间及后续变化记录':charts[0]?.values.filter(value=>value!==null).length>1?'已有前后观测节点，见关键指标变化':'目前仅有起始节点，尚不足以判断持续性',scope:'2026/10/06–10/12；仅比较稳定运行片段'},
    {name:'较长期历史',result:'近30天同工况排温相对差通常为3–4°C',scope:'剔除启停、机动及负荷快速变化时段'},
    {name:'相关维护后的稳定阶段',result:handled?'已有处理前与处理后观测，稳定参考尚未单独建立':'本次未取得相关维护后参考',scope:handled?'首测不直接等同稳定基线；实际措施由原事件保留':'缺少相关维护记录及稳定参考时段'},
    {name:'同时刻其他缸或部件',result:id==='cyl4-watch'?'4#缸与其余缸均值差为7–8°C':id==='drift'||id==='cyl2-ended'?'已有与其余缸均值的差值':id==='vibration-trend'?'Y向仅有未同步抬升的文字记录':id==='stable'?'流量与冷却水温仅有文字记录':'本次没有独立横向参考',scope:'同时间窗口、同采集系统测点'}
  ]
  const changeSummary=charts.flatMap(chart=>{
    const values=chart.values,previous=values.at(-2),current=values.at(-1)
    if(chart.rangeOnly || previous==null || current==null || values.length<2)return []
    const difference=Number((current-previous).toFixed(3))
    return [`${chart.name}：${previous} → ${current} ${chart.unit}，${difference===0?'持平':`${difference>0?'增加':'减少'} ${Math.abs(difference)} ${chart.unit}`}`]
  }).join('；') || lastAnalysis?.text || '尚无足够可比节点，不能判断持续性。'
  const tracking={
    focus:handled?observationConfig[id].basis:id==='cyl4-watch'?'比较本缸近期与历史、缸间相对差及相关信号，不因普通波动要求检修。':id==='drift'?'继续比较3#缸排温、缸间相对差及波动，结合现场读数和现象核实变化。':id==='vibration-trend'?'比较X向振动是否持续扩大，留意其他方向与现场现象。':id==='cyl2-ended'?'本轮专项观察已结束，保留原变化及结束依据。':'比较泵出口压力波动与关联流量、水温是否同步变化。',
    next:action.phase==='已结束'?'恢复常规监测；出现新的持续变化或现场现象时重新评估。':'每日08:00回顾近24小时；取得重要新证据或收到现场反馈后补充研判。',
    intervention:action.phase==='已结束'?'后续新变化重新评估，不以本次结束代替未来判断。':handled?'原异常反复或关键记录缺失时请求复查或补证；沿用原事件。':'偏差持续扩大、出现新的关联证据或现场异常时请求人员介入；结合偏差幅度、持续性及关联信号综合判断。',
    limit:'缺少可比数据时保留事项，说明无法充分判断；不按正常处理，也不据此结束观察。'
  }
  return {id,title:handled?(id==='drift'?store.cases[id].eventTitle:store.cases[id].initialTitle)+' · 效果观察':item.title,device:item?.device||'主机 · 冷却系统',action,closure,conclusion:closure?.summary||observation?.text||report.conclusion,background:r02Report(store,id)?report.timeline.find(record=>/建立关注|进入关注/.test(record.label))?.text||item?.short:item?.short||observationConfig[id].basis,report,records,charts,feedback:store.attentionFeedback[id],first:records[0]?.at||'处理验收后',updated:records.at(-1)?.at||'待首测',analysisAt:lastAnalysis?.at||'尚无有效分析',analysisChange:changeSummary,notes,comparisonRows,tracking,observation,
    context:{conditions:store.attentionFeedback[id]?.conditions||'转速94–96 rpm，负荷68%–72%；排除启停及机动时段。',maintenance:handled?'实际处理与验收记录来自关联事件；船管回传记录尚未接入。':'本事项未取得相关实际维护或换件记录，不假设已经维护。'},
    sources:[{label:'观测与分析依据',text:'机舱监测系统 · 逐缸排温、转速及负荷记录；最近更新2026/10/12 08:00。'},{label:'人员反馈',text:'现场核实回执与登记留言；两者分别保留，不将留言当作已核实事实。'},...(store.todoCreated[id]?[{label:'检查、处置与实际措施',text:'由关联事件保留，可进入原事件回看。',event:true}]:[]),{label:'手册及审核案例',text:'主机操作维护手册 · 排气温度监测章节；用于核对监测要求，不作为已确认故障原因。'}]}
}
