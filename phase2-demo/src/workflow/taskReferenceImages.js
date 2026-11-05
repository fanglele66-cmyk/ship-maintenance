import extractedFigures from '../../public/task-reference-images/manifest.json' with {type:'json'}

// These references assist identification. They are never execution attachments,
// proof of a current defect, or authorization to dismantle a component.
const knowledgeFigures=[
 {id:'control-air-measurement',src:'/wiki_rt-flex50/images/1af4a43e62fca5e0d30ff89d2187ca21a018f4838a8522acf3783c2fc75b875d.jpg',title:'控制空气就地表与压力传感器示意',type:'原理图',sourceLabel:'知识库 · 控制空气系统 · 控制空气供应图',sourceHref:'/#/knowledge?doc=RTF-4D8F00FF29',sourceFile:'wiki_rt-flex50/concepts/控制空气系统.md',focus:'对照图中 PI4401L 就地表、PT4401A 压力传感器与供气路径，先核实现场表计位置。',note:'此图仅说明机上控制空气测量关系，不包含本船两组 30→8KG 减压阀，也不能把两个主机进口测点当作减压阀前后。图上编号和参数须按本船适用图纸核对。'},
 {id:'pressure-reducer-history',src:'/wiki_rt-flex50/images/changhangbiyu_20260523_pressure_reducer_disassembly.jpeg',title:'减压阀阀体、阀芯与弹簧拆检参考',type:'历史现场图',sourceLabel:'知识库 · 长航碧玉减压阀故障案例 · 历史照片',sourceHref:'/#/knowledge?doc=RTF-79B7452B99',sourceFile:'wiki_rt-flex50/concepts/长航碧玉30KG到8KG减压阀损坏故障案例.md',focus:'识别阀体、阀芯、弹簧及拆下件的相对外观，记录本轮密封面和污染位置。',note:'历史案例参考，不代表本轮已拆检或密封件已损坏。照片时间戳为 2026/02/21，与案例报告日期不同，不能据此认定拍摄时间。零件顺序、配套密封及工艺按本船 HRD-FA 作业卡核对。'},
 {id:'icu-history',src:'/wiki_rt-flex50/images/changhangbiyu_20260430_icu_servo_piston_disassembly.jpeg',title:'ICU 阀块与液压活塞拆检参考',type:'历史现场图',sourceLabel:'知识库 · 长航碧玉二缸 ICU 故障案例 · 历史照片',sourceHref:'/#/knowledge?doc=RTF-5EB064608C',sourceFile:'wiki_rt-flex50/concepts/长航碧玉主机2缸ICU伺服油液压活塞卡阻故障案例.md',focus:'识别从阀块抽出的液压活塞与检查区域，实际卡阻、划痕或污染须另留本轮证据。',note:'历史案例参考，不是本轮现场附件或拆装操作指令。照片时间戳为 2026/05/05，与报告日期不同，不能据此认定拍摄时间。原图分辨率较低；内部精密偶件检修须由厂家认可车间按适用工艺实施。'},
]

export const taskReferenceImageCatalog=Object.freeze([
 ...(Array.isArray(extractedFigures)?extractedFigures:extractedFigures.figures),...knowledgeFigures,
].map(item=>Object.freeze({...item})))
const catalog=new Map(taskReferenceImageCatalog.map(item=>[item.id,item]))
const families={
 'real-warning-0523':'air',
 'real-alarm-0430':'icu',
 'real-tracking-exhaust-baseline':'temperature',
 'real-health-c4-baseline':'temperature',
 'real-maintenance-c1-baseline':'temperature',
 'real-maintenance-c4-baseline':'temperature',
}
const references=(...ids)=>[...new Set(ids)].map(id=>catalog.get(id)).filter(Boolean).slice(0,2)
const content=part=>[part?.label,part?.guide,...(part?.checks||[])].filter(Boolean).join(' ')

/** Select only references relevant to this operation, not to its sibling steps.
 * Existing dispatched task snapshots and submitted feedback remain untouched.
 * Unknown event families intentionally have no automatic illustrative fallback.
 */
function candidateImages({event,task,step,part}={}){
 const family=families[event?.sourceEventId]||families[event?.id]
 const operation=part||step
 if(!family||!operation||(!part&&step?.substeps?.length))return []
 const label=operation.label||'',text=content(operation)
 const work=['repair','maintenance'].includes(task?.kind||task?.action)
 // Administrative/temporal records do not benefit from a dismantling diagram.
 if(/核对异常、批准|准备备件|核对计划、备料|批准范围与作业交接|核对校验、备料|汇总|整理作业记录|交接效果|月度工况|月度变化|月度相对|历史调整履历|核对工况及临时/.test(label))return []
 if(family==='air'){
  if(/测点|表计|压力.*对应/.test(label))return references('control-air-measurement','air-inlet-location')
  if(/减压阀|阀芯|调压机构/.test(label)){
   if(/拆检|阀芯|密封|卡滞/.test(text))return work?references('pressure-reducer-history'):references('pressure-reducer-history','air-system-overview')
   return references('air-system-overview')
  }
  if(/标识连接/.test(label))return references('air-inlet-location')
  if(work&&/处理控制空气通路|处理过滤、积水/.test(label))return references('control-air-measurement').map(item=>({...item,focus:'对照压力表、止回阀及储气罐排水支路，核对已定位的供气段与查漏位置。'}))
  if(/供气|控制空气|隔离|通路|气路/.test(label))return work?references('air-system-overview'):references('air-system-overview','air-inlet-location')
  if(/复装|恢复|试验|复测/.test(label))return references('control-air-measurement')
 }
 if(family==='icu'){
  // A supply-only work card must not acquire ICU replacement illustrations.
  if(/燃油供给|过滤|供给异常段/.test(label))return references('fuel-system-overview')
  if(/ICU|液压机构|控制反馈|喷射响应/.test(label)){
   if(work&&/拆装|更换|换件|总成交接/.test(label))return references('icu-removal','icu-connections')
   if(work&&/处理|处置|修复|清洁|卡滞|卡阻|检查.*液压/.test(label))return references('icu-connections','icu-history')
   return references('icu-connections','fuel-system-overview')
  }
  const icuScope=/ICU|液压活塞/.test([task?.scope,task?.title,operation.guide].filter(Boolean).join(' '))
  if(/标识连接|作业范围与隔离|复装连接/.test(label))return references(icuScope?'icu-connections':'fuel-system-overview')
  if(work&&/换件|总成交接/.test(label)&&icuScope)return references('icu-removal','icu-connections')
  if(/隔离|恢复供给|恢复系统|阶段试验/.test(label))return references('fuel-system-overview')
 }
 if(family==='temperature'){
  if(/测温|测量链路|通道|校验|测温依据/.test(label))return references('exhaust-temperature-points')
  // A monthly trend review is not a mandate to open an injector or exhaust valve.
  if(/专项检查必要性/.test(label))return references('exhaust-temperature-points')
  if(/燃烧.*排气|排气.*专项/.test(label))return references('injection-valve-section','exhaust-valve-connections')
  if(work&&/按检查发现|批准措施/.test(label)&&/喷油器|喷嘴|排气阀/.test(text))return references('injection-valve-section','exhaust-valve-section')
  if(work&&/喷油器|喷嘴/.test(label))return references(/试验|测试|雾化/.test(label)?'injection-valve-test':'injection-valve-section')
  if(work&&/排气阀/.test(label))return references(/拆|检修|清洁/.test(label)?'exhaust-valve-section':'exhaust-valve-connections')
 }
 return []
}

// One appearance per task, in canonical step order, independent of navigation
// history. Reading a later step first must not consume an earlier illustration.
export function getTaskReferenceImages(context={}){
 const {event,task,step,part,stepIndex,partIndex}=context
 const candidates=candidateImages(context)
 if(!candidates.length||!task?.steps?.length)return candidates
 const operations=task.steps.flatMap((parent,si)=>parent.substeps?.length
  ?parent.substeps.map((child,pi)=>({step:parent,part:child,si,pi}))
  :[{step:parent,si,pi:-1}])
 const target=operations.findIndex(item=>Number.isInteger(stepIndex)
  ?item.si===stepIndex&&item.pi===(part?partIndex:-1)
  :part?item.step===step&&item.part===part:item.step===step||item.part===step)
 // An old revision may not belong to the current plan. Its caller supplies its
 // own steps; without a stable match, keep the specific reference available.
 if(target<0)return candidates
 const seen=new Set(operations.slice(0,target).flatMap(item=>candidateImages({event,task,...item})).map(item=>item.src))
 return candidates.filter(item=>!seen.has(item.src))
}
