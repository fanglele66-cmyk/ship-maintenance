// Presentation only: retain original source records and implementation metadata.
export function businessCopy(value) {
 if(typeof value!=='string')return value
 const replacements=[
  ['后续升温、派工及现场取证为演示构造。',''],
  ['演示构造',''],
  ['独立演示样本；初始仅有异动跟踪，不视为已确认故障。','初始仅有异动跟踪，不视为已确认故障。'],
  ['预置稳定工况的可比片段；真实采样及工况参数未接入。','可比运行片段；具体工况参数尚待核对。'],
  ['独立演示的同工况缸间均值差；不是故障阈值','同工况缸间均值差；不是故障阈值'],
  ['独立演示观测，辅助理解变化，不与真实点位混用','可比片段中的排温记录'],
  ['记录为区间，不提供虚构的连续采样曲线','记录为区间，未取得连续采样曲线'],
  ['仅为原型演示。',''],
  ['原型观测及跟踪演示配置；正式监测接口、原始采样覆盖率与连续分析调度尚未接入。','关联测点观测及事项跟踪记录。'],
  ['数值、时间和判断均来自已有演示记录。','保留原观测节点及分析记录。'],
  ['末轮收敛是现有演示判断的依据；正式正常参考及判定参数尚未接入，不能将“未扩大”单独作为实际自动结束条件。','后续可比记录支持压力波动收敛；不能仅凭“未扩大”判定事项结束。'],
  ['现有演示状态判定','后续可比观测支持'],
  ['演示场景 · ',''],
  ['已有演示记录 · 不补造采样或分析时间','原观测及取证记录'],
  ['真实CSV中心值＋演示升温节点','前后可比运行记录'],
  ['演示节点；真实CSV提取中心值','可比运行记录；参考值'],
  ['模拟人员确认','人员确认'],
  ['模拟检查报告；未编造校验压力及厂家限值。','检查报告；校验压力及厂家限值尚未取得。'],
  ['本示例的异常','本轮异常'],
  ['示例：','参考填写：'],
  ['演示记录','观测记录'],
  ['演示首测','处理后首测'],
  ['演示档案',''],
 ]
 let text=value
 for(const [from,to] of replacements)text=text.split(from).join(to)
 return text.replace(/[（(]演示(?:返回)?[）)]/g,'').replace(/\s*·\s*演示/g,'').replace(/演示/g,'').replace(/模拟检查报告/g,'检查报告').replace(/[（(]\s*[）)]/g,'').trim()
}

// Cached assistant output may predate the copy update. Never rewrite stored records,
// user messages, draft field values, IDs or action routing keys.
export function businessMessage(value,key='') {
 if(value?.role==='user' || key==='values')return value
 if(typeof value==='string')return /^(id|key|type|purpose|role|stageId|eventId|deviceId)$/.test(key)?value:businessCopy(value)
 if(Array.isArray(value))return value.map(item=>businessMessage(item))
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,businessMessage(item,name)]))
 return value
}
