import {maintenanceExample as example} from './maintenanceExample.js'
import {pendingTrackingExample} from './pendingTrackingExample.js'
import { r02Reports, r02Telemetry } from './r02Stories.js'
import { observationConfig } from './phase2Observation.js'

import {trackingIds,isTrackingDossier} from '../utils/trackingNavigation.js'
export {trackingIds,isTrackingDossier}

const configs = {
  [pendingTrackingExample.id]:pendingTrackingExample.config,
  drift: {title:'3号缸排温相对偏差持续扩大',device:'主机',deviceId:'main-engine-1',part:'3号缸',direction:'偏差仍在扩大',required:true,scope:'核对现场排温与系统读数，记录核对时间、稳定负荷下转速与负荷及现场现象；不直接安排维修。',reason:'新增可比片段中偏差继续扩大。仅靠采集数据尚不能区分实际变化、测量偏差及工况影响。'},
  'cyl4-watch':{title:'4号缸排温相对偏差反复出现',device:'主机',deviceId:'main-engine-1',part:'4号缸',direction:'偏差暂未扩大',required:false},
  'cyl2-ended':{title:'2号缸排温相对偏差收敛',device:'主机',deviceId:'main-engine-1',part:'2号缸',direction:'持续观测支持恢复正常',required:false,ended:true},
  'air-delivery':{title:'空压机加载时间持续延长',device:'空压机',deviceId:'air-compressor',part:'加载与供气',direction:'加载时间继续延长',required:true,scope:'核对同一储气压力区间的加载时间、用气设备和现场现象，记录核对时间及泄漏、进气和加载控制核实结果；不凭趋势直接换件。',reason:'已有三个可比班次的加载时间持续延长。需要现场信息区分用气条件、泄漏、进气与加载控制影响。'}
}

function baseline(id) {
  if(id===pendingTrackingExample.id)return JSON.parse(JSON.stringify(pendingTrackingExample.baseline))
  if(id==='air-delivery') return {
    first:'前2班',established:'建档时间尚未取得',updated:'本班',conditions:'同一储气压力区间、相近用气条件；压力区间起止值及现场条件尚待核对。',
    conclusion:'近3班加载时间持续延长，供气压力仍可达到0.82 MPa，提示充气表现可能变化，尚不能确认机体磨损或具体故障。',
    charts:[{key:'loading',name:'可比加载周期耗时',unit:'s',labels:['前2班','前1班','本班'],values:[95,112,128],reference:'比较同一储气压力区间和相近用气条件下的加载时间',recordIds:['air-reference','air-review','air-request']},{key:'pressure',name:'供气压力',unit:'MPa',labels:['前2班','前1班','本班'],values:[.82,.82,.82],reference:'三个班次均可达到0.82 MPa；达到压力不等于效率未变化',recordIds:['air-reference','air-review','air-request']},{key:'temperature',name:'排气温度',unit:'°C',labels:['前2班','前1班','本班'],values:[61,63,65],reference:'已有班次记录；不能据此直接判断原因',recordIds:['air-reference','air-review','air-request']}],
    records:[{id:'air-reference',label:'起始可比参考',at:'前2班',text:'加载时间95秒，供气压力0.82 MPa。',assessment:'保留可比参考；最早观测不等同于已建立专项关注。'},{id:'air-review',label:'后续比较',at:'前1班',text:'加载时间增至112秒。',assessment:'保留变化并继续核对比较工况。'},{id:'air-request',label:'连续延长 · 请求现场核实',at:'本班',text:'加载时间增至128秒，排气温度65°C。',assessment:configs[id].reason}]
  }
  const report=r02Reports[id],data=r02Telemetry[id]
  const records=report.timeline.map((r,i)=>({...r,id:`${id}-assessment-${i}`,source:'原跟踪观测记录'}))
  const established=records.find(r=>/建立关注|进入关注/.test(r.label))?.at||'建档时间尚未取得'
  const recordIds=data.labels.map(label=>records.find(r=>r.at.slice(5).replaceAll('/','-')===label.replaceAll('/','-'))?.id||null)
  return {first:data.labels[0],established,updated:data.labels.at(-1),conditions:'转速94–96 rpm、负荷68%–72%的稳定运行片段；排除启停、机动及快速负荷变化。',conclusion:report.conclusion,records,
    charts:[{key:'gap',name:'与其余缸平均排温的差值',unit:'°C',labels:data.labels,values:data.gaps,recordIds,reference:id==='drift'?'原跟踪的缸间均值比较；不由2号缸单缸对照计算，相对差不是故障阈值':'同时段其余缸平均排温的比较；相对差不是通用故障阈值'},{key:'temperature',name:`${id==='drift'?'3':id==='cyl4-watch'?'4':'2'}号缸绝对排温`,unit:'°C',labels:data.labels,values:data.values,recordIds,reference:'相近转速与负荷下的本缸记录；绝对读数辅助理解变化'}]}
}

// Read confirmed source records; never infer execution from a stage number.
export function trackingDossier(store,id) {
  if(!isTrackingDossier(id))return null
  const config=configs[id],base=baseline(id),assigned=Boolean(store.todoCreated[id])
  const hasComponentEvidence=id==='drift'&&store.logs.drift.some(m=>m.id==='injector-demo-evidence')
  if(hasComponentEvidence){
    // The maintenance example supplements this archive; it must not replace its earlier observations.
    base.conclusion=example.conclusion
    base.charts.push(...example.series.map((r,i)=>({key:'injector-'+i,...r,name:'取证材料 · '+r.name,reference:r.scope,recordIds:r.labels.map(()=> 'injector-origin-advice')})))
  }
  const records=base.records.map(r=>({...r,actor:r.actor||'系统跟踪',source:r.source||'班次观测记录',type:'assessment'}))
  for(const r of store.assignmentRecords[id]||[])records.push({id:r.id,label:'人员派工',at:r.at,actor:r.assignedBy,source:'待办指派记录',type:'assignment',text:`${r.owner} · ${r.type}；${r.scope}`,assessment:`计划：${r.due}。派工不表示已确认故障或已经执行。`,event:true})
  const feedback=(store.logs[id]||[]).filter(r=>r.kind==='feedbackRecord')
  for(const r of feedback)records.push({id:r.id,label:'现场反馈 · 已确认',at:r.submittedAt||r.at,actor:r.actor||'原待办人员确认',source:r.provenance?'待办反馈记录（'+r.provenance+'）':'待办反馈记录',type:'feedback',text:(r.records||[]).map(v=>`${v.label||''}：${v.result}${v.note?'；'+v.note:''}`).join('；'),assessment:'反馈已留存；本页尚未取得与该反馈对应的新分析结果，不据此确认故障或恢复正常。',event:true})
  if(hasComponentEvidence){const origin=example.origins.at(-1);if(origin)records.push({...origin,type:'assessment',source:'维保建议关联的取证材料'})}
  // Preserve legacy direct submissions as history, with no new form here.
  const legacy=store.attentionFeedback[id]
  if(legacy)records.push({id:`${id}-legacy-feedback`,label:'历史现场核实回执',at:legacy.at,actor:'人员确认',source:'原关注核实回执',type:'feedback',text:`现场排温${legacy.reading}°C；${legacy.conditions}；${legacy.phenomenon}`,assessment:'历史直接提交回执保留；新版核实由关联待办承载。'})
  for(const [i,r] of (store.dossierReviews[id]?.history||[]).entries())records.push({id:`${id}-legacy-review-${i}`,label:'历史判断更新',at:r.at,actor:'档案研判',source:'原档案判断记录',type:'assessment',text:r.text,assessment:'保留当时判断；不把历史分析视为已经处理新反馈。'})
  const executions=store.executionRecords[id]||[]
  for(const r of executions)records.push({id:r.id,label:r.values.completion==='completed'?'实际措施 · 已确认':'执行进展 · 已确认',at:r.confirmedAt,actor:r.executor,source:'待办执行记录',type:'execution',text:`${r.values.measures}；实际执行时间：${r.values.executedAt}；验收：${r.values.acceptance}`,assessment:'执行完成不表示原异动已经解决；需结合可比观测判断。',event:true})
  const latestExecution=executions.at(-1)
  const observationGroups=[...(store.observationHistory[id]||[]).map(round=>({round:round.round,rows:round.records})),{round:store.observationRounds[id]||1,rows:store.observationRecords[id]||[]}]
  for(const group of observationGroups)for(const r of group.rows)records.push({id:`${id}-observation-${group.round}-${r.day}-${r.label}`,label:'处理后观察',at:r.label,actor:'效果观察',source:'原待办关联观测',type:'observation',text:r.note||'已有观测',assessment:r.values?`已有观测：${r.values.join(' / ')}；需结合指标单位和可比工况核对。`:'缺少可比数据，不能据此判断恢复正常。',event:true})
  for(const r of store.dossierNotes[id]||[])records.push({...r,source:'人员补充，尚未经核实'})
  const unique=[...new Map(records.map(r=>[r.id,r])).values()]
  const received=feedback.length>0||Boolean(legacy)
  const validExecution=latestExecution?.values.completion==='completed'&&latestExecution.values.verification==='resolved'&&latestExecution.values.comparable==='available'
  const latestResult=assigned&&validExecution&&store.isTaskHandled(id)&&store.executionObservationReady(id)?store.getObservationResult(id):null
  const ended=Boolean(config.ended||latestResult?.type==='archive'&&latestExecution?.values.completion==='completed')
  if(ended&&!config.ended)unique.push({id:`${id}-closure`,label:'系统确认事项结束',at:store.observationRecords[id]?.at(-1)?.label||'原观察记录',actor:'系统',source:'原结束状态',type:'closure',text:latestResult.text,assessment:'仅针对本档案关注的问题，不代替事件关闭或正式工单完成。'})
  const task=assigned?{owner:store.assignments[id]?.owner||'待核对',stage:store.cases[id]?.stages[store.progress[id]]?.label||'待核对',scope:store.assignments[id]?.scope||config.scope}:null
  const direction=ended?'持续观测支持恢复正常':latestExecution?'处理后表现待持续验证':hasComponentEvidence?'部件取证已确认 · 维护待安排':config.direction
  const taskState=assigned?(received?'现场反馈已提交 · '+task.stage:'已派工 · '+task.stage):config.required?'现场核实待派工':'无需人员操作'
  const effectConfig=observationConfig[id],effectRows=store.observationRecords[id]||[]
  if(validExecution&&effectRows.length&&effectConfig)effectConfig.names.forEach((name,i)=>base.charts.push({key:'effect-'+i,name:'处理后 · '+name,unit:effectConfig.units[i],labels:['处理前',...effectRows.map(r=>r.label)],values:[effectConfig.before[i],...effectRows.map(r=>r.values?.[i]??null)],reference:'实际执行时间：'+latestExecution.values.executedAt+'；处理前后仅在可比条件下比较',recordIds:[latestExecution.id,...effectRows.map(r=>`${id}-observation-${store.observationRounds[id]||1}-${r.day}-${r.label}`)]}))
  return {id,...config,...base,records:unique,task,assigned,ended,required:config.required&&!assigned&&!ended,direction,taskState,phase:ended?'已结束':validExecution?'处理后观察':assigned?'关联待办跟进中':config.required?'待现场核实':'系统跟踪中',
    conclusion:latestResult?.text||base.conclusion,
    analysisStatus:ended?'本档案依据已有结束记录恢复常规监测，不代表整机所有问题均已排除。':hasComponentEvidence?'原事件部件取证已确认，形成清洁与复校建议；维护尚未执行。':received?'现场反馈已留存，后续判断待更新；上方保留最近已有观测及原判断。':'当前判断基于已有观测，尚不能确认故障或具体原因。',
    updated:unique.at(-1)?.at||base.updated,analysisAt:base.updated,
    closure:ended?{reason:config.ended?'持续监测确认恢复正常':'处理后持续观测支持恢复',basis:config.ended?'原反复偏差在后续有效可比片段中收敛，未再反复出现；本轮未检查或维修。':latestResult.text,limit:'仅限已跟踪问题及已覆盖证据；不连带关闭关联待办或正式工单。'}:null,
    execution:latestExecution,
    sections:id==='drift'&&store.logs.drift.some(m=>m.id==='injector-demo-evidence')?[{title:'取证与判断范围',paragraphs:[example.limitation]}]:id===pendingTrackingExample.id?[{title:'监测与判断范围',paragraphs:['当前排温偏离仍需现场核实，尚不能确认具体部件故障。','现场核实和进一步检查在待办中接续，证据不足时保留原阶段，不自动安排维修。']}]:id==='air-delivery'?[]:r02Reports[id].sections.filter(s=>s.title!=='本次补证要求'),
    tracking:config.ended?'恢复常规监测；新变化时结合原历史重新评估。':id==='air-delivery'?'继续比较同一压力区间的加载时间与供气表现；新增持续延长、关联变化或现场异常时评估人员配合。':'继续比较可比工况下排温相对差与相关信号；偏差持续扩大或新增现场证据时评估人员配合。',
    limit:'缺失或不可比数据不参与变化判断；未取得原始采样覆盖率和正式调度参数，不预测故障时间。'}
}

export function trackingChartLayout(chart) {
  const values=chart.values.filter(Number.isFinite)
  const min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1,padding=Math.max((max-min)*.12,Math.abs(max)*.002,.01)
  const low=min-padding,high=max+padding
  const times=chart.labels.map(label=>Date.parse('2026/'+label))
  const timed=times.length>1&&times.every(Number.isFinite)&&times.at(-1)>times[0]
  const x=i=>timed?70+540*(times[i]-times[0])/(times.at(-1)-times[0]):chart.labels.length===1?340:70+540*i/(chart.labels.length-1)
  const y=value=>180-140*(value-low)/(high-low)
  const points=chart.values.flatMap((value,i)=>Number.isFinite(value)?[{x:x(i),y:y(value),value,label:chart.labels[i],recordId:chart.recordIds?.[i]}]:[])
  const segments=[];let part=[]
  chart.values.forEach((value,i)=>{if(Number.isFinite(value))part.push(`${x(i)},${y(value)}`);else{if(part.length)segments.push(part.join(' '));part=[]}})
  if(part.length)segments.push(part.join(' '))
  return {points,segments,ticks:[0,.5,1].map(r=>{const value=low+(high-low)*r;return {value:Number(value.toFixed(2)),y:y(value)}}),timed}
}
