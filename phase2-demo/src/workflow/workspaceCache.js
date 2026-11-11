// Only demo cases share browser storage. Real events use authenticated backend reads.
export function demoWorkspace(state){
 const events=Object.fromEntries(Object.entries(state.events||{}).filter(([,event])=>!event.backendManaged))
 return {...state,events,notices:(state.notices||[]).filter(notice=>events[notice.eventId])}
}
export function mergeDemoWorkspace(state,incoming){
 const demo=demoWorkspace(incoming)
 const real=Object.fromEntries(Object.entries(state.events).filter(([,event])=>event.backendManaged))
 return {...demo,events:{...demo.events,...real},notices:[...demo.notices,...state.notices.filter(notice=>real[notice.eventId])]}
}
