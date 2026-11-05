// Recheck describes the purpose of an investigation, not a fourth task type.
export const taskTypes = Object.freeze({investigation:'排查任务',repair:'维修任务',maintenance:'维保任务'})
export const taskName = task => (taskTypes[task?.kind] || taskTypes.repair).replace(/任务$/, '')
export const taskRoundLabel = task => `第${task.round}轮${taskName(task)}${task.purpose==='recheck'?'（复查）':''}`
export function taskTitle(task){
 const heading=`第${task.round}轮${taskName(task)}任务${task.purpose==='recheck'?'（复查）':''}`
 // Present saved generated titles consistently without rewriting historical records.
 if(task.title)return task.purpose==='recheck'
  ?task.title.replace(/^第\d+轮(?:复查|排查)任务(?:（复查）)?(?= · |$)/,heading)
  :task.title
 return `${heading} · ${task.steps?.[0]?.short||task.steps?.[0]?.label||'现场执行'}`
}
