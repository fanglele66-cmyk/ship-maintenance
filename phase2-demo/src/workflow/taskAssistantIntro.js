// A short orientation from the dispatched task, never an inferred diagnosis.
export function taskAssistantIntro(event,task){
 if(!event||!task||!['investigation','repair','maintenance'].includes(task.kind))return []
 const kind=task.kind==='investigation'?(task.purpose==='recheck'?'复查':'排查'):task.kind==='maintenance'?'维保':'维修'
 return [`我是任务助手，可以回答本步骤的问题，帮你整理${kind}备注。`,'照片可附在步骤备注里，也可在这里发送，两处的照片都会随步骤进入报告。需要追问时可选答案或填写「其他」，草稿核对后由你采用。']
}
