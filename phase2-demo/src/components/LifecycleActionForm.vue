<template>
 <form class="lc-form" @submit.prevent="submit" :aria-label="captain?'轮机长处置表单':'执行反馈表单'">
  <template v-if="captain">
   <LifecycleDecisionBasis v-if="showBasis" :event="event" :action="decision.action"/>
   <label>本次处置<select aria-label="本次处置" v-model="decision.action" required @change="changeAction"><option value="" disabled>请选择处置方式</option><option v-for="o in options" :key="o.value" :value="o.value">{{o.label}}</option></select></label>
   <template v-if="decision.action">
    <label>{{dispatch?'安排范围与依据':decision.action==='shore'?'同步内容与岸基支持需求':'决定依据与后续安排'}}<textarea v-model="reason" :disabled="dispatch&&plan?.status!=='ready'" required rows="3" :placeholder="dispatch?'明确检查/处理对象、已确认原因及本轮要求':'说明判断依据、设备安全影响与后续安排'"/></label>
    <template v-if="dispatch">
     <label>负责人<select v-model="decision.owner" required><option :value="people.engineer">{{people.engineer}}</option></select></label>
     <label>要求完成时间<input type="datetime-local" v-model="decision.deadline" required/></label>
     <template v-if="decision.action==='maintenance'"><label>关联船管工单<select aria-label="关联船管工单" v-model="decision.order" required><option value="" disabled>选择维保工单</option><option v-for="order in orders" :key="order.number" :value="order.number">{{order.number}} · {{order.title}}</option></select></label><label>计划窗口<select aria-label="计划窗口" v-model="decision.window" required><option value="" disabled>选择航次 / 靠港窗口</option><option v-for="window in windows" :key="window">{{window}}</option></select></label></template>
    </template>
    <div class="lc-plan-preview" v-if="dispatch"><strong>{{planTabLabel(decision.action)}}</strong><ol v-if="plan?.steps.length"><li v-for="step in plan.steps" :key="step.label">{{step.label}}</li></ol><small>{{plan?.status==='ready'?'派发将采用任务 Tab 中的当前范围与步骤。':plan?.error||'AI 正在预生成任务，请完成后核对。'}}</small></div>
    <button class="lc-primary" type="submit" :disabled="dispatch&&plan?.status!=='ready'">{{submitLabel}}</button>
   </template>
  </template>
  <template v-else-if="task?.status==='assigned'">
   <h3>{{task.kind==='investigation'?'排查反馈':task.kind==='maintenance'?'维保作业反馈':'维修作业反馈'}}</h3>
   <div v-for="(record,i) in task.draft.records" :key="i" class="lc-form-step"><strong>{{i+1}}. {{record.label}}</strong><label>实际结果<select v-model="record.result" required><option disabled value="">请选择</option><option v-for="option in task.steps[i].options" :key="option">{{option}}</option></select></label><label>备注（选填）<textarea v-model="record.note" rows="2" :placeholder="task.steps[i].recordHint||'记录具体部位、现象与实际处理情况'"/></label></div>
   <label>{{task.kind==='investigation'?'原因判断与排查结论':'实际措施、复测结果与剩余事项'}}<textarea v-model="task.draft.summary" required rows="4" :placeholder="task.kind==='investigation'?'明确已确认的异常原因、对应证据及尚未确认的部分':'写明处理了什么、如何处理、复测结果和未完成的项目'"/></label>
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
import {planTabLabel} from '../workflow/taskPlanning'
import LifecycleDecisionBasis from './LifecycleDecisionBasis.vue'
const props=defineProps({event:{type:Object,required:true},showBasis:{type:Boolean,default:true}}),emit=defineEmits(['submitted','expanded'])
const store=useEventLifecycleStore(),error=ref(''),captain=computed(()=>store.state.role==='captain'),task=computed(()=>currentTask(props.event)),options=computed(()=>decisionOptions(props.event))
const decision=computed(()=>props.event.decisionDraft||(props.event.decisionDraft={action:'',reason:'',owner:people.engineer,deadline:'',order:'',window:''}))
const plan=computed(()=>captain.value?ensureTaskPlan(props.event):null)
const dispatch=computed(()=>['investigate','repair','maintenance','recheck'].includes(decision.value.action))
const reason=computed({get:()=>dispatch.value?plan.value?.scope||'':decision.value.action==='shore'?decision.value.shoreReason||'':decision.value.reason,set:value=>{if(dispatch.value&&plan.value){plan.value.scope=value;plan.value.version++}else if(decision.value.action==='shore')decision.value.shoreReason=value;else decision.value.reason=value}})
watch(options,list=>{if(decision.value.action&&!list.some(o=>o.value===decision.value.action)){decision.value.action='';decision.value.reason=''}},{immediate:true})
const submitLabel=computed(()=>({investigate:'确认派发排查',repair:'确认派发维修',recheck:'确认派发复查',maintenance:'确认关联并安排维保',shore:'提交岸基同步',close:'确认闭环并归档',false:'确认误报并归档'}[decision.value.action]))
const orders=computed(()=>[{number:props.event.id.includes('c4')?'CBY-WO-2026-1028-04':'CBY-WO-2026-1028-01',title:props.event.id.includes('c4')?'四缸测温与燃烧平衡专项检查':'一缸测温与燃烧平衡专项检查'}])
const windows=['V261028 · 上海—宁波航次，航行期间资料复核','V261029 · 宁波靠港，10月29日 08:00—14:00 停机窗口','V261031 · 上海靠港，10月31日 09:00—16:00 检修窗口']
function changeAction(){error.value='';emit('expanded')}
function submit(){try{error.value='';const action=captain.value?decision.value.action:null;if(captain.value){store.decide(props.event.id,{...decision.value,reason:reason.value});if(action==='shore'){decision.value.action='';decision.value.shoreReason=''}else props.event.decisionDraft={action:'',reason:'',owner:people.engineer,deadline:'',order:'',window:''}}else store.submit(props.event.id);emit('submitted',action)}catch(e){error.value=e.message}}

</script>
