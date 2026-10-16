<template>
  <div class="maintenance-advice-detail is-standalone">
    <header class="maintenance-advice-heading"><BackButton :label="backLabel" @click="$emit('back')"/><div class="maintenance-heading-title"><span class="maintenance-limit">{{ planned?'已有安排核对':'轮机长审阅 · '+review.status }}</span><h2>{{ planned?'已有维保安排':review.title }}</h2><p>{{ review.device }}</p></div><div class="maintenance-header-operations"><span class="p2-attention-status human">{{ planned?'只读安排':review.status }}</span><div v-if="!planned" class="maintenance-actions maintenance-header-actions" role="group" aria-label="维保建议操作"><button v-if="!handled&&advice.sufficient&&advice.decision!=='execute'" class="p2-primary" @click="decide('execute')">采纳并安排执行</button><button v-if="!handled&&advice.sufficient&&advice.decision!=='defer'" class="p2-secondary" @click="editor='defer';validation=''">暂不采纳</button><button v-if="core.todoCreated[advice.sourceEventId]&&!handled" class="p2-secondary" @click="editor='supplement';validation=''">补充信息</button><button v-if="review.observationReady" class="p2-secondary" @click="$emit('open-observation')">查看效果观察</button><button v-if="core.todoCreated[advice.sourceEventId]" class="p2-secondary" @click="$emit('open-event')">进入关联事件</button></div></div></header>
    <div v-if="!planned && (editor || notice)" class="maintenance-header-feedback"><form v-if="editor" class="maintenance-editor" @submit.prevent="save"><label :for="'maintenance-'+editor">{{editor==='defer'?'暂不采纳原因（必填）':'补充设备、工况或安排信息'}}</label><textarea :id="'maintenance-'+editor" v-model="note" rows="3"/><p v-if="validation" role="alert">{{validation}}</p><div class="maintenance-actions"><button class="p2-primary">保存记录</button><button class="p2-secondary" type="button" @click="editor=null;note=''">取消</button></div></form><p v-if="notice" role="status">{{notice}}</p></div>
    <nav v-if="!planned" class="maintenance-tabs" role="tablist" aria-label="维保建议详情内容"><button v-for="tab in tabs" :key="tab" role="tab" :aria-selected="activeTab===tab" :class="{active:activeTab===tab}" @click="activeTab=tab">{{tab}}</button></nav>
    <main class="maintenance-tab-body" :role="planned?undefined:'tabpanel'" :aria-label="planned?'已有维保安排':activeTab">
      <template v-if="planned"><section><h3>已有维保安排</h3><Arrangement :plan="review.plan"/></section><button class="p2-secondary" @click="$emit('show-advice')">查看本部件维保建议</button></template>
      <template v-else>
        <template v-if="activeTab==='建议概览'">
          <section class="maintenance-lead"><h3>当前建议</h3><p class="maintenance-summary">{{review.recommendation}}</p><h4>判断与边界</h4><p>{{review.conclusion}}</p><p class="maintenance-limit">{{review.limitation}}</p></section>
          <section><h3>关键依据</h3><div class="review-snapshots"><article v-for="snap in review.snapshots" :key="snap.name"><span>{{snap.name}}</span><strong>{{snap.value}}</strong><p>{{snap.reference}}</p><p>{{snap.meaning}}</p><small>来源：{{snap.source}}</small></article></div></section>
          <div class="maintenance-evidence-layout overview-review">
            <section><h3>为什么考虑提前</h3><p>持续的排温偏差与已确认的部件取证共同支持清洁与复校评估。排温本身不能定位故障，具体措施、实施时间与作业条件由轮机长审阅。</p><details><summary>建议形成的判断过程</summary><div v-for="step in review.steps" :key="step.title"><h4>{{step.title}}</h4><p><b>事实：</b>{{step.fact}}</p><p><b>判断：</b>{{step.inference}}</p></div></details></section>
            <section><h3>已有安排摘要</h3><dl class="review-facts"><div><dt>原周期</dt><dd>{{(review.plan.dueHours ?? '未取得')}}；不推算提前小时数</dd></div><div><dt>行动事件</dt><dd>{{review.linked?'已有原问题事件':'尚未安排'}}</dd></div><div><dt>关联工单</dt><dd>{{review.order?review.order.id+' · '+review.order.title:'尚未确认关联'}}</dd></div><div><dt>作业条件</dt><dd>停机、隔离与实际窗口需现场确认</dd></div></dl></section>
          </div>
          <section><h3>当前决定与安排</h3><p class="maintenance-required">{{requiredAction}}</p><div v-if="review.assignment&&review.linked" class="review-assignment"><b>{{review.assignment.owner}} · {{review.assignment.type}}</b><p>{{review.assignment.scope}}</p><small>计划：{{review.assignment.due}}</small></div>


          </section>
        </template>
        <template v-else-if="activeTab==='依据与评估'">
          <section><div class="maintenance-section-heading"><h3>建议来源过程</h3><small>原观测及取证记录</small></div><p class="maintenance-limit">从变化记录、后续比较到提出建议。部件判断引用原事件中已确认的检查报告。</p><div class="review-origin" v-for="node in review.origins" :key="node.id"><div><b>{{node.label}}</b><small>{{node.at}} · {{node.actor}}</small></div><p>{{node.text}}</p><p class="maintenance-limit">判断与限制：{{node.assessment}}</p></div></section>
          <div class="maintenance-evidence-layout"><section class="maintenance-evidence-main"><h3>事实、推断与缺项</h3><div class="maintenance-table-wrap"><table class="maintenance-evidence-table"><thead><tr><th>评估问题</th><th>现有支持</th><th>尚缺核对</th></tr></thead><tbody><tr v-for="row in review.comparisons" :key="row.direction"><th>{{row.direction}}</th><td>{{row.support}}</td><td>{{row.missing}}</td></tr></tbody></table></div><h4>已有观测节点</h4><div v-for="series in review.series" :key="series.name" class="review-series"><b>{{series.name}}（{{series.unit}}）</b><div class="review-node-values"><span v-for="(value,index) in series.values" :key="index"><small>{{series.labels[index]}}</small><strong>{{value}}</strong></span></div><p class="maintenance-limit">{{series.scope}}；仅为首末记录，不补连续曲线。</p></div><h4>现场检查反馈</h4><p v-if="!review.checks.length">尚未取得原事件的完整检查反馈。阶段推进不替代已确认的现场证据。</p><details v-for="(check,index) in review.checks" :key="index"><summary>{{check.title}} · {{check.submittedAt||check.at}}</summary><p v-for="record in check.records" :key="record.label">{{record.label}}：{{record.result}} {{record.note}}</p></details><p class="maintenance-limit">{{review.limitation}}</p></section><section class="maintenance-arrangement-side"><div class="maintenance-section-heading"><h3>已有安排与实施条件</h3><button class="p2-link-button" @click="$emit('show-arrangements')">查看只读安排</button></div><Arrangement :plan="review.plan"/></section></div>
        </template>
        <template v-else>
          <section><h3>轮机长决定与补充</h3><p v-if="!review.decisions.length" class="maintenance-limit">尚未记录决定。普通询问不自动安排行动。</p><div v-for="record in review.decisions" :key="record.id" class="maintenance-decision"><b>{{record.label}}</b><time>{{record.at}}</time><p>{{record.text}}</p><small>{{record.source}}</small></div></section>
          <section><h3>当前安排与关联</h3><p v-if="!review.linked">尚未建立行动事件，不得推测已有周期安排。</p><template v-else><p>{{review.assignment?review.assignment.owner+' · '+review.assignment.scope:'已有原问题事件，具体安排请到事件核对。'}}</p><p>{{review.order?'已关联 '+review.order.id+' · '+review.order.title:'尚未确认选择正式工单。'}}</p><button class="p2-secondary" @click="$emit('open-event')">查看原事件进展</button></template><p class="maintenance-limit">工单选择在原事件中确认，不修改原工单内容。</p></section>
          <section><h3>实际执行与验收</h3><template v-if="review.execution"><dl class="review-facts"><div><dt>实际措施</dt><dd>{{review.execution.values.measures}}</dd></div><div><dt>执行时间</dt><dd>{{review.execution.values.executedAt}}</dd></div><div><dt>验收反馈</dt><dd>{{review.execution.values.acceptance}}</dd></div><div><dt>记录来源</dt><dd>{{review.execution.source}} · {{review.execution.confirmedAt}}</dd></div></dl></template><p v-else>尚未取得人员确认的实际执行记录。计划、指派或事件阶段不代表已执行。</p></section>
          <section><h3>效果回馈</h3><p v-if="!review.observations.length">尚无有效效果观测记录，不能据此判断改善或恢复正常。</p><div v-for="(record,index) in review.observations" :key="index" class="maintenance-decision"><b>{{record.label}}</b><p>{{record.values?record.values.join(' / '):'数据待补充'}} · {{record.note}}</p></div><button v-if="review.observationReady" class="p2-secondary" @click="$emit('open-observation')">查看效果观察</button><p class="maintenance-limit">执行完成、异常解决、建议关闭与工单完成分别判断，本页不自动合并这些状态。</p></section>
        </template>
      </template>
    </main>
  </div>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import TaskAssignment from './TaskAssignment.vue'
import Arrangement from './MaintenanceArrangement.vue'
import BackButton from './BackButton.vue'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {useMaintenanceAdviceStore} from '@/stores/maintenanceAdviceStore'
import {useEventWorkOrderStore} from '@/stores/eventWorkOrderStore'
import {maintenanceReview} from '@/mock/maintenanceReview'
import {businessMessage} from '@/utils/businessCopy'
import {maintenanceReturnLabel} from '@/utils/maintenanceNavigation'
const props=defineProps({planned:Boolean,standalone:Boolean})
defineEmits(['back','show-advice','show-arrangements','open-event','open-observation'])
const route=useRoute(),core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore(),orders=useEventWorkOrderStore()
const review=computed(()=>businessMessage(maintenanceReview(core,advice,orders.state(advice.sourceEventId))))
const backLabel=computed(()=>props.planned&&route.query.returnAdvice==='1'?'返回维保建议':maintenanceReturnLabel(route.query))
const tabs=['建议概览','依据与评估','决定与进展'],activeTab=ref(tabs[0])
const editor=ref(null),note=ref(''),validation=ref(''),notice=ref(''),handled=computed(()=>core.isTaskHandled(advice.sourceEventId))
const requiredAction=computed(()=>handled.value?'回看实际执行和验收记录，结合有效监测核对效果。':advice.decision==='defer'?'已记录本次不采纳决定，建议材料与原事件保留。':advice.decision==='defer'?'暂不采纳原因已保留。':advice.sufficient&&advice.decision!=='execute'?'审阅已有检查依据，评估是否安排提前维护。':core.todoCreated[advice.sourceEventId]?'已有行动安排，继续原事件，不重复派工。':'审阅提前检查的合理性，核对必要性及安排条件。')
function decide(type){if(advice.decide(type))notice.value=type==='check'?'已记录确认并关联检查事件，可进入原事件继续处理。':'已记录采纳决定，实际执行在原事件中接续。'}
function save(){if(!note.value.trim()){validation.value=editor.value==='defer'?'请填写暂不采纳原因。':'请填写补充信息。';return}const ok=editor.value==='defer'?advice.decide('defer',note.value):advice.supplement(note.value);if(ok){notice.value='记录已保存。';editor.value=null;note.value='';validation.value=''}}
</script>
<style scoped>
.maintenance-advice-detail.is-standalone{height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;padding:20px 24px 0}
.maintenance-advice-heading{flex-shrink:0}
.maintenance-tab-body{flex:1;min-height:0;overflow:auto;padding-bottom:28px}
.maintenance-tabs{display:flex;gap:28px;border-bottom:1px solid #e7e9ed;flex-shrink:0}
.maintenance-tabs button{border:0;border-bottom:2px solid transparent;background:none;padding:12px 0;cursor:pointer;color:#7a808c;font-size:14px}
.maintenance-tabs button.active{border-color:#9c8860;color:#776444;font-weight:600}
.maintenance-advice-detail{color:#303744;line-height:1.75;padding:8px 0 24px}.maintenance-advice-heading{display:flex;gap:12px;align-items:flex-start;padding:8px 0 20px;border-bottom:1px solid #ebeef5}.maintenance-advice-heading>div{flex:1;min-width:0}.maintenance-advice-heading h2{font-size:22px;line-height:32px;margin:0}.maintenance-advice-heading p{font-size:13px;color:#7a818d;margin:4px 0 0}.maintenance-advice-detail section{padding:20px 0;border-bottom:1px solid #ebeef5;font-size:14px}.maintenance-advice-detail h3{font-size:16px;margin:0 0 10px}.maintenance-advice-detail p{margin:8px 0;max-width:90ch}.maintenance-summary{font-size:16px;color:#1d2129}.maintenance-limit{font-size:12px;color:#7a818d}.maintenance-section-heading,.maintenance-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.maintenance-section-heading{justify-content:space-between}.maintenance-advice-detail details{margin-top:14px}.maintenance-advice-detail summary{cursor:pointer;color:#947448}.maintenance-actions button{min-height:38px}.maintenance-editor{margin-top:16px}.maintenance-editor label{display:block}.maintenance-editor textarea{display:block;box-sizing:border-box;width:100%;margin:8px 0 12px;padding:10px;border:1px solid #e3e6ea;border-radius:6px;font:inherit}.maintenance-editor p{color:#bd4848}.maintenance-decision{padding:14px 0;border-top:1px solid #ebeef5;margin-top:16px}.maintenance-decision time{margin-left:16px;font-size:12px;color:#9195a2}.maintenance-required{color:#6c7183}button:focus-visible,summary:focus-visible,textarea:focus-visible{outline:2px solid #b7935a;outline-offset:2px}

.maintenance-evidence-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,1fr);gap:32px;align-items:start}
.maintenance-evidence-layout>section{min-width:0;border-bottom:0}.maintenance-arrangement-side{padding-left:28px!important;border-left:1px solid #ebeef5}
.maintenance-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:12px 0 22px;border-bottom:1px solid #ebeef5}.maintenance-metrics span{font-size:12px;color:#7a818d}.maintenance-metrics strong{display:block;font-size:25px;line-height:38px;color:#1d2129;font-weight:600;white-space:nowrap}.maintenance-metrics strong small{font-size:12px;font-weight:400;color:#6c7183}.maintenance-metrics i{font-size:18px;color:#b7935a;font-style:normal}.maintenance-metrics p{font-size:12px;line-height:20px;color:#7a818d}.maintenance-evidence-main h4{font-size:14px;margin:24px 0 12px}.maintenance-table-wrap{overflow:auto}.maintenance-evidence-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;line-height:22px}.maintenance-evidence-table th,.maintenance-evidence-table td{padding:12px 10px;border-bottom:1px solid #ebeef5;vertical-align:top}.maintenance-evidence-table thead{background:#f6f7f9;color:#7a818d}.maintenance-evidence-table tbody th{width:80px;font-weight:500}.maintenance-check-list{display:grid;gap:14px}.maintenance-check-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 16px}.maintenance-check-list b{font-size:13px;font-weight:500}.maintenance-check-list span{font-size:12px;color:#947448}.maintenance-check-list p{grid-column:1/-1;font-size:13px;color:#7a818d;margin:0}.maintenance-analysis-item{padding:12px 0;border-bottom:1px solid #ebeef5;margin-top:0!important}.maintenance-analysis-item p{font-size:14px;line-height:26px;max-width:none}
@media(max-width:1399px){.maintenance-evidence-layout{grid-template-columns:minmax(0,1fr)}.maintenance-arrangement-side{padding-left:0!important;border-left:0;border-top:1px solid #ebeef5}.maintenance-metrics strong{font-size:22px}}
</style>

<style scoped>
.review-snapshots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.review-snapshots article{border:1px solid #e8ebf1;border-radius:8px;padding:18px}.review-snapshots span,.review-snapshots small{color:#7a818d;font-size:12px}.review-snapshots strong{display:block;font-size:24px;line-height:1.5;margin:10px 0}.review-snapshots p{font-size:13px}.review-facts{display:grid;gap:12px;margin:10px 0}.review-facts>div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px}.review-facts dt{color:#7a818d}.review-facts dd{margin:0;overflow-wrap:anywhere}.review-origin{padding:18px 0;border-top:1px solid #edf0f5}.review-origin small{display:block;color:#7a818d;font-size:12px}.review-node-values{display:flex;gap:36px;margin:16px 0}.review-node-values small,.review-node-values strong{display:block}.review-node-values strong{font-size:24px}.review-assignment{padding:12px 0}.maintenance-advice-detail h4{font-size:14px}.overview-review section{min-width:0}.maintenance-lead{padding-bottom:24px!important}.maintenance-limit{overflow-wrap:anywhere}@media(max-width:1100px){.review-snapshots{gap:12px}.review-snapshots article{padding:12px}.review-snapshots strong{font-size:20px}}@media(max-width:800px){.review-snapshots{grid-template-columns:1fr}}
</style>

<style scoped>
.maintenance-advice-heading .maintenance-header-operations{flex:0 1 auto;display:flex;flex-direction:column;align-items:flex-end;gap:16px;max-width:55%;padding-top:2px}
.maintenance-header-actions{justify-content:flex-end;gap:8px}
.maintenance-header-actions button{white-space:nowrap;padding-inline:14px}
.maintenance-header-feedback{flex-shrink:0;padding:0 0 16px;border-bottom:1px solid #ebeef5}
.maintenance-header-feedback .maintenance-editor{margin-top:0}
.maintenance-header-feedback p[role=status]{margin:8px 0 0;font-size:13px;color:#776444}
@media(max-width:1600px){.maintenance-advice-heading{flex-wrap:wrap}.maintenance-advice-heading .maintenance-header-operations{flex:0 0 100%;max-width:100%;flex-direction:row;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:12px}.maintenance-heading-title h2{font-size:20px}}
</style>
