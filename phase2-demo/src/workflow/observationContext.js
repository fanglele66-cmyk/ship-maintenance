// Verification observation shares the existing review phase. It is not a
// maintenance task or evidence that any repair has occurred.
export const isVerificationObservation=task=>task?.observationMode==='verification'
export const observationStart=task=>task?.observationStartedAt||task?.submittedAt
export const hasObservation=task=>task?.kind!=='investigation'||isVerificationObservation(task)
export function observationTaskFor(event,phase=event?.phases?.at(-1)){
 const tasks=event?.tasks||[],pinned=tasks.find(t=>t.id===phase?.observationTaskId)
 if(pinned)return pinned
 const current=tasks.find(t=>t.id===phase?.taskId)||tasks.find(t=>t.id===event?.currentTask)
 if(current&&hasObservation(current))return current
 return [...tasks].reverse().find(t=>t.status==='submitted'&&hasObservation(t)&&Date.parse(t.submittedAt)<=Date.parse(current?.submittedAt))
}
export const isVerificationReview=event=>event?.phase==='review'&&isVerificationObservation(observationTaskFor(event))
