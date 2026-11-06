const phaseLabels=new Map([
 ['作业准备与安全隔离','作业准备'],
 ['实施维修与过程记录','实施维修'],
 ['实施维保与过程记录','实施维保'],
 ['复装与分阶段试验','复装试验'],
 ['交接与效果观察','效果观察'],
 ['核对计划、备料与停机隔离','作业准备'],
 ['核对获批处理范围与作业条件','作业准备'],
 ['实施本次批准的处理项目','实施维修'],
 ['恢复系统并记录复测结果','复装试验'],
 ['执行燃烧与排气专项维护','专项维保'],
 ['恢复、复测与汇报','复测汇报'],
])
const semanticLabels=[
 [/(?:读数|测量).*(?:比对|核对|对照)|(?:比对|核对|对照).*读数/,'读数比对'],
 [/(?:数据|履历|资料).*(?:比对|核对|对照)|(?:比对|核对|对照).*(?:数据|履历|资料)/,'资料核对'],
 [/复装.*(?:试验|复测)|(?:试验|复测).*复装/,'复装试验'],
 [/复装|恢复/,'系统恢复'],
 [/泄漏|检漏|查漏/,'泄漏检查'],
 [/观察|跟踪/,'效果观察'],
 [/复核|后续/,'后续复核'],
 [/试验|试运行|复测/,'复测验证'],
 [/隔离|卸压/,'安全隔离'],
 [/准备|备料|(?:核对|确认|审阅).*(?:工单|批准范围)/,'作业准备'],
 [/校验|校准/,'仪表校验'],
 [/检修|修复|维修|拆修|更换|换件/,'部件检修'],
 [/清洁|清洗/,'清洁处理'],
 [/交接|汇总|汇报|整理.*记录/,'作业交接'],
 [/检查|核查|核对|确认/,'现场核查'],
]
const concise=value=>typeof value==='string'&&/^[\p{Script=Han}A-Za-z0-9]{2,4}$/u.test(value.trim())?value.trim():''

// Navigation labels only: preserve the full work card and AI context, including
// older persisted steps. Fall back to an operation number, never an invented
// preparation/repair/restoration phase based solely on its position.
export function taskStepLabel(step,kind,index=0){
 const label=typeof step?.label==='string'?step.label.trim():''
 if(['repair','maintenance'].includes(kind)){
  const explicit=concise(step?.short)
  if(explicit)return explicit
  const short=phaseLabels.get(label)||(/^校验[一二三四五六七八九十\d]+缸排温测量链路$/.test(label)?'测温校验':'')
  if(short)return kind==='maintenance'&&short==='实施维修'?'实施维保':short
  if(concise(label))return label
  const semantic=semanticLabels.find(([pattern])=>pattern.test(label))?.[1]
  if(semantic)return semantic==='泄漏检查'&&/修复|处理/.test(label)?'泄漏处理':semantic
  return Number.isInteger(index)&&index>=0&&index<99?`作业${index+1}`:'其他作业'
 }
 return step?.short||label||`步骤${index+1}`
}
