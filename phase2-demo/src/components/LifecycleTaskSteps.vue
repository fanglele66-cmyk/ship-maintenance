<template>
 <section class="lc-task-wizard" :class="{'lc-repair-wizard':repair}" aria-label="横向分步填写">
  <details v-if="task.procedureHistory?.length" class="lc-procedure-history"><summary>作业步骤已细化，原填写记录已保留；请按新增步骤核对并填写结果。</summary><section v-for="(history,i) in task.procedureHistory" :key="i"><p v-for="record in history.draft.records.filter(r=>r.result||r.note)" :key="record.label"><strong>{{record.label}} · {{record.result||'未选结果'}}</strong><br/>{{record.note}}</p></section></details>
  <details v-if="task.feedbackHistory?.length" class="lc-procedure-history"><summary>历史填写与阶段报告已保留，可对照本次继续执行的范围。</summary><section v-for="(history,i) in task.feedbackHistory" :key="i"><p v-for="record in history.draft.records.filter(r=>r.result||r.note)" :key="record.label"><strong>{{record.label}} · {{record.result||'未选结果'}}</strong><br/>{{record.note}}</p></section></details>
  <nav class="lc-stepper" aria-label="执行步骤"><button v-for="(step,i) in task.steps" :key="i" :class="{active:index===i,complete:task.draft.records[i].result}" :aria-current="index===i?'step':undefined" @click="go(i)"><span>{{i+1}}</span>{{step.short||step.label}}</button><button :class="{active:index===task.steps.length}" @click="review"><span>{{['repair','maintenance'].includes(task.kind)?'✓':task.steps.length+1}}</span>汇总提交</button></nav>
  <form v-if="step" class="lc-step-editor" @submit.prevent="next">
   <div class="lc-step-instructions"><h3>{{step.label}}</h3><LifecycleStepInstructions :step="step" :compact="repair"/><p v-if="repair&&step.recordHint" class="lc-repair-record-hint"><strong>记录要求：</strong>{{compactRepairRecordHint(step)}}</p><aside v-else-if="step.recordHint"><strong>提交记录</strong><p>{{step.recordHint}}</p></aside></div>
   <fieldset><legend>{{task.kind==='investigation'?'检查结果':'作业反馈'}}</legend><label v-for="option in step.options" :key="option" :class="{selected:record.result===option}"><input type="radio" :name="task.id+'-'+index" v-model="record.result" :value="option" required/>{{option}}</label></fieldset>
   <label class="lc-step-note">备注（选填）<textarea v-model="record.note" :rows="repair?2:4" :placeholder="repair?'记录实际部位、用料与复核结果；未完成项目请说明原因。':step.recordHint||'记录具体部位、检查发现或实际措施；没有补充信息可直接进入下一步。'"/></label>
   <p v-if="error" role="alert" class="lc-error">{{error}}</p>
   <footer><button type="button" :disabled="index===0" @click="go(index-1)">上一步</button><small>{{index+1}} / {{task.steps.length}}</small><button type="submit" class="lc-primary">{{index===task.steps.length-1?'下一步：汇总提交':'下一步'}}</button></footer>
  </form>
  <form v-else class="lc-step-editor" @submit.prevent="submit">
   <h3>{{task.kind==='investigation'?'原因判断与排查结论':'实际措施、复测结果与剩余事项'}}</h3>
   <div class="lc-step-review"><div v-for="(r,i) in task.draft.records" :key="i"><strong>{{r.label}}</strong><span>{{r.result||'待填写'}}</span><button type="button" @click="go(i)">修改</button><p v-if="r.note">{{r.note}}</p></div></div>
   <label class="lc-step-note">{{task.kind==='investigation'?'排查结论':'作业结论'}}<textarea v-model="task.draft.summary" required rows="5" :placeholder="task.kind==='investigation'?'记录做过什么、发现什么及尚不能确认什么；原因未明如实填写，分析建议与事实分开。':'写明实际处理部位、措施、复测结果与剩余问题。'"/></label>
   <p v-if="task.draft.attachments.length" class="lc-muted">已关联：{{task.draft.attachments.map(a=>a.name).join('、')}}</p>
   <p v-if="error" role="alert" class="lc-error">{{error}}</p>
   <footer><button type="button" @click="go(task.steps.length-1)">上一步</button><small>提交后交轮机长决策</small><button type="submit" class="lc-primary">提交{{taskName(task)}}报告</button></footer>
  </form>
 </section>
</template>
<script setup>
import {computed,ref} from 'vue'
import LifecycleStepInstructions from './LifecycleStepInstructions.vue'
import {compactRepairRecordHint} from '../workflow/repairDisplay'
import {taskName} from '../workflow/lifecycleDecisions'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
const props=defineProps({event:{type:Object,required:true},task:{type:Object,required:true}}),emit=defineEmits(['submitted']),store=useEventLifecycleStore(),error=ref('')
const index=computed({get:()=>Math.min(props.task.draft.stepIndex||0,props.task.steps.length),set:value=>props.task.draft.stepIndex=value})
const step=computed(()=>props.task.steps[index.value]),record=computed(()=>props.task.draft.records[index.value])
const repair=computed(()=>['repair','maintenance'].includes(props.task.kind))
function go(i){error.value='';index.value=i}
function next(){if(!record.value.result){error.value='请选择本步骤的实际结果。';return}go(index.value+1)}
function review(){const missing=props.task.draft.records.findIndex(r=>!r.result);if(missing>=0){go(missing);error.value='请先选择本步骤的实际结果，备注可以不填。'}else go(props.task.steps.length)}
async function submit(){try{await store.submit(props.event.id,props.task.id);emit('submitted')}catch(e){error.value=e.message}}
</script>
<style scoped>
.lc-procedure-history{font-size:12px;background:#faf8f3;padding:12px;margin-bottom:14px;color:#8d744e}.lc-procedure-history summary{cursor:pointer}
.lc-repair-wizard{margin-top:12px!important}.lc-repair-wizard .lc-stepper{padding-bottom:10px}.lc-repair-wizard .lc-step-editor{min-height:0;display:grid;grid-template-columns:minmax(240px,.8fr) minmax(0,1.2fr);gap:10px 24px;padding-top:10px}.lc-repair-wizard .lc-step-instructions,.lc-repair-wizard footer,.lc-repair-wizard .lc-error,.lc-repair-wizard .lc-step-review{grid-column:1/-1}.lc-repair-wizard .lc-step-instructions h3{margin:0 0 4px}.lc-repair-wizard fieldset legend{margin-bottom:9px}.lc-repair-wizard .lc-step-note{gap:6px;font-size:13px}.lc-repair-wizard textarea{padding:7px 10px;line-height:1.6}.lc-repair-wizard footer{padding-top:10px;margin-top:0}.lc-repair-wizard .lc-repair-record-hint{margin:8px 0 0;font-size:12px;line-height:1.65;color:#7e8a99}.lc-repair-record-hint strong{font-weight:500}.lc-repair-wizard .lc-step-review~.lc-step-note{grid-column:1/-1}@media(max-width:1100px){.lc-repair-wizard .lc-step-editor{grid-template-columns:1fr}}
.lc-step-editor .lc-primary{background:#202326;border-color:#202326;color:#fff}.lc-step-editor .lc-primary:hover{background:#35393d;border-color:#35393d}
.lc-task-wizard{margin-top:18px}.lc-stepper{display:flex;gap:8px;border-bottom:1px solid #e7edf4;padding-bottom:18px;overflow-x:auto}.lc-stepper button{display:flex;flex:1 0 130px;align-items:center;gap:8px;font-size:12px;text-align:left;border:0;background:#f5f7fa;color:#7c8a9d;min-height:42px}.lc-stepper button span{flex:none;display:grid;place-items:center;width:20px;height:20px;line-height:1;border-radius:50%;background:#e2e7ef;color:#8995a6;font-size:11px}.lc-stepper button.complete span{background:#e1f4e8;color:#49a86e}.lc-stepper button.active{background:#faf5e9;color:#967039}.lc-stepper button.active span{background:#b99554;color:white}.lc-step-editor{display:flex;flex-direction:column;min-height:440px;padding-top:18px;gap:20px}.lc-step-instructions h3{margin:0 0 8px}.lc-step-instructions p{margin:0 0 10px}.lc-step-instructions ol{padding-left:24px;font-size:13px}.lc-step-instructions aside{border-left:3px solid #c6aa75;background:#faf8f3;padding:12px 15px}.lc-step-instructions aside p{margin:5px 0 0;font-size:13px}.lc-step-editor fieldset{border:0;margin:0;padding:0}.lc-step-editor legend{font-size:13px;margin-bottom:12px}.lc-step-editor fieldset label{display:inline-flex;align-items:center;gap:5px;margin:0 10px 8px 0;border:1px solid #e1e7ee;border-radius:4px;padding:7px 10px;cursor:pointer}.lc-step-editor fieldset label.selected{border-color:#c6a366;color:#9b7639;background:#faf6ed}.lc-step-editor input{accent-color:#b99554}.lc-step-note{display:flex;flex-direction:column;gap:9px}.lc-step-note textarea{width:100%;box-sizing:border-box;border:1px solid #dfe6ef;border-radius:5px;padding:11px;color:#465e76;font:inherit;line-height:1.7;resize:vertical;background:#fbfcff}.lc-step-editor footer{margin-top:auto;padding-top:16px;border-top:1px solid #e7edf4;display:flex;justify-content:space-between;align-items:center;gap:10px}.lc-step-editor footer small{color:#91a0b2}.lc-step-editor button:disabled{opacity:.45;cursor:default}.lc-step-review>div{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #e7edf4}.lc-step-review strong{font-size:13px}.lc-step-review p{grid-column:1/-1;margin:0;font-size:13px}.lc-step-review span{font-size:13px;color:#9d7a42}@media(max-width:700px){.lc-stepper button{flex-basis:150px}.lc-step-editor footer small{display:none}}
</style>
