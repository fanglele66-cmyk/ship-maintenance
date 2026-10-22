import {formatAnalysisTime} from './overviewAnalysisWindow.js'

const dayMs = 86400000, chinaOffset = 8 * 3600000
const pointIds = ['ship-speed','s-012','main-load','main-control-air-pressure','main-fuel-rail-pressure','s-007','s-010','s-017']
export function periodReadings(sensorStore, start, end) {
  return pointIds.flatMap(id => {
    const point = sensorStore.allSensors.find(sensor => sensor.id === id)
    if (!point) return []
    const values = sensorStore.getSimulationTrend(id,24,start,end,96).map(sample => sample.value).filter(value => typeof value === 'number' && Number.isFinite(value))
    if (!values.length) return []
    const digits = point.unit === 'MPa' || point.unit === 'bar' && point.value < 10 ? 2 : 1
    return [{id,name:point.nameCn,unit:point.unit,count:values.length,min:Math.min(...values).toFixed(digits),max:Math.max(...values).toFixed(digits),mean:(values.reduce((a,b)=>a+b,0)/values.length).toFixed(digits)}]
  })
}

export function shipDailyReports(sensorStore, referenceTime) {
  const cutoff = Math.floor(referenceTime / 60000) * 60000
  const today = Math.floor((cutoff + chinaOffset) / dayMs) * dayMs - chinaOffset
  return Array.from({length:7},(_,index) => {
    const start = today - index * dayMs, end = index === 0 ? cutoff : start + dayMs
    const date = new Date(start + chinaOffset).toISOString().slice(0,10)
    const readings = periodReadings(sensorStore,start,end)
    const metric = id => readings.find(item=>item.id===id)
    const rpm = metric('s-012'), load = metric('main-load'), air = metric('main-control-air-pressure')
    return {id:`ship-daily-${date}`,date,start,end,window:`${formatAnalysisTime(start)} — ${formatAnalysisTime(end)}`,partial:index===0,readings,
      status:'已生成',summary:`主机转速 ${rpm?.mean ?? '—'} rpm · 平均负荷 ${load?.mean ?? '—'}%`,
      conclusion:`本日已汇总航行、主机与共用系统的关键读数。主机转速为 ${rpm?.min ?? '—'}–${rpm?.max ?? '—'} rpm，负荷为 ${load?.min ?? '—'}–${load?.max ?? '—'}%。`,
      findings:[`控制空气进口压力为 ${air?.min ?? '—'}–${air?.max ?? '—'} bar；与历史低压事件分开记录，当前窗口不能替代原事件的现场核实。`,'冷却水、滑油与燃油供给按各自测点统计；日检摘要不将单点波动直接认定为设备故障。','人工现场反馈、执行结果和闭环决定沿来源事件留存，可在事件页继续核对。'],
      next:['对待决策事件核对现场依据后再安排任务。','对处置中的事件沿已有任务补充反馈，避免重复派发。','维保建议随异动跟踪的阶段结果形成；闭环以人员确认及相应验收记录为依据。'],
      provenance:'本页按当前运行样例生成日检报告，用于展示统计与报告交互；不作为真实船舶的历史巡检凭证。'}
  })
}
