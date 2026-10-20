import additionalScenarios from './additionalScenarios.json'
import {workflowCases} from './fourStoryWorkflow.js'
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
  if(workflowCases[id]?.realCaseId){
    if(records.some(record=>record.status==='abnormal'))return {type:'reinspect',title:'现场反馈有异常，待复查',text:'人员已记录异常现象；沿同一事项继续核查。补录值不能替代实际检验，历史档案的结论保持不变。'}
    if(last?.status==='incomplete')return {type:'extend',title:'资料不足，继续补充',text:'已保存缺项或不可比条件，可以延长跟踪安排并补充资料；延长安排不等于已经取得新的可比采样。'}
    const presetRecords=records.filter(record=>record.preset&&record.isSimulation&&record.status==='normal')
    if(last?.preset&&last.status==='normal'){
      const covered=presetRecords.length>=2&&presetRecords[0].day===0&&last.day>=targetDays
      return covered?{type:'archive',title:'效果稳定，待人工确认闭环',text:'观察记录已覆盖本轮观察窗口，未记录原异常反复。请结合现场情况确认是否闭环，观测达标不自动代替人工确认。'}:{type:'continue',title:'已有改善，继续观察',text:'当前观察记录尚未覆盖目标窗口，继续补充后续同工况观测，核对改善是否持续。'}
    }
    return {type:'continue',title:last?'记录已保存，待人工判读':'等待处理后可比资料',text:'补充记录已保存，仍需核对测量工况、观察时长及现场结果。单点恢复不足以确认持续稳定，请补齐可比资料并记录效果判断。'}
  }
  if(!last) return {type:'continue',title:'等待处理后首测',text:'完成现场验收后开始本轮效果观察。'}
  if(records.some(r=>r.status==='abnormal')) return {type:'reinspect',title:'效果出现反复，建议'+(id==='maintenance'?'返回检查':'重新排查'),text:'后续监测补充了新的异常证据，本轮观察暂不满足收束条件。保留已有记录，核实复发原因后重新处置。'}
  if(last.status==='incomplete') return {type:'extend',title:'证据不足，建议延长观察',text:'本日缺少完整的同工况数据，暂不能判断处理效果是否持续稳定。建议延长24小时，补充可比记录。'}
  if(last.status==='extended') return {type:'continue',title:'窗口已延长，等待补充观测',text:`观察窗口已延长至${targetDays*24}小时，继续补齐每日同工况记录后重新评估效果。`}
  if(last.day<targetDays) return {type:'continue',title:'已有改善，继续观察',text:`当前已记录${last.day*24}小时，计划观察${targetDays*24}小时。当前变化符合处理预期，仍需继续验证稳定性。`}
  const values=config.names.map((name,i)=>`${name}${config.before[i]} → ${last.values[i]} ${config.units[i]}`).join('；')
  return {type:'archive',title:'效果稳定，待确认闭环',text:`${values}。已有记录覆盖${targetDays*24}小时观察窗口，未记录原异常反复。请结合现场情况确认是否闭环，观测达标不自动代替人工确认。`}
}

export function observationScene(id,records,targetDays){
  const result=observationResult(id,records,targetDays),last=records.at(-1),config=observationConfig[id]
  return {title:'效果观察 · '+(last?.label||'处理后首测'),paragraphs:[{label:'效果判断',text:result.text},{label:'下一步建议',text:result.title},{label:'监测依据',text:config.basis}],question:result.type==='archive'?'是否确认本轮闭环？观测与人员确认记录将继续关联来源事件。':result.type==='reinspect'?'请沿原事件重新核实，保留前轮记录。':result.type==='extend'?'是否补充可比记录并延长观察？':'继续比较后续可比节点；新的现场现象会关联保留。'}
}
