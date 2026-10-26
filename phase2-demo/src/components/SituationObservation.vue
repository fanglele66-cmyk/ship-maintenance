<template>
  <div class="p2-situation-observation">
    <div class="p2-attention-detail-head"><button class="p2-link-button" type="button" @click="$emit('back')">← 返回处置记录</button><span class="p2-attention-status" :class="result.type==='archive'?'ended':result.type==='reinspect'?'human':'ai'">{{closed?'观察已结束':result.type==='archive'?'待确认闭环':result.type==='reinspect'?'需人工复查':'修复观察中'}}</span></div>
    <h3 class="p2-attention-detail-title">{{ title }}</h3>
    <p class="p2-report-meta">{{store.cases[scenario]?.initialTitle}} · <button class="p2-link-button" type="button" @click="openEvent">回看人工处理记录 →</button></p>
    <p v-if="closed" class="p2-pad-conclusion">本轮已人工确认闭环，观察与实际措施保留。</p>
    <section v-else class="observation-review-panel">
      <header><strong>修复观察反馈</strong><span>选择本次观察结果</span></header>
      <div class="observation-outcomes" role="group" aria-label="修复观察结果">
        <button v-for="option in observationReviewOptions" :key="option.key" type="button" :aria-pressed="choice===option.key" :class="{selected:choice===option.key}" @click="chooseOutcome(option.key)">{{option.label}}</button>
      </div>
      <InquiryMessage v-if="needsRecord" :key="scenario+choice+submission" :message="reviewForm" @update-inquiry="updateDraft" @submit-inquiry="submitReview"/>
      <p v-if="saved" class="observation-save-status" role="status">{{saved}}</p>
      <p v-if="error&&!needsRecord" class="p2-inquiry-error" role="alert">{{error}}</p>
      <div v-if="!needsRecord" class="p2-observation-actions">
        <button v-if="result.type==='reinspect'" class="p2-primary" type="button" @click="reinspect">确认返回复查 →</button>
        <button v-else-if="result.type==='archive'" class="p2-primary" type="button" @click="store.completeObservation(scenario)">确认闭环并归档</button>
        <button v-else-if="result.type==='extend'&&!result.extensionApplied" class="p2-secondary" type="button" @click="store.extendObservation(scenario)">按建议延长观察24小时</button>
      </div>
    </section>
    <section class="observation-display">
      <nav class="p2-observation-tabs" aria-label="效果观察内容"><button v-for="tab in ['修复观察','观察时间线']" :key="tab" type="button" :class="{active:activeTab===tab}" @click="activeTab=tab">{{tab}}</button></nav>
      <Phase2Observation v-if="activeTab==='修复观察'" :scenario="scenario"/>
      <section v-else class="p2-observation-timeline">
        <div class="p2-section-title">本轮观察记录 · 第 {{store.observationRounds[scenario]}} 轮</div>
        <p v-if="!store.observationRecords[scenario]?.length" class="p2-report-meta">尚未提交修复观察记录。</p>
        <div v-for="(record,index) in store.observationRecords[scenario]" :key="index" class="p2-observation-record"><b>{{record.label}}</b><p>{{recordText(record)}}</p><p>{{record.note}}</p></div>
        <template v-for="round in store.observationHistory[scenario]" :key="round.round"><div class="p2-section-title">第 {{round.round}} 轮 · 已返回现场复查</div><div v-for="(record,index) in round.records" :key="index" class="p2-observation-record"><b>{{record.label}}</b><p>{{recordText(record)}}；{{record.note}}</p></div></template>
      </section>
    </section>
  </div>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {observationConfig} from '@/mock/phase2Observation'
import {observationReviewOptions,observationReviewFields} from '@/mock/observationReview'
import Phase2Observation from '@/components/Phase2Observation.vue'
import InquiryMessage from '@/components/messages/InquiryMessage.vue'
const props=defineProps({scenario:String})
defineEmits(['back'])
const store=usePhase2DemoStore(),router=useRouter(),activeTab=ref('修复观察')
const result=computed(()=>store.getObservationResult(props.scenario)),closed=computed(()=>store.eventStatus[props.scenario]==='closed')
const title=computed(()=>store.cases[props.scenario]?.stages.find(stage=>stage.kind==='observe')?.title||'修复后观察')
const choice=ref(''),error=ref(''),saved=ref(''),drafts=ref({}),submission=ref(0)
const needsRecord=computed(()=>['continue','incomplete'].includes(choice.value))
const reviewForm=computed(()=>({id:'observation-review-'+props.scenario+'-'+choice.value,status:'pending',text:choice.value==='incomplete'?'填写缺项与延长观察安排':'填写本次观察记录',submitError:error.value,fields:observationReviewFields(observationConfig[props.scenario],choice.value),values:drafts.value[choice.value]||{},submitLabel:choice.value==='incomplete'?'保存记录并延长观察24小时':'保存本次观察记录'}))
// Each branch keeps its unsaved fields while switching; submitting clears only that branch.
function updateDraft(payload){drafts.value[choice.value]={...payload.values}}
function chooseOutcome(key){
  error.value='';saved.value=''
  if(['continue','incomplete'].includes(key)){choice.value=key;return}
  if(choice.value===key&&store.observationRecords[props.scenario]?.at(-1)?.reviewChoice===key)return
  choice.value=key
  if(!store.submitObservationReview(props.scenario,key))error.value=key==='stable'?'当前仍有未处理的异常反复，或执行与验收尚未完成，请先核对本轮处置状态。':'当前任务尚未进入修复观察，请先完成执行与验收。'
}
function submitReview(payload){
  if(!store.submitObservationReview(props.scenario,choice.value,payload.values)){error.value='请核对观察天数、读数与当前任务状态，观察天数不能早于已有记录。';return}
  saved.value=choice.value==='incomplete'?'本次缺项与补充安排已保存，观察窗口已延长24小时。':'本次观察记录已保存，继续跟踪后续变化。'
  delete drafts.value[choice.value];choice.value='';submission.value++;error.value=''
}
watch(()=>props.scenario,()=>{choice.value='';drafts.value={};error.value='';saved.value='';activeTab.value='修复观察'})
function recordText(record){return record.values?record.values.map((value,index)=>observationConfig[props.scenario].names[index]+' '+(value??'未取得')+' '+observationConfig[props.scenario].units[index]).join(' · '):record.reviewChoice==='stable'||record.reviewChoice==='abnormal'?'本次状态确认，沿用已保存的观察资料':'待补齐同工况记录'}
function openEvent(){store.selectTodo(props.scenario);router.push({path:'/event',query:{todo:props.scenario}})}
function reinspect(){store.reopenTodo(props.scenario);openEvent()}
</script>
<style scoped>
.observation-review-panel{border:1px solid #e4e7ed;border-radius:8px;padding:16px;margin:12px 0 20px;background:#fff}.observation-review-panel>header{display:flex;align-items:center;gap:16px;margin-bottom:14px;color:#31445c;font-size:14px}.observation-review-panel>header>span{font-size:12px;color:#8491a2}.observation-outcomes{display:flex;flex-wrap:wrap;gap:10px}.observation-outcomes button{border:1px solid #dce3eb;background:#fff;padding:10px 14px;border-radius:6px;color:#56677d;cursor:pointer;font-size:13px}.observation-outcomes button.selected{border-color:#b49660;background:#faf6ee;color:#8b6b37}.observation-review-panel :deep(.p2-inquiry){margin-top:16px}.observation-save-status{padding-top:12px;color:#258565;font-size:13px}.observation-display{margin-top:12px}.observation-display :deep(.p2-observation){min-height:320px}.observation-review-panel :deep(fieldset){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.observation-review-panel :deep(.p2-inquiry-field:last-of-type),.observation-review-panel :deep(fieldset>button),.observation-review-panel :deep(.p2-inquiry-error-summary){grid-column:1/-1}@media(max-width:800px){.observation-review-panel :deep(fieldset){grid-template-columns:1fr}.observation-outcomes button{flex:1 1 180px}}
</style>
