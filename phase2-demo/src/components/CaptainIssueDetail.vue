<template>
<article v-if="issue" ref="rootRef" class="captain-detail">
  <BackButton :label="route.query.from==='issues'?'返回事项处置':route.query.from==='workbench'?'返回船舶态势':route.query.from==='device'?'返回'+issue.device+'相关事项':'返回'+issue.device+'概览'" @click="$emit('back',issue.deviceId)"/>
  <header>
    <div><span class="issue-type">{{issue.type}} · {{issue.device}}</span><h2>{{issue.title}}</h2></div>
    <span>{{store.todoCreated[issue.id]?'已派发':store.ignoredSuggestions[issue.id]?'已记录决定':'待决策'}}</span>
  </header>
  <nav role="tablist">
    <button v-for="tab in tabs" :key="tab" role="tab" :aria-selected="active===tab" :class="{active:active===tab}" @click="goTab(tab)">{{tab}}</button>
  </nav>
  <main>
    <!-- 事项概览：结论与建议先行，关键依据摘要，推理可展开，快链与下一步 -->
    <template v-if="active==='事项概览'">
      <section class="dossier-lead">
        <h3>初判结论</h3>
        <p class="lead-conclusion">{{dossier.conclusion}}</p>
        <h3>建议</h3>
        <p class="lead-recommendation">{{dossier.recommendation}}</p>
      </section>
      <section v-if="dossier.snapshots?.length" class="dossier-block">
        <h3>关键依据摘要</h3>
        <div class="snapshot-grid">
          <div v-for="snap in dossier.snapshots" :key="snap.name+snap.value" class="snapshot-card">
            <small>{{snap.name}}</small>
            <strong>{{snap.value}}</strong>
            <p>{{snap.reference}}</p>
            <span>{{snap.meaning}}</span>
            <em>来源：{{snap.source}}</em>
          </div>
        </div>
        <p class="limit-note">{{issue.limit}}</p>
      </section>
      <details v-if="dossier.steps?.length" class="reasoning">
        <summary>研判思路摘要（可展开）</summary>
        <div v-for="step in dossier.steps" :key="step.title" class="reason-step">
          <b>{{step.title}}</b>
          <p><span>事实</span>{{step.fact}}</p>
          <p><span>推断</span>{{step.inference}}</p>
        </div>
      </details>
      <div class="quick-links" aria-label="页签快链">
        <button type="button" @click="goTab('研判分析')">查看研判分析 →</button>
        <button type="button" @click="goTab('证据资料')">查看证据资料 →</button>
      </div>
      <section class="next-step">
        <TaskAssignment :scenario="issue.id" :allow-ignore="issue.type!=='报警事件'" :action-title="issue.type==='报警事件'?'安排报警排查':issue.type==='预警事件'?'安排预警核实与排查':'评估并安排检查'"/>
        <button v-if="store.todoCreated[issue.id]" class="p2-primary" @click="openTask">查看处理任务</button>
        <template v-else-if="issue.type==='报警事件'">
          <button class="p2-link-button" @click="falseAlarmOpen=!falseAlarmOpen">反馈可能误报</button>
          <InquiryMessage v-if="falseAlarmOpen||feedback" :message="falseAlarmInquiry" @submit-inquiry="reportFalseAlarm"/>
        </template>
      </section>
    </template>
    <!-- 研判分析：观察事实、推断、候选解释与未确认问题分层 -->
    <template v-else-if="active==='研判分析'">
      <section class="dossier-block">
        <h3>观察事实与推断</h3>
        <div v-if="dossier.steps?.length">
          <div v-for="step in dossier.steps" :key="step.title" class="reason-step">
            <b>{{step.title}}</b>
            <p><span>事实</span>{{step.fact}}</p>
            <p><span>推断</span>{{step.inference}}</p>
          </div>
        </div>
        <p v-else class="block-empty">暂无分层研判记录。</p>
      </section>
      <section class="dossier-block">
        <h3>候选解释</h3>
        <table v-if="dossier.comparisons?.length" class="candidate-table">
          <thead><tr><th>方向</th><th>支持依据</th><th>尚缺核对</th></tr></thead>
          <tbody>
            <tr v-for="row in dossier.comparisons" :key="row.direction">
              <th scope="row">{{row.direction}}</th>
              <td>{{row.support}}</td>
              <td>{{row.missing}}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="block-empty">暂无候选解释记录。</p>
      </section>
      <section class="dossier-block">
        <h3>尚未确认的问题</h3>
        <ul v-if="openQuestions.length" class="open-questions">
          <li v-for="question in openQuestions" :key="question">{{question}}</li>
        </ul>
        <p v-else class="block-empty">暂无待确认问题记录。</p>
        <p class="limit-note">以上未确认问题不作为结论；现场核对后再更新判断。</p>
      </section>
      <div class="quick-links" aria-label="返回概览">
        <button type="button" @click="goTab('事项概览')">← 返回事项概览（恢复阅读位置）</button>
      </div>
    </template>
    <!-- 证据资料：数据快照、观测节点趋势、证据链、计划来源、人员反馈与决定 -->
    <template v-else>
      <section class="dossier-block">
        <h3>数据快照</h3>
        <table v-if="dossier.snapshots?.length" class="candidate-table">
          <thead><tr><th>测点/项目</th><th>数值</th><th>参考口径</th><th>说明</th><th>来源</th></tr></thead>
          <tbody>
            <tr v-for="snap in dossier.snapshots" :key="snap.name+snap.value">
              <th scope="row">{{snap.name}}</th>
              <td>{{snap.value}}</td>
              <td>{{snap.reference}}</td>
              <td>{{snap.meaning}}</td>
              <td>{{snap.source}}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="block-empty">暂无数据快照。</p>
      </section>
      <section class="dossier-block">
        <h3>已有观测节点</h3>
        <template v-if="dossier.series?.length">
          <div v-for="series in dossier.series" :key="series.name" class="series-block">
            <header><b>{{series.name}}</b><span v-if="series.unit">（{{series.unit}}）</span><small>{{series.scope}}</small></header>
            <svg class="series-svg" viewBox="0 0 640 150" role="img" :aria-label="series.name+'观测节点比较'">
              <polyline :points="trendPoints(series).map(point=>point.x+','+point.y).join(' ')" fill="none" stroke="#936821" stroke-width="2" stroke-linejoin="round"/>
              <g v-for="(point,index) in trendPoints(series)" :key="index">
                <circle :cx="point.x" :cy="point.y" r="4" fill="#fff" stroke="#936821" stroke-width="2"/>
                <text :x="point.x" :y="point.y-10" text-anchor="middle" class="series-value">{{point.v}}</text>
                <text :x="point.x" y="146" text-anchor="middle" class="series-label">{{point.label}}</text>
              </g>
            </svg>
          </div>
          <p class="limit-note">节点折线仅连接已有观测记录，节点口径见各图说明；未补时间点。</p>
        </template>
        <p v-else class="block-empty">该事项暂无连续观测节点记录，仅保留上方数据快照；不拼凑连续趋势。</p>
      </section>
      <section class="dossier-block">
        <h3>关联证据与判断范围</h3>
        <ul class="evidence-list">
          <li v-for="text in issue.evidence" :key="text">{{text}}</li>
        </ul>
        <p class="limit-note">{{issue.limit}}</p>
      </section>
      <section v-if="dossier.plan?.length" class="dossier-block">
        <h3>计划与安排来源</h3>
        <table class="candidate-table">
          <thead><tr><th>项目</th><th>内容</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="row in dossier.plan" :key="row.label">
              <th scope="row">{{row.label}}</th>
              <td>{{row.value}}</td>
              <td>{{row.status}}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="dossier-block">
        <h3>人员补充与已有决定</h3>
        <p v-if="store.todoCreated[issue.id]">轮机长已派发给 {{store.assignments[issue.id]?.owner}}，当前处于{{store.cases[issue.id]?.stages[store.progress[issue.id]]?.label}}阶段。</p>
        <p v-else-if="store.ignoredSuggestions[issue.id]">本次不采纳：{{store.ignoredSuggestions[issue.id].reason}}</p>
        <p v-else>尚未派发处理任务。</p>
        <p v-for="record in store.assignmentRecords[issue.id]||[]" :key="'assign'+record.at">{{record.at}} · {{record.assignedBy}}指定{{record.owner}}：{{record.scope}}</p>
        <p v-for="record in store.dossierNotes[issue.id]||[]" :key="record.id">{{record.at}} · {{record.text}}</p>
      </section>
    </template>
  </main>
</article>
<div v-else class="p2-empty">未找到该事项，请返回态势中心。</div>
</template>
<script setup>
import {computed,nextTick,ref} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {issueCatalog} from '@/mock/captainWorkbench'
import issueDossiers from '@/mock/issueDossiers.json'
import InquiryMessage from './messages/InquiryMessage.vue'
import assignmentTemplate from '@/message-flows/task-assignment.json'
import BackButton from './BackButton.vue'
import TaskAssignment from './TaskAssignment.vue'
const props=defineProps({scenario:String}),store=usePhase2DemoStore(),router=useRouter(),route=useRoute()
const tabs=['事项概览','研判分析','证据资料'],active=ref(tabs[0]),falseAlarmOpen=ref(false),falseAlarmReason=ref(''),feedback=ref(false)
const rootRef=ref(null),overviewScroll=ref(0)
const issue=computed(()=>issueCatalog.find(item=>item.id===props.scenario))
const dossier=computed(()=>issueDossiers[props.scenario]||{})
const openQuestions=computed(()=>{
  const items=(dossier.value.comparisons||[]).map(row=>row.missing).filter(Boolean)
  return [...new Set(items)]
})
function goTab(tab){
  if(active.value==='事项概览'&&tab!=='事项概览')overviewScroll.value=rootRef.value?.scrollTop||0
  active.value=tab
  if(tab==='事项概览')nextTick(()=>{if(rootRef.value)rootRef.value.scrollTop=overviewScroll.value})
}
// Node-to-node line from existing observation records only; no fabricated time axis.
function trendPoints(series){
  const values=series.values,min=Math.min(...values),span=Math.max(...values)-min||1
  const width=640,height=150,padLeft=46,padRight=16,padTop=20,padBottom=34
  const step=values.length>1?(width-padLeft-padRight)/(values.length-1):0
  return values.map((value,index)=>({x:padLeft+step*index,y:padTop+(1-(value-min)/span)*(height-padTop-padBottom),v:value,label:series.labels[index]??''}))
}
function openTask(){store.selectTodo(issue.value.id);router.push({path:'/event',query:{todo:issue.value.id}})}
const falseAlarmInquiry=computed(()=>({...assignmentTemplate.falseAlarm,id:'false-alarm-'+props.scenario,status:feedback.value?'submitted':'pending',values:{reason:falseAlarmReason.value},submitLabel:'提交误报反馈',receiptText:'原报警继续保留，尚未确认解除。'}))
function reportFalseAlarm(payload){const reason=payload.values.reason;if(!store.registerDossierNote(issue.value.id,'可能误报反馈（待核对）：'+reason))return;falseAlarmReason.value=reason;feedback.value=true;falseAlarmOpen.value=false}
async function showSection(section){if(section==='decision'){active.value='事项概览';await nextTick();rootRef.value?.querySelector('.next-step')?.scrollIntoView({block:'start',behavior:'smooth'})}else if(tabs.includes(section)){goTab(section);await nextTick();if(rootRef.value)rootRef.value.scrollTop=0}}
defineExpose({showSection})
defineEmits(['back'])
</script>
<style scoped>
.captain-detail{width:100%;min-width:0;height:100%;overflow:auto;scrollbar-gutter:stable;background:white;padding:24px;box-sizing:border-box;color:#445870;font-size:var(--wb-body,14px);line-height:1.8}
.captain-detail header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:20px 0}
.captain-detail h2{color:#202020;font-size:22px;margin:5px 0}
.issue-type{color:#7a8595;font-size:13px}
.captain-detail nav{display:flex;gap:26px;flex-wrap:wrap;border-bottom:1px solid #e4eaf1}
.captain-detail nav button{border:0;background:none;padding:10px 0;color:#68788e;font:inherit;cursor:pointer}
.captain-detail nav .active{color:#936821;border-bottom:2px solid #b49359}
.captain-detail main{width:100%;min-width:0;max-width:none}.captain-detail main>*{min-width:0;box-sizing:border-box}.captain-detail p,.captain-detail li,.captain-detail td,.captain-detail th{overflow-wrap:break-word;word-break:normal}
.captain-detail h3{font-size:15px;color:#30445d;margin:20px 0 6px}
.captain-detail p{margin:6px 0}
.captain-detail textarea{display:block;box-sizing:border-box;width:100%;min-height:90px;border:1px solid #dce3ec;padding:12px;font:inherit;margin:8px 0}
.captain-detail form{margin:12px 0}
.captain-detail header>div{min-width:0}.captain-detail header>span{flex-shrink:0;white-space:nowrap}.captain-detail h2{overflow-wrap:break-word}
.dossier-lead{background:#faf8f3;border:1px solid #eee4d2;border-radius:8px;padding:14px 18px;margin-top:14px}
.lead-conclusion{font-weight:600;color:#33415a;margin:4px 0 10px}
.lead-recommendation{color:#4c5f78}
.dossier-block{margin-top:18px}
.snapshot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px;margin:10px 0}
.snapshot-card{border:1px solid #e4eaf1;border-radius:8px;padding:12px 14px;background:#fbfcfe;display:flex;flex-direction:column;gap:4px}
.snapshot-card small{color:#7a8595;font-size:12px}
.snapshot-card strong{font-size:18px;color:#24354c;font-variant-numeric:tabular-nums}
.snapshot-card p{margin:0;font-size:12px;color:#68788e}
.snapshot-card span{font-size:12px;color:#4c5f78}
.snapshot-card em{font-style:normal;font-size:11px;color:#8a94a5}
.limit-note{font-size:12px;color:#8a7a5c;background:#faf8f3;border-radius:6px;padding:8px 12px;margin:8px 0 0}
.reasoning{margin:14px 0 4px;border:1px solid #e4eaf1;border-radius:8px;background:#fff}
.reasoning summary{cursor:pointer;padding:10px 14px;color:#8b682d;font-size:13px}
.reason-step{padding:10px 16px;border-top:1px solid #edf0f5}
.reason-step b{display:block;color:#30445d;font-size:13px;margin-bottom:4px}
.reason-step p{margin:4px 0;font-size:13px;color:#54677f}
.reason-step p span{display:inline-block;background:#f1ede2;color:#8b682d;border-radius:4px;padding:1px 7px;font-size:11px;margin-right:8px}
.quick-links{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.quick-links button{border:1px solid #d8c4a2;background:#fff;color:#8b682d;border-radius:7px;padding:8px 14px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}
.quick-links button:hover{background:#faf5eb}
.next-step{margin-top:8px}
.candidate-table{table-layout:fixed;width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
.candidate-table th,.candidate-table td{border:1px solid #e4eaf1;padding:9px 11px;text-align:left;vertical-align:top;line-height:1.6}
.candidate-table thead th{background:#f6f4ee;color:#5c6b80;font-size:12px}
.candidate-table tbody th{color:#33415a;font-weight:600;background:#fbfcfe;width:auto}
.open-questions{margin:8px 0;padding-left:20px}
.open-questions li{margin:5px 0}
.block-empty{font-size:13px;color:#8593a5;background:#f7f9fc;border:1px dashed #d9e3ef;border-radius:6px;padding:10px 14px}
.series-block{border:1px solid #e4eaf1;border-radius:8px;padding:12px 14px;margin:10px 0;background:#fff}
.series-block header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin:0 0 6px}
.series-block header b{color:#30445d;font-size:13px}
.series-block header span{color:#68788e;font-size:12px}
.series-block header small{margin-left:auto;color:#8a94a5;font-size:11px}
.series-svg{display:block;width:100%;height:auto}
.series-value{font-size:12px;fill:#54677f;font-variant-numeric:tabular-nums}
.series-label{font-size:11px;fill:#8a94a5}
.evidence-list{margin:8px 0;padding-left:20px}
.evidence-list li{margin:5px 0}

@media(max-width:1200px){.captain-detail{padding:20px}.captain-detail h2{font-size:20px}}
@media(max-width:600px){.captain-detail{padding:16px}.captain-detail header{gap:12px;flex-wrap:wrap}.captain-detail nav{gap:18px}.candidate-table th,.candidate-table td{padding:7px 5px;font-size:12px}}
</style>
