// A dialog edits one business stage. Report tokens/revisions are not new stages.
export const decisionStage=event=>JSON.stringify([event?.id,event?.phase,event?.phases?.at(-1)?.id,event?.currentTask,event?.reports?.filter(r=>r.taskId===event.currentTask).map(r=>[r.id,r.submissionNumber])])
export function createDecisionEditing(){
 const edits=new Map()
 return {
  begin(event){edits.set(event.id,decisionStage(event))},
  end(id){edits.delete(id)},
  preserve(local,incoming){
   if(local&&edits.get(local.id)===decisionStage(local)&&decisionStage(local)===decisionStage(incoming)){
    incoming.decisionDraft=local.decisionDraft
    incoming.pendingPlan=local.pendingPlan
   }
   return incoming
  },
 }
}
