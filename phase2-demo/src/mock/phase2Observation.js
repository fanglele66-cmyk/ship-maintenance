import additionalScenarios from './additionalScenarios.json'
import {workflowCases} from './fourStoryWorkflow.js'
import {realObservationContent} from './realScenarioPresets.js'
// 演示观测值：用于呈现时间窗口与建议的关系，不作为设备阈值。
export const observationConfig = {
  maintenance: { days:2, names:['轴承振动','轴承温度'], units:['mm/s','°C'], before:[3.0,65], samples:[[2.2,64],[2.2,64],[2.2,63]], abnormal:[2.9,66], basis:'回应提前保养时的振动缓升判断：对比换件前3.0 mm/s、65°C，跟踪振动回落及轴承温度稳定性。' },
  drift: { days:1, names:['同工况排温差','3#缸排温'], units:['°C','°C'], before:[10,432], samples:[[3,425],[3,425],[3,425]], abnormal:[9,431], basis:'回应原排温偏差扩大的判断：同工况偏差由10°C回落，同时核对原异响是否再次出现。' },
  fault: { days:1, names:['冷却水出口温度','冷却水流量'], units:['°C','m³/h'], before:[92.4,68.2], samples:[[79.1,86.5],[79.1,86.5],[79.1,86.5]], abnormal:[90.8,70.2], basis:'回应冷却能力下降的判断：核对出口温度回落与流量恢复是否同步，观察原异常是否反复。' }
}

for(const item of additionalScenarios)observationConfig[item.id]=item.observation
for(const item of Object.values(workflowCases))observationConfig[item.id]=item.observation

export function observationResult(id, records, targetDays) {
  const config=observationConfig[id], last=records.at(-1)
  if(records.some(record=>record.auto))return automaticObservationResult(records,targetDays)
  if(last?.reviewChoice&&!records.some(record=>record.status==='abnormal')){
    if(last.status==='stable-confirmed')return {type:'archive',title:'持续稳定，待确认闭环',text:'已登记持续稳定的观察判断。请结合已保存的验收、运行记录与现场意见确认本轮闭环；本次确认不新增测点采样。',next:'确认闭环后归档本轮处置与观察记录。'}
    if(last.status==='incomplete')return {type:'extend',extensionApplied:true,title:'资料已记录，观察窗口已延长',text:`本次缺项与补充安排已保存，观察窗口延长至 ${targetDays*24} 小时。待补齐可比资料后继续评估。`,next:'按已记录的安排补充缺项，不以缺测数据判断稳定。'}
    if(last.status==='improving')return {type:'continue',title:'已有改善，继续观察',text:`本次测点读数、工况与观察说明已保存，计划观察窗口为 ${targetDays*24} 小时。继续比较后续可比记录，持续稳定后提交闭环确认。`,next:'继续记录后续观察；原异常反复时返回复查。'}
  }
  if(workflowCases[id]?.realCaseId){
    const result=type=>({type,...realObservationContent(workflowCases[id],type,targetDays)})
    if(records.some(record=>record.status==='abnormal'))return result('reinspect')
    if(last?.status==='incomplete')return result('extend')
    if(last?.status==='extended')return {...result('continue'),title:'窗口已延长，等待补齐可比资料',text:`观察安排已延长至 ${targetDays*24} 小时，尚未因此增加采样；继续补齐同工况记录和现场反馈，再评估是否满足闭环条件。`}
    const presetRecords=records.filter(record=>record.preset&&record.isSimulation&&record.status==='normal')
    if(last?.preset&&last.status==='normal'){
      const covered=presetRecords.length>=2&&presetRecords[0].day===0&&last.day>=targetDays
      return result(covered?'archive':'continue')
    }
    return {...result('continue'),title:last?'记录已保存，待人工判读':'等待处理后可比资料'}
  }
  if(!last) return {type:'continue',title:'等待处理后首测',text:'完成现场验收后开始本轮效果观察。'}
  if(records.some(r=>r.status==='abnormal')) return {type:'reinspect',title:'效果出现反复，建议'+(id==='maintenance'?'返回检查':'重新排查'),text:'后续监测补充了新的异常证据，本轮观察暂不满足收束条件。保留已有记录，核实复发原因后重新处置。'}
  if(last.status==='incomplete') return {type:'extend',title:'证据不足，建议延长观察',text:'本日缺少完整的同工况数据，暂不能判断处理效果是否持续稳定。建议延长24小时，补充可比记录。'}
  if(last.status==='extended') return {type:'continue',title:'窗口已延长，等待补充观测',text:`观察窗口已延长至${targetDays*24}小时，继续补齐每日同工况记录后重新评估效果。`}
  if(last.day<targetDays) return {type:'continue',title:'已有改善，继续观察',text:`当前已记录${last.day*24}小时，计划观察${targetDays*24}小时。当前变化符合处理预期，仍需继续验证稳定性。`}
  const values=config.names.map((name,i)=>`${name}${config.before[i]} → ${last.values[i]} ${config.units[i]}`).join('；')
  return {type:'archive',title:'效果稳定，待确认闭环',text:`${values}。已有记录覆盖${targetDays*24}小时观察窗口，未记录原异常反复。请结合现场情况确认是否闭环，观测达标不自动代替人工确认。`}
}

export function automaticObservationResult(records,targetDays){
  if(records.some(record=>record.status==='abnormal'))return {type:'reinspect',title:'已记录异常，需人工复查',text:'本轮已记录异常复查依据。保留自动采样、实际措施和验收记录，沿原事件继续排查。'}
  const windows=records.filter(record=>record.auto).sort((a,b)=>Date.parse(a.windowEnd)-Date.parse(b.windowEnd))
  let coveredMs=0,nextStart=null
  for(const record of [...windows].reverse()){
    const start=Date.parse(record.windowStart),end=Date.parse(record.windowEnd)
    if(!record.covered||nextStart!==null&&end!==nextStart)break
    coveredMs+=end-start;nextStart=start
  }
  const coveredHours=Number((coveredMs/3600000).toFixed(1)),targetHours=targetDays*24
  if(coveredHours>=targetHours)return {type:'archive',title:'观察资料已覆盖，待人工确认',text:`最近连续 ${coveredHours} 小时采样已覆盖本轮 ${targetHours} 小时观察窗口。数据覆盖不等于确认修复成功；请核对可比工况、原报警及现场验收，再决定本轮是否闭环。`,coveredHours}
  const missing=windows.at(-1)?.status==='incomplete'
  return {type:missing?'extend':'continue',title:missing?'部分测点缺测，自动继续观察':windows.length?'自动观察中，等待覆盖本轮窗口':'自动观察已启动，等待首个两小时汇总',text:`系统每 2 小时更新传感器记录与资料摘要；目前连续完整覆盖 ${coveredHours} / ${targetHours} 小时。${missing?'缺测窗口保留为空，不作稳定或恢复判断。':'当前数据仅说明已采样范围，不自动判定故障已消除。'}`,coveredHours,extensionApplied:missing}
}

export function observationScene(id,records,targetDays){
  const result=observationResult(id,records,targetDays),last=records.at(-1),config=observationConfig[id]
  return {title:'效果观察 · '+(last?.label||'处理后首测'),paragraphs:[{label:'效果判断',text:result.text},{label:'下一步建议',text:result.next||result.title},{label:'监测依据',text:config.basis}],question:result.type==='archive'?'是否确认本轮闭环？观测与人员确认记录将继续关联来源事件。':result.type==='reinspect'?'请沿原事件重新核实，保留前轮记录。':result.type==='extend'?'是否补充可比记录并延长观察？':'继续比较后续可比节点；新的现场现象会关联保留。'}
}
