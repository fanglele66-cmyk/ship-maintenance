<template>
  <div v-if="todo && stage" class="p2-detail p2-pad-detail">
    <header class="p2-detail-head">
      <BackButton :label="route.query.from==='issues'?'返回事项处置':'返回待办中心'" @click="returnToList" />
      <div><span class="p2-eyebrow">{{ cardType }} · {{ todo.device }}</span><h2>{{ cardTitle }}</h2></div>
      <span class="p2-badge" :class="store.isTaskHandled(todo.id)?'blue':'red'">{{ store.isTaskHandled(todo.id)?'已处理':'未处理' }}</span>
    </header>
    <nav class="p2-stage-rail" :style="{'--stage-count':displayStages.length}" aria-label="处理阶段">
      <button v-for="(step,position) in displayStages" :key="step.id" class="p2-stage-card" :class="{active:step.kind==='handled'?stage.kind==='handled':store.activeStage[todo.id]===step.index,done:step.kind!=='handled'&&store.progress[todo.id]>step.index,locked:store.progress[todo.id]<step.index}" :disabled="store.progress[todo.id]<step.index" @click="store.selectStage(todo.id,step.index)">
        <span>{{ String(position+1).padStart(2,'0') }}</span><strong>{{ step.label }}</strong><small>{{ step.kind==='handled'?'处理记录':store.progress[todo.id]>step.index?'已完成':store.progress[todo.id]===step.index?'当前阶段':'待接续' }}</small>
      </button>
    </nav>
    <div class="p2-pad-body" :key="stageKey">
      <nav class="p2-subtabs" aria-label="阶段内容"><button v-for="tab in tabs" :key="tab" :class="{active:subtab===tab}" @click="subtab=tab">{{ tab }}</button></nav>

      <div v-if="['建议速览','概览'].includes(subtab)" class="p2-pad-overview">
        <section class="p2-panel p2-overview-meta"><dl>
          <div><dt>首次观测时间</dt><dd>{{ todo.firstObserved || (todo.id==='fault'?'10-07 10:30':todo.id==='drift'?'10-10 08:00':'10-01 08:00') }}</dd></div>
          <div><dt>关注设备</dt><dd>{{ todo.device }}</dd></div>
          <div><dt>触发来源</dt><dd>{{ source }}</dd></div>
          <div><dt>当前阶段</dt><dd>{{ stage.label }}</dd></div>
        </dl></section>
        <section class="p2-panel p2-overview-analysis">
          <div class="p2-report-block"><h3>初判结论</h3><p>{{ report.conclusion }}</p></div>
          <div class="p2-report-block"><h3>判断依据</h3><p>{{ report.basis }}</p></div>
          <div class="p2-report-block"><h3>下一步建议</h3><dl class="p2-next-advice"><div><dt>系统监测</dt><dd>{{ report.system }}</dd></div><div><dt>船舶操作</dt><dd>{{ report.operation }}</dd></div><div><dt>人工事项</dt><dd>{{ report.human }}</dd></div></dl></div>

        </section>
      </div>
      <Phase2DataOverview v-else-if="subtab==='数据观测'" :scenario="todo.id" :stage="stage.id" />
      <section v-else-if="subtab==='候选原因'" class="p2-panel p2-pad-cause">
        <div class="p2-section-title">当前异常机理判断</div><p>{{ cause.mechanism }}</p>
        <div class="p2-section-title p2-cause-table-title">候选故障分析</div>
        <table class="p2-cause-table"><thead><tr><th>候选故障</th><th>可能原因</th><th>影响</th></tr></thead><tbody><tr v-for="(row,i) in cause.rows" :key="row.name"><td><small>{{ i+1 }} · {{ row.level }}{{ ['较高','中等','较低'].includes(row.level)?'可能性':'' }}</small><strong>{{ row.name }}</strong></td><td>{{ row.cause }}</td><td>{{ row.effect }}</td></tr></tbody></table>
        <div class="p2-pad-conclusion"><b>下一步排查</b><p>{{ stage.judgement }}</p></div>
      </section>

      <section v-else-if="stage.kind==='check'&&subtab.includes('准备')" class="p2-panel p2-pad-single">
        <div class="p2-section-title">{{ stage.label }}前注意事项</div>
        <p class="p2-stage-purpose">{{ stage.summary }}</p>
        <div v-for="(fact,i) in closedEvidence" :key="fact" class="p2-pad-list-row"><span>{{ String(i+1).padStart(2,'0') }}</span>{{ fact }}</div>
        <div class="p2-pad-conclusion"><b>现场操作</b><p>确认设备与作业条件，按当前任务逐项反馈。遇到条件不具备或无法确认的情况，请记录实际原因。</p></div>
        <EventWorkOrderLink v-if="todo.id==='maintenance'" :event-id="todo.id" />
        <button class="p2-primary p2-ready-button" @click="prepared[stageKey]=true;subtab=stage.label+'步骤'">已了解，开始{{ stage.label }}</button>
      </section>
      <section v-else-if="stage.kind==='check'||stage.kind==='work'&&subtab.includes('步骤')" class="p2-panel p2-step-content">
        <nav class="p2-check-stepper" :aria-label="stage.label+'步骤'"><button v-for="(task,i) in stage.tasks" :key="task.label" :class="{active:stepIndex===i,done:results[taskKey(i)]}" @click="stepIndex=i"><span>{{ i+1 }}</span>{{ stage.label }}步骤{{ i+1 }}</button></nav>
        <article class="p2-current-task">
          <h3>{{ currentTask.label }}</h3><p>{{ currentTask.guide }}</p>
          <p v-if="readOnly" class="p2-pad-conclusion">已提交：{{ currentResult||'现场反馈已记录于右侧对话' }}</p>
          <fieldset v-else class="p2-check-options"><legend>{{ stage.kind==='work'?'作业反馈':'检查结果' }}</legend><label v-for="choice in taskChoices" :key="choice"><input type="radio" :name="taskKey(stepIndex)" :value="choice" v-model="currentResult" />{{ choice }}</label></fieldset>
          <label class="p2-step-note">备注<textarea v-model="currentNote" :readonly="readOnly" rows="3" placeholder="记录实际读数、现场发现或处理结果"></textarea></label>
          <div class="p2-attachment-row"><label v-if="!readOnly">＋ 添加图片<input type="file" accept="image/*" multiple @change="attachFiles" /></label><span>{{ (attachments[taskKey(stepIndex)]||[]).join('、')||'未添加附件' }}</span></div>
        </article>
        <div class="p2-step-controls"><button class="p2-secondary" :disabled="stepIndex===0" @click="stepIndex--">上一步</button><span>{{ stepIndex+1 }} / {{ stage.tasks.length }}</span><button class="p2-primary" @click="nextStep">{{ stepIndex<stage.tasks.length-1?'下一步':readOnly?'查看下一阶段':stage.kind==='work'?'前往验收确认':'提交本轮反馈' }}</button></div>
      </section>

      <section v-else-if="stage.kind==='work'" class="p2-panel p2-pad-single">
        <div class="p2-section-title">{{ subtab }}</div>
        <template v-if="subtab.includes('准备')"><EventWorkOrderLink v-if="todo.id==='maintenance'" :event-id="todo.id" /><p class="p2-stage-purpose">{{ stage.title }}</p><div v-for="(text,i) in workDetails.preparation" :key="text" class="p2-pad-list-row"><span>{{ i+1 }}</span>{{ text }}</div></template>
        <template v-else-if="subtab==='备件清单'"><table class="p2-cause-table"><thead><tr><th>名称</th><th>数量</th><th>用途</th></tr></thead><tbody><tr v-for="part in workDetails.parts" :key="part.name"><td><strong>{{ part.name }}</strong></td><td>{{ part.amount }}</td><td>{{ part.use }}</td></tr></tbody></table></template>
        <template v-else-if="subtab==='验收确认'"><p class="p2-stage-purpose">先核对验收项目，再记录实际措施与复测。作业完成后仍异常，应继续原事件排查。</p><table class="p2-cause-table"><thead><tr><th>验收项目</th><th>验收要求</th><th>核对方法</th></tr></thead><tbody><tr v-for="row in acceptanceRows" :key="row.name"><td>{{ row.name }}</td><td>{{ row.req }}</td><td>{{ row.method }}</td></tr></tbody></table><InquiryMessage v-if="executionForm" :message="executionForm" @update-inquiry="updateExecution" @submit-inquiry="confirmExecution" /></template>
        <template v-else-if="subtab==='关联工单'"><EventWorkOrderLink :event-id="todo.id" /></template>
      </section>
      <section v-else-if="subtab==='时间线'" class="p2-panel p2-pad-single"><div class="p2-section-title">人工处理记录</div><div v-for="(step,i) in humanStages.filter(entry => entry.index <= store.progress[todo.id])" :key="step.id" class="p2-pad-list-row"><span>{{ String(i+1).padStart(2,'0') }}</span><b>{{ step.label }}</b> {{ step.title }}</div><p class="p2-stage-purpose">具体现场反馈保留在右侧会话及作业记录中。</p></section>
      <section v-else class="p2-panel p2-pad-single p2-handled-receipt">
        <div class="p2-section-title">本轮人工处理已完成</div>
        <dl v-if="latestExecution" class="p2-execution-facts"><div><dt>实际执行人</dt><dd>{{ latestExecution.executor }}</dd></div><div><dt>实际设备与部位</dt><dd>{{ latestExecution.values.equipment }}</dd></div><div><dt>实际措施</dt><dd>{{ latestExecution.values.measures }}</dd></div><div><dt>实际执行时间</dt><dd>{{ latestExecution.values.executedAt.replace('T',' ') }}</dd></div><div><dt>验收与复测</dt><dd>{{ latestExecution.values.acceptance }}</dd></div><div><dt>来源及确认时间</dt><dd>{{ latestExecution.source }} · {{ latestExecution.confirmedAt }}</dd></div></dl>
        <p v-if="!store.executionObservationReady(todo.id)">缺少可比监测数据，效果观察待补充；当前不生成改善结论。</p>
        <div v-for="(fact,i) in closedEvidence" :key="fact" class="p2-pad-list-row"><span>{{ String(i+1).padStart(2,'0') }}</span>{{ fact }}</div>
        <div class="p2-pad-conclusion"><b>处理结果</b><p>现场检查、实际措施与验收反馈已提交，待办记为已处理。{{ store.executionObservationReady(todo.id)?'设备态势接续处理后的持续效果跟踪。':'缺少可比监测数据，效果观察待补充。' }}</p></div>
        <button v-if="store.executionObservationReady(todo.id)" type="button" class="p2-secondary p2-ready-button" @click="viewObservation">查看设备态势中的效果观察 →</button>
        <div class="p2-case-source"><b>案例材料 · {{ store.caseMaterials[todo.id]?.status }}</b><p>来源：{{ store.caseMaterials[todo.id]?.sourceId }} · {{ store.caseMaterials[todo.id]?.sourceTitle }}</p><p>原始证据、现场反馈与实际措施已自动汇集。后续效果记录继续补充；岸端可提出建议、修改材料或直接沉淀。</p></div>
      </section>
      <footer v-if="stage.kind!=='handled'&&stage.kind!=='check'&&stage.kind!=='work'" class="p2-pad-footer"><span :class="{'is-validation':validation}">{{ validation||actionNote }}</span><button v-if="stage.action&&stage.kind!=='check'" class="p2-primary" @click="advance">{{ actionLabel }} →</button></footer>
    </div>
  </div>
</template>
<script setup>

import { computed, reactive, ref, watch } from 'vue'
import { checkChoices } from '@/mock/eventFeedbackRules'
import { useRouter,useRoute } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import {lazyPane} from '@/components/lazyPane'
const Phase2DataOverview=lazyPane(()=>import('@/components/Phase2DataOverview.vue'))
import InquiryMessage from '@/components/messages/InquiryMessage.vue'
import EventWorkOrderLink from '@/components/EventWorkOrderLink.vue'
import BackButton from '@/components/BackButton.vue'
import { overviewReports, causeContent } from '@/mock/phase2Content'
function returnToList(){store.closeTodo();router.replace(route.query.from==='issues'?{path:'/situation/issues',query:{resume:'1',state:route.query.state,device:route.query.device,type:route.query.type}}:'/event')}
const route=useRoute(),router=useRouter(),store=usePhase2DemoStore(),todo=computed(()=>store.selectedTodo),stage=computed(()=>store.currentStage)
const subtab=computed({get:()=>store.detailTab,set:value=>store.detailTab=value})
const results=store.taskResults,notes=store.taskNotes,attachments=store.taskAttachments,prepared=reactive({}),validation=ref(''),actionNote=ref(''),stepIndex=ref(0)
const humanStages=computed(()=>(todo.value?.stages||[]).map((entry,index)=>({...entry,index})).filter(entry=>!['observe','closed'].includes(entry.kind)))
const displayStages=computed(()=>{const steps=humanStages.value;return store.isTaskHandled(todo.value?.id)?[...steps,{id:'handled',kind:'handled',label:'处理结果',index:store.observationIndex(todo.value.id)}]:steps})
const executionForm=computed(()=>store.executionInquiry(todo.value?.id)||store.logs[todo.value?.id]?.findLast(message=>message.purpose==='execution-record'&&message.stageId===stage.value?.id))
const latestExecution=computed(()=>store.executionRecords[todo.value?.id]?.at(-1))
const currentResult=computed({get:()=>stage.value?.kind==='work'?(executionForm.value?.values['task'+stepIndex.value]||results[taskKey(stepIndex.value)]):results[taskKey(stepIndex.value)],set:value=>{results[taskKey(stepIndex.value)]=value;if(stage.value.kind==='work'&&executionForm.value?.status==='pending')updateExecution({messageId:executionForm.value.id,values:{...executionForm.value.values,['task'+stepIndex.value]:value}})}})
const currentNote=computed({get:()=>stage.value?.kind==='work'?(executionForm.value?.values['note'+stepIndex.value]||notes[taskKey(stepIndex.value)]):notes[taskKey(stepIndex.value)],set:value=>{notes[taskKey(stepIndex.value)]=value;if(stage.value.kind==='work'&&executionForm.value?.status==='pending')updateExecution({messageId:executionForm.value.id,values:{...executionForm.value.values,['note'+stepIndex.value]:value}})}})
function updateExecution(payload){store.updateExecutionRecord(todo.value.id,payload.messageId,payload.values)}
function confirmExecution(payload){store.confirmExecutionRecord(todo.value.id,payload.messageId,payload.values)}
watch(()=>[todo.value?.id,stage.value?.kind],()=>{if(stage.value?.kind==='work'&&!store.isTaskHandled(todo.value.id))store.requestExecutionRecord(todo.value.id)},{immediate:true})
const stageKey=computed(()=>[todo.value?.id,stage.value?.id].join(':'))
const readOnly=computed(()=>store.activeStage[todo.value?.id]<store.progress[todo.value?.id])
const accepted=computed({get:()=>store.workAcceptance[stageKey.value]||[],set:value=>store.workAcceptance[stageKey.value]=value})
const acceptanceNote=computed({get:()=>store.workAcceptanceNotes[stageKey.value]||'',set:value=>store.workAcceptanceNotes[stageKey.value]=value})
const cardTitle=computed(()=>todo.value?.id==='drift'&&store.progress.drift>=2?todo.value.eventTitle:todo.value?.initialTitle)
const cardType=computed(()=>todo.value?.id==='drift'&&store.progress.drift>=2?'故障/异常事件的排查与处置':todo.value?.cardType)
const source=computed(()=>todo.value?.source || (todo.value?.id==='fault'?'传感器告警':todo.value?.id==='drift'?'日常健康扫查 · 持续监测':'日常健康扫查 · 预测维保'))
const tabs=computed(()=>{if(!stage.value)return[];if(stage.value.kind==='handled')return['摘要','时间线'];if(stage.value.kind==='check')return[stage.value.label+'准备',stage.value.label+'步骤'];if(stage.value.kind==='work'){const word=todo.value.id==='maintenance'?'保养':'维修';return[word+'准备','备件清单',word+'步骤','验收确认',...(todo.value.id==='maintenance'?['关联工单']:[])]}if(todo.value.id==='maintenance')return['建议速览'];return stage.value.id==='event'?['概览','数据观测','候选原因']:['概览','数据观测']})
const closedEvidence=computed(()=>{
  if(stage.value?.kind!=='handled')return stage.value?.evidence||[]
  if(latestExecution.value)return []
  const work=todo.value.stages[store.observationIndex(todo.value.id)-1]
  const feedback=store.logs[todo.value.id].filter(entry=>entry.kind==='feedbackRecord'&&entry.task===work.title).at(-1)
  return feedback?.records.map(record=>[record.result,record.note].filter(Boolean).join('；'))||work.evidence
})
const actionLabel=computed(()=>readOnly.value?'查看下一阶段':stage.value?.id==='event'&&subtab.value!=='候选原因'?'查看候选原因':stage.value?.action)
const report=computed(()=>overviewReports[todo.value?.id==='drift'&&stage.value?.id==='event'?'driftEvent':todo.value?.id])
const cause=computed(()=>causeContent[todo.value?.id])
const currentTask=computed(()=>stage.value?.tasks?.[stepIndex.value])
const taskChoices=computed(()=>stage.value?.kind==='work'?['已完成','待补充']:checkChoices(todo.value?.id,stage.value?.id,stepIndex.value))
const workDetails=computed(()=>todo.value?.workDetails || (todo.value?.id==='maintenance'?{preparation:['确认靠港作业窗口、停机隔离和作业许可','核对轴瓦型号、润滑及测量工具'],parts:[{name:'1#缸连杆轴承轴瓦',amount:'1套',use:'提前保养换件'}],acceptance:['轴承间隙复测符合设备要求','润滑及复装检查完成'],placeholder:'例如：间隙复测合格，试运转振动2.2 mm/s'}:todo.value?.id==='drift'?{preparation:['确认停机隔离与高压燃油系统泄压条件','准备喷油器校验设备与拆装工具'],parts:[{name:'喷嘴组件',amount:'1套',use:'清洁后校验不合格时更换'}],acceptance:['喷雾形态校验合格','复装密封检查完成'],placeholder:'例如：喷雾形态正常，无泄漏，同工况排温差3°C'}:{preparation:['按现场规程确认冷却系统隔离与作业许可','准备滤器清洗工具，核对密封圈状态'],parts:[{name:'滤器密封圈',amount:'1套',use:'复装备用'}],acceptance:['滤器复装后无泄漏','流量与出口温度已复测'],placeholder:'例如：流量86.5 m³/h，出口温度79.1°C，无泄漏'}))
const acceptanceRows=computed(()=>workDetails.value.acceptanceRows || workDetails.value.acceptance.map((req,i)=>({name:'验收项目 '+(i+1),req,method:'记录现场复测值、工况和检查结果，对照本机规程确认。'})))
watch(stageKey,()=>{subtab.value=tabs.value[readOnly.value&&stage.value?.kind==='check'?1:0]||'';stepIndex.value=0;validation.value='';actionNote.value=''}, {immediate:true})
function taskKey(i){return stageKey.value+':'+i}
function attachFiles(event){attachments[taskKey(stepIndex.value)]=Array.from(event.target.files||[]).map(file=>file.name)}
function nextStep(){if(!readOnly.value&&!results[taskKey(stepIndex.value)]){validation.value='请先选择当前事项的实际结果。';return}validation.value='';if(stepIndex.value<stage.value.tasks.length-1)stepIndex.value++;else if(readOnly.value)advance();else if(stage.value.kind==='work')subtab.value='验收确认';else advance()}
function advance(){
  if(readOnly.value){store.advanceTodo(todo.value.id);return}
  if(stage.value.id==='event'&&subtab.value!=='候选原因'){subtab.value='候选原因';return}
  if(stage.value.tasks?.some((_,i)=>!results[taskKey(i)])){validation.value='请先完成各事项反馈。';subtab.value=stage.value.kind==='check'?stage.value.label+'步骤':(todo.value.id==='maintenance'?'保养':'维修')+'步骤';return}
  if(stage.value.kind==='work'&&(subtab.value!=='验收确认'||accepted.value.length<workDetails.value.acceptance.length)){subtab.value='验收确认';validation.value='请确认现场验收结果。';return}
  if(stage.value.kind==='work'&&stage.value.tasks?.some((_,i)=>['无法确认','待补充','暂不具备条件','读数不一致'].includes(results[taskKey(i)]))){validation.value='本轮作业尚未完成，请补充实际执行记录后继续。';return}
  validation.value=''
  const feedback=(stage.value.tasks||[]).map((task,i)=>({label:task.label,result:results[taskKey(i)],note:notes[taskKey(i)]||'',attachments:attachments[taskKey(i)]||[]}))
  if(stage.value.kind==='work')feedback.push({label:'验收确认',result:accepted.value.join('；'),note:acceptanceNote.value})
  const outcome=store.advanceTodo(todo.value.id,feedback)
  if(outcome?.saved)actionNote.value=outcome.message
  else if(outcome?.message)validation.value=outcome.message
}
function viewObservation(){router.push({path:'/situation',query:{observation:todo.value.id}})}
</script>

<style scoped>
.p2-execution-facts{display:grid;gap:12px;padding:16px 0;border-bottom:1px solid #e8ebf1;margin-bottom:20px}.p2-execution-facts>div{display:grid;grid-template-columns:150px minmax(0,1fr);gap:16px}.p2-execution-facts dt{color:#858c9b}.p2-execution-facts dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.task-operator{display:flex;align-items:center;gap:12px;margin:0 0 12px;font-size:13px;color:#697487}.task-operator select{padding:7px 10px;border:1px solid #dce2eb;border-radius:6px;background:#fff;font:inherit}
.stage-assignment-prompt{margin:12px 0;padding:18px 22px;border:1px solid #d9e5f0;border-radius:8px;background:#f6f9fc;font-size:14px}.stage-assignment-prompt p{margin:6px 0 12px}.stage-assignment-prompt label{display:flex;align-items:center;gap:12px}.stage-assignment-prompt select{padding:8px 12px;border:1px solid #ccd8e6;border-radius:6px;background:#fff;font:inherit}.stage-assignment-prompt>div{display:flex;gap:10px;margin-top:14px}
</style>
