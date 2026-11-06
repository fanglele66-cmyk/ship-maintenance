// A complete form records the user's decision; it does not imply successful
// execution or a resolved fault. Notes remain optional for every result.
export function isTaskStepComplete(step,record){
 const result=record?.result
 if(typeof result!=='string'||!result.trim()||!Array.isArray(step?.options)||!step.options.includes(result))return false
 return !/无法确认|受限/.test(result)||['已完成','未完成'].includes(record.executionStatus)
}
