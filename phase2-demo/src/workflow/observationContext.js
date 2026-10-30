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
export function observationPolicy(event){
 const tracking=Boolean(event?.tracking)
 return {intervalMs:tracking?7*86400000:7200000,label:tracking?'一周':'两小时',maxWindowMs:tracking?21*86400000:72*3600000,gapThresholdMs:tracking?15*60000:120000,trendMs:tracking?86400000:30*60000,minComparableMs:tracking?6*3600000:30*60000,requiredCondition:'稳态航行，转速与负荷记录完整且处于可比范围'}
}
