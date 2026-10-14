export const issueCatalog=[
 {id:'fault',deviceId:'main-engine-1',device:'主机',type:'报警事件',rank:0,title:'冷却水出口温度报警',summary:'出口水温92.4°C，超过本机85°C报警设置；流量68.2 m³/h低于本机要求，需排查原因。',action:'核实报警并派发排查',evidence:['出口水温92.4°C；本机报警设置85°C','流量68.2 m³/h；本机要求不低于80 m³/h','进口水温48.7°C，未出现同步升高'],limit:'报警表明测点越限；现场仪表或测点异常仍可能导致误报，核实后可反馈。'},
 {id:'main-warning',deviceId:'main-engine-1',device:'主机',type:'预警事件',rank:1,title:'润滑供油异常预警',summary:'同工况油压下降与滤器压差上升相互印证，建议先核对现场读数，再定位供油异常。',action:'派发真实性核实与排查',evidence:['油压0.31 → 0.27 → 0.24 MPa','滤器压差0.03 → 0.05 → 0.07 MPa','油温67–69°C、液位80%–82%，未同步明显变化'],limit:'综合证据支持较高的异常可能性，但仍需核对采集与现场仪表；不据此直接确认堵塞部位。'},
 {id:'drift',deviceId:'main-engine-1',device:'主机',type:'异动跟踪',rank:2,title:'3号缸排温偏离扩大',summary:'同工况相对偏差由8°C扩大至10°C，排温432°C尚未达到本机450°C报警设置；需决定是否安排核实。',action:'判断是否安排现场核实',evidence:['同工况排温428 → 432°C','与其他缸均值差8 → 10°C','尚未取得现场仪表和异响核实结果'],limit:'当前是局部指标偏离，尚未形成多指标联动判断，不能确认故障或部件原因。'},
 {id:'maintenance',deviceId:'main-engine-1',device:'主机',type:'维保建议',rank:3,title:'连杆轴承提前检查建议',summary:'距周期检修约140运行小时，结合振动缓升和约48小时后的靠港窗口，评估是否提前检查。',action:'评估提前检查并指派',evidence:['累计1,860 h；周期节点2,000 h','近7日振动2.1 → 3.0 mm/s','下一靠港窗口约48小时后，作业条件尚需确认'],limit:'这是基于周期计划的提前窗口建议，应先检查是否有必要提前；不直接决定换件或重置原周期。'},
 {id:'steering-heat',deviceId:'steering-gear',device:'舵机',type:'报警事件',rank:0,title:'液压油温度超限',summary:'油温78°C已报警，排查已派发给赵明；需结合操舵负荷与散热检查反馈跟进。',action:'查看负责人处理进展',evidence:['油温78°C超出原事件参考上限','油压12.5 MPa、油位68%、流量45.2 L/min','尚无证据直接确认冷却器结垢'],limit:'保持原事项接续，依据现场反馈判断，不重复派发。'},
 {id:'air-delivery',deviceId:'air-compressor',device:'空压机',type:'异动跟踪',rank:2,title:'加载时间持续延长',summary:'近3班加载时间95 → 112 → 128秒，供气压力仍可达到0.82 MPa；需决定是否检查。',action:'判断是否安排现场核实',evidence:['同一储气压力区间、相近用气条件','加载时间95 → 112 → 128秒','供气压力0.82 MPa；排气温度61 → 65°C'],limit:'当前是加载时间趋势变化，尚不能直接判断供气不足或机体磨损。'}
]
export function workbenchIssues(store){
 const rows=issueCatalog.map(item=>({...item,state:store.todoCreated[item.id]?(isIssueClosed(store,item.id)?'已闭环':'已派发'):store.ignoredSuggestions[item.id]?'已记录决定':'待决策',updatedAt:store.eventUpdatedAt?.[item.id],decisionReason:store.ignoredSuggestions[item.id]?.reason,owner:store.assignments[item.id]?.owner,stage:store.cases[item.id]?.stages[store.progress[item.id]]?.label}))
 return sortIssues(rows)
}
export function captainDeviceSignal(store,deviceId){
 const rows=workbenchIssues(store).filter(i=>i.deviceId===deviceId&&['待决策','已派发'].includes(i.state))
 return rows.some(i=>i.rank<=1)?'danger':rows.length?'warning':'normal'
}
export function captainAnalysis(store,deviceIds){
 const scoped=workbenchIssues(store).filter(i=>!deviceIds||deviceIds.includes(i.deviceId))
 const pending=scoped.filter(i=>i.state==='待决策'),assigned=scoped.filter(i=>i.state==='已派发')
 const cooling=pending.some(i=>i.id==='fault'),warning=pending.some(i=>i.id==='main-warning')
 const conclusion=cooling||warning?(deviceIds?'当前展示的主机与辅机中，待决策风险主要集中在主机；已有报警或多指标预警需要优先决策，辅机按自身证据分别评估。':'全船运行风险主要集中在主机，已有报警或多指标预警需要优先决策；其他设备按各自证据和处理进展分别评估。'):'主机的高优先级事项已作出决定，当前重点转为核对已派发任务的现场结果，并评估尚未安排的异动与维保建议。'
 const basis='主机直接关系推进能力，温升与流量变化、润滑压力与阻力变化分别指向不同的风险，需要独立核实，不能归为同一个故障。'+(deviceIds?'辅机应按各自测点及运行工况独立评估，不将主机结论直接套用于辅机；未生成事项不代表设备全部健康。':'舵机油温问题已派发处理；空压机加载时间延长尚不足以确认原因，应结合现场核实再判断。')
 const next=cooling?'优先了解主机冷却水报警并派发排查，核实报警真实性、原因与处置范围；随后核对润滑供油预警，安排现场指标比对。再决定局部异动和提前维保的检查安排。':warning?'优先核对主机润滑供油预警并派发现场检查，先确认读数是否一致，再定位原因；其他已派发事项沿原任务跟进。':pending.length?'查看下方仍待决策的事项，结合证据采纳并指定负责人，或记录本次不采纳的依据；已派发事项查看原任务进展。':'本轮需要决策的事项均已处理，可查看已派发任务的负责人及最新结果，不重复派发。'
 return `### 健康态势分析\n\n${conclusion}\n\n${basis}\n\n### 建议\n\n${next}`
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
