import { healthReviewReceipt } from '../mock/r05Overview.js'

// Bind business state in JavaScript; JSON only selects presentation and order.
export function deviceMessageSources(store) {
    const drift = store.cases.drift.stages[store.progress.drift]
  return {
    dailyReview: healthReviewReceipt,
    driftNotice: {role:'assistant',kind:'scene',demoLabel:store.monitorStep.drift||store.todoCreated.drift?'行动提醒 · 状态变化':'持续关注',title:store.isTaskHandled('drift') ? store.getObservationResult('drift').title : store.todoCreated.drift ? '3#缸检查与处置正在接续' : store.attentionFeedback?.drift ? '3#缸现场核实已提交，系统继续跟踪' : store.monitorStep.drift ? '3#缸出现新证据，需要现场核对' : '3#缸排温偏差持续关注',at:store.attentionFeedback?.drift?.createdAt || '2026/10/12 08:00',paragraphs:store.isTaskHandled('drift')?[{label:'效果判断',text:store.getObservationResult('drift').text},{label:'验证口径',text:'继续对照原排温差与异响，依据连续记录决定收束、补证或复查。'}]:store.todoCreated.drift?[{label:'处理进展',text:drift.summary},{label:'当前任务',text:store.progress.drift<2?'人员已同意建立检查待办，仍需核对读数和异响，才能判断异常是否成立。':'事件已经确立，后续排查验证原因；原监测证据和人员反馈继续保留。'}]:[{label:store.monitorStep.drift?'证据变化':'监测证据',text:store.monitorStep.drift?'原反复偏差在新增可比片段中扩大，并出现波动变化；需要现场核实，尚不能确诊。':'多个独立可比片段反复偏离，区别于此前表现；暂由系统跟踪。'},{label:'当前建议',text:store.attentionFeedback?.drift?'本次现场核实已提交，不等于排除故障；后续分析尚未更新。':store.monitorStep.drift?'核对现场仪表、异响与振动能否复现，先判断是否需要建立检查待办。':'继续比较相近转速与负荷样本；出现偏差扩大等新证据后再请求现场确认。'}],actions:[{id:'item:drift',label:store.isTaskHandled('drift')?'查看3#缸效果观察':'查看3#缸关注材料'},...(store.todoCreated.drift?[{id:'todo:drift',label:'查看关联待办'}]:[])]},
    watchNotice:{role:'assistant',kind:'scene',title:'4#缸 · 反复偏差由系统跟踪',demoLabel:'演示场景 · 持续关注',paragraphs:[{label:'关注依据',text:'相对偏差在多个独立可比片段中反复出现，与此前表现不同，暂未扩大。'},{label:'当前安排',text:'无人工任务；每日回顾可比表现，不重复要求确认。'}],actions:[{id:'item:cyl4-watch',label:'查看4#缸关注档案'}]},
    planLinks: {role:'assistant',kind:'scene',demoLabel:'计划与执行关联',title:'轴承建议与冷却系统待办',at:'2026/10/12 08:00',paragraphs:[{label:'轴承维保',text:store.todoCreated.maintenance?`提前维保已关联待办，${store.isTaskHandled('maintenance')?'人工处理已完成，持续效果在设备态势验证':'当前处于'+store.cases.maintenance.stages[store.progress.maintenance].label}；实际作业由现场反馈记录，效果由观察数据验证。`:'轴承近7日振动持续上行，距周期检修约140 h。提前建议与常规计划针对同一部件，先检查后决定是否提前保养。'},{label:'冷却系统',text:store.cases.fault.stages[store.progress.fault].summary}],actions:[{id:'item:maintenance',label:'查看轴承维保建议'},{id:store.isTaskHandled('fault')?'item:fault':'todo:fault',label:store.isTaskHandled('fault')?'查看冷却系统效果观察':'查看冷却系统待办'}]},
  }
}

export function deviceConversationRecords(messages) {
  return messages.filter(message => !(message.role === 'assistant' && message.title === '主机每日健康回顾') && !(message.role === 'user' && message.text?.startsWith('查看')))
}
