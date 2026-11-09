// A short orientation from the dispatched task, never an inferred diagnosis.
export function taskAssistantIntro(event,task){
 if(!event||!task||!['investigation','repair','maintenance'].includes(task.kind))return []
 const kind=task.kind==='investigation'?(task.purpose==='recheck'?'复查':'排查'):task.kind==='maintenance'?'维保':'维修'
 return [`我是任务助手，可以帮你把现场情况整理成${kind}备注。`,`你说情况，也可以发照片或读数截图；我会在需要时追问，核对后由你采用。`]
}
