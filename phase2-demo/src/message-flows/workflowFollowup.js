export function workflowFollowup(store,id,trackingId){
 const tracking=store.trackingDispositions[trackingId||id],stage=store.cases[id]?.stages[store.progress[id]],execution=store.executionRecords[id]?.at(-1)
 if((!trackingId||id===trackingId)&&tracking?.status==='closed'&&tracking.arrangement)return {title:'维保安排已确认',question:`已安排${tracking.arrangement.owner}。备件、隔离许可与靠港窗口是否还有需要协调的事项？`,questions:['这次维保的作业范围是什么？','维保完成后如何验收与跟踪？']}
 if(store.eventStatus[id]==='closed')return {title:'闭环后的跟踪',question:'本次处理已归档。后续还需要关注哪些信号，出现什么情况时应重新核查？',questions:['归档保留了哪些处理依据？','后续需要关注哪些异常？']}
 if((!trackingId||id===trackingId)&&tracking?.status==='recommendation')return {title:'确认维保前再核对',question:'专项检查范围已形成。准备安排哪个靠港窗口，备件、人员与隔离条件是否具备？',questions:['这次维保需要准备什么？','如何选择合适的靠港窗口？']}
 if((!trackingId||id===trackingId)&&tracking?.status==='observing')return {title:'观察计划已安排',question:'本轮观察需要覆盖哪些负荷与运行条件，哪些变化需要提前回交轮机长？',questions:['本轮观察的判断条件是什么？','什么情况需要提前复查？']}
 if(execution&&execution.round===(store.workflowRounds[id]||1)&&store.isTaskHandled(id))return {title:'验收后的效果确认',question:'现场验收已提交。原报警是否再次出现，当前工况与维修前是否可比？',questions:['本轮验收确认了什么？','现在可以确认闭环吗？']}
 if(store.workStepRecords[id+':'+stage?.id])return {title:'作业反馈已保存',question:'实际处理的部位与批准范围是否一致，哪些项目需要在验收时重点复测？',questions:['本轮重点验收哪些项目？','还有哪些未完成项？']}
 if(store.checkAssessments[id])return {title:'排查后的进一步核对',question:store.checkAssessments[id].advance?'已收到排查结果。确认的原因和异常部位是否足以支持本轮维修范围？':'已收到核实反馈。剩余变化是否已有解释，还是需要追加专项检查？',questions:['根据本轮发现具体修什么？','还需要补充哪些原因依据？']}
 if(store.todoCreated[id])return {title:'派发后的核对',question:'负责人和完成时限已确定。现场检查条件与所需资料是否已经准备好？',questions:['本次检查先核对哪些部位？','提交时需要哪些现场依据？']}
 return null
}
