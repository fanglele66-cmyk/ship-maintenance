import {workflowIssues,historicalDecisions} from './fourStoryWorkflow.js'
const legacyIssueCatalog=[
 {id:'fault',deviceId:'main-engine-1',device:'主机',type:'报警事件',rank:0,title:'冷却水出口温度报警',summary:'出口水温92.4°C，超过本机85°C报警设置；流量68.2 m³/h低于本机要求，需排查原因。',action:'核实报警并派发排查',evidence:['出口水温92.4°C；本机报警设置85°C','流量68.2 m³/h；本机要求不低于80 m³/h','进口水温48.7°C，未出现同步升高'],limit:'报警表明测点越限；现场仪表或测点异常仍可能导致误报，核实后可反馈。'},
 {id:'main-warning',deviceId:'main-engine-1',device:'主机',type:'预警事件',rank:1,title:'润滑供油异常预警',summary:'同工况油压下降与滤器压差上升相互印证，建议先核对现场读数，再定位供油异常。',action:'派发真实性核实与排查',evidence:['油压0.31 → 0.27 → 0.24 MPa','滤器压差0.03 → 0.05 → 0.07 MPa','油温67–69°C、液位80%–82%，未同步明显变化'],limit:'综合证据支持较高的异常可能性，但仍需核对采集与现场仪表；不据此直接确认堵塞部位。'},
 {id:'drift',deviceId:'main-engine-1',device:'主机',type:'异动跟踪',rank:2,title:'3号缸排温偏离扩大',summary:'同工况相对偏差由8°C扩大至10°C，排温432°C尚未达到本机450°C报警设置；需决定是否安排核实。',action:'判断是否安排现场核实',evidence:['同工况排温428 → 432°C','与其他缸均值差8 → 10°C','尚未取得现场仪表和异响核实结果'],limit:'当前是局部指标偏离，尚未形成多指标联动判断，不能确认故障或部件原因。'},
 {id:'maintenance',deviceId:'main-engine-1',device:'主机',type:'维保建议',rank:3,title:'连杆轴承提前检查建议',summary:'距周期检修约140运行小时，结合振动缓升和约48小时后的靠港窗口，评估是否提前检查。',action:'评估提前检查并指派',evidence:['累计1,860 h；周期节点2,000 h','近7日振动2.1 → 3.0 mm/s','下一靠港窗口约48小时后，作业条件尚需确认'],limit:'这是基于周期计划的提前窗口建议，应先检查是否有必要提前；不直接决定换件或重置原周期。'},
 {id:'steering-heat',deviceId:'steering-gear',device:'舵机',type:'报警事件',rank:0,title:'液压油温度超限',summary:'油温78°C已报警，排查已派发给赵明；需结合操舵负荷与散热检查反馈跟进。',action:'查看负责人处理进展',evidence:['油温78°C超出原事件参考上限','油压12.5 MPa、油位68%、流量45.2 L/min','尚无证据直接确认冷却器结垢'],limit:'保持原事项接续，依据现场反馈判断，不重复派发。'},
 {id:'air-delivery',deviceId:'air-compressor',device:'空压机',type:'异动跟踪',rank:2,title:'加载时间持续延长',summary:'近3班加载时间95 → 112 → 128秒，供气压力仍可达到0.82 MPa；需决定是否检查。',action:'判断是否安排现场核实',evidence:['同一储气压力区间、相近用气条件','加载时间95 → 112 → 128秒','供气压力0.82 MPa；排气温度61 → 65°C'],limit:'当前是加载时间趋势变化，尚不能直接判断供气不足或机体磨损。'}
]
export const issueCatalog=[...workflowIssues,...historicalDecisions.map(item=>({...item,rank:['报警事件','预警事件','异动跟踪','维保建议'].indexOf(item.type),summary:item.reason,evidence:item.facts,limit:item.outcome,history:true,action:'查看记录'}))]
export function workbenchIssues(store){
 const rows=issueCatalog.filter(item=>!item.latent||store.unlockedRecommendations?.[item.id]).map(item=>({...item,state:item.history||isIssueClosed(store,item.id)?'已闭环':store.todoCreated[item.id]?'已派发':store.ignoredSuggestions[item.id]?'已记录决定':'待决策',updatedAt:store.eventUpdatedAt?.[item.id]||item.at,decisionReason:store.ignoredSuggestions[item.id]?.reason,owner:store.assignments[item.id]?.owner||item.actor,stage:store.completedTasks?.[item.id]?.title||store.cases[item.id]?.stages[store.progress[item.id]]?.label}))
 return sortIssues(rows)
}
export function captainDeviceSignal(store,deviceId){
 const rows=workbenchIssues(store).filter(i=>i.deviceId===deviceId&&['待决策','已派发'].includes(i.state))
 return rows.some(i=>i.rank<=1)?'danger':rows.length?'warning':'normal'
}
export function captainAnalysis(store,deviceIds){
 const rows=workbenchIssues(store).filter(item=>!item.history&&(!deviceIds||deviceIds.includes(item.deviceId)))
 const pending=rows.filter(item=>item.state==='待决策'),assigned=rows.filter(item=>item.state==='已派发')
 const brief=rows.map(item=>'- **'+item.title+'**：'+item.state+(item.stage?' · '+item.stage:'')).join('\n')
 return `### 健康态势分析\n\n当前有 ${pending.length} 项待决策、${assigned.length} 项已派发。0430 二缸报警、0523 控制空气预警、倒车试验核实与临修后维保按各自证据推进。\n\n${brief}\n\n### 建议\n\n优先核对报警和低压预警的现场依据；倒车试验需结合操纵背景解释，减压阀维保分别评估必要性与条件。已有任务沿原事项跟进。\n\n0523 预警与后续维保关联同一设备问题，核实结果与检修安排沿原记录接续。`
}

// Completion of hands-on work is distinct from closure after observation.
export function isIssueClosed(store,id){return store.eventStatus?.[id]==='closed'}
export function activeWorkbenchIssues(store){return workbenchIssues(store).filter(i=>['待决策','已派发'].includes(i.state))}

export const issueDevices=[{value:'main-engine-1',label:'主机'},{value:'aux-engine-1',label:'1号辅机'},{value:'aux-engine-2',label:'2号辅机'},{value:'aux-engine-3',label:'3号辅机'}]
export const issueTypes=['报警事件','预警事件','异动跟踪','维保建议']
const deviceOrder=Object.fromEntries(issueDevices.map((d,index)=>[d.value,index]))
export function sortIssues(rows,{stateFirst=false}={}){
 const stateOrder={'待决策':0,'已派发':1}
 const timestamp=item=>{const value=Date.parse(item.updatedAt||'');return Number.isFinite(value)?value:0}
 return [...rows].sort((a,b)=>(stateFirst?(stateOrder[a.state]??2)-(stateOrder[b.state]??2):0)||a.rank-b.rank||(deviceOrder[a.deviceId]??99)-(deviceOrder[b.deviceId]??99)||timestamp(b)-timestamp(a))
}
export function filterIssueRows(rows,{state='',device='',type=''}={}){return sortIssues(rows.filter(i=>['待决策','已派发'].includes(i.state)&&(!state||i.state===state)&&(!device||i.deviceId===device)&&(!type||i.type===type)),{stateFirst:true})}
export function issueBatch(rows,batch=1){return rows.slice(0,Math.max(1,batch)*10)}
