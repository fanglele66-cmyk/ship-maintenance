<template>
 <section class="lc-task-wizard" :class="{'lc-repair-wizard':repair}" aria-label="横向分步填写">
  <details v-if="task.procedureHistory?.length" class="lc-procedure-history"><summary>步骤调整前的记录</summary><section v-for="(history,i) in task.procedureHistory" :key="i"><p v-for="record in history.draft.records.filter(r=>r.result||r.note)" :key="record.label"><strong>{{record.label}} · {{record.result||'未选结果'}}</strong><br/>{{record.note}}</p></section></details>
  <details v-if="task.feedbackHistory?.length" class="lc-procedure-history"><summary>前次提交记录</summary><section v-for="(history,i) in task.feedbackHistory" :key="i"><p v-for="record in history.draft.records.filter(r=>r.result||r.note)" :key="record.label"><strong>{{record.label}} · {{record.result||'未选结果'}}</strong><br/>{{record.note}}</p></section></details>
  <nav class="lc-stepper" aria-label="执行步骤"><button v-for="(step,i) in task.steps" :key="i" :disabled="submitting" :class="{active:index===i,complete:task.draft.records[i].result}" :aria-current="index===i?'step':undefined" @click="go(i)"><span>{{i+1}}</span>{{step.short||step.label}}</button></nav>
  <form v-if="step" class="lc-step-editor" @submit.prevent="next">
   <div class="lc-step-instructions"><h3>{{step.label}}</h3><LifecycleStepInstructions :event="event" :task="task" :number="index+1" :step="step" :compact="repair" :paginate="repair"/><RecordGuidance v-if="!repair&&!step.substeps?.length" :text="step.recordHint"/></div>
   <div class="lc-task-feedback"><fieldset><legend>{{task.kind==='investigation'?'检查结果':'作业反馈'}}<small v-if="displayStep.substeps?.length">（本步骤共 {{displayStep.substeps.length}} 个子项）</small></legend><label v-for="option in step.options" :key="option" :class="{selected:record.result===option}"><input type="radio" :name="task.id+'-'+index" v-model="record.result" :value="option" required/>{{option}}</label></fieldset>
   <label v-if="/无法确认|受限/.test(record.result||'')" class="execution-confirmation">本步骤实际执行情况<select v-model="record.executionStatus" required><option value="">请选择</option><option>已完成</option><option>未完成</option></select><small>已完成检查但原因未明，与检查尚未实施分别记录。</small></label><LifecycleNoteEditor :key="task.id+'-'+index" v-model="record.note" :rows="repair?2:3" :context="step.label" :assist-mode="stepAssistance" @assist="emit('assist',index)" :placeholder="'记录本步骤的部位、读数、实际措施或未完成原因。'"/></div>
   <p v-if="lastStep&&task.draft.attachments.length" class="lc-muted">已关联：{{task.draft.attachments.map(a=>a.name).join('、')}}</p>
   <p v-if="error" role="alert" class="lc-error">{{error}}</p>
   <footer><button type="button" :disabled="index===0||submitting" @click="go(index-1)">上一步</button><small>{{index+1}} / {{task.steps.length}}</small><button type="submit" :disabled="submitting" class="lc-primary">{{submitting?'正在提交…':lastStep?'提交'+taskName(task)+'报告':'下一步'}}</button></footer>
  </form>
 </section>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import LifecycleStepInstructions from './LifecycleStepInstructions.vue'
import RecordGuidance from './RecordGuidance.vue'
import LifecycleNoteEditor from './LifecycleNoteEditor.vue'
import {canUseStepAssist} from '../workflow/stepAssistContract.js'
import {taskName} from '../workflow/lifecycleDecisions'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {repairStepForDisplay} from '../workflow/repairPreparation.js'
const props=defineProps({event:{type:Object,required:true},task:{type:Object,required:true}}),emit=defineEmits(['submitting','submitted','assist']),store=useEventLifecycleStore(),error=ref(''),submitting=ref(false)
const index=computed({get:()=>Math.max(0,Math.min(props.task.draft.stepIndex||0,props.task.steps.length-1)),set:value=>props.task.draft.stepIndex=value})
const step=computed(()=>props.task.steps[index.value]),record=computed(()=>props.task.draft.records[index.value])
const displayStep=computed(()=>repairStepForDisplay({event:props.event,task:props.task,step:step.value}))
const lastStep=computed(()=>index.value===props.task.steps.length-1)
watch(()=>[props.task.draft.records,props.task.draft.summary,props.task.draft.attachments],()=>{props.task.draft.updatedAt=new Date().toISOString()},{deep:true})
const stepAssistance=computed(()=>canUseStepAssist(props.event,props.task,store.state.role))
const repair=computed(()=>['repair','maintenance'].includes(props.task.kind))
function go(i){error.value='';index.value=i}
async function next(){
 if(submitting.value)return
 if(!record.value.result){error.value='请选择本步骤的实际结果。';return}
 if(!lastStep.value){go(index.value+1);return}
 const missing=props.task.draft.records.findIndex((r,i)=>!props.task.steps[i].options.includes(r.result)||(/无法确认|受限/.test(r.result)&&!['已完成','未完成'].includes(r.executionStatus)))
 if(missing>=0){go(missing);error.value='请补齐本步骤的实际结果和执行情况。';return}
 submitting.value=true;error.value='';emit('submitting')
 try{await store.submit(props.event.id,props.task.id);emit('submitted')}catch(e){error.value=e.message}finally{submitting.value=false}
}
</script>
<style scoped>
.lc-final-supplement{grid-column:1/-1;font-size:13px}.lc-final-supplement summary{cursor:pointer;color:#7c8a9d;margin-bottom:8px}
.lc-procedure-history{font-size:12px;background:#faf8f3;padding:12px;margin-bottom:14px;color:#8d744e}.lc-procedure-history summary{cursor:pointer}
.lc-repair-wizard{margin-top:12px!important}.lc-repair-wizard .lc-stepper{padding-bottom:10px}.lc-repair-wizard .lc-step-editor{min-height:0;display:grid;grid-template-columns:minmax(240px,.8fr) minmax(0,1.2fr);gap:10px 24px;padding-top:10px}.lc-repair-wizard .lc-step-instructions,.lc-repair-wizard footer,.lc-repair-wizard .lc-error,.lc-repair-wizard .lc-step-review{grid-column:1/-1}.lc-repair-wizard .lc-step-instructions h3{margin:0 0 4px}.lc-repair-wizard fieldset legend{margin-bottom:9px}.lc-repair-wizard .lc-step-note{gap:6px;font-size:13px}.lc-repair-wizard textarea{padding:7px 10px;line-height:1.6}.lc-repair-wizard footer{padding-top:10px;margin-top:0}.lc-repair-wizard .lc-repair-record-hint{margin:8px 0 0;font-size:12px;line-height:1.65;color:#7e8a99}.lc-repair-record-hint strong{font-weight:500}.lc-repair-wizard .lc-step-review~.lc-step-note{grid-column:1/-1}@media(max-width:1100px){.lc-repair-wizard .lc-step-editor{grid-template-columns:1fr}}
.lc-step-editor .lc-primary{background:#202326;border-color:#202326;color:#fff}.lc-step-editor .lc-primary:hover{background:#35393d;border-color:#35393d}
.lc-task-wizard{margin-top:18px}.lc-stepper{display:flex;gap:8px;border-bottom:1px solid #e7edf4;padding-bottom:18px;overflow-x:auto}.lc-stepper button{display:flex;flex:1 0 130px;align-items:center;gap:8px;font-size:12px;text-align:left;border:0;background:#f5f7fa;color:#7c8a9d;min-height:42px}.lc-stepper button span{flex:none;display:grid;place-items:center;width:20px;height:20px;line-height:1;border-radius:50%;background:#e2e7ef;color:#8995a6;font-size:11px}.lc-stepper button.complete span{background:#e1f4e8;color:#49a86e}.lc-stepper button.active{background:#faf5e9;color:#967039}.lc-stepper button.active span{background:#b99554;color:white}.lc-step-editor{display:flex;flex-direction:column;min-height:440px;padding-top:18px;gap:20px}.lc-step-instructions h3{margin:0 0 8px}.lc-step-instructions p{margin:0 0 10px}.lc-step-instructions ol{padding-left:24px;font-size:13px}.lc-step-instructions aside{border-left:3px solid #c6aa75;background:#faf8f3;padding:12px 15px}.lc-step-instructions aside p{margin:5px 0 0;font-size:13px}.lc-step-editor fieldset{border:0;margin:0;padding:0}.lc-step-editor legend{font-size:13px;margin-bottom:12px}.lc-step-editor fieldset label{display:inline-flex;align-items:center;gap:5px;margin:0 10px 8px 0;border:1px solid #e1e7ee;border-radius:4px;padding:7px 10px;cursor:pointer}.lc-step-editor fieldset label.selected{border-color:#c6a366;color:#9b7639;background:#faf6ed}.lc-step-editor input{accent-color:#b99554}.lc-step-note{display:flex;flex-direction:column;gap:9px}.lc-step-note textarea{width:100%;box-sizing:border-box;border:1px solid #dfe6ef;border-radius:5px;padding:11px;color:#465e76;font:inherit;line-height:1.7;resize:vertical;background:#fbfcff}.lc-step-editor footer{margin-top:auto;padding-top:16px;border-top:1px solid #e7edf4;display:flex;justify-content:space-between;align-items:center;gap:10px}.lc-step-editor footer small{color:#91a0b2}.lc-step-editor button:disabled{opacity:.45;cursor:default}.lc-step-review>div{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #e7edf4}.lc-step-review strong{font-size:13px}.lc-step-review p{grid-column:1/-1;margin:0;font-size:13px}.lc-step-review span{font-size:13px;color:#9d7a42}@media(max-width:700px){.lc-stepper button{flex-basis:150px}.lc-step-editor footer small{display:none}}
</style>

<style scoped>
.lc-task-feedback{display:flex;flex-direction:column;gap:8px;grid-column:1/-1}.lc-task-feedback fieldset{flex:none}.lc-task-feedback legend{margin-bottom:6px}.lc-task-feedback fieldset label{margin-bottom:2px}.lc-task-feedback :deep(.note-editor){gap:6px}.lc-repair-wizard .lc-task-feedback :deep(textarea){min-height:92px;height:92px;padding-bottom:38px}.lc-repair-wizard .lc-step-editor{gap:8px}.lc-repair-wizard .lc-step-instructions :deep(.record-guidance){margin:5px 0}.lc-repair-wizard .lc-step-instructions :deep(.instruction-list){margin:4px 0}.lc-repair-wizard .lc-step-instructions :deep(.instruction-list>li){padding:1px 0!important}
@media(min-width:1101px){.lc-repair-wizard .lc-task-feedback{display:flex;flex-direction:column;gap:14px;align-items:stretch}.lc-repair-wizard .lc-step-editor :deep(.note-input textarea){font-size:13px}}
</style>

<style scoped>
.lc-task-feedback fieldset small{font-size:11px;color:#8b949c;font-weight:400}
.lc-step-editor>footer{position:sticky;bottom:0;z-index:3;background:#fff;padding-bottom:8px;box-shadow:0 -5px 10px #ffffffed}
@media(min-width:1101px){.lc-task-feedback{display:flex!important;flex-direction:column;align-items:stretch!important;gap:8px!important}.lc-task-feedback>fieldset{padding-top:3px}.lc-task-feedback :deep(textarea){height:80px!important;min-height:80px!important}.lc-task-feedback .execution-confirmation{grid-column:1/-1}.lc-step-editor{gap:8px!important}.lc-final-supplement{margin:0}.lc-step-editor footer{padding-top:7px}}
</style>
