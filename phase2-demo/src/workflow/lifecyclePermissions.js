export const people={captain:'陈志远（轮机长）',engineer:'李建国（大管轮）',secondEngineer:'王海（二管轮）'}
// Prototype capability fixtures. Production authentication must supply this identity.
export const capabilities={captain:{decide:true,dispatch:true,execute:false},engineer:{decide:false,dispatch:false,execute:true},secondEngineer:{decide:false,dispatch:false,execute:true}}
export const executors=Object.entries(people).filter(([role])=>capabilities[role].execute).map(([role,name])=>({role,name}))
export const dispatchers=Object.entries(people).filter(([role])=>capabilities[role].dispatch).map(([role,name])=>({role,name}))
export const actor=state=>people[state.role]
export const ownsTask=(role,task)=>Boolean(capabilities[role]?.execute&&task?.owner===people[role])
export const canDispatch=state=>state.role==='captain'
export function visibleTaskRecords(task,role){return ownsTask(role,task)&&task.status==='assigned'?task.draft?.records||[]:task.records||[]}
