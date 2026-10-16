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
 const scoped=workbenchIssues(store).filter(i=>!deviceIds||deviceIds.includes(i.deviceId))
 const pending=scoped.filter(i=>i.state==='待决策'),assigned=scoped.filter(i=>i.state==='已派发')
 const cooling=pending.some(i=>i.id==='fault'),warning=pending.some(i=>i.id==='main-warning')
 const conclusion=cooling||warning?(deviceIds?'当前展示的主机与辅机中，待决策风险主要集中在主机；已有报警或多指标预警需要优先决策，辅机按自身证据分别评估。':'全船运行风险主要集中在主机，已有报警或多指标预警需要优先决策；其他设备按各自证据和处理进展分别评估。'):'主机的高优先级事项已作出决定，当前重点转为核对已派发任务的现场结果，并评估尚未安排的异动与维保建议。'
 const basis='结合各事项的发生时间与已提交反馈评价。主机直接关系推进能力，冷却温升伴海水供流下降，润滑供油压力下降伴过滤段压损增加，两项当前运行问题分别需要核实，不能归为同一个根因。2号辅机的长期排温变化用于评价健康趋势，本次只请求补充现场信息；轴承提前建议结合既有计划和振动变化评估，不直接决定换件。'
 const next=cooling?'优先查看主机冷却报警并决定排查安排，同时了解润滑供油预警的核实需求；随后评估2号辅机现场反馈与轴承提前建议。已派发任务沿原记录跟进，不重复安排。':warning?'优先了解主机润滑供油预警，决定是否派发现场核实，再查看辅机健康变化和提前维保的依据。':pending.length?'查看仍待决策事项的依据并指定本次任务负责人；已派发事项继续回看原任务。':'当前需要决策的请求均已安排或留有决定，可查看已派发任务结果及设备的持续跟踪。'
 return `### 健康态势分析\n\n${conclusion}\n\n${basis}\n\n### 建议\n\n${next}`
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
