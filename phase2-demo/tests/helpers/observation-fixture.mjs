import {createObservationEvent} from '../../src/workflow/observationEvents.js'
import {observationTaskFor} from '../../src/workflow/observationContext.js'
export function startObservation(state,parent,at){
 const work=observationTaskFor(parent)||parent.tasks.find(t=>t.id===parent.currentTask)
 const event=createObservationEvent(state,parent,work,{at:at||work.submittedAt,reason:'测试用：依据本轮报告建立独立观察事件。'})
 return {event,task:observationTaskFor(event),id:event.id}
}
export function shoreForm(event){const r=event.reports.at(-1);return {action:'shore',reason:'同步最新报告供岸基核对。',shoreReportId:r.id,shoreBaseMarkdown:r.markdown,shoreMarkdown:r.markdown}}
