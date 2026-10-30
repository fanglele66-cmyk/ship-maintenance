<template>
 <form class="lc-form" @submit.prevent="submit" :aria-label="shoreOnly?'岸基同步表单':captain?'轮机长处置表单':'执行反馈表单'">
  <template v-if="captain">
   <LifecycleDecisionBasis v-if="showBasis&&!shoreOnly" :event="event" :action="decision.action"/>
   <p v-if="shoreOnly" class="lc-muted">将事件与闭环报告发送岸基，事件保持已闭环。</p>
   <label v-else>本次处置<select aria-label="本次处置" v-model="decision.action" required @change="changeAction"><option value="" disabled>请选择处置方式</option><option v-for="o in options" :key="o.value" :value="o.value">{{o.label}}</option></select></label>
   <template v-if="decision.action">
    <label>{{dispatch?'安排范围与依据':decision.action==='shore'?'同步内容与岸基支持需求':'决定依据与后续安排'}}<textarea v-model="reason" :disabled="dispatch&&plan?.status!=='ready'" required rows="3" :placeholder="dispatch?'明确检查/处理对象、已确认原因及本轮要求':'说明判断依据、设备安全影响与后续安排'"/></label>
    <label v-if="decision.action==='resume'">恢复后的完成时限<input type="datetime-local" v-model="decision.deadline" required/></label><template v-if="dispatch">
     <label>负责人<select v-model="decision.owner" required><option :value="people.engineer">{{people.engineer}}</option></select></label>
     <label>要求完成时间<input type="datetime-local" v-model="decision.deadline" required/></label>
     <template v-if="decision.action==='maintenance'"><label>维保计划<select aria-label="维保计划" v-model="decision.maintenancePlanId" required @change="changeMaintenancePlan"><option value="" disabled>选择要提前执行的维保计划</option><option v-for="item in plans" :key="item.id" :value="item.id">{{item.id}} · {{item.title}} · 工单 {{item.workOrder.number}}</option></select></label><p v-if="selectedMaintenance">正式工单：{{selectedMaintenance.workOrder.number}} · {{selectedMaintenance.workOrder.status}}<br/>{{selectedMaintenance.workOrder.content.join('；')}}<br/><small>计划与工单一并关联，正式完工状态单独确认。</small></p><label>靠港检修时间<select aria-label="靠港检修时间" v-model="decision.window" required @change="changeWindow"><option value="" disabled>选择适合的靠港停机窗口</option><option v-for="item in windows" :key="item.id" :value="item.id">{{item.label}}</option></select></label><p v-if="!windows.length" class="lc-error">当前没有可用的靠港检修窗口，请更新航次计划后安排。</p></template>
    </template>
    <div class="lc-plan-preview" v-if="dispatch"><strong>{{planTabLabel(decision.action)}}</strong><ol v-if="plan?.steps.length"><li v-for="step in plan.steps" :key="step.label">{{step.label}}</li></ol><small>{{plan?.status==='ready'?decision.action==='maintenance'?'将按所选维保计划提前执行，范围与步骤随任务保存。':'派发将采用任务 Tab 中的当前范围与步骤。':plan?.error||'AI 正在预生成任务，请完成后核对。'}}</small></div>
    <button class="lc-primary" type="submit" :disabled="dispatch&&plan?.status!=='ready'">{{submitLabel}}</button>
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
import {suggestionAction} from '../workflow/lifecycleDecisions'
import LifecycleDecisionBasis from './LifecycleDecisionBasis.vue'
const props=defineProps({event:{type:Object,required:true},showBasis:{type:Boolean,default:true},shoreOnly:{type:Boolean,default:false},taskId:{type:String,default:''}}),emit=defineEmits(['submitted','expanded'])
const store=useEventLifecycleStore(),error=ref(''),captain=computed(()=>store.state.role==='captain'),task=computed(()=>props.taskId?props.event.tasks.find(t=>t.id===props.taskId):currentTask(props.event)),options=computed(()=>decisionOptions(props.event))
const decision=computed(()=>props.event.decisionDraft||(props.event.decisionDraft={action:'',reason:'',owner:people.engineer,deadline:'',maintenancePlanId:'',window:''}))
const plan=computed(()=>captain.value&&suggestionAction(props.event)?ensureTaskPlan(props.event):null)
const dispatch=computed(()=>['investigate','repair','maintenance','recheck'].includes(decision.value.action))
const reason=computed({get:()=>dispatch.value?plan.value?.scope||'':decision.value.action==='shore'?decision.value.shoreReason||'':decision.value.reason,set:value=>{if(dispatch.value&&plan.value){plan.value.scope=value;plan.value.version++}else if(decision.value.action==='shore')decision.value.shoreReason=value;else decision.value.reason=value}})
watch(options,list=>{if(props.shoreOnly){decision.value.action=list.some(o=>o.value==='shore')?'shore':'';return}if(decision.value.action&&!list.some(o=>o.value===decision.value.action)){decision.value.action='';decision.value.reason=''}},{immediate:true})
const submitLabel=computed(()=>({investigate:'确认派发排查',repair:'确认派发维修',recheck:'确认派发复查',maintenance:'派发提前维保任务',shore:'提交岸基同步',observe:'确认进入观察',close:'确认闭环并归档',false:'确认误报并归档',wait:'保留任务并等待条件',resume:'确认恢复原任务',terminate:'确认终止未执行部分'}[decision.value.action]))
const plans=computed(()=>maintenancePlans(props.event)),windows=computed(()=>availableMaintenanceWindows())
const selectedMaintenance=computed(()=>plans.value.find(p=>p.id===decision.value.maintenancePlanId))
function changeMaintenancePlan(){ensureTaskPlan(props.event);error.value=''}
function changeWindow(){const item=windows.value.find(w=>w.id===decision.value.window);if(item)decision.value.deadline=item.end.slice(0,16);error.value=''}
function changeAction(){error.value='';emit('expanded')}
async function submit(){try{error.value='';const action=captain.value?decision.value.action:null;if(captain.value){store.decide(props.event.id,{...decision.value,reason:reason.value});if(action==='shore'){decision.value.action='';decision.value.shoreReason=''}else props.event.decisionDraft={action:'',reason:'',owner:people.engineer,deadline:'',maintenancePlanId:'',window:''}}else await store.submit(props.event.id,task.value?.id);emit('submitted',action)}catch(e){error.value=e.message}}

</script>
