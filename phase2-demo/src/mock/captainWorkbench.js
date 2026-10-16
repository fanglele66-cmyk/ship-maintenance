import {maintenanceExample as example} from './maintenanceExample.js'
import {pendingTrackingExample} from './pendingTrackingExample.js'
export const issueCatalog=[
 pendingTrackingExample.issue,
 {id:'fault',deviceId:'main-engine-1',device:'主机',type:'报警事件',rank:0,title:'冷却水出口温度报警',summary:'出口水温92.4°C，超过本机85°C报警设置；流量68.2 m³/h低于本机要求，需排查原因。',action:'核实报警并派发排查',evidence:['出口水温92.4°C；本机报警设置85°C','流量68.2 m³/h；本机要求不低于80 m³/h','进口水温48.7°C，未出现同步升高'],limit:'报警表明测点越限；现场仪表或测点异常仍可能导致误报，核实后可反馈。'},
 {id:'main-warning',deviceId:'main-engine-1',device:'主机',type:'预警事件',rank:1,title:'润滑供油异常预警',summary:'同工况油压下降与滤器压差上升相互印证，建议先核对现场读数，再定位供油异常。',action:'派发真实性核实与排查',evidence:['油压0.31 → 0.27 → 0.24 MPa','滤器压差0.03 → 0.05 → 0.07 MPa','油温67–69°C、液位80%–82%，未同步明显变化'],limit:'综合证据支持较高的异常可能性，但仍需核对采集与现场仪表；不据此直接确认堵塞部位。'},
 {id:'drift',deviceId:'main-engine-1',device:'主机',type:'异动跟踪',rank:2,title:'3号缸排温偏离扩大',summary:'同工况相对偏差由8°C扩大至10°C，排温432°C尚未达到本机450°C报警设置；需决定是否安排核实。',action:'判断是否安排现场核实',evidence:['同工况排温428 → 432°C','与2号缸对照差8 → 10°C','尚未取得现场仪表和异响核实结果'],limit:'当前是局部指标偏离，尚未形成多指标联动判断，不能确认故障或部件原因。'},
 {id:'maintenance',targetEventId:'drift',deviceId:example.deviceId,device:'主机',type:'维保建议',rank:3,title:example.title,summary:example.recommendation,action:'审阅清洁与复校安排',evidence:example.snapshots.map(s=>s.name+'：'+s.value),limit:example.limitation},
 {id:'steering-heat',deviceId:'steering-gear',device:'舵机',type:'报警事件',rank:0,title:'液压油温度超限',summary:'油温78°C已报警，排查已派发给赵明；需结合操舵负荷与散热检查反馈跟进。',action:'查看负责人处理进展',evidence:['油温78°C超出原事件参考上限','油压12.5 MPa、油位68%、流量45.2 L/min','尚无证据直接确认冷却器结垢'],limit:'保持原事项接续，依据现场反馈判断，不重复派发。'},
 {id:'air-delivery',deviceId:'air-compressor',device:'空压机',type:'异动跟踪',rank:2,title:'加载时间持续延长',summary:'近3班加载时间95 → 112 → 128秒，供气压力仍可达到0.82 MPa；需决定是否检查。',action:'判断是否安排现场核实',evidence:['同一储气压力区间、相近用气条件','加载时间95 → 112 → 128秒','供气压力0.82 MPa；排气温度61 → 65°C'],limit:'当前是加载时间趋势变化，尚不能直接判断供气不足或机体磨损。'}
]
export function workbenchIssues(store){
 const rows=issueCatalog.map(item=>({...item,state:store.todoCreated[item.id]?(isIssueClosed(store,item.id)?'已闭环':'已派发'):store.ignoredSuggestions[item.id]?'已记录决定':'待决策',updatedAt:store.eventUpdatedAt?.[item.id],decisionReason:store.ignoredSuggestions[item.id]?.reason,owner:store.assignments[item.id]?.owner,stage:store.cases[item.id]?.stages[store.progress[item.id]]?.label}))
 const decision=store.suggestionDecisions?.filter(r=>r.id===example.id).at(-1),row=rows.find(r=>r.id==='maintenance');if(row&&!store.todoCreated.maintenance&&!store.ignoredSuggestions.maintenance){row.state=decision?.type==='defer'?'已记录决定':decision?.type==='execute'?'已派发':'待决策';row.decisionReason=decision?.reason;row.owner=decision?.type==='execute'?store.assignments.drift?.owner:undefined}
 return sortIssues(rows)
}
export function captainDeviceSignal(store,deviceId){
 const rows=workbenchIssues(store).filter(i=>i.deviceId===deviceId&&['待决策','已派发'].includes(i.state))
 return rows.some(i=>i.rank<=1)?'danger':rows.length?'warning':'normal'
}
export function captainAnalysis(store,deviceIds){
 const scoped=workbenchIssues(store).filter(i=>!deviceIds||deviceIds.includes(i.deviceId))
 const pending=scoped.filter(i=>i.state==='待决策'),assigned=scoped.filter(i=>i.state==='已派发')
 const active=[...pending,...assigned]
 const isPending=id=>pending.some(i=>i.id===id)
 const cooling=isPending('fault'),warning=isPending('main-warning')
 const focusFor=(id,label,initial)=>{
  const item=active.find(i=>i.id===id)
  if(!item)return ''
  if(item.state==='待决策')return initial
  return store.isTaskHandled?.(id)?`${label}本轮人工处理已提交，仍需结合处理后观测确认恢复是否持续。`:`${label}已有处理任务，需沿原任务核实现场情况及处理结果。`
 }
 let focus=[focusFor('fault','主机冷却系统','主机冷却系统需优先核实：冷却水出口温度越限，同时流量下降。'),focusFor('main-warning','润滑供油',`润滑供油${cooling?'也':''}出现油压下降、滤器压差上升，${cooling?'':'需要核实现场供油状态。'}`)].filter(Boolean).join('')
 if(cooling&&warning)focus+='需要分别核实，目前不能归为同一故障。'
 if(!focus)focus=active.length?'当前重点是核实仍未闭环的设备事项，结合现场结果和处理后的运行变化判断下一步。':'当前没有未闭环事项，不能仅据此判定设备全部健康。'
 const decisions=[]
 if(cooling&&warning)decisions.push('优先评估是否安排冷却系统排查，随后核实润滑供油状态。')
 else if(cooling)decisions.push('优先评估是否安排冷却系统排查。')
 else if(warning)decisions.push(active.some(i=>i.id==='fault')?'评估是否安排润滑供油状态核实；已派发的冷却系统任务沿原记录跟进。':'评估是否安排润滑供油状态核实。')
 const maintenance=pending.find(i=>i.id==='maintenance'),bearingAdvice=maintenance?.title.includes('轴承')
 if(isPending('drift')&&bearingAdvice)decisions.push('3号缸排温偏离和轴承振动缓升仍需现场证据，建议结合检查条件决定是否安排检查，暂不直接安排换件。')
 else {
  if(isPending('drift'))decisions.push('3号缸排温偏离仍需现场证据，建议结合检查条件决定是否安排检查，暂不直接安排换件。')
  if(bearingAdvice)decisions.push('轴承振动缓升仍需现场证据，建议结合检查条件决定是否安排检查，暂不直接安排换件。')
  else if(maintenance)decisions.push(`请审阅“${maintenance.title}”，确认措施及实施条件；沿关联问题事件接续，不重复建立检查任务。`)
 }
 if(!decisions.length)decisions.push(pending.length?'查看待决策事项的分析依据，决定是否安排现场检查。':assigned.length?'当前事项已派发，沿原任务跟进现场反馈及处理结果，不重复安排检查。':'当前没有新的检查安排需要决定，继续结合设备数据与现场记录观察。')
 return `### 当前重点\n\n${focus}\n\n### 需要你决定\n\n${decisions.join('\n\n')}`
}

// Completion of hands-on work is distinct from closure after observation.
export function isIssueClosed(store,id){return store.eventStatus?.[id]==='closed'}
export function activeWorkbenchIssues(store){return workbenchIssues(store).filter(i=>['待决策','已派发'].includes(i.state))}

export const issueDevices=[{value:'main-engine-1',label:'主机'},{value:'steering-gear',label:'舵机'},{value:'air-compressor',label:'空压机'},{value:'boiler',label:'锅炉'}]
export const issueTypes=['报警事件','预警事件','异动跟踪','维保建议']
const deviceOrder=Object.fromEntries(issueDevices.map((d,index)=>[d.value,index]))
export function sortIssues(rows,{stateFirst=false}={}){
 const stateOrder={'待决策':0,'已派发':1}
 const timestamp=item=>{const value=Date.parse(item.updatedAt||'');return Number.isFinite(value)?value:0}
 return [...rows].sort((a,b)=>(stateFirst?(stateOrder[a.state]??2)-(stateOrder[b.state]??2):0)||a.rank-b.rank||(deviceOrder[a.deviceId]??99)-(deviceOrder[b.deviceId]??99)||timestamp(b)-timestamp(a))
}
export function filterIssueRows(rows,{state='',device='',type=''}={}){return sortIssues(rows.filter(i=>['待决策','已派发'].includes(i.state)&&(!state||i.state===state)&&(!device||i.deviceId===device)&&(!type||i.type===type)),{stateFirst:true})}
export function issueBatch(rows,batch=1){return rows.slice(0,Math.max(1,batch)*10)}
