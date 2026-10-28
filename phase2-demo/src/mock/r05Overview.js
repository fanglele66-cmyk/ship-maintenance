import { taskReceipt } from '../message-flows/taskReceipt.js'

// Fictional execution snapshot. Current actions are separate from this immutable report.
export const healthReview={
 runId:'main-engine-health-20261012-0800',completedAt:'2026/10/12 08:00',dataCutoff:'2026/10/12 07:55',analysisRange:'10/11 08:00—10/12 07:55 · 近24小时',
 conditions:'转速94–96 rpm，负荷68%–72%；剔除启停、机动及负荷快速变化片段',coverage:'有效覆盖率98.6%；不足部分不按正常处理',
 conclusion:'本次有3项需要人员跟进：冷却系统检查事件、3#缸现场核实、1#缸连杆轴承提前检查建议。其余已覆盖指标暂未发现值得新增关注的变化；当前证据不足以确认相关部件故障，也不代表未覆盖部位正常。',
 recommendation:'先跟进冷却系统原事件中的检查要求；核对3#缸现场排温、当时工况与现场现象；结合已有维保安排和靠港条件，决定是否开展轴承提前检查。',
 basis:'冷却水出口温度92.4°C、流量68.2 m³/h，温升与流量下降同时出现；3#缸排温430→432°C、缸间相对差9→10°C；4#缸相对差8→7°C，仍高于近期历史表现；轴承近7日振动2.1→3.0 mm/s，温度约65°C，尚无现场磨损确认记录。',
 change:'3#缸相对差9→10°C，需要现场核实；冷却系统与轴承的未完成行动继续沿原记录处理。',
 sections:[
 {title:'冷却系统：联合变化，继续核实',paragraphs:['出口水温偏高与流量下降同时出现，提示冷却侧供给或换热能力可能减弱。需结合负荷、现场读数及回路状态核实，不能直接定位滤器或泵故障。已有检查事件，继续沿原事件处理，不新增重复关注。']},
 {title:'3#缸：偏差扩大，等待现场核实',paragraphs:['相对偏差已在多个可比片段反复出现，本次由9°C扩大至10°C，排温升至432°C。请核实现场读数、工况与现象，当前不能确诊喷油器或气阀故障。完整核实后保留回执，是否开展检查仍依后续研判及人员决定。']},
 {title:'4#缸：反复偏差，暂未扩大',paragraphs:['相对差由8°C降至7°C，暂未扩大，但仍高于近30天同工况通常3–4°C的表现，继续跟踪。不因一次回落结束关注，无需重复要求人员确认。']},
 {title:'轴承：趋势值得核验，尚不直接换件',paragraphs:['振动近7日由2.1升至3.0 mm/s，温度约65°C，未同步明显抬升。累计运行1,860 h，距2,000 h计划节点约140 h，约48小时后有靠港窗口。结合原维保安排评估提前检查，不凭振动趋势认定轴瓦磨损或批准换件。']},
 {title:'分析范围与历史收束',paragraphs:['2#缸原排温偏差已收敛，本轮专项观察结束，无检修执行。泵压力及机体振动小幅变化暂无独立关注依据，保留在传感器数据。未接入的缸压、部位振动等证据不默认存在。','本报告为当次分析结果；提交反馈或人员决定不会改写本次研判。当前行动随业务进展更新，新增研判应单独标明时间和范围。']}
 ]
}
export const healthReviewReceipt=taskReceipt({
 id:'main-engine-health-receipt-20261012-0800',runId:healthReview.runId,title:'主机每日健康回顾',completedAt:healthReview.completedAt,executionStatus:'completed',subject:'主机',analysisRange:healthReview.analysisRange,
 conclusion:healthReview.conclusion,change:healthReview.change,arrangement:healthReview.recommendation,requiresAction:true,dataLimit:healthReview.coverage+'；结论仅覆盖已接入指标。',
 actions:[{id:'todo:fault',label:'查看冷却系统事件'},{id:'item:drift',label:'查看3#缸异动跟踪档案'},{id:'item:bearing-health',label:'查看轴承异动跟踪'}]
})

export function overviewActions(store,advice={}){
 const observation=id=>{const result=store.getObservationResult(id);return {tag:store.attentionAction(id).phase,text:result.text,priority:result.type==='reinspect'||result.type==='extend'?0:5}}
 const rows=[
 {id:'fault',type:'关联事件',title:'冷却系统 · 温度与流量异常',tag:'检查处理中',text:'出口水温92.4°C、流量68.2 m³/h。需要继续原事件，核对现场读数及冷却回路状态。',priority:0},
 {id:'drift',type:'异动跟踪',title:'3#缸 · 排温偏离扩大',tag:store.attentionAction('drift').phase,text:store.attentionAction('drift').text,priority:store.attentionAction('drift').required||store.todoCreated.drift?1:4},
 {id:'bearing-health',taskId:'maintenance',type:'异动跟踪',title:'1#缸连杆轴承 · 振动缓升',tag:advice.status||'待确认开展检查',text:advice.decision==='defer'?'暂不采纳的决定与原因已记录，保留原问题；已关联事件继续在原事件跟进。':advice.decision==='execute'?'已采纳，需在原问题事件中接续实际维护与验收。':store.todoCreated.maintenance?'已关联检查事件，继续现场检查；尚不直接确认磨损或换件。':'振动2.1→3.0 mm/s，距计划节点约140 h。需要决定是否开展提前检查，尚不能直接决定换件。',priority:2},
 {id:'cyl4-watch',type:'异动跟踪',title:'4#缸 · 相对偏差反复出现',tag:'系统跟踪中',text:'相对差8→7°C，暂未扩大。暂无需人员操作，系统继续跟踪。',priority:4}
 ]
 for(const row of rows){
  if(store.isTaskHandled(row.id)){Object.assign(row,observation(row.id));row.type='异动跟踪'}
  if(row.id==='drift'&&store.todoCreated.drift&&!store.isTaskHandled('drift')){row.type='关联事件';row.text='检查与补证在原事件接续；异动跟踪档案保留原证据，不重复建立任务。'}
 }
 return rows.filter(row=>row.tag!=='已结束' && !(row.taskId==='maintenance'&&advice.decision==='defer'&&!store.todoCreated.maintenance)).sort((a,b)=>a.priority-b.priority)
}

export function deviceHealthReply(store,text){
 if(/先做|做什么|今日|今天|待处理/.test(text))return '先查看冷却系统原事件的当前检查要求。3#缸：'+store.attentionAction('drift').text+'。轴承请查看事件概览内的最新人员决定与安排；4#缸暂无人工要求。'
 if(/滤器|堵塞|堵了/.test(text))return '温升与流量下降提示冷却侧可能发生变化，但尚不能定位滤器堵塞。需要结合现场读数、泵组和回路状态检查，具体排查沿原冷却系统事件接续。'
 if(/4#|4号/.test(text))return '4#缸相对差本次由8°C降至7°C，暂未扩大，但仍反复出现；继续系统跟踪，不单凭这项变化要求维修。新的现场情况可在该异动跟踪档案补充。'
 if(/3#|3号|核对了|核实了/.test(text))return '3#缸当前安排：'+store.attentionAction('drift').text+'。普通留言不能替代结构化核实，核实提交也不等于确诊或已开展检查。'
 if(/全部|正常|健康|没问题/.test(text))return '目前仍有待核实或处理的问题，不能认定整台主机全部正常。最后有效健康研判为'+healthReview.completedAt+'，仅覆盖已接入指标；未覆盖部位仍按原巡检规程检查。'
 if(/维保|轴承|1#/.test(text))return '轴承振动缓升值得核验，但不能据此确认磨损或直接换件。请在“事件概览”内查看建议的最新证据、人员决定与原计划关联，不重复建立任务。'
 return '本次主机健康研判完成于'+healthReview.completedAt+'，数据截止'+healthReview.dataCutoff+'。'+healthReview.recommendation+' 当前行动可在左侧列表查看。'
}
