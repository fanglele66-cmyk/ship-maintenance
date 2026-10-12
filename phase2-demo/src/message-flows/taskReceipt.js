// A receipt is the snapshot of one execution, never the live dossier summary.
export function assertTaskReceipt(message){
  for(const key of ['runId','title','completedAt','subject','analysisRange','conclusion','arrangement'])if(typeof message[key]!=='string'||!message[key].trim())throw new Error(`Missing task receipt field: ${key}`)
  if(!['completed','partial','failed'].includes(message.executionStatus))throw new Error('Invalid task receipt execution status')
  if(message.executionStatus!=='completed' && !message.dataLimit)throw new Error('Incomplete task receipt requires a data limitation')
  if(message.actions && (!Array.isArray(message.actions)||message.actions.some(a=>!a.id||!a.label)))throw new Error('Invalid task receipt actions')
}
export function taskReceipt(content){
  const message={...content,type:'taskReceipt',role:'assistant'}
  assertTaskReceipt(message)
  return message
}
