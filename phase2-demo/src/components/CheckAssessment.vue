<template>
  <section v-if="assessment" class="check-assessment" aria-live="polite">
    <h3>{{ assessment.title }}</h3><MarkdownContent :content="assessment.message"/>
    <dl><div v-for="record in assessment.records" :key="record.label"><dt>{{record.label}}</dt><dd><strong>{{record.result}}</strong><p v-if="record.note">{{record.note}}</p></dd></div></dl>
    <div class="assessment-actions"><button v-for="action in assessment.actions" :key="action" type="button" :class="action==='retry'?'p2-secondary':'p2-link-button'" @click="choose(action)">{{labels[action]}}</button></div>
    <InquiryMessage v-if="chosen" :message="form" @submit-inquiry="submit"/>
  </section>
</template>
<script setup>
import {decisionPreset} from '@/mock/realScenarioPresets'
import {computed,ref,watch} from 'vue'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import InquiryMessage from './messages/InquiryMessage.vue'
import MarkdownContent from './MarkdownContent.vue'
const props=defineProps({scenario:String}),store=usePhase2DemoStore(),chosen=ref(''),error=ref('')
const assessment=computed(()=>store.checkAssessments[props.scenario])
const labels=computed(()=>{
 const [first,second]=(assessment.value?.records||[]).map(record=>record.result)
 return {'retry':'继续补充本轮核实','supplement':'记录新线索','end-warning':first==='现场与系统一致'&&second==='工况变化可以解释'?'确认工况解释，结束本次核实':'结束本次核实并保留限制','finish-tracking':'完成核实，提交轮机长确认','end-maintenance':first==='暂无提前处理必要'?'不提前处理，保留原计划':first==='有提前处理依据'?'结束评估，保留待安排':'结束评估并保留缺项'}
})
const form=computed(()=>({id:'assessment-decision-'+props.scenario,status:'pending',text:labels.value[chosen.value],hint:chosen.value==='end-warning'?'资料不足或读数不符不能直接声明预警误报。请记录已核对的依据、仍缺的信息及后续安排。':'填写实际依据或检查限制，原反馈与来源材料继续保留。',submitError:error.value,fields:[{key:'reason',label:'依据与后续说明',type:'textarea',required:true}],values:{reason:store.cases[props.scenario]?.realCaseId?decisionPreset(store.cases[props.scenario],chosen.value,assessment.value):chosen.value==='finish-tracking'?'已保存本轮核实结果及未确认范围，本次人工核实结束，原健康记录继续。':''},submitLabel:'确认并保存记录'}))
function choose(action){error.value='';if(action==='retry'){store.decideCheck(props.scenario,action);chosen.value=''}else chosen.value=action}
function submit(payload){if(store.decideCheck(props.scenario,chosen.value,payload.values.reason)){chosen.value=''}else error.value='当前状态已变化或依据未填写，请核对后提交。'}
watch(()=>props.scenario,()=>{chosen.value='';error.value=''})
</script>
<style scoped>
.check-assessment{flex:0 0 auto;max-height:none;overflow:auto;border:1px solid #ded4c3;background:#fcfaf6;border-radius:8px;padding:20px 24px;margin:16px 0;color:#445870;line-height:1.8;font-size:14px}.check-assessment h3{font-size:15px;color:#202020;margin:0 0 8px}.check-assessment>p{margin:0 0 14px}.check-assessment dl{margin:0}.check-assessment dl>div{display:grid;grid-template-columns:minmax(160px,1fr) minmax(0,2fr);gap:20px;padding:10px 0;border-top:1px solid #e8e1d7}.check-assessment dt{font-weight:500}.check-assessment dd{margin:0;min-width:0}.check-assessment dd p{margin:4px 0;color:#6b7889;white-space:pre-wrap;overflow-wrap:anywhere}.assessment-actions{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px}@media(max-width:900px){.check-assessment dl>div{grid-template-columns:1fr;gap:4px}}
</style>
