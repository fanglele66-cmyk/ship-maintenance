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
  const flagged=points.filter(p=>['over','warning'].includes(p.status)).length
  const navigation=period?.state||'航行状态待核对'
  const sailing=`${navigation}，航速${value(sensors,'ship-speed','kn')}`
  if(!points.length&&!main)return {conclusion:`设备测点缺失；${navigation}。`,basis:'缺少运行依据，暂不能评价设备健康。',next:'补齐测点再判断。',context:'当前航行与设备测点'}
  if(main){
    const names=open.map(e=>({'real-alarm-0430':'二缸报警','real-warning-0523':'控制空气预警','real-tracking-exhaust-baseline':'一缸基线抬升','real-health-c4-baseline':'四缸基线下移'}[e.id]||e.title))
    return {
      conclusion:open.length?`需关注${names.join('、')}。${sailing}，主机${value(sensors,'s-012','rpm')}、负荷${value(sensors,'main-load','%')}；当前读数不能撤销历史事件。`:`当前无待处置事件。${sailing}，主机${value(sensors,'s-012','rpm')}、负荷${value(sensors,'main-load','%')}；已闭环记录仍保留。`,
      next:invalid?`${invalid}个测点数据缺失，先补齐工况与测点依据。`:flagged?`${flagged}个测点提示越限或预警，先对齐当前工况核验；事件按本轮状态继续处置。`:'报警、预警先核查现场；长期基线结合月度工况与独立校验决定后续。',
      basis:related.map(e=>{const c=eventAssessmentContext[e.sourceEventId||e.id];return `**${e.title} · ${e.status}**\n\n${c?c.navigation+' '+c.conditions:'发生时工况与证据尚待补齐。'}`}).join('\n\n')||'当前无关联事件，继续核对运行测点与设备记录。',
      context:`当前：${navigation} · 历史事件按各自发生窗口核对`,
    }
  }
  const number=deviceId.split('-').at(-1),rpm=points.find(p=>p.unit==='rpm')
  const operating=Number.isFinite(rpm?.value)?rpm.value>0:null
  const modes=group?[1,2,3].map(n=>{const p=points.find(p=>p.id===`aux-${n}-rpm`);return `${n}号${!Number.isFinite(p?.value)?'待核对':p.value>0?'运行':'备用'}`}).join('、'):`${number}号${operating===null?'状态待核对':operating?'运行':'备用'}`
  return {
    conclusion:`${open.length?`${open.length}项事件待处置`:invalid?'数据待补齐':flagged?'异常读数待核验':'无待处置事件'}；${navigation}，${modes}。`,
    basis:group?`转速、负荷、排温及冷却／滑油${invalid?`有${invalid}点缺失`:flagged?`有${flagged}点提示异常`:'暂无越限提示'}。`:`${value(points,`aux-${number}-rpm`,'rpm')}、${value(points,`aux-${number}-load`,'%')}负荷；${operating===false?'备用不代表带载正常':operating===null?'运行状态待核对':'排温与冷却／滑油联判'}。`,
    next:open.length?'跟进关联事件。':invalid?'补齐测点再判断。':flagged?'核验就地读数。':operating===false?'核对带载试运行。':'跟踪同工况变化。',
    context:'当前航行、运行测点与事件记录联合核对',
  }
}
