import {shiftTimelineContent} from './demoTimeline.js'
import {eventAssessmentContext} from './eventAssessmentContext.js'

const value=(points,id,unit)=>{
  const point=points.find(p=>p.id===id)
  return Number.isFinite(point?.value)?`${point.value.toFixed(1)} ${unit}`:'未取得'
}
export function deviceHealthAssessment({deviceId,sensors=[],events=[],period}){
  const main=deviceId==='main-engine-1',group=deviceId==='aux-system'
  const points=sensors.filter(p=>group?p.deviceId?.startsWith('aux-engine-'):p.deviceId===deviceId)
  const related=events.filter(e=>e.deviceId===deviceId||(main&&e.device==='主机')||(group&&e.deviceId?.startsWith('aux-engine-')))
  const open=related.filter(e=>!['closed','transferred'].includes(e.phase))
  const invalid=points.filter(p=>!Number.isFinite(p.value)).length
  const flaggedPoints=points.filter(p=>['over','warning'].includes(p.status)),flagged=flaggedPoints.length
  const pointNames=list=>list.map(p=>p.name||p.label||p.id).join('、')
  const missingNames=pointNames(points.filter(p=>!Number.isFinite(p.value)))
  const navigation=period?.state||'航行状态待核对'
  const sailing=`${navigation}，航速${value(sensors,'ship-speed','kn')}`
  if(!points.length&&!main)return {conclusion:`设备测点缺失；${navigation}。`,basis:'缺少运行依据，暂不能评价设备健康。',next:'补齐测点再判断。',context:'当前航行与设备测点'}
  if(main){
    const names=open.map(e=>({'real-alarm-0430':'二缸报警','real-warning-0523':'控制空气预警','real-tracking-exhaust-baseline':'一缸基线抬升','real-health-c4-baseline':'四缸基线下移'}[e.id]||e.title))
    return {
      conclusion:open.length?`需关注${names.join('、')}。${sailing}，主机${value(sensors,'s-012','rpm')}、负荷${value(sensors,'main-load','%')}；当前读数不能撤销历史事件。`:`当前无待处置事件。${sailing}，主机${value(sensors,'s-012','rpm')}、负荷${value(sensors,'main-load','%')}；已闭环记录仍保留。`,
      next:invalid?`${missingNames}缺测，先恢复这些通道的有效采样。`:flagged?`${pointNames(flaggedPoints)}提示越限或预警，先核对同刻现场读数。`:open.length?'先复核'+names[0]+'对应的现场测点。':'继续采集同工况运行记录。',
      basis:related.map(e=>{const c=shiftTimelineContent(eventAssessmentContext[e.sourceEventId||e.id],e.timeline);return `**${e.title} · ${e.status}**\n\n${c?c.navigation+' '+c.conditions:'发生时工况与证据尚待补齐。'}`}).join('\n\n')||'当前无关联事件，继续核对运行测点与设备记录。',
      context:`当前：${navigation} · 历史事件按各自发生窗口核对`,
    }
  }
  const number='1',rpm=points.find(p=>p.unit==='rpm')
  const operating=Number.isFinite(rpm?.value)?rpm.value>0:null
  const modes=`辅机${operating===null?'状态待核对':operating?'运行':'备用'}`
  return {
    conclusion:`${open.length?`${open.length}项事件待处置`:invalid?'数据待补齐':flagged?'异常读数待核验':'无待处置事件'}；${navigation}，${modes}。`,
    basis:group?`转速、负荷、排温及冷却／滑油${invalid?`有${invalid}点缺失`:flagged?`有${flagged}点提示异常`:'暂无越限提示'}。`:`${value(points,`aux-${number}-rpm`,'rpm')}、${value(points,`aux-${number}-load`,'%')}负荷；${operating===false?'备用不代表带载正常':operating===null?'运行状态待核对':'排温与冷却／滑油联判'}。`,
    next:open.length?'先复核'+open[0].title+'的现场记录。':invalid?missingNames+'缺测，先恢复有效采样。':flagged?'复核'+pointNames(flaggedPoints)+'的现场读数。':operating===false?'核对本机最近一次带载试运行记录。':'继续记录同负荷下的转速与排温。',
    context:'当前航行、运行测点与事件记录联合核对',
  }
}
