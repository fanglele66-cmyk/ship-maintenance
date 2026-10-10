import { attentionFollowup, maintenanceFollowup } from './phase2Followup.js'
import { observationConfig } from './phase2Observation.js'

// Presentation adapter only. All samples remain demo evidence, not real telemetry.
export function attentionDossier(store, id) {
  const handled=store.isTaskHandled(id), item=store.attention.find(item=>item.id===id)
  if ((!item || item.tab!=='attention') && !handled) return null
  const action=store.attentionAction(id)
  const report=id==='maintenance'?maintenanceFollowup(store):id==='fault'?{conclusion:store.getObservationResult(id).text,sections:[],timeline:[],arrangement:[]}:attentionFollowup(store,id)
  const observation=handled?store.getObservationResult(id):null
  const records=[...(report.timeline||[])]
  if(handled) {
    for(const round of store.observationHistory[id]) for(const r of round.records) records.push({label:`第${round.round}轮 · ${r.label}`,at:r.label,actor:'处理后观察',text:r.note||'已记录观测',assessment:r.values?.join(' / ')||'缺少可比记录'})
    for(const r of store.observationRecords[id]) records.push({label:r.label,at:r.label,actor:['abnormal','incomplete'].includes(r.status)?'现场反馈':'AI 效果观察',text:r.note||'本次观测已记录',assessment:r.values?observationConfig[id].names.map((n,i)=>`${n} ${r.values[i]} ${observationConfig[id].units[i]}`).join('；'):'缺少完整可比记录'})
    if(observation.type==='archive') records.push({label:'本轮观察结束',at:records.at(-1)?.at||'观察窗口结束',actor:'系统',text:observation.text,assessment:'恢复常规监测，来源事件与工单不因此自动关闭。'})
  }
  const messages=(store.logs[id]||[]).filter(r=>r.role==='user'&&r.text&&!/^(查看|进入|现场核实已提交：)/.test(r.text))
  let charts
  if(handled) {
    const config=observationConfig[id], observations=store.observationRecords[id]
    charts=config.names.map((name,i)=>({name,unit:config.units[i],labels:['处理前',...observations.map(r=>r.label)],values:[config.before[i],...observations.map(r=>r.values?.[i]??null)],reference:'处理前记录；处理后样本需在可比工况下比较'}))
  } else if(id==='drift') {
    const progressed=store.monitorStep.drift>0
    charts=[{name:'3#缸排温',unit:'°C',labels:progressed?['首次发现','后续比较']:['首次发现'],values:progressed?[428,432]:[428],reference:'相近转速与负荷下的本缸前后记录'}, {name:'与其余缸均值的差值',unit:'°C',labels:progressed?['首次发现','后续比较']:['首次发现'],values:progressed?[8,10]:[8],reference:'同一时段其余缸的平均排温，不是通用健康阈值'}]
  } else if(id==='cyl2-ended') charts=[{name:'2#缸排温',unit:'°C',labels:['第1轮','第2轮','第3轮'],values:[420,421,420],reference:'相近工况下的连续三轮记录'},{name:'与其余缸均值的差值',unit:'°C',labels:['第1轮','第2轮','第3轮'],values:[1,1,0],reference:'同工况其余缸均值'}]
  else if(id==='vibration-trend') charts=[{name:'机体X向振动',unit:'mm/s',labels:['第1轮','第2轮','第3轮'],values:[2.7,2.8,2.8],reference:'相近工况下本测点历史；Y向仅有未同步抬升的文字记录'}]
  else charts=[{name:'泵出口压力范围',unit:'MPa',labels:['首次记录',...(store.monitorStep.stable>=1?['第2轮']:[]),...(store.monitorStep.stable>=2?['第3轮']:[])],values:[],ranges:[ '0.38–0.41',...(store.monitorStep.stable>=1?['未见扩大']:[]),...(store.monitorStep.stable>=2?['0.39–0.40']:[])],reference:'记录为区间，不提供虚构的连续采样曲线',rangeOnly:true}]
  return {id,title:handled?(id==='drift'?store.cases[id].eventTitle:store.cases[id].initialTitle)+' · 效果观察':item.title,device:item?.device||'主机 · 冷却系统',action,conclusion:observation?.text||report.conclusion,background:item?.short||observationConfig[id].basis,report,records,messages,charts,feedback:store.attentionFeedback[id],first:records[0]?.at||'处理验收后',updated:records.at(-1)?.at||'待首测',observation}
}
