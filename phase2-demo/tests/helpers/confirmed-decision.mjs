// Legacy scenario fixtures now supply the explicit confirmations required by M09,
// editable observation plans (M11) and closure preview (M13). Gate rejection is
// covered with direct reducer calls in approved-adjustments.test.mjs.
import {decide as reduce} from '../../src/workflow/eventLifecycle.js'
import {observationPlanDraft,closureDraft} from '../../src/workflow/decisionDrafts.js'
export function decide(state,id,form){const event=state.events[id];return reduce(state,id,{...(form.action==='observe'?{observationPlan:observationPlanDraft(event)}:{}),...(['close','false'].includes(form.action)?{closureDraft:closureDraft(event),remainingDisposition:'剩余事项由轮机长登记处置，不计为已完成。'}:{}),...form})}
