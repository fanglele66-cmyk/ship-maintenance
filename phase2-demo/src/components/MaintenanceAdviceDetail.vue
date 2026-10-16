<template>
  <div class="maintenance-advice-detail" :class="{'is-standalone':standalone}">
    <header class="maintenance-advice-heading"><BackButton label="返回维保建议" @click="$emit('back')" /><div><h2>{{ planned?'常规维保计划':item.title }}</h2><p>{{ plan.device }}</p></div><span class="p2-attention-status human">{{ planned?plan.status:advice.status }}</span></header>
    <nav v-if="!planned" class="maintenance-tabs" role="tablist" aria-label="维保建议详情内容"><button v-for="tab in tabs" :key="tab" type="button" role="tab" :aria-selected="activeTab===tab" :class="{active:activeTab===tab}" @click="activeTab=tab">{{ tab }}</button></nav>
    <main class="maintenance-tab-body" :role="planned?undefined:'tabpanel'" :aria-label="planned?'常规维保计划':activeTab">
    <template v-if="planned">
      <section><h3>原周期计划</h3><Arrangement :plan="plan" /></section>
      <button class="p2-secondary" @click="$emit('show-advice')">查看本部件提前维保建议</button>
    </template>
    <template v-else>
      <section v-show="activeTab==='建议概览'"><h3>建议摘要与当前状态</h3><p class="maintenance-summary">{{ report.recommendation }}</p><p>{{ report.conclusion }}</p><p class="maintenance-required"><b>当前需要你：</b>{{ requiredAction }}</p></section>
      <section v-show="activeTab==='建议概览'"><h3>关键依据摘要</h3><p>{{ handled?'实际处理及验收已记录，效果判断以处理后可比观测为依据。':advice.sufficient?'原事件已有偏磨、间隙及备件记录，当前维护依据已补齐；执行仍需人员决定与实际反馈。':'近期振动持续上行，周期检修临近；当前证据支持先检查，尚不能直接确认磨损或决定换件。' }}</p></section>
      <div v-show="activeTab==='依据与安排'" class="maintenance-evidence-layout">
        <section class="maintenance-evidence-main">
          <div class="maintenance-section-heading"><h3>关键证据</h3><span class="maintenance-limit">现有演示记录</span></div>
          <div class="maintenance-metrics"><div><span>{{ handled?'处理前 → 最新振动':'近7日振动变化' }}</span><strong>{{ handled?'3.0': '2.1' }} <i>→</i> {{ handled?latestValues?.[0]??'未取得':'3.0' }} <small>mm/s</small></strong><p>{{ handled?'按实际处理前后记录比较':'趋势上行，尚不能直接定位原因' }}</p></div><div><span>{{ handled?'最新轴承温度':'轴承温度' }}</span><strong>{{ handled?latestValues?.[1]??'未取得':'65' }} <small>°C</small></strong><p>{{ handled?'来自最新有效观测节点':'未记录同步明显上行' }}</p></div><div><span>距周期检修</span><strong>{{ plan.remainingHours }} <small>h</small></strong><p>属于周期安排依据，不是寿命预测</p></div></div>
          <h4>证据如何支持建议</h4><p class="maintenance-limit">以下为提出建议时的依据；现场检查进展单独记录在下方，不将原始趋势改写为执行结果。</p>
          <div class="maintenance-table-wrap"><table class="maintenance-evidence-table"><thead><tr><th>证据</th><th>当前解释</th><th>限制</th></tr></thead><tbody><tr><th>振动趋势</th><td>近期可比样本持续上行，支持进一步检查</td><td>不能由增幅直接认定轴瓦磨损</td></tr><tr><th>温度关联</th><td>当前演示未记录与振动同步的明显温升</td><td>不能据此排除机械或润滑问题</td></tr><tr><th>周期与窗口</th><td>检修临近，靠港提供核验机会</td><td>不代表已批准停机、换件或工单变更</td></tr></tbody></table></div>
          <h4>现场证据状态</h4>
          <div class="maintenance-check-list"><div><b>测点、转速及负荷</b><span>待补齐</span><p>核对固定状态、采集时间和可比工况，完整明细尚未取得。</p></div><div><b>轴瓦与间隙</b><span>{{ advice.sufficient?'已有检查记录':'待检查' }}</span><p>{{ advice.sufficient?'原事件记录轻微偏磨、间隙接近计划检修上限；具体尺寸仍需回看现场记录。':'当前尚无已确认的轴瓦表面与间隙结果。' }}</p></div><div><b>备件与作业条件</b><span>{{ advice.sufficient?'部分已记录':'待核对' }}</span><p>{{ advice.sufficient?'已记录备件可用；停机、隔离及正式安排仍需人员核对。':'靠港时间、停机隔离及备件可用性需核对。' }}</p></div></div>
          <h4>详细分析</h4><details v-for="part in evidenceAnalysis" :key="part.title" class="maintenance-analysis-item"><summary>{{ part.title }}</summary><p v-for="text in part.paragraphs" :key="text">{{ text }}</p></details>
        </section>
        <section class="maintenance-arrangement-side"><div class="maintenance-section-heading"><h3>已有维保安排</h3><button class="p2-link-button" @click="$emit('show-arrangements')">查看只读安排 →</button></div><Arrangement :plan="plan" /></section>
      </div>
      <section v-show="activeTab==='建议概览'"><TaskAssignment v-if="!handled && !core.todoCreated.maintenance" scenario="maintenance" /><h3 v-if="handled || core.todoCreated.maintenance">处理进展</h3>
        <div class="maintenance-actions">

          <button v-if="!core.isTaskHandled('maintenance')&&advice.sufficient&&advice.decision!=='execute'" class="p2-primary" @click="decide('execute')">采纳并安排执行</button>
          <button v-if="!core.isTaskHandled('maintenance')&&advice.sufficient&&advice.decision!=='defer'" class="p2-secondary" @click="editor='defer';validation=''">暂不采纳</button>
          <button v-if="core.todoCreated.maintenance && !core.isTaskHandled('maintenance')" class="p2-secondary" @click="editor='supplement';validation=''">补充信息</button>
          <button v-if="core.isTaskHandled('maintenance')" class="p2-secondary" @click="$emit('open-observation')">查看效果观察 →</button>
          <button v-if="core.todoCreated.maintenance" class="p2-secondary" @click="$emit('open-event')">进入关联事件 →</button>
        </div>
        <form v-if="editor" class="maintenance-editor" @submit.prevent="save"><label :for="'maintenance-'+editor">{{ editor==='defer'?'暂不采纳原因（必填）':'补充设备、工况或安排信息' }}</label><textarea :id="'maintenance-'+editor" v-model="note" rows="3" /><p v-if="validation" role="alert">{{ validation }}</p><div class="maintenance-actions"><button class="p2-primary" type="submit">保存记录</button><button class="p2-secondary" type="button" @click="editor=null;note=''">取消</button></div></form>
        <p v-if="notice" role="status">{{ notice }}</p>

      </section>
      <section v-show="activeTab==='推进记录'"><h3>人员决定与补充记录</h3>
        <p v-if="!advice.records.length" class="maintenance-limit">尚未记录人员决定。普通询问或补充信息不会自动建立事件。</p>
        <div v-for="record in advice.records" :key="record.id" class="maintenance-decision"><b>{{ record.label }}</b><time>{{ record.at }}</time><p>{{ record.text }}</p></div>
      </section>
      <section v-show="activeTab==='推进记录'"><h3>执行及效果</h3><template v-if="core.isTaskHandled('maintenance')"><p>实际措施及验收来自关联事件，后续效果由设备态势接续。</p><div class="maintenance-actions"><button class="p2-secondary" @click="$emit('open-event')">查看执行记录 →</button><button class="p2-secondary" @click="$emit('open-observation')">查看效果观察 →</button></div></template><p v-else>{{ core.todoCreated.maintenance?'已有原问题事件，实际执行及验收尚未确认。':'尚未形成实际执行记录。' }}采纳建议不等于已经执行，效果结论在取得实际记录和可比数据后展示。</p><p class="maintenance-limit">正式执行状态来自工单接口演示返回；关联不等于执行，实际措施和验收仍在原事件确认。</p></section>
      <section v-show="activeTab==='推进记录'"><h3>执行与验证说明</h3><details v-for="part in progressAnalysis" :key="part.title" class="maintenance-analysis-item"><summary>{{ part.title }}</summary><p v-for="text in part.paragraphs" :key="text">{{ text }}</p></details></section>
      <SituationTimeline v-show="activeTab==='推进记录'" :entries="report.timeline" :expanded="false" />
    </template>
    </main>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import TaskAssignment from './TaskAssignment.vue'
import Arrangement from './MaintenanceArrangement.vue'
import BackButton from './BackButton.vue'
import SituationTimeline from './SituationTimeline.vue'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { useMaintenanceAdviceStore } from '@/stores/maintenanceAdviceStore'
import { maintenanceFollowup } from '@/mock/phase2Followup'
import { maintenancePlans } from '@/mock/phase2Scenarios'
defineProps({planned:Boolean,standalone:Boolean})
defineEmits(['back','show-advice','show-arrangements','open-event','open-observation'])
const core=usePhase2DemoStore(),advice=useMaintenanceAdviceStore(),plan=maintenancePlans[0]
const item=core.attention.find(item=>item.id==='maintenance'),report=computed(()=>maintenanceFollowup(core))
const tabs=['建议概览','依据与安排','推进记录'],activeTab=ref('建议概览')
const editor=ref(null),note=ref(''),validation=ref(''),notice=ref('')
const requiredAction=computed(()=>core.isTaskHandled('maintenance')?'回看执行记录，继续关注处理后效果。':advice.decision==='defer'?'已记录暂不采纳原因；保留建议及关联记录。':advice.sufficient&&advice.decision!=='execute'?'评估已补齐的维护依据，决定是否采纳并安排执行。':core.todoCreated.maintenance?'在关联事件中继续检查或执行，不重复建立事件。':'确认是否开展检查，先补齐现场证据。')
const handled=computed(()=>core.isTaskHandled('maintenance'))
const latestValues=computed(()=>core.observationRecords.maintenance.filter(record=>record.values).at(-1)?.values)
const evidenceAnalysis=computed(()=>report.value.sections.filter(part=>!['人员决定与执行接续','处理后如何验证原判断'].includes(part.title)))
const progressAnalysis=computed(()=>report.value.sections.filter(part=>['人员决定与执行接续','处理后如何验证原判断'].includes(part.title)))
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
