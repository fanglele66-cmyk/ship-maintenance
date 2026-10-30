<template>
 <div v-if="dismissed" class="lc-observation-advice-hidden"><button type="button" @click="setDismissed(false)">显示 AI 观察建议</button></div>
 <section v-else class="lc-observation-advice" aria-label="AI 观察建议">
  <header><div><h2><span aria-hidden="true">✦</span> AI 观察建议</h2><span class="lc-observation-badge" :class="advice.status">{{advice.label}}</span></div><button class="lc-observation-dismiss" type="button" aria-label="关闭 AI 观察建议" title="关闭建议，不影响事件处置" @click="setDismissed(true)">×</button></header>
  <p v-if="modelText&&!advice.conditionsMet" class="lc-condition-warning" role="status">{{advice.conditionMessage}}</p><div v-if="!modelText" class="lc-observation-advice-grid"><div><h3>当前观察</h3><p>{{advice.summary}}</p></div><div><h3>{{advice.verification?'后续建议':'闭环时机'}}</h3><p>{{advice.timing}}</p></div></div>
  <div v-else class="lc-observation-model"><p>{{modelText}}</p></div>
  <footer><span>{{loading?(advice.verification?'AI 正在结合核实报告与观察数据分析…':'AI 正在结合维修反馈分析…'):modelText?(advice.verification?'建议仅供参考，轮机长可选择维修、复查或闭环。':'建议仅供参考，轮机长可直接选择闭环或复查。'):'已根据观察记录生成即时建议，轮机长可直接处置。'}}</span><button v-if="!loading" type="button" @click="generate(true)">{{error?'重试 AI 分析':'更新 AI 分析'}}</button></footer>
 </section>
</template>
<script setup>
import {computed,ref,watch,onBeforeUnmount,onDeactivated,onActivated} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {observationAdvice,observationAdviceRequest} from '../workflow/observationAdvice'
import {aiStreamRequest} from '../services/aiClient'
const props=defineProps({event:{type:Object,required:true},task:{type:Object,required:true},phaseId:{type:String,required:true}})
const store=useEventLifecycleStore(),advice=computed(()=>observationAdvice(props.event,props.task)),saved=computed(()=>props.event.observationAdvice?.[props.phaseId])
const dismissed=computed(()=>Boolean(saved.value?.dismissed)),loading=ref(false),draft=ref(''),error=ref('')
const modelText=computed(()=>loading.value?draft.value:saved.value?.key===advice.value.key?saved.value.answer||'':'')
let controller,request=0,attempted=''
function cancel(){request++;controller?.abort();loading.value=false;draft.value=''}
function setDismissed(value){store.updateObservationAdvice(props.event.id,props.phaseId,{dismissed:value})}
async function generate(force=false){
 const key=advice.value.key
 if(dismissed.value||!force&&(saved.value?.key===key&&saved.value.answer||attempted===key))return
 cancel();const version=request,eventId=props.event.id,phaseId=props.phaseId
 attempted=key;controller=new AbortController();loading.value=true;error.value=''
 try{
  const result=await aiStreamRequest(observationAdviceRequest(props.event,props.task,advice.value),(kind,data)=>{if(version===request&&kind==='text')draft.value+=data.delta||''},{signal:controller.signal})
  if(version!==request||advice.value.key!==key)return
  store.updateObservationAdvice(eventId,phaseId,{key,answer:result.answer,usage:result.usage,generatedAt:new Date().toISOString()})
 }catch(e){if(version===request)error.value=e.message}
 finally{if(version===request){loading.value=false;draft.value=''}}
}
watch([()=>props.phaseId,()=>advice.value.key,dismissed],()=>{cancel();attempted='';if(!dismissed.value)void generate()},{immediate:true})
onDeactivated(()=>{cancel();attempted=''})
onActivated(()=>{if(!loading.value&&!dismissed.value)void generate()})
onBeforeUnmount(cancel)
</script>
<style scoped>
.lc-observation-advice{margin:14px 0;padding:14px 16px;border:1px solid #e6dcc9;border-radius:7px;background:#fcfaf6;color:#435970}.lc-observation-advice header,.lc-observation-advice header>div,.lc-observation-advice footer{display:flex;align-items:center;gap:12px}.lc-observation-advice header{justify-content:space-between}.lc-observation-advice h2{font-size:15px!important;margin:0!important;color:#775c32}.lc-observation-advice h2 span{color:#b79450;margin-right:5px}.lc-observation-badge{font-size:11px;border-radius:3px;padding:3px 7px;background:#f0eadf;color:#82683b}.lc-observation-badge.review{background:#eaf3ee;color:#45806a}.lc-observation-badge.recheck,.lc-observation-badge.incomplete{background:#fff0df;color:#a46822}.lc-observation-advice button,.lc-observation-advice-hidden button{cursor:pointer;font:inherit;border:0;background:none;color:#96743e;font-size:12px}.lc-observation-dismiss{font-size:22px!important;line-height:1;padding:2px 6px;color:#8a96a5!important}.lc-observation-advice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px;margin-top:10px}.lc-observation-advice h3{font-size:12px!important;margin:0 0 5px!important;color:#6b7e92}.lc-observation-advice p{font-size:13px;line-height:1.7!important;margin:0!important;white-space:pre-wrap;overflow-wrap:anywhere}.lc-observation-model{margin-top:10px}.lc-observation-advice footer{justify-content:space-between;gap:10px;margin-top:10px;font-size:11px;color:#8a97a6}.lc-observation-advice footer button{flex-shrink:0}.lc-observation-advice-hidden{margin:10px 0;text-align:right}@media(max-width:700px){.lc-observation-advice-grid{grid-template-columns:1fr;gap:10px}.lc-observation-advice header>div{flex-wrap:wrap;gap:6px}.lc-observation-advice{padding:12px}}
</style>
