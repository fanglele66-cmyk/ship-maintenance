// Submission receipts belong to the conversation timeline, not a footer that
// follows every future reply. Keep this projection out of persisted chat/history.
export function taskAssistantTimeline(task,messages,reports=[]){
 if(task?.status!=='submitted')return messages
 const submittedAt=Date.parse(task.submittedAt)
 const report=reports.findLast(report=>report.taskId===task.id&&Date.parse(report.at)===submittedAt)
 const reportId=report?.id||task.reportGeneration?.factReportId
 const hasReceipt=messages.some(message=>message.reportId&&(reportId?message.reportId===reportId:Number.isFinite(submittedAt)&&Date.parse(message.at)===submittedAt))
 if(hasReceipt)return messages
 const receipt={id:`task-feedback:${task.id}:${task.submittedAt||'submitted'}`,kind:'receipt',title:'本轮反馈已收录',text:task.summary,taskFeedback:true,at:task.submittedAt}
 // Preserve stored message order (including streamed replies). Equal or absent
 // timestamps place the receipt before subsequent discussion deterministically.
 const index=messages.findIndex(message=>!Number.isFinite(submittedAt)||!Number.isFinite(Date.parse(message.at))||Date.parse(message.at)>=submittedAt)
 const offset=index<0?messages.length:index
 return [...messages.slice(0,offset),receipt,...messages.slice(offset)]
}
