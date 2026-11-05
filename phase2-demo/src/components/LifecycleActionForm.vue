<template>
 <form class="lc-form" @submit.prevent="submit" :aria-label="shoreOnly?'上报岸基表单':captain?'轮机长处置表单':'执行反馈表单'">
  <template v-if="captain">
   <LifecycleDecisionBasis v-if="showBasis&&!shoreOnly" :event="event" :action="decision.action"/>
   <p v-if="shoreOnly" class="lc-muted">填写当前问题及需要岸基支持的具体事项。</p>
   <div v-if="!shoreOnly" class="decision-choice-bar"><fieldset class="decision-options"><legend>选择本次决策</legend><label v-for="o in options" :key="o.value" :class="{selected:decision.action===o.value}"><input type="radio" name="decision-action" v-model="decision.action" :value="o.value" @change="changeAction"/>{{o.label}}</label></fieldset><button v-if="dispatch" type="button" class="decision-plan-link" @click="$emit('plan',decision.action)">查看{{planTabLabel(decision.action)}} ↗</button></div>
   <template v-if="decision.action"><p v-if="!shoreOnly" class="decision-draft-note">已按本事件提供初稿，可修改后确认；尚未执行本次安排。</p><section v-if="decision.action==='shore'&&decision.shoreDraftReport" class="shore-editor">
     <p>{{decision.shoreDraftReport.sourceShoreId?'修改后重新上报，原上报版本保留。':'已汇集事件已有资料，可直接修改下方正文后上报。'}}已收录 {{decision.shoreDraftReport.includedReports?.length||0}} 份正式报告。</p>
     <nav class="shore-editor-tabs" aria-label="上报报告编辑方式"><button type="button" :aria-pressed="!shorePreview" @click="shorePreview=false">编辑正文</button><button type="button" :aria-pressed="shorePreview" @click="shorePreview=true">预览报告</button></nav>
     <div v-if="shorePreview" class="shore-body-preview"><MarkdownContent :content="decision.shoreMarkdown"/></div>
     <label v-else class="shore-body-label">上报报告正文<textarea class="shore-body-input" v-model="decision.shoreMarkdown" required rows="16" placeholder="填写本次上报的完整内容"/></label>
    </section>
    <label v-if="!dispatch&&!['shore','observe'].includes(decision.action)">决定依据与后续安排<textarea v-model="reason" required rows="3" :placeholder="reasonHint"/></label>
    <label v-if="decision.action==='resume'">恢复后的完成时限（不调整可留空）<input type="datetime-local" v-model="decision.deadline"/></label><template v-if="dispatch">
     <label>负责人<select v-model="decision.owner" required><option v-for="person in executors" :key="person.role" :value="person.name">{{person.name}}</option></select></label>
     <label>要求完成时间<input type="datetime-local" v-model="decision.deadline" required/></label>
     <template v-if="decision.action==='maintenance'"><label>维保计划<select aria-label="维保计划" v-model="decision.maintenancePlanId" required @change="changeMaintenancePlan"><option value="" disabled>选择要提前执行的维保计划</option><option v-for="item in plans" :key="item.id" :value="item.id">{{item.id}} · {{item.title}} · 工单 {{item.workOrder.number}}</option></select></label><p v-if="selectedMaintenance">正式工单：{{selectedMaintenance.workOrder.number}} · {{selectedMaintenance.workOrder.status}}<br/>{{selectedMaintenance.workOrder.content.join('；')}}<br/><small>计划与工单一并关联，正式完工状态单独确认。</small></p><label>靠港检修时间<select aria-label="靠港检修时间" v-model="decision.window" required @change="changeWindow"><option value="" disabled>选择适合的靠港停机窗口</option><option v-for="item in windows" :key="item.id" :value="item.id">{{item.label}}</option></select></label><p v-if="!windows.length" class="lc-error">当前没有可用的靠港检修窗口，请更新航次计划后安排。</p></template>
    </template>
    <div class="lc-plan-preview" v-if="dispatch"><strong>{{planTabLabel(decision.action)}}</strong><ol v-if="plan?.steps.length"><li v-for="step in plan.steps" :key="step.label">{{step.label}}</li></ol><small>{{plan?.status==='ready'?decision.action==='maintenance'?'核对所选计划的作业项目。':'核对本轮作业项目与回交要求。':plan?.error||'正在整理本轮作业项目…'}}</small></div>
    <LifecycleConfirmationFields :event="event" :draft="decision" :action="decision.action"/><button class="lc-primary" type="submit" :disabled="dispatch&&plan?.status!=='ready'">{{submitLabel}}</button>
   </template>
  </template>
  <template v-else-if="task?.status==='assigned'">
   <h3>{{task.kind==='investigation'?'排查反馈':task.kind==='maintenance'?'维保作业反馈':'维修作业反馈'}}</h3>
   <div v-for="(record,i) in task.draft.records" :key="i" class="lc-form-step"><strong>{{i+1}}. {{record.label}}</strong><label>实际结果<select v-model="record.result" required><option disabled value="">请选择</option><option v-for="option in task.steps[i].options" :key="option">{{option}}</option></select></label><label>备注（选填）<textarea v-model="record.note" rows="2" :placeholder="task.steps[i].recordHint||'记录具体部位、现象与实际处理情况'"/></label></div>
   <label>{{task.kind==='investigation'?'原因判断与排查结论':'实际措施、复测结果与剩余事项'}}<textarea v-model="task.draft.summary" required rows="4" :placeholder="task.kind==='investigation'?'说明实际做过什么、发现什么及尚不能确认什么；原因不明确可如实记录':'写明处理了什么、如何处理、复测结果和未完成的项目'"/></label>
   <p v-if="task.draft.attachments.length" class="lc-attachments">已关联：{{task.draft.attachments.map(a=>a.name).join('、')}}</p>
   <button class="lc-primary" type="submit">提交{{task.kind==='investigation'?'排查':task.kind==='maintenance'?'维保':'维修'}}报告</button>
  </template>
  <p v-if="error" role="alert" class="lc-error">{{error}}</p>
 </form>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {currentTask,decisionOptions,ensureTaskPlan,people} from '../workflow/eventLifecycle'
import {maintenancePlans,availableMaintenanceWindows} from '../workflow/maintenancePlans'
import {planTabLabel} from '../workflow/taskPlanning'
import {seedDecisionForm} from '../workflow/decisionFormDefaults.js'
import {suggestionAction} from '../workflow/lifecycleDecisions'
import {createShoreReportDraft} from '../workflow/shoreReports.js'
import MarkdownContent from './MarkdownContent.vue'
import LifecycleConfirmationFields from './LifecycleConfirmationFields.vue'
import {executors} from '../workflow/lifecyclePermissions.js'
import LifecycleDecisionBasis from './LifecycleDecisionBasis.vue'
const props=defineProps({event:{type:Object,required:true},showBasis:{type:Boolean,default:true},shoreOnly:{type:Boolean,default:false},taskId:{type:String,default:''}}),emit=defineEmits(['submitted','expanded','plan'])
const store=useEventLifecycleStore(),error=ref(''),captain=computed(()=>store.state.role==='captain'),task=computed(()=>props.taskId?props.event.tasks.find(t=>t.id===props.taskId):currentTask(props.event)),options=computed(()=>decisionOptions(props.event).filter(o=>props.shoreOnly||props.event.decisionDraft?.action==='shore'?o.value==='shore':o.value!=='shore'))
const decision=computed(()=>props.event.decisionDraft||(props.event.decisionDraft={action:'',reason:'',owner:people.engineer,dispatcher:people.captain,deadline:'',maintenancePlanId:'',window:''}))
const reasonHint=computed(()=>({resume:'写明已具备的备件、停机或许可条件；需要延期时填写新的完成时限。',wait:'写明受阻项目、缺少的条件及预计具备时间。',terminate:'写明终止哪些项目、原因及剩余风险的承担人。',close:'写明原异常的解释或验证依据，以及仍需保留的限制。',false:'写明排除原提醒的测点、时段与核实依据。'}[decision.value.action]||'写明本次决定对应的现场依据。'))
const shorePreview=ref(false)
const plan=computed(()=>captain.value&&suggestionAction(props.event)?ensureTaskPlan(props.event):null)
const dispatch=computed(()=>['investigate','repair','maintenance','recheck'].includes(decision.value.action))
const reason=computed({get:()=>dispatch.value||decision.value.action==='observe'?'':decision.value.action==='shore'?decision.value.shoreSituation?.situation||'':decision.value.reason||'',set:value=>{if(decision.value.closureDraft?.conclusion===decision.value.reason)decision.value.closureDraft.conclusion=value;decision.value.reason=value}})
watch(options,list=>{if(props.shoreOnly){decision.value.action=list.some(o=>o.value==='shore')?'shore':'';return}if(decision.value.action&&!list.some(o=>o.value===decision.value.action)){decision.value.action='';decision.value.reason=''}},{immediate:true})
watch(()=>decision.value.action,action=>{seedDecisionForm(props.event,decision.value,action);if(action==='shore'){decision.value.shoreIncludeHistory=true;if(!decision.value.shoreDraftReport){decision.value.shoreDraftReport=createShoreReportDraft(props.event,store.state);decision.value.shoreMarkdown=decision.value.shoreDraftReport.markdown}}},{immediate:true,flush:'sync'})
const submitLabel=computed(()=>({investigate:'确认派发排查',repair:'确认派发维修',recheck:'确认派发复查',maintenance:'派发提前维保任务',shore:decision.value.shoreDraftReport?.sourceShoreId?'保存并重新上报':'确认上报岸基',observe:'确认转入效果观察',close:'确认闭环并归档',false:'确认误报并归档',wait:'保留任务并等待条件',resume:'确认恢复原任务',terminate:'确认终止未执行部分'}[decision.value.action]))
const plans=computed(()=>maintenancePlans(props.event)),windows=computed(()=>availableMaintenanceWindows())
const selectedMaintenance=computed(()=>plans.value.find(p=>p.id===decision.value.maintenancePlanId))
function changeMaintenancePlan(){ensureTaskPlan(props.event);error.value=''}
function changeWindow(){const item=windows.value.find(w=>w.id===decision.value.window);if(item)decision.value.deadline=item.end.slice(0,16);error.value=''}
function changeAction(){error.value='';emit('expanded')}
async function submit(){try{error.value='';const action=captain.value?decision.value.action:null;if(captain.value){store.decide(props.event.id,{...decision.value,reason:reason.value});if(action==='shore'){decision.value.action='';decision.value.shoreReason='';delete decision.value.shoreDraftReport;delete decision.value.shoreMarkdown}else props.event.decisionDraft={action:'',reason:'',owner:people.engineer,dispatcher:people.captain,deadline:'',maintenancePlanId:'',window:''}}else await store.submit(props.event.id,task.value?.id);emit('submitted',action)}catch(e){error.value=e.message}}

</script>
<style scoped>
.decision-draft-note{grid-column:1/-1;font-size:12px;color:#879085;margin:0}.shore-editor-tabs{display:flex;gap:8px;grid-column:1/-1}.shore-editor-tabs button{border:1px solid #ded6c5;border-radius:5px;padding:7px 12px;background:white;color:#776545;font:inherit;cursor:pointer}.shore-editor-tabs button[aria-pressed=true]{background:#f6f0e4;border-color:#b79b65}.shore-body-label,.shore-body-preview{grid-column:1/-1}.shore-body-preview{max-height:42vh;overflow:auto;border:1px solid #e2e5df;border-radius:6px;padding:14px}.shore-body-input{width:100%;line-height:1.8;resize:vertical}
</style>
