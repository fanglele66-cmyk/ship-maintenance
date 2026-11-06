// A short orientation from the dispatched task, never an inferred diagnosis.
export function taskAssistantIntro(event,task){
 if(!event||!task||!['investigation','repair','maintenance'].includes(task.kind))return []
 const kind=task.kind==='investigation'?(task.purpose==='recheck'?'复查':'排查'):task.kind==='maintenance'?'维保':'维修'
 const intro=[`我是任务助手，可以帮你把现场情况整理成${kind}备注。`,`你说情况，也可以发照片或读数截图；我会在需要时追问，核对后由你采用。`]
 const status={
  submitted:'本轮反馈已提交，可结合报告核对实际完成情况和仍待确认事项。',
  reporting:'现场反馈已回交，报告正在生成，当前可核对原始记录。',
  'report-error':'现场反馈已回交，报告分析尚未生成完成，可核对记录或重试。',
  waiting:'当前等待执行条件，未完成部分仍需按任务记录确认后再继续。',
  terminated:'本任务未执行部分已终止，可回看已提交记录与终止说明。',
 }[task.status]
 if(status)intro.push(status)
 return intro
}
