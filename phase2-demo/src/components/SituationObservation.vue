<template>
  <div class="p2-situation-observation">
    <div class="p2-attention-detail-head"><button class="p2-link-button" type="button" @click="$emit('back')">← 返回处置记录</button><span class="p2-attention-status" :class="result.type==='archive'?'ended':result.type==='reinspect'?'human':'ai'">{{closed?'观察已结束':!canReview?'等待本轮执行验收':result.type==='archive'?'待确认闭环':result.type==='reinspect'?'需人工复查':'修复观察中'}}</span></div>
    <h3 class="p2-attention-detail-title">{{ title }}</h3>
    <p v-if="closed" class="p2-pad-conclusion">本轮已人工确认闭环，观察与实际措施保留。</p>
    <p v-else-if="!canReview" class="p2-pad-conclusion">第 {{store.observationRounds[scenario]}} 轮排查与处置尚未完成，待本轮执行及验收提交后开始新的效果观察。此前各轮资料可在下方回看。</p>
    <section v-else class="observation-review-panel">
      <header><strong>AI 自动效果观察</strong></header>
      <p v-if="automatic" class="automatic-status">最近检查：{{formatTime(automatic.checkedAt)}} · 下次更新：{{formatTime(automatic.nextUpdateAt)}}</p>
      <div class="observation-outcomes" role="group" aria-label="人工处置">
        <button type="button" :aria-pressed="choice==='abnormal'" :class="{selected:choice==='abnormal'}" @click="chooseOutcome('abnormal')">异常复查</button>
        <button type="button" :aria-pressed="choice==='stable'" :class="{selected:choice==='stable'}" @click="chooseOutcome('stable')">确认闭环</button>
      </div>
      <div v-if="choice==='abnormal'" class="observation-confirmation">
        <label>异常现象或复查依据（可选）<textarea v-model="reviewNote" rows="2" placeholder="可补充报警时刻、现场现象或需要复查的原因；无需重复录入传感器读数。"/></label>
        <p>确认后沿同一事件进入下一轮原因排查，本轮执行、验收和自动观察记录继续保留。</p>
        <button class="p2-primary" type="button" @click="reinspect">确认返回复查 →</button>
      </div>
      <div v-else-if="choice==='stable'" class="observation-confirmation">
        <label>{{result.type==='archive'?'闭环依据（可选）':'提前闭环依据与后续安排'}}<textarea v-model="decision.reason" rows="2" placeholder="记录现场验收、报警核对情况及轮机长确认依据。"/></label>
        <button class="p2-primary" type="button" @click="closeObservation">确认闭环并归档</button>
      </div>
      <p v-if="error" class="p2-inquiry-error" role="alert">{{error}}</p>
    </section>
    <section class="observation-display">
      <nav class="p2-observation-tabs" aria-label="效果观察内容"><button v-for="tab in ['修复观察','观察时间线']" :key="tab" type="button" :class="{active:activeTab===tab}" @click="activeTab=tab">{{tab}}</button></nav>
      <section v-for="round in rounds" :key="scenario+':'+round.round" class="observation-round" :class="{historical:!round.current}" :aria-label="'第'+round.round+'轮效果观察'">
        <header class="observation-round-heading"><h4>第 {{round.round}} 轮 · {{round.current?'本轮修复后观察':round.status==='not-started'?'执行验收记录':'历史修复观察'}}</h4><span>{{round.current?(closed?'已确认闭环':'当前轮次'):round.status==='not-started'?'验收未通过，未进入效果观察':'已返回现场复查'}}</span></header>
        <dl v-if="round.execution" class="observation-execution-receipt">
          <div><dt>实际措施</dt><dd>{{round.execution.values.measures}}</dd></div>
          <div><dt>现场验收</dt><dd>{{round.execution.values.acceptance}}</dd></div>
          <div class="receipt-meta"><dt>执行记录</dt><dd>{{round.execution.values.executedAt?.replace('T',' ')}} · {{round.execution.executor||round.execution.values.executor}}</dd></div>
        </dl>
        <p v-if="round.status==='not-started'" class="observation-history-outcome">{{round.result.text}}</p>
        <Phase2Observation v-else-if="activeTab==='修复观察'" :scenario="scenario" :round="round" :read-only="!round.current"/>
        <section v-else class="p2-observation-timeline">
          <p v-if="!round.records.length" class="p2-report-meta">{{round.automatic?'自动采样已启动，首个完整两小时窗口尚未结束。':round.current?'等待本轮修复后的采样。':'本轮没有已保存的测量记录。'}}</p>
          <div v-for="(record,index) in round.records" :key="index" class="p2-observation-record"><div class="observation-record-heading"><b>{{record.label}}</b><time>{{observationRecordTime(record)}}</time></div><p>{{recordText(record,round.config)}}</p><p v-if="record.note">{{record.note}}</p><small v-if="record.actor||record.source">{{[record.actor,record.source].filter(Boolean).join(' · ')}}</small></div>
          <p v-if="!round.current" class="observation-history-outcome">本轮结果：{{round.result.title}}。已保留本轮实际措施、验收与观察记录，接续下一轮复查。</p>
        </section>
      </section>
    </section>
  </div>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {observationRoundViews,observationRecordTime} from '@/mock/observationRounds'
import Phase2Observation from '@/components/Phase2Observation.vue'
const props=defineProps({scenario:String})
defineEmits(['back'])
const store=usePhase2DemoStore(),router=useRouter(),activeTab=ref('修复观察')
const result=computed(()=>store.getObservationResult(props.scenario)),closed=computed(()=>store.eventStatus[props.scenario]==='closed')
const rounds=computed(()=>observationRoundViews(store,props.scenario))
const canReview=computed(()=>{const execution=rounds.value.at(-1)?.execution;return store.isTaskHandled(props.scenario)&&execution?.values.completion==='completed'&&execution?.values.verification==='resolved'})
const title=computed(()=>store.cases[props.scenario]?.stages.find(stage=>stage.kind==='observe')?.title||'修复后观察')
const decision=computed(()=>store.ensureObservationDecision(props.scenario)),error=ref('')
const choice=computed({get:()=>decision.value.choice,set:value=>decision.value.choice=value}),reviewNote=computed({get:()=>decision.value.note,set:value=>decision.value.note=value})
const automatic=computed(()=>rounds.value.at(-1)?.automatic)
function formatTime(value){return value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—'}
// Choosing a branch never writes a result. Only its own confirmation commits it.
function chooseOutcome(key){choice.value=key;error.value=''}
watch([()=>props.scenario,()=>store.observationRounds[props.scenario]],()=>{error.value='';activeTab.value='修复观察';store.syncAutomaticObservation(props.scenario)},{immediate:true})
function recordText(record,config){return record.values?record.values.map((value,index)=>config.names[index]+' '+(value??'未取得')+' '+config.units[index]).join(' · '):record.status==='closed-confirmed'?'轮机长确认记录':record.reviewChoice==='stable'||record.reviewChoice==='abnormal'?'本次状态确认，沿用已保存的观察资料':'待补齐同工况记录'}
function openEvent(){store.selectTodo(props.scenario);router.push({path:'/event',query:{todo:props.scenario}})}
function reinspect(){if(!store.submitObservationReview(props.scenario,'abnormal',{note:reviewNote.value})){error.value='当前状态已变化，请核对本轮执行和验收记录。';return}store.reopenTodo(props.scenario);openEvent()}
function closeObservation(){const result=store.completeObservation(props.scenario,{reason:decision.value.reason});if(!result.ok){error.value=result.error;return}choice.value=''}
</script>
<style scoped>
.automatic-status{font-size:12px;color:#748195;line-height:1.8;margin:8px 0 14px}.observation-confirmation{margin-top:16px;padding-top:14px;border-top:1px solid #e8edf3;font-size:13px;color:#52637a;line-height:1.8}.observation-confirmation label{display:block}.observation-confirmation textarea{display:block;box-sizing:border-box;width:100%;margin-top:6px;padding:10px;border:1px solid #dce3eb;border-radius:5px;font:inherit;color:inherit;resize:vertical}.observation-confirmation button:disabled{opacity:.45;cursor:not-allowed}
.observation-review-panel{border:1px solid #e4e7ed;border-radius:8px;padding:16px;margin:12px 0 20px;background:#fff}.observation-review-panel>header{display:flex;align-items:center;gap:16px;margin-bottom:14px;color:#31445c;font-size:14px}.observation-review-panel>header>span{font-size:12px;color:#8491a2}.observation-outcomes{display:flex;flex-wrap:wrap;gap:10px}.observation-outcomes button{border:1px solid #dce3eb;background:#fff;padding:10px 14px;border-radius:6px;color:#56677d;cursor:pointer;font-size:13px}.observation-outcomes button.selected{border-color:#b49660;background:#faf6ee;color:#8b6b37}.observation-review-panel :deep(.p2-inquiry){margin-top:16px}.observation-save-status{padding-top:12px;color:#258565;font-size:13px}.observation-display{margin-top:12px}.observation-display :deep(.p2-observation){min-height:320px}.observation-review-panel :deep(fieldset){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.observation-review-panel :deep(.p2-inquiry-field:last-of-type),.observation-review-panel :deep(fieldset>button),.observation-review-panel :deep(.p2-inquiry-error-summary){grid-column:1/-1}@media(max-width:800px){.observation-review-panel :deep(fieldset){grid-template-columns:1fr}.observation-outcomes button{flex:1 1 180px}}
.observation-round{margin:22px 0 28px}.observation-round-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.observation-round-heading h4{font-size:15px;color:#31445c;margin:0}.observation-round-heading>span{font-size:12px;color:#8b744b;white-space:nowrap}.observation-round.historical .observation-round-heading>span{color:#78889b}.observation-execution-receipt{margin:0 0 14px;font-size:13px;color:#52637a;line-height:1.8}.observation-execution-receipt>div{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;margin:6px 0}.observation-execution-receipt dt{color:#8491a2}.observation-execution-receipt dd{margin:0;white-space:pre-line;overflow-wrap:anywhere}.observation-execution-receipt .receipt-meta{font-size:12px}.observation-record-heading{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px 16px}.observation-record-heading time,.p2-observation-record small{font-size:12px;color:#8491a2}.observation-history-outcome{font-size:13px;color:#748195;line-height:1.8;margin:12px 0 0}@media(max-width:600px){.observation-round-heading{align-items:flex-start}.observation-round-heading h4{font-size:14px}.observation-execution-receipt>div{grid-template-columns:60px minmax(0,1fr)}}
</style>
