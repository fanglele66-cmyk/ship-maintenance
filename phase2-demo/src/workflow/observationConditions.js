import {aisNavigationReplay} from '../mock/aisNavigationReplay.js'
import {observationPolicy} from './observationContext.js'
// Local replay adapter only. Live sources must supply timestamped operating periods.
export function replayOperatingPeriods(start,end){
 const periods=[]
 for(let stop=end;stop>start;stop-=86400000)periods.push(...aisNavigationReplay(stop))
 return periods.sort((a,b)=>a.start-b.start)
}
const comparable=p=>p?.tone==='cruise'&&p.rpm?.length===2&&p.load?.length===2&&p.rpm.every(Number.isFinite)&&p.load.every(Number.isFinite)&&p.rpm[0]>0&&p.load[0]>0&&p.rpm[1]-p.rpm[0]<=5&&p.load[1]-p.load[0]<=5
export function observationConditions(event,channels,periods,start,end){
 const policy=observationPolicy(event)
 const valid=(periods||[]).filter(p=>Number.isFinite(p.start)&&Number.isFinite(p.end)&&p.end>start&&p.start<end).sort((a,b)=>a.start-b.start)
 const current=valid.findLast(p=>p.start<=end&&p.end>=end)
 let coveredUntil=start,coverageMs=0
 for(const p of valid.filter(comparable)){const a=Math.max(start,p.start,coveredUntil),b=Math.min(end,p.end);if(b>a){coverageMs+=b-a;coveredUntil=b}}
 const samples=channels.map(c=>(c.trendData||[]).filter(p=>p.timestamp>start&&p.timestamp<=end&&valid.some(w=>comparable(w)&&p.timestamp>w.start&&p.timestamp<=w.end)))
 const currentEligible=comparable(current),eligible=currentEligible&&coverageMs>=policy.minComparableMs
 const reason=!current?'缺少当前转速、负荷及航行状态记录，暂不能评价处理效果。':!currentEligible?`当前为${current.state||'非稳态工况'}，不满足本轮稳态航行观察条件；停机或操纵期间的平稳读数不能证明异常消除。`:!eligible?'当前已进入稳态航行，可比工况采样时段尚不足，继续收集有效数据。':'已取得稳态航行时段，按修复或核实后的可比工况数据评估原异常。'
 return {eligible,currentEligible,currentState:current?.state||'未取得',required:policy.requiredCondition,comparableMs:coverageMs,minimumComparableMs:policy.minComparableMs,reason,samples}
}
