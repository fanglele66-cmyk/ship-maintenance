import {reportTask} from './reportSubmissions.js'
import {taskTitle} from './taskLabels.js'

// A report belongs to its recorded task, never to whichever task is current now.
// Observation events can refer back to an original event's task snapshot.
export function reportCardTask(report,events){
 const event=events?.[report?.eventId]
 if(!event||!report.taskId)return null
 const local=event.tasks?.find(task=>task.id===report.taskId)
 const snapshot=report.submissionSnapshot?.id===report.taskId?report.submissionSnapshot:null
 const task=reportTask(event,report)||local||snapshot
 if(!task||task.id!==report.taskId)return null
 const linked=Object.values(events).some(item=>item.tasks?.some(candidate=>candidate.id===task.id))
 // Initial observation bases are system records, not dispatched execution tasks.
 if(!linked&&!(task.round>0))return null
 return {id:task.id,title:taskTitle(task),path:linked?'/tasks/'+task.id:null}
}
